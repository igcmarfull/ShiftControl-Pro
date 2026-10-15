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

## Subir factura en PDF

- **Activo:** botón «Subir factura (PDF)» en Facturas y compras (`src/modules/invoices/invoice-pdf.js`, `window.InvoicePdf`). También se puede arrastrar el PDF sobre «Nueva factura».
- Lee solo PDFs **con texto** (factura electrónica). Completa proveedor, RUT, número, emisión, vencimiento y total, adjunta el PDF como respaldo y no guarda nada: la persona revisa y guarda. Avisa si la factura (mismo RUT y número) ya existe, y ofrece crear el proveedor si su RUT no está registrado.
- Cuenta las líneas de detalle (código, nombre, cantidad, precio) y avisa si su suma no coincide con el monto neto.
- Un PDF escaneado o una foto no se puede leer: se adjunta igual y los datos se escriben a mano.
- **Dependencia externa:** carga `pdfjs-dist@3.11.174` desde `cdn.jsdelivr.net` solo al usar la función (la app ya carga Supabase desde ese mismo CDN). Sin conexión a ese CDN la lectura falla y el formulario se completa a mano.
- **Verificado:** con una factura electrónica de BAT Chile (28 líneas; la suma coincide con el neto) y con un PDF sin texto. Otros formatos de proveedor no se han probado: RUT, folio, fechas y total son estándar, pero un diseño distinto puede dejar campos vacíos.
- **Trabajo futuro (no implementado):** leer fotos y escaneos; guardar el costo de compra por producto.

## Pasar la factura a stock

- **Código en el repositorio:** `src/modules/invoices/invoice-stock.js` (`window.InvoiceStock`). Se abre desde el aviso «Pasar N líneas a stock» que aparece al leer un PDF (requiere permiso de la vista Inventarios y el proveedor registrado).
- **Migración `20261015210000_supplier_product_codes.sql`: aplicada en producción** (verificado: RLS activa, una política de lectura, sin escritura directa, función solo para `authenticated`). Crea `supplier_product_codes` (código del proveedor → producto) y `supplier_codes_save`. Si faltara, la pantalla funciona pero no recuerda los emparejamientos y los pide cada vez. Reversión: `supabase/rollback/20261015210000_supplier_product_codes.rollback.sql`. Pruebas SQL locales: `supabase/tests/proveedores_codigos_local.sql`.
- Cada línea se empareja con (1) el código recordado de ese proveedor o (2) una sugerencia por nombre que la persona debe **confirmar**. Productos de 10, 18 o 20 cajetillas nunca se emparejan entre sí. Líneas sin producto no suman stock; el administrador puede crear el producto desde la pantalla (la jefa no: `inv_save_product` es solo del administrador).
- Se asume que **cada línea viene en cartones** (confirmado por el administrador para BAT) y entra con la unidad de recepción del producto (`receive_unit` y `receive_factor`, p. ej. cartón × 10). Un producto sin unidad de recepción o que controla vencimiento no se suma desde aquí.
- El stock se registra con la recepción de Inventarios (`inv_receive`), una por inventario, con el proveedor y el N° de factura: repetir la misma factura es rechazado por el servidor. Tras sumar, se recuerdan los códigos usados.
- La recepción no queda enlazada a la factura guardada (se hace al leer el PDF) y no guarda costos. Solo se puede pasar a stock mientras el PDF está cargado en el formulario; no se relee desde facturas ya guardadas.
- **Verificado:** Playwright con Supabase simulado y la factura de BAT (28 líneas): emparejamiento, confirmar, crear producto, suma por unidad de recepción, error de factura duplicada y recuerdo de códigos. Sin probar: con rol de jefa y una factura real guardada en producción. El emparejamiento por nombre sugirió 15 de 28 líneas de esa factura; el resto se elige a mano la primera vez.
