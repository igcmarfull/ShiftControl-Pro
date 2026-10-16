# Ventas de lubricantes

Módulo `src/modules/lubricants/` (vista `lubricants`, menú Tienda → Ventas de lubricantes, solo administrador). Muestra cuánto se vende del inventario **Lubricantes**, día a día, a partir del informe del POS. Es independiente del stock: no descuenta ni modifica inventario.

## Estado

- **Código en el repositorio:** pantalla, importación que guarda el historial, migración y pruebas.
- **Migración `20261017120000_sales_history.sql`: aplicada en producción (16-10-2026)**, en dos partes (`sales_history_table` y `sales_history_save_fn`). Verificado: tabla con RLS y una política de lectura, función sin acceso para `anon`. Si la migración no estuviera, la pantalla avisa que no está habilitada y la importación sigue funcionando (el guardado del historial falla en silencio).
- **No integrado (trabajo futuro):** historial de otros inventarios (la tabla ya guarda cualquier producto, pero solo hay pantalla para Lubricantes), comparación entre períodos, exportación.

## Cómo llegan los datos

«Importar ventas» (Inventarios o esta pantalla) lee el «Informe de Ventas por Artículos». Además de descontar stock como hasta ahora, envía todas las líneas con unidades y `$ Venta Total Neta` a `sales_history_save`, que guarda las de productos activos de inventarios a los que el usuario tiene acceso. Una fila por empresa, fecha y código del POS; repetir el archivo actualiza la misma fila. El historial se guarda aunque el producto no tenga saldo inicial.

## Qué muestra

Tarjetas (vendido en $, unidades, producto que más vende, productos con ventas), gráfico de venta por día (por semana si el período pasa de 62 días), filtros por categoría y por período (7 días, 30 días, todo; se miden hasta la última venta cargada) y una tabla por producto con unidades, $, días con venta, unidades por semana y participación.

## Pruebas

`supabase/tests/ventas_historial_local.sql` (base local desechable) y reversión en `supabase/rollback/20261017120000_sales_history.rollback.sql`.
