-- El numeral de las máquinas de café lo anota solo el administrador.
-- Antes también lo anotaba la jefa de tienda (y no podía corregirlo). La jefa de tienda sigue viendo la cuadratura,
-- las lecturas y las ventas, e importando las ventas del POS: solo cambia coffee_save_reading.
-- Las lecturas ya guardadas no se tocan. Sin cambios de tablas.
-- Reversión: supabase/rollback/20261018190000_coffee_reading_admin_only.rollback.sql

create or replace function public.coffee_save_reading(p_company_id uuid, p_machine_id uuid, p_read_on date, p_shift text, p_numeral bigint, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
  v_today date := (now() at time zone 'America/Santiago')::date;
  v_row public.coffee_readings;
begin
  select * into a from public.inv_actor(p_company_id);
  if a.role <> 'ADMIN' then
    perform public.inv_fail('forbidden', 'Solo el administrador anota el numeral de las máquinas de café.', null, '42501');
  end if;
  if not exists (select 1 from public.coffee_machines where id = p_machine_id and company_id = p_company_id and active) then
    perform public.inv_fail('not_found', 'La máquina no existe o está desactivada.', null, '42501');
  end if;
  if p_shift is null or p_shift not in ('A', 'B', 'C') then perform public.inv_fail('invalid_shift', 'El turno debe ser A, B o C.'); end if;
  if p_read_on is null or p_read_on > v_today then perform public.inv_fail('invalid_date', 'La fecha de la lectura no puede ser futura.'); end if;
  if p_numeral is null or p_numeral < 0 then perform public.inv_fail('invalid_numeral', 'El numeral no es válido.'); end if;
  select * into v_row from public.coffee_readings where machine_id = p_machine_id and read_on = p_read_on and shift = p_shift;
  if found then
    update public.coffee_readings set numeral = p_numeral, note = nullif(trim(coalesce(p_note, '')), ''),
      entered_by = a.user_id, entered_by_name = a.user_name, entered_at = now()
    where id = v_row.id returning * into v_row;
  else
    insert into public.coffee_readings (company_id, machine_id, read_on, shift, numeral, note, entered_by, entered_by_name)
    values (p_company_id, p_machine_id, p_read_on, p_shift, p_numeral, nullif(trim(coalesce(p_note, '')), ''), a.user_id, a.user_name)
    returning * into v_row;
  end if;
  perform public.inv_log(p_company_id, 'coffee.reading', 'coffee_machine', p_machine_id,
    jsonb_build_object('date', p_read_on, 'shift', p_shift, 'numeral', p_numeral));
  return to_jsonb(v_row);
end;
$$;

revoke all on function public.coffee_save_reading(uuid, uuid, date, text, bigint, text) from public, anon;
grant execute on function public.coffee_save_reading(uuid, uuid, date, text, bigint, text) to authenticated;
