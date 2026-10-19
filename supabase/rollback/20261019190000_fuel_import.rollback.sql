-- Revierte 20261019190000_fuel_import.sql. Los días ya importados se conservan.
drop function if exists public.fuel_sales_import(uuid, jsonb);
