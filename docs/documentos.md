# Documentos

Sección «Documentos» (grupo Administración, solo administrador): biblioteca de modelos de contratos, finiquitos, cartas y constancias con el membrete de Prosercom. Se elige un modelo, se completa un formulario y se descarga en PDF o Word. **No guarda nada en el servidor**: el documento se arma en el navegador.

## Comportamiento activo
- **Modelos (8):** contrato de trabajo (14 cláusulas + anexo de obligaciones y prohibiciones, opcional), anexo de contrato, finiquito, carta de aviso de término, carta de amonestación, constancia de entrega de vehículo, certificado de trabajo y comprobante de vacaciones.
- **Formulario y vista previa:** lo que se escribe se resalta en la hoja; los datos que faltan quedan como línea en blanco. Hay campos que aparecen según otros (por ejemplo, las cuotas del finiquito).
- **Desde «Trabajadores»:** el selector completa nombre, RUT, cargo y fecha de ingreso (`window.state.employees`). Se pueden escribir a mano.
- **Cálculos:** total del finiquito, monto en letras («un millón treinta y ocho mil… pesos», «un peso», «treinta y un pesos») y reparto en cuotas (la última absorbe el resto). Los conceptos del finiquito son hasta 4 filas editables.
- **PDF:** «Imprimir / guardar PDF» abre el diálogo de impresión del navegador con una hoja carta (membrete, pie en cada hoja); se elige «Guardar como PDF». No genera el archivo directamente.
- **Word:** «Descargar Word» genera un `.docx` con membrete, pie con número de página y firmas (librería `docx` 8.5.0 desde jsDelivr, solo al descargar).
- **Datos de la empresa:** nombre, RUT y dirección del membrete están en `COMPANY` (`documents-data.js`). El representante legal y quien firma amonestaciones, constancias y vacaciones se escriben en el formulario y el navegador los recuerda (`localStorage`, solo en ese equipo).
- **Causales de término:** lista de los artículos 159, 160 y 161 del Código del Trabajo usados con más frecuencia; la carta de aviso exige los hechos en las causales del 160 y 161.

## Qué NO es
- No es asesoría legal. Los textos salen de los modelos de la empresa (contrato, finiquito y constancia) y de redacción estándar (anexo, carta de aviso, amonestación, certificado, comprobante). **Un asesor laboral debe revisar cada modelo antes de darlo por oficial.** La firma y la ratificación (notaría o Inspección del Trabajo) siguen siendo trámite de la empresa.
- No guarda ni lista documentos emitidos ni los asocia al trabajador.
- No importa un Word propio como modelo nuevo.

## Archivos
- `src/modules/documents/documents-data.js`: modelos, campos y ayudas (números en letras, fechas, cuotas). Sin DOM.
- `src/modules/documents/documents-render.js`: bloques → HTML (vista previa y hoja de impresión).
- `src/modules/documents/documents.js` y `.css`: pantalla, impresión y Word.
- `src/modules/documents/documents.test.js`: `node src/modules/documents/documents.test.js` (datos ficticios).
- `index.html` (botón, sección `#documents`, scripts), `src/v20-interface.js` (menú del celular) y `src/ui-papel.js` (ícono).
- Sin migraciones ni tablas.
