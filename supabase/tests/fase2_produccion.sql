-- Verificación de la fase 2 sobre los datos REALES, sin dejar cambios.
--
-- Es UN SOLO bloque DO que termina siempre en una excepción con el informe
-- completo: PostgreSQL deshace de forma atómica todo lo que el bloque haya
-- escrito, así que no puede quedar ningún cambio ni una transacción abierta.
-- Funciona igual desde psql y desde herramientas que no muestran los NOTICE.
-- Solo informa conteos y resultados; nunca nombres, correos ni contenido.
--
-- La única escritura es un guardado sin cambios (y una actualización vacía) de
-- cada jefa activa, que la excepción final deshace.
--
-- Resultado: el mensaje de error empieza con
--   'VERIFICACIÓN OK'     -> todas las comprobaciones pasaron;
--   'VERIFICACIÓN FALLÓ'  -> la primera comprobación que falló, con su detalle.
--
-- Cuándo ejecutarlo (cambiar v_esperado en la línea indicada):
--   1. ANTES de la fase 2, con 'abierto' (estado actual).
--   2. DESPUÉS de aplicarla, con 'bloqueado'.
--
-- Nota: con 'abierto' la prueba de inserción directa SÍ crea una fila extra
-- dentro del bloque (la excepción final la deshace); por eso las lecturas del
-- estado filtran siempre por clave.

do $verificacion$
declare
  v_esperado text := 'bloqueado';   -- <<< 'abierto' | 'bloqueado'
  v_log text := '';
  c record;
  v_policies text;
  v_n int; v_rc int; v_denied boolean; v_blocked boolean;
  v_trabajadores int; v_turnos int; v_facturas int; v_total int;
  r jsonb; v timestamptz; v_antes jsonb; v_despues jsonb;
  who text; uid uuid; area_esperada text;
begin
  select m.company_id,
         (select s.key from public.app_state s where s.company_id = m.company_id order by s.key limit 1) as state_key,
         (select count(*) from public.app_state s where s.company_id = m.company_id) as state_rows,
         (select user_id from public.company_memberships a
           where a.company_id = m.company_id and a.role = 'ADMIN' and a.active order by a.user_id limit 1) as admin_id,
         (select user_id from public.company_memberships x
           where x.company_id = m.company_id and x.role = 'CHIEF' and x.area = 'ESTACION' and x.active limit 1) as isla_id,
         (select user_id from public.company_memberships x
           where x.company_id = m.company_id and x.role = 'CHIEF' and x.area = 'TIENDA' limit 1) as tienda_id,
         (select active from public.company_memberships x
           where x.company_id = m.company_id and x.role = 'CHIEF' and x.area = 'TIENDA' limit 1) as tienda_activa
    into c
  from (select company_id from public.company_memberships where role = 'ADMIN' and active limit 1) m;

  -- 0. Contexto.
  if c.company_id is null or c.admin_id is null then
    raise exception 'VERIFICACIÓN FALLÓ: no se encontró empresa o administrador activo';
  end if;
  if c.state_rows <> 1 then
    raise exception 'VERIFICACIÓN FALLÓ: se esperaba 1 fila en app_state y hay %', c.state_rows;
  end if;
  select string_agg(policyname, ', ' order by policyname) into v_policies
  from pg_policies where schemaname = 'public' and tablename = 'app_state';
  v_log := v_log || format(E'INFO esperado=%s | policies: %s\n', v_esperado, v_policies);
  v_log := v_log || format(E'INFO jefa de isla activa: %s | jefa de tienda existe: %s (activa: %s)\n',
    c.isla_id is not null, c.tienda_id is not null, coalesce(c.tienda_activa::text, 'n/a'));
  if v_esperado = 'bloqueado' and v_policies is distinct from
     'app_state_insert_for_admins, app_state_select_for_admins, app_state_update_for_admins' then
    raise exception 'VERIFICACIÓN FALLÓ: se esperaba la fase 2 aplicada y las policies son: %', v_policies;
  end if;
  if v_esperado = 'abierto' and v_policies is distinct from
     'app_state_insert_for_active_members, app_state_select_for_active_members, app_state_update_for_active_members' then
    raise exception 'VERIFICACIÓN FALLÓ: se esperaba el estado previo a la fase 2 y las policies son: %', v_policies;
  end if;

  -- 1. Administrador: lectura directa completa.
  perform set_config('request.jwt.claim.sub', c.admin_id::text, true);
  set local role authenticated;
  select count(*), max(jsonb_array_length(data->'employees')), max(jsonb_array_length(data->'plans')),
         max(jsonb_array_length(data->'invoices'))
    into v_n, v_trabajadores, v_turnos, v_facturas
  from public.app_state where company_id = c.company_id;
  reset role;
  if v_n <> 1 then
    raise exception 'VERIFICACIÓN FALLÓ: el administrador no lee su fila (% filas)', v_n;
  end if;
  v_total := v_trabajadores;
  v_log := v_log || format(E'PASS administrador lee app_state: %s trabajadores, %s turnos, %s facturas\n',
    v_trabajadores, v_turnos, v_facturas);

  -- 2. Cada jefa activa: acceso directo según lo esperado y funciones intactas.
  for who, uid, area_esperada in
    select 'isla', c.isla_id, 'ISLA' where c.isla_id is not null
    union all
    select 'tienda', c.tienda_id, 'TIENDA' where c.tienda_id is not null and c.tienda_activa
  loop
    perform set_config('request.jwt.claim.sub', uid::text, true);
    set local role authenticated;
    select count(*) into v_n from public.app_state;
    update public.app_state set updated_at = updated_at where company_id = c.company_id;
    get diagnostics v_rc = row_count;
    v_denied := false;
    begin
      insert into public.app_state (company_id, key, data) values (c.company_id, 'verificacion-' || who, '{}');
    exception when insufficient_privilege then v_denied := true;
    end;
    reset role;
    if v_esperado = 'bloqueado' then
      if v_n <> 0 or v_rc <> 0 or not v_denied then
        raise exception 'VERIFICACIÓN FALLÓ: jefa de %: acceso directo abierto (lee % filas, actualiza %, inserta %)',
          who, v_n, v_rc, not v_denied;
      end if;
      v_log := v_log || format(E'PASS jefa de %s: lectura, actualización e inserción directas bloqueadas\n', who);
    else
      v_log := v_log || format(E'INFO jefa de %s: acceso directo abierto (lee %s filas, actualiza %s, inserta %s)\n',
        who, v_n, v_rc, not v_denied);
    end if;

    perform set_config('request.jwt.claim.sub', uid::text, true);
    set local role authenticated;
    r := public.get_area_app_state(c.company_id, c.state_key);
    v := public.get_app_state_version(c.company_id, c.state_key);
    reset role;
    if r is null or r->>'area' <> area_esperada then
      raise exception 'VERIFICACIÓN FALLÓ: jefa de %: área devuelta % (esperada %)', who, r->>'area', area_esperada;
    end if;
    if jsonb_array_length(coalesce(r->'data'->'deposits', '[]')) <> 0
       or jsonb_array_length(coalesce(r->'data'->'audit', '[]')) <> 0
       or (area_esperada = 'TIENDA' and jsonb_array_length(coalesce(r->'data'->'employees', '[]')) >= v_total) then
      raise exception 'VERIFICACIÓN FALLÓ: jefa de %: recibió datos fuera de su área', who;
    end if;
    v_log := v_log || format(E'PASS jefa de %s: función por área devuelve %s de %s trabajadores, %s turnos, 0 depósitos, 0 historial\n',
      who, jsonb_array_length(r->'data'->'employees'), v_total, jsonb_array_length(coalesce(r->'data'->'plans', '[]')));

    select data into v_antes from public.app_state where company_id = c.company_id and key = c.state_key;
    perform set_config('request.jwt.claim.sub', uid::text, true);
    set local role authenticated;
    perform public.save_area_app_state(c.company_id, c.state_key, v, r->'data');
    reset role;
    select data into v_despues from public.app_state where company_id = c.company_id and key = c.state_key;
    if v_antes is distinct from v_despues then
      raise exception 'VERIFICACIÓN FALLÓ: jefa de %: guardar sin cambios alteró el estado', who;
    end if;
    v_log := v_log || format(E'PASS jefa de %s: guardar sin cambios deja el estado idéntico\n', who);
  end loop;

  -- 3. Jefa de tienda inactiva: sin acceso por ninguna vía.
  if c.tienda_id is not null and not c.tienda_activa then
    v_blocked := false;
    perform set_config('request.jwt.claim.sub', c.tienda_id::text, true);
    set local role authenticated;
    select count(*) into v_n from public.app_state;
    begin
      perform public.get_area_app_state(c.company_id, c.state_key);
    exception when insufficient_privilege then v_blocked := true;
    end;
    reset role;
    if v_n <> 0 or not v_blocked then
      raise exception 'VERIFICACIÓN FALLÓ: jefa de tienda inactiva tiene acceso (filas=%, función bloqueada=%)', v_n, v_blocked;
    end if;
    v_log := v_log || E'PASS jefa de tienda inactiva: sin acceso directo ni por función\n';
  else
    v_log := v_log || E'INFO jefa de tienda inactiva: no aplica\n';
  end if;

  -- 4. Sin sesión: nada.
  perform set_config('request.jwt.claim.sub', '', true);
  set local role anon;
  begin
    select count(*) into v_n from public.app_state;
  exception when insufficient_privilege then v_n := 0;
  end;
  reset role;
  if v_n <> 0 then
    raise exception 'VERIFICACIÓN FALLÓ: un usuario sin sesión lee app_state';
  end if;
  v_log := v_log || E'PASS usuario sin sesión: sin acceso\n';

  -- Siempre termina en excepción: deshace las escrituras de prueba.
  raise exception E'VERIFICACIÓN OK (todo se deshizo)\n%', v_log;
end
$verificacion$;
