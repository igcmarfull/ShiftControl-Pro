-- Pruebas de la migración 20261020100000_product_costs.sql (costo unitario neto de los productos).
--
-- SOLO PARA UNA BASE LOCAL DESECHABLE con todas las migraciones aplicadas (incluidas inventario y ventas).
-- Crea empresas y usuarios ficticios dentro de una transacción que termina en ROLLBACK. No ejecutar contra producción.
--
-- Uso:
--   psql -d <base_local> -v ON_ERROR_STOP=1 -f supabase/tests/costos_local.sql
begin;

create temp table ctx (k text primary key, v text);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000a0001', 'admin-a@example.invalid'),
  ('00000000-0000-0000-0000-0000000a0002', 'jefa-tienda@example.invalid'),
  ('00000000-0000-0000-0000-0000000a0003', 'jefa-isla@example.invalid'),
  ('00000000-0000-0000-0000-0000000a0004', 'jefa-inactiva@example.invalid'),
  ('00000000-0000-0000-0000-0000000b0001', 'admin-b@example.invalid');
insert into public.profiles (id, display_name, active)
select id, 'Prueba ' || right(id::text, 4), true from auth.users on conflict (id) do update set active = true;
insert into public.companies (id, name) values
  ('00000000-0000-0000-0000-00000000000a', 'Empresa A'),
  ('00000000-0000-0000-0000-00000000000b', 'Empresa B');
insert into public.company_memberships (company_id, user_id, role, area, active) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000a0001', 'ADMIN', null, true),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000a0002', 'CHIEF', 'TIENDA', true),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000a0003', 'CHIEF', 'ESTACION', true),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000a0004', 'CHIEF', 'TIENDA', false),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000b0001', 'ADMIN', null, true);
insert into ctx values
  ('A', '00000000-0000-0000-0000-00000000000a'), ('B', '00000000-0000-0000-0000-00000000000b'),
  ('adm', '00000000-0000-0000-0000-0000000a0001'), ('jt', '00000000-0000-0000-0000-0000000a0002'),
  ('ji', '00000000-0000-0000-0000-0000000a0003'), ('off', '00000000-0000-0000-0000-0000000a0004'),
  ('admB', '00000000-0000-0000-0000-0000000b0001');

create function pg_temp.g(p_k text) returns text language sql as $$ select v from ctx where k = p_k $$;
create function pg_temp.put(p_k text, p_v text) returns void language sql as $$
  insert into ctx values (p_k, p_v) on conflict (k) do update set v = excluded.v $$;
create function pg_temp.call(p_user text, p_sql text) returns jsonb language plpgsql as $$
declare v jsonb;
begin
  perform set_config('request.jwt.claim.sub', pg_temp.g(p_user), true);
  set local role authenticated;
  execute p_sql into v;
  reset role;
  return v;
exception when others then
  reset role;
  raise;
end $$;
create function pg_temp.try(p_user text, p_sql text) returns text language plpgsql as $$
declare v_msg text;
begin
  perform set_config('request.jwt.claim.sub', pg_temp.g(p_user), true);
  begin
    set local role authenticated;
    execute p_sql;
    reset role;
    return 'OK';
  exception when others then
    reset role;
    get stacked diagnostics v_msg = message_text;
    return v_msg;
  end;
end $$;
create function pg_temp.ok(p_name text, p_cond boolean, p_detail text default '') returns void language plpgsql as $$
begin
  if p_cond is not true then raise exception 'FAIL %  %', p_name, p_detail; end if;
  raise notice 'PASS %', p_name;
end $$;

do $$
declare r jsonb; i jsonb; p jsonb; v_msg text; v_n jsonb; o jsonb; v_cost uuid;
begin
  r := pg_temp.call('adm', format('select public.inv_setup(%L)', pg_temp.g('A')));
  for i in select * from jsonb_array_elements(r->'inventories') loop
    perform pg_temp.put('inv_' || (i->>'code'), i->>'id');
  end loop;
  r := pg_temp.call('admB', format('select public.inv_setup(%L)', pg_temp.g('B')));
  for i in select * from jsonb_array_elements(r->'inventories') loop
    perform pg_temp.put('invB_' || (i->>'code'), i->>'id');
  end loop;
  p := pg_temp.call('adm', format('select public.inv_save_product(%L, %L::jsonb)', pg_temp.g('inv_tienda'), '{"code":"T1","name":"Coca Cola 1,5 L","control_unit":"unidad","receive_unit":"pack","receive_factor":6}'));
  perform pg_temp.put('p1', p->>'id');
  p := pg_temp.call('adm', format('select public.inv_save_product(%L, %L::jsonb)', pg_temp.g('inv_tienda'), '{"code":"T2","name":"Vital 1,6 L","control_unit":"unidad"}'));
  perform pg_temp.put('p2', p->>'id');
  p := pg_temp.call('adm', format('select public.inv_save_product(%L, %L::jsonb)', pg_temp.g('inv_cigarrillos'), '{"code":"C1","name":"Kent","control_unit":"cajetilla"}'));
  perform pg_temp.put('pc', p->>'id');

  -- Registro: 5 packs de 6 = 30 unidades; neto 30.370, flete 3.074, impuesto 3.370.
  r := pg_temp.call('adm', format($q$select public.inv_cost_register(%L, %L, %L::jsonb, %L::jsonb)$q$, pg_temp.g('A'), pg_temp.g('inv_tienda'),
    '{"supplier":"Embotelladora Andina","document_no":"97817001","bought_on":"2026-10-09"}',
    json_build_array(json_build_object('product_id', pg_temp.g('p1'), 'qty', 5, 'unit', 'purchase', 'net', 30370, 'freight', 3074, 'tax', 3370),
                     json_build_object('product_id', pg_temp.g('p2'), 'qty', 12, 'unit', 'base', 'net', 6000))::text));
  perform pg_temp.ok('El administrador carga las líneas de una factura', (r->>'lines')::int = 2, r::text);

  o := pg_temp.call('adm', format('select public.inv_costs_overview(%L, %L)', pg_temp.g('A'), pg_temp.g('inv_tienda')));
  perform pg_temp.ok('El resumen trae los dos productos', jsonb_array_length(o) = 2, o::text);
  perform pg_temp.ok('Pack × 6 se convierte a unidades', (o->0->>'qty_base')::int = 30, (o->0)::text);
  perform pg_temp.ok('Costo neto por unidad', round((o->0->>'unit_net')::numeric, 2) = 1012.33, (o->0)::text);
  perform pg_temp.ok('Flete por unidad', round((o->0->>'unit_freight')::numeric, 2) = 102.47, (o->0)::text);
  perform pg_temp.ok('Costo real por unidad', round((o->0->>'unit_total')::numeric, 2) = 1227.13, (o->0)::text);
  perform pg_temp.ok('Sin impuesto el costo es el neto', (o->1->>'unit_total')::numeric = 500 and (o->1->>'unit_tax')::numeric = 0, (o->1)::text);
  perform pg_temp.ok('Sin ventas no hay precio', o->0->>'price_gross' is null, (o->0)::text);

  -- Costo nuevo → pasa a ser el vigente y el anterior queda de referencia.
  perform pg_temp.call('adm', format($q$select public.inv_cost_register(%L, %L, %L::jsonb, %L::jsonb)$q$, pg_temp.g('A'), pg_temp.g('inv_tienda'),
    '{"supplier":"Embotelladora Andina","document_no":"97900002","bought_on":"2026-10-16"}',
    json_build_array(json_build_object('product_id', pg_temp.g('p2'), 'qty', 10, 'net', 6500))::text));
  o := pg_temp.call('adm', format('select public.inv_costs_overview(%L, %L)', pg_temp.g('A'), pg_temp.g('inv_tienda')));
  perform pg_temp.ok('El costo vigente es la compra más reciente', (o->1->>'unit_total')::numeric = 650 and o->1->>'document_no' = '97900002', (o->1)::text);
  perform pg_temp.ok('Queda el costo anterior', (o->1->>'prev_unit_total')::numeric = 500, (o->1)::text);

  -- Precio del POS: promedio ponderado, con IVA.
  insert into public.sales_history (company_id, inventory_id, sold_on, pos_code, qty, amount) values
    (pg_temp.g('A')::uuid, pg_temp.g('inv_tienda')::uuid, (now() at time zone 'America/Santiago')::date - 2, 'T2', 10, 19000),
    (pg_temp.g('A')::uuid, pg_temp.g('inv_tienda')::uuid, (now() at time zone 'America/Santiago')::date - 1, 'T2', 10, 21000),
    (pg_temp.g('A')::uuid, pg_temp.g('inv_tienda')::uuid, (now() at time zone 'America/Santiago')::date - 90, 'T2', 50, 50000);
  o := pg_temp.call('adm', format('select public.inv_costs_overview(%L, %L)', pg_temp.g('A'), pg_temp.g('inv_tienda')));
  perform pg_temp.ok('Precio de venta: promedio de los últimos 60 días', (o->1->>'price_gross')::numeric = 2000 and (o->1->>'units_sold')::int = 20, (o->1)::text);

  -- Validaciones
  v_msg := pg_temp.try('adm', format($q$select public.inv_cost_register(%L, %L, %L::jsonb, %L::jsonb)$q$, pg_temp.g('A'), pg_temp.g('inv_tienda'),
    '{"supplier":"Embotelladora Andina","document_no":"97817001"}', json_build_array(json_build_object('product_id', pg_temp.g('p2'), 'qty', 1, 'net', 100))::text));
  perform pg_temp.ok('La misma factura no carga dos veces el mismo producto', v_msg = 'inv:duplicate_cost', v_msg);
  v_msg := pg_temp.try('adm', format($q$select public.inv_cost_register(%L, %L, %L::jsonb, %L::jsonb)$q$, pg_temp.g('A'), pg_temp.g('inv_tienda'),
    '{"supplier":"X","document_no":"1"}', json_build_array(json_build_object('product_id', pg_temp.g('pc'), 'qty', 1, 'net', 100))::text));
  perform pg_temp.ok('No acepta un producto de otro inventario', v_msg = 'inv:product_not_found', v_msg);
  v_msg := pg_temp.try('adm', format($q$select public.inv_cost_register(%L, %L, %L::jsonb, %L::jsonb)$q$, pg_temp.g('A'), pg_temp.g('inv_tienda'),
    '{"supplier":"X","document_no":"2"}', json_build_array(json_build_object('product_id', pg_temp.g('p2'), 'qty', 0, 'net', 100))::text));
  perform pg_temp.ok('No acepta cantidad en cero', v_msg = 'inv:invalid_line', v_msg);
  v_msg := pg_temp.try('adm', format($q$select public.inv_cost_register(%L, %L, %L::jsonb, %L::jsonb)$q$, pg_temp.g('A'), pg_temp.g('inv_tienda'),
    '{"supplier":"X","document_no":"3"}', json_build_array(json_build_object('product_id', pg_temp.g('p2'), 'qty', 1, 'net', 0))::text));
  perform pg_temp.ok('No acepta neto en cero', v_msg = 'inv:invalid_line', v_msg);
  v_msg := pg_temp.try('adm', format($q$select public.inv_cost_register(%L, %L, %L::jsonb, %L::jsonb)$q$, pg_temp.g('A'), pg_temp.g('inv_tienda'),
    '{"supplier":"X","document_no":"4"}', json_build_array(json_build_object('product_id', pg_temp.g('p2'), 'qty', 1, 'net', 100, 'freight', -5))::text));
  perform pg_temp.ok('No acepta flete negativo', v_msg = 'inv:invalid_line', v_msg);
  v_msg := pg_temp.try('adm', format($q$select public.inv_cost_register(%L, %L, %L::jsonb, '[]')$q$, pg_temp.g('A'), pg_temp.g('inv_tienda'), '{"supplier":"X","document_no":"5"}'));
  perform pg_temp.ok('Pide al menos una línea', v_msg = 'inv:lines_required', v_msg);
  v_msg := pg_temp.try('adm', format($q$select public.inv_cost_register(%L, %L, %L::jsonb, %L::jsonb)$q$, pg_temp.g('A'), pg_temp.g('inv_tienda'),
    '{"document_no":"6"}', json_build_array(json_build_object('product_id', pg_temp.g('p2'), 'qty', 1, 'net', 100))::text));
  perform pg_temp.ok('Pide proveedor', v_msg = 'inv:supplier_required', v_msg);
  v_msg := pg_temp.try('adm', format($q$select public.inv_cost_register(%L, %L, %L::jsonb, %L::jsonb)$q$, pg_temp.g('A'), pg_temp.g('inv_tienda'),
    '{"supplier":"X"}', json_build_array(json_build_object('product_id', pg_temp.g('p2'), 'qty', 1, 'net', 100))::text));
  perform pg_temp.ok('Pide número de factura', v_msg = 'inv:document_required', v_msg);
  v_msg := pg_temp.try('adm', format($q$select public.inv_cost_register(%L, %L, %L::jsonb, %L::jsonb)$q$, pg_temp.g('A'), pg_temp.g('inv_tienda'),
    format('{"supplier":"X","document_no":"7","bought_on":"%s"}', (now() at time zone 'America/Santiago')::date + 3), json_build_array(json_build_object('product_id', pg_temp.g('p2'), 'qty', 1, 'net', 100))::text));
  perform pg_temp.ok('No acepta fechas futuras', v_msg = 'inv:invalid_date', v_msg);
  -- Atomicidad: una línea mala no deja la anterior.
  v_msg := pg_temp.try('adm', format($q$select public.inv_cost_register(%L, %L, %L::jsonb, %L::jsonb)$q$, pg_temp.g('A'), pg_temp.g('inv_tienda'),
    '{"supplier":"Y","document_no":"8"}', json_build_array(json_build_object('product_id', pg_temp.g('p1'), 'qty', 1, 'net', 100), json_build_object('product_id', pg_temp.g('p2'), 'qty', 0, 'net', 100))::text));
  v_n := pg_temp.call('adm', $q$select to_jsonb(count(*)) from public.inv_product_costs where supplier = 'Y'$q$);
  perform pg_temp.ok('Si una línea falla no se guarda ninguna', (v_n#>>'{}')::int = 0, v_n::text);

  -- Permisos
  v_msg := pg_temp.try('jt', format($q$select public.inv_cost_register(%L, %L, %L::jsonb, %L::jsonb)$q$, pg_temp.g('A'), pg_temp.g('inv_tienda'),
    '{"supplier":"X","document_no":"9"}', json_build_array(json_build_object('product_id', pg_temp.g('p2'), 'qty', 1, 'net', 100))::text));
  perform pg_temp.ok('La jefa de tienda no carga costos', v_msg = 'inv:forbidden', v_msg);
  v_msg := pg_temp.try('jt', format('select public.inv_costs_overview(%L, %L)', pg_temp.g('A'), pg_temp.g('inv_tienda')));
  perform pg_temp.ok('La jefa de tienda no ve el resumen de costos', v_msg = 'inv:forbidden', v_msg);
  v_msg := pg_temp.try('jt', format('select public.inv_cost_history(%L, %L)', pg_temp.g('A'), pg_temp.g('p2')));
  perform pg_temp.ok('La jefa de tienda no ve el historial', v_msg = 'inv:forbidden', v_msg);
  v_n := pg_temp.call('jt', $q$select to_jsonb(count(*)) from public.inv_product_costs$q$);
  perform pg_temp.ok('La jefa de tienda no lee la tabla', (v_n#>>'{}')::int = 0, v_n::text);
  v_n := pg_temp.call('ji', $q$select to_jsonb(count(*)) from public.inv_product_costs$q$);
  perform pg_temp.ok('La jefa de isla no lee la tabla', (v_n#>>'{}')::int = 0, v_n::text);
  v_n := pg_temp.call('admB', $q$select to_jsonb(count(*)) from public.inv_product_costs$q$);
  perform pg_temp.ok('Otra empresa no lee la tabla', (v_n#>>'{}')::int = 0, v_n::text);
  v_msg := pg_temp.try('admB', format('select public.inv_costs_overview(%L, %L)', pg_temp.g('A'), pg_temp.g('inv_tienda')));
  perform pg_temp.ok('Otra empresa no ve el resumen', v_msg like 'inv:%', v_msg);
  v_msg := pg_temp.try('adm', format($q$insert into public.inv_product_costs (company_id, inventory_id, product_id, bought_on, supplier, document_no, qty_base, net_total) values (%L, %L, %L, current_date, 'a', 'b', 1, 1)$q$, pg_temp.g('A'), pg_temp.g('inv_tienda'), pg_temp.g('p2')));
  perform pg_temp.ok('Nadie escribe directo en la tabla', v_msg ilike '%permission denied%', v_msg);

  -- Anulación
  o := pg_temp.call('adm', format('select public.inv_cost_history(%L, %L)', pg_temp.g('A'), pg_temp.g('p2')));
  perform pg_temp.ok('El historial lista las compras', jsonb_array_length(o) = 2, o::text);
  v_cost := (o->0->>'id')::uuid;
  v_msg := pg_temp.try('adm', format('select public.inv_cost_void(%L, %L, %L)', pg_temp.g('A'), v_cost, ' '));
  perform pg_temp.ok('Anular pide motivo', v_msg = 'inv:reason_required', v_msg);
  v_msg := pg_temp.try('jt', format('select public.inv_cost_void(%L, %L, %L)', pg_temp.g('A'), v_cost, 'error'));
  perform pg_temp.ok('La jefa de tienda no anula', v_msg = 'inv:forbidden', v_msg);
  perform pg_temp.call('adm', format('select public.inv_cost_void(%L, %L, %L)', pg_temp.g('A'), v_cost, 'Monto mal digitado'));
  v_msg := pg_temp.try('adm', format('select public.inv_cost_void(%L, %L, %L)', pg_temp.g('A'), v_cost, 'otra vez'));
  perform pg_temp.ok('No se anula dos veces', v_msg = 'inv:already_voided', v_msg);
  o := pg_temp.call('adm', format('select public.inv_costs_overview(%L, %L)', pg_temp.g('A'), pg_temp.g('inv_tienda')));
  perform pg_temp.ok('Al anular vuelve el costo anterior', (o->1->>'unit_total')::numeric = 500 and o->1->>'prev_unit_total' is null, (o->1)::text);
  perform pg_temp.call('adm', format($q$select public.inv_cost_register(%L, %L, %L::jsonb, %L::jsonb)$q$, pg_temp.g('A'), pg_temp.g('inv_tienda'),
    '{"supplier":"Embotelladora Andina","document_no":"97900002","bought_on":"2026-10-16"}',
    json_build_array(json_build_object('product_id', pg_temp.g('p2'), 'qty', 10, 'net', 6400))::text));
  o := pg_temp.call('adm', format('select public.inv_costs_overview(%L, %L)', pg_temp.g('A'), pg_temp.g('inv_tienda')));
  perform pg_temp.ok('Tras anular se puede cargar de nuevo la misma factura', (o->1->>'unit_total')::numeric = 640, (o->1)::text);

  -- Auditoría
  v_n := pg_temp.call('adm', $q$select to_jsonb(count(*)) from public.inv_audit where action = 'cost.register'$q$);
  perform pg_temp.ok('Cada carga queda en la auditoría', (v_n#>>'{}')::int = 3, v_n::text);
  v_n := pg_temp.call('adm', $q$select to_jsonb(count(*)) from public.inv_audit where action = 'cost.void'$q$);
  perform pg_temp.ok('Cada anulación queda en la auditoría', (v_n#>>'{}')::int = 1, v_n::text);
end $$;

do $$ begin raise notice 'COSTOS: TODAS LAS PRUEBAS PASARON'; end $$;
rollback;
