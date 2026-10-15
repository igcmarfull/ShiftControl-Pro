# Proveedores

Módulo `src/modules/suppliers/`. Vista `suppliers` (menú Tienda → Proveedores, solo administrador).

## Estado

- **Código activo en el repositorio:** lista, ficha, importación desde facturas, logos, selector en «Nueva factura».
- **Migración `20261015190000_suppliers.sql`: aplicada en producción** (verificado: RLS activa, bucket privado, 4 políticas de storage, funciones solo para `authenticated`). Si faltara, la vista muestra «Aún no está habilitado» y «Nueva factura» conserva el campo de texto libre. El nombre del archivo del repositorio puede diferir de la versión registrada por Supabase.
- **Trabajo futuro (no implementado):** vincular productos o marcas a proveedores y listas de pedido.

## Almacenamiento

Fuera de `state` y de `save()`: tabla `public.suppliers` en Supabase, escrita solo por RPC (`supplier_save`, `supplier_set_active`, `supplier_set_logo`, `supplier_import`). Las facturas siguen en `state.invoices`.

- Administrador: crea y edita. Jefa: solo crea (desde «Nueva factura»).
- RUT único por empresa (`rut_key`); sin RUT, el nombre es único.
- Logos en el bucket privado `shiftcontrol-supplier-logos`, ruta `<empresa>/<proveedor>/<uuid>.webp`, URLs firmadas.
- Reversión: `supabase/rollback/20261015190000_suppliers.rollback.sql`. Pruebas SQL locales: `supabase/tests/proveedores_local.sql`.

## Relación con las facturas

`SupplierModule.forInvoice(factura)` busca por `supplierId`, luego por RUT normalizado y al final por nombre. Las facturas antiguas de texto siguen funcionando. Las facturas nuevas guardan `supplierId`. El logo del proveedor registrado tiene prioridad sobre `logoProveedor` en Facturas.

«Nueva factura» (`suppliers-invoice.js`): menú de proveedores sobre el campo existente; al elegir completa RUT y categoría, y calcula el vencimiento como emisión + días de crédito (editable). «＋ Crear proveedor» usa `supplier_save`.

## Verificación realizada

Playwright con Supabase simulado (importar, editar, logo, duplicados, inactivos, móvil, selector en factura) y 40 comprobaciones SQL en Postgres local. Tras aplicarla en producción solo se comprobó el esquema y los permisos; no se creó ningún proveedor real desde la aplicación.
