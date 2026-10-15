-- Códigos de proveedor → producto de Inventarios.
--
-- Cambio aditivo: cuando se pasa una factura en PDF a stock, cada línea trae el código del
-- proveedor (por ejemplo, el de BAT). Esta tabla recuerda a qué producto del inventario
-- corresponde, para que la próxima factura del mismo proveedor entre sin volver a confirmarlo.
--   1. public.supplier_product_codes (RLS): leen los miembros; escribe solo supplier_codes_save.
--   2. supplier_codes_save: administrador o jefa; una jefa solo asocia productos del inventario
--      de su área (Tienda o Isla), igual que Inventarios.
--
-- Reversión: supabase/rollback/20261015210000_supplier_product_codes.rollback.sql

create table public.supplier_product_codes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  supplier_code text not null check (length(trim(supplier_code)) > 0 and length(supplier_code) <= 40),
  product_id uuid not null references public.inv_products (id) on delete cascade,
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supplier_id, supplier_code)
);
create index supplier_product_codes_company_idx on public.supplier_product_codes (company_id, product_id);

alter table public.supplier_product_codes enable row level security;
revoke all on table public.supplier_product_codes from anon, authenticated;
grant select on table public.supplier_product_codes to authenticated;
create policy "supplier_product_codes_select_for_members"
on public.supplier_product_codes for select to authenticated
using (public.is_company_member(company_id));

-- Guarda (o corrige) los códigos de un proveedor. p_items: [{"code": "...", "product_id": "..."}]
create function public.supplier_codes_save(p_company_id uuid, p_supplier_id uuid, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
  v_item jsonb;
  v_code text;
  v_product uuid;
  v_area text;
  v_saved integer := 0;
begin
  select * into a from public.inv_actor(p_company_id);
  if not exists (select 1 from public.suppliers s where s.id = p_supplier_id and s.company_id = p_company_id and s.active) then
    perform public.sup_fail('not_found', 'El proveedor no existe o está inactivo.', '42501');
  end if;
  if jsonb_typeof(p_items) <> 'array' then
    perform public.sup_fail('invalid_items', 'La lista de códigos no es válida.');
  end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_code := left(trim(coalesce(v_item->>'code', '')), 40);
    v_product := nullif(v_item->>'product_id', '')::uuid;
    if v_code = '' or v_product is null then
      perform public.sup_fail('invalid_items', 'Cada código necesita un producto.');
    end if;
    select i.area into v_area
    from public.inv_products p join public.inv_inventories i on i.id = p.inventory_id
    where p.id = v_product and p.company_id = p_company_id and p.active;
    if v_area is null then
      perform public.sup_fail('invalid_product', 'Hay un producto que no existe o está inactivo.');
    end if;
    if a.role <> 'ADMIN' and v_area is distinct from a.area then
      perform public.sup_fail('forbidden', 'Tu perfil no tiene asignado ese inventario.', '42501');
    end if;
    insert into public.supplier_product_codes (company_id, supplier_id, supplier_code, product_id, created_by, created_by_name)
    values (p_company_id, p_supplier_id, v_code, v_product, a.user_id, a.user_name)
    on conflict (supplier_id, supplier_code)
    do update set product_id = excluded.product_id, updated_at = now();
    v_saved := v_saved + 1;
  end loop;
  return jsonb_build_object('saved', v_saved);
end;
$$;
revoke all on function public.supplier_codes_save(uuid, uuid, jsonb) from public, anon;
grant execute on function public.supplier_codes_save(uuid, uuid, jsonb) to authenticated;
