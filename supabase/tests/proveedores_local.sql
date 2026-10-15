-- Pruebas de la migración 20261015190000_suppliers.sql (proveedores de la empresa).
--
-- SOLO PARA UNA BASE LOCAL DESECHABLE con todas las migraciones aplicadas.
-- Crea empresas, usuarios y datos ficticios dentro de una transacción que
-- termina en ROLLBACK. No ejecutar contra producción.
--
-- Uso:
--   psql -d <base_local> -v ON_ERROR_STOP=1 -f supabase/tests/proveedores_local.sql
--
-- Cada comprobación imprime "PASS ..."; la primera que falle detiene el script
-- con "FAIL ...". Al final imprime "PROVEEDORES: TODAS LAS PRUEBAS PASARON".

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
-- 1. Crear y editar
-- ---------------------------------------------------------------------------
do $$
declare r jsonb; v_msg text;
begin
  r := pg_temp.call('adm', format($q$select public.supplier_save(%L, %L::jsonb)$q$, pg_temp.g('A'),
    '{"name":"Distribuidora Andes","rut":"76.482.115-3","category":"Bebidas","seller_name":"Marcela Rojas","phone":"+56 9 5123 4410","email":"ventas@andes.example","credit_days":30,"payment_method":"Transferencia"}'));
  perform pg_temp.put('s1', r->>'id');
  perform pg_temp.ok('El admin crea un proveedor', r->>'name' = 'Distribuidora Andes' and (r->>'credit_days')::int = 30 and (r->>'version')::int = 1, r::text);
  perform pg_temp.ok('El RUT se normaliza en rut_key', r->>'rut_key' = '764821153', r::text);

  r := pg_temp.call('jt', format($q$select public.supplier_save(%L, %L::jsonb)$q$, pg_temp.g('A'), '{"name":"Bebidas del Maipo","category":"Bebidas"}'));
  perform pg_temp.put('s2', r->>'id');
  perform pg_temp.ok('Una jefa activa puede crear un proveedor', r->>'name' = 'Bebidas del Maipo' and r->>'credit_days' is null, r::text);

  v_msg := pg_temp.try('jt', format($q$select public.supplier_save(%L, %L::jsonb)$q$, pg_temp.g('A'), format('{"id":"%s","expected_version":1,"notes":"x"}', pg_temp.g('s1'))));
  perform pg_temp.ok('Una jefa no puede editar', v_msg = 'sup:forbidden', v_msg);

  v_msg := pg_temp.try('off', format($q$select public.supplier_save(%L, %L::jsonb)$q$, pg_temp.g('A'), '{"name":"Intruso"}'));
  perform pg_temp.ok('Una jefa inactiva no puede crear', v_msg = 'sup:forbidden', v_msg);

  v_msg := pg_temp.try('admB', format($q$select public.supplier_save(%L, %L::jsonb)$q$, pg_temp.g('A'), '{"name":"Otra empresa"}'));
  perform pg_temp.ok('Un admin de otra empresa no puede crear en esta', v_msg = 'sup:forbidden', v_msg);

  v_msg := pg_temp.try('adm', format($q$select public.supplier_save(%L, %L::jsonb)$q$, pg_temp.g('A'), '{"name":"Otro","rut":"76482115-3"}'));
  perform pg_temp.ok('RUT repetido (con otro formato) se rechaza', v_msg = 'sup:duplicate_rut', v_msg);

  v_msg := pg_temp.try('adm', format($q$select public.supplier_save(%L, %L::jsonb)$q$, pg_temp.g('A'), '{"name":"  bebidas del maipo "}'));
  perform pg_temp.ok('Nombre repetido sin RUT se rechaza', v_msg = 'sup:duplicate_name', v_msg);

  v_msg := pg_temp.try('adm', format($q$select public.supplier_save(%L, %L::jsonb)$q$, pg_temp.g('A'), '{"name":"X","email":"no-es-correo"}'));
  perform pg_temp.ok('Correo inválido se rechaza', v_msg = 'sup:invalid_email', v_msg);
  v_msg := pg_temp.try('adm', format($q$select public.supplier_save(%L, %L::jsonb)$q$, pg_temp.g('A'), '{"name":"X","credit_days":400}'));
  perform pg_temp.ok('Crédito fuera de rango se rechaza', v_msg like 'sup:invalid_credit' or v_msg ilike '%check constraint%' or v_msg like '%credit%', v_msg);
  v_msg := pg_temp.try('adm', format($q$select public.supplier_save(%L, %L::jsonb)$q$, pg_temp.g('A'), '{"name":"   "}'));
  perform pg_temp.ok('Nombre vacío se rechaza', v_msg = 'sup:name_required', v_msg);

  r := pg_temp.call('adm', format($q$select public.supplier_save(%L, %L::jsonb)$q$, pg_temp.g('A'), format('{"id":"%s","expected_version":1,"notes":"Reparte martes y viernes","credit_days":45}', pg_temp.g('s1'))));
  perform pg_temp.ok('El admin edita y conserva los demás campos',
    r->>'notes' = 'Reparte martes y viernes' and (r->>'credit_days')::int = 45 and r->>'name' = 'Distribuidora Andes' and r->>'phone' = '+56 9 5123 4410' and (r->>'version')::int = 2, r::text);

  v_msg := pg_temp.try('adm', format($q$select public.supplier_save(%L, %L::jsonb)$q$, pg_temp.g('A'), format('{"id":"%s","expected_version":1,"notes":"viejo"}', pg_temp.g('s1'))));
  perform pg_temp.ok('Versión vieja: conflicto', v_msg = 'sup:version_conflict', v_msg);

  r := pg_temp.call('adm', format($q$select public.supplier_save(%L, %L::jsonb)$q$, pg_temp.g('A'), format('{"id":"%s","expected_version":2,"credit_days":null}', pg_temp.g('s1'))));
  perform pg_temp.ok('Crédito se puede dejar sin definir', r->>'credit_days' is null, r::text);
end $$;

-- ---------------------------------------------------------------------------
-- 2. Lectura (RLS) y escritura directa
-- ---------------------------------------------------------------------------
do $$
declare n jsonb; v_msg text;
begin
  n := pg_temp.call('adm', $q$select to_jsonb(count(*)) from public.suppliers$q$);
  perform pg_temp.ok('El admin ve los proveedores de su empresa', (n#>>'{}')::int = 2, n::text);
  n := pg_temp.call('ji', $q$select to_jsonb(count(*)) from public.suppliers$q$);
  perform pg_temp.ok('Una jefa activa los ve (para elegirlos en facturas)', (n#>>'{}')::int = 2, n::text);
  n := pg_temp.call('off', $q$select to_jsonb(count(*)) from public.suppliers$q$);
  perform pg_temp.ok('Una jefa inactiva no ve nada', (n#>>'{}')::int = 0, n::text);
  n := pg_temp.call('admB', $q$select to_jsonb(count(*)) from public.suppliers$q$);
  perform pg_temp.ok('Otra empresa no ve nada', (n#>>'{}')::int = 0, n::text);

  v_msg := pg_temp.try('adm', format($q$insert into public.suppliers (company_id, name) values (%L, 'Directo')$q$, pg_temp.g('A')));
  perform pg_temp.ok('Insertar directo en la tabla está bloqueado', v_msg ilike '%permission denied%', v_msg);
  v_msg := pg_temp.try('adm', $q$update public.suppliers set name = 'Hack'$q$);
  perform pg_temp.ok('Actualizar directo en la tabla está bloqueado', v_msg ilike '%permission denied%', v_msg);
end $$;

-- ---------------------------------------------------------------------------
-- 3. Activar, logo e importar
-- ---------------------------------------------------------------------------
do $$
declare r jsonb; v_msg text; v_path text; v_ver int;
begin
  select version into v_ver from public.suppliers where id = pg_temp.g('s1')::uuid;
  v_path := pg_temp.g('A') || '/' || pg_temp.g('s1') || '/logo.webp';
  v_msg := pg_temp.try('jt', format($q$select public.supplier_set_logo(%L, %L, %s)$q$, pg_temp.g('s1'), v_path, v_ver));
  perform pg_temp.ok('Una jefa no puede poner logo', v_msg = 'sup:forbidden', v_msg);
  v_msg := pg_temp.try('adm', format($q$select public.supplier_set_logo(%L, %L, %s)$q$, pg_temp.g('s1'), pg_temp.g('A') || '/' || pg_temp.g('s2') || '/logo.webp', v_ver));
  perform pg_temp.ok('La ruta de otro proveedor se rechaza', v_msg = 'sup:invalid_logo', v_msg);
  r := pg_temp.call('adm', format($q$select public.supplier_set_logo(%L, %L, %s)$q$, pg_temp.g('s1'), v_path, v_ver));
  perform pg_temp.ok('El admin guarda el logo', r->>'logo_path' = v_path and (r->>'version')::int = v_ver + 1, r::text);
  r := pg_temp.call('adm', format($q$select public.supplier_set_logo(%L, null, %s)$q$, pg_temp.g('s1'), v_ver + 1));
  perform pg_temp.ok('El admin quita el logo', r->>'logo_path' is null, r::text);

  r := pg_temp.call('adm', format($q$select public.supplier_set_active(%L, false, %s)$q$, pg_temp.g('s2'), (select version from public.suppliers where id = pg_temp.g('s2')::uuid)));
  perform pg_temp.ok('El admin desactiva un proveedor', (r->>'active')::boolean = false, r::text);
  v_msg := pg_temp.try('jt', format($q$select public.supplier_set_active(%L, true, %s)$q$, pg_temp.g('s2'), (select version from public.suppliers where id = pg_temp.g('s2')::uuid)));
  perform pg_temp.ok('Una jefa no puede reactivar', v_msg = 'sup:forbidden', v_msg);

  v_msg := pg_temp.try('jt', format($q$select public.supplier_import(%L, '[{"name":"Nuevo"}]'::jsonb)$q$, pg_temp.g('A')));
  perform pg_temp.ok('Una jefa no puede importar', v_msg = 'sup:forbidden', v_msg);
  r := pg_temp.call('adm', format($q$select public.supplier_import(%L, %L::jsonb)$q$, pg_temp.g('A'),
    '[{"name":"Comercial Nevada","rut":"77.120.908-K","category":"Tabaco"},{"name":"Dist Andes otra vez","rut":"76482115-3"},{"name":"bebidas del maipo"},{"name":"Dulces Pehuén","rut":""},{"name":""}]'));
  perform pg_temp.ok('Importar crea los nuevos y omite repetidos (por RUT o nombre) y vacíos',
    (r->>'created')::int = 2 and (r->>'skipped')::int = 3, r::text);
  r := pg_temp.call('adm', format($q$select public.supplier_import(%L, %L::jsonb)$q$, pg_temp.g('A'), '[{"name":"Comercial Nevada","rut":"77120908K"}]'));
  perform pg_temp.ok('Importar de nuevo es idempotente', (r->>'created')::int = 0, r::text);
end $$;

-- ---------------------------------------------------------------------------
-- 4. Storage de logos
-- ---------------------------------------------------------------------------
do $$
declare v_msg text; v_n jsonb; v_path text;
begin
  perform pg_temp.ok('El bucket es privado y limitado',
    (select not public and file_size_limit = 204800 and allowed_mime_types @> array['image/webp']
       from storage.buckets where id = 'shiftcontrol-supplier-logos'));
  v_path := pg_temp.g('A') || '/' || pg_temp.g('s1') || '/f.webp';
  v_msg := pg_temp.try('jt', format($f$insert into storage.objects (bucket_id, name) values ('shiftcontrol-supplier-logos', %L)$f$, v_path));
  perform pg_temp.ok('La jefa no puede subir logos', v_msg ilike '%row-level security%', v_msg);
  v_msg := pg_temp.try('admB', format($f$insert into storage.objects (bucket_id, name) values ('shiftcontrol-supplier-logos', %L)$f$, v_path));
  perform pg_temp.ok('Un admin de otra empresa no puede subir', v_msg ilike '%row-level security%', v_msg);
  v_msg := pg_temp.try('adm', format($f$insert into storage.objects (bucket_id, name) values ('shiftcontrol-supplier-logos', %L)$f$, pg_temp.g('A') || '/' || gen_random_uuid() || '/f.webp'));
  perform pg_temp.ok('Proveedor inexistente se rechaza', v_msg ilike '%row-level security%', v_msg);
  v_msg := pg_temp.try('adm', format($f$insert into storage.objects (bucket_id, name) values ('shiftcontrol-supplier-logos', %L)$f$, pg_temp.g('A') || '/no-uuid/f.webp'));
  perform pg_temp.ok('Carpeta no válida se rechaza', v_msg ilike '%row-level security%', v_msg);
  v_msg := pg_temp.try('adm', format($f$insert into storage.objects (bucket_id, name) values ('shiftcontrol-supplier-logos', %L)$f$, v_path));
  perform pg_temp.ok('El admin sube el logo', v_msg = 'OK', v_msg);
  v_n := pg_temp.call('jt', $q$select to_jsonb(count(*)) from storage.objects where bucket_id = 'shiftcontrol-supplier-logos'$q$);
  perform pg_temp.ok('Una jefa activa lo ve', (v_n#>>'{}')::int = 1, v_n::text);
  v_n := pg_temp.call('off', $q$select to_jsonb(count(*)) from storage.objects where bucket_id = 'shiftcontrol-supplier-logos'$q$);
  perform pg_temp.ok('Una jefa inactiva no lo ve', (v_n#>>'{}')::int = 0, v_n::text);
  v_n := pg_temp.call('admB', $q$select to_jsonb(count(*)) from storage.objects where bucket_id = 'shiftcontrol-supplier-logos'$q$);
  perform pg_temp.ok('Otra empresa no lo ve', (v_n#>>'{}')::int = 0, v_n::text);
  v_n := pg_temp.call('jt', format($q$with d as (delete from storage.objects where name = %L returning 1) select to_jsonb(count(*)) from d$q$, v_path));
  perform pg_temp.ok('La jefa no puede borrarlo', (v_n#>>'{}')::int = 0, v_n::text);
  v_n := pg_temp.call('adm', format($q$with d as (delete from storage.objects where name = %L returning 1) select to_jsonb(count(*)) from d$q$, v_path));
  perform pg_temp.ok('El admin sí', (v_n#>>'{}')::int = 1, v_n::text);
end $$;

do $$ begin raise notice 'PROVEEDORES: TODAS LAS PRUEBAS PASARON'; end $$;
rollback;
