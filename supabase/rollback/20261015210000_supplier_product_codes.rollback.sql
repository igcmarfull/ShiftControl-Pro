-- Reversión de 20261015210000_supplier_product_codes.sql.
-- Solo borra los códigos recordados; no toca productos, stock ni recepciones.
drop function if exists public.supplier_codes_save(uuid, uuid, jsonb);
drop table if exists public.supplier_product_codes;
