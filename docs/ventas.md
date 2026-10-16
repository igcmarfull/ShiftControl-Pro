# Ventas

Módulo `src/modules/sales/` (vista `sales`, menú Tienda → Ventas, solo administrador). Muestra cuánto se vende por producto, a partir del informe del POS, en cuatro pestañas: **Lubricantes**, **Cigarros**, **Energéticas** (productos de Tienda con categoría «Energéticas») y **Tienda**. Es independiente del stock: no descuenta ni modifica inventario. El café no entra aquí: se cuadra en «Máquinas de café» (`docs/maquinas-cafe.md`).

## Estado

- **Código en el repositorio:** pantalla con pestañas, selector de período (últimos 7 días, últimos 30 días, cada mes con datos, todo el período), comparación con el período anterior de igual largo, evolución por mes, importación que guarda el historial, migraciones y pruebas.
- **Migración `20261017120000_sales_history.sql`: aplicada en producción (16-10-2026)**, en dos partes (`sales_history_table` y `sales_history_save_fn`). Verificado: tabla con RLS y una política de lectura, función sin acceso para `anon`.
- **Migración `20261017180000_sales_history_skip_coffee.sql`: aplicada en producción (16-10-2026)** como `sales_history_skip_coffee`. Hace que `sales_history_save` omita los códigos de máquinas de café. Verificado: la función sigue sin acceso para `anon` y contiene la omisión. La pantalla además oculta los productos de café de la pestaña Tienda.
- **No integrado (trabajo futuro):** entrada única «Importar ventas del POS» en el menú, exportación, pestañas para otros inventarios.
- La pantalla antes se llamaba «Ventas de lubricantes» (PR anterior); ahora es general y reemplaza a esa vista.

## Cómo llegan los datos

«Importar ventas» (Inventarios, Máquinas de café o esta pantalla) lee el «Informe de Ventas por Artículos». Además de descontar stock como hasta ahora, envía todas las líneas con unidades y `$ Venta Total Neta` a `sales_history_save`, que guarda las de productos activos de inventarios a los que el usuario tiene acceso. Una fila por empresa, fecha y código del POS; repetir el archivo actualiza la misma fila. El historial se guarda aunque el producto no tenga saldo inicial. El archivo no se almacena: solo se guardan esas filas.

El historial parte desde la primera vez que se sube cada informe con esta versión: las ventas importadas antes no tienen monto guardado y se completan volviendo a subir el archivo.

## Qué muestra

Tarjetas (vendido en $, unidades, producto que más vende, productos con ventas) con la variación contra el período anterior; gráfico de venta por día (por semana si el período pasa de 62 días); evolución por mes (hasta 12 meses); y una tabla por producto con unidades, $, variación, unidades por semana y participación. Un mes en curso se compara con los mismos días del mes anterior. Se carga por pestaña, con los últimos 400 días.

## Pruebas

`supabase/tests/ventas_historial_local.sql` (base local desechable) y reversiones en `supabase/rollback/`.
