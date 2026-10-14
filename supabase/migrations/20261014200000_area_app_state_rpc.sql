-- Aislamiento de app_state por área (fase 1: solo agrega funciones).
--
-- app_state guarda un JSON completo por empresa. El administrador sigue
-- leyéndolo y escribiéndolo directamente. Las jefaturas pasan a usar:
--
--   get_area_app_state(company, key)        -> su parte del estado
--   get_app_state_version(company, key)     -> updated_at, para sincronizar
--   save_area_app_state(company, key, expected_updated_at, data)
--
-- save_area_app_state recibe la parte de la jefa y el servidor decide qué
-- acepta: solo registros de su área; nada de finanzas, configuración ni de la
-- otra área; no aprueba facturas ni evaluaciones, no registra pagos y no
-- modifica registros ya aprobados, pagados, resueltos o checklists enviados.
-- La escritura es condicional sobre updated_at (40001 si otro usuario guardó
-- antes), igual que la sincronización del cliente.
--
-- Esta fase no cambia ningún permiso existente. La fase 2
-- (20261014200100_lock_app_state_to_admin.sql) retira a las jefaturas el
-- acceso directo a app_state y debe aplicarse junto con la publicación del
-- cliente que usa estas funciones.
--
-- Reglas de área (iguales a src/app/areas.js):
-- - Trabajadores: employee.area "Isla"/"Estación" -> ISLA, "Tienda" -> TIENDA.
--   Si nadie tiene área Isla, la isla incluye a todo el personal que no es
--   de tienda (bases antiguas).
-- - plans, executions, absences, additional, evaluations: por employeeId.
-- - incidents, handoffs: por area (sin área = ISLA).
-- - invoices: por area (sin área = facturas del administrador).
-- - checklists: clave "TIENDA:<fecha>" o entry.area para tienda; el resto isla.

create or replace function public.sc_norm_area(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case translate(lower(trim(coalesce(p_value, ''))), 'áéíóúü', 'aeiouu')
    when 'isla' then 'ISLA'
    when 'estacion' then 'ISLA'
    when 'tienda' then 'TIENDA'
    else null
  end;
$$;

create or replace function public.sc_json_array(p_value jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(p_value) = 'array' then p_value else '[]'::jsonb end;
$$;

create or replace function public.sc_area_employee_ids(p_state jsonb, p_area text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  with employees as (
    select item, public.sc_norm_area(item->>'area') as area
    from jsonb_array_elements(public.sc_json_array(p_state->'employees')) item
    where item ? 'id'
  )
  select coalesce(
    case
      when p_area = 'ISLA' and not exists (select 1 from employees where area = 'ISLA')
        then (select array_agg(item->>'id') from employees where area is distinct from 'TIENDA')
      else (select array_agg(item->>'id') from employees where area = p_area)
    end,
    '{}'::text[]
  );
$$;

create or replace function public.sc_checklist_area(p_key text, p_entry jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    public.sc_norm_area(p_entry->>'area'),
    case when p_key like 'TIENDA:%' then 'TIENDA' else 'ISLA' end
  );
$$;

-- ¿El registro pertenece al área? p_kind indica cómo se determina.
create or replace function public.sc_in_scope(p_kind text, p_item jsonb, p_ids text[], p_area text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  -- Siempre devuelve true o false (nunca null): un null haría que un registro
  -- de otra área se tratara como propio en las comparaciones.
  select coalesce(case
    when p_kind in ('employees') then (p_item->>'id') = any(p_ids)
    when p_kind in ('plans', 'executions', 'absences', 'additional', 'evaluations')
      then (p_item->>'employeeId') = any(p_ids)
    when p_kind in ('incidents', 'handoffs')
      then coalesce(public.sc_norm_area(p_item->>'area'), 'ISLA') = p_area
    when p_kind = 'invoices' then public.sc_norm_area(p_item->>'area') = p_area
    else false
  end, false);
$$;

-- Registros que una jefa ya no puede modificar ni eliminar.
create or replace function public.sc_locked(p_kind text, p_item jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_kind
    when 'invoices' then coalesce(p_item->>'aprobacion', 'aprobada') = 'aprobada'
    when 'evaluations' then p_item->>'status' = 'approved'
    when 'additional' then coalesce(p_item->>'paid', '') in ('Pagado', 'Aprobado para pago')
    when 'incidents' then p_item->>'status' = 'resolved' or coalesce((p_item->>'archived')::boolean, false)
    else false
  end;
$$;

-- Ajusta un registro enviado por una jefa: conserva los campos que solo el
-- administrador puede definir. p_remote es la versión anterior (o null).
create or replace function public.sc_protect(p_kind text, p_item jsonb, p_remote jsonb, p_actor text)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_kind = 'invoices' then
    if p_remote is not null and p_item = p_remote then
      return p_remote;
    end if;
    return (p_item - 'aprobadaPor' - 'aprobadaAt' - 'rechazadaPor' - 'rechazadaAt')
      || jsonb_build_object(
        'aprobacion', 'pendiente_aprobacion',
        'estado', 'pendiente',
        'enviadaPor', p_actor,
        'enviadaAt', to_jsonb(now())
      );
  elsif p_kind = 'evaluations' then
    return (p_item - 'approvedAt' - 'approvedBy' - 'returnNote' - 'returnedAt' - 'returnedBy')
      || jsonb_strip_nulls(jsonb_build_object(
        'returnNote', p_remote->'returnNote',
        'returnedAt', p_remote->'returnedAt',
        'returnedBy', p_remote->'returnedBy'
      ))
      || jsonb_build_object('status',
        case when p_item->>'status' in ('draft', 'submitted') then p_item->>'status'
             else coalesce(p_remote->>'status', 'draft') end);
  elsif p_kind = 'additional' then
    if p_remote is not null then
      return (p_item - 'paid' - 'paidDate' - 'approvedForPaymentAt' - 'amount')
        || jsonb_strip_nulls(jsonb_build_object(
          'paid', p_remote->'paid',
          'paidDate', p_remote->'paidDate',
          'approvedForPaymentAt', p_remote->'approvedForPaymentAt',
          'amount', p_remote->'amount'
        ));
    end if;
    return (p_item - 'paidDate' - 'approvedForPaymentAt')
      || jsonb_build_object('paid', 'Pendiente');
  elsif p_kind = 'incidents' then
    return p_item || jsonb_build_object(
      'status', case when p_item->>'status' in ('open', 'review') then p_item->>'status'
                     else coalesce(p_remote->>'status', 'open') end,
      'archived', coalesce(p_remote->'archived', 'false'::jsonb)
    );
  end if;
  return p_item;
end;
$$;

-- Reemplaza la parte del área en una colección conservando el orden: lo que
-- no es del área queda igual; lo del área se reemplaza por lo enviado
-- (ajustado con sc_protect) o se elimina si no se envió, salvo los registros
-- bloqueados, que siempre se conservan; lo nuevo se agrega al final.
create or replace function public.sc_merge_slice(
  p_kind text,
  p_remote jsonb,
  p_submitted jsonb,
  p_ids text[],
  p_area text,
  p_actor text
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with remote as (
    select
      list.item,
      list.position,
      case when jsonb_typeof(list.item) = 'object' then list.item->>'id' end as id,
      coalesce(jsonb_typeof(list.item) = 'object'
        and list.item ? 'id'
        and public.sc_in_scope(p_kind, list.item, p_ids, p_area), false) as in_scope
    from jsonb_array_elements(public.sc_json_array(p_remote)) with ordinality as list(item, position)
  ),
  submitted as (
    select distinct on (list.item->>'id') list.item, list.position, list.item->>'id' as id
    from jsonb_array_elements(public.sc_json_array(p_submitted)) with ordinality as list(item, position)
    where jsonb_typeof(list.item) = 'object' and list.item ? 'id'
    order by list.item->>'id', list.position
  ),
  candidates as (
    select
      sent.id,
      sent.position,
      sent.item,
      previous.item as previous,
      case when p_kind in ('incidents', 'handoffs', 'invoices')
        then sent.item || jsonb_build_object('area', p_area)
        else sent.item end as forced
    from submitted sent
    left join remote previous on previous.id = sent.id and previous.in_scope
    -- Un id que pertenece a otra área nunca se acepta.
    where not exists (
      select 1 from remote other where other.id = sent.id and not other.in_scope
    )
  ),
  accepted as (
    select id, position, previous,
      case
        -- Sin cambios: se conserva tal cual.
        when previous is not null and item = previous then previous
        when not public.sc_in_scope(p_kind, forced, p_ids, p_area) then null
        when previous is not null and public.sc_locked(p_kind, previous) then previous
        else public.sc_protect(p_kind, forced, previous, p_actor)
      end as item
    from candidates
  ),
  result as (
    -- Se conserva el orden: lo del área queda en su posición; si no se
    -- envió, se elimina salvo que esté bloqueado.
    select 0 as part, remote.position,
      case
        when not remote.in_scope then remote.item
        when accepted.item is not null then accepted.item
        when public.sc_locked(p_kind, remote.item) then remote.item
      end as item
    from remote
    left join accepted on remote.in_scope and accepted.id = remote.id
    union all
    -- Lo nuevo se agrega al final.
    select 1, accepted.position, accepted.item
    from accepted
    where accepted.item is not null
      and not exists (select 1 from remote where remote.in_scope and remote.id = accepted.id)
  )
  select coalesce(jsonb_agg(item order by part, position), '[]'::jsonb)
  from result
  where item is not null;
$$;

-- Checklists: objeto por clave. La jefa no elimina checklists ni modifica
-- los ya enviados; la revisión y la resolución de incumplimientos son del
-- administrador.
create or replace function public.sc_merge_checklists(p_remote jsonb, p_submitted jsonb, p_area text)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_remote jsonb := case when jsonb_typeof(p_remote) = 'object' then p_remote else '{}'::jsonb end;
  v_submitted jsonb := case when jsonb_typeof(p_submitted) = 'object' then p_submitted else '{}'::jsonb end;
  v_result jsonb := '{}'::jsonb;
  v_key text;
  v_entry jsonb;
  v_previous jsonb;
  v_details jsonb;
  v_detail_key text;
  v_detail jsonb;
  v_previous_follow jsonb;
begin
  for v_key, v_entry in select key, value from jsonb_each(v_remote) loop
    if public.sc_checklist_area(v_key, v_entry) <> p_area
      or coalesce((v_entry->>'completed')::boolean, false)
      or not (v_submitted ? v_key)
    then
      v_result := v_result || jsonb_build_object(v_key, v_entry);
    end if;
  end loop;

  for v_key, v_entry in select key, value from jsonb_each(v_submitted) loop
    continue when v_result ? v_key or jsonb_typeof(v_entry) <> 'object';
    continue when public.sc_checklist_area(v_key, '{}'::jsonb) <> p_area;
    v_previous := v_remote -> v_key;
    v_entry := (v_entry - 'reviewedAt' - 'reviewedBy')
      || jsonb_build_object('area', p_area)
      || jsonb_strip_nulls(jsonb_build_object(
        'reviewedAt', v_previous->'reviewedAt',
        'reviewedBy', v_previous->'reviewedBy'
      ));
    if coalesce(v_entry->>'reviewStatus', 'pending_review') <> 'pending_review' then
      v_entry := (v_entry - 'reviewStatus')
        || jsonb_strip_nulls(jsonb_build_object('reviewStatus', v_previous->'reviewStatus'));
    end if;
    if jsonb_typeof(v_entry->'details') = 'object' then
      v_details := '{}'::jsonb;
      for v_detail_key, v_detail in select key, value from jsonb_each(v_entry->'details') loop
        v_previous_follow := v_previous #> array['details', v_detail_key, 'followUp'];
        if jsonb_typeof(v_detail) = 'object' then
          if v_previous_follow is not null then
            v_detail := v_detail || jsonb_build_object('followUp', v_previous_follow);
          elsif v_detail ? 'followUp' then
            v_detail := v_detail || jsonb_build_object('followUp', jsonb_build_object(
              'status', 'open',
              'openedAt', coalesce(v_detail #> '{followUp,openedAt}', to_jsonb(now()))
            ));
          end if;
        end if;
        v_details := v_details || jsonb_build_object(v_detail_key, v_detail);
      end loop;
      v_entry := v_entry || jsonb_build_object('details', v_details);
    end if;
    v_result := v_result || jsonb_build_object(v_key, v_entry);
  end loop;

  return v_result;
end;
$$;

-- Parte del estado visible para un área. Finanzas, depósitos, faltantes de
-- caja y el historial de actividad se entregan vacíos.
create or replace function public.sc_scope_app_state(p_state jsonb, p_area text)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_ids text[] := public.sc_area_employee_ids(p_state, p_area);
  v_result jsonb := '{}'::jsonb;
  v_key text;
  v_value jsonb;
  v_filtered jsonb;
begin
  for v_key, v_value in select key, value from jsonb_each(coalesce(p_state, '{}'::jsonb)) loop
    if v_key in ('employees', 'plans', 'executions', 'absences', 'additional', 'evaluations',
                 'incidents', 'handoffs', 'invoices') then
      select coalesce(jsonb_agg(item order by position), '[]'::jsonb)
      into v_filtered
      from jsonb_array_elements(public.sc_json_array(v_value)) with ordinality as list(item, position)
      where jsonb_typeof(item) = 'object'
        and public.sc_in_scope(v_key, item, v_ids, p_area);
      v_result := v_result || jsonb_build_object(v_key, v_filtered);
    elsif v_key = 'checklists' then
      select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
      into v_filtered
      from jsonb_each(case when jsonb_typeof(v_value) = 'object' then v_value else '{}'::jsonb end)
      where public.sc_checklist_area(key, value) = p_area;
      v_result := v_result || jsonb_build_object(v_key, v_filtered);
    elsif v_key in ('settings', 'holidays', 'closedMonths', 'dailyClosures') then
      v_result := v_result || jsonb_build_object(v_key, v_value);
    elsif jsonb_typeof(v_value) = 'array' then
      v_result := v_result || jsonb_build_object(v_key, '[]'::jsonb);
    elsif jsonb_typeof(v_value) = 'object' then
      v_result := v_result || jsonb_build_object(v_key, '{}'::jsonb);
    else
      v_result := v_result || jsonb_build_object(v_key, v_value);
    end if;
  end loop;
  return v_result;
end;
$$;

-- Área de la jefatura activa que llama (null si no es jefa activa).
create or replace function public.sc_caller_chief_area(p_company_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when membership.area = 'TIENDA' then 'TIENDA' else 'ISLA' end
  from public.company_memberships membership
  where membership.company_id = p_company_id
    and membership.user_id = (select auth.uid())
    and membership.role = 'CHIEF'
    and membership.active = true;
$$;

create or replace function public.get_app_state_version(p_company_id uuid, p_key text)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_updated_at timestamptz;
begin
  if not exists (
    select 1 from public.company_memberships membership
    where membership.company_id = p_company_id
      and membership.user_id = (select auth.uid())
      and membership.active = true
  ) then
    raise exception 'Sin acceso a la empresa.' using errcode = '42501';
  end if;
  select state.updated_at into v_updated_at
  from public.app_state state
  where state.company_id = p_company_id and state.key = p_key;
  return v_updated_at;
end;
$$;

create or replace function public.get_area_app_state(p_company_id uuid, p_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_area text := public.sc_caller_chief_area(p_company_id);
  v_state record;
begin
  if v_area is null then
    raise exception 'Solo una jefatura activa de la empresa puede leer su área.' using errcode = '42501';
  end if;
  select state.data, state.updated_at into v_state
  from public.app_state state
  where state.company_id = p_company_id and state.key = p_key;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'area', v_area,
    'updated_at', v_state.updated_at,
    'data', public.sc_scope_app_state(v_state.data, v_area)
  );
end;
$$;

create or replace function public.save_area_app_state(
  p_company_id uuid,
  p_key text,
  p_expected_updated_at timestamptz,
  p_data jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_area text := public.sc_caller_chief_area(p_company_id);
  v_actor text;
  v_state record;
  v_remote jsonb;
  v_result jsonb;
  v_ids text[];
  v_fallback boolean;
  v_employees jsonb[] := '{}';
  v_accepted_employees jsonb := '{}'::jsonb;
  v_new_ids text[] := '{}';
  v_item jsonb;
  v_previous jsonb;
  v_remote_ids text[];
  v_kind text;
  v_audit_ids text[];
  v_new_audit jsonb[] := '{}';
  v_now timestamptz := now();
begin
  if v_area is null then
    raise exception 'Solo una jefatura activa de la empresa puede guardar su área.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_data) is distinct from 'object' then
    raise exception 'Estado inválido.' using errcode = '22023';
  end if;

  select profile.display_name into v_actor
  from public.profiles profile where profile.id = (select auth.uid());

  select state.data, state.updated_at into v_state
  from public.app_state state
  where state.company_id = p_company_id and state.key = p_key
  for update;
  if not found then
    raise exception 'La empresa no tiene un estado operacional inicializado.' using errcode = 'P0002';
  end if;
  if v_state.updated_at is distinct from p_expected_updated_at then
    raise exception 'Otro usuario guardó cambios; vuelve a cargar y combinar.' using errcode = '40001';
  end if;

  v_remote := v_state.data;
  v_result := v_remote;
  v_ids := public.sc_area_employee_ids(v_remote, v_area);
  v_fallback := v_area = 'ISLA' and not exists (
    select 1 from jsonb_array_elements(public.sc_json_array(v_remote->'employees')) item
    where public.sc_norm_area(item->>'area') = 'ISLA'
  );

  -- Trabajadores: la jefa edita o crea personal de su área; no cambia el área.
  -- Si no se envía la lista de trabajadores, se conserva la actual.
  if jsonb_typeof(p_data->'employees') is distinct from 'array' then
    p_data := p_data || jsonb_build_object('employees',
      public.sc_scope_app_state(v_remote, v_area)->'employees');
  end if;
  select coalesce(array_agg(item->>'id'), '{}') into v_remote_ids
  from jsonb_array_elements(public.sc_json_array(v_remote->'employees')) item
  where item ? 'id';

  -- Lo enviado, ya validado, indexado por id.
  for v_item in select value from jsonb_array_elements(public.sc_json_array(p_data->'employees')) loop
    continue when jsonb_typeof(v_item) <> 'object' or not (v_item ? 'id');
    continue when v_accepted_employees ? (v_item->>'id');
    if (v_item->>'id') = any(v_ids) then
      select item into v_previous
      from jsonb_array_elements(public.sc_json_array(v_remote->'employees')) item
      where item->>'id' = v_item->>'id'
      limit 1;
      v_item := (v_item - 'area')
        || jsonb_strip_nulls(jsonb_build_object('area', v_previous->'area'));
    elsif (v_item->>'id') = any(v_remote_ids) then
      continue;
    elsif not (
      public.sc_norm_area(v_item->>'area') = v_area
      or (v_fallback and public.sc_norm_area(v_item->>'area') is distinct from 'TIENDA')
    ) then
      continue;
    else
      v_new_ids := array_append(v_new_ids, v_item->>'id');
    end if;
    v_accepted_employees := v_accepted_employees || jsonb_build_object(v_item->>'id', v_item);
  end loop;

  -- Se conserva el orden: cada trabajadora del área queda en su posición.
  for v_item in select value from jsonb_array_elements(public.sc_json_array(v_remote->'employees')) loop
    if (v_item->>'id') = any(v_ids) then
      if v_accepted_employees ? (v_item->>'id') then
        v_employees := array_append(v_employees, v_accepted_employees -> (v_item->>'id'));
      end if;
    else
      v_employees := array_append(v_employees, v_item);
    end if;
  end loop;
  foreach v_kind in array v_new_ids loop
    v_employees := array_append(v_employees, v_accepted_employees -> v_kind);
  end loop;

  v_result := jsonb_set(v_result, '{employees}', to_jsonb(v_employees));
  -- Registros del personal recién creado por la jefa también son de su área.
  v_ids := v_ids || v_new_ids;

  -- Una colección ausente o mal formada en lo enviado no se modifica: así un
  -- error del cliente nunca borra registros.
  foreach v_kind in array array['plans', 'executions', 'absences', 'additional', 'evaluations',
                                'incidents', 'handoffs', 'invoices'] loop
    if jsonb_typeof(p_data->v_kind) = 'array' then
      v_result := jsonb_set(v_result, array[v_kind], public.sc_merge_slice(
        v_kind, v_remote->v_kind, p_data->v_kind, v_ids, v_area, coalesce(v_actor, 'Jefatura')
      ));
    end if;
  end loop;

  if jsonb_typeof(p_data->'checklists') = 'object' then
    v_result := jsonb_set(v_result, '{checklists}',
      public.sc_merge_checklists(v_remote->'checklists', p_data->'checklists', v_area));
  end if;

  -- Historial: la jefa solo agrega entradas nuevas.
  select coalesce(array_agg(item->>'id'), '{}') into v_audit_ids
  from jsonb_array_elements(public.sc_json_array(v_remote->'audit')) item;
  for v_item in select value from jsonb_array_elements(public.sc_json_array(p_data->'audit')) loop
    continue when jsonb_typeof(v_item) <> 'object' or not (v_item ? 'id');
    continue when (v_item->>'id') = any(v_audit_ids);
    v_new_audit := array_append(v_new_audit, v_item);
    exit when array_length(v_new_audit, 1) >= 200;
  end loop;
  if array_length(v_new_audit, 1) > 0 then
    v_result := jsonb_set(v_result, '{audit}',
      to_jsonb(v_new_audit) || public.sc_json_array(v_remote->'audit'));
  end if;

  update public.app_state state
  set data = v_result, updated_at = v_now
  where state.company_id = p_company_id and state.key = p_key;

  return jsonb_build_object(
    'area', v_area,
    'updated_at', v_now,
    'data', public.sc_scope_app_state(v_result, v_area)
  );
end;
$$;

-- Las funciones auxiliares solo se usan desde las funciones del servidor.
revoke all on function public.sc_norm_area(text) from public, anon, authenticated;
revoke all on function public.sc_json_array(jsonb) from public, anon, authenticated;
revoke all on function public.sc_area_employee_ids(jsonb, text) from public, anon, authenticated;
revoke all on function public.sc_checklist_area(text, jsonb) from public, anon, authenticated;
revoke all on function public.sc_in_scope(text, jsonb, text[], text) from public, anon, authenticated;
revoke all on function public.sc_locked(text, jsonb) from public, anon, authenticated;
revoke all on function public.sc_protect(text, jsonb, jsonb, text) from public, anon, authenticated;
revoke all on function public.sc_merge_slice(text, jsonb, jsonb, text[], text, text) from public, anon, authenticated;
revoke all on function public.sc_merge_checklists(jsonb, jsonb, text) from public, anon, authenticated;
revoke all on function public.sc_scope_app_state(jsonb, text) from public, anon, authenticated;
revoke all on function public.sc_caller_chief_area(uuid) from public, anon, authenticated;
revoke all on function public.get_app_state_version(uuid, text) from public, anon;
revoke all on function public.get_area_app_state(uuid, text) from public, anon;
revoke all on function public.save_area_app_state(uuid, text, timestamptz, jsonb) from public, anon;
grant execute on function public.get_app_state_version(uuid, text) to authenticated;
grant execute on function public.get_area_app_state(uuid, text) to authenticated;
grant execute on function public.save_area_app_state(uuid, text, timestamptz, jsonb) to authenticated;
