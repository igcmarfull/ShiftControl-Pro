-- Pruebas de la migración 20261015164843_inventory_product_photos.sql
-- (foto opcional por producto: columna, función, lectura y políticas de Storage).
--
-- SOLO PARA UNA BASE LOCAL DESECHABLE con todas las migraciones aplicadas.
-- Crea empresas, usuarios y datos ficticios dentro de una transacción que
-- termina en ROLLBACK. No ejecutar contra producción.
--
-- Uso:
--   psql -d <base_local> -v ON_ERROR_STOP=1 -f supabase/tests/inventario_fotos_local.sql
--
-- Cada comprobación imprime "PASS ..."; la primera que falle detiene el script
-- con "FAIL ...". Al final imprime "FOTOS: TODAS LAS PRUEBAS PASARON".

begin;

create temp table ctx (k text primary key, v text);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000a0001', 'admin-a@example.invalid'),
  ('00000000-0000-0000-0000-0000000a0002', 'jefa-tienda@example.invalid'),
  ('00000000-0000-0000-0000-0000000a0003', 'jefa-isla@example.invalid'),
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
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000b0001', 'ADMIN', null, true);
insert into ctx values
  ('A', '00000000-0000-0000-0000-00000000000a'), ('B', '00000000-0000-0000-0000-00000000000b'),
  ('adm', '00000000-0000-0000-0000-0000000a0001'), ('jt', '00000000-0000-0000-0000-0000000a0002'),
  ('ji', '00000000-0000-0000-0000-0000000a0003'), ('admB', '00000000-0000-0000-0000-0000000b0001');

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
-- Preparación: inventarios activos y un producto en Cigarrillos (área TIENDA)
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
  p := pg_temp.call('adm', format('select public.inv_save_product(%L, %L::jsonb)', pg_temp.g('inv_cigarrillos'),
        '{"code":"CIG-1","name":"Kent 1","control_unit":"cajetilla"}'));
  perform pg_temp.put('p1', p->>'id');
  p := pg_temp.call('adm', format('select public.inv_save_product(%L, %L::jsonb)', pg_temp.g('inv_cigarrillos'),
        '{"code":"CIG-2","name":"Lucky 10","control_unit":"cajetilla"}'));
  perform pg_temp.put('p2', p->>'id');
  perform pg_temp.ok('Producto nuevo nace sin foto', (p->>'image_path') is null, p::text);
end $$;

-- ---------------------------------------------------------------------------
-- 1. inv_set_product_image
-- ---------------------------------------------------------------------------
do $$
declare r jsonb; v_msg text; v_path text; v_other text; l jsonb;
begin
  v_path := pg_temp.g('A') || '/' || pg_temp.g('inv_cigarrillos') || '/' || pg_temp.g('p1') || '/foto-1.webp';
  v_other := pg_temp.g('A') || '/' || pg_temp.g('inv_cigarrillos') || '/' || pg_temp.g('p2') || '/foto-1.webp';

  v_msg := pg_temp.try('jt', format('select public.inv_set_product_image(%L, %L, 1)', pg_temp.g('p1'), v_path));
  perform pg_temp.ok('La jefa no puede poner foto', v_msg = 'inv:forbidden', v_msg);

  v_msg := pg_temp.try('admB', format('select public.inv_set_product_image(%L, %L, 1)', pg_temp.g('p1'), v_path));
  perform pg_temp.ok('Un admin de otra empresa no puede poner foto', v_msg in ('inv:forbidden', 'inv:not_found'), v_msg);

  v_msg := pg_temp.try('adm', format('select public.inv_set_product_image(%L, %L, 1)', pg_temp.g('p1'), v_other));
  perform pg_temp.ok('Una ruta de otro producto se rechaza', v_msg = 'inv:invalid_image', v_msg);

  v_msg := pg_temp.try('adm', format('select public.inv_set_product_image(%L, %L, 99)', pg_temp.g('p1'), v_path));
  perform pg_temp.ok('Versión vieja: conflicto', v_msg = 'inv:version_conflict', v_msg);

  r := pg_temp.call('adm', format('select public.inv_set_product_image(%L, %L, 1)', pg_temp.g('p1'), v_path));
  perform pg_temp.ok('El admin guarda la foto y sube la versión', r->>'image_path' = v_path and (r->>'version')::int = 2, r::text);

  l := pg_temp.call('adm', format('select public.inv_list_products(%L)', pg_temp.g('inv_cigarrillos')));
  perform pg_temp.ok('inv_list_products devuelve image_path',
    exists (select 1 from jsonb_array_elements(l) e where e->>'id' = pg_temp.g('p1') and e->>'image_path' = v_path)
    and exists (select 1 from jsonb_array_elements(l) e where e->>'id' = pg_temp.g('p2') and e->'image_path' = 'null'::jsonb), l::text);

  l := pg_temp.call('jt', format('select public.inv_list_products(%L)', pg_temp.g('inv_cigarrillos')));
  perform pg_temp.ok('La jefa del área ve la ruta', exists (select 1 from jsonb_array_elements(l) e where e->>'image_path' = v_path), l::text);

  v_msg := pg_temp.try('adm', format('select public.inv_save_product(%L, %L::jsonb)', pg_temp.g('inv_cigarrillos'),
    format('{"id":"%s","expected_version":2,"name":"Kent 1 editado"}', pg_temp.g('p1'))));
  perform pg_temp.ok('Editar el producto no borra la foto',
    (select image_path from public.inv_products where id = pg_temp.g('p1')::uuid) = v_path, v_msg);

  v_msg := pg_temp.try('adm', format('select public.inv_set_product_image(%L, %L, 3)', pg_temp.g('p1'), null::text));
  perform pg_temp.ok('Quitar la foto funciona', v_msg = 'OK'
    and (select image_path from public.inv_products where id = pg_temp.g('p1')::uuid) is null, v_msg);
  perform pg_temp.ok('Queda en la auditoría',
    (select count(*) from public.inv_audit where action = 'product.image') = 2);

  v_msg := (select pg_temp.try('adm', 'select 1'));
  begin
    update public.inv_products set image_path = 'cualquier/cosa' where id = pg_temp.g('p1')::uuid;
    perform pg_temp.ok('La restricción rechaza rutas ajenas', false, 'no falló');
  exception when check_violation then
    perform pg_temp.ok('La restricción rechaza rutas ajenas', true);
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Storage: bucket y políticas
-- ---------------------------------------------------------------------------
do $$
declare v_msg text; v_n jsonb; v_path text; v_pathB text;
begin
  perform pg_temp.ok('El bucket es privado y limitado',
    (select not public and file_size_limit = 307200 and allowed_mime_types @> array['image/webp']
       from storage.buckets where id = 'shiftcontrol-product-photos'));

  v_path := pg_temp.g('A') || '/' || pg_temp.g('inv_cigarrillos') || '/' || pg_temp.g('p1') || '/f.webp';

  v_msg := pg_temp.try('jt', format($f$insert into storage.objects (bucket_id, name) values ('shiftcontrol-product-photos', %L)$f$, v_path));
  perform pg_temp.ok('La jefa no puede subir', v_msg ilike '%row-level security%', v_msg);

  v_msg := pg_temp.try('admB', format($f$insert into storage.objects (bucket_id, name) values ('shiftcontrol-product-photos', %L)$f$, v_path));
  perform pg_temp.ok('Un admin de otra empresa no puede subir', v_msg ilike '%row-level security%', v_msg);

  v_msg := pg_temp.try('adm', format($f$insert into storage.objects (bucket_id, name) values ('shiftcontrol-product-photos', %L)$f$,
    pg_temp.g('A') || '/not-a-uuid/' || pg_temp.g('p1') || '/f.webp'));
  perform pg_temp.ok('Ruta con carpeta no válida se rechaza', v_msg ilike '%row-level security%', v_msg);

  v_msg := pg_temp.try('adm', format($f$insert into storage.objects (bucket_id, name) values ('shiftcontrol-product-photos', %L)$f$,
    pg_temp.g('A') || '/' || pg_temp.g('inv_cigarrillos') || '/' || gen_random_uuid() || '/f.webp'));
  perform pg_temp.ok('Producto inexistente se rechaza', v_msg ilike '%row-level security%', v_msg);

  v_msg := pg_temp.try('adm', format($f$insert into storage.objects (bucket_id, name) values ('shiftcontrol-product-photos', %L)$f$,
    pg_temp.g('A') || '/' || pg_temp.g('invB_cigarrillos') || '/' || pg_temp.g('p1') || '/f.webp'));
  perform pg_temp.ok('Inventario de otra empresa se rechaza', v_msg ilike '%row-level security%', v_msg);

  v_msg := pg_temp.try('adm', format($f$insert into storage.objects (bucket_id, name) values ('shiftcontrol-product-photos', %L)$f$, v_path));
  perform pg_temp.ok('El admin sube la foto', v_msg = 'OK', v_msg);

  v_n := pg_temp.call('adm', $q$select to_jsonb(count(*)) from storage.objects where bucket_id = 'shiftcontrol-product-photos'$q$);
  perform pg_temp.ok('El admin la ve', (v_n#>>'{}')::int = 1, v_n::text);
  v_n := pg_temp.call('jt', $q$select to_jsonb(count(*)) from storage.objects where bucket_id = 'shiftcontrol-product-photos'$q$);
  perform pg_temp.ok('La jefa del área (Tienda) la ve', (v_n#>>'{}')::int = 1, v_n::text);
  v_n := pg_temp.call('ji', $q$select to_jsonb(count(*)) from storage.objects where bucket_id = 'shiftcontrol-product-photos'$q$);
  perform pg_temp.ok('La jefa de otra área (Isla) no la ve', (v_n#>>'{}')::int = 0, v_n::text);
  v_n := pg_temp.call('admB', $q$select to_jsonb(count(*)) from storage.objects where bucket_id = 'shiftcontrol-product-photos'$q$);
  perform pg_temp.ok('Un admin de otra empresa no la ve', (v_n#>>'{}')::int = 0, v_n::text);

  v_msg := pg_temp.try('jt', format($f$update storage.objects set name = name where name = %L$f$, v_path));
  v_n := pg_temp.call('jt', format($q$with d as (delete from storage.objects where name = %L returning 1) select to_jsonb(count(*)) from d$q$, v_path));
  perform pg_temp.ok('La jefa no puede borrar', (v_n#>>'{}')::int = 0, v_n::text);
  v_n := pg_temp.call('adm', format($q$with d as (delete from storage.objects where name = %L returning 1) select to_jsonb(count(*)) from d$q$, v_path));
  perform pg_temp.ok('El admin puede borrar', (v_n#>>'{}')::int = 1, v_n::text);
end $$;

do $$ begin raise notice 'FOTOS: TODAS LAS PRUEBAS PASARON'; end $$;
rollback;
