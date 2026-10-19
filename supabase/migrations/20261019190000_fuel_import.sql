-- Importación de informes de venta de combustible: carga varios días de una vez.
-- fuel_sales_import recibe filas {date, retail, flota, kerosene} y actualiza solo las columnas que vienen:
-- el informe de flota trae solo «flota» y el informe general trae «retail» y «kerosene», así que subir uno no pisa
-- lo del otro. Un día nuevo parte con ceros en lo que no viene. Es atómica: si una fila falla, no se guarda nada.
-- Solo administrador; deja una entrada en inv_audit (fuel.import). Sin cambios de tablas.
-- Reversión: supabase/rollback/20261019190000_fuel_import.rollback.sql

create function public.fuel_sales_import(p_company_id uuid, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
  e jsonb;
  v_today date := (now() at time zone 'America/Santiago')::date;
  v_day date;
  v_r integer;
  v_f integer;
  v_k integer;
  v_n integer := 0;
  v_min date;
  v_max date;
begin
  select * into a from public.inv_actor(p_company_id);
  if a.role <> 'ADMIN' then
    perform public.inv_fail('forbidden', 'Solo el administrador carga los litros.', null, '42501');
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    perform public.inv_fail('lines_required', 'El informe no trae días para cargar.');
  end if;
  if jsonb_array_length(p_rows) > 400 then
    perform public.inv_fail('too_many_lines', 'El informe trae demasiados días. Sube un período más corto.');
  end if;

  for e in select * from jsonb_array_elements(p_rows) loop
    begin
      v_day := (e->>'date')::date;
      v_r := case when e ? 'retail' and e->>'retail' is not null then (e->>'retail')::integer end;
      v_f := case when e ? 'flota' and e->>'flota' is not null then (e->>'flota')::integer end;
      v_k := case when e ? 'kerosene' and e->>'kerosene' is not null then (e->>'kerosene')::integer end;
    exception when others then
      perform public.inv_fail('invalid_line', 'Hay un día del informe con fecha o litros que no se pueden leer.');
    end;
    if v_day is null or v_day > v_today or v_day < date '2020-01-01' then
      perform public.inv_fail('invalid_date', 'El informe trae una fecha futura o no válida.');
    end if;
    if coalesce(v_r, v_f, v_k) is null
       or coalesce(v_r, 0) not between 0 and 2000000 or coalesce(v_f, 0) not between 0 and 2000000
       or coalesce(v_k, 0) not between 0 and 2000000 then
      perform public.inv_fail('invalid_liters', 'Los litros deben ser números enteros entre 0 y 2.000.000.');
    end if;
    insert into public.fuel_sales (company_id, sold_on, retail_l, flota_l, kerosene_l, entered_by, entered_by_name)
    values (p_company_id, v_day, coalesce(v_r, 0), coalesce(v_f, 0), coalesce(v_k, 0), a.user_id, a.user_name)
    on conflict (company_id, sold_on) do update
      set retail_l = coalesce(v_r, public.fuel_sales.retail_l),
          flota_l = coalesce(v_f, public.fuel_sales.flota_l),
          kerosene_l = coalesce(v_k, public.fuel_sales.kerosene_l),
          entered_by = excluded.entered_by, entered_by_name = excluded.entered_by_name, updated_at = now();
    v_n := v_n + 1;
    v_min := least(coalesce(v_min, v_day), v_day);
    v_max := greatest(coalesce(v_max, v_day), v_day);
  end loop;

  perform public.inv_log(p_company_id, 'fuel.import', 'company', p_company_id,
    jsonb_build_object('days', v_n, 'from', v_min, 'to', v_max));
  return jsonb_build_object('days', v_n, 'from', v_min, 'to', v_max);
end;
$$;
revoke all on function public.fuel_sales_import(uuid, jsonb) from public, anon;
grant execute on function public.fuel_sales_import(uuid, jsonb) to authenticated;
