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

Pestañas y filtros (período y categoría o marca) en la misma fila; tarjeta principal «Vendido» con variación contra el período anterior y mini tendencia, más unidades, producto que más vende y productos con ventas; gráfico de venta por día (barras suaves, mejor día destacado; por semana si el período pasa de 62 días); venta por mes (hasta 6 meses, el mes en curso marcado como parcial); y una tabla por producto con iniciales y color por categoría, unidades, $, variación, mini tendencia y participación. Los productos sin ventas quedan plegados al final. Un mes en curso se compara con los mismos días del mes anterior. Se carga por pestaña, con los últimos 400 días. En celular las tarjetas y la tabla se compactan.

## Pruebas

`supabase/tests/ventas_historial_local.sql` (base local desechable) y reversiones en `supabase/rollback/`.

## Pestaña «Café» (migración 20261018120000, pendiente de aplicar en producción)

- Quinta pestaña, con el mismo diseño que Cigarros: total en pesos, unidades (vasos), producto más vendido, gráfico por día y por mes, y tabla por producto con tendencia. El filtro de categoría pasa a ser por **máquina** (aparece si hay más de una).
- Los datos salen de `coffee_sales` (no de `sales_history`): la migración le agrega `amount` (venta neta en pesos) y `description` (nombre del producto en el POS), ambos opcionales. La importación del POS los guarda junto con los vasos.
- Los días importados antes de la migración quedan sin monto ni nombre (se ven como «Código 219113» y $0). Basta **volver a subir el mismo informe**: con la misma cantidad, la importación completa el monto y el nombre sin tocar lo demás (`machine_filled`). La pantalla avisa cuántas ventas de café aún no los tienen.
- Reglas de la importación de café: más vasos que lo guardado actualiza cantidad, monto y nombre; menos vasos no pisa nada; un monto o nombre ya guardado no se reemplaza con la misma cantidad.
- La pestaña aparece solo si hay al menos una máquina activa. No hay historial anterior a lo que se haya importado.
- Reversión: `supabase/rollback/20261018120000_coffee_sales_amount.rollback.sql` (vuelve a la función anterior y deja las columnas). Pruebas: `supabase/tests/maquinas_cafe_local.sql` (46 comprobaciones).
- **Orden de despliegue:** aplicar la migración primero (es aditiva y compatible con la pantalla actual) y después fusionar el código; si la pantalla nueva llega antes, la consulta de `amount` falla.

## Pestañas y gráficos (17-10-2026)

- Pestañas: Lubricantes · Cigarros · **Energéticas** · **Hot dogs** · **Tienda** · Café. Energéticas y Hot dogs salen del inventario de Tienda por la categoría del producto (`Energéticas`, `Hot dog` o un nombre que contenga «hot dog»). **Tienda** muestra el resto de los productos de ese inventario, sin energéticas, sin hot dogs y sin café, así que ya no repite lo de las otras pestañas.
- Solo aparecen en Ventas los productos que están en el catálogo del inventario: una venta de un código que no existe en Inventarios se ignora al importar. Para ver más productos de la tienda hay que crearlos primero en Inventarios (o ampliar la importación a productos fuera del catálogo; no hecho).
- «Venta por día»: tocar o pasar el mouse por una barra muestra su día, el monto y las unidades en una línea bajo el gráfico (por defecto, el día de más ventas). En pantallas anchas con hasta 20 barras, todas llevan su valor; en celular solo la más alta y el resto por toque.
- «Por mes»: cada mes se puede tocar para abrir su propio gráfico por día. Un mes con unidades pero sin monto (ventas de café anteriores a la migración de montos) dice «sin monto» y muestra las unidades.
