# Reportes en Excel (Reportes → Exportar)

Módulo `src/modules/exports/report-excel.js` (`window.ReportExcel`) y menú `src/ui-report-export.js` + `src/report-export.css`. Solo agrega una salida; los CSV, el PDF de «Imprimir reporte» y el cálculo de los reportes no cambian.

## Comportamiento activo
- En la página Reportes, los botones de exportar pasan a **«Exportar ▾»** (el de arriba, que cambia con la pestaña, y el de la tarjeta «Reporte contabilidad»). El menú ofrece **Excel (.xlsx)** o el **CSV de siempre** (`exportMonthlyCSV` / `exportAccountingCSV`, con su propio chequeo de permisos).
- Cada pestaña exporta **su propio libro**, igual que sus CSV: **Reporte operativo** → `reporte_operativo_<año>_<mes>.xlsx` (hoja Operativo, `reports.operational`) y **Reporte contabilidad** → `reporte_contabilidad_<año>_<mes>.xlsx` (hoja Contabilidad, `reports.financial`, solo administrador), para el mes y año elegidos arriba:
  - **Contabilidad:** trabajador, RUT, cargo, área, días asistidos, ausencias, domingos y feriados trabajados, licencia médica, vacaciones y atraso en h:mm. **No** lleva jornadas adicionales ni monto (decisión del administrador).
  - **Operativo:** turnos A/B/C, descansos, estados, total de turnos y, solo con `reports.financial`, jornadas adicionales y monto pendiente.
- Los datos salen de las mismas funciones que los reportes en pantalla (`accountingRows`, `monthlyOperationalRows`, `reportPrintContext`); RUT, cargo y área se leen de `EmployeeModule`. El RUT se normaliza a `12.345.678-9` (vacío si no tiene el largo mínimo).
- Formato: logo y encabezado Prosercom, columnas con ancho fijo, filtros, títulos fijos, totales con `SUBTOTAL` (se recalculan al filtrar) y `[h]:mm` para el atraso, alertas por color (ausencias en rojo, licencias en ámbar) y montos como `"$"#,##0`. Impresión en **A4 horizontal**, ajustada al ancho, con títulos repetidos y pie con fecha y «Página X de Y».
- Cada descarga queda en el historial (`log`, `save`, `renderAudit`).

## Dependencias
- **ExcelJS 4.4.0** desde `cdnjs.cloudflare.com`, cargada solo al exportar (igual que SheetJS en la importación de ventas). Sin conexión a esa CDN el Excel no se genera y se avisa; el CSV sigue funcionando.
- El logo se lee de `src/assets/prosercom-logo.png`; si falla, el libro se genera sin logo.

## Verificación hecha y pendiente
Probado en navegador con datos simulados como administrador y como jefa (menú, una descarga distinta por pestaña, historial, CSV desde el menú, cierre con Escape, hojas y columnas según permiso) y revisando el archivo (hojas, fórmulas, filtros, títulos, tamaño de papel) y su impresión en PDF. **No** se probó con una sesión real de jefa ni abriendo el archivo en Microsoft Excel (sí se revisó con LibreOffice y openpyxl). Los totales se escriben con fórmula y su valor calculado.

## Trabajo futuro propuesto (no implementado)
Excel de facturas y compras (resumen por proveedor y detalle), y de finanzas, depósitos y auditoría.
