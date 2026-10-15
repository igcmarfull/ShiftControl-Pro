-- Proveedores de la empresa.
--
-- Cambio aditivo: las facturas siguen guardando el nombre y el RUT del proveedor; esta tabla
-- agrega la ficha (contacto, crédito, categoría habitual, logo) y alimenta el selector de
-- «Nueva factura».
--   1. public.is_company_member: cualquier miembro activo (administrador o jefa).
--   2. public.suppliers (RLS): leen los miembros; las escrituras solo por funciones.
--   3. supplier_save (administrador crea y edita; una jefa solo puede crear),
--      supplier_set_active, supplier_set_logo y supplier_import (solo administrador).
--   4. Bucket privado shiftcontrol-supplier-logos: leen los miembros, solo el administrador sube.
--      Ruta: <empresa>/<proveedor>/<archivo>.webp
--
-- Reversión: supabase/rollback/20261015190000_suppliers.rollback.sql

-- 1. Miembro activo ---------------------------------------------------------
create or replace function public.is_company_member(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.company_memberships m
    where m.company_id = p_company_id and m.user_id = (select auth.uid()) and m.active = true
  );
$$;
revoke all on function public.is_company_member(uuid) from public, anon;
grant execute on function public.is_company_member(uuid) to authenticated;

-- 2. Tabla ------------------------------------------------------------------
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null check (length(trim(name)) > 0 and length(name) <= 120),
  rut text not null default '' check (length(rut) <= 20),
  -- RUT sin puntos ni guion: clave para no duplicar proveedores.
  rut_key text generated always as (nullif(lower(regexp_replace(rut, '[^0-9kK]', '', 'g')), '')) stored,
  category text not null default '' check (length(category) <= 60),
  seller_name text not null default '' check (length(seller_name) <= 120),
  phone text not null default '' check (length(phone) <= 40),
  email text not null default '' check (length(email) <= 160),
  credit_days integer check (credit_days between 0 and 365),
  payment_method text not null default '' check (length(payment_method) <= 60),
  notes text not null default '' check (length(notes) <= 1000),
  logo_path text,
  active boolean not null default true,
  version integer not null default 1,
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint suppliers_logo_path_chk check (
    logo_path is null
    or (length(logo_path) <= 300 and logo_path like company_id::text || '/' || id::text || '/%')
  )
);
create unique index suppliers_company_rut_key on public.suppliers (company_id, rut_key) where rut_key is not null;
create unique index suppliers_company_name_key on public.suppliers (company_id, lower(trim(name))) where rut_key is null;
create index suppliers_company_idx on public.suppliers (company_id, active);

alter table public.suppliers enable row level security;
revoke all on table public.suppliers from anon, authenticated;
grant select on table public.suppliers to authenticated;
create policy "suppliers_select_for_members"
on public.suppliers for select to authenticated
using (public.is_company_member(company_id));

-- 3. Funciones --------------------------------------------------------------
create function public.sup_fail(p_code text, p_message text, p_errcode text default 'P0001')
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception using message = 'sup:' || p_code, hint = p_message, errcode = p_errcode;
end;
$$;
revoke all on function public.sup_fail(text, text, text) from public, anon, authenticated;

-- Crea o edita un proveedor. Un campo que no viene en el JSON conserva su valor actual.
create function public.supplier_save(p_company_id uuid, p_supplier jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role text;
  v_user_name text;
  v_id uuid := nullif(p_supplier->>'id', '')::uuid;
  v_old public.suppliers;
  v_new public.suppliers;
  v_name text; v_rut text; v_category text; v_seller text; v_phone text; v_email text;
  v_method text; v_notes text; v_credit integer; v_constraint text;
begin
  select m.role into v_role from public.company_memberships m
  where m.company_id = p_company_id and m.user_id = v_uid and m.active = true;
  if v_uid is null or v_role is null then
    perform public.sup_fail('forbidden', 'No tienes acceso a esta empresa.', '42501');
  end if;
  select p.display_name into v_user_name from public.profiles p where p.id = v_uid;

  if v_id is not null then
    if v_role <> 'ADMIN' then
      perform public.sup_fail('forbidden', 'Solo el administrador edita proveedores.', '42501');
    end if;
    select * into v_old from public.suppliers where id = v_id and company_id = p_company_id for update;
    if not found then
      perform public.sup_fail('not_found', 'El proveedor no existe.', '42501');
    end if;
    if (p_supplier->>'expected_version') is null or (p_supplier->>'expected_version')::integer <> v_old.version then
      perform public.sup_fail('version_conflict', 'Otro usuario modificó este proveedor. Vuelve a cargarlo.');
    end if;
  end if;

  v_name := trim(case when p_supplier ? 'name' then coalesce(p_supplier->>'name', '') else coalesce(v_old.name, '') end);
  v_rut := trim(case when p_supplier ? 'rut' then coalesce(p_supplier->>'rut', '') else coalesce(v_old.rut, '') end);
  v_category := trim(case when p_supplier ? 'category' then coalesce(p_supplier->>'category', '') else coalesce(v_old.category, '') end);
  v_seller := trim(case when p_supplier ? 'seller_name' then coalesce(p_supplier->>'seller_name', '') else coalesce(v_old.seller_name, '') end);
  v_phone := trim(case when p_supplier ? 'phone' then coalesce(p_supplier->>'phone', '') else coalesce(v_old.phone, '') end);
  v_email := trim(case when p_supplier ? 'email' then coalesce(p_supplier->>'email', '') else coalesce(v_old.email, '') end);
  v_method := trim(case when p_supplier ? 'payment_method' then coalesce(p_supplier->>'payment_method', '') else coalesce(v_old.payment_method, '') end);
  v_notes := trim(case when p_supplier ? 'notes' then coalesce(p_supplier->>'notes', '') else coalesce(v_old.notes, '') end);
  v_credit := case when p_supplier ? 'credit_days' then nullif(trim(coalesce(p_supplier->>'credit_days', '')), '')::integer else v_old.credit_days end;

  if v_name = '' then perform public.sup_fail('name_required', 'El proveedor necesita un nombre.'); end if;
  if v_email <> '' and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    perform public.sup_fail('invalid_email', 'El correo no es válido.');
  end if;
  if v_credit is not null and (v_credit < 0 or v_credit > 365) then
    perform public.sup_fail('invalid_credit', 'Los días de crédito deben estar entre 0 y 365.');
  end if;

  begin
    if v_id is null then
      insert into public.suppliers (company_id, name, rut, category, seller_name, phone, email, credit_days,
                                    payment_method, notes, created_by, created_by_name)
      values (p_company_id, v_name, v_rut, v_category, v_seller, v_phone, v_email, v_credit,
              v_method, v_notes, v_uid, v_user_name)
      returning * into v_new;
    else
      update public.suppliers s
      set name = v_name, rut = v_rut, category = v_category, seller_name = v_seller, phone = v_phone,
          email = v_email, credit_days = v_credit, payment_method = v_method, notes = v_notes,
          version = s.version + 1, updated_at = now()
      where s.id = v_old.id
      returning * into v_new;
    end if;
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'suppliers_company_rut_key' then
      perform public.sup_fail('duplicate_rut', 'Ya existe un proveedor con ese RUT.');
    end if;
    perform public.sup_fail('duplicate_name', 'Ya existe un proveedor con ese nombre.');
  end;
  return to_jsonb(v_new);
end;
$$;

create function public.supplier_set_active(p_supplier_id uuid, p_active boolean, p_expected_version integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s public.suppliers;
  v_new public.suppliers;
begin
  select * into v_s from public.suppliers where id = p_supplier_id for update;
  if not found then
    perform public.sup_fail('not_found', 'El proveedor no existe.', '42501');
  end if;
  if not public.is_company_admin(v_s.company_id) then
    perform public.sup_fail('forbidden', 'Solo el administrador puede hacerlo.', '42501');
  end if;
  if p_expected_version is distinct from v_s.version then
    perform public.sup_fail('version_conflict', 'Otro usuario modificó este proveedor. Vuelve a cargarlo.');
  end if;
  update public.suppliers set active = p_active, version = version + 1, updated_at = now()
  where id = v_s.id returning * into v_new;
  return to_jsonb(v_new);
end;
$$;

create function public.supplier_set_logo(p_supplier_id uuid, p_logo_path text, p_expected_version integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s public.suppliers;
  v_new public.suppliers;
  v_path text := nullif(trim(coalesce(p_logo_path, '')), '');
begin
  select * into v_s from public.suppliers where id = p_supplier_id for update;
  if not found then
    perform public.sup_fail('not_found', 'El proveedor no existe.', '42501');
  end if;
  if not public.is_company_admin(v_s.company_id) then
    perform public.sup_fail('forbidden', 'Solo el administrador puede hacerlo.', '42501');
  end if;
  if p_expected_version is distinct from v_s.version then
    perform public.sup_fail('version_conflict', 'Otro usuario modificó este proveedor. Vuelve a cargarlo.');
  end if;
  if v_path is not null and v_path not like v_s.company_id::text || '/' || v_s.id::text || '/%' then
    perform public.sup_fail('invalid_logo', 'El logo no pertenece a este proveedor.');
  end if;
  update public.suppliers set logo_path = v_path, version = version + 1, updated_at = now()
  where id = v_s.id returning * into v_new;
  return to_jsonb(v_new);
end;
$$;

-- Crea los proveedores que aún no existen (por RUT o, sin RUT, por nombre). Solo administrador.
create function public.supplier_import(p_company_id uuid, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_user_name text;
  v_item jsonb;
  v_name text; v_rut text; v_key text;
  v_created integer := 0; v_skipped integer := 0;
begin
  if v_uid is null or not public.is_company_admin(p_company_id) then
    perform public.sup_fail('forbidden', 'Solo el administrador puede importar proveedores.', '42501');
  end if;
  if jsonb_typeof(p_items) <> 'array' then
    perform public.sup_fail('invalid_items', 'La lista de proveedores no es válida.');
  end if;
  select p.display_name into v_user_name from public.profiles p where p.id = v_uid;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_name := trim(coalesce(v_item->>'name', ''));
    v_rut := trim(coalesce(v_item->>'rut', ''));
    v_key := nullif(lower(regexp_replace(v_rut, '[^0-9kK]', '', 'g')), '');
    if v_name = '' then
      v_skipped := v_skipped + 1;
    elsif exists (
      select 1 from public.suppliers s
      where s.company_id = p_company_id
        and ((v_key is not null and s.rut_key = v_key) or lower(trim(s.name)) = lower(v_name))
    ) then
      v_skipped := v_skipped + 1;
    else
      insert into public.suppliers (company_id, name, rut, category, created_by, created_by_name)
      values (p_company_id, left(v_name, 120), left(v_rut, 20), left(trim(coalesce(v_item->>'category', '')), 60), v_uid, v_user_name);
      v_created := v_created + 1;
    end if;
  end loop;
  return jsonb_build_object('created', v_created, 'skipped', v_skipped);
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'supplier_save(uuid, jsonb)', 'supplier_set_active(uuid, boolean, integer)',
    'supplier_set_logo(uuid, text, integer)', 'supplier_import(uuid, jsonb)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;

-- 4. Bucket de logos --------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shiftcontrol-supplier-logos', 'shiftcontrol-supplier-logos', false, 204800,
        array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create function public.can_read_supplier_logo_path(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when f[1] ~* '^[0-9a-f-]{36}$' and array_length(f, 1) >= 2 then public.is_company_member(f[1]::uuid)
      else false
    end
    from (select storage.foldername(p_name) as f) x
  ), false);
$$;

create function public.can_manage_supplier_logo_path(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when f[1] ~* '^[0-9a-f-]{36}$' and f[2] ~* '^[0-9a-f-]{36}$' and array_length(f, 1) >= 2
        then public.is_company_admin(f[1]::uuid)
             and exists (select 1 from public.suppliers s where s.id = f[2]::uuid and s.company_id = f[1]::uuid)
      else false
    end
    from (select storage.foldername(p_name) as f) x
  ), false);
$$;

revoke all on function public.can_read_supplier_logo_path(text) from public, anon;
revoke all on function public.can_manage_supplier_logo_path(text) from public, anon;
grant execute on function public.can_read_supplier_logo_path(text) to authenticated;
grant execute on function public.can_manage_supplier_logo_path(text) to authenticated;

create policy "shiftcontrol_supplier_logos_select"
on storage.objects for select to authenticated
using (bucket_id = 'shiftcontrol-supplier-logos' and public.can_read_supplier_logo_path(name));
create policy "shiftcontrol_supplier_logos_insert"
on storage.objects for insert to authenticated
with check (bucket_id = 'shiftcontrol-supplier-logos' and public.can_manage_supplier_logo_path(name));
create policy "shiftcontrol_supplier_logos_update"
on storage.objects for update to authenticated
using (bucket_id = 'shiftcontrol-supplier-logos' and public.can_manage_supplier_logo_path(name))
with check (bucket_id = 'shiftcontrol-supplier-logos' and public.can_manage_supplier_logo_path(name));
create policy "shiftcontrol_supplier_logos_delete"
on storage.objects for delete to authenticated
using (bucket_id = 'shiftcontrol-supplier-logos' and public.can_manage_supplier_logo_path(name));
