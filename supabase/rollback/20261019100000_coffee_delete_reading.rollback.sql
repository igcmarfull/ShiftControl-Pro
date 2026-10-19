-- Revierte 20261019100000_coffee_delete_reading.sql. Las lecturas ya anuladas no se recuperan (quedan en la auditoría).
drop function if exists public.coffee_delete_reading(uuid, uuid, date, text);
