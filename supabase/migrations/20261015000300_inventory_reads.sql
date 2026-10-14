-- Inventarios: funciones de lectura y reportes.
--
-- ESTADO: preparada en el repositorio, NO aplicada en producción.
--
-- Son funciones SECURITY INVOKER: se ejecutan con los permisos de quien llama,
-- así que las policies de RLS (empresa + área del inventario) se aplican a cada
-- consulta. Una jefatura nunca recibe filas de inventarios que no le correspondan.

-- Rol de la persona que llama (para decidir qué mostrar). No da acceso a nada.
create function public.inv_my_role(p_company_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select jsonb_build_object(
      'role', m.role,
      'area', case when m.role = 'CHIEF' then case when m.area = 'TIENDA' then 'TIENDA' else 'ISLA' end end,
      'user_id', m.user_id)
    from public.company_memberships m
    join public.companies c on c.id = m.company_id and c.active
    where m.company_id = p_company_id and m.user_id = (select auth.uid()) and m.active
  ), jsonb_build_object('role', null));
$$;

revoke all on function public.inv_my_role(uuid) from public, anon;
grant execute on function public.inv_my_role(uuid) to authenticated;

-- Resumen para el panel principal.
create function public.inv_overview(p_company_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with today as (select (now() at time zone 'America/Santiago')::date as d),
  inv as (select * from public.inv_inventories where company_id = p_company_id),
  stock as (
    select s.product_id, sum(s.qty)::integer as total
    from public.inv_stock s where s.inventory_id in (select id from inv) group by s.product_id
  ),
  prod as (
    select p.inventory_id, p.id, p.min_stock, coalesce(st.total, 0) as total
    from public.inv_products p left join stock st on st.product_id = p.id
    where p.active and p.inventory_id in (select id from inv)
  ),
  nexp as (
    select s.inventory_id, s.product_id, min(l.expires_on) as next_exp
    from public.inv_stock s join public.inv_lots l on l.id = s.lot_id
    where s.qty > 0 and l.expires_on is not null and s.inventory_id in (select id from inv)
    group by s.inventory_id, s.product_id
  )
  select jsonb_build_object(
    'inventories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'code', i.code, 'name', i.name, 'area', i.area, 'control_unit', i.control_unit, 'active', i.active,
        'expiry_alert_days', i.expiry_alert_days, 'auto_approve_max_abs', i.auto_approve_max_abs,
        'refs', (select count(*) from prod where prod.inventory_id = i.id),
        'stock_total', (select coalesce(sum(total), 0) from prod where prod.inventory_id = i.id),
        'low', (select count(*) from prod where prod.inventory_id = i.id and total > 0 and total < min_stock),
        'out', (select count(*) from prod where prod.inventory_id = i.id and total <= 0),
        'expiring', (select count(*) from nexp, today where nexp.inventory_id = i.id
                       and nexp.next_exp >= today.d and nexp.next_exp <= today.d + i.expiry_alert_days),
        'expired', (select count(*) from nexp, today where nexp.inventory_id = i.id and nexp.next_exp < today.d),
        'pending_adjustments', (select count(*) from public.inv_adjustments a where a.inventory_id = i.id and a.status = 'pending'),
        'waste_month', (
          select coalesce(-sum(m.qty), 0) from public.inv_movements m, today
          where m.inventory_id = i.id and m.kind = 'waste'
            and date_trunc('month', m.created_at at time zone 'America/Santiago') = date_trunc('month', today.d::timestamp)
            and not exists (select 1 from public.inv_movements r where r.reverses_id = m.id)),
        'open_count', exists (select 1 from public.inv_counts c where c.inventory_id = i.id and c.status = 'in_progress'),
        'locations', (select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'name', l.name, 'active', l.active) order by l.name), '[]'::jsonb)
                      from public.inv_locations l where l.inventory_id = i.id)
      ) order by i.code) from inv i
    ), '[]'::jsonb),
    'pending_total', (select count(*) from public.inv_adjustments a where a.status = 'pending' and a.inventory_id in (select id from inv)),
    'server_time', now()
  );
$$;

-- Catálogo con stock, lotes y alertas.
create function public.inv_list_products(p_inventory_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with today as (select (now() at time zone 'America/Santiago')::date as d),
  inv as (select * from public.inv_inventories where id = p_inventory_id),
  rows as (
    select s.product_id,
           sum(s.qty)::integer as total,
           min(l.expires_on) filter (where s.qty > 0) as next_exp,
           jsonb_agg(jsonb_build_object(
             'location_id', s.location_id, 'location', loc.name, 'lot_id', s.lot_id, 'lot_code', l.lot_code,
             'expires_on', l.expires_on, 'qty', s.qty)
             order by l.expires_on nulls last, loc.name) filter (where s.qty > 0) as detail
    from public.inv_stock s
    join public.inv_locations loc on loc.id = s.location_id
    left join public.inv_lots l on l.id = s.lot_id
    where s.inventory_id = p_inventory_id
    group by s.product_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'code', p.code, 'barcode', p.barcode, 'name', p.name, 'category', p.category, 'brand', p.brand,
    'control_unit', p.control_unit, 'presentation', p.presentation,
    'default_location_id', p.default_location_id, 'default_location', dl.name,
    'min_stock', p.min_stock, 'tracks_expiry', p.tracks_expiry, 'receive_unit', p.receive_unit,
    'receive_factor', p.receive_factor, 'attrs', p.attrs, 'active', p.active, 'version', p.version,
    'created_at', p.created_at, 'created_by_name', p.created_by_name,
    'stock', coalesce(r.total, 0), 'stock_detail', coalesce(r.detail, '[]'::jsonb), 'next_expiry', r.next_exp,
    'status', case when coalesce(r.total, 0) <= 0 then 'out' when coalesce(r.total, 0) < p.min_stock then 'low' else 'ok' end,
    'expiry', case
      when r.next_exp is null then null
      when r.next_exp < today.d then 'expired'
      when r.next_exp <= today.d + inv.expiry_alert_days then 'soon' end
  ) order by p.name), '[]'::jsonb)
  from public.inv_products p
  cross join today
  cross join inv
  left join rows r on r.product_id = p.id
  left join public.inv_locations dl on dl.id = p.default_location_id
  where p.inventory_id = p_inventory_id;
$$;

create function public.inv_list_movements(
  p_company_id uuid, p_inventory_id uuid default null, p_product_id uuid default null,
  p_kind text default null, p_limit integer default 100, p_before timestamptz default null
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by (x->>'created_at') desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', m.id, 'created_at', m.created_at, 'kind', m.kind, 'qty', m.qty, 'reason', m.reason, 'note', m.note,
      'reference', m.reference, 'created_by_name', m.created_by_name, 'inventory_id', m.inventory_id,
      'product_id', m.product_id, 'product_code', p.code, 'product_name', p.name,
      'location', loc.name, 'lot_code', l.lot_code, 'expires_on', l.expires_on,
      'group_id', m.group_id, 'receipt_id', m.receipt_id, 'reverses_id', m.reverses_id,
      'reversed', exists (select 1 from public.inv_movements r where r.reverses_id = m.id)
    ) as x
    from public.inv_movements m
    join public.inv_products p on p.id = m.product_id
    join public.inv_locations loc on loc.id = m.location_id
    left join public.inv_lots l on l.id = m.lot_id
    where m.company_id = p_company_id
      and (p_inventory_id is null or m.inventory_id = p_inventory_id)
      and (p_product_id is null or m.product_id = p_product_id)
      and (p_kind is null or m.kind = p_kind)
      and (p_before is null or m.created_at < p_before)
    order by m.created_at desc, m.id desc
    limit least(greatest(coalesce(p_limit, 100), 1), 500)
  ) t;
$$;

create function public.inv_list_adjustments(p_company_id uuid, p_status text default null)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'inventory_id', a.inventory_id, 'inventory', i.name, 'product_id', a.product_id,
    'product_code', p.code, 'product_name', p.name, 'expected_qty', a.expected_qty, 'counted_qty', a.counted_qty,
    'delta', a.delta, 'note', a.note, 'status', a.status, 'requested_by_name', a.requested_by_name,
    'requested_at', a.requested_at, 'reviewed_by_name', a.reviewed_by_name, 'reviewed_at', a.reviewed_at,
    'review_note', a.review_note, 'current_stock', coalesce((select sum(s.qty) from public.inv_stock s where s.product_id = a.product_id), 0)
  ) order by a.requested_at desc), '[]'::jsonb)
  from public.inv_adjustments a
  join public.inv_products p on p.id = a.product_id
  join public.inv_inventories i on i.id = a.inventory_id
  where a.company_id = p_company_id and (p_status is null or a.status = p_status);
$$;

-- Conteo en curso del inventario (sin el stock esperado: conteo ciego).
create function public.inv_get_count(p_inventory_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select (
    select jsonb_build_object(
      'id', c.id, 'inventory_id', c.inventory_id, 'status', c.status,
      'started_by', c.started_by_name, 'started_at', c.started_at, 'server_time', now(),
      'lines', coalesce((
        select jsonb_agg(jsonb_build_object(
          'product_id', cl.product_id, 'counted_qty', cl.counted_qty, 'note', cl.note,
          'counted_by', cl.counted_by_name, 'counted_at', cl.counted_at) order by cl.counted_at)
        from public.inv_count_lines cl where cl.count_id = c.id and cl.counted_qty is not null), '[]'::jsonb))
    from public.inv_counts c where c.inventory_id = p_inventory_id and c.status = 'in_progress'
  );
$$;

create function public.inv_list_receipts(p_inventory_id uuid, p_limit integer default 50)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by (x->>'created_at') desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', r.id, 'supplier', r.supplier, 'received_on', r.received_on, 'document_no', r.document_no,
      'invoice_ref', r.invoice_ref, 'notes', r.notes, 'status', r.status, 'received_by_name', r.received_by_name,
      'created_at', r.created_at, 'void_reason', r.void_reason,
      'lines', (select coalesce(jsonb_agg(jsonb_build_object(
          'product_code', p.code, 'product_name', p.name, 'qty_input', rl.qty_input, 'input_unit', rl.input_unit,
          'factor', rl.factor_applied, 'qty_base', rl.qty_base, 'lot_code', l.lot_code, 'expires_on', l.expires_on)), '[]'::jsonb)
        from public.inv_receipt_lines rl
        join public.inv_products p on p.id = rl.product_id
        left join public.inv_lots l on l.id = rl.lot_id
        where rl.receipt_id = r.id)
    ) as x
    from public.inv_receipts r
    where r.inventory_id = p_inventory_id
    order by r.created_at desc
    limit least(greatest(coalesce(p_limit, 50), 1), 200)
  ) t;
$$;

-- Reportes (Etapa 3)
create function public.inv_report_waste(p_inventory_id uuid, p_from date, p_to date)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with w as (
    select m.*, p.code, p.name
    from public.inv_movements m join public.inv_products p on p.id = m.product_id
    where m.inventory_id = p_inventory_id and m.kind = 'waste'
      and (m.created_at at time zone 'America/Santiago')::date between p_from and p_to
      and not exists (select 1 from public.inv_movements r where r.reverses_id = m.id)
  )
  select jsonb_build_object(
    'from', p_from, 'to', p_to,
    'total', coalesce((select -sum(qty) from w), 0),
    'by_reason', coalesce((select jsonb_agg(jsonb_build_object('reason', reason, 'qty', q, 'events', n) order by q desc)
                           from (select coalesce(reason, 'Sin motivo') as reason, -sum(qty) as q, count(*) as n from w group by 1) s), '[]'::jsonb),
    'by_product', coalesce((select jsonb_agg(jsonb_build_object('code', code, 'name', name, 'qty', q) order by q desc)
                            from (select code, name, -sum(qty) as q from w group by 1, 2) s), '[]'::jsonb)
  );
$$;

create function public.inv_report_shortages(p_inventory_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'code', x.code, 'name', x.name, 'category', x.category, 'stock', x.total, 'min_stock', x.min_stock,
    'missing', x.min_stock - x.total, 'status', case when x.total <= 0 then 'out' else 'low' end
  ) order by (x.total <= 0) desc, (x.min_stock - x.total) desc), '[]'::jsonb)
  from (
    select p.code, p.name, p.category, p.min_stock,
           coalesce((select sum(s.qty) from public.inv_stock s where s.product_id = p.id), 0)::integer as total
    from public.inv_products p where p.inventory_id = p_inventory_id and p.active
  ) x
  where x.total < x.min_stock;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'inv_overview(uuid)', 'inv_list_products(uuid)', 'inv_list_movements(uuid, uuid, uuid, text, integer, timestamptz)',
    'inv_list_adjustments(uuid, text)', 'inv_get_count(uuid)', 'inv_list_receipts(uuid, integer)',
    'inv_report_waste(uuid, date, date)', 'inv_report_shortages(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;
