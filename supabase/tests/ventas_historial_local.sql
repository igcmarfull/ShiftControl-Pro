-- Pruebas de las migraciones 20261017120000_sales_history.sql y 20261017180000_sales_history_skip_coffee.sql (historial de ventas).
--
-- SOLO PARA UNA BASE LOCAL DESECHABLE con todas las migraciones aplicadas (incluidas inventario y proveedores).
-- Crea empresas, usuarios y datos ficticios dentro de una transacción que
-- termina en ROLLBACK. No ejecutar contra producción.
--
-- Uso:
--   psql -d <base_local> -v ON_ERROR_STOP=1 -f supabase/tests/ventas_historial_local.sql
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

do $$
declare r jsonb; i jsonb; p jsonb;
begin
  r := pg_temp.call('adm', format('select public.inv_setup(%L)', pg_temp.g('A')));
  for i in select * from jsonb_array_elements(r->'inventories') loop perform pg_temp.put('inv_' || (i->>'code'), i->>'id'); end loop;
  p := pg_temp.call('adm', format('select public.inv_save_product(%L, %L::jsonb)', pg_temp.g('inv_lubricantes'), '{"code":"L1","name":"Aceite","control_unit":"unidad"}'));
  p := pg_temp.call('adm', format('select public.inv_save_product(%L, %L::jsonb)', pg_temp.g('inv_tienda'), '{"code":"T1","name":"Red Bull","control_unit":"unidad"}'));
end $$;

do $$
declare r jsonb; v_msg text; v_n jsonb; v_lines text;
begin
  v_lines := format('[{"date":"%s","code":"L1","qty":2,"amount":12180},{"date":"%s","code":"L1","qty":1,"amount":6090},{"date":"%s","code":"L1","qty":3,"amount":18270},{"date":"%s","code":"T1","qty":4,"amount":8000},{"date":"%s","code":"ZZZ","qty":1,"amount":100}]',
    current_date - 2, current_date - 2, current_date - 1, current_date - 1, current_date - 1);
  r := pg_temp.call('adm', format('select public.sales_history_save(%L, %L::jsonb)', pg_temp.g('A'), v_lines));
  perform pg_temp.ok('El admin guarda las ventas (suma líneas repetidas)', (r->>'saved')::int = 3 and (r->>'no_product')::int = 1, r::text);
  v_n := pg_temp.call('adm', format($q$select to_jsonb(sum(qty)) from public.sales_history where pos_code = 'L1' and company_id = %L$q$, pg_temp.g('A')));
  perform pg_temp.ok('Las líneas del mismo día se suman', (v_n#>>'{}')::int = 6, v_n::text);
  v_n := pg_temp.call('adm', format($q$select to_jsonb(amount) from public.sales_history where pos_code = 'L1' and sold_on = current_date - 2 and company_id = %L$q$, pg_temp.g('A')));
  perform pg_temp.ok('Guarda el monto', (v_n#>>'{}')::int = 18270, v_n::text);
  r := pg_temp.call('adm', format('select public.sales_history_save(%L, %L::jsonb)', pg_temp.g('A'), v_lines));
  perform pg_temp.ok('Repetir el archivo no duplica', (r->>'saved')::int = 0 and (r->>'unchanged')::int = 3, r::text);
  r := pg_temp.call('adm', format('select public.sales_history_save(%L, %L::jsonb)', pg_temp.g('A'), format('[{"date":"%s","code":"L1","qty":5,"amount":30000}]', current_date - 1)));
  perform pg_temp.ok('Una cantidad distinta actualiza la fila', (r->>'updated')::int = 1, r::text);
  v_n := pg_temp.call('adm', format($q$select to_jsonb(qty) from public.sales_history where pos_code = 'L1' and sold_on = current_date - 1 and company_id = %L$q$, pg_temp.g('A')));
  perform pg_temp.ok('La fila quedó actualizada', (v_n#>>'{}')::int = 5, v_n::text);

  v_msg := pg_temp.try('adm', format('select public.sales_history_save(%L, %L::jsonb)', pg_temp.g('A'), format('[{"date":"%s","code":"L1","qty":1,"amount":1}]', current_date + 1)));
  perform pg_temp.ok('Una fecha futura se rechaza', v_msg = 'inv:invalid_date', v_msg);
  v_msg := pg_temp.try('adm', format('select public.sales_history_save(%L, %L::jsonb)', pg_temp.g('A'), '[{"date":"2026-01-01","code":"L1","qty":0,"amount":1}]'));
  perform pg_temp.ok('Una cantidad cero se rechaza', v_msg = 'inv:invalid_line', v_msg);
  v_msg := pg_temp.try('adm', format('select public.sales_history_save(%L, %L::jsonb)', pg_temp.g('A'), '[]'));
  perform pg_temp.ok('Sin líneas se rechaza', v_msg = 'inv:lines_required', v_msg);

  -- Café: un código de máquina no entra al historial.
  perform pg_temp.call('adm', format('select public.coffee_machine_save(%L, %L::jsonb)', pg_temp.g('A'), '{"name":"Marley","codes":[{"code":"CF1"}]}'));
  perform pg_temp.call('adm', format('select public.inv_save_product(%L, %L::jsonb)', pg_temp.g('inv_tienda'), '{"code":"CF1","name":"Café","control_unit":"unidad"}'));
  r := pg_temp.call('adm', format('select public.sales_history_save(%L, %L::jsonb)', pg_temp.g('A'), format('[{"date":"%s","code":"CF1","qty":9,"amount":9000},{"date":"%s","code":"T1","qty":4,"amount":8000}]', current_date - 4, current_date - 4)));
  perform pg_temp.ok('El café no entra al historial', (r->>'coffee')::int = 1 and (r->>'saved')::int = 1, r::text);
  v_n := pg_temp.call('adm', format($q$select to_jsonb(count(*)) from public.sales_history where pos_code = 'CF1' and company_id = %L$q$, pg_temp.g('A')));
  perform pg_temp.ok('No hay filas de café', (v_n#>>'{}')::int = 0, v_n::text);

  -- Acceso por área: jefa de tienda solo a TIENDA; lubricantes es ISLA.
  r := pg_temp.call('jt', format('select public.sales_history_save(%L, %L::jsonb)', pg_temp.g('A'), format('[{"date":"%s","code":"L1","qty":1,"amount":1},{"date":"%s","code":"T1","qty":1,"amount":2000}]', current_date - 3, current_date - 3)));
  perform pg_temp.ok('La jefa de tienda solo guarda su área', (r->>'saved')::int = 1 and (r->>'no_access')::int = 1, r::text);
  v_msg := pg_temp.try('off', format('select public.sales_history_save(%L, %L::jsonb)', pg_temp.g('A'), '[{"date":"2026-01-01","code":"T1","qty":1,"amount":1}]'));
  perform pg_temp.ok('Una jefa inactiva no guarda', v_msg <> 'OK', v_msg);
  v_msg := pg_temp.try('admB', format('select public.sales_history_save(%L, %L::jsonb)', pg_temp.g('A'), '[{"date":"2026-01-01","code":"T1","qty":1,"amount":1}]'));
  perform pg_temp.ok('Otra empresa no guarda aquí', v_msg <> 'OK', v_msg);

  -- Lectura
  v_n := pg_temp.call('adm', format($q$select to_jsonb(count(*)) from public.sales_history where company_id = %L$q$, pg_temp.g('A')));
  perform pg_temp.ok('El admin lee todo', (v_n#>>'{}')::int = 5, v_n::text);
  v_n := pg_temp.call('jt', format($q$select to_jsonb(count(*)) from public.sales_history where company_id = %L$q$, pg_temp.g('A')));
  perform pg_temp.ok('La jefa de tienda solo lee su área', (v_n#>>'{}')::int = 3, v_n::text);
  v_n := pg_temp.call('ji', format($q$select to_jsonb(count(*)) from public.sales_history where company_id = %L$q$, pg_temp.g('A')));
  perform pg_temp.ok('La jefa de isla lee solo lubricantes', (v_n#>>'{}')::int = 2, v_n::text);
  v_n := pg_temp.call('ji', format($q$select to_jsonb(count(*)) from public.sales_history where company_id = %L and pos_code = 'T1'$q$, pg_temp.g('A')));
  perform pg_temp.ok('La jefa de isla no ve la tienda', (v_n#>>'{}')::int = 0, v_n::text);
  v_n := pg_temp.call('admB', $q$select to_jsonb(count(*)) from public.sales_history$q$);
  perform pg_temp.ok('Otra empresa no lee', (v_n#>>'{}')::int = 0, v_n::text);
  v_msg := pg_temp.try('adm', format($q$insert into public.sales_history (company_id, inventory_id, sold_on, pos_code, qty) values (%L, %L, current_date, 'X', 1)$q$, pg_temp.g('A'), pg_temp.g('inv_lubricantes')));
  perform pg_temp.ok('No se escribe directo en la tabla', v_msg ilike '%permission denied%', v_msg);
end $$;

do $$ begin raise notice 'HISTORIAL DE VENTAS: TODAS LAS PRUEBAS PASARON'; end $$;
rollback;
