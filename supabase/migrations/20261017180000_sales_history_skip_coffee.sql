-- Historial de ventas: los códigos de máquinas de café no se guardan.
--
-- Cambia sales_history_save (creada en 20261017120000_sales_history.sql): omite los códigos del POS que
-- pertenecen a una máquina de café, porque el café se cuadra en «Máquinas de café» con el numeral y no
-- forma parte de la página de ventas. Devuelve además cuántas líneas omitió ('coffee').
--
-- Reversión: volver a ejecutar la definición de 20261017120000_sales_history.sql.

create or replace function public.sales_history_save(p_company_id uuid, p_lines jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
  l record;
  v_p public.inv_products;
  v_area text;
  v_old public.sales_history;
  v_today date := (now() at time zone 'America/Santiago')::date;
  v_saved integer := 0;
  v_updated integer := 0;
  v_same integer := 0;
  v_no_product integer := 0;
  v_no_access integer := 0;
  v_coffee integer := 0;
begin
  select * into a from public.inv_actor(p_company_id);
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    perform public.inv_fail('lines_required', 'El archivo no tiene ventas para guardar.');
  end if;
  if jsonb_array_length(p_lines) > 3000 then
    perform public.inv_fail('too_many_lines', 'El archivo tiene demasiadas líneas. Sube un período más corto.');
  end if;

  for l in
    select (e->>'date')::date as sold_on, trim(e->>'code') as code,
           sum((e->>'qty')::integer) as qty, sum(coalesce(nullif(e->>'amount', '')::numeric, 0)) as amount
    from jsonb_array_elements(p_lines) e
    group by 1, 2
    order by 1, 2
  loop
    if l.sold_on is null or l.code is null or l.code = '' or l.qty is null or l.qty <= 0 or l.amount < 0 then
      perform public.inv_fail('invalid_line', 'Hay una línea de ventas con fecha, código, cantidad o monto no válidos.');
    end if;
    if l.sold_on > v_today then
      perform public.inv_fail('invalid_date', 'El archivo trae ventas con fecha futura.');
    end if;

    -- Los cafés se cuadran aparte (Máquinas de café): no entran al historial de ventas.
    if exists (select 1 from public.coffee_machine_codes c where c.company_id = p_company_id and c.pos_code = l.code) then
      v_coffee := v_coffee + 1; continue;
    end if;

    select * into v_p from public.inv_products where company_id = p_company_id and code = l.code and active;
    if not found then v_no_product := v_no_product + 1; continue; end if;
    select i.area into v_area from public.inv_inventories i where i.id = v_p.inventory_id and i.active;
    if v_area is null or (a.role <> 'ADMIN' and v_area is distinct from a.area) then
      v_no_access := v_no_access + 1; continue;
    end if;

    select * into v_old from public.sales_history
    where company_id = p_company_id and sold_on = l.sold_on and pos_code = l.code;
    if found then
      if v_old.qty = l.qty and v_old.amount = round(l.amount) then v_same := v_same + 1; continue; end if;
      update public.sales_history set qty = l.qty, amount = round(l.amount), inventory_id = v_p.inventory_id, updated_at = now()
      where id = v_old.id;
      v_updated := v_updated + 1;
    else
      insert into public.sales_history (company_id, inventory_id, sold_on, pos_code, qty, amount, created_by, created_by_name)
      values (p_company_id, v_p.inventory_id, l.sold_on, l.code, l.qty, round(l.amount), a.user_id, a.user_name);
      v_saved := v_saved + 1;
    end if;
  end loop;

  return jsonb_build_object('saved', v_saved, 'updated', v_updated, 'unchanged', v_same,
    'no_product', v_no_product, 'no_access', v_no_access, 'coffee', v_coffee);
end;
$$;
revoke all on function public.sales_history_save(uuid, jsonb) from public, anon;
grant execute on function public.sales_history_save(uuid, jsonb) to authenticated;
