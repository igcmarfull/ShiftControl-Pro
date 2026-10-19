# Comisiones de combustible (pantalla «Comisiones», solo administrador)

Módulo `src/modules/fuel/` (`fuel.js`, `fuel-calc.js`, `fuel.css`), vista `fuel` (menú Administración → Comisiones). Solo el administrador la ve y la usa: `ShiftControlPermissions` concede todas las vistas al administrador y ninguna jefatura tiene `fuel`; en el servidor las tablas y las funciones exigen administrador.

## Qué hace
- **Cargar litros** por día en tres líneas separadas: **retail** (gasolinas y diésel), **flota** y **kerosene**. Una fila por día; volver a cargar el mismo día lo reemplaza. No acepta fechas futuras ni litros negativos. Corregir un día: tocarlo en «Días cargados».
- **Contrato** (botón «Contrato»): vigencia, pivote, tarifas y fijos de cada tramo, kerosene, flota e IVA. Si la empresa no tiene un contrato guardado, la pantalla usa los valores del addendum y avisa.
- Muestra, para el mes elegido: litros retail y avance hacia el pivote, comisión estimada al cierre (neto, + IVA y con IVA, desglosada), proyección de litros, flota y kerosene con su monto, gráfico del acumulado contra el pivote con proyección punteada, barras por día, tramo actual («cómo vamos») y los días cargados.

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
- No hay función para borrar un día: un día mal cargado se corrige sobrescribiéndolo (o con ceros).

## Verificación
- SQL local: `supabase/tests/combustible_local.sql` (28 comprobaciones: carga, reemplazo, validaciones, permisos, aislamiento entre empresas, contrato y auditoría).
- Cálculo: `node src/modules/fuel/fuel-calc.test.js` (21 comprobaciones con los números del contrato, el empalme del pivote, la flota fuera del pivote, proyección, meses terminados y fuera de contrato).
- Navegador con Supabase simulado: abrir la pantalla, cargar un día nuevo, corregirlo, cambiar de fecha en el formulario, editar el contrato, cambiar de mes (fuera de contrato y sin datos), claro/oscuro y celular, y que la jefa no pueda abrirla. No se probó contra Supabase real ni con las cifras reales del administrador.
