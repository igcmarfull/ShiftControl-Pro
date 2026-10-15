-- Reversión de 20261016120000_inventory_sales_import.sql.
-- Se niega a continuar si ya hay movimientos de venta: borrarlos alteraría el stock y su historial.
do $$
begin
  if exists (select 1 from public.inv_movements where kind = 'sale') then
    raise exception 'Hay movimientos de venta registrados. Corrígelos desde Inventarios antes de revertir.';
  end if;
end $$;
drop function if exists public.inv_apply_sales(uuid, uuid, jsonb);
drop table if exists public.inv_sales_lines;
alter table public.inv_movements drop constraint inv_movements_kind_check;
alter table public.inv_movements add constraint inv_movements_kind_check check (kind in (
  'opening', 'receipt', 'issue', 'waste', 'transfer_out', 'transfer_in', 'adjustment', 'reversal'
));
