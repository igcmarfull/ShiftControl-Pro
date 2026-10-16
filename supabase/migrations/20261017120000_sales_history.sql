-- Historial de ventas del POS por producto (página «Ventas de lubricantes»).
--
-- Cambio aditivo:
--   1. public.sales_history: unidades y monto vendidos por día y código del POS de los productos
--      que existen en Inventarios. Es independiente del stock: se guarda aunque el producto aún no
--      tenga saldo inicial.
--   2. sales_history_save: la importación de ventas envía todas las líneas del informe; se guardan
--      las de productos activos de inventarios a los que el usuario tiene acceso (el administrador a
--      todos; una jefa, a los de su área). Una fila por empresa, fecha y código; repetir el archivo
--      actualiza la misma fila.
--
-- Reversión: supabase/rollback/20261017120000_sales_history.rollback.sql

create table public.sales_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  inventory_id uuid not null references public.inv_inventories (id) on delete cascade,
  sold_on date not null,
  pos_code text not null check (length(trim(pos_code)) > 0 and length(pos_code) <= 40),
  qty integer not null check (qty > 0),
  amount bigint not null default 0 check (amount >= 0),
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, sold_on, pos_code)
);
create index sales_history_inventory_idx on public.sales_history (inventory_id, sold_on);

alter table public.sales_history enable row level security;
revoke all on table public.sales_history from anon, authenticated;
grant select on table public.sales_history to authenticated;
create policy "sales_history_select"
on public.sales_history for select to authenticated
using (public.inv_can_read(company_id, inventory_id));

-- p_lines: [{"date": "2026-10-08", "code": "221627", "qty": 6, "amount": 36540}]
create function public.sales_history_save(p_company_id uuid, p_lines jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
  l record;
  v_p public.inv_products;
  v_area text;
  v_old public.sales_history;
  v_today date := (now() at time zone 'America/Santiago')::date;
  v_saved integer := 0;
  v_updated integer := 0;
  v_same integer := 0;
  v_no_product integer := 0;
  v_no_access integer := 0;
begin
  select * into a from public.inv_actor(p_company_id);
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    perform public.inv_fail('lines_required', 'El archivo no tiene ventas para guardar.');
  end if;
  if jsonb_array_length(p_lines) > 3000 then
    perform public.inv_fail('too_many_lines', 'El archivo tiene demasiadas líneas. Sube un período más corto.');
  end if;

  for l in
    select (e->>'date')::date as sold_on, trim(e->>'code') as code,
           sum((e->>'qty')::integer) as qty, sum(coalesce(nullif(e->>'amount', '')::numeric, 0)) as amount
    from jsonb_array_elements(p_lines) e
    group by 1, 2
    order by 1, 2
  loop
    if l.sold_on is null or l.code is null or l.code = '' or l.qty is null or l.qty <= 0 or l.amount < 0 then
      perform public.inv_fail('invalid_line', 'Hay una línea de ventas con fecha, código, cantidad o monto no válidos.');
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

    select * into v_old from public.sales_history
    where company_id = p_company_id and sold_on = l.sold_on and pos_code = l.code;
    if found then
      if v_old.qty = l.qty and v_old.amount = round(l.amount) then v_same := v_same + 1; continue; end if;
      update public.sales_history set qty = l.qty, amount = round(l.amount), inventory_id = v_p.inventory_id, updated_at = now()
      where id = v_old.id;
      v_updated := v_updated + 1;
    else
      insert into public.sales_history (company_id, inventory_id, sold_on, pos_code, qty, amount, created_by, created_by_name)
      values (p_company_id, v_p.inventory_id, l.sold_on, l.code, l.qty, round(l.amount), a.user_id, a.user_name);
      v_saved := v_saved + 1;
    end if;
  end loop;

  return jsonb_build_object('saved', v_saved, 'updated', v_updated, 'unchanged', v_same,
    'no_product', v_no_product, 'no_access', v_no_access);
end;
$$;
revoke all on function public.sales_history_save(uuid, jsonb) from public, anon;
grant execute on function public.sales_history_save(uuid, jsonb) to authenticated;
