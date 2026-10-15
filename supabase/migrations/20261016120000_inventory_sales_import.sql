-- Descuento de stock por ventas del POS (informe de ventas por artículo).
--
-- Cambio aditivo:
--   1. Nuevo tipo de movimiento «sale» (venta) en inv_movements.
--   2. public.inv_sales_lines: registro de cada venta ya aplicada (una por empresa, fecha y código
--      del POS). Evita descontar dos veces el mismo día aunque se suba el archivo otra vez.
--   3. inv_apply_sales: aplica las líneas del informe. Empareja por el código del producto,
--      descuenta hasta el stock disponible (nunca deja el stock en negativo) y devuelve las
--      diferencias. Ignora las ventas hasta el día del saldo inicial de cada producto, porque el
--      conteo de ese día ya las refleja. El administrador aplica a cualquier inventario; una jefa
--      solo a los de su área.
--
-- Reversión: supabase/rollback/20261016120000_inventory_sales_import.rollback.sql

-- 1. Tipo de movimiento ------------------------------------------------------
alter table public.inv_movements drop constraint inv_movements_kind_check;
alter table public.inv_movements add constraint inv_movements_kind_check check (kind in (
  'opening', 'receipt', 'issue', 'waste', 'transfer_out', 'transfer_in', 'adjustment', 'reversal', 'sale'
));

-- 2. Ventas ya aplicadas -----------------------------------------------------
create table public.inv_sales_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  inventory_id uuid not null references public.inv_inventories (id) on delete cascade,
  product_id uuid not null references public.inv_products (id),
  sold_on date not null,
  pos_code text not null check (length(trim(pos_code)) > 0 and length(pos_code) <= 40),
  qty_reported integer not null check (qty_reported > 0),
  qty_applied integer not null check (qty_applied >= 0 and qty_applied <= qty_reported),
  request_id uuid not null,
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now(),
  unique (company_id, sold_on, pos_code)
);
create index inv_sales_lines_product_idx on public.inv_sales_lines (product_id, sold_on);

alter table public.inv_sales_lines enable row level security;
revoke all on table public.inv_sales_lines from anon, authenticated;
grant select on table public.inv_sales_lines to authenticated;
create policy "inv_sales_lines_select"
on public.inv_sales_lines for select to authenticated
using (public.inv_can_read(company_id, inventory_id));

-- 3. Aplicar ventas ----------------------------------------------------------
-- p_lines: [{"date": "2026-10-08", "code": "17295", "qty": 6}]
create function public.inv_apply_sales(p_request_id uuid, p_company_id uuid, p_lines jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
  v_replay jsonb;
  l record;
  v_p public.inv_products;
  v_area text;
  v_opening date;
  v_available integer;
  v_take integer;
  v_existing public.inv_sales_lines;
  v_today date := (now() at time zone 'America/Santiago')::date;
  v_applied integer := 0;
  v_units integer := 0;
  v_already integer := 0;
  v_changed jsonb := '[]'::jsonb;
  v_no_product integer := 0;
  v_no_access integer := 0;
  v_before_opening integer := 0;
  v_short jsonb := '[]'::jsonb;
  v_result jsonb;
begin
  select * into a from public.inv_actor(p_company_id);
  v_replay := public.inv_idem_begin(p_company_id, p_request_id, 'sales');
  if v_replay is not null then return v_replay; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    perform public.inv_fail('lines_required', 'El archivo no tiene ventas para aplicar.');
  end if;
  if jsonb_array_length(p_lines) > 3000 then
    perform public.inv_fail('too_many_lines', 'El archivo tiene demasiadas líneas. Sube un período más corto.');
  end if;

  for l in
    select (e->>'date')::date as sold_on, trim(e->>'code') as code, sum((e->>'qty')::integer) as qty
    from jsonb_array_elements(p_lines) e
    group by 1, 2
    order by 1, 2
  loop
    if l.sold_on is null or l.code is null or l.code = '' or l.qty is null or l.qty <= 0 then
      perform public.inv_fail('invalid_line', 'Hay una línea de ventas con fecha, código o cantidad no válidos.');
    end if;
    if l.sold_on > v_today then
      perform public.inv_fail('invalid_date', 'El archivo trae ventas con fecha futura.');
    end if;

    select * into v_p from public.inv_products where company_id = p_company_id and code = l.code and active;
    if not found then v_no_product := v_no_product + 1; continue; end if;
    select i.area into v_area from public.inv_inventories i where i.id = v_p.inventory_id and i.active;
    if v_area is null or (a.role <> 'ADMIN' and v_area is distinct from a.area) then
      v_no_access := v_no_access + 1; continue;
    end if;

    -- El conteo del día del saldo inicial ya incluye las ventas de ese día.
    select min((m.created_at at time zone 'America/Santiago')::date) into v_opening
    from public.inv_movements m where m.product_id = v_p.id and m.kind = 'opening';
    if v_opening is not null and l.sold_on <= v_opening then
      v_before_opening := v_before_opening + 1; continue;
    end if;

    select * into v_existing from public.inv_sales_lines
    where company_id = p_company_id and sold_on = l.sold_on and pos_code = l.code;
    if found then
      if v_existing.qty_reported = l.qty then v_already := v_already + 1;
      else
        v_changed := v_changed || jsonb_build_object('code', l.code, 'name', v_p.name, 'date', l.sold_on,
          'before', v_existing.qty_reported, 'now', l.qty);
      end if;
      continue;
    end if;

    select coalesce(sum(s.qty), 0)::integer into v_available from public.inv_stock s where s.product_id = v_p.id;
    v_take := least(l.qty, v_available);
    if v_take > 0 then
      perform public.inv_consume(p_company_id, v_p.inventory_id, v_p.id, null, null, v_take, 'sale', 'Venta POS',
        null, to_char(l.sold_on, 'YYYY-MM-DD'), gen_random_uuid(), null, null, p_request_id);
    end if;
    insert into public.inv_sales_lines (company_id, inventory_id, product_id, sold_on, pos_code, qty_reported, qty_applied,
                                        request_id, created_by, created_by_name)
    values (p_company_id, v_p.inventory_id, v_p.id, l.sold_on, l.code, l.qty, v_take, p_request_id, a.user_id, a.user_name);
    v_applied := v_applied + 1;
    v_units := v_units + v_take;
    if v_take < l.qty then
      v_short := v_short || jsonb_build_object('code', l.code, 'name', v_p.name, 'date', l.sold_on,
        'sold', l.qty, 'applied', v_take);
    end if;
  end loop;

  perform public.inv_log(p_company_id, 'sales.import', 'company', p_company_id,
    jsonb_build_object('lines', v_applied, 'units', v_units, 'short', jsonb_array_length(v_short)));
  v_result := jsonb_build_object(
    'applied_lines', v_applied, 'units_applied', v_units, 'already', v_already, 'changed', v_changed,
    'no_product', v_no_product, 'no_access', v_no_access, 'before_opening', v_before_opening, 'shortfalls', v_short);
  return public.inv_idem_end(p_company_id, p_request_id, v_result);
end;
$$;
revoke all on function public.inv_apply_sales(uuid, uuid, jsonb) from public, anon;
grant execute on function public.inv_apply_sales(uuid, uuid, jsonb) to authenticated;
