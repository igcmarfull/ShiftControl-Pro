-- Reversión de 20261015120000_inventory_product_photos.sql
--
-- NO es una migración: está fuera de supabase/migrations/ a propósito. Se
-- ejecuta a mano, solo si se decide quitar las fotos de productos.
--
-- ATENCIÓN: borra las fotos subidas y la columna image_path. El resto de
-- Inventarios (productos, stock, movimientos) no cambia.
-- Antes, si hay fotos que quieras conservar, descárgalas desde Storage.

begin;

drop policy if exists "shiftcontrol_product_photos_select" on storage.objects;
drop policy if exists "shiftcontrol_product_photos_insert" on storage.objects;
drop policy if exists "shiftcontrol_product_photos_update" on storage.objects;
drop policy if exists "shiftcontrol_product_photos_delete" on storage.objects;

drop function if exists public.can_read_product_photo_path(text);
drop function if exists public.can_manage_product_photo_path(text);
drop function if exists public.inv_set_product_image(uuid, text, integer);

-- inv_list_products vuelve a su versión original (sin image_path). Debe ir ANTES
-- de quitar la columna, porque la versión nueva la lee.
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
    'id', p.id, 'code', p.code, 'barcode', p.barcode, 'name', p.name, 'category', p.category, 'brand', p.brand,
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

alter table public.inv_products drop constraint if exists inv_products_image_path_chk;
alter table public.inv_products drop column if exists image_path;

delete from storage.objects where bucket_id = 'shiftcontrol-product-photos';
delete from storage.buckets where id = 'shiftcontrol-product-photos';

commit;
