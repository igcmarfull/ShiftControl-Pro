-- Revierte 20261019140000_fuel_commissions.sql. Borra los litros cargados y el contrato guardado.
drop function if exists public.fuel_contract_save(uuid, jsonb);
drop function if exists public.fuel_sales_save(uuid, date, integer, integer, integer);
drop table if exists public.fuel_contract;
drop table if exists public.fuel_sales;
drop function if exists public.fuel_can_access(uuid);
