# Máquinas de café (cuadratura del numeral)

Módulo `src/modules/coffee/` (vista `coffee`, menú Tienda → Máquinas de café). Lo ven y lo anotan el administrador y la jefa de **tienda**; solo el administrador configura máquinas y corrige una lectura ya guardada.

## Estado

- **Código en el repositorio:** pantalla, formulario del numeral, configuración de máquinas, cuadratura, y registro de las ventas de máquinas en la importación de ventas (`inventory-sales.js`).
- **Migración `20261016180000_coffee_machines.sql`: NO aplicada en producción.** Sin ella la pantalla dice «todavía no están habilitadas» y la importación de ventas ignora los códigos de café como cualquier código sin producto.
- **No integrado (trabajo futuro):** alerta en la Bandeja ADMIN, cuadratura por turno (el informe del POS viene por día), reportes en CSV.

## Qué hace

Cada máquina (por ejemplo Marley y Nescafé) tiene un nombre, un **turno de cierre** (A, B o C: el que coincide con el corte del sistema diario), una tolerancia en vasos y los códigos del POS que pasan por ella. Se anota el numeral de cada turno. La cuadratura usa solo las lecturas del turno de cierre: entre dos lecturas consecutivas compara cuánto avanzó el numeral con los vasos vendidos en los días contables de ese tramo (desde el día siguiente a la lectura anterior hasta el día de la actual).

Estados: «Cuadra», «Fuera de tolerancia» (la diferencia pasa la tolerancia), «El numeral bajó» (posible reinicio; no se cuadra) y «Faltan ventas por cargar» (algún día del tramo no tiene un informe de ventas importado). Una máquina sin turno de cierre pide configurarlo.

## Datos

Tablas `coffee_machines`, `coffee_machine_codes`, `coffee_readings` y `coffee_sales`, con RLS de lectura para administrador y jefa de tienda; las escrituras solo por funciones (`coffee_machine_save`, `coffee_save_reading`, y `inv_apply_sales` para las ventas). `coffee_reconcile` calcula la cuadratura en el servidor. Reversión: `supabase/rollback/20261016180000_coffee_machines.rollback.sql` (se niega a correr si ya hay lecturas o ventas). Pruebas SQL locales: `supabase/tests/maquinas_cafe_local.sql`.

## Reglas

- Los códigos de una máquina **no descuentan stock** ni necesitan un producto en Inventarios: la importación de ventas los guarda aparte en `coffee_sales`. Un código no puede pertenecer a dos máquinas.
- Cada vaso suma 1 en el numeral (configurable por código: 1 a 20).
- Una lectura por máquina, fecha y turno. La jefa no puede corregir una lectura guardada.
- Los productos de café creados en Tienda (por vaso) siguen activos pero la importación los ignora mientras su código pertenezca a una máquina.

## Verificación realizada

36 comprobaciones SQL en Postgres local (más las 30 de ventas, que siguen pasando) y Playwright con Supabase simulado (crear máquinas, código duplicado, lecturas, repetir lectura, estados pendiente / fuera de tolerancia / cuadra, escritorio y celular). No se probó contra Supabase real, con el rol de jefa en el navegador, ni con una importación real de ventas con códigos de máquina.
