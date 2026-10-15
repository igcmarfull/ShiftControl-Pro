-- PENDIENTE de aplicar en producción: coffee_machine_save (parte de 20261016180000_coffee_machines.sql).
-- La conexión que usa Claude Code se queda sin responder con este SQL porque contiene un DELETE;
-- hay que ejecutarlo a mano en Supabase (Dashboard → SQL Editor). Es lo único que falta de esa migración.
-- Al terminar, borra también las tres funciones de prueba (ver el final del archivo).

-- Crea o edita una máquina (administrador). p_machine: {id?, name, tolerance, active, codes: [{code, cups}]}
create function public.coffee_machine_save(p_company_id uuid, p_machine jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
  v_id uuid := nullif(p_machine->>'id', '')::uuid;
  v_old public.coffee_machines;
  v_new public.coffee_machines;
  v_name text;
  v_tol integer;
  v_active boolean;
  v_code jsonb;
  v_pos text;
  v_cups integer;
begin
  select * into a from public.inv_actor(p_company_id);
  if a.role <> 'ADMIN' then
    perform public.inv_fail('forbidden', 'Solo el administrador configura las máquinas.', null, '42501');
  end if;
  if v_id is not null then
    select * into v_old from public.coffee_machines where id = v_id and company_id = p_company_id for update;
    if not found then perform public.inv_fail('not_found', 'La máquina no existe.', null, '42501'); end if;
  end if;
  v_name := trim(case when p_machine ? 'name' then coalesce(p_machine->>'name', '') else coalesce(v_old.name, '') end);
  v_tol := case when p_machine ? 'tolerance' then coalesce((p_machine->>'tolerance')::integer, 5) else coalesce(v_old.tolerance, 5) end;
  v_active := case when p_machine ? 'active' then coalesce((p_machine->>'active')::boolean, true) else coalesce(v_old.active, true) end;
  if v_name = '' then perform public.inv_fail('name_required', 'La máquina necesita un nombre.'); end if;
  if v_tol < 0 or v_tol > 500 then perform public.inv_fail('invalid_tolerance', 'La tolerancia debe estar entre 0 y 500 vasos.'); end if;
  begin
    if v_id is null then
      insert into public.coffee_machines (company_id, name, tolerance, active)
      values (p_company_id, v_name, v_tol, v_active) returning * into v_new;
    else
      update public.coffee_machines set name = v_name, tolerance = v_tol, active = v_active, updated_at = now()
      where id = v_id returning * into v_new;
    end if;
  exception when unique_violation then
    perform public.inv_fail('duplicate_name', 'Ya existe una máquina con ese nombre.');
  end;
  if p_machine ? 'codes' then
    if jsonb_typeof(p_machine->'codes') <> 'array' then perform public.inv_fail('invalid_codes', 'La lista de códigos no es válida.'); end if;
    delete from public.coffee_machine_codes where machine_id = v_new.id;
    for v_code in select * from jsonb_array_elements(p_machine->'codes') loop
      v_pos := left(trim(coalesce(v_code->>'code', '')), 40);
      v_cups := coalesce((v_code->>'cups')::integer, 1);
      if v_pos = '' or v_cups < 1 or v_cups > 20 then perform public.inv_fail('invalid_codes', 'Hay un código o una cantidad de vasos no válidos.'); end if;
      begin
        insert into public.coffee_machine_codes (company_id, machine_id, pos_code, cups) values (p_company_id, v_new.id, v_pos, v_cups);
      exception when unique_violation then
        perform public.inv_fail('duplicate_code', 'El código ' || v_pos || ' ya pertenece a otra máquina o está repetido.');
      end;
    end loop;
  end if;
  perform public.inv_log(p_company_id, 'coffee.machine_save', 'coffee_machine', v_new.id, jsonb_build_object('name', v_new.name));
  return to_jsonb(v_new);
end;
$$;
revoke all on function public.coffee_machine_save(uuid, jsonb) from public, anon;
grant execute on function public.coffee_machine_save(uuid, jsonb) to authenticated;

-- Limpieza de las funciones de prueba que quedaron en producción:
drop function if exists public.coffee_probe();
drop function if exists public.coffee_probe2();
drop function if exists public.coffee_probe4();
