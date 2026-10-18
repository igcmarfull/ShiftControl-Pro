-- Pruebas de la migración 20261016120000_inventory_sales_import.sql (ventas del POS que descuentan stock).
--
-- SOLO PARA UNA BASE LOCAL DESECHABLE con todas las migraciones aplicadas (incluidas inventario y proveedores).
-- Crea empresas, usuarios y datos ficticios dentro de una transacción que
-- termina en ROLLBACK. No ejecutar contra producción.
--
-- Uso:
--   psql -d <base_local> -v ON_ERROR_STOP=1 -f supabase/tests/inventario_ventas_local.sql
--
-- Cada comprobación imprime "PASS ..."; la primera que falle detiene el script
-- con "FAIL ...". Al final imprime " LAS PRUEBAS PASARON".

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

-- ---------------------------------------------------------------------------
-- Preparación
-- ---------------------------------------------------------------------------
do $$
declare r jsonb; i jsonb; p jsonb;
begin
  r := pg_temp.call('adm', format('select public.inv_setup(%L)', pg_temp.g('A')));
  for i in select * from jsonb_array_elements(r->'inventories') loop
    perform pg_temp.put('inv_' || (i->>'code'), i->>'id');
  end loop;
  r := pg_temp.call('admB', format('select public.inv_setup(%L)', pg_temp.g('B')));
  for i in select * from jsonb_array_elements(r->'inventories') loop
    perform pg_temp.put('invB_' || (i->>'code'), i->>'id');
  end loop;
  p := pg_temp.call('adm', format('select public.inv_save_product(%L, %L::jsonb)', pg_temp.g('inv_tienda'), '{"code":"T1","name":"Red Bull","control_unit":"unidad"}'));
  perform pg_temp.put('pt', p->>'id');
  p := pg_temp.call('adm', format('select public.inv_save_product(%L, %L::jsonb)', pg_temp.g('inv_cigarrillos'), '{"code":"C1","name":"Kent","control_unit":"cajetilla"}'));
  perform pg_temp.put('pc', p->>'id');
  p := pg_temp.call('adm', format('select public.inv_save_product(%L, %L::jsonb)', pg_temp.g('inv_lubricantes'), '{"code":"L1","name":"Aceite","control_unit":"unidad"}'));
  perform pg_temp.put('pl', p->>'id');
  -- T1 con stock por recepción (sin saldo inicial); C1 con saldo inicial hoy; L1 con recepción.
  perform pg_temp.call('adm', format('select public.inv_receive(%L, %L, %L::jsonb, %L::jsonb)', gen_random_uuid(), pg_temp.g('inv_tienda'),
    '{"supplier":"P","document_no":"F1"}', json_build_array(json_build_object('product_id', pg_temp.g('pt'), 'qty', 10))::text));
  perform pg_temp.call('adm', format('select public.inv_register_opening(%L, %L, %L::jsonb)', gen_random_uuid(), pg_temp.g('inv_cigarrillos'),
    json_build_array(json_build_object('product_id', pg_temp.g('pc'), 'qty', 20))::text));
  perform pg_temp.call('adm', format('select public.inv_receive(%L, %L, %L::jsonb, %L::jsonb)', gen_random_uuid(), pg_temp.g('inv_lubricantes'),
    '{"supplier":"P","document_no":"F2"}', json_build_array(json_build_object('product_id', pg_temp.g('pl'), 'qty', 5))::text));
end $$;

create function pg_temp.stock(p_code text) returns integer language sql as $$
  select coalesce(sum(s.qty), 0)::integer from public.inv_stock s join public.inv_products p on p.id = s.product_id
  where p.code = p_code and p.company_id = pg_temp.g('A')::uuid $$;
create function pg_temp.d(p_back integer) returns text language sql as $$
  select to_char((now() at time zone 'America/Santiago')::date - p_back, 'YYYY-MM-DD') $$;
create function pg_temp.lines(variadic p_items text[]) returns text language plpgsql as $$
declare v jsonb := '[]'::jsonb; i integer := 1;
begin
  while i <= array_length(p_items, 1) loop
    v := v || jsonb_build_object('date', p_items[i], 'code', p_items[i+1], 'qty', p_items[i+2]::integer);
    i := i + 3;
  end loop;
  return v::text;
end $$;

do $$
declare r jsonb; v_msg text; v_n jsonb; v_req uuid := gen_random_uuid(); v_mov uuid;
begin
  -- 1. Aplicar
  r := pg_temp.call('adm', format('select public.inv_apply_sales(%L, %L, %L::jsonb)', v_req, pg_temp.g('A'),
    pg_temp.lines(pg_temp.d(1),'T1','4', pg_temp.d(2),'T1','3', pg_temp.d(1),'ZZ','9', pg_temp.d(1),'C1','2', pg_temp.d(1),'L1','1')));
  perform pg_temp.ok('Aplica las ventas con producto', (r->>'applied_lines')::int = 3 and (r->>'units_applied')::int = 8, r::text);
  perform pg_temp.ok('Cuenta el código sin producto', (r->>'no_product')::int = 1, r::text);
  perform pg_temp.ok('Ignora las ventas hasta el día del saldo inicial', (r->>'before_opening')::int = 1, r::text);
  perform pg_temp.ok('El stock de recepción bajó', pg_temp.stock('T1') = 3, pg_temp.stock('T1')::text);
  perform pg_temp.ok('El stock con saldo inicial no se tocó', pg_temp.stock('C1') = 20, pg_temp.stock('C1')::text);
  v_n := pg_temp.call('adm', $q$select to_jsonb(count(*)) from public.inv_movements where kind = 'sale'$q$);
  perform pg_temp.ok('Quedan movimientos de tipo venta', (v_n#>>'{}')::int >= 3, v_n::text);

  -- 2. Idempotencia y duplicados
  r := pg_temp.call('adm', format('select public.inv_apply_sales(%L, %L, %L::jsonb)', v_req, pg_temp.g('A'),
    pg_temp.lines(pg_temp.d(1),'T1','4')));
  perform pg_temp.ok('Repetir la misma solicitud devuelve el mismo resultado', (r->>'applied_lines')::int = 3, r::text);
  perform pg_temp.ok('...sin descontar otra vez', pg_temp.stock('T1') = 3, pg_temp.stock('T1')::text);
  r := pg_temp.call('adm', format('select public.inv_apply_sales(%L, %L, %L::jsonb)', gen_random_uuid(), pg_temp.g('A'),
    pg_temp.lines(pg_temp.d(1),'T1','4', pg_temp.d(2),'T1','3')));
  perform pg_temp.ok('Subir el mismo archivo de nuevo no descuenta', (r->>'already')::int = 2 and (r->>'applied_lines')::int = 0, r::text);
  perform pg_temp.ok('...y el stock sigue igual', pg_temp.stock('T1') = 3, pg_temp.stock('T1')::text);
  r := pg_temp.call('adm', format('select public.inv_apply_sales(%L, %L, %L::jsonb)', gen_random_uuid(), pg_temp.g('A'),
    pg_temp.lines(pg_temp.d(1),'T1','5')));
  perform pg_temp.ok('Una cantidad distinta para el mismo día se informa y no se aplica',
    jsonb_array_length(r->'changed') = 1 and (r->>'applied_lines')::int = 0 and pg_temp.stock('T1') = 3, r::text);
  r := pg_temp.call('adm', format('select public.inv_apply_sales(%L, %L, %L::jsonb)', gen_random_uuid(), pg_temp.g('A'),
    pg_temp.lines(pg_temp.d(1),'T1','2', pg_temp.d(1),'T1','2')));
  perform pg_temp.ok('Las líneas repetidas en el archivo se suman (2 + 2 = 4, igual a lo cargado)', jsonb_array_length(r->'changed') = 0 and (r->>'already')::int = 1, r::text);

  -- 3. Stock insuficiente: descuenta hasta cero y avisa
  r := pg_temp.call('adm', format('select public.inv_apply_sales(%L, %L, %L::jsonb)', gen_random_uuid(), pg_temp.g('A'),
    pg_temp.lines(pg_temp.d(3),'T1','10')));
  perform pg_temp.ok('Descuenta lo que hay y avisa la diferencia',
    (r->'shortfalls'->0->>'applied')::int = 3 and (r->'shortfalls'->0->>'sold')::int = 10, r::text);
  perform pg_temp.ok('El stock queda en cero, nunca negativo', pg_temp.stock('T1') = 0, pg_temp.stock('T1')::text);
  v_n := pg_temp.call('adm', format($q$select to_jsonb(qty_applied) from public.inv_sales_lines where pos_code = 'T1' and sold_on = %L$q$, pg_temp.d(3)::date));
  perform pg_temp.ok('La línea registra lo aplicado', (v_n#>>'{}')::int = 3, v_n::text);

  -- 4. Validaciones
  v_msg := pg_temp.try('adm', format('select public.inv_apply_sales(%L, %L, %L::jsonb)', gen_random_uuid(), pg_temp.g('A'), '[]'));
  perform pg_temp.ok('Sin líneas se rechaza', v_msg = 'inv:lines_required', v_msg);
  v_msg := pg_temp.try('adm', format('select public.inv_apply_sales(%L, %L, %L::jsonb)', gen_random_uuid(), pg_temp.g('A'),
    pg_temp.lines(pg_temp.d(-3),'T1','1')));
  perform pg_temp.ok('Una fecha futura se rechaza', v_msg = 'inv:invalid_date', v_msg);
  v_msg := pg_temp.try('adm', format('select public.inv_apply_sales(%L, %L, %L::jsonb)', gen_random_uuid(), pg_temp.g('A'),
    pg_temp.lines(pg_temp.d(1),'T1','0')));
  perform pg_temp.ok('Una cantidad cero se rechaza', v_msg = 'inv:invalid_line', v_msg);
  v_msg := pg_temp.try('adm', format('select public.inv_apply_sales(%L, %L, %L::jsonb)', gen_random_uuid(), pg_temp.g('A'), '{"a":1}'));
  perform pg_temp.ok('El formato incorrecto se rechaza', v_msg = 'inv:lines_required', v_msg);

  -- 5. Permisos por área
  r := pg_temp.call('jt', format('select public.inv_apply_sales(%L, %L, %L::jsonb)', gen_random_uuid(), pg_temp.g('A'),
    pg_temp.lines(pg_temp.d(4),'L1','1', pg_temp.d(4),'T1','1')));
  perform pg_temp.ok('La jefa de tienda no aplica ventas de Isla', (r->>'no_access')::int = 1, r::text);
  r := pg_temp.call('ji', format('select public.inv_apply_sales(%L, %L, %L::jsonb)', gen_random_uuid(), pg_temp.g('A'),
    pg_temp.lines(pg_temp.d(4),'L1','2')));
  perform pg_temp.ok('La jefa de isla aplica las de su área', (r->>'applied_lines')::int = 1 and pg_temp.stock('L1') = 2, r::text);
  v_msg := pg_temp.try('off', format('select public.inv_apply_sales(%L, %L, %L::jsonb)', gen_random_uuid(), pg_temp.g('A'), pg_temp.lines(pg_temp.d(5),'T1','1')));
  perform pg_temp.ok('Una jefa inactiva no puede', v_msg like '%forbidden', v_msg);
  r := pg_temp.call('admB', format('select public.inv_apply_sales(%L, %L, %L::jsonb)', gen_random_uuid(), pg_temp.g('B'), pg_temp.lines(pg_temp.d(1),'T1','1')));
  perform pg_temp.ok('Otra empresa no ve los productos de esta', (r->>'no_product')::int = 1, r::text);
  v_msg := pg_temp.try('admB', format('select public.inv_apply_sales(%L, %L, %L::jsonb)', gen_random_uuid(), pg_temp.g('A'), pg_temp.lines(pg_temp.d(1),'T1','1')));
  perform pg_temp.ok('Un admin de otra empresa no puede aplicar aquí', v_msg like '%forbidden', v_msg);

  -- 6. Lectura del registro y escritura directa
  v_n := pg_temp.call('jt', $q$select to_jsonb(count(*)) from public.inv_sales_lines$q$);
  perform pg_temp.ok('La jefa de tienda ve las ventas de su inventario', (v_n#>>'{}')::int >= 3, v_n::text);
  v_n := pg_temp.call('ji', $q$select to_jsonb(count(*)) from public.inv_sales_lines where inventory_id = $q$ || quote_literal(pg_temp.g('inv_tienda')) || '::uuid');
  perform pg_temp.ok('La jefa de isla no ve las de Tienda', (v_n#>>'{}')::int = 0, v_n::text);
  v_n := pg_temp.call('off', $q$select to_jsonb(count(*)) from public.inv_sales_lines$q$);
  perform pg_temp.ok('Una jefa inactiva no ve nada', (v_n#>>'{}')::int = 0, v_n::text);
  v_n := pg_temp.call('admB', $q$select to_jsonb(count(*)) from public.inv_sales_lines$q$);
  perform pg_temp.ok('Otra empresa no ve nada', (v_n#>>'{}')::int = 0, v_n::text);
  v_msg := pg_temp.try('adm', format($q$insert into public.inv_sales_lines (company_id, inventory_id, product_id, sold_on, pos_code, qty_reported, qty_applied, request_id) values (%L, %L, %L, current_date, 'X', 1, 1, gen_random_uuid())$q$, pg_temp.g('A'), pg_temp.g('inv_tienda'), pg_temp.g('pt')));
  perform pg_temp.ok('Nadie escribe directo en la tabla', v_msg ilike '%permission denied%', v_msg);

  -- 7. Corregir una venta devuelve el stock
  select id into v_mov from public.inv_movements where kind = 'sale' and product_id = pg_temp.g('pl')::uuid limit 1;
  r := pg_temp.call('adm', format('select public.inv_reverse_movement(%L, %L, %L)', gen_random_uuid(), v_mov, 'Prueba'));
  perform pg_temp.ok('Corregir una venta devuelve el stock', pg_temp.stock('L1') > 2, pg_temp.stock('L1')::text);
end $$;

-- 8. Saldo inicial con fecha: las ventas se descuentan desde el día siguiente
do $$
declare r jsonb; v_msg text; p jsonb; v_n jsonb;
begin
  p := pg_temp.call('adm', format('select public.inv_save_product(%L, %L::jsonb)', pg_temp.g('inv_cigarrillos'), '{"code":"C2","name":"Lucky","control_unit":"cajetilla"}'));
  perform pg_temp.put('pc2', p->>'id');
  v_msg := pg_temp.try('adm', format($q$select public.inv_register_opening(%L, %L, %L::jsonb, %L::date)$q$, gen_random_uuid(), pg_temp.g('inv_cigarrillos'),
    json_build_array(json_build_object('product_id', pg_temp.g('pc2'), 'qty', 10))::text, (current_date + 2)::text));
  perform pg_temp.ok('Rechaza un saldo inicial con fecha futura', v_msg ilike '%inv:%' or v_msg ilike '%fecha%', v_msg);
  v_msg := pg_temp.try('adm', format($q$select public.inv_register_opening(%L, %L, %L::jsonb, %L::date)$q$, gen_random_uuid(), pg_temp.g('inv_cigarrillos'),
    json_build_array(json_build_object('product_id', pg_temp.g('pc2'), 'qty', 10))::text, (current_date - 60)::text));
  perform pg_temp.ok('Rechaza un saldo inicial de hace más de 31 días', v_msg ilike '%inv:%' or v_msg ilike '%fecha%', v_msg);
  perform pg_temp.call('adm', format($q$select public.inv_register_opening(%L, %L, %L::jsonb, %L::date)$q$, gen_random_uuid(), pg_temp.g('inv_cigarrillos'),
    json_build_array(json_build_object('product_id', pg_temp.g('pc2'), 'qty', 10))::text, pg_temp.d(3)));
  perform pg_temp.ok('El saldo con fecha queda con esa fecha',
    (select (m.created_at at time zone 'America/Santiago')::date = pg_temp.d(3)::date from public.inv_movements m
     where m.product_id = pg_temp.g('pc2')::uuid and m.kind = 'opening'), 'fecha');
  perform pg_temp.ok('El stock es el del saldo', pg_temp.stock('C2') = 10, pg_temp.stock('C2')::text);
  r := pg_temp.call('adm', format('select public.inv_apply_sales(%L, %L, %L::jsonb)', gen_random_uuid(), pg_temp.g('A'),
    pg_temp.lines(pg_temp.d(3),'C2','4', pg_temp.d(2),'C2','2', pg_temp.d(1),'C2','1')));
  perform pg_temp.ok('Ignora el día del saldo y descuenta los siguientes',
    (r->>'before_opening')::int = 1 and (r->>'applied_lines')::int = 2 and (r->>'units_applied')::int = 3, r::text);
  perform pg_temp.ok('Quedan 7 en stock', pg_temp.stock('C2') = 7, pg_temp.stock('C2')::text);
end $$;

do $$ begin raise notice 'VENTAS DEL POS: TODAS LAS PRUEBAS PASARON'; end $$;
rollback;
