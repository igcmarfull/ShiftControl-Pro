# Comisiones de combustible (pantalla «Comisiones», solo administrador)

Módulo `src/modules/fuel/` (`fuel.js`, `fuel-calc.js`, `fuel.css`), vista `fuel` (menú Administración → Comisiones). Solo el administrador la ve y la usa: `ShiftControlPermissions` concede todas las vistas al administrador y ninguna jefatura tiene `fuel`; en el servidor las tablas y las funciones exigen administrador.

## Qué hace
- **Cargar litros** por día en tres líneas separadas: **retail** (gasolinas y diésel), **flota** y **kerosene**. Una fila por día; volver a cargar el mismo día lo reemplaza. No acepta fechas futuras ni litros negativos. Corregir un día: tocarlo en «Días cargados».
- **Importar informe** (botón «Importar informe»): lee el «Resumen de venta combustible» del POS en Excel, el de **Tarjeta flota**, el **general** (retail y kerosene) o los dos a la vez. Reconoce cuál es cuál por el «Tipo de venta» del encabezado y toma el período del encabezado: los días del período sin ventas de esa línea cargan como cero. Muestra una vista previa por día (nuevo, cambia o igual, con el valor anterior) y recién al confirmar guarda, con `fuel_sales_import`. Cada informe toca solo sus columnas: el de flota cambia solo la flota; el general cambia retail y kerosene; subir uno no pisa lo del otro. Se puede subir cada 7 días o cuando se necesite: los días repetidos se reemplazan.
- **Contrato** (botón «Contrato»): vigencia, pivote, tarifas y fijos de cada tramo, kerosene, flota e IVA. Si la empresa no tiene un contrato guardado, la pantalla usa los valores del addendum y avisa.
- Muestra, para el mes elegido: litros retail y avance hacia el pivote, comisión estimada al cierre (neto, + IVA y con IVA, desglosada), proyección de litros, flota y kerosene con su monto, gráfico del acumulado contra el pivote con proyección punteada, barras por día, tramo actual («cómo vamos») y los días cargados.

## Cómo se leen los informes del POS
- Una línea del informe es un producto, un día y un precio. Se suman por día y se redondean al litro (los litros del POS traen decimales).
- **General (solo «General» y «Descuento»):** Kerosene (por nombre de producto) va a kerosene; todo lo demás (gasolinas 93, 95, 97 y diésel) va a retail. **Flota:** todo el informe va a flota.
- **«Prueba surtidor» y «Handling» no cuentan como retail** (decisión del administrador). La columna «Tipo de Venta» trae «-» en todas las líneas, así que no se pueden separar dentro del archivo. Por eso el informe general **se rechaza** si el filtro «Tipo de venta» de su encabezado incluye cualquiera de los dos, con la instrucción de sacarlo de nuevo en el POS marcando solo **«General» y «Descuento»**. Si el informe no incluye «Descuento», se importa con un aviso. El informe de flota no tiene este problema.
- «Descuento» son ventas normales con descuento (en octubre, el 99% de los litros se vende con precio menor al original) y sí cuentan.
- No se aceptan fechas futuras ni archivos que no sean ese informe; dos informes del mismo tipo a la vez se rechazan.

## Reglas del contrato (addendum C-3602-04, 01-07-2026 al 31-12-2026)
Mes calendario, montos netos (+ IVA):
- Retail hasta 450 m³: **$5.000.000 fijos + $19,9 por litro**.
- Retail sobre 450 m³: **$13.956.000 fijos + $35 por cada litro que pase de 450 m³**.
- En el pivote ambas fórmulas casi coinciden (13.955.000 y 13.956.000): la comisión crece sin saltos.
- **Flota: $5 + IVA por litro, fuera del pivote** (no cuenta para los 450 m³ ni paga la tarifa normal). Dato del administrador, no está en el addendum.
- **Kerosene: $30 + IVA por litro**, fuera del pivote.
- Un mes fuera de la vigencia configurada muestra los litros pero no calcula comisión.

## Proyección
Al ritmo de los días cargados: `litros / días con datos × días del mes`. Los días sin carga entre el 1 y el último cargado se avisan y se toman como un día promedio. Un mes terminado (o con el último día cargado) no se proyecta. La «comisión estimada al cierre» usa esa proyección; «comisión con lo cargado» usa solo lo cargado (el fijo del mes completo más lo variable de lo que va).

## Datos (migración `20261019140000_fuel_commissions.sql`)
- `fuel_sales(company_id, sold_on, retail_l, flota_l, kerosene_l, …)`, única por empresa y día.
- `fuel_contract`, una fila por empresa; la migración la siembra con el addendum para las empresas existentes.
- RLS de solo lectura para el administrador; escrituras solo por `fuel_sales_save` y `fuel_contract_save` (exigen administrador, validan y dejan `fuel.sales` / `fuel.contract` en `inv_audit`). Reversión: `supabase/rollback/20261019140000_fuel_commissions.rollback.sql`.
- `fuel_sales_import(company, filas)` (migración `20261019190000_fuel_import.sql`, rollback en `supabase/rollback/`): carga varios días de una vez con columnas parciales; atómica, solo administrador, deja `fuel.import` en `inv_audit`.
- No hay función para borrar un día: un día mal cargado se corrige sobrescribiéndolo (o con ceros).

## Verificación
- SQL local: `supabase/tests/combustible_local.sql` (39 comprobaciones: carga, reemplazo, validaciones, permisos, aislamiento entre empresas, contrato, importación con columnas parciales y auditoría).
- Lector de informes: `node src/modules/fuel/fuel-import.test.js` (21 comprobaciones, incluido el rechazo de «Prueba surtidor» y «Handling»). Con el informe real de flota de octubre (01 al 17-10) las 17 filas coinciden con una suma independiente (33.837 L). El informe general real de ese período incluye «Prueba surtidor» y «Handling», así que la pantalla lo rechaza; el flujo con el general se probó con una copia de ese archivo con el encabezado corregido (retail 225.789 L, kerosene 2.632 L), que NO es un dato válido para cargar.
- Cálculo: `node src/modules/fuel/fuel-calc.test.js` (21 comprobaciones con los números del contrato, el empalme del pivote, la flota fuera del pivote, proyección, meses terminados y fuera de contrato).
- Navegador con Supabase simulado: importar los informes reales (solo flota, los dos juntos con el general corregido, el general original rechazado, mismo tipo dos veces, archivo equivocado), abrir la pantalla, cargar un día nuevo, corregirlo, cambiar de fecha en el formulario, editar el contrato, cambiar de mes (fuera de contrato y sin datos), claro/oscuro y celular, y que la jefa no pueda abrirla. No se probó contra Supabase real ni con las cifras reales del administrador.
