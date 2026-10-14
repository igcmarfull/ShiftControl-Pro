-- Inventarios: funciones del servidor (escritura).
--
-- ESTADO: aplicada en producción con autorización expresa del propietario.
--
-- Los clientes no escriben en las tablas inv_*: llaman a estas funciones, que
-- - verifican empresa, rol y área en cada llamada (administrador, o jefatura
--   activa de la empresa cuya área sea la asignada al inventario);
-- - son transaccionales: o se aplica todo o no se aplica nada;
-- - son idempotentes: cada llamada trae un request_id y un reintento devuelve
--   el resultado ya guardado sin duplicar movimientos;
-- - dejan trazabilidad: movimientos inmutables y auditoría por usuario.
--
-- Errores de negocio: excepción con mensaje 'inv:<codigo>', HINT en español y
-- DETAIL con datos en JSON. Permiso denegado: SQLSTATE 42501.

-- ---------------------------------------------------------------------------
-- Auxiliares internas (no expuestas a los clientes)
-- ---------------------------------------------------------------------------

create function public.inv_fail(
  p_code text,
  p_message text,
  p_detail jsonb default null,
  p_errcode text default 'P0001'
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'inv:%', p_code
    using errcode = p_errcode, hint = p_message, detail = coalesce(p_detail::text, '{}');
end;
$$;

-- Persona que llama dentro de la empresa: administrador o jefatura activa.
create function public.inv_actor(p_company_id uuid)
returns table (user_id uuid, user_name text, role text, area text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role text;
  v_area text;
begin
  select m.role,
         case when m.role = 'CHIEF' then case when m.area = 'TIENDA' then 'TIENDA' else 'ISLA' end end
    into v_role, v_area
  from public.company_memberships m
  join public.companies c on c.id = m.company_id and c.active
  where m.company_id = p_company_id and m.user_id = v_uid and m.active;

  if v_uid is null or v_role is null then
    perform public.inv_fail('forbidden', 'No tienes acceso a esta empresa.', null, '42501');
  end if;

  return query
    select v_uid, (select p.display_name from public.profiles p where p.id = v_uid), v_role, v_area;
end;
$$;

-- Carga un inventario y comprueba que la persona pueda operarlo.
create function public.inv_load_inventory(p_inventory_id uuid, p_admin_only boolean default false)
returns public.inv_inventories
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_inv public.inv_inventories;
  a record;
begin
  select * into v_inv from public.inv_inventories where id = p_inventory_id;
  if not found then
    perform public.inv_fail('not_found', 'El inventario no existe.', null, '42501');
  end if;
  select * into a from public.inv_actor(v_inv.company_id);
  if p_admin_only and a.role <> 'ADMIN' then
    perform public.inv_fail('forbidden', 'Esta acción es solo del administrador.', null, '42501');
  end if;
  if a.role <> 'ADMIN' and v_inv.area is distinct from a.area then
    perform public.inv_fail('forbidden', 'Tu perfil no tiene asignado este inventario.', null, '42501');
  end if;
  if not v_inv.active then
    perform public.inv_fail('inactive_inventory', 'Este inventario está desactivado.');
  end if;
  return v_inv;
end;
$$;

-- Idempotencia: devuelve el resultado guardado si la solicitud ya se procesó.
create function public.inv_idem_begin(p_company_id uuid, p_request_id uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.inv_requests;
begin
  if p_request_id is null then
    perform public.inv_fail('request_required', 'Falta el identificador de la operación.');
  end if;
  insert into public.inv_requests (company_id, request_id, user_id, action)
  values (p_company_id, p_request_id, (select auth.uid()), p_action)
  on conflict do nothing;
  if found then
    return null;
  end if;
  -- Si otra transacción con el mismo request_id seguía abierta, el INSERT esperó a que terminara.
  select * into r from public.inv_requests where company_id = p_company_id and request_id = p_request_id;
  if r.user_id is distinct from (select auth.uid()) or r.action <> p_action then
    perform public.inv_fail('request_reuse', 'El identificador de la operación ya se usó para otra acción.');
  end if;
  return coalesce(r.result, '{}'::jsonb) || jsonb_build_object('replayed', true);
end;
$$;

create function public.inv_idem_end(p_company_id uuid, p_request_id uuid, p_result jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.inv_requests set result = p_result
  where company_id = p_company_id and request_id = p_request_id;
  return p_result;
end;
$$;

create function public.inv_log(
  p_company_id uuid, p_action text, p_entity text, p_entity_id uuid, p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
begin
  select * into a from public.inv_actor(p_company_id);
  insert into public.inv_audit (company_id, user_id, user_name, action, entity, entity_id, details)
  values (p_company_id, a.user_id, a.user_name, p_action, p_entity, p_entity_id, coalesce(p_details, '{}'::jsonb));
end;
$$;

-- Registra un movimiento. El stock se actualiza por trigger; si dejara el stock
-- en negativo, la base lo rechaza.
create function public.inv_post_movement(
  p_company_id uuid, p_inventory_id uuid, p_product_id uuid, p_location_id uuid, p_lot_id uuid,
  p_kind text, p_qty integer, p_reason text, p_note text, p_reference text,
  p_group_id uuid, p_receipt_id uuid, p_adjustment_id uuid, p_reverses_id uuid, p_request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
  v_id uuid;
  v_constraint text;
begin
  select * into a from public.inv_actor(p_company_id);
  begin
    insert into public.inv_movements (
      company_id, inventory_id, product_id, location_id, lot_id, kind, qty, reason, note, reference,
      group_id, receipt_id, adjustment_id, reverses_id, request_id, created_by, created_by_name
    ) values (
      p_company_id, p_inventory_id, p_product_id, p_location_id, p_lot_id, p_kind, p_qty, p_reason, p_note,
      p_reference, p_group_id, p_receipt_id, p_adjustment_id, p_reverses_id, p_request_id, a.user_id, a.user_name
    ) returning id into v_id;
  exception when check_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'inv_stock_qty_check' then
      perform public.inv_fail('insufficient_stock', 'No hay stock suficiente para este movimiento.');
    end if;
    raise;
  end;
  return v_id;
end;
$$;

-- Obtiene o crea un lote. Un mismo código de lote no puede tener dos vencimientos.
create function public.inv_get_lot(
  p_company_id uuid, p_inventory_id uuid, p_product_id uuid, p_lot_code text, p_expires_on date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lot public.inv_lots;
  a record;
begin
  select * into v_lot from public.inv_lots where product_id = p_product_id and lot_code = p_lot_code;
  if found then
    if v_lot.expires_on is distinct from p_expires_on then
      perform public.inv_fail(
        'lot_conflict', 'El lote ' || p_lot_code || ' ya existe con otro vencimiento.',
        jsonb_build_object('lot_code', p_lot_code, 'expires_on', v_lot.expires_on)
      );
    end if;
    return v_lot.id;
  end if;
  select * into a from public.inv_actor(p_company_id);
  insert into public.inv_lots (company_id, inventory_id, product_id, lot_code, expires_on, created_by)
  values (p_company_id, p_inventory_id, p_product_id, p_lot_code, p_expires_on, a.user_id)
  returning id into v_lot.id;
  return v_lot.id;
end;
$$;

-- Descuenta stock con lógica FEFO (primero vence, primero sale) y bloqueando las
-- filas de stock, de modo que dos salidas simultáneas nunca consuman lo mismo.
-- p_location_id nulo: recorre todas las ubicaciones (la predeterminada primero).
-- Si p_transfer_to no es nulo, cada tramo entra también en esa ubicación.
create function public.inv_consume(
  p_company_id uuid, p_inventory_id uuid, p_product_id uuid, p_location_id uuid, p_lot_id uuid,
  p_qty integer, p_kind text, p_reason text, p_note text, p_reference text,
  p_group_id uuid, p_transfer_to uuid, p_adjustment_id uuid, p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_default uuid;
  v_remaining integer := p_qty;
  v_take integer;
  r record;
  v_out jsonb := '[]'::jsonb;
begin
  select default_location_id into v_default from public.inv_products where id = p_product_id;

  for r in
    select s.id, s.location_id, s.lot_id, s.qty
    from public.inv_stock s
    left join public.inv_lots l on l.id = s.lot_id
    where s.product_id = p_product_id
      and s.qty > 0
      and (p_location_id is null or s.location_id = p_location_id)
      and (p_lot_id is null or s.lot_id = p_lot_id)
    order by (s.location_id is distinct from v_default), l.expires_on nulls last, l.created_at nulls last, s.id
    for update of s
  loop
    exit when v_remaining <= 0;
    v_take := least(r.qty, v_remaining);
    perform public.inv_post_movement(
      p_company_id, p_inventory_id, p_product_id, r.location_id, r.lot_id, p_kind, -v_take,
      p_reason, p_note, p_reference, p_group_id, null, p_adjustment_id, null, p_request_id
    );
    if p_transfer_to is not null then
      perform public.inv_post_movement(
        p_company_id, p_inventory_id, p_product_id, p_transfer_to, r.lot_id, 'transfer_in', v_take,
        p_reason, p_note, p_reference, p_group_id, null, null, null, p_request_id
      );
    end if;
    v_out := v_out || jsonb_build_object('location_id', r.location_id, 'lot_id', r.lot_id, 'qty', v_take);
    v_remaining := v_remaining - v_take;
  end loop;

  if v_remaining > 0 then
    perform public.inv_fail(
      'insufficient_stock',
      'No hay stock suficiente: disponible ' || (p_qty - v_remaining) || ', solicitado ' || p_qty || '.',
      jsonb_build_object('available', p_qty - v_remaining, 'requested', p_qty)
    );
  end if;
  return v_out;
end;
$$;

revoke all on function public.inv_fail(text, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.inv_actor(uuid) from public, anon, authenticated;
revoke all on function public.inv_load_inventory(uuid, boolean) from public, anon, authenticated;
revoke all on function public.inv_idem_begin(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.inv_idem_end(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.inv_log(uuid, text, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.inv_post_movement(uuid, uuid, uuid, uuid, uuid, text, integer, text, text, text, uuid, uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.inv_get_lot(uuid, uuid, uuid, text, date) from public, anon, authenticated;
revoke all on function public.inv_consume(uuid, uuid, uuid, uuid, uuid, integer, text, text, text, text, uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.inv_apply_stock() from public, anon, authenticated;
revoke all on function public.inv_block_change() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Activación y configuración (administrador)
-- ---------------------------------------------------------------------------

-- Crea los tres inventarios de la empresa con su asignación inicial de área
-- (Tienda y Cigarrillos: TIENDA; Lubricantes: ISLA) y ubicaciones básicas.
-- Es explícita e idempotente: sin llamarla, ninguna jefatura ve inventarios.
create function public.inv_setup(p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
  d record;
  v_inv public.inv_inventories;
  v_created text[] := '{}';
  v_loc text;
begin
  select * into a from public.inv_actor(p_company_id);
  if a.role <> 'ADMIN' then
    perform public.inv_fail('forbidden', 'Solo el administrador activa los inventarios.', null, '42501');
  end if;

  for d in
    select * from (values
      ('tienda', 'Tienda', 'TIENDA', 'unidad', array['Bodega', 'Sala de ventas', 'Refrigerador', 'Congelador']),
      ('cigarrillos', 'Cigarrillos', 'TIENDA', 'cajetilla', array['Vitrina de caja', 'Bodega']),
      ('lubricantes', 'Lubricantes', 'ISLA', 'envase', array['Estantería', 'Bodega'])
    ) as t(code, name, area, unit, locations)
  loop
    insert into public.inv_inventories (company_id, code, name, area, control_unit)
    values (p_company_id, d.code, d.name, d.area, d.unit)
    on conflict (company_id, code) do nothing
    returning * into v_inv;
    if found then
      v_created := v_created || d.code;
      foreach v_loc in array d.locations loop
        insert into public.inv_locations (company_id, inventory_id, name) values (p_company_id, v_inv.id, v_loc);
      end loop;
    end if;
  end loop;

  if array_length(v_created, 1) > 0 then
    perform public.inv_log(p_company_id, 'inventory.setup', 'inventory', null, jsonb_build_object('created', v_created));
  end if;

  return jsonb_build_object(
    'created', v_created,
    'inventories', (select coalesce(jsonb_agg(to_jsonb(i) order by i.code), '[]'::jsonb)
                    from public.inv_inventories i where i.company_id = p_company_id)
  );
end;
$$;

create function public.inv_update_inventory(p_inventory_id uuid, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.inv_inventories;
  v_new public.inv_inventories;
begin
  select * into v_inv from public.inv_inventories where id = p_inventory_id for update;
  if not found then
    perform public.inv_fail('not_found', 'El inventario no existe.', null, '42501');
  end if;
  if not public.is_company_admin(v_inv.company_id) then
    perform public.inv_fail('forbidden', 'Solo el administrador configura los inventarios.', null, '42501');
  end if;
  if p_patch ? 'area' and (p_patch->>'area') not in ('TIENDA', 'ISLA') then
    perform public.inv_fail('invalid_area', 'El área debe ser TIENDA o ISLA.');
  end if;

  update public.inv_inventories i
  set name = coalesce(nullif(trim(p_patch->>'name'), ''), i.name),
      area = coalesce(p_patch->>'area', i.area),
      expiry_alert_days = coalesce((p_patch->>'expiry_alert_days')::integer, i.expiry_alert_days),
      auto_approve_max_abs = coalesce((p_patch->>'auto_approve_max_abs')::integer, i.auto_approve_max_abs),
      active = coalesce((p_patch->>'active')::boolean, i.active)
  where i.id = p_inventory_id
  returning * into v_new;

  perform public.inv_log(v_inv.company_id, 'inventory.update', 'inventory', v_inv.id,
    jsonb_build_object('before', to_jsonb(v_inv), 'after', to_jsonb(v_new)));
  return to_jsonb(v_new);
end;
$$;

create function public.inv_save_location(p_inventory_id uuid, p_location jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.inv_inventories;
  v_id uuid := nullif(p_location->>'id', '')::uuid;
  v_name text := trim(coalesce(p_location->>'name', ''));
  v_row public.inv_locations;
begin
  v_inv := public.inv_load_inventory(p_inventory_id, true);
  if v_name = '' then
    perform public.inv_fail('name_required', 'La ubicación necesita un nombre.');
  end if;
  begin
    if v_id is null then
      insert into public.inv_locations (company_id, inventory_id, name)
      values (v_inv.company_id, v_inv.id, v_name) returning * into v_row;
    else
      update public.inv_locations
      set name = v_name, active = coalesce((p_location->>'active')::boolean, active)
      where id = v_id and inventory_id = v_inv.id returning * into v_row;
      if not found then
        perform public.inv_fail('not_found', 'La ubicación no existe.');
      end if;
    end if;
  exception when unique_violation then
    perform public.inv_fail('duplicate_location', 'Ya existe una ubicación con ese nombre.');
  end;
  perform public.inv_log(v_inv.company_id, 'location.save', 'location', v_row.id, to_jsonb(v_row));
  return to_jsonb(v_row);
end;
$$;

-- ---------------------------------------------------------------------------
-- Catálogo (administrador)
-- ---------------------------------------------------------------------------

create function public.inv_save_product(p_inventory_id uuid, p_product jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.inv_inventories;
  a record;
  v_id uuid := nullif(p_product->>'id', '')::uuid;
  v_old public.inv_products;
  v_new public.inv_products;
  v_code text;
  v_name text;
  v_barcode text;
  v_category text;
  v_brand text;
  v_unit text;
  v_pres text;
  v_location uuid;
  v_min integer;
  v_tracks boolean;
  v_recv_unit text;
  v_factor integer;
  v_attrs jsonb;
  v_constraint text;
  v_has_moves boolean;
begin
  v_inv := public.inv_load_inventory(p_inventory_id, true);
  select * into a from public.inv_actor(v_inv.company_id);

  if v_id is not null then
    select * into v_old from public.inv_products where id = v_id and inventory_id = v_inv.id for update;
    if not found then
      perform public.inv_fail('not_found', 'El producto no existe.');
    end if;
    if (p_product->>'expected_version') is null or (p_product->>'expected_version')::integer <> v_old.version then
      perform public.inv_fail(
        'version_conflict', 'Otro usuario modificó este producto. Vuelve a cargarlo antes de guardar.',
        jsonb_build_object('current_version', v_old.version)
      );
    end if;
  end if;

  -- Un campo que no viene en el JSON conserva su valor actual (o el valor por defecto al crear).
  v_code := trim(case when p_product ? 'code' then coalesce(p_product->>'code', '') else coalesce(v_old.code, '') end);
  v_name := trim(case when p_product ? 'name' then coalesce(p_product->>'name', '') else coalesce(v_old.name, '') end);
  v_barcode := nullif(trim(case when p_product ? 'barcode' then coalesce(p_product->>'barcode', '') else coalesce(v_old.barcode, '') end), '');
  v_category := trim(case when p_product ? 'category' then coalesce(p_product->>'category', '') else coalesce(v_old.category, '') end);
  v_brand := trim(case when p_product ? 'brand' then coalesce(p_product->>'brand', '') else coalesce(v_old.brand, '') end);
  v_unit := trim(case when p_product ? 'control_unit' then coalesce(p_product->>'control_unit', '')
                      else coalesce(v_old.control_unit, v_inv.control_unit) end);
  if v_unit = '' then v_unit := coalesce(v_old.control_unit, v_inv.control_unit); end if;
  v_pres := trim(case when p_product ? 'presentation' then coalesce(p_product->>'presentation', '') else coalesce(v_old.presentation, '') end);
  v_location := case when p_product ? 'default_location_id' then nullif(p_product->>'default_location_id', '')::uuid
                     else v_old.default_location_id end;
  v_min := case when p_product ? 'min_stock' then coalesce((p_product->>'min_stock')::integer, 0) else coalesce(v_old.min_stock, 0) end;
  v_tracks := case when p_product ? 'tracks_expiry' then coalesce((p_product->>'tracks_expiry')::boolean, false)
                   else coalesce(v_old.tracks_expiry, false) end;
  v_recv_unit := nullif(trim(case when p_product ? 'receive_unit' then coalesce(p_product->>'receive_unit', '')
                                  else coalesce(v_old.receive_unit, '') end), '');
  v_factor := case when p_product ? 'receive_factor' then coalesce((p_product->>'receive_factor')::integer, 1)
                   else coalesce(v_old.receive_factor, 1) end;
  v_attrs := case when p_product ? 'attrs' then coalesce(p_product->'attrs', '{}'::jsonb) else coalesce(v_old.attrs, '{}'::jsonb) end;

  if v_code = '' then perform public.inv_fail('code_required', 'El producto necesita un código.'); end if;
  if v_name = '' then perform public.inv_fail('name_required', 'El producto necesita una descripción.'); end if;
  if v_min < 0 then perform public.inv_fail('invalid_min', 'El stock mínimo no puede ser negativo.'); end if;
  if v_factor < 1 then perform public.inv_fail('invalid_factor', 'El factor de conversión debe ser al menos 1.'); end if;
  if jsonb_typeof(v_attrs) <> 'object' then perform public.inv_fail('invalid_attrs', 'Los campos específicos no son válidos.'); end if;
  if v_location is not null and not exists (
    select 1 from public.inv_locations where id = v_location and inventory_id = v_inv.id and active
  ) then
    perform public.inv_fail('invalid_location', 'La ubicación no pertenece a este inventario.');
  end if;

  if v_id is null then
    begin
      insert into public.inv_products (
        company_id, inventory_id, code, barcode, name, category, brand, control_unit, presentation,
        default_location_id, min_stock, tracks_expiry, receive_unit, receive_factor, attrs, created_by, created_by_name
      ) values (
        v_inv.company_id, v_inv.id, v_code, v_barcode, v_name, v_category, v_brand, v_unit, v_pres,
        v_location, v_min, v_tracks, v_recv_unit, v_factor, v_attrs, a.user_id, a.user_name
      ) returning * into v_new;
    exception when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'inv_products_barcode_key' then
        perform public.inv_fail('duplicate_barcode', 'Ese código de barras ya existe en el inventario ' || v_inv.name || '.');
      end if;
      perform public.inv_fail('duplicate_code', 'Ese código ya existe en el inventario ' || v_inv.name || '.');
    end;
    perform public.inv_log(v_inv.company_id, 'product.create', 'product', v_new.id, to_jsonb(v_new));
    return to_jsonb(v_new);
  end if;

  select exists (select 1 from public.inv_movements where product_id = v_old.id) into v_has_moves;
  if v_has_moves and (v_unit <> v_old.control_unit or v_pres <> v_old.presentation) then
    perform public.inv_fail(
      'locked_field',
      'La unidad de control y la presentación no se cambian cuando el producto ya tiene movimientos. Crea un producto nuevo.'
    );
  end if;

  begin
    update public.inv_products p
    set code = v_code, barcode = v_barcode, name = v_name, category = v_category, brand = v_brand,
        control_unit = v_unit, presentation = v_pres, default_location_id = v_location, min_stock = v_min,
        tracks_expiry = v_tracks, receive_unit = v_recv_unit, receive_factor = v_factor, attrs = v_attrs,
        version = p.version + 1
    where p.id = v_old.id
    returning * into v_new;
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'inv_products_barcode_key' then
      perform public.inv_fail('duplicate_barcode', 'Ese código de barras ya existe en el inventario ' || v_inv.name || '.');
    end if;
    perform public.inv_fail('duplicate_code', 'Ese código ya existe en el inventario ' || v_inv.name || '.');
  end;
  perform public.inv_log(v_inv.company_id, 'product.update', 'product', v_new.id,
    jsonb_build_object('before', to_jsonb(v_old), 'after', to_jsonb(v_new)));
  return to_jsonb(v_new);
end;
$$;

create function public.inv_set_product_active(p_product_id uuid, p_active boolean, p_expected_version integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.inv_products;
  v_new public.inv_products;
  v_stock integer;
begin
  select * into v_p from public.inv_products where id = p_product_id for update;
  if not found then
    perform public.inv_fail('not_found', 'El producto no existe.', null, '42501');
  end if;
  perform public.inv_load_inventory(v_p.inventory_id, true);
  if p_expected_version is distinct from v_p.version then
    perform public.inv_fail('version_conflict', 'Otro usuario modificó este producto. Vuelve a cargarlo.',
      jsonb_build_object('current_version', v_p.version));
  end if;
  if not p_active then
    select coalesce(sum(qty), 0) into v_stock from public.inv_stock where product_id = v_p.id;
    if v_stock > 0 then
      perform public.inv_fail(
        'has_stock', 'No se puede desactivar un producto con stock (' || v_stock || '). Registra antes la salida o el ajuste.',
        jsonb_build_object('stock', v_stock)
      );
    end if;
  end if;
  update public.inv_products set active = p_active, version = version + 1 where id = v_p.id returning * into v_new;
  perform public.inv_log(v_p.company_id, case when p_active then 'product.activate' else 'product.deactivate' end,
    'product', v_p.id, jsonb_build_object('code', v_p.code));
  return to_jsonb(v_new);
end;
$$;

-- ---------------------------------------------------------------------------
-- Movimientos
-- ---------------------------------------------------------------------------

-- Saldo inicial al poner en marcha un inventario (administrador).
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

-- Recepción de mercadería. Es un registro distinto de la factura: recibir no
-- aprueba ni paga nada, y una factura no implica que todo llegó.
create function public.inv_receive(p_request_id uuid, p_inventory_id uuid, p_header jsonb, p_lines jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.inv_inventories;
  a record;
  v_replay jsonb;
  v_receipt public.inv_receipts;
  v_supplier text := trim(coalesce(p_header->>'supplier', ''));
  v_doc text := trim(coalesce(p_header->>'document_no', ''));
  v_date date := coalesce(nullif(p_header->>'received_on', '')::date, (now() at time zone 'America/Santiago')::date);
  l jsonb;
  v_p public.inv_products;
  v_unit text;
  v_qty integer;
  v_factor integer;
  v_base integer;
  v_loc uuid;
  v_lot uuid;
  v_lot_code text;
  v_n integer := 0;
  v_result jsonb;
begin
  v_inv := public.inv_load_inventory(p_inventory_id);
  select * into a from public.inv_actor(v_inv.company_id);
  v_replay := public.inv_idem_begin(v_inv.company_id, p_request_id, 'receive');
  if v_replay is not null then return v_replay; end if;

  if v_supplier = '' then perform public.inv_fail('supplier_required', 'Indica el proveedor.'); end if;
  if v_doc = '' then perform public.inv_fail('document_required', 'Indica el número de factura o documento.'); end if;
  if v_date > (now() at time zone 'America/Santiago')::date + 1 then
    perform public.inv_fail('invalid_date', 'La fecha de recepción no puede ser futura.');
  end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    perform public.inv_fail('lines_required', 'Agrega al menos un producto recibido.');
  end if;

  begin
    insert into public.inv_receipts (
      company_id, inventory_id, supplier, received_on, document_no, invoice_ref, notes,
      received_by, received_by_name, request_id
    ) values (
      v_inv.company_id, v_inv.id, v_supplier, v_date, v_doc, nullif(trim(coalesce(p_header->>'invoice_ref', '')), ''),
      nullif(trim(coalesce(p_header->>'notes', '')), ''), a.user_id, a.user_name, p_request_id
    ) returning * into v_receipt;
  exception when unique_violation then
    perform public.inv_fail('duplicate_receipt',
      'Ya existe una recepción de ' || v_supplier || ' con el documento ' || v_doc || '. No se duplica.');
  end;

  for l in select * from jsonb_array_elements(p_lines) loop
    select * into v_p from public.inv_products
    where id = (l->>'product_id')::uuid and inventory_id = v_inv.id and active;
    if not found then perform public.inv_fail('invalid_product', 'Hay un producto que no pertenece a este inventario o está inactivo.'); end if;
    v_qty := (l->>'qty')::integer;
    if v_qty is null or v_qty <= 0 then perform public.inv_fail('invalid_qty', 'Las cantidades deben ser mayores que cero.'); end if;
    v_unit := coalesce(nullif(l->>'unit', ''), 'base');
    if v_unit not in ('base', 'purchase') then perform public.inv_fail('invalid_unit', 'Unidad de recepción no válida.'); end if;
    if v_unit = 'purchase' and v_p.receive_unit is null then
      perform public.inv_fail('no_purchase_unit', v_p.name || ' no tiene una unidad de recepción configurada.');
    end if;
    v_factor := case when v_unit = 'purchase' then v_p.receive_factor else 1 end;
    v_base := v_qty * v_factor;

    v_loc := coalesce(nullif(l->>'location_id', '')::uuid, v_p.default_location_id,
      (select id from public.inv_locations where inventory_id = v_inv.id and active order by created_at limit 1));
    if not exists (select 1 from public.inv_locations where id = v_loc and inventory_id = v_inv.id and active) then
      perform public.inv_fail('invalid_location', 'La ubicación no pertenece a este inventario.');
    end if;

    v_lot := null;
    if v_p.tracks_expiry then
      if nullif(l->>'expires_on', '') is null then
        perform public.inv_fail('expiry_required', v_p.name || ' necesita fecha de vencimiento.');
      end if;
      v_lot_code := coalesce(nullif(trim(l->>'lot_code'), ''), 'L' || to_char(v_date, 'YYMMDD') || '-' || upper(left(regexp_replace(v_doc, '[^A-Za-z0-9]', '', 'g'), 8)));
      v_lot := public.inv_get_lot(v_inv.company_id, v_inv.id, v_p.id, v_lot_code, (l->>'expires_on')::date);
    end if;

    insert into public.inv_receipt_lines (
      company_id, inventory_id, receipt_id, product_id, location_id, lot_id, qty_input, input_unit, factor_applied, qty_base
    ) values (v_inv.company_id, v_inv.id, v_receipt.id, v_p.id, v_loc, v_lot, v_qty, v_unit, v_factor, v_base);

    perform public.inv_post_movement(
      v_inv.company_id, v_inv.id, v_p.id, v_loc, v_lot, 'receipt', v_base, null,
      case when v_unit = 'purchase' then v_qty || ' ' || v_p.receive_unit || ' × ' || v_factor else null end,
      v_doc, v_receipt.id, v_receipt.id, null, null, p_request_id
    );
    v_n := v_n + 1;
  end loop;

  perform public.inv_log(v_inv.company_id, 'receipt.create', 'receipt', v_receipt.id,
    jsonb_build_object('supplier', v_supplier, 'document_no', v_doc, 'lines', v_n));
  v_result := jsonb_build_object('receipt_id', v_receipt.id, 'lines', v_n);
  return public.inv_idem_end(v_inv.company_id, p_request_id, v_result);
end;
$$;

-- Salida manual justificada o merma (FEFO si el producto vence).
create function public.inv_issue(
  p_request_id uuid, p_product_id uuid, p_qty integer, p_kind text, p_reason text, p_note text,
  p_location_id uuid default null, p_lot_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.inv_products;
  v_inv public.inv_inventories;
  v_replay jsonb;
  v_reason text := trim(coalesce(p_reason, ''));
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_parts jsonb;
  v_result jsonb;
begin
  select * into v_p from public.inv_products where id = p_product_id;
  if not found then perform public.inv_fail('not_found', 'El producto no existe.', null, '42501'); end if;
  v_inv := public.inv_load_inventory(v_p.inventory_id);
  v_replay := public.inv_idem_begin(v_inv.company_id, p_request_id, 'issue');
  if v_replay is not null then return v_replay; end if;

  if p_kind not in ('issue', 'waste') then perform public.inv_fail('invalid_kind', 'Tipo de movimiento no válido.'); end if;
  if p_qty is null or p_qty <= 0 then perform public.inv_fail('invalid_qty', 'La cantidad debe ser mayor que cero.'); end if;
  if v_reason = '' then perform public.inv_fail('reason_required', 'Indica el motivo.'); end if;
  if p_kind = 'waste' and v_reason not in ('Vencimiento', 'Daño', 'Manipulación', 'Otra causa justificada') then
    perform public.inv_fail('invalid_reason', 'Motivo de merma no válido.');
  end if;
  if (p_kind = 'issue' or v_reason = 'Otra causa justificada') and v_note is null then
    perform public.inv_fail('note_required', 'Explica la justificación en la observación.');
  end if;
  if not v_p.active then perform public.inv_fail('inactive_product', 'El producto está inactivo.'); end if;
  if p_location_id is not null and not exists (
    select 1 from public.inv_locations where id = p_location_id and inventory_id = v_inv.id
  ) then
    perform public.inv_fail('invalid_location', 'La ubicación no pertenece a este inventario.');
  end if;

  v_parts := public.inv_consume(
    v_inv.company_id, v_inv.id, v_p.id, p_location_id, p_lot_id, p_qty, p_kind, v_reason, v_note, null,
    gen_random_uuid(), null, null, p_request_id
  );
  perform public.inv_log(v_inv.company_id, 'movement.' || p_kind, 'product', v_p.id,
    jsonb_build_object('qty', p_qty, 'reason', v_reason));
  v_result := jsonb_build_object('product_id', v_p.id, 'qty', p_qty, 'parts', v_parts);
  return public.inv_idem_end(v_inv.company_id, p_request_id, v_result);
end;
$$;

-- Traslado entre ubicaciones del mismo inventario: no cambia el stock total.
create function public.inv_transfer(
  p_request_id uuid, p_product_id uuid, p_from_location uuid, p_to_location uuid, p_qty integer, p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.inv_products;
  v_inv public.inv_inventories;
  v_replay jsonb;
  v_parts jsonb;
  v_result jsonb;
begin
  select * into v_p from public.inv_products where id = p_product_id;
  if not found then perform public.inv_fail('not_found', 'El producto no existe.', null, '42501'); end if;
  v_inv := public.inv_load_inventory(v_p.inventory_id);
  v_replay := public.inv_idem_begin(v_inv.company_id, p_request_id, 'transfer');
  if v_replay is not null then return v_replay; end if;

  if p_qty is null or p_qty <= 0 then perform public.inv_fail('invalid_qty', 'La cantidad debe ser mayor que cero.'); end if;
  if p_from_location is null or p_to_location is null or p_from_location = p_to_location then
    perform public.inv_fail('invalid_location', 'Elige dos ubicaciones distintas.');
  end if;
  if (select count(*) from public.inv_locations
      where id in (p_from_location, p_to_location) and inventory_id = v_inv.id and active) <> 2 then
    perform public.inv_fail('invalid_location', 'Las ubicaciones no pertenecen a este inventario.');
  end if;

  v_parts := public.inv_consume(
    v_inv.company_id, v_inv.id, v_p.id, p_from_location, null, p_qty, 'transfer_out', 'Traslado',
    nullif(trim(coalesce(p_note, '')), ''), null, gen_random_uuid(), p_to_location, null, p_request_id
  );
  perform public.inv_log(v_inv.company_id, 'movement.transfer', 'product', v_p.id,
    jsonb_build_object('qty', p_qty, 'from', p_from_location, 'to', p_to_location));
  v_result := jsonb_build_object('product_id', v_p.id, 'qty', p_qty, 'parts', v_parts);
  return public.inv_idem_end(v_inv.company_id, p_request_id, v_result);
end;
$$;

-- ---------------------------------------------------------------------------
-- Conteos físicos y ajustes
-- ---------------------------------------------------------------------------

-- Abre el conteo del inventario (o devuelve el que ya está en curso).
create function public.inv_count_start(p_inventory_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.inv_inventories;
  a record;
  v_count public.inv_counts;
begin
  v_inv := public.inv_load_inventory(p_inventory_id);
  select * into a from public.inv_actor(v_inv.company_id);
  select * into v_count from public.inv_counts where inventory_id = v_inv.id and status = 'in_progress';
  if not found then
    begin
      insert into public.inv_counts (company_id, inventory_id, started_by, started_by_name)
      values (v_inv.company_id, v_inv.id, a.user_id, a.user_name) returning * into v_count;
      perform public.inv_log(v_inv.company_id, 'count.start', 'count', v_count.id, '{}'::jsonb);
    exception when unique_violation then
      select * into v_count from public.inv_counts where inventory_id = v_inv.id and status = 'in_progress';
    end;
  end if;
  return public.inv_count_snapshot(v_count.id);
end;
$$;

-- Estado de un conteo SIN el stock esperado (conteo ciego).
create function public.inv_count_snapshot(p_count_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', c.id, 'inventory_id', c.inventory_id, 'status', c.status,
    'started_by', c.started_by_name, 'started_at', c.started_at,
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_id', cl.product_id, 'counted_qty', cl.counted_qty, 'note', cl.note,
        'counted_by', cl.counted_by_name, 'counted_at', cl.counted_at) order by cl.counted_at)
      from public.inv_count_lines cl where cl.count_id = c.id and cl.counted_qty is not null
    ), '[]'::jsonb)
  )
  from public.inv_counts c where c.id = p_count_id;
$$;

-- Guarda cantidades contadas (parcial y repetible). Si otra persona ya contó el
-- mismo producto después de la lectura del cliente (since), no lo pisa: lo informa.
create function public.inv_count_save(p_count_id uuid, p_lines jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count public.inv_counts;
  a record;
  l jsonb;
  v_pid uuid;
  v_qty integer;
  v_since timestamptz;
  v_cur public.inv_count_lines;
  v_saved integer := 0;
  v_conflicts jsonb := '[]'::jsonb;
begin
  select * into v_count from public.inv_counts where id = p_count_id for update;
  if not found then perform public.inv_fail('not_found', 'El conteo no existe.', null, '42501'); end if;
  perform public.inv_load_inventory(v_count.inventory_id);
  select * into a from public.inv_actor(v_count.company_id);
  if v_count.status <> 'in_progress' then
    perform public.inv_fail('count_closed', 'Este conteo ya fue enviado.');
  end if;
  if jsonb_typeof(p_lines) <> 'array' then perform public.inv_fail('lines_required', 'Faltan las cantidades.'); end if;

  for l in select * from jsonb_array_elements(p_lines) loop
    v_pid := (l->>'product_id')::uuid;
    if not exists (select 1 from public.inv_products where id = v_pid and inventory_id = v_count.inventory_id and active) then
      perform public.inv_fail('invalid_product', 'Hay un producto que no pertenece a este inventario.');
    end if;
    v_qty := nullif(l->>'counted_qty', '')::integer;
    if v_qty is not null and v_qty < 0 then perform public.inv_fail('invalid_qty', 'La cantidad no puede ser negativa.'); end if;
    v_since := nullif(l->>'since', '')::timestamptz;

    select * into v_cur from public.inv_count_lines where count_id = v_count.id and product_id = v_pid for update;
    if found and v_cur.counted_qty is not null and v_cur.counted_by is distinct from a.user_id
       and (v_since is null or v_cur.counted_at > v_since) then
      v_conflicts := v_conflicts || jsonb_build_object(
        'product_id', v_pid, 'counted_qty', v_cur.counted_qty, 'counted_by', v_cur.counted_by_name,
        'counted_at', v_cur.counted_at);
      continue;
    end if;

    insert into public.inv_count_lines (company_id, inventory_id, count_id, product_id, counted_qty, note, counted_by, counted_by_name, counted_at)
    values (v_count.company_id, v_count.inventory_id, v_count.id, v_pid, v_qty, nullif(trim(coalesce(l->>'note', '')), ''),
            a.user_id, a.user_name, now())
    on conflict (count_id, product_id) do update
      set counted_qty = excluded.counted_qty, note = excluded.note, counted_by = excluded.counted_by,
          counted_by_name = excluded.counted_by_name, counted_at = excluded.counted_at;
    v_saved := v_saved + 1;
  end loop;

  return jsonb_build_object('saved', v_saved, 'conflicts', v_conflicts, 'server_time', now());
end;
$$;

-- Envía el conteo. No modifica el stock: cada diferencia se convierte en un
-- ajuste pendiente de aprobación (o se aplica sola si cae bajo el umbral que el
-- administrador configuró para ese inventario; por defecto 0 = siempre revisa).
create function public.inv_count_submit(p_request_id uuid, p_count_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count public.inv_counts;
  v_inv public.inv_inventories;
  a record;
  v_replay jsonb;
  r record;
  v_expected integer;
  v_delta integer;
  v_adj public.inv_adjustments;
  v_exact integer := 0;
  v_pending integer := 0;
  v_auto integer := 0;
  v_missing jsonb := '[]'::jsonb;
  v_result jsonb;
begin
  select * into v_count from public.inv_counts where id = p_count_id for update;
  if not found then perform public.inv_fail('not_found', 'El conteo no existe.', null, '42501'); end if;
  v_inv := public.inv_load_inventory(v_count.inventory_id);
  select * into a from public.inv_actor(v_count.company_id);
  v_replay := public.inv_idem_begin(v_count.company_id, p_request_id, 'count_submit');
  if v_replay is not null then return v_replay; end if;
  if v_count.status <> 'in_progress' then
    perform public.inv_fail('count_closed', 'Este conteo ya fue enviado.');
  end if;

  -- Toda diferencia necesita una observación.
  for r in
    select cl.*, p.code, p.name,
           coalesce((select sum(s.qty) from public.inv_stock s where s.product_id = cl.product_id), 0)::integer as stock
    from public.inv_count_lines cl join public.inv_products p on p.id = cl.product_id
    where cl.count_id = v_count.id and cl.counted_qty is not null
  loop
    if r.counted_qty <> r.stock and r.note is null then
      v_missing := v_missing || jsonb_build_object('product_id', r.product_id, 'code', r.code, 'name', r.name);
    end if;
  end loop;
  if jsonb_array_length(v_missing) > 0 then
    perform public.inv_fail('note_required', 'Falta la observación en los productos con diferencia.',
      jsonb_build_object('products', v_missing));
  end if;

  for r in
    select cl.* from public.inv_count_lines cl
    where cl.count_id = v_count.id and cl.counted_qty is not null
    order by cl.product_id
    for update
  loop
    select coalesce(sum(s.qty), 0)::integer into v_expected from public.inv_stock s where s.product_id = r.product_id;
    v_delta := r.counted_qty - v_expected;
    update public.inv_count_lines set expected_qty = v_expected where id = r.id;
    if v_delta = 0 then
      v_exact := v_exact + 1;
    else
      insert into public.inv_adjustments (
        company_id, inventory_id, product_id, count_id, expected_qty, counted_qty, delta, note,
        requested_by, requested_by_name
      ) values (
        v_count.company_id, v_count.inventory_id, r.product_id, v_count.id, v_expected, r.counted_qty, v_delta, r.note,
        a.user_id, a.user_name
      ) returning * into v_adj;
      if abs(v_delta) <= v_inv.auto_approve_max_abs then
        perform public.inv_apply_adjustment(v_adj.id, p_request_id, 'Aprobado automáticamente por umbral del inventario', true);
        v_auto := v_auto + 1;
      else
        v_pending := v_pending + 1;
      end if;
    end if;
  end loop;

  update public.inv_counts
  set status = 'submitted', submitted_by = a.user_id, submitted_by_name = a.user_name, submitted_at = now()
  where id = v_count.id;

  perform public.inv_log(v_count.company_id, 'count.submit', 'count', v_count.id,
    jsonb_build_object('exact', v_exact, 'pending', v_pending, 'auto_approved', v_auto));
  v_result := jsonb_build_object('count_id', v_count.id, 'exact', v_exact, 'pending', v_pending, 'auto_approved', v_auto);
  return public.inv_idem_end(v_count.company_id, p_request_id, v_result);
end;
$$;

-- Aplica un ajuste aprobado como movimiento (el delta se compensa en FEFO si
-- resta, o entra a la ubicación predeterminada si suma).
create function public.inv_apply_adjustment(p_adjustment_id uuid, p_request_id uuid, p_note text, p_auto boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_adj public.inv_adjustments;
  v_p public.inv_products;
  a record;
  v_loc uuid;
begin
  select * into v_adj from public.inv_adjustments where id = p_adjustment_id for update;
  select * into v_p from public.inv_products where id = v_adj.product_id;
  select * into a from public.inv_actor(v_adj.company_id);

  if v_adj.delta > 0 then
    v_loc := coalesce(v_p.default_location_id,
      (select id from public.inv_locations where inventory_id = v_adj.inventory_id and active order by created_at limit 1));
    perform public.inv_post_movement(v_adj.company_id, v_adj.inventory_id, v_adj.product_id, v_loc, null, 'adjustment',
      v_adj.delta, 'Ajuste de conteo', v_adj.note, v_adj.count_id::text, v_adj.id, null, v_adj.id, null, p_request_id);
  else
    perform public.inv_consume(v_adj.company_id, v_adj.inventory_id, v_adj.product_id, null, null, -v_adj.delta,
      'adjustment', 'Ajuste de conteo', v_adj.note, v_adj.count_id::text, v_adj.id, null, v_adj.id, p_request_id);
  end if;

  update public.inv_adjustments
  set status = 'approved', reviewed_by = a.user_id, reviewed_by_name = a.user_name, reviewed_at = now(), review_note = p_note
  where id = v_adj.id;
end;
$$;

revoke all on function public.inv_apply_adjustment(uuid, uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.inv_count_snapshot(uuid) from public, anon, authenticated;

-- Aprobar o rechazar un ajuste. Solo el administrador; las jefaturas no aprueban.
create function public.inv_review_adjustment(p_request_id uuid, p_adjustment_id uuid, p_approve boolean, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_adj public.inv_adjustments;
  a record;
  v_replay jsonb;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_result jsonb;
begin
  select * into v_adj from public.inv_adjustments where id = p_adjustment_id for update;
  if not found then perform public.inv_fail('not_found', 'El ajuste no existe.', null, '42501'); end if;
  perform public.inv_load_inventory(v_adj.inventory_id, true);
  select * into a from public.inv_actor(v_adj.company_id);
  v_replay := public.inv_idem_begin(v_adj.company_id, p_request_id, 'adjustment_review');
  if v_replay is not null then return v_replay; end if;
  if v_adj.status <> 'pending' then
    perform public.inv_fail('already_reviewed', 'Este ajuste ya fue revisado.');
  end if;

  if p_approve then
    perform public.inv_apply_adjustment(v_adj.id, p_request_id, v_note, false);
  else
    if v_note is null then perform public.inv_fail('note_required', 'Explica por qué se rechaza el ajuste.'); end if;
    update public.inv_adjustments
    set status = 'rejected', reviewed_by = a.user_id, reviewed_by_name = a.user_name, reviewed_at = now(), review_note = v_note
    where id = v_adj.id;
  end if;

  perform public.inv_log(v_adj.company_id, case when p_approve then 'adjustment.approve' else 'adjustment.reject' end,
    'adjustment', v_adj.id, jsonb_build_object('delta', v_adj.delta, 'note', v_note));
  v_result := jsonb_build_object('adjustment_id', v_adj.id, 'status', case when p_approve then 'approved' else 'rejected' end);
  return public.inv_idem_end(v_adj.company_id, p_request_id, v_result);
end;
$$;

-- ---------------------------------------------------------------------------
-- Correcciones y anulaciones (administrador): siempre compensatorias
-- ---------------------------------------------------------------------------

-- Anula un movimiento con otro de signo contrario. Un traslado se anula completo.
-- Las recepciones se anulan con inv_void_receipt.
create function public.inv_reverse_movement(p_request_id uuid, p_movement_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m public.inv_movements;
  v_inv public.inv_inventories;
  v_replay jsonb;
  v_reason text := trim(coalesce(p_reason, ''));
  r public.inv_movements;
  v_n integer := 0;
  v_result jsonb;
begin
  select * into v_m from public.inv_movements where id = p_movement_id;
  if not found then perform public.inv_fail('not_found', 'El movimiento no existe.', null, '42501'); end if;
  v_inv := public.inv_load_inventory(v_m.inventory_id, true);
  v_replay := public.inv_idem_begin(v_m.company_id, p_request_id, 'reverse');
  if v_replay is not null then return v_replay; end if;
  if v_reason = '' then perform public.inv_fail('reason_required', 'Indica el motivo de la corrección.'); end if;
  if v_m.kind in ('reversal', 'opening') then
    perform public.inv_fail('not_reversible', 'Este tipo de movimiento no se anula; registra un ajuste.');
  end if;
  if v_m.kind = 'receipt' then
    perform public.inv_fail('use_void_receipt', 'Las recepciones se anulan completas desde la recepción.');
  end if;

  for r in
    select * from public.inv_movements
    where (id = v_m.id or (v_m.kind in ('transfer_out', 'transfer_in') and group_id = v_m.group_id))
    order by qty desc
    for update
  loop
    if exists (select 1 from public.inv_movements where reverses_id = r.id) then
      perform public.inv_fail('already_reversed', 'Este movimiento ya fue corregido.');
    end if;
    -- Primero se anula la salida lógica inversa para no dejar stock negativo en el medio.
    perform public.inv_post_movement(r.company_id, r.inventory_id, r.product_id, r.location_id, r.lot_id, 'reversal',
      -r.qty, 'Corrección: ' || v_reason, 'Anula ' || r.id::text, r.reference, r.group_id, r.receipt_id, r.adjustment_id, r.id, p_request_id);
    v_n := v_n + 1;
  end loop;

  perform public.inv_log(v_m.company_id, 'movement.reverse', 'movement', v_m.id, jsonb_build_object('reason', v_reason, 'reversed', v_n));
  v_result := jsonb_build_object('movement_id', v_m.id, 'reversed', v_n);
  return public.inv_idem_end(v_m.company_id, p_request_id, v_result);
end;
$$;

create function public.inv_void_receipt(p_request_id uuid, p_receipt_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.inv_receipts;
  v_replay jsonb;
  v_reason text := trim(coalesce(p_reason, ''));
  m public.inv_movements;
  a record;
  v_n integer := 0;
  v_result jsonb;
begin
  select * into v_r from public.inv_receipts where id = p_receipt_id for update;
  if not found then perform public.inv_fail('not_found', 'La recepción no existe.', null, '42501'); end if;
  perform public.inv_load_inventory(v_r.inventory_id, true);
  select * into a from public.inv_actor(v_r.company_id);
  v_replay := public.inv_idem_begin(v_r.company_id, p_request_id, 'void_receipt');
  if v_replay is not null then return v_replay; end if;
  if v_reason = '' then perform public.inv_fail('reason_required', 'Indica el motivo de la anulación.'); end if;
  if v_r.status <> 'confirmed' then perform public.inv_fail('already_voided', 'Esta recepción ya fue anulada.'); end if;

  for m in
    select * from public.inv_movements where receipt_id = v_r.id and kind = 'receipt' order by id for update
  loop
    perform public.inv_post_movement(m.company_id, m.inventory_id, m.product_id, m.location_id, m.lot_id, 'reversal',
      -m.qty, 'Anulación de recepción: ' || v_reason, 'Anula ' || m.id::text, v_r.document_no, m.group_id, v_r.id, null, m.id, p_request_id);
    v_n := v_n + 1;
  end loop;

  update public.inv_receipts
  set status = 'voided', voided_by = a.user_id, voided_by_name = a.user_name, voided_at = now(), void_reason = v_reason
  where id = v_r.id;

  perform public.inv_log(v_r.company_id, 'receipt.void', 'receipt', v_r.id, jsonb_build_object('reason', v_reason, 'reversed', v_n));
  v_result := jsonb_build_object('receipt_id', v_r.id, 'reversed', v_n);
  return public.inv_idem_end(v_r.company_id, p_request_id, v_result);
end;
$$;

-- ---------------------------------------------------------------------------
-- Permisos de ejecución: solo usuarios autenticados (la función valida el resto)
-- ---------------------------------------------------------------------------

do $$
declare
  f text;
begin
  foreach f in array array[
    'inv_setup(uuid)',
    'inv_update_inventory(uuid, jsonb)',
    'inv_save_location(uuid, jsonb)',
    'inv_save_product(uuid, jsonb)',
    'inv_set_product_active(uuid, boolean, integer)',
    'inv_register_opening(uuid, uuid, jsonb)',
    'inv_receive(uuid, uuid, jsonb, jsonb)',
    'inv_issue(uuid, uuid, integer, text, text, text, uuid, uuid)',
    'inv_transfer(uuid, uuid, uuid, uuid, integer, text)',
    'inv_count_start(uuid)',
    'inv_count_save(uuid, jsonb)',
    'inv_count_submit(uuid, uuid)',
    'inv_review_adjustment(uuid, uuid, boolean, text)',
    'inv_reverse_movement(uuid, uuid, text)',
    'inv_void_receipt(uuid, uuid, text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;
