-- Pruebas de la migración 20261015210000_supplier_product_codes.sql (códigos de proveedor → producto).
--
-- SOLO PARA UNA BASE LOCAL DESECHABLE con todas las migraciones aplicadas (incluidas inventario y proveedores).
-- Crea empresas, usuarios y datos ficticios dentro de una transacción que
-- termina en ROLLBACK. No ejecutar contra producción.
--
-- Uso:
--   psql -d <base_local> -v ON_ERROR_STOP=1 -f supabase/tests/proveedores_codigos_local.sql
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
-- Preparación: inventarios, productos y proveedores
-- ---------------------------------------------------------------------------
do $$
declare r jsonb; i jsonb; p jsonb; s jsonb;
begin
  r := pg_temp.call('adm', format('select public.inv_setup(%L)', pg_temp.g('A')));
  for i in select * from jsonb_array_elements(r->'inventories') loop
    perform pg_temp.put('inv_' || (i->>'code'), i->>'id');
  end loop;
  r := pg_temp.call('admB', format('select public.inv_setup(%L)', pg_temp.g('B')));
  for i in select * from jsonb_array_elements(r->'inventories') loop
    perform pg_temp.put('invB_' || (i->>'code'), i->>'id');
  end loop;
  p := pg_temp.call('adm', format('select public.inv_save_product(%L, %L::jsonb)', pg_temp.g('inv_cigarrillos'),
        '{"code":"CIG-1","name":"Kent 1","control_unit":"cajetilla","receive_unit":"cartón","receive_factor":10}'));
  perform pg_temp.put('pc1', p->>'id');
  p := pg_temp.call('adm', format('select public.inv_save_product(%L, %L::jsonb)', pg_temp.g('inv_cigarrillos'),
        '{"code":"CIG-2","name":"Lucky 2","control_unit":"cajetilla","receive_unit":"cartón","receive_factor":10}'));
  perform pg_temp.put('pc2', p->>'id');
  p := pg_temp.call('adm', format('select public.inv_save_product(%L, %L::jsonb)', pg_temp.g('inv_lubricantes'),
        '{"code":"LUB-1","name":"Aceite","control_unit":"unidad"}'));
  perform pg_temp.put('pl1', p->>'id');
  p := pg_temp.call('admB', format('select public.inv_save_product(%L, %L::jsonb)', pg_temp.g('invB_cigarrillos'),
        '{"code":"CIG-1","name":"Otra empresa","control_unit":"cajetilla"}'));
  perform pg_temp.put('pb1', p->>'id');
  s := pg_temp.call('adm', format('select public.supplier_save(%L, %L::jsonb)', pg_temp.g('A'), '{"name":"BAT Chile","rut":"88.502.900-0"}'));
  perform pg_temp.put('s1', s->>'id');
  s := pg_temp.call('adm', format('select public.supplier_save(%L, %L::jsonb)', pg_temp.g('A'), '{"name":"Otro proveedor"}'));
  perform pg_temp.put('s2', s->>'id');
end $$;

do $$
declare r jsonb; v_msg text; v_n jsonb;
begin
  -- 1. Guardar
  r := pg_temp.call('jt', format('select public.supplier_codes_save(%L, %L, %L::jsonb)', pg_temp.g('A'), pg_temp.g('s1'),
        json_build_array(json_build_object('code','10221633','product_id',pg_temp.g('pc1')))::text));
  perform pg_temp.ok('La jefa de tienda guarda un código de cigarros', (r->>'saved')::int = 1, r::text);
  r := pg_temp.call('adm', format('select public.supplier_codes_save(%L, %L, %L::jsonb)', pg_temp.g('A'), pg_temp.g('s1'),
        json_build_array(json_build_object('code','10242375','product_id',pg_temp.g('pc2')),
                         json_build_object('code','10221633','product_id',pg_temp.g('pc2')))::text));
  perform pg_temp.ok('El admin guarda y corrige (upsert)', (r->>'saved')::int = 2, r::text);
  v_n := pg_temp.call('adm', format($q$select to_jsonb(count(*)) from public.supplier_product_codes where supplier_id = %L$q$, pg_temp.g('s1')));
  perform pg_temp.ok('El upsert no duplica filas', (v_n#>>'{}')::int = 2, v_n::text);
  v_n := pg_temp.call('adm', format($q$select to_jsonb(product_id::text) from public.supplier_product_codes where supplier_id = %L and supplier_code = '10221633'$q$, pg_temp.g('s1')));
  perform pg_temp.ok('El código quedó corregido al producto nuevo', (v_n#>>'{}') = pg_temp.g('pc2'), v_n::text);

  -- 2. Permisos por área
  v_msg := pg_temp.try('jt', format('select public.supplier_codes_save(%L, %L, %L::jsonb)', pg_temp.g('A'), pg_temp.g('s1'),
        json_build_array(json_build_object('code','X1','product_id',pg_temp.g('pl1')))::text));
  perform pg_temp.ok('La jefa de tienda no asocia un producto de Isla', v_msg = 'sup:forbidden', v_msg);
  v_msg := pg_temp.try('ji', format('select public.supplier_codes_save(%L, %L, %L::jsonb)', pg_temp.g('A'), pg_temp.g('s1'),
        json_build_array(json_build_object('code','X2','product_id',pg_temp.g('pc1')))::text));
  perform pg_temp.ok('La jefa de isla no asocia cigarros', v_msg = 'sup:forbidden', v_msg);
  v_msg := pg_temp.try('off', format('select public.supplier_codes_save(%L, %L, %L::jsonb)', pg_temp.g('A'), pg_temp.g('s1'),
        json_build_array(json_build_object('code','X3','product_id',pg_temp.g('pc1')))::text));
  perform pg_temp.ok('Una jefa inactiva no puede', v_msg like '%forbidden', v_msg);

  -- 3. Aislamiento entre empresas y datos inválidos
  v_msg := pg_temp.try('admB', format('select public.supplier_codes_save(%L, %L, %L::jsonb)', pg_temp.g('B'), pg_temp.g('s1'),
        json_build_array(json_build_object('code','X4','product_id',pg_temp.g('pb1')))::text));
  perform pg_temp.ok('Otra empresa no usa un proveedor ajeno', v_msg = 'sup:not_found', v_msg);
  v_msg := pg_temp.try('adm', format('select public.supplier_codes_save(%L, %L, %L::jsonb)', pg_temp.g('A'), pg_temp.g('s1'),
        json_build_array(json_build_object('code','X5','product_id',pg_temp.g('pb1')))::text));
  perform pg_temp.ok('No se asocia un producto de otra empresa', v_msg = 'sup:invalid_product', v_msg);
  v_msg := pg_temp.try('adm', format('select public.supplier_codes_save(%L, %L, %L::jsonb)', pg_temp.g('A'), pg_temp.g('s1'),
        json_build_array(json_build_object('code','','product_id',pg_temp.g('pc1')))::text));
  perform pg_temp.ok('Código vacío se rechaza', v_msg = 'sup:invalid_items', v_msg);
  v_msg := pg_temp.try('adm', format('select public.supplier_codes_save(%L, %L, %L::jsonb)', pg_temp.g('A'), pg_temp.g('s1'), '{"a":1}'));
  perform pg_temp.ok('La lista debe ser un arreglo', v_msg = 'sup:invalid_items', v_msg);

  -- 4. Lectura y escritura directa
  v_n := pg_temp.call('jt', $q$select to_jsonb(count(*)) from public.supplier_product_codes$q$);
  perform pg_temp.ok('Una jefa activa lee los códigos', (v_n#>>'{}')::int = 2, v_n::text);
  v_n := pg_temp.call('off', $q$select to_jsonb(count(*)) from public.supplier_product_codes$q$);
  perform pg_temp.ok('Una jefa inactiva no los ve', (v_n#>>'{}')::int = 0, v_n::text);
  v_n := pg_temp.call('admB', $q$select to_jsonb(count(*)) from public.supplier_product_codes$q$);
  perform pg_temp.ok('Otra empresa no los ve', (v_n#>>'{}')::int = 0, v_n::text);
  v_msg := pg_temp.try('adm', format($q$insert into public.supplier_product_codes (company_id, supplier_id, supplier_code, product_id) values (%L, %L, 'Z', %L)$q$, pg_temp.g('A'), pg_temp.g('s1'), pg_temp.g('pc1')));
  perform pg_temp.ok('Nadie escribe directo en la tabla', v_msg ilike '%permission denied%', v_msg);
  v_msg := pg_temp.try('adm', format('select public.supplier_codes_save(%L, %L, %L::jsonb)', pg_temp.g('A'), pg_temp.g('s2'),
        json_build_array(json_build_object('code','10221633','product_id',pg_temp.g('pc1')))::text));
  perform pg_temp.ok('El mismo código sirve en otro proveedor', v_msg = 'OK', v_msg);

  -- 5. Borrado en cascada con el producto y con el proveedor
  delete from public.supplier_product_codes where supplier_id = pg_temp.g('s2')::uuid;
  delete from public.suppliers where id = pg_temp.g('s1')::uuid;
  perform pg_temp.ok('Al borrar el proveedor se borran sus códigos',
    (select count(*) from public.supplier_product_codes) = 0);
end $$;

do $$ begin raise notice 'CÓDIGOS DE PROVEEDOR: TODAS LAS PRUEBAS PASARON'; end $$;
rollback;
