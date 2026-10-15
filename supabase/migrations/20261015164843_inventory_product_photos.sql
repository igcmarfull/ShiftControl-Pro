-- Fotos de productos de Inventarios.
--
-- Cambio aditivo: los productos sin foto siguen funcionando igual.
--   1. Columna opcional inv_products.image_path (ruta en Storage).
--   2. inv_set_product_image: guarda o quita la ruta (solo administrador, con control de versión y auditoría).
--   3. inv_list_products devuelve image_path.
--   4. Bucket privado shiftcontrol-product-photos con políticas:
--        leer  -> administrador o jefa del área dueña del inventario (inv_can_read)
--        subir / cambiar / borrar -> solo administrador de la empresa
--      Ruta: <empresa>/<inventario>/<producto>/<archivo>.webp
--
-- Reversión (en este orden):
--   drop policy "shiftcontrol_product_photos_select" on storage.objects;
--   drop policy "shiftcontrol_product_photos_insert" on storage.objects;
--   drop policy "shiftcontrol_product_photos_update" on storage.objects;
--   drop policy "shiftcontrol_product_photos_delete" on storage.objects;
--   drop function public.can_read_product_photo_path(text);
--   drop function public.can_manage_product_photo_path(text);
--   drop function public.inv_set_product_image(uuid, text, integer);
--   -- volver a crear inv_list_products desde 20261015000300_inventory_reads.sql (sin image_path)
--   alter table public.inv_products drop constraint inv_products_image_path_chk;
--   alter table public.inv_products drop column image_path;
--   delete from storage.objects where bucket_id = 'shiftcontrol-product-photos';
--   delete from storage.buckets where id = 'shiftcontrol-product-photos';

-- 1. Columna ---------------------------------------------------------------
alter table public.inv_products add column image_path text;
alter table public.inv_products add constraint inv_products_image_path_chk
  check (
    image_path is null
    or (
      length(image_path) <= 300
      and image_path like company_id::text || '/' || inventory_id::text || '/' || id::text || '/%'
    )
  );

-- 2. Guardar / quitar la foto ----------------------------------------------
create function public.inv_set_product_image(p_product_id uuid, p_image_path text, p_expected_version integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.inv_products;
  v_new public.inv_products;
  v_path text := nullif(trim(coalesce(p_image_path, '')), '');
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
  if v_path is not null
     and v_path not like v_p.company_id::text || '/' || v_p.inventory_id::text || '/' || v_p.id::text || '/%' then
    perform public.inv_fail('invalid_image', 'La foto no pertenece a este producto.');
  end if;
  update public.inv_products set image_path = v_path, version = version + 1
  where id = v_p.id returning * into v_new;
  perform public.inv_log(v_p.company_id, 'product.image', 'product', v_p.id,
    jsonb_build_object('code', v_p.code, 'has_image', v_path is not null));
  return to_jsonb(v_new);
end;
$$;

revoke all on function public.inv_set_product_image(uuid, text, integer) from public, anon;
grant execute on function public.inv_set_product_image(uuid, text, integer) to authenticated;

-- 3. inv_list_products con image_path (mismo cuerpo que antes + un campo) ---
create or replace function public.inv_list_products(p_inventory_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with today as (select (now() at time zone 'America/Santiago')::date as d),
  inv as (select * from public.inv_inventories where id = p_inventory_id),
  rows as (
    select s.product_id,
           sum(s.qty)::integer as total,
           min(l.expires_on) filter (where s.qty > 0) as next_exp,
           jsonb_agg(jsonb_build_object(
             'location_id', s.location_id, 'location', loc.name, 'lot_id', s.lot_id, 'lot_code', l.lot_code,
             'expires_on', l.expires_on, 'qty', s.qty)
             order by l.expires_on nulls last, loc.name) filter (where s.qty > 0) as detail
    from public.inv_stock s
    join public.inv_locations loc on loc.id = s.location_id
    left join public.inv_lots l on l.id = s.lot_id
    where s.inventory_id = p_inventory_id
    group by s.product_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'image_path', p.image_path, 'code', p.code, 'barcode', p.barcode, 'name', p.name, 'category', p.category, 'brand', p.brand,
    'control_unit', p.control_unit, 'presentation', p.presentation,
    'default_location_id', p.default_location_id, 'default_location', dl.name,
    'min_stock', p.min_stock, 'tracks_expiry', p.tracks_expiry, 'receive_unit', p.receive_unit,
    'receive_factor', p.receive_factor, 'attrs', p.attrs, 'active', p.active, 'version', p.version,
    'created_at', p.created_at, 'created_by_name', p.created_by_name,
    'stock', coalesce(r.total, 0), 'stock_detail', coalesce(r.detail, '[]'::jsonb), 'next_expiry', r.next_exp,
    'status', case when coalesce(r.total, 0) <= 0 then 'out' when coalesce(r.total, 0) < p.min_stock then 'low' else 'ok' end,
    'expiry', case
      when r.next_exp is null then null
      when r.next_exp < today.d then 'expired'
      when r.next_exp <= today.d + inv.expiry_alert_days then 'soon' end
  ) order by p.name), '[]'::jsonb)
  from public.inv_products p
  cross join today
  cross join inv
  left join rows r on r.product_id = p.id
  left join public.inv_locations dl on dl.id = p.default_location_id
  where p.inventory_id = p_inventory_id;
$$;

-- 4. Bucket y políticas -----------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shiftcontrol-product-photos',
  'shiftcontrol-product-photos',
  false,
  307200,
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Leer: administrador o jefa del área del inventario.
create function public.can_read_product_photo_path(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when f[1] ~* '^[0-9a-f-]{36}$' and f[2] ~* '^[0-9a-f-]{36}$' and array_length(f, 1) >= 3
        then public.inv_can_read(f[1]::uuid, f[2]::uuid)
      else false
    end
    from (select storage.foldername(p_name) as f) x
  ), false);
$$;

-- Subir, cambiar o borrar: solo administrador y solo en un inventario de su empresa.
create function public.can_manage_product_photo_path(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when f[1] ~* '^[0-9a-f-]{36}$' and f[2] ~* '^[0-9a-f-]{36}$' and f[3] ~* '^[0-9a-f-]{36}$'
           and array_length(f, 1) >= 3
        then public.is_company_admin(f[1]::uuid)
             and exists (
               select 1 from public.inv_products p
               where p.id = f[3]::uuid and p.inventory_id = f[2]::uuid and p.company_id = f[1]::uuid
             )
      else false
    end
    from (select storage.foldername(p_name) as f) x
  ), false);
$$;

revoke all on function public.can_read_product_photo_path(text) from public, anon;
revoke all on function public.can_manage_product_photo_path(text) from public, anon;
grant execute on function public.can_read_product_photo_path(text) to authenticated;
grant execute on function public.can_manage_product_photo_path(text) to authenticated;

create policy "shiftcontrol_product_photos_select"
on storage.objects for select to authenticated
using (bucket_id = 'shiftcontrol-product-photos' and public.can_read_product_photo_path(name));

create policy "shiftcontrol_product_photos_insert"
on storage.objects for insert to authenticated
with check (bucket_id = 'shiftcontrol-product-photos' and public.can_manage_product_photo_path(name));

create policy "shiftcontrol_product_photos_update"
on storage.objects for update to authenticated
using (bucket_id = 'shiftcontrol-product-photos' and public.can_manage_product_photo_path(name))
with check (bucket_id = 'shiftcontrol-product-photos' and public.can_manage_product_photo_path(name));

create policy "shiftcontrol_product_photos_delete"
on storage.objects for delete to authenticated
using (bucket_id = 'shiftcontrol-product-photos' and public.can_manage_product_photo_path(name));
