-- Revierte: vuelve a la versión sin fecha (los saldos ya cargados con fecha se conservan).
drop function if exists public.inv_register_opening(uuid, uuid, jsonb, date);

create function public.inv_register_opening(p_request_id uuid, p_inventory_id uuid, p_lines jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.inv_inventories;
  v_replay jsonb;
  l jsonb;
  v_p public.inv_products;
  v_loc uuid;
  v_lot uuid;
  v_qty integer;
  v_n integer := 0;
  v_result jsonb;
begin
  v_inv := public.inv_load_inventory(p_inventory_id, true);
  v_replay := public.inv_idem_begin(v_inv.company_id, p_request_id, 'opening');
  if v_replay is not null then return v_replay; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    perform public.inv_fail('lines_required', 'Agrega al menos un producto.');
  end if;

  for l in select * from jsonb_array_elements(p_lines) loop
    select * into v_p from public.inv_products
    where id = (l->>'product_id')::uuid and inventory_id = v_inv.id and active;
    if not found then perform public.inv_fail('invalid_product', 'Hay un producto que no pertenece a este inventario.'); end if;
    v_qty := (l->>'qty')::integer;
    if v_qty is null or v_qty <= 0 then perform public.inv_fail('invalid_qty', 'La cantidad debe ser mayor que cero.'); end if;
    v_loc := coalesce(nullif(l->>'location_id', '')::uuid, v_p.default_location_id,
      (select id from public.inv_locations where inventory_id = v_inv.id and active order by created_at limit 1));
    if not exists (select 1 from public.inv_locations where id = v_loc and inventory_id = v_inv.id and active) then
      perform public.inv_fail('invalid_location', 'La ubicación no pertenece a este inventario.');
    end if;
    v_lot := null;
    if v_p.tracks_expiry then
      if nullif(l->>'expires_on', '') is null then
        perform public.inv_fail('expiry_required', 'El producto ' || v_p.name || ' necesita fecha de vencimiento.');
      end if;
      v_lot := public.inv_get_lot(v_inv.company_id, v_inv.id, v_p.id,
        coalesce(nullif(trim(l->>'lot_code'), ''), 'SALDO-' || to_char((l->>'expires_on')::date, 'YYMMDD')),
        (l->>'expires_on')::date);
    end if;
    perform public.inv_post_movement(v_inv.company_id, v_inv.id, v_p.id, v_loc, v_lot, 'opening', v_qty,
      'Saldo inicial', nullif(l->>'note', ''), null, null, null, null, null, p_request_id);
    v_n := v_n + 1;
  end loop;

  perform public.inv_log(v_inv.company_id, 'opening.register', 'inventory', v_inv.id, jsonb_build_object('lines', v_n));
  v_result := jsonb_build_object('movements', v_n);
  return public.inv_idem_end(v_inv.company_id, p_request_id, v_result);
end;
$$;

revoke all on function public.inv_register_opening(uuid, uuid, jsonb) from public, anon;
grant execute on function public.inv_register_opening(uuid, uuid, jsonb) to authenticated;
