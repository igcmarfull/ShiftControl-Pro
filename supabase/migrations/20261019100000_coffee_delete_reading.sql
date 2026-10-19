-- Anular una lectura del numeral de una máquina de café (solo administrador).
-- Sirve para quitar una lectura mal anotada o de prueba. Corregir su valor ya se podía (coffee_save_reading sobre el
-- mismo turno); esto la elimina. Deja el valor anulado en la auditoría. La cuadratura se recalcula sola: usa las
-- lecturas que quedan. Sin cambios de tablas.
-- Reversión: supabase/rollback/20261019100000_coffee_delete_reading.rollback.sql

create function public.coffee_delete_reading(p_company_id uuid, p_machine_id uuid, p_read_on date, p_shift text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
  v_row public.coffee_readings;
begin
  select * into a from public.inv_actor(p_company_id);
  if a.role <> 'ADMIN' then
    perform public.inv_fail('forbidden', 'Solo el administrador anula una lectura.', null, '42501');
  end if;
  delete from public.coffee_readings
  where company_id = p_company_id and machine_id = p_machine_id and read_on = p_read_on and shift = p_shift
  returning * into v_row;
  if not found then
    perform public.inv_fail('not_found', 'Esa lectura no existe.');
  end if;
  perform public.inv_log(p_company_id, 'coffee.reading_delete', 'coffee_machine', p_machine_id,
    jsonb_build_object('date', v_row.read_on, 'shift', v_row.shift, 'numeral', v_row.numeral,
      'entered_by', v_row.entered_by_name, 'entered_at', v_row.entered_at));
  return jsonb_build_object('read_on', v_row.read_on, 'shift', v_row.shift, 'numeral', v_row.numeral);
end;
$$;

revoke all on function public.coffee_delete_reading(uuid, uuid, date, text) from public, anon;
grant execute on function public.coffee_delete_reading(uuid, uuid, date, text) to authenticated;
