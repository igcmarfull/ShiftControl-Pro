-- Pruebas del módulo Inventarios en el servidor.
--
-- SOLO PARA UNA BASE LOCAL DESECHABLE con todas las migraciones aplicadas.
-- Crea empresas, usuarios y datos ficticios dentro de una transacción que
-- termina en ROLLBACK. No ejecutar contra producción.
--
-- Uso:
--   psql -d <base_local> -v ON_ERROR_STOP=1 -f supabase/tests/inventario_local.sql
--
-- Cada comprobación imprime "PASS ..."; la primera que falle detiene el script
-- con "FAIL ...". Al final imprime "INVENTARIOS: TODAS LAS PRUEBAS PASARON".

begin;

-- ---------------------------------------------------------------------------
-- Datos ficticios
-- ---------------------------------------------------------------------------
create temp table ctx (k text primary key, v text);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000a0001', 'admin-a@example.invalid'),
  ('00000000-0000-0000-0000-0000000a0002', 'jefa-tienda@example.invalid'),
  ('00000000-0000-0000-0000-0000000a0003', 'jefa-isla@example.invalid'),
  ('00000000-0000-0000-0000-0000000b0001', 'admin-b@example.invalid'),
  ('00000000-0000-0000-0000-0000000c0001', 'sin-acceso@example.invalid');
insert into public.profiles (id, display_name, active)
select id, 'Prueba ' || right(id::text, 4), true from auth.users on conflict (id) do update set active = true;
insert into public.companies (id, name) values
  ('00000000-0000-0000-0000-00000000000a', 'Empresa A'),
  ('00000000-0000-0000-0000-00000000000b', 'Empresa B');
insert into public.company_memberships (company_id, user_id, role, area, active) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000a0001', 'ADMIN', null, true),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000a0002', 'CHIEF', 'TIENDA', true),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000a0003', 'CHIEF', 'ESTACION', true),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000b0001', 'ADMIN', null, true);

insert into ctx values
  ('A', '00000000-0000-0000-0000-00000000000a'), ('B', '00000000-0000-0000-0000-00000000000b'),
  ('adm', '00000000-0000-0000-0000-0000000a0001'), ('jt', '00000000-0000-0000-0000-0000000a0002'),
  ('ji', '00000000-0000-0000-0000-0000000a0003'), ('admB', '00000000-0000-0000-0000-0000000b0001'),
  ('out', '00000000-0000-0000-0000-0000000c0001');

-- ---------------------------------------------------------------------------
-- Auxiliares (se llaman siempre como postgres; cambian de rol por dentro)
-- ---------------------------------------------------------------------------
create function pg_temp.g(p_k text) returns text language sql as $$ select v from ctx where k = p_k $$;
create function pg_temp.put(p_k text, p_v text) returns void language sql as $$
  insert into ctx values (p_k, p_v) on conflict (k) do update set v = excluded.v $$;
create function pg_temp.id() returns text language sql as $$ select gen_random_uuid()::text $$;

-- Ejecuta una consulta que devuelve un jsonb, como el usuario indicado.
create function pg_temp.call(p_user text, p_sql text) returns jsonb language plpgsql as $$
declare v jsonb;
begin
  perform set_config('request.jwt.claim.sub', pg_temp.g(p_user), true);
  set local role authenticated;
  execute p_sql into v;
  reset role;
  return v;
exception when others then
  reset role;
  raise;
end $$;

-- Ejecuta una consulta que DEBE fallar y devuelve el mensaje (o 'OK' si no falló).
create function pg_temp.try(p_user text, p_sql text) returns text language plpgsql as $$
declare v_msg text;
begin
  perform set_config('request.jwt.claim.sub', pg_temp.g(p_user), true);
  begin
    set local role authenticated;
    execute p_sql;
    reset role;
    return 'OK';
  exception when others then
    reset role;
    get stacked diagnostics v_msg = message_text;
    return v_msg;
  end;
end $$;

create function pg_temp.ok(p_name text, p_cond boolean, p_detail text default '') returns void language plpgsql as $$
begin
  if p_cond is not true then raise exception 'FAIL %  %', p_name, p_detail; end if;
  raise notice 'PASS %', p_name;
end $$;

create function pg_temp.stock(p_code text, p_inv text default null) returns integer language sql as $$
  select coalesce(sum(s.qty), 0)::integer from public.inv_stock s join public.inv_products p on p.id = s.product_id
  where p.code = p_code and (p_inv is null or p.inventory_id = pg_temp.g('inv_' || p_inv)::uuid) $$;

-- ---------------------------------------------------------------------------
-- 1. Activación y visibilidad
-- ---------------------------------------------------------------------------
do $$
declare r jsonb; i jsonb; v_msg text;
begin
  v_msg := pg_temp.try('jt', format('select public.inv_setup(%L)', pg_temp.g('A')));
  perform pg_temp.ok('La jefa no puede activar los inventarios', v_msg = 'inv:forbidden', v_msg);

  v_msg := pg_temp.try('out', format('select public.inv_setup(%L)', pg_temp.g('A')));
  perform pg_temp.ok('Un usuario sin membresía no puede activar nada', v_msg = 'inv:forbidden', v_msg);

  r := pg_temp.call('adm', format('select public.inv_setup(%L)', pg_temp.g('A')));
  perform pg_temp.ok('El administrador activa los 3 inventarios', jsonb_array_length(r->'created') = 3, r::text);
  r := pg_temp.call('adm', format('select public.inv_setup(%L)', pg_temp.g('A')));
  perform pg_temp.ok('Activar de nuevo es idempotente', jsonb_array_length(r->'created') = 0, r::text);

  for i in select * from jsonb_array_elements(r->'inventories') loop
    perform pg_temp.put('inv_' || (i->>'code'), i->>'id');
    perform pg_temp.put('area_' || (i->>'code'), i->>'area');
  end loop;
  perform pg_temp.ok('Asignación inicial: Tienda y Cigarrillos a TIENDA, Lubricantes a ISLA',
    pg_temp.g('area_tienda') = 'TIENDA' and pg_temp.g('area_cigarrillos') = 'TIENDA' and pg_temp.g('area_lubricantes') = 'ISLA');

  r := pg_temp.call('adm', format('select public.inv_overview(%L)', pg_temp.g('A')));
  perform pg_temp.ok('El administrador ve los 3 inventarios', jsonb_array_length(r->'inventories') = 3);
  r := pg_temp.call('jt', format('select public.inv_overview(%L)', pg_temp.g('A')));
  perform pg_temp.ok('La Jefa de Tienda ve Tienda y Cigarrillos, no Lubricantes',
    jsonb_array_length(r->'inventories') = 2 and not (r::text like '%lubricantes%'), r::text);
  r := pg_temp.call('ji', format('select public.inv_overview(%L)', pg_temp.g('A')));
  perform pg_temp.ok('La Jefa de Isla ve solo Lubricantes',
    jsonb_array_length(r->'inventories') = 1 and r->'inventories'->0->>'code' = 'lubricantes', r::text);
  r := pg_temp.call('admB', format('select public.inv_overview(%L)', pg_temp.g('A')));
  perform pg_temp.ok('El administrador de otra empresa no ve nada', jsonb_array_length(r->'inventories') = 0, r::text);
  r := pg_temp.call('out', format('select public.inv_overview(%L)', pg_temp.g('A')));
  perform pg_temp.ok('Un usuario sin membresía no ve nada', jsonb_array_length(r->'inventories') = 0, r::text);

  v_msg := pg_temp.try('jt', 'select count(*) from public.inv_products');
  perform pg_temp.ok('Lectura directa de tablas permitida pero filtrada por RLS', v_msg = 'OK');
end $$;

-- ---------------------------------------------------------------------------
-- 2. Catálogo: creación, duplicados y permisos
-- ---------------------------------------------------------------------------
do $$
declare r jsonb; v_msg text; v_loc text;
begin
  -- Ubicaciones
  select id::text into v_loc from public.inv_locations where inventory_id = pg_temp.g('inv_tienda')::uuid and name = 'Sala de ventas';
  perform pg_temp.put('loc_sala', v_loc);
  select id::text into v_loc from public.inv_locations where inventory_id = pg_temp.g('inv_tienda')::uuid and name = 'Bodega';
  perform pg_temp.put('loc_bodega', v_loc);

  r := pg_temp.call('adm', format($q$select public.inv_save_product(%L, %L::jsonb)$q$, pg_temp.g('inv_tienda'),
    jsonb_build_object('code', 'T-001', 'barcode', '7800000000001', 'name', 'Yogur individual 150 g', 'category', 'Refrigerados y congelados',
      'brand', 'Lácteos Sur', 'presentation', 'Vaso 150 g', 'min_stock', 20, 'tracks_expiry', true,
      'default_location_id', pg_temp.g('loc_sala'))));
  perform pg_temp.put('p_yogur', r->>'id');
  perform pg_temp.ok('Crear producto de Tienda con vencimiento', r->>'code' = 'T-001' and (r->>'tracks_expiry')::boolean, r::text);

  r := pg_temp.call('adm', format($q$select public.inv_save_product(%L, %L::jsonb)$q$, pg_temp.g('inv_tienda'),
    jsonb_build_object('code', 'T-002', 'name', 'Bebida cola 500 ml', 'category', 'Bebidas', 'min_stock', 10,
      'default_location_id', pg_temp.g('loc_sala'))));
  perform pg_temp.put('p_cola', r->>'id');

  v_msg := pg_temp.try('adm', format($q$select public.inv_save_product(%L, %L::jsonb)$q$, pg_temp.g('inv_tienda'),
    jsonb_build_object('code', 'T-001', 'name', 'Otro producto')));
  perform pg_temp.ok('Código duplicado dentro del mismo inventario se rechaza', v_msg = 'inv:duplicate_code', v_msg);
  v_msg := pg_temp.try('adm', format($q$select public.inv_save_product(%L, %L::jsonb)$q$, pg_temp.g('inv_tienda'),
    jsonb_build_object('code', 'T-009', 'barcode', '7800000000001', 'name', 'Otro')));
  perform pg_temp.ok('Código de barras duplicado se rechaza', v_msg = 'inv:duplicate_barcode', v_msg);

  -- Cigarrillos: recepción por cartón (10 cajetillas)
  r := pg_temp.call('adm', format($q$select public.inv_save_product(%L, %L::jsonb)$q$, pg_temp.g('inv_cigarrillos'),
    jsonb_build_object('code', 'C-001', 'name', 'Alfa Rojo · Cajetilla 20', 'brand', 'Alfa', 'presentation', 'Cajetilla 20',
      'min_stock', 60, 'receive_unit', 'cartón', 'receive_factor', 10, 'attrs', jsonb_build_object('variety', 'Rojo'))));
  perform pg_temp.put('p_alfa', r->>'id');
  perform pg_temp.ok('Cigarrillos: control en cajetillas con factor por cartón',
    r->>'control_unit' = 'cajetilla' and (r->>'receive_factor')::integer = 10, r::text);

  -- Lubricantes: misma marca y viscosidad, presentaciones distintas = productos distintos
  r := pg_temp.call('adm', format($q$select public.inv_save_product(%L, %L::jsonb)$q$, pg_temp.g('inv_lubricantes'),
    jsonb_build_object('code', 'L-001', 'name', 'Lubrex sintético 5W-30', 'brand', 'Lubrex', 'presentation', '1 L', 'min_stock', 24,
      'attrs', jsonb_build_object('viscosity', '5W-30', 'spec', 'API SP'))));
  perform pg_temp.put('p_lub1', r->>'id');
  r := pg_temp.call('adm', format($q$select public.inv_save_product(%L, %L::jsonb)$q$, pg_temp.g('inv_lubricantes'),
    jsonb_build_object('code', 'L-002', 'name', 'Lubrex sintético 5W-30', 'brand', 'Lubrex', 'presentation', '4 L', 'min_stock', 12,
      'attrs', jsonb_build_object('viscosity', '5W-30', 'spec', 'API SP'))));
  perform pg_temp.put('p_lub4', r->>'id');
  perform pg_temp.ok('Lubricantes: 1 L y 4 L son productos distintos (SKU y stock separados)',
    pg_temp.g('p_lub1') <> pg_temp.g('p_lub4'));

  -- El mismo código puede repetirse en otro catálogo (el alcance es el inventario)
  r := pg_temp.call('adm', format($q$select public.inv_save_product(%L, %L::jsonb)$q$, pg_temp.g('inv_cigarrillos'),
    jsonb_build_object('code', 'T-001', 'name', 'Código repetido en otro inventario')));
  perform pg_temp.ok('El código solo es único dentro de su inventario', r->>'code' = 'T-001');

  v_msg := pg_temp.try('jt', format($q$select public.inv_save_product(%L, %L::jsonb)$q$, pg_temp.g('inv_tienda'),
    jsonb_build_object('code', 'T-777', 'name', 'Intruso')));
  perform pg_temp.ok('La jefa no administra el catálogo', v_msg = 'inv:forbidden', v_msg);

  -- Edición con versión
  r := pg_temp.call('adm', format($q$select public.inv_save_product(%L, %L::jsonb)$q$, pg_temp.g('inv_tienda'),
    jsonb_build_object('id', pg_temp.g('p_cola'), 'code', 'T-002', 'name', 'Bebida cola 500 ml', 'min_stock', 12, 'expected_version', 1)));
  perform pg_temp.ok('Editar producto incrementa la versión', (r->>'version')::integer = 2 and (r->>'min_stock')::integer = 12, r::text);
  v_msg := pg_temp.try('adm', format($q$select public.inv_save_product(%L, %L::jsonb)$q$, pg_temp.g('inv_tienda'),
    jsonb_build_object('id', pg_temp.g('p_cola'), 'code', 'T-002', 'name', 'Edición vieja', 'expected_version', 1)));
  perform pg_temp.ok('Una edición con versión vieja se rechaza (otro usuario guardó antes)', v_msg = 'inv:version_conflict', v_msg);
end $$;

-- ---------------------------------------------------------------------------
-- 3. Saldo inicial y recepciones
-- ---------------------------------------------------------------------------
do $$
declare r jsonb; v_msg text; v_req text; v_before integer; v_moves integer;
begin
  v_msg := pg_temp.try('jt', format($q$select public.inv_register_opening(%L, %L, %L::jsonb)$q$, pg_temp.id(), pg_temp.g('inv_tienda'),
    jsonb_build_array(jsonb_build_object('product_id', pg_temp.g('p_cola'), 'qty', 10))));
  perform pg_temp.ok('La jefa no registra saldos iniciales', v_msg = 'inv:forbidden', v_msg);

  perform pg_temp.call('adm', format($q$select public.inv_register_opening(%L, %L, %L::jsonb)$q$, pg_temp.id(), pg_temp.g('inv_tienda'),
    jsonb_build_array(jsonb_build_object('product_id', pg_temp.g('p_cola'), 'qty', 30))));
  perform pg_temp.ok('Saldo inicial entra como movimiento', pg_temp.stock('T-002', 'tienda') = 30);

  -- Cartones -> cajetillas: 5 cartones x 10 = 50
  v_req := pg_temp.id();
  r := pg_temp.call('jt', format($q$select public.inv_receive(%L, %L, %L::jsonb, %L::jsonb)$q$, v_req, pg_temp.g('inv_cigarrillos'),
    jsonb_build_object('supplier', 'Tabacalera Central', 'document_no', 'F-1190', 'invoice_ref', 'F-1190'),
    jsonb_build_array(jsonb_build_object('product_id', pg_temp.g('p_alfa'), 'qty', 5, 'unit', 'purchase'))));
  perform pg_temp.ok('Recibir 5 cartones aumenta 50 cajetillas', pg_temp.stock('C-001', 'cigarrillos') = 50, r::text);
  perform pg_temp.ok('El movimiento guarda quién, cuándo y la conversión',
    exists (select 1 from public.inv_movements where product_id = pg_temp.g('p_alfa')::uuid and qty = 50 and kind = 'receipt'
            and created_by_name is not null and note = '5 cartón × 10'));

  -- Recibir en cajetillas sueltas
  perform pg_temp.call('jt', format($q$select public.inv_receive(%L, %L, %L::jsonb, %L::jsonb)$q$, pg_temp.id(), pg_temp.g('inv_cigarrillos'),
    jsonb_build_object('supplier', 'Tabacalera Central', 'document_no', 'F-1191'),
    jsonb_build_array(jsonb_build_object('product_id', pg_temp.g('p_alfa'), 'qty', 7, 'unit', 'base'))));
  perform pg_temp.ok('Recibir cajetillas sueltas suma sin conversión', pg_temp.stock('C-001', 'cigarrillos') = 57);

  -- Idempotencia: el mismo request_id no duplica
  select count(*) into v_moves from public.inv_movements where product_id = pg_temp.g('p_alfa')::uuid;
  r := pg_temp.call('jt', format($q$select public.inv_receive(%L, %L, %L::jsonb, %L::jsonb)$q$, v_req, pg_temp.g('inv_cigarrillos'),
    jsonb_build_object('supplier', 'Tabacalera Central', 'document_no', 'F-1190'),
    jsonb_build_array(jsonb_build_object('product_id', pg_temp.g('p_alfa'), 'qty', 5, 'unit', 'purchase'))));
  perform pg_temp.ok('Reintentar la misma operación devuelve el resultado guardado',
    (r->>'replayed')::boolean and pg_temp.stock('C-001', 'cigarrillos') = 57
    and (select count(*) from public.inv_movements where product_id = pg_temp.g('p_alfa')::uuid) = v_moves, r::text);
  v_msg := pg_temp.try('jt', format($q$select public.inv_issue(%L, %L, 1, 'issue', 'Prueba', 'x')$q$, v_req, pg_temp.g('p_alfa')));
  perform pg_temp.ok('Reutilizar un request_id para otra acción se rechaza', v_msg = 'inv:request_reuse', v_msg);

  -- Documento duplicado con request_id nuevo
  v_msg := pg_temp.try('jt', format($q$select public.inv_receive(%L, %L, %L::jsonb, %L::jsonb)$q$, pg_temp.id(), pg_temp.g('inv_cigarrillos'),
    jsonb_build_object('supplier', 'tabacalera central', 'document_no', 'f-1190'),
    jsonb_build_array(jsonb_build_object('product_id', pg_temp.g('p_alfa'), 'qty', 5, 'unit', 'purchase'))));
  perform pg_temp.ok('La misma factura del mismo proveedor no se recibe dos veces', v_msg = 'inv:duplicate_receipt' and pg_temp.stock('C-001', 'cigarrillos') = 57, v_msg);

  -- Permisos y validaciones
  v_msg := pg_temp.try('ji', format($q$select public.inv_receive(%L, %L, %L::jsonb, %L::jsonb)$q$, pg_temp.id(), pg_temp.g('inv_cigarrillos'),
    jsonb_build_object('supplier', 'X', 'document_no', 'Z-1'),
    jsonb_build_array(jsonb_build_object('product_id', pg_temp.g('p_alfa'), 'qty', 1))));
  perform pg_temp.ok('La Jefa de Isla no puede recibir en Cigarrillos (área de Tienda)', v_msg = 'inv:forbidden', v_msg);
  v_msg := pg_temp.try('jt', format($q$select public.inv_receive(%L, %L, %L::jsonb, %L::jsonb)$q$, pg_temp.id(), pg_temp.g('inv_tienda'),
    jsonb_build_object('supplier', 'X', 'document_no', 'Z-2'),
    jsonb_build_array(jsonb_build_object('product_id', pg_temp.g('p_alfa'), 'qty', 1))));
  perform pg_temp.ok('No se puede recibir un producto de otro inventario', v_msg = 'inv:invalid_product', v_msg);
  v_msg := pg_temp.try('jt', format($q$select public.inv_receive(%L, %L, %L::jsonb, %L::jsonb)$q$, pg_temp.id(), pg_temp.g('inv_tienda'),
    jsonb_build_object('supplier', 'X', 'document_no', 'Z-3'),
    jsonb_build_array(jsonb_build_object('product_id', pg_temp.g('p_yogur'), 'qty', 5))));
  perform pg_temp.ok('Producto con vencimiento exige fecha de vencimiento', v_msg = 'inv:expiry_required', v_msg);
  v_msg := pg_temp.try('jt', format($q$select public.inv_receive(%L, %L, %L::jsonb, %L::jsonb)$q$, pg_temp.id(), pg_temp.g('inv_tienda'),
    jsonb_build_object('supplier', 'X', 'document_no', 'Z-4'),
    jsonb_build_array(jsonb_build_object('product_id', pg_temp.g('p_cola'), 'qty', 4, 'unit', 'purchase'))));
  perform pg_temp.ok('Unidad de recepción sin configurar se rechaza', v_msg = 'inv:no_purchase_unit', v_msg);
  perform pg_temp.ok('Una recepción rechazada no deja registros a medias',
    not exists (select 1 from public.inv_receipts where document_no in ('Z-1', 'Z-2', 'Z-3', 'Z-4')));

  -- Lotes con vencimiento
  perform pg_temp.call('jt', format($q$select public.inv_receive(%L, %L, %L::jsonb, %L::jsonb)$q$, pg_temp.id(), pg_temp.g('inv_tienda'),
    jsonb_build_object('supplier', 'Lácteos Sur', 'document_no', 'F-2001'),
    jsonb_build_array(
      jsonb_build_object('product_id', pg_temp.g('p_yogur'), 'qty', 14, 'lot_code', 'L-B', 'expires_on', '2026-11-05'),
      jsonb_build_object('product_id', pg_temp.g('p_yogur'), 'qty', 6, 'lot_code', 'L-A', 'expires_on', '2026-10-16'))));
  perform pg_temp.ok('Recepción con dos lotes y vencimientos', pg_temp.stock('T-001', 'tienda') = 20
    and (select count(*) from public.inv_lots where product_id = pg_temp.g('p_yogur')::uuid) = 2);
  v_msg := pg_temp.try('jt', format($q$select public.inv_receive(%L, %L, %L::jsonb, %L::jsonb)$q$, pg_temp.id(), pg_temp.g('inv_tienda'),
    jsonb_build_object('supplier', 'Lácteos Sur', 'document_no', 'F-2002'),
    jsonb_build_array(jsonb_build_object('product_id', pg_temp.g('p_yogur'), 'qty', 3, 'lot_code', 'L-A', 'expires_on', '2026-12-31'))));
  perform pg_temp.ok('Un lote existente no puede cambiar su vencimiento', v_msg = 'inv:lot_conflict', v_msg);
end $$;

-- ---------------------------------------------------------------------------
-- 4. Salidas, mermas FEFO y traslados
-- ---------------------------------------------------------------------------
do $$
declare r jsonb; v_msg text; v_total_before integer;
begin
  -- FEFO: 8 de yogur salen primero del lote que vence antes (L-A: 6) y luego del L-B
  r := pg_temp.call('jt', format($q$select public.inv_issue(%L, %L, 8, 'waste', 'Vencimiento', null)$q$, pg_temp.id(), pg_temp.g('p_yogur')));
  perform pg_temp.ok('La merma descuenta con FEFO (primero el lote que vence antes)',
    (select qty from public.inv_stock s join public.inv_lots l on l.id = s.lot_id where l.lot_code = 'L-A' and s.product_id = pg_temp.g('p_yogur')::uuid) = 0
    and (select qty from public.inv_stock s join public.inv_lots l on l.id = s.lot_id where l.lot_code = 'L-B' and s.product_id = pg_temp.g('p_yogur')::uuid) = 12
    and pg_temp.stock('T-001', 'tienda') = 12, r::text);

  v_msg := pg_temp.try('jt', format($q$select public.inv_issue(%L, %L, 999, 'issue', 'Prueba', 'Excede')$q$, pg_temp.id(), pg_temp.g('p_yogur')));
  perform pg_temp.ok('No se puede sacar más de lo que hay', v_msg = 'inv:insufficient_stock' and pg_temp.stock('T-001', 'tienda') = 12, v_msg);
  v_msg := pg_temp.try('jt', format($q$select public.inv_issue(%L, %L, 1, 'issue', 'Degustación', null)$q$, pg_temp.id(), pg_temp.g('p_yogur')));
  perform pg_temp.ok('Una salida manual exige justificación', v_msg = 'inv:note_required', v_msg);
  v_msg := pg_temp.try('jt', format($q$select public.inv_issue(%L, %L, 1, 'waste', 'Porque sí', null)$q$, pg_temp.id(), pg_temp.g('p_yogur')));
  perform pg_temp.ok('El motivo de merma debe ser uno de los definidos', v_msg = 'inv:invalid_reason', v_msg);
  v_msg := pg_temp.try('ji', format($q$select public.inv_issue(%L, %L, 1, 'issue', 'Intruso', 'x')$q$, pg_temp.id(), pg_temp.g('p_yogur')));
  perform pg_temp.ok('La Jefa de Isla no puede sacar stock de Tienda', v_msg = 'inv:forbidden', v_msg);

  -- Traslado: el total no cambia
  v_total_before := pg_temp.stock('T-002', 'tienda');
  perform pg_temp.call('jt', format($q$select public.inv_transfer(%L, %L, %L, %L, 10, 'Reposición')$q$, pg_temp.id(), pg_temp.g('p_cola'),
    pg_temp.g('loc_sala'), pg_temp.g('loc_bodega')));
  perform pg_temp.ok('El traslado mueve entre ubicaciones sin cambiar el total',
    pg_temp.stock('T-002', 'tienda') = v_total_before
    and (select qty from public.inv_stock where product_id = pg_temp.g('p_cola')::uuid and location_id = pg_temp.g('loc_bodega')::uuid) = 10
    and (select qty from public.inv_stock where product_id = pg_temp.g('p_cola')::uuid and location_id = pg_temp.g('loc_sala')::uuid) = 20);
  v_msg := pg_temp.try('jt', format($q$select public.inv_transfer(%L, %L, %L, %L, 5, null)$q$, pg_temp.id(), pg_temp.g('p_cola'),
    pg_temp.g('loc_sala'), pg_temp.g('loc_sala')));
  perform pg_temp.ok('No se traslada a la misma ubicación', v_msg = 'inv:invalid_location', v_msg);
end $$;

-- ---------------------------------------------------------------------------
-- 5. Conteos, diferencias y aprobación de ajustes
-- ---------------------------------------------------------------------------
do $$
declare r jsonb; v_msg text; v_count text; v_stock integer; v_adj text;
begin
  r := pg_temp.call('jt', format('select public.inv_count_start(%L)', pg_temp.g('inv_tienda')));
  v_count := r->>'id';
  perform pg_temp.ok('Se abre un conteo sin mostrar el stock esperado', v_count is not null and not (r::text like '%expected%'), r::text);
  perform pg_temp.ok('Abrir de nuevo devuelve el mismo conteo',
    (pg_temp.call('jt', format('select public.inv_count_start(%L)', pg_temp.g('inv_tienda')))->>'id') = v_count);

  -- Parcial: solo cola (stock 30) y yogur (stock 12)
  perform pg_temp.call('jt', format($q$select public.inv_count_save(%L, %L::jsonb)$q$, v_count,
    jsonb_build_array(jsonb_build_object('product_id', pg_temp.g('p_cola'), 'counted_qty', 30))));
  r := pg_temp.call('jt', format('select public.inv_get_count(%L)', pg_temp.g('inv_tienda')));
  perform pg_temp.ok('El conteo parcial se guarda y se puede continuar', jsonb_array_length(r->'lines') = 1, r::text);
  perform pg_temp.call('jt', format($q$select public.inv_count_save(%L, %L::jsonb)$q$, v_count,
    jsonb_build_array(jsonb_build_object('product_id', pg_temp.g('p_yogur'), 'counted_qty', 9))));

  v_msg := pg_temp.try('jt', format($q$select public.inv_count_submit(%L, %L)$q$, pg_temp.id(), v_count));
  perform pg_temp.ok('Una diferencia sin observación no se envía', v_msg = 'inv:note_required', v_msg);
  perform pg_temp.call('jt', format($q$select public.inv_count_save(%L, %L::jsonb)$q$, v_count,
    jsonb_build_array(jsonb_build_object('product_id', pg_temp.g('p_yogur'), 'counted_qty', 9, 'note', 'Vasos dañados'))));

  v_stock := pg_temp.stock('T-001', 'tienda');
  r := pg_temp.call('jt', format($q$select public.inv_count_submit(%L, %L)$q$, pg_temp.id(), v_count));
  perform pg_temp.ok('Enviar el conteo: 1 exacto y 1 diferencia pendiente', (r->>'exact')::integer = 1 and (r->>'pending')::integer = 1, r::text);
  perform pg_temp.ok('Un conteo con diferencia NO modifica el stock', pg_temp.stock('T-001', 'tienda') = v_stock);
  select id::text into v_adj from public.inv_adjustments where product_id = pg_temp.g('p_yogur')::uuid;
  perform pg_temp.ok('La diferencia (-3) queda registrada con responsable y observación',
    (select delta = -3 and expected_qty = 12 and counted_qty = 9 and requested_by_name is not null and note = 'Vasos dañados'
     from public.inv_adjustments where id = v_adj::uuid));
  v_msg := pg_temp.try('jt', format($q$select public.inv_count_save(%L, '[]'::jsonb)$q$, v_count));
  perform pg_temp.ok('Un conteo enviado ya no se edita', v_msg = 'inv:count_closed', v_msg);

  -- La jefa no puede aprobar (ni su propio ajuste)
  v_msg := pg_temp.try('jt', format($q$select public.inv_review_adjustment(%L, %L, true, null)$q$, pg_temp.id(), v_adj));
  perform pg_temp.ok('La jefa no puede aprobar su propio ajuste', v_msg = 'inv:forbidden', v_msg);
  v_msg := pg_temp.try('adm', format($q$select public.inv_review_adjustment(%L, %L, false, null)$q$, pg_temp.id(), v_adj));
  perform pg_temp.ok('Rechazar exige explicar el motivo', v_msg = 'inv:note_required', v_msg);

  -- Aprobar: el stock cambia con un movimiento trazable (FEFO)
  r := pg_temp.call('adm', format($q$select public.inv_review_adjustment(%L, %L, true, 'Confirmado')$q$, pg_temp.id(), v_adj));
  perform pg_temp.ok('Ajuste aprobado: el stock baja 3 con un movimiento', pg_temp.stock('T-001', 'tienda') = v_stock - 3
    and exists (select 1 from public.inv_movements where adjustment_id = v_adj::uuid and kind = 'adjustment' and qty = -3 and created_by_name is not null), r::text);
  v_msg := pg_temp.try('adm', format($q$select public.inv_review_adjustment(%L, %L, true, null)$q$, pg_temp.id(), v_adj));
  perform pg_temp.ok('Un ajuste ya revisado no se aplica dos veces', v_msg = 'inv:already_reviewed', v_msg);

  -- Rechazar otro ajuste: el stock no cambia
  r := pg_temp.call('jt', format('select public.inv_count_start(%L)', pg_temp.g('inv_cigarrillos')));
  perform pg_temp.call('jt', format($q$select public.inv_count_save(%L, %L::jsonb)$q$, r->>'id',
    jsonb_build_array(jsonb_build_object('product_id', pg_temp.g('p_alfa'), 'counted_qty', 55, 'note', 'Faltan 2'))));
  perform pg_temp.call('jt', format($q$select public.inv_count_submit(%L, %L)$q$, pg_temp.id(), r->>'id'));
  select id::text into v_adj from public.inv_adjustments where product_id = pg_temp.g('p_alfa')::uuid;
  v_stock := pg_temp.stock('C-001', 'cigarrillos');
  perform pg_temp.call('adm', format($q$select public.inv_review_adjustment(%L, %L, false, 'Se recontará')$q$, pg_temp.id(), v_adj));
  perform pg_temp.ok('Ajuste rechazado: el stock no cambia', pg_temp.stock('C-001', 'cigarrillos') = v_stock
    and (select status from public.inv_adjustments where id = v_adj::uuid) = 'rejected');

  -- Umbral de aprobación automática configurado por el administrador
  perform pg_temp.call('adm', format($q$select public.inv_update_inventory(%L, '{"auto_approve_max_abs": 2}'::jsonb)$q$, pg_temp.g('inv_cigarrillos')));
  r := pg_temp.call('jt', format('select public.inv_count_start(%L)', pg_temp.g('inv_cigarrillos')));
  perform pg_temp.call('jt', format($q$select public.inv_count_save(%L, %L::jsonb)$q$, r->>'id',
    jsonb_build_array(jsonb_build_object('product_id', pg_temp.g('p_alfa'), 'counted_qty', v_stock - 1, 'note', 'Una menos'))));
  r := pg_temp.call('jt', format($q$select public.inv_count_submit(%L, %L)$q$, pg_temp.id(), r->>'id'));
  perform pg_temp.ok('Bajo el umbral configurado el ajuste se aplica solo y queda auditado',
    (r->>'auto_approved')::integer = 1 and pg_temp.stock('C-001', 'cigarrillos') = v_stock - 1, r::text);
  perform pg_temp.call('adm', format($q$select public.inv_update_inventory(%L, '{"auto_approve_max_abs": 0}'::jsonb)$q$, pg_temp.g('inv_cigarrillos')));
end $$;

-- ---------------------------------------------------------------------------
-- 6. Correcciones, anulaciones e inmutabilidad
-- ---------------------------------------------------------------------------
do $$
declare r jsonb; v_msg text; v_mov text; v_rec text; v_before integer;
begin
  -- Corrección compensatoria de una salida
  perform pg_temp.call('jt', format($q$select public.inv_issue(%L, %L, 2, 'issue', 'Consumo interno', 'Prueba de corrección')$q$, pg_temp.id(), pg_temp.g('p_cola')));
  v_before := pg_temp.stock('T-002', 'tienda');
  select id::text into v_mov from public.inv_movements where product_id = pg_temp.g('p_cola')::uuid and kind = 'issue' limit 1;
  v_msg := pg_temp.try('jt', format($q$select public.inv_reverse_movement(%L, %L, 'x')$q$, pg_temp.id(), v_mov));
  perform pg_temp.ok('La jefa no corrige movimientos', v_msg = 'inv:forbidden', v_msg);
  perform pg_temp.call('adm', format($q$select public.inv_reverse_movement(%L, %L, 'Se registró por error')$q$, pg_temp.id(), v_mov));
  perform pg_temp.ok('La corrección crea un movimiento compensatorio y devuelve el stock',
    pg_temp.stock('T-002', 'tienda') = v_before + 2
    and exists (select 1 from public.inv_movements where reverses_id = v_mov::uuid and kind = 'reversal' and qty = 2)
    and exists (select 1 from public.inv_movements where id = v_mov::uuid));
  v_msg := pg_temp.try('adm', format($q$select public.inv_reverse_movement(%L, %L, 'otra vez')$q$, pg_temp.id(), v_mov));
  perform pg_temp.ok('Un movimiento no se corrige dos veces', v_msg = 'inv:already_reversed', v_msg);

  -- Inmutabilidad: ni siquiera con el rol dueño de las tablas
  begin update public.inv_movements set qty = 999 where id = v_mov::uuid; v_msg := 'OK';
  exception when others then get stacked diagnostics v_msg = message_text; end;
  perform pg_temp.ok('Un movimiento no se puede editar', v_msg = 'inv:immutable', v_msg);
  begin delete from public.inv_movements where id = v_mov::uuid; v_msg := 'OK';
  exception when others then get stacked diagnostics v_msg = message_text; end;
  perform pg_temp.ok('Un movimiento no se puede borrar', v_msg = 'inv:immutable', v_msg);
  begin delete from public.inv_audit; v_msg := 'OK';
  exception when others then get stacked diagnostics v_msg = message_text; end;
  perform pg_temp.ok('La auditoría no se puede borrar', v_msg = 'inv:immutable', v_msg);

  -- Escritura directa de los clientes: denegada
  v_msg := pg_temp.try('adm', format($q$insert into public.inv_movements (company_id, inventory_id, product_id, location_id, kind, qty, request_id, created_by)
    values (%L, %L, %L, %L, 'adjustment', 5, gen_random_uuid(), %L)$q$, pg_temp.g('A'), pg_temp.g('inv_tienda'), pg_temp.g('p_cola'), pg_temp.g('loc_sala'), pg_temp.g('adm')));
  perform pg_temp.ok('Ni el administrador puede insertar movimientos directamente', v_msg like 'permission denied%', v_msg);
  v_msg := pg_temp.try('adm', format($q$update public.inv_stock set qty = 9999 where product_id = %L$q$, pg_temp.g('p_cola')));
  perform pg_temp.ok('Nadie edita el stock directamente', v_msg like 'permission denied%', v_msg);
  v_msg := pg_temp.try('jt', 'select count(*) from public.inv_audit');
  perform pg_temp.ok('La jefa consulta la auditoría sin ver filas (solo el administrador la lee)',
    (pg_temp.call('jt', 'select to_jsonb(count(*)) from public.inv_audit'))::text = '0');

  -- Anular una recepción
  select id::text into v_rec from public.inv_receipts where document_no = 'F-1191';
  v_before := pg_temp.stock('C-001', 'cigarrillos');
  perform pg_temp.call('adm', format($q$select public.inv_void_receipt(%L, %L, 'Mercadería devuelta')$q$, pg_temp.id(), v_rec));
  perform pg_temp.ok('Anular una recepción revierte su stock con movimientos compensatorios',
    pg_temp.stock('C-001', 'cigarrillos') = v_before - 7 and (select status from public.inv_receipts where id = v_rec::uuid) = 'voided');
  perform pg_temp.call('jt', format($q$select public.inv_receive(%L, %L, %L::jsonb, %L::jsonb)$q$, pg_temp.id(), pg_temp.g('inv_cigarrillos'),
    jsonb_build_object('supplier', 'Tabacalera Central', 'document_no', 'F-1191'),
    jsonb_build_array(jsonb_build_object('product_id', pg_temp.g('p_alfa'), 'qty', 7))));
  perform pg_temp.ok('Tras anular, el documento puede recibirse de nuevo', pg_temp.stock('C-001', 'cigarrillos') = v_before);

  -- No se anula una recepción cuyo stock ya se consumió
  perform pg_temp.call('adm', format($q$select public.inv_register_opening(%L, %L, %L::jsonb)$q$, pg_temp.id(), pg_temp.g('inv_lubricantes'),
    jsonb_build_array(jsonb_build_object('product_id', pg_temp.g('p_lub1'), 'qty', 3))));
  perform pg_temp.call('ji', format($q$select public.inv_receive(%L, %L, %L::jsonb, %L::jsonb)$q$, pg_temp.id(), pg_temp.g('inv_lubricantes'),
    jsonb_build_object('supplier', 'Lubricantes del Pacífico', 'document_no', 'F-3001'),
    jsonb_build_array(jsonb_build_object('product_id', pg_temp.g('p_lub1'), 'qty', 4))));
  perform pg_temp.call('ji', format($q$select public.inv_issue(%L, %L, 6, 'issue', 'Uso interno', 'Servicio flota')$q$, pg_temp.id(), pg_temp.g('p_lub1')));
  select id::text into v_rec from public.inv_receipts where document_no = 'F-3001';
  v_msg := pg_temp.try('adm', format($q$select public.inv_void_receipt(%L, %L, 'Error')$q$, pg_temp.id(), v_rec));
  perform pg_temp.ok('No se anula una recepción si el stock ya se usó', v_msg = 'inv:insufficient_stock', v_msg);
  perform pg_temp.ok('Una anulación rechazada no deja cambios a medias',
    (select status from public.inv_receipts where id = v_rec::uuid) = 'confirmed' and pg_temp.stock('L-001', 'lubricantes') = 1);
end $$;

-- ---------------------------------------------------------------------------
-- 7. Desactivación, configuración de áreas y consistencia
-- ---------------------------------------------------------------------------
do $$
declare r jsonb; v_msg text; v_v integer;
begin
  select version into v_v from public.inv_products where id = pg_temp.g('p_lub4')::uuid;
  perform pg_temp.call('adm', format($q$select public.inv_set_product_active(%L, false, %s)$q$, pg_temp.g('p_lub4'), v_v));
  perform pg_temp.ok('Un producto sin stock se puede desactivar', not (select active from public.inv_products where id = pg_temp.g('p_lub4')::uuid));
  select version into v_v from public.inv_products where id = pg_temp.g('p_cola')::uuid;
  v_msg := pg_temp.try('adm', format($q$select public.inv_set_product_active(%L, false, %s)$q$, pg_temp.g('p_cola'), v_v));
  perform pg_temp.ok('Un producto con stock no se desactiva', v_msg = 'inv:has_stock', v_msg);

  -- Reasignar Lubricantes a TIENDA: la Jefa de Isla lo pierde y la de Tienda lo gana
  perform pg_temp.call('adm', format($q$select public.inv_update_inventory(%L, '{"area": "TIENDA"}'::jsonb)$q$, pg_temp.g('inv_lubricantes')));
  perform pg_temp.ok('Reasignar un inventario cambia quién lo ve (configurable)',
    jsonb_array_length(pg_temp.call('ji', format('select public.inv_overview(%L)', pg_temp.g('A')))->'inventories') = 0
    and jsonb_array_length(pg_temp.call('jt', format('select public.inv_overview(%L)', pg_temp.g('A')))->'inventories') = 3);
  v_msg := pg_temp.try('ji', format($q$select public.inv_issue(%L, %L, 1, 'issue', 'Prueba', 'x')$q$, pg_temp.id(), pg_temp.g('p_lub1')));
  perform pg_temp.ok('La restricción también se aplica a las operaciones, no solo a la lectura', v_msg = 'inv:forbidden', v_msg);
  perform pg_temp.call('adm', format($q$select public.inv_update_inventory(%L, '{"area": "ISLA"}'::jsonb)$q$, pg_temp.g('inv_lubricantes')));
  v_msg := pg_temp.try('jt', format($q$select public.inv_update_inventory(%L, '{"area": "TIENDA"}'::jsonb)$q$, pg_temp.g('inv_lubricantes')));
  perform pg_temp.ok('La jefa no reasigna áreas', v_msg = 'inv:forbidden', v_msg);

  -- Separación entre empresas
  v_msg := pg_temp.try('admB', format($q$select public.inv_issue(%L, %L, 1, 'issue', 'x', 'x')$q$, pg_temp.id(), pg_temp.g('p_cola')));
  perform pg_temp.ok('El administrador de otra empresa no opera inventarios ajenos', v_msg = 'inv:forbidden', v_msg);
  r := pg_temp.call('admB', 'select public.inv_setup(''' || pg_temp.g('B') || ''')');
  perform pg_temp.ok('La otra empresa activa los suyos sin mezclarse', jsonb_array_length(r->'created') = 3
    and (select count(*) from public.inv_inventories) = 6);
  perform pg_temp.ok('Los productos de A no aparecen en B',
    (pg_temp.call('admB', format($q$select public.inv_list_products(%L)$q$, pg_temp.g('inv_tienda'))))::text = '[]');

  -- Lecturas y reportes
  r := pg_temp.call('jt', format('select public.inv_list_products(%L)', pg_temp.g('inv_tienda')));
  perform pg_temp.ok('El listado trae stock, lotes y alertas',
    jsonb_array_length(r) = 2 and (select bool_or(p->>'status' = 'low' and p->>'code' = 'T-001') from jsonb_array_elements(r) p), r::text);
  r := pg_temp.call('jt', format('select public.inv_report_shortages(%L)', pg_temp.g('inv_tienda')));
  perform pg_temp.ok('Reporte de faltantes', jsonb_array_length(r) >= 1 and r->0->>'code' = 'T-001', r::text);
  r := pg_temp.call('jt', format($q$select public.inv_report_waste(%L, current_date - 30, current_date + 1)$q$, pg_temp.g('inv_tienda')));
  perform pg_temp.ok('Reporte de mermas por período y motivo', (r->>'total')::integer = 8 and r->'by_reason'->0->>'reason' = 'Vencimiento', r::text);
  r := pg_temp.call('adm', format($q$select public.inv_list_movements(%L, %L, null, null, 20, null)$q$, pg_temp.g('A'), pg_temp.g('inv_tienda')));
  perform pg_temp.ok('Historial de movimientos con usuario y marca de corregido',
    jsonb_array_length(r) > 5 and (select bool_or((m->>'reversed')::boolean) from jsonb_array_elements(r) m), left(r::text, 200));

  -- Consistencia global: el stock es exactamente la suma de movimientos
  perform pg_temp.ok('El stock coincide con la suma de movimientos en todos los productos',
    not exists (
      select 1 from (
        select product_id, location_id, coalesce(lot_id, '00000000-0000-0000-0000-000000000000'::uuid) lk, sum(qty) q
        from public.inv_movements group by 1, 2, 3) m
      full join (select product_id, location_id, lot_key lk, qty q from public.inv_stock) s using (product_id, location_id, lk)
      where coalesce(m.q, 0) <> coalesce(s.q, 0)));
  perform pg_temp.ok('Ningún stock es negativo', not exists (select 1 from public.inv_stock where qty < 0));
  perform pg_temp.ok('Toda acción sensible quedó en la auditoría', (select count(*) from public.inv_audit) >= 20);
end $$;

do $$ begin raise notice 'INVENTARIOS: TODAS LAS PRUEBAS PASARON'; end $$;

rollback;
