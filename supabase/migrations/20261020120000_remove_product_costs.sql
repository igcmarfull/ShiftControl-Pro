-- Quita los costos por producto de Inventarios (20261020100000_product_costs.sql).
-- La función se retiró de la pantalla; la tabla no tenía datos cargados. Se ejecuta a mano en el editor SQL.
drop function if exists public.inv_cost_history(uuid, uuid);
drop function if exists public.inv_costs_overview(uuid, uuid);
drop function if exists public.inv_cost_void(uuid, uuid, text);
drop function if exists public.inv_cost_register(uuid, uuid, jsonb, jsonb);
drop table if exists public.inv_product_costs;
