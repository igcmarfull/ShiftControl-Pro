-- Reversión de 20261017120000_sales_history.sql.
-- Borra el historial de ventas guardado para la página «Ventas de lubricantes».
drop function if exists public.sales_history_save(uuid, jsonb);
drop table if exists public.sales_history;
