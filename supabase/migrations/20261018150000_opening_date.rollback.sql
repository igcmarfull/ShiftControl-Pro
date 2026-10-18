-- Revierte: quita la versión con fecha (los saldos ya cargados con fecha se conservan). La de 3 parámetros sigue vigente.
drop function if exists public.inv_register_opening(uuid, uuid, jsonb, date);
