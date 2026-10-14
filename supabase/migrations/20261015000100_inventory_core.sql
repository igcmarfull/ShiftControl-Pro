-- Inventarios (Tienda, Cigarrillos y Lubricantes): estructura de datos.
--
-- ESTADO: aplicada en producción con autorización expresa del propietario.
-- No crea ni modifica ningún dato: los inventarios se activan de forma
-- explícita con inv_setup() (20261015000200_inventory_api.sql).
--
-- Principios:
-- - Tablas normalizadas y propias: nada de esto vive en app_state.
-- - El stock se mantiene SOLO a partir de movimientos confirmados e inmutables
--   (trigger inv_apply_stock). Ningún cliente escribe el stock ni los movimientos.
-- - Todas las referencias llevan company_id en la clave foránea: no es posible
--   enlazar registros de empresas distintas.
-- - Los clientes solo leen (RLS por empresa y por área del inventario). Toda
--   escritura pasa por funciones del servidor (20261015000200).
-- - Cada inventario se asigna a un área (TIENDA o ISLA) y esa asignación es
--   configurable por el administrador.

-- ---------------------------------------------------------------------------
-- Inventarios y ubicaciones
-- ---------------------------------------------------------------------------

create table public.inv_inventories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null check (code in ('tienda', 'cigarrillos', 'lubricantes')),
  name text not null check (length(trim(name)) > 0),
  area text not null check (area in ('TIENDA', 'ISLA')),
  control_unit text not null check (length(trim(control_unit)) > 0),
  expiry_alert_days integer not null default 7 check (expiry_alert_days between 1 and 90),
  -- Diferencias de conteo hasta este valor (en unidades) se aplican sin aprobación.
  -- 0 significa que toda diferencia exige aprobación del administrador.
  auto_approve_max_abs integer not null default 0 check (auto_approve_max_abs >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code),
  unique (company_id, id)
);

create table public.inv_locations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  inventory_id uuid not null,
  name text not null check (length(trim(name)) > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, id),
  foreign key (company_id, inventory_id) references public.inv_inventories (company_id, id) on delete cascade
);
create unique index inv_locations_name_key on public.inv_locations (inventory_id, lower(name));

-- ---------------------------------------------------------------------------
-- Productos y lotes
-- ---------------------------------------------------------------------------

create table public.inv_products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  inventory_id uuid not null,
  code text not null check (length(trim(code)) > 0),
  barcode text,
  name text not null check (length(trim(name)) > 0),
  category text not null default '',
  brand text not null default '',
  control_unit text not null check (length(trim(control_unit)) > 0),
  presentation text not null default '',
  default_location_id uuid,
  min_stock integer not null default 0 check (min_stock >= 0),
  tracks_expiry boolean not null default false,
  -- Recepción por unidad mayor (p. ej. cartón de 10 cajetillas). El stock se
  -- controla siempre en la unidad de control.
  receive_unit text,
  receive_factor integer not null default 1 check (receive_factor >= 1),
  -- Campos específicos de cada inventario: variedad (cigarrillos), viscosidad y
  -- especificación (lubricantes), etc.
  attrs jsonb not null default '{}'::jsonb check (jsonb_typeof(attrs) = 'object'),
  active boolean not null default true,
  version integer not null default 1,
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  -- El código es único dentro de cada catálogo (un SKU 5W-30 de 1 L y otro de 4 L
  -- son productos y códigos distintos).
  unique (inventory_id, code),
  foreign key (company_id, inventory_id) references public.inv_inventories (company_id, id) on delete cascade,
  foreign key (company_id, default_location_id) references public.inv_locations (company_id, id)
);
create unique index inv_products_barcode_key on public.inv_products (inventory_id, barcode)
  where barcode is not null and barcode <> '';
create index inv_products_inventory_idx on public.inv_products (inventory_id, active);

create table public.inv_lots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  inventory_id uuid not null,
  product_id uuid not null,
  lot_code text not null check (length(trim(lot_code)) > 0),
  expires_on date,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (company_id, id),
  unique (product_id, lot_code),
  foreign key (company_id, product_id) references public.inv_products (company_id, id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Stock (proyección de movimientos) y movimientos
-- ---------------------------------------------------------------------------

create table public.inv_stock (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  inventory_id uuid not null,
  product_id uuid not null,
  location_id uuid not null,
  lot_id uuid,
  lot_key uuid generated always as (coalesce(lot_id, '00000000-0000-0000-0000-000000000000'::uuid)) stored,
  qty integer not null check (qty >= 0),
  updated_at timestamptz not null default now(),
  unique (product_id, location_id, lot_key),
  foreign key (company_id, product_id) references public.inv_products (company_id, id) on delete cascade,
  foreign key (company_id, location_id) references public.inv_locations (company_id, id),
  foreign key (company_id, lot_id) references public.inv_lots (company_id, id)
);
create index inv_stock_inventory_idx on public.inv_stock (inventory_id);

create table public.inv_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  inventory_id uuid not null,
  product_id uuid not null,
  location_id uuid not null,
  lot_id uuid,
  kind text not null check (kind in (
    'opening', 'receipt', 'issue', 'waste', 'transfer_out', 'transfer_in', 'adjustment', 'reversal'
  )),
  -- Con signo: positivo entra, negativo sale.
  qty integer not null check (qty <> 0),
  reason text,
  note text,
  reference text,
  group_id uuid,
  receipt_id uuid,
  adjustment_id uuid,
  reverses_id uuid unique references public.inv_movements (id),
  request_id uuid not null,
  created_by uuid not null,
  created_by_name text,
  created_at timestamptz not null default now(),
  unique (company_id, id),
  foreign key (company_id, product_id) references public.inv_products (company_id, id),
  foreign key (company_id, location_id) references public.inv_locations (company_id, id),
  foreign key (company_id, lot_id) references public.inv_lots (company_id, id)
);
create index inv_movements_inventory_idx on public.inv_movements (inventory_id, created_at desc);
create index inv_movements_product_idx on public.inv_movements (product_id, created_at desc);
create index inv_movements_group_idx on public.inv_movements (group_id) where group_id is not null;

-- ---------------------------------------------------------------------------
-- Recepciones (distintas de las facturas)
-- ---------------------------------------------------------------------------

create table public.inv_receipts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  inventory_id uuid not null,
  supplier text not null check (length(trim(supplier)) > 0),
  received_on date not null,
  document_no text not null check (length(trim(document_no)) > 0),
  -- Referencia libre a la factura del módulo «Facturas y compras» (vive en
  -- app_state): no es una clave foránea y no cambia el flujo de aprobación.
  invoice_ref text,
  notes text,
  status text not null default 'confirmed' check (status in ('confirmed', 'voided')),
  received_by uuid not null,
  received_by_name text,
  request_id uuid not null,
  created_at timestamptz not null default now(),
  voided_by uuid,
  voided_by_name text,
  voided_at timestamptz,
  void_reason text,
  unique (company_id, id),
  foreign key (company_id, inventory_id) references public.inv_inventories (company_id, id) on delete cascade
);
-- La misma factura/documento de un proveedor no se recibe dos veces.
create unique index inv_receipts_document_key on public.inv_receipts (inventory_id, lower(supplier), lower(document_no))
  where status = 'confirmed';

create table public.inv_receipt_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  inventory_id uuid not null,
  receipt_id uuid not null,
  product_id uuid not null,
  location_id uuid not null,
  lot_id uuid,
  qty_input integer not null check (qty_input > 0),
  input_unit text not null check (input_unit in ('base', 'purchase')),
  factor_applied integer not null check (factor_applied >= 1),
  qty_base integer not null check (qty_base > 0),
  foreign key (company_id, receipt_id) references public.inv_receipts (company_id, id) on delete cascade,
  foreign key (company_id, product_id) references public.inv_products (company_id, id),
  foreign key (company_id, location_id) references public.inv_locations (company_id, id),
  foreign key (company_id, lot_id) references public.inv_lots (company_id, id)
);

-- ---------------------------------------------------------------------------
-- Conteos físicos y ajustes
-- ---------------------------------------------------------------------------

create table public.inv_counts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  inventory_id uuid not null,
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted')),
  started_by uuid not null,
  started_by_name text,
  started_at timestamptz not null default now(),
  submitted_by uuid,
  submitted_by_name text,
  submitted_at timestamptz,
  unique (company_id, id),
  foreign key (company_id, inventory_id) references public.inv_inventories (company_id, id) on delete cascade
);
-- Un solo conteo abierto por inventario: varias personas pueden completarlo.
create unique index inv_counts_one_open on public.inv_counts (inventory_id) where status = 'in_progress';

create table public.inv_count_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  inventory_id uuid not null,
  count_id uuid not null,
  product_id uuid not null,
  counted_qty integer check (counted_qty >= 0),
  expected_qty integer,
  note text,
  counted_by uuid,
  counted_by_name text,
  counted_at timestamptz,
  unique (count_id, product_id),
  foreign key (company_id, count_id) references public.inv_counts (company_id, id) on delete cascade,
  foreign key (company_id, product_id) references public.inv_products (company_id, id)
);

create table public.inv_adjustments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  inventory_id uuid not null,
  product_id uuid not null,
  count_id uuid not null,
  expected_qty integer not null,
  counted_qty integer not null check (counted_qty >= 0),
  -- Cantidad a aplicar si se aprueba: contado - esperado al enviar el conteo.
  delta integer not null check (delta <> 0),
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_by uuid not null,
  requested_by_name text,
  requested_at timestamptz not null default now(),
  reviewed_by uuid,
  reviewed_by_name text,
  reviewed_at timestamptz,
  review_note text,
  unique (company_id, id),
  unique (count_id, product_id),
  foreign key (company_id, product_id) references public.inv_products (company_id, id),
  foreign key (company_id, count_id) references public.inv_counts (company_id, id),
  check ((status = 'pending') = (reviewed_by is null))
);
create index inv_adjustments_inventory_idx on public.inv_adjustments (inventory_id, status);

-- ---------------------------------------------------------------------------
-- Idempotencia y auditoría
-- ---------------------------------------------------------------------------

-- Cada operación del cliente trae un request_id. Si la respuesta se pierde y el
-- cliente reintenta, el servidor devuelve el resultado guardado sin repetir nada.
create table public.inv_requests (
  company_id uuid not null references public.companies(id) on delete cascade,
  request_id uuid not null,
  user_id uuid not null,
  action text not null,
  result jsonb,
  created_at timestamptz not null default now(),
  primary key (company_id, request_id)
);

create table public.inv_audit (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  at timestamptz not null default now(),
  user_id uuid not null,
  user_name text,
  action text not null,
  entity text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb
);
create index inv_audit_company_idx on public.inv_audit (company_id, at desc);

-- Los movimientos enlazan, dentro de la misma empresa, con su recepción o ajuste.
alter table public.inv_movements
  add foreign key (company_id, receipt_id) references public.inv_receipts (company_id, id),
  add foreign key (company_id, adjustment_id) references public.inv_adjustments (company_id, id);

-- ---------------------------------------------------------------------------
-- Integridad: los movimientos y la auditoría no se modifican ni se borran
-- ---------------------------------------------------------------------------

create function public.inv_block_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'inv:immutable'
    using errcode = 'P0001',
          detail = 'Los registros históricos no se modifican ni se borran. Usa una corrección compensatoria.';
end;
$$;

create trigger inv_movements_immutable
before update or delete on public.inv_movements
for each row execute function public.inv_block_change();
create trigger inv_movements_no_truncate
before truncate on public.inv_movements
for each statement execute function public.inv_block_change();
create trigger inv_audit_immutable
before update or delete on public.inv_audit
for each row execute function public.inv_block_change();
create trigger inv_audit_no_truncate
before truncate on public.inv_audit
for each statement execute function public.inv_block_change();

-- Stock = suma de movimientos. La fila de stock se bloquea al actualizarla, de
-- modo que dos movimientos simultáneos sobre el mismo producto se serializan, y
-- el CHECK (qty >= 0) impide en la base cualquier stock negativo.
create function public.inv_apply_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  loop
    update public.inv_stock s
    set qty = s.qty + new.qty, updated_at = now()
    where s.product_id = new.product_id
      and s.location_id = new.location_id
      and s.lot_key = coalesce(new.lot_id, '00000000-0000-0000-0000-000000000000'::uuid);
    exit when found;

    begin
      insert into public.inv_stock (company_id, inventory_id, product_id, location_id, lot_id, qty)
      values (new.company_id, new.inventory_id, new.product_id, new.location_id, new.lot_id, new.qty);
      exit;
    exception when unique_violation then
      -- Otra transacción creó la fila al mismo tiempo: se reintenta como actualización.
      null;
    end;
  end loop;
  return new;
end;
$$;

create trigger inv_movements_apply_stock
after insert on public.inv_movements
for each row execute function public.inv_apply_stock();

create trigger inv_inventories_updated_at before update on public.inv_inventories
for each row execute function public.set_updated_at();
create trigger inv_products_updated_at before update on public.inv_products
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Seguridad: lectura por RLS (empresa + área del inventario); sin escritura directa
-- ---------------------------------------------------------------------------

-- ¿Puede la persona que llama leer este inventario? El administrador activo de
-- la empresa, o una jefatura activa cuya área sea la asignada al inventario.
create function public.inv_can_read(p_company_id uuid, p_inventory_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_company_admin(p_company_id)
    or exists (
      select 1
      from public.inv_inventories i
      where i.id = p_inventory_id
        and i.company_id = p_company_id
        and i.active
        and i.area = public.sc_caller_chief_area(p_company_id)
    );
$$;

revoke all on function public.inv_can_read(uuid, uuid) from public, anon;
grant execute on function public.inv_can_read(uuid, uuid) to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'inv_inventories', 'inv_locations', 'inv_products', 'inv_lots', 'inv_stock', 'inv_movements',
    'inv_receipts', 'inv_receipt_lines', 'inv_counts', 'inv_count_lines', 'inv_adjustments',
    'inv_requests', 'inv_audit'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
  end loop;

  -- Tablas que las jefaturas pueden leer en los inventarios de su área.
  foreach t in array array[
    'inv_locations', 'inv_products', 'inv_lots', 'inv_stock', 'inv_movements',
    'inv_receipts', 'inv_receipt_lines', 'inv_counts', 'inv_count_lines', 'inv_adjustments'
  ] loop
    execute format('grant select on table public.%I to authenticated', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.inv_can_read(company_id, inventory_id))',
      t || '_select', t
    );
  end loop;
end;
$$;

grant select on table public.inv_inventories to authenticated;
create policy inv_inventories_select on public.inv_inventories
  for select to authenticated using (public.inv_can_read(company_id, id));

-- La auditoría solo la consulta el administrador. inv_requests no se expone.
grant select on table public.inv_audit to authenticated;
create policy inv_audit_select on public.inv_audit
  for select to authenticated using (public.is_company_admin(company_id));
