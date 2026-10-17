# Máquinas de café (cuadratura del numeral)

Módulo `src/modules/coffee/` (vista `coffee`, menú Tienda → Máquinas de café). Lo ven y lo anotan el administrador y la jefa de **tienda**; solo el administrador configura máquinas y corrige una lectura ya guardada.

## Estado

- **Código en el repositorio:** pantalla, formulario del numeral, configuración de máquinas, cuadratura, y registro de las ventas de máquinas en la importación de ventas (`inventory-sales.js`).
- **Migración `20261016180000_coffee_machines.sql`: aplicada en producción (15-10-2026).** Verificado: 4 tablas con RLS de lectura, `coffee_can_access`, `coffee_machine_save`, `coffee_save_reading`, `coffee_reconcile` y la nueva `inv_apply_sales`, todas ejecutables solo por usuarios con sesión. Se aplicó en partes porque la conexión de Claude Code se quedaba sin responder con SQL que contiene `DELETE` o `DROP`: `coffee_machine_save` se ejecutó a mano en el editor SQL de Supabase (`supabase/manual/20261016180000_coffee_machine_save.sql`, que además borró tres funciones de prueba). Por eso el historial de migraciones de Supabase tiene varias entradas `coffee_machines_*` en lugar de una.
- **No integrado (trabajo futuro):** alerta en la Bandeja ADMIN, cuadratura por turno (el informe del POS viene por día), reportes en CSV.

## Qué hace

El día operativo empieza a las 23:00 del día anterior: el turno A es 23:00–07:00, el B 07:00–15:00 y el C 15:00–23:00, y los tres se anotan con la fecha del día operativo. El numeral es el de fin de turno, así que el cierre del día es el del turno C. El formulario muestra estos horarios.

Cada máquina (por ejemplo Marley y Nescafé) tiene un nombre, una tolerancia en vasos y los códigos del POS que pasan por ella. Se anota el numeral de cada turno (A, B o C), pero la cuadratura es **diaria**: el numeral de un día es el más alto de sus lecturas (el numeral solo sube) y no importa de qué turno venga. Entre dos días consecutivos con lectura, la pantalla compara cuánto avanzó el numeral con los vasos vendidos en los días contables de ese tramo (desde el día siguiente a la lectura anterior hasta el día de la actual).

**Gráfico:** barras de la diferencia por día (numeral menos vasos vendidos) con la banda de tolerancia; verde si cuadra, rojo si está fuera. Solo incluye los tramos que se pueden cuadrar (no los pendientes ni los reinicios) y los últimos 21. SVG propio, sin librería; el detalle está en la tabla.

Estados: «Cuadra», «Fuera de tolerancia» (la diferencia pasa la tolerancia), «El numeral bajó» (posible reinicio; no se cuadra) y «Faltan ventas por cargar» (algún día del tramo no tiene un informe de ventas importado).

**Precisión:** como el informe del POS corta alrededor de las 22:57 y el numeral se anota en el turno que lo envían, la diferencia puede incluir vasos de otra franja horaria. Se decidió que no importa el turno; la tolerancia absorbe esa diferencia.

## Cómo se cargan las ventas de café

Con el mismo Excel del POS y el botón «Importar ventas», que está en Inventarios (Tienda y Cigarrillos) y en la propia pantalla de Máquinas de café. La importación reconoce los códigos de cada máquina y los guarda aparte (sin descontar stock); en la vista previa aparecen como «líneas de máquinas de café». Subir el mismo día dos veces no duplica.

## Logo de la máquina

- **Código en el repositorio:** «Subir logo / Cambiar logo / Quitar logo» en «Configurar máquina» (solo administrador), con el mismo procesado de imagen que los logos de proveedores (`InvoiceLogos.processLogo`: un logo con fondo de color llena todo el recuadro). Se muestra en el encabezado de la máquina; sin logo queda el ícono de taza.
- **Migración `20261016210000_coffee_machine_logos.sql`: aplicada en producción (15-10-2026), en dos entradas (`coffee_machine_logos` y `coffee_machine_logos_remove_policy`).** Verificado: bucket privado con límite de 200 KB, 4 políticas, función solo para `authenticated`. Agrega `coffee_machines.logo_path`, `coffee_machine_set_logo` y el bucket privado `shiftcontrol-machine-logos` (leen administrador y jefa de tienda; sube, reemplaza y borra solo el administrador, en la carpeta de una máquina existente). Reversión: `supabase/rollback/20261016210000_coffee_machine_logos.rollback.sql`. Pruebas SQL locales: `supabase/tests/maquinas_cafe_logos_local.sql`.
- **Corregir una lectura:** volver a anotar la misma fecha y el mismo turno la reemplaza (solo administrador). No hay botón de eliminar ni lista de lecturas.

## Datos

Tablas `coffee_machines`, `coffee_machine_codes`, `coffee_readings` y `coffee_sales`, con RLS de lectura para administrador y jefa de tienda; las escrituras solo por funciones (`coffee_machine_save`, `coffee_save_reading`, y `inv_apply_sales` para las ventas). `coffee_reconcile` calcula la cuadratura en el servidor. Reversión: `supabase/rollback/20261016180000_coffee_machines.rollback.sql` (se niega a correr si ya hay lecturas o ventas). Pruebas SQL locales: `supabase/tests/maquinas_cafe_local.sql`.

## Reglas

- Los códigos de una máquina **no descuentan stock** ni necesitan un producto en Inventarios: la importación de ventas los guarda aparte en `coffee_sales`. Un código no puede pertenecer a dos máquinas.
- Cada vaso suma 1 en el numeral (configurable por código: 1 a 20).
- Una lectura por máquina, fecha y turno (se pueden anotar varios turnos el mismo día). La jefa no puede corregir una lectura guardada.
- Los productos de café creados en Tienda (por vaso) siguen activos pero la importación los ignora mientras su código pertenezca a una máquina.

## Verificación realizada

36 comprobaciones SQL en Postgres local (más las 30 de ventas, que siguen pasando) y Playwright con Supabase simulado (crear máquinas, código duplicado, lecturas, repetir lectura, estados pendiente / fuera de tolerancia / cuadra, escritorio y celular). No se probó contra Supabase real, con el rol de jefa en el navegador, ni con una importación real de ventas con códigos de máquina.

## Vista en celular (≤820px)

- Los cuatro recuadros de resumen se reemplazan por una tarjeta con anillo «cuadran» y cuatro cifras (fuera de tolerancia, sin ventas cargadas, vasos sin vender, vasos vendidos). En escritorio no cambia.
- Cada tramo es una fila compacta con barra de color (verde cuadra, rojo fuera de tolerancia, gris sin ventas), diferencia grande a la derecha y Numeral / Avanzó / Vendidos debajo. Se oculta «antes N» (queda en la vista de escritorio).
- «+ Nueva máquina» y «Importar ventas» se ocultan en celular; siguen en escritorio. Crear máquinas desde el celular no está disponible por ahora.
- Un tramo con numeral avanzado y 0 vasos vendidos se muestra como «Sin ventas cargadas» (gris), no como fuera de tolerancia, y no suma a «fuera de tolerancia» ni a la diferencia. Es una regla de presentación en `coffee.js` (`effStatus`); el estado del servidor no cambia.
- El gráfico «Diferencia por día» y la cabecera de la máquina no cambian.

## Reimportar ventas del café (migración 20261017210000)

- Antes, si el informe traía otra cantidad para un día y código ya guardados en `coffee_sales`, la importación lo mostraba como «con otra cantidad (no se tocan)» y lo dejaba igual. Eso impedía corregir un día importado con un informe incompleto o antes de agregar un código a la máquina.
- Ahora la cantidad de una venta de café ya guardada se **actualiza cuando el informe trae más vasos** (el café no mueve stock, no hay riesgo de descontar dos veces). Si trae **menos**, se conserva lo guardado: suele ser el informe del día en curso, incompleto, y no debe pisar uno más completo. El resumen informa «N ventas de café actualizadas» y «N con menos vasos (sin cambios)»; el servidor devuelve `machine_updated`, `machine_lower` y `machine_changes` (código, fecha, antes, ahora).
- Un mismo valor sigue contando como «ya cargada». Un código nuevo en un día ya importado se inserta como línea nueva.
- Los productos con stock (cigarrillos, lubricantes, tienda) **no cambian**: una cantidad distinta sigue sin tocarse, para no duplicar descuentos.
- Reversión: `supabase/rollback/20261017210000_coffee_sales_update.rollback.sql`. Pruebas: `supabase/tests/maquinas_cafe_local.sql` (37 comprobaciones).
