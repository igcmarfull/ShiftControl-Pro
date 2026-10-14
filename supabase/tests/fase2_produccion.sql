-- Verificación de la fase 2 sobre los datos REALES, sin dejar cambios.
--
-- Todo ocurre en una transacción que termina en ROLLBACK. Solo imprime
-- conteos y resultados (PASS/FAIL), nunca nombres, correos ni contenido.
-- La única escritura es un guardado sin cambios de la Jefa de Isla (y de la
-- Jefa de Tienda si está activa), que el ROLLBACK deshace.
--
-- Cuándo ejecutarlo:
--   1. ANTES de aplicar la fase 2, con 'abierto' (estado actual): confirma que
--      la app sigue funcionando por las funciones por área y muestra el
--      acceso directo que la fase 2 cerrará.
--   2. DESPUÉS de aplicarla, con 'bloqueado': exige que las jefaturas no lean
--      ni escriban app_state directo y que sus funciones sigan funcionando.
--
-- Cambiar el valor de la línea siguiente según el caso.
begin;
select set_config('sc.esperado', 'bloqueado', true);   -- 'abierto' | 'bloqueado'

create temp table ctx as
select m.company_id,
       (select s.key from public.app_state s where s.company_id = m.company_id order by s.key limit 1) as state_key,
       (select count(*) from public.app_state s where s.company_id = m.company_id) as state_rows,
       (select user_id from public.company_memberships a
         where a.company_id = m.company_id and a.role = 'ADMIN' and a.active order by a.user_id limit 1) as admin_id,
       (select user_id from public.company_memberships c
         where c.company_id = m.company_id and c.role = 'CHIEF' and c.area = 'ESTACION' and c.active limit 1) as isla_id,
       (select user_id from public.company_memberships c
         where c.company_id = m.company_id and c.role = 'CHIEF' and c.area = 'TIENDA' limit 1) as tienda_id,
       (select active from public.company_memberships c
         where c.company_id = m.company_id and c.role = 'CHIEF' and c.area = 'TIENDA' limit 1) as tienda_activa
from (select company_id from public.company_memberships where role = 'ADMIN' and active limit 1) m;
grant select on ctx to authenticated;

create function pg_temp.as_user(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  set local role authenticated;
end $$;

-- 0. Contexto (solo conteos).
do $$
declare c record; policies text;
begin
  select * into c from pg_temp.ctx;
  if c.company_id is null or c.admin_id is null then raise exception 'FAIL no se encontró empresa o administrador activo'; end if;
  if c.state_rows <> 1 then raise exception 'FAIL se esperaba 1 fila en app_state para la empresa y hay %', c.state_rows; end if;
  select string_agg(policyname, ', ' order by policyname) into policies
  from pg_policies where schemaname = 'public' and tablename = 'app_state';
  raise notice 'INFO esperado=% | policies: %', current_setting('sc.esperado'), policies;
  raise notice 'INFO jefa de isla activa: % | jefa de tienda existe: % (activa: %)',
    c.isla_id is not null, c.tienda_id is not null, coalesce(c.tienda_activa::text, 'n/a');
  if current_setting('sc.esperado') = 'bloqueado' and policies is distinct from
     'app_state_insert_for_admins, app_state_select_for_admins, app_state_update_for_admins' then
    raise exception 'FAIL se esperaba la fase 2 aplicada y las policies son otras';
  end if;
  if current_setting('sc.esperado') = 'abierto' and policies is distinct from
     'app_state_insert_for_active_members, app_state_select_for_active_members, app_state_update_for_active_members' then
    raise exception 'FAIL se esperaba el estado previo a la fase 2 y las policies son otras';
  end if;
end $$;

-- 1. Administrador: lectura directa completa.
do $$
declare c record; n int; trabajadores int; turnos int; facturas int;
begin
  select * into c from pg_temp.ctx;
  perform pg_temp.as_user(c.admin_id);
  select count(*), max(jsonb_array_length(data->'employees')), max(jsonb_array_length(data->'plans')),
         max(jsonb_array_length(data->'invoices'))
    into n, trabajadores, turnos, facturas
  from public.app_state where company_id = c.company_id;
  reset role;
  if n <> 1 then raise exception 'FAIL el administrador no lee su fila (% filas)', n; end if;
  raise notice 'PASS administrador lee app_state: % trabajadores, % turnos, % facturas', trabajadores, turnos, facturas;
end $$;

-- 2. Cada jefa activa: acceso directo según lo esperado y funciones intactas.
do $$
declare c record; who text; uid uuid; area_esperada text; n int; rc int; r jsonb; v timestamptz;
        saved jsonb; antes jsonb; despues jsonb; denied boolean; trabajadores_total int;
begin
  select * into c from pg_temp.ctx;
  select jsonb_array_length(data->'employees') into trabajadores_total
  from public.app_state where company_id = c.company_id;

  for who, uid, area_esperada in
    select 'isla', c.isla_id, 'ISLA' where c.isla_id is not null
    union all
    select 'tienda', c.tienda_id, 'TIENDA' where c.tienda_id is not null and c.tienda_activa
  loop
    -- Acceso directo a app_state.
    perform pg_temp.as_user(uid);
    select count(*) into n from public.app_state;
    update public.app_state set updated_at = updated_at where company_id = c.company_id;
    get diagnostics rc = row_count;
    denied := false;
    begin
      insert into public.app_state (company_id, key, data) values (c.company_id, 'verificacion-' || who, '{}');
    exception when insufficient_privilege then denied := true;
    end;
    reset role;
    if current_setting('sc.esperado') = 'bloqueado' then
      if n <> 0 or rc <> 0 or not denied then
        raise exception 'FAIL jefa de %: acceso directo abierto (lee % filas, actualiza %, inserta %)', who, n, rc, not denied;
      end if;
      raise notice 'PASS jefa de %: lectura, actualización e inserción directas bloqueadas', who;
    else
      raise notice 'INFO jefa de %: acceso directo abierto (lee % filas, actualiza %, inserta %)', who, n, rc, not denied;
    end if;

    -- Funciones por área: lo que usa la app publicada.
    perform pg_temp.as_user(uid);
    r := public.get_area_app_state(c.company_id, c.state_key);
    v := public.get_app_state_version(c.company_id, c.state_key);
    reset role;
    if r is null or r->>'area' <> area_esperada then
      raise exception 'FAIL jefa de %: área devuelta % (esperada %)', who, r->>'area', area_esperada;
    end if;
    if jsonb_array_length(coalesce(r->'data'->'deposits', '[]')) <> 0
       or jsonb_array_length(coalesce(r->'data'->'audit', '[]')) <> 0
       or jsonb_array_length(coalesce(r->'data'->'employees', '[]')) >= trabajadores_total and area_esperada = 'TIENDA' then
      raise exception 'FAIL jefa de %: recibió datos fuera de su área', who;
    end if;
    raise notice 'PASS jefa de %: función por área devuelve % de % trabajadores, % turnos, 0 depósitos, 0 historial',
      who, jsonb_array_length(r->'data'->'employees'), trabajadores_total, jsonb_array_length(coalesce(r->'data'->'plans', '[]'));

    -- Guardar sin cambios deja el estado idéntico (deshecho por el ROLLBACK).
    select data into antes from public.app_state where company_id = c.company_id;
    perform pg_temp.as_user(uid);
    saved := public.save_area_app_state(c.company_id, c.state_key, v, r->'data');
    reset role;
    select data into despues from public.app_state where company_id = c.company_id;
    if antes is distinct from despues then
      raise exception 'FAIL jefa de %: guardar sin cambios alteró el estado', who;
    end if;
    raise notice 'PASS jefa de %: guardar sin cambios deja el estado idéntico', who;
  end loop;
end $$;

-- 3. Jefa de tienda inactiva: sin acceso por ninguna vía.
do $$
declare c record; n int; blocked boolean := false;
begin
  select * into c from pg_temp.ctx;
  if c.tienda_id is null or c.tienda_activa then
    raise notice 'INFO jefa de tienda inactiva: no aplica (existe=%, activa=%)', c.tienda_id is not null, coalesce(c.tienda_activa::text, 'n/a');
    return;
  end if;
  perform pg_temp.as_user(c.tienda_id);
  select count(*) into n from public.app_state;
  begin
    perform public.get_area_app_state(c.company_id, c.state_key);
  exception when insufficient_privilege then blocked := true;
  end;
  reset role;
  if n <> 0 or not blocked then raise exception 'FAIL jefa de tienda inactiva tiene acceso (filas=%, función bloqueada=%)', n, blocked; end if;
  raise notice 'PASS jefa de tienda inactiva: sin acceso directo ni por función';
end $$;

-- 4. Sin sesión: nada.
do $$
declare n int;
begin
  perform set_config('request.jwt.claim.sub', '', true);
  set local role anon;
  begin
    select count(*) into n from public.app_state;
  exception when insufficient_privilege then n := 0;
  end;
  reset role;
  if n <> 0 then raise exception 'FAIL un usuario sin sesión lee app_state'; end if;
  raise notice 'PASS usuario sin sesión: sin acceso';
end $$;

do $$ begin raise notice 'VERIFICACIÓN COMPLETA (se deshace con ROLLBACK)'; end $$;

rollback;
