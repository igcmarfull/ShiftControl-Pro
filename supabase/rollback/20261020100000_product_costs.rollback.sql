-- Revierte 20261020100000_product_costs.sql. Se pierde el historial de costos cargado.
drop function if exists public.inv_cost_history(uuid, uuid);
drop function if exists public.inv_costs_overview(uuid, uuid);
drop function if exists public.inv_cost_void(uuid, uuid, text);
drop function if exists public.inv_cost_register(uuid, uuid, jsonb, jsonb);
drop table if exists public.inv_product_costs;
