# Módulo Inventarios

Estado: las tres migraciones están **aplicadas en producción** (sin datos: los inventarios aún no se activaron). La interfaz llega con la publicación de esta rama. En cualquier entorno sin las migraciones, la sección muestra «Aún no está habilitado» y el resto de ShiftControl funciona igual.

## Qué hace

Tres inventarios independientes por empresa:

| Inventario | Unidad de control | Particularidad |
|---|---|---|
| Tienda | unidad | Categorías, ubicaciones y control opcional de lotes y vencimiento (FEFO). |
| Cigarrillos | cajetilla | Se recibe por cartón: `5 cartones × 10 = 50 cajetillas`. El factor es por producto. |
| Lubricantes | unidad | Cada presentación (1 L, 4 L…) es un producto distinto con su propio SKU y stock. |

Funciones: panel con alertas, ficha de producto, recepciones de mercadería (distintas de las facturas), saldo inicial, mermas, salidas justificadas, traslados entre ubicaciones, toma de inventario con diferencias y aprobación del administrador, correcciones compensatorias, historial de movimientos, auditoría, reportes de mermas, faltantes y vencimientos, exportación CSV.

No incluye imágenes de producto ni integración automática con ventas (propuesto para el futuro).

## Reglas de negocio aplicadas por el servidor

- **El stock no se edita**: es la suma de movimientos inmutables. Un trigger mantiene la proyección `inv_stock` y una restricción impide stock negativo.
- **Correcciones**: un movimiento erróneo se corrige con otro de signo contrario (`inv_reverse_movement`); una recepción se anula con movimientos compensatorios (`inv_void_receipt`). Nada se borra ni se sobrescribe.
- **Idempotencia**: cada escritura lleva un `request_id`; un reintento (doble clic, red caída) no duplica el movimiento (`inv_requests`).
- **Recepciones**: una misma factura de un mismo proveedor no puede recibirse dos veces. Recibir no aprueba ni paga la factura del módulo de Facturas.
- **Conteos**: el conteo no muestra el stock del sistema hasta la revisión. Enviarlo crea ajustes pendientes con la diferencia y observación obligatoria; **no cambia el stock**. Al aprobarlo, el administrador aplica un movimiento trazable. Si dos personas cuentan el mismo producto, el servidor detecta el conflicto y no pisa el valor. Hay un solo conteo abierto por inventario.
- **Umbral de autoaprobación** (`auto_approve_max_abs`): por defecto 0, es decir, todo ajuste requiere aprobación.
- **Vencimientos**: consumo FEFO con bloqueo de filas; alerta configurable (`expiry_alert_days`, por defecto 7).
- **Auditoría**: `inv_audit` es inmutable y solo la lee el administrador.

## Permisos

- ADMIN: los tres inventarios, aprobaciones, saldo inicial, correcciones, configuración y auditoría.
- Jefa de Tienda (`CHIEF` área `TIENDA`): Tienda y Cigarrillos.
- Jefa de Isla (`CHIEF` área `ESTACION`): Lubricantes.

La distribución es configurable por inventario (`inv_update_inventory`, campo `area`: `TIENDA` o `ISLA`). **El valor inicial es el de la lista anterior; confirmar antes de activar en producción.**

Todo se valida en Supabase, no en la interfaz: las tablas tienen RLS con lectura mediante `inv_can_read(company_id, inventory_id)`; las escrituras son solo funciones `SECURITY DEFINER` con `search_path` vacío que comprueban empresa, rol y área. No se usa `app_state` ni `localStorage` para datos de inventario (solo un borrador local del conteo en curso, para no perderlo sin red).

## Archivos

Servidor (se aplican en este orden):

1. `supabase/migrations/20261015000100_inventory_core.sql`: 13 tablas `inv_*`, RLS, triggers de inmutabilidad y de stock.
2. `supabase/migrations/20261015000200_inventory_api.sql`: funciones de escritura.
3. `supabase/migrations/20261015000300_inventory_reads.sql`: funciones de lectura.

Interfaz (cargada desde `index.html` después de `src/app/areas.js`):

- `src/modules/inventory/inventory-api.js`: `window.InventoryApi`, envoltorio de las funciones; convierte errores `inv:<código>` en mensajes en español.
- `src/modules/inventory/inventory.js`: `window.InventoryUI`, se pinta dentro de `#inventoryRoot` al activarse la vista `inventory`.
- `src/modules/inventory/inventory.css`: estilos acotados a `.inv-root`.

Integración mínima con lo existente: botón de navegación «Inventarios» (grupo Tienda), `<section id="inventory">`, la vista `inventory` añadida a `CHIEF` y `CHIEF_TIENDA` en `src/app/permissions.js` y un acceso rápido en el Centro de acciones móvil (`src/v20-interface.js`). No se modificó ningún panel ni flujo existente.

## Diseño visual (estilo «Papel»)

Claro, limpio y aireado: superficies planas con línea fina, sombras suaves y color solo en íconos, estados y detalles. Sin imágenes de producto.

- **Tema:** usa las variables de la app, así que sigue el modo claro y el oscuro. En modo claro, los colores de estado usan tonos más profundos (`body.light`) para que se lean sobre blanco.
- **Íconos y gráficos:** SVG en línea (no hay archivos de imagen ni dependencias). Cada inventario tiene su ícono y su color: Tienda verde azulado, Cigarrillos violeta, Lubricantes azul.
- **Anillo de estado** por inventario (normales / bajo mínimo / agotados) y barra de stock con marca del mínimo por producto.
- **Avatares con iniciales** en vez de fotos. El color es estable por categoría, marca o presentación; así un aceite de 1 L y uno de 4 L se distinguen de un vistazo.
- **Franja de resumen** en el Panel: referencias activas, para reponer, por vencer y mermas del mes (suma de lo que ya muestra cada inventario).
- **Filas con franja de color** cuando el producto está bajo el mínimo (ámbar) o agotado (rojo).
- **Celular:** las tablas pasan a tarjetas, la barra del conteo se apoya sobre la barra inferior de ShiftControl y el formulario de recepción cabe sin desbordar.
- **Ajustes:** las medidas y los colores están como variables al inicio de `inventory.css` (radios `--r-*`, colores por inventario `--ac-*`, estados `--inv-*`, sombra `--sh`).

## Activación

1. Migraciones: aplicadas en producción (registradas como `20261015000100/200/300`).
2. Como administrador, abrir Inventarios y pulsar **Activar Inventarios** (ejecuta `inv_setup`; crea los tres inventarios con ubicaciones básicas).
3. Cargar productos y saldo inicial; ajustar el área y el umbral de autoaprobación si se desea.

## Reversión

`supabase/rollback/20261015000100_inventory.rollback.sql` elimina tablas y funciones del módulo en una transacción. **Borra los datos de inventarios**: respaldar antes. Probada localmente (aplicar → revertir → reaplicar).

## Verificación realizada (solo local, con datos ficticios)

No hay suite automatizada en el repositorio; estas pruebas se ejecutaron en un PostgreSQL 16 local con una capa de compatibilidad de Supabase y no forman parte del repositorio salvo los dos primeros archivos:

- `supabase/tests/inventario_local.sql`: 80 comprobaciones (stock, FEFO, idempotencia, permisos, RLS, inmutabilidad, conteos, ajustes, reversas).
- `supabase/tests/inventario_concurrencia.js`: 27 comprobaciones con transacciones simultáneas (sin sobreventa, sin duplicados por reintento, un conteo abierto).
- Navegador (Chromium) con tres perfiles contra esa base: activación, alta de productos, código duplicado, recepción 5 cartones → 50 cajetillas, factura duplicada, SKU 1 L y 4 L independientes, aislamiento Jefa de Isla / Jefa de Tienda, conteo con diferencia, aprobación solo del administrador, sincronización entre perfiles, merma mayor al stock, triple clic, caída de red con reintento sin duplicar, corrección compensatoria, conflicto de conteo, módulo sin migrar, carga sin errores de consola de las 24/16/15 vistas de cada rol, y ausencia de desbordamiento horizontal en 390 px y 820 px.

Después del rediseño visual se repitió la batería de navegador (31 comprobaciones, todas correctas) y se revisaron capturas de todas las vistas en modo claro, modo oscuro y celular.

No verificado: ejecución contra el Supabase de producción, lector de códigos de barras en un dispositivo real, impresión.

## Decisiones tomadas

- Áreas: Tienda y Cigarrillos → Jefa de Tienda; Lubricantes → Jefa de Isla.
- Conteo ciego en los tres inventarios.
- Umbral de autoaprobación 0: todo ajuste lo aprueba el administrador.
- Integración con ventas y fotos de producto: fuera de alcance.
