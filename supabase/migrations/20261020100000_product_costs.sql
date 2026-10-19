-- Costo unitario neto de los productos de Inventarios (solo administrador).
--
--   1. inv_product_costs: historial de costos de compra por producto. Cada fila es una línea de factura:
--      cantidad recibida, producto neto, flete e impuesto específico (ILA, tabaco), todo sin IVA.
--      Los costos por unidad se calculan solos. No se modifica una fila: un costo mal cargado se anula.
--      El costo vigente de un producto es el de su compra más reciente que no esté anulada.
--   2. inv_cost_register: carga las líneas de una factura de una vez (atómica). Acepta la cantidad en la unidad
--      de control o en la unidad de compra (cartón, pack) y la convierte con el factor del producto.
--   3. inv_cost_void: anula una línea cargada por error.
--   4. inv_costs_overview: por producto, costo vigente, costo anterior y precio de venta promedio del POS
--      (sales_history, últimos 60 días, con IVA) para calcular el margen en pantalla.
--   5. inv_cost_history: compras registradas de un producto.
--
-- La tabla solo se lee y solo el administrador; se escribe únicamente con las funciones. Sin IVA en ningún monto.
-- Reversión: supabase/rollback/20261020100000_product_costs.rollback.sql

create table public.inv_product_costs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  inventory_id uuid not null references public.inv_inventories (id) on delete cascade,
  product_id uuid not null references public.inv_products (id),
  bought_on date not null,
  supplier text not null check (length(trim(supplier)) > 0 and length(supplier) <= 120),
  document_no text not null check (length(trim(document_no)) > 0 and length(document_no) <= 60),
  qty_base integer not null check (qty_base > 0),
  net_total bigint not null check (net_total > 0),
  freight_total bigint not null default 0 check (freight_total >= 0),
  tax_total bigint not null default 0 check (tax_total >= 0),
  unit_net numeric(14, 4) generated always as (net_total::numeric / qty_base) stored,
  unit_freight numeric(14, 4) generated always as (freight_total::numeric / qty_base) stored,
  unit_tax numeric(14, 4) generated always as (tax_total::numeric / qty_base) stored,
  unit_total numeric(14, 4) generated always as ((net_total + freight_total + tax_total)::numeric / qty_base) stored,
  note text check (note is null or length(note) <= 300),
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by_name text,
  void_reason text
);
-- Una misma factura de un proveedor no carga dos veces el mismo producto.
create unique index inv_product_costs_doc_key
  on public.inv_product_costs (product_id, lower(trim(supplier)), lower(trim(document_no))) where voided_at is null;
create index inv_product_costs_product_idx on public.inv_product_costs (product_id, bought_on desc) where voided_at is null;

alter table public.inv_product_costs enable row level security;
revoke all on table public.inv_product_costs from anon, authenticated;
grant select on table public.inv_product_costs to authenticated;
create policy inv_product_costs_select on public.inv_product_costs for select to authenticated
using (public.is_company_admin(company_id));

-- p_header: {"supplier": "...", "document_no": "...", "bought_on": "2026-10-09", "note": "..."}
-- p_lines:  [{"product_id": "...", "qty": 6, "unit": "base"|"purchase", "net": 6074, "freight": 614, "tax": 0}]
create function public.inv_cost_register(p_company_id uuid, p_inventory_id uuid, p_header jsonb, p_lines jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
  e jsonb;
  p public.inv_products;
  v_today date := (now() at time zone 'America/Santiago')::date;
  v_on date;
  v_supplier text;
  v_doc text;
  v_note text;
  v_qty integer;
  v_net bigint;
  v_freight bigint;
  v_tax bigint;
  v_n integer := 0;
begin
  select * into a from public.inv_actor(p_company_id);
  if a.role <> 'ADMIN' then
    perform public.inv_fail('forbidden', 'Solo el administrador carga costos.', null, '42501');
  end if;
  if not exists (select 1 from public.inv_inventories where id = p_inventory_id and company_id = p_company_id) then
    perform public.inv_fail('not_found', 'El inventario no existe.', null, '42501');
  end if;
  v_supplier := nullif(trim(coalesce(p_header->>'supplier', '')), '');
  v_doc := nullif(trim(coalesce(p_header->>'document_no', '')), '');
  v_note := nullif(trim(coalesce(p_header->>'note', '')), '');
  if v_supplier is null then perform public.inv_fail('supplier_required', 'Indica el proveedor.'); end if;
  if v_doc is null then perform public.inv_fail('document_required', 'Indica el número de factura.'); end if;
  begin
    v_on := coalesce(nullif(p_header->>'bought_on', '')::date, v_today);
  exception when others then
    perform public.inv_fail('invalid_date', 'La fecha de la factura no es válida.');
  end;
  if v_on > v_today or v_on < date '2020-01-01' then
    perform public.inv_fail('invalid_date', 'La fecha de la factura no puede ser futura.');
  end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    perform public.inv_fail('lines_required', 'Agrega al menos un producto.');
  end if;
  if jsonb_array_length(p_lines) > 200 then
    perform public.inv_fail('too_many_lines', 'La factura trae demasiadas líneas.');
  end if;

  for e in select * from jsonb_array_elements(p_lines) loop
    select * into p from public.inv_products
    where id = (e->>'product_id')::uuid and company_id = p_company_id and inventory_id = p_inventory_id and active;
    if not found then
      perform public.inv_fail('product_not_found', 'Un producto de la factura no existe o está inactivo.');
    end if;
    begin
      v_qty := (e->>'qty')::integer * case when e->>'unit' = 'purchase' then p.receive_factor else 1 end;
      v_net := round((e->>'net')::numeric);
      v_freight := round(coalesce(nullif(e->>'freight', '')::numeric, 0));
      v_tax := round(coalesce(nullif(e->>'tax', '')::numeric, 0));
    exception when others then
      perform public.inv_fail('invalid_line', format('Revisa cantidad y montos de «%s».', p.name));
    end;
    if v_qty is null or v_qty <= 0 or v_net is null or v_net <= 0 or v_freight < 0 or v_tax < 0 then
      perform public.inv_fail('invalid_line', format('Revisa cantidad y montos de «%s».', p.name));
    end if;
    begin
      insert into public.inv_product_costs (company_id, inventory_id, product_id, bought_on, supplier, document_no,
                                            qty_base, net_total, freight_total, tax_total, note, created_by, created_by_name)
      values (p_company_id, p_inventory_id, p.id, v_on, v_supplier, v_doc, v_qty, v_net, v_freight, v_tax, v_note,
              a.user_id, a.user_name);
    exception when unique_violation then
      perform public.inv_fail('duplicate_cost', format('«%s» ya está cargado con esa factura de ese proveedor.', p.name));
    end;
    v_n := v_n + 1;
  end loop;

  perform public.inv_log(p_company_id, 'cost.register', 'inventory', p_inventory_id,
    jsonb_build_object('supplier', v_supplier, 'document_no', v_doc, 'bought_on', v_on, 'lines', v_n));
  return jsonb_build_object('lines', v_n, 'supplier', v_supplier, 'document_no', v_doc, 'bought_on', v_on);
end;
$$;
revoke all on function public.inv_cost_register(uuid, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.inv_cost_register(uuid, uuid, jsonb, jsonb) to authenticated;

create function public.inv_cost_void(p_company_id uuid, p_cost_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
  c public.inv_product_costs;
begin
  select * into a from public.inv_actor(p_company_id);
  if a.role <> 'ADMIN' then
    perform public.inv_fail('forbidden', 'Solo el administrador anula costos.', null, '42501');
  end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then
    perform public.inv_fail('reason_required', 'Indica el motivo.');
  end if;
  select * into c from public.inv_product_costs where id = p_cost_id and company_id = p_company_id for update;
  if not found then perform public.inv_fail('not_found', 'El costo no existe.', null, '42501'); end if;
  if c.voided_at is not null then perform public.inv_fail('already_voided', 'Ese costo ya estaba anulado.'); end if;
  update public.inv_product_costs
  set voided_at = now(), voided_by_name = a.user_name, void_reason = trim(p_reason)
  where id = c.id;
  perform public.inv_log(p_company_id, 'cost.void', 'product', c.product_id,
    jsonb_build_object('cost_id', c.id, 'document_no', c.document_no, 'reason', trim(p_reason)));
  return jsonb_build_object('id', c.id);
end;
$$;
revoke all on function public.inv_cost_void(uuid, uuid, text) from public, anon;
grant execute on function public.inv_cost_void(uuid, uuid, text) to authenticated;

create function public.inv_costs_overview(p_company_id uuid, p_inventory_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  a record;
  v_today date := (now() at time zone 'America/Santiago')::date;
begin
  select * into a from public.inv_actor(p_company_id);
  if a.role <> 'ADMIN' then
    perform public.inv_fail('forbidden', 'Solo el administrador ve los costos.', null, '42501');
  end if;
  return coalesce((
    select jsonb_agg(row_to_json(t) order by t.name, t.presentation)
    from (
      select p.id as product_id, p.code, p.name, p.presentation, p.category, p.control_unit,
             p.receive_unit, p.receive_factor,
             cur.id as cost_id, cur.bought_on, cur.supplier, cur.document_no, cur.qty_base,
             cur.unit_net, cur.unit_freight, cur.unit_tax, cur.unit_total,
             prev.unit_total as prev_unit_total, prev.bought_on as prev_bought_on,
             s.units_sold, s.amount_sold,
             case when s.units_sold > 0 then round(s.amount_sold::numeric / s.units_sold, 2) end as price_gross
      from public.inv_products p
      left join lateral (
        select c.* from public.inv_product_costs c
        where c.product_id = p.id and c.voided_at is null order by c.bought_on desc, c.created_at desc limit 1
      ) cur on true
      left join lateral (
        select c.* from public.inv_product_costs c
        where c.product_id = p.id and c.voided_at is null and c.id is distinct from cur.id
        order by c.bought_on desc, c.created_at desc limit 1
      ) prev on true
      left join lateral (
        select sum(h.qty)::integer as units_sold, sum(h.amount) as amount_sold
        from public.sales_history h
        where h.company_id = p.company_id and h.inventory_id = p.inventory_id and h.pos_code = p.code
          and h.sold_on > v_today - 60 and h.amount > 0
      ) s on true
      where p.company_id = p_company_id and p.inventory_id = p_inventory_id and p.active
    ) t
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.inv_costs_overview(uuid, uuid) from public, anon;
grant execute on function public.inv_costs_overview(uuid, uuid) to authenticated;

create function public.inv_cost_history(p_company_id uuid, p_product_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  a record;
begin
  select * into a from public.inv_actor(p_company_id);
  if a.role <> 'ADMIN' then
    perform public.inv_fail('forbidden', 'Solo el administrador ve los costos.', null, '42501');
  end if;
  return coalesce((
    select jsonb_agg(row_to_json(t) order by t.bought_on desc, t.created_at desc)
    from (
      select c.id, c.bought_on, c.supplier, c.document_no, c.qty_base, c.net_total, c.freight_total, c.tax_total,
             c.unit_net, c.unit_freight, c.unit_tax, c.unit_total, c.created_by_name, c.created_at,
             c.voided_at, c.void_reason
      from public.inv_product_costs c
      where c.company_id = p_company_id and c.product_id = p_product_id
      order by c.bought_on desc, c.created_at desc limit 40
    ) t
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.inv_cost_history(uuid, uuid) from public, anon;
grant execute on function public.inv_cost_history(uuid, uuid) to authenticated;
