# Análisis de ventas

Pantalla «Análisis de ventas» (grupo Administración, solo administrador). Se sube el «Reporte de Transacciones Realizadas» del POS (Excel) y se buscan patrones en las ventas con cliente: quién le vende a quién, montos redondos, anulaciones y ventas fuera del turno planificado. Las alertas son **indicios para revisar, no pruebas**.

## Comportamiento activo
- **Lectura:** el `.xlsx` se lee en el navegador con SheetJS (`xlsx@0.18.5` desde jsDelivr, como «Importar ventas»). Se busca la fila de títulos (Fecha Transacción, Operador, Cliente, $Total ticket…); solo se consideran las filas «Sale». Hasta 8 MB.
- **No guarda nada en el servidor:** ni las transacciones ni las alertas. No toca ventas, inventario ni el estado principal. Esto se eligió porque el reporte trae RUT de personas.
- **Lo que sí se recuerda, en el navegador** (`localStorage`, clave `shiftcontrol.salesAnalysis.prefs`): la sensibilidad de las alertas, qué trabajador de la app es cada nombre del POS y los «clientes de confianza». No se comparte entre navegadores.
- **Alertas** (cada una se abre y muestra las ventas que la componen):
  - *Cliente repetido* (Media/Alta/Para mirar): una operadora vende N veces (por omisión 3) al mismo cliente, o ese cliente es el X % (por omisión 40 %) de lo que vendió ella, con al menos 5 ventas. Es Alta si cumple ambas y pasa del 60 %.
  - *Mismo día* (Para mirar): un cliente con 3 o más ventas el mismo día.
  - *Montos redondos* (Para mirar): el 70 % o más de las ventas de una operadora (con al menos 5) son múltiplos de $10.000. Cargar montos redondos es normal; sirve para comparar entre operadoras.
  - *Anulada* (Para mirar): venta anulada, indicando si se emitió otra igual en los 15 minutos siguientes.
  - *Fuera de turno*: cruza la hora de cada venta con la planificación. Alta si la persona tenía licencia, vacaciones, permiso o ausencia; Media si era su día de descanso; Para mirar si vendió en otro turno (puede ser un reemplazo). Usa `ShiftSchedule` (A 23:00–07:00 lleva la fecha del día en que termina). Solo se evalúa si el nombre del POS está relacionado con un trabajador y ese trabajador tiene planificación ese mes.
- **Sensibilidad editable** en «Sensibilidad de las alertas» (ventas al mismo cliente, concentración %, montos redondos %).
- **Clientes de confianza:** desde una alerta de cliente se puede marcar «no avisar»; deja de generar alertas de cliente repetido y de mismo día hasta quitarlo de la lista.
- **Operadoras ↔ trabajadores:** el POS usa nombres completos; se sugiere el trabajador cuando todas las palabras de su nombre están en el del POS y es único. Se puede cambiar a mano.
- **Excel:** «Descargar alertas (Excel)» con tres hojas (Alertas, Operadoras, Clientes); no incluye las transacciones.

## Límites
- El reporte no trae litros, producto ni patente: no se puede saber si el cliente realmente cargó combustible. Para eso hace falta cruzarlo con otro reporte del POS.
- Con pocos días de datos las alertas son pocas; el análisis rinde con un mes.
- No hay historial: cada análisis se hace al subir el archivo. Guardar resultados requeriría una tabla (no existe).

## Archivos
- `src/modules/sales-analysis/sales-analysis-calc.js`: lectura de filas y reglas (sin DOM). Pruebas con datos ficticios: `node src/modules/sales-analysis/sales-analysis-calc.test.js`.
- `src/modules/sales-analysis/sales-analysis.js` y `.css`: pantalla, preferencias y descarga (prefijo `sva-`).
- `index.html`: botón de menú (`role-admin-visible`), sección `#salesAnalysis`, hoja de estilos y scripts; `src/v20-interface.js` (menú del celular) y `src/ui-papel.js` (ícono).
- Sin migraciones ni tablas. La vista queda solo para ADMIN porque los demás roles abren únicamente las vistas de su lista.
