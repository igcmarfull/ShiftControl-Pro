-- Pruebas de la migración 20261019140000_fuel_commissions.sql (litros por día y contrato de comisiones).
--
-- SOLO PARA UNA BASE LOCAL DESECHABLE con las migraciones de autenticación, equipo e inventario aplicadas.
-- Crea empresas y usuarios ficticios dentro de una transacción que termina en ROLLBACK. No ejecutar contra producción.
--
-- Uso:
--   psql -d <base_local> -v ON_ERROR_STOP=1 -f supabase/tests/combustible_local.sql

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
declare r jsonb; v_msg text; v_n jsonb;
begin
  -- Litros del día
  r := pg_temp.call('adm', format('select public.fuel_sales_save(%L, %L, 9810, 1920, 0)', pg_temp.g('A'), (now() at time zone 'America/Santiago')::date));
  perform pg_temp.ok('El administrador carga los litros del día', (r->>'retail_l')::int = 9810 and (r->>'flota_l')::int = 1920, r::text);
  r := pg_temp.call('adm', format('select public.fuel_sales_save(%L, %L, 10020, 1800, 150)', pg_temp.g('A'), (now() at time zone 'America/Santiago')::date));
  perform pg_temp.ok('Volver a cargar el mismo día lo reemplaza', (r->>'retail_l')::int = 10020 and (r->>'kerosene_l')::int = 150, r::text);
  v_n := pg_temp.call('adm', format($q$select to_jsonb(count(*)) from public.fuel_sales where company_id = %L$q$, pg_temp.g('A')));
  perform pg_temp.ok('Queda una sola fila por día', (v_n#>>'{}')::int = 1, v_n::text);
  perform pg_temp.call('adm', format('select public.fuel_sales_save(%L, %L, 0, 0, 0)', pg_temp.g('A'), ((now() at time zone 'America/Santiago')::date - 1)));
  v_n := pg_temp.call('adm', format($q$select to_jsonb(count(*)) from public.fuel_sales where company_id = %L$q$, pg_temp.g('A')));
  perform pg_temp.ok('Un día en cero también se guarda', (v_n#>>'{}')::int = 2, v_n::text);

  v_msg := pg_temp.try('adm', format('select public.fuel_sales_save(%L, %L, 1, 1, 1)', pg_temp.g('A'), ((now() at time zone 'America/Santiago')::date + 2)));
  perform pg_temp.ok('No acepta fechas futuras', v_msg = 'inv:invalid_date', v_msg);
  v_msg := pg_temp.try('adm', format('select public.fuel_sales_save(%L, %L, -5, 0, 0)', pg_temp.g('A'), (now() at time zone 'America/Santiago')::date));
  perform pg_temp.ok('No acepta litros negativos', v_msg = 'inv:invalid_liters', v_msg);
  v_msg := pg_temp.try('adm', format('select public.fuel_sales_save(%L, %L, 2000001, 0, 0)', pg_temp.g('A'), (now() at time zone 'America/Santiago')::date));
  perform pg_temp.ok('No acepta litros fuera de rango', v_msg = 'inv:invalid_liters', v_msg);
  v_msg := pg_temp.try('adm', format('select public.fuel_sales_save(%L, %L, null, 0, 0)', pg_temp.g('A'), (now() at time zone 'America/Santiago')::date));
  perform pg_temp.ok('No acepta litros vacíos', v_msg = 'inv:invalid_liters', v_msg);

  -- Permisos
  v_msg := pg_temp.try('jt', format('select public.fuel_sales_save(%L, %L, 1, 1, 1)', pg_temp.g('A'), (now() at time zone 'America/Santiago')::date));
  perform pg_temp.ok('La jefa de tienda no carga litros', v_msg = 'inv:forbidden', v_msg);
  v_msg := pg_temp.try('ji', format('select public.fuel_sales_save(%L, %L, 1, 1, 1)', pg_temp.g('A'), (now() at time zone 'America/Santiago')::date));
  perform pg_temp.ok('La jefa de isla no carga litros', v_msg = 'inv:forbidden', v_msg);
  v_msg := pg_temp.try('admB', format('select public.fuel_sales_save(%L, %L, 1, 1, 1)', pg_temp.g('A'), (now() at time zone 'America/Santiago')::date));
  perform pg_temp.ok('Otra empresa no carga en esta', v_msg like 'inv:%', v_msg);
  v_n := pg_temp.call('jt', $q$select to_jsonb(count(*)) from public.fuel_sales$q$);
  perform pg_temp.ok('La jefa de tienda no ve los litros', (v_n#>>'{}')::int = 0, v_n::text);
  v_n := pg_temp.call('ji', $q$select to_jsonb(count(*)) from public.fuel_sales$q$);
  perform pg_temp.ok('La jefa de isla no ve los litros', (v_n#>>'{}')::int = 0, v_n::text);
  v_n := pg_temp.call('admB', $q$select to_jsonb(count(*)) from public.fuel_sales$q$);
  perform pg_temp.ok('Otra empresa no ve los litros', (v_n#>>'{}')::int = 0, v_n::text);
  v_n := pg_temp.call('adm', $q$select to_jsonb(count(*)) from public.fuel_sales$q$);
  perform pg_temp.ok('El administrador ve los suyos', (v_n#>>'{}')::int = 2, v_n::text);
  v_msg := pg_temp.try('adm', format($q$insert into public.fuel_sales (company_id, sold_on, retail_l) values (%L, ((now() at time zone 'America/Santiago')::date - 5), 1)$q$, pg_temp.g('A')));
  perform pg_temp.ok('Nadie escribe directo en la tabla', v_msg ilike '%permission denied%', v_msg);

  -- Contrato
  r := pg_temp.call('adm', format($q$select public.fuel_contract_save(%L, %L::jsonb)$q$, pg_temp.g('A'),
    '{"valid_from":"2026-07-01","valid_to":"2026-12-31","pivot_l":450000,"low_rate":19.9,"low_fixed":5000000,"high_rate":35,"high_fixed":13956000,"kero_rate":30,"flota_rate":5,"iva_pct":19}'));
  perform pg_temp.ok('El administrador guarda el contrato', (r->>'pivot_l')::int = 450000 and (r->>'low_rate')::numeric = 19.9, r::text);
  r := pg_temp.call('adm', format($q$select public.fuel_contract_save(%L, %L::jsonb)$q$, pg_temp.g('A'),
    '{"valid_from":"2027-01-01","valid_to":"2027-06-30","pivot_l":460000,"low_rate":20.5,"low_fixed":5100000,"high_rate":36,"high_fixed":14500000,"kero_rate":31,"flota_rate":5.5}'));
  perform pg_temp.ok('Guardar de nuevo actualiza la misma fila (IVA 19 por defecto)', (r->>'pivot_l')::int = 460000 and (r->>'iva_pct')::numeric = 19, r::text);
  v_n := pg_temp.call('adm', format($q$select to_jsonb(count(*)) from public.fuel_contract where company_id = %L$q$, pg_temp.g('A')));
  perform pg_temp.ok('Hay un solo contrato por empresa', (v_n#>>'{}')::int = 1, v_n::text);
  v_msg := pg_temp.try('adm', format($q$select public.fuel_contract_save(%L, %L::jsonb)$q$, pg_temp.g('A'),
    '{"valid_from":"2026-12-31","valid_to":"2026-07-01","pivot_l":450000,"low_rate":19.9,"low_fixed":5000000,"high_rate":35,"high_fixed":13956000,"kero_rate":30,"flota_rate":5}'));
  perform pg_temp.ok('Rechaza una vigencia al revés', v_msg = 'inv:invalid_contract', v_msg);
  v_msg := pg_temp.try('adm', format($q$select public.fuel_contract_save(%L, %L::jsonb)$q$, pg_temp.g('A'),
    '{"valid_from":"2026-07-01","valid_to":"2026-12-31","pivot_l":0,"low_rate":19.9,"low_fixed":5000000,"high_rate":35,"high_fixed":13956000,"kero_rate":30,"flota_rate":5}'));
  perform pg_temp.ok('Rechaza un pivote en cero', v_msg = 'inv:invalid_contract', v_msg);
  v_msg := pg_temp.try('adm', format($q$select public.fuel_contract_save(%L, %L::jsonb)$q$, pg_temp.g('A'), '{"pivot_l":"abc"}'));
  perform pg_temp.ok('Rechaza valores que no son números', v_msg = 'inv:invalid_contract', v_msg);
  v_msg := pg_temp.try('jt', format($q$select public.fuel_contract_save(%L, %L::jsonb)$q$, pg_temp.g('A'), '{}'));
  perform pg_temp.ok('La jefa de tienda no cambia el contrato', v_msg = 'inv:forbidden', v_msg);
  v_n := pg_temp.call('jt', $q$select to_jsonb(count(*)) from public.fuel_contract$q$);
  perform pg_temp.ok('La jefa de tienda no ve el contrato', (v_n#>>'{}')::int = 0, v_n::text);
  v_n := pg_temp.call('admB', $q$select to_jsonb(count(*)) from public.fuel_contract$q$);
  perform pg_temp.ok('Otra empresa no ve el contrato', (v_n#>>'{}')::int = 0, v_n::text);

  -- Importación de informes (columnas parciales)
  r := pg_temp.call('adm', format($q$select public.fuel_sales_import(%L, %L::jsonb)$q$, pg_temp.g('A'),
    json_build_array(json_build_object('date', (now() at time zone 'America/Santiago')::date - 10, 'flota', 1500),
                     json_build_object('date', (now() at time zone 'America/Santiago')::date - 9, 'flota', 1200))::text));
  perform pg_temp.ok('Importa dos días de flota', (r->>'days')::int = 2, r::text);
  v_n := pg_temp.call('adm', format($q$select to_jsonb(retail_l || '/' || flota_l || '/' || kerosene_l) from public.fuel_sales where company_id = %L and sold_on = (now() at time zone 'America/Santiago')::date - 10$q$, pg_temp.g('A')));
  perform pg_temp.ok('Un día nuevo parte con ceros en lo que no viene', (v_n#>>'{}') = '0/1500/0', v_n::text);
  r := pg_temp.call('adm', format($q$select public.fuel_sales_import(%L, %L::jsonb)$q$, pg_temp.g('A'),
    json_build_array(json_build_object('date', (now() at time zone 'America/Santiago')::date - 10, 'retail', 13000, 'kerosene', 40))::text));
  v_n := pg_temp.call('adm', format($q$select to_jsonb(retail_l || '/' || flota_l || '/' || kerosene_l) from public.fuel_sales where company_id = %L and sold_on = (now() at time zone 'America/Santiago')::date - 10$q$, pg_temp.g('A')));
  perform pg_temp.ok('El informe general no pisa la flota del informe de flota', (v_n#>>'{}') = '13000/1500/40', v_n::text);
  r := pg_temp.call('adm', format($q$select public.fuel_sales_import(%L, %L::jsonb)$q$, pg_temp.g('A'),
    json_build_array(json_build_object('date', (now() at time zone 'America/Santiago')::date - 10, 'flota', 1700))::text));
  v_n := pg_temp.call('adm', format($q$select to_jsonb(retail_l || '/' || flota_l || '/' || kerosene_l) from public.fuel_sales where company_id = %L and sold_on = (now() at time zone 'America/Santiago')::date - 10$q$, pg_temp.g('A')));
  perform pg_temp.ok('Volver a subir flota cambia solo la flota', (v_n#>>'{}') = '13000/1700/40', v_n::text);
  v_msg := pg_temp.try('adm', format($q$select public.fuel_sales_import(%L, %L::jsonb)$q$, pg_temp.g('A'),
    json_build_array(json_build_object('date', (now() at time zone 'America/Santiago')::date - 8, 'flota', 10),
                     json_build_object('date', (now() at time zone 'America/Santiago')::date + 3, 'flota', 10))::text));
  perform pg_temp.ok('Una fecha futura rechaza todo el informe', v_msg = 'inv:invalid_date', v_msg);
  v_n := pg_temp.call('adm', format($q$select to_jsonb(count(*)) from public.fuel_sales where company_id = %L and sold_on = (now() at time zone 'America/Santiago')::date - 8$q$, pg_temp.g('A')));
  perform pg_temp.ok('Si falla una fila no se guarda ninguna', (v_n#>>'{}')::int = 0, v_n::text);
  v_msg := pg_temp.try('adm', format($q$select public.fuel_sales_import(%L, %L::jsonb)$q$, pg_temp.g('A'), '[{"date":"2026-10-01","flota":"abc"}]'));
  perform pg_temp.ok('Litros que no son números se rechazan', v_msg = 'inv:invalid_line', v_msg);
  v_msg := pg_temp.try('adm', format($q$select public.fuel_sales_import(%L, %L::jsonb)$q$, pg_temp.g('A'), '[{"date":"2026-10-01"}]'));
  perform pg_temp.ok('Una fila sin ninguna columna de litros se rechaza', v_msg = 'inv:invalid_liters', v_msg);
  v_msg := pg_temp.try('adm', format($q$select public.fuel_sales_import(%L, %L::jsonb)$q$, pg_temp.g('A'), '[]'));
  perform pg_temp.ok('Un informe vacío se rechaza', v_msg = 'inv:lines_required', v_msg);
  v_msg := pg_temp.try('jt', format($q$select public.fuel_sales_import(%L, %L::jsonb)$q$, pg_temp.g('A'), '[{"date":"2026-10-01","flota":10}]'));
  perform pg_temp.ok('La jefa de tienda no importa', v_msg = 'inv:forbidden', v_msg);
  v_msg := pg_temp.try('admB', format($q$select public.fuel_sales_import(%L, %L::jsonb)$q$, pg_temp.g('A'), '[{"date":"2026-10-01","flota":10}]'));
  perform pg_temp.ok('Otra empresa no importa en esta', v_msg like 'inv:%', v_msg);

  -- Auditoría
  v_n := pg_temp.call('adm', $q$select to_jsonb(count(*)) from public.inv_audit where action = 'fuel.sales'$q$);
  perform pg_temp.ok('Cada carga de litros queda en la auditoría', (v_n#>>'{}')::int = 3, v_n::text);
  v_n := pg_temp.call('adm', $q$select to_jsonb(count(*)) from public.inv_audit where action = 'fuel.contract'$q$);
  perform pg_temp.ok('Cada cambio de contrato queda en la auditoría', (v_n#>>'{}')::int = 2, v_n::text);
  v_n := pg_temp.call('adm', $q$select to_jsonb(count(*)) from public.inv_audit where action = 'fuel.import'$q$);
  perform pg_temp.ok('Cada importación exitosa queda en la auditoría', (v_n#>>'{}')::int = 3, v_n::text);
end $$;

do $$ begin raise notice 'COMBUSTIBLE: TODAS LAS PRUEBAS PASARON'; end $$;
rollback;
