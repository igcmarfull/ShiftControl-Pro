# Costo de facturas

Pantalla «Costo de facturas» (grupo Tienda, solo administrador). Se sube una factura electrónica de proveedor en PDF y se calcula cuánto cuesta cada producto, **sin IVA**. Es una calculadora: **no guarda nada** en la base ni en el estado principal, y no toca Inventarios.

## Comportamiento activo
- **Lectura:** `InvoicePdf.extractText` (el mismo lector de PDF de «Facturas y compras») entrega el texto y `invoice-cost-calc.js` lo interpreta. Solo PDFs con texto, hasta 8 MB.
- **Columnas del detalle:** se reconocen por los títulos de la factura (Precio, Descto., Recargo, Monto). Si el formato no se reconoce, la pantalla lo avisa y no inventa datos.
- **Qué calcula**
  - Costo por pack y **costo por unidad sin ILA** = «Monto» de la línea ÷ unidades. El «Monto» ya trae descuentos y recargo (flete), así que es exacto.
  - Unidades por pack: salen del nombre («x 6», «x6», «1*6») y se pueden corregir en pantalla.
  - **Impuesto adicional (ILA, tabaco):** es el total − neto − IVA − exento. Es costo y no se recupera. El IVA no es costo.
  - **Costo real de la compra** = neto + impuesto adicional.
- **ILA por producto: aproximación.** La factura trae el impuesto adicional solo como total al pie, sin decir a qué producto corresponde. Se reparte en proporción al neto entre las líneas marcadas «Lleva ILA» (por defecto todas menos el agua Vital). El «costo unidad sin ILA» es el valor exacto; el «con ILA» es una referencia.
- **Conciliación:** suma de líneas contra neto, IVA, total y costo real; avisa si algo no cuadra.
- **Excel:** «Descargar Excel» genera un libro con formato Prosercom (ExcelJS desde cdnjs, como los reportes), una hoja A4 horizontal, con fórmulas por línea y la conciliación.

## Archivos
- `src/modules/invoice-cost/invoice-cost-calc.js`: lectura del texto y cálculo (sin DOM). Pruebas: `node src/modules/invoice-cost/invoice-cost-calc.test.js` (con una factura ficticia).
- `src/modules/invoice-cost/invoice-cost.js` y `.css`: pantalla y descarga.
- `index.html`: botón de menú, sección `#invcost` y scripts; `src/v20-interface.js` (menú del celular) y `src/ui-papel.js` (ícono).
- Sin migraciones ni tablas.

## No incluido
- No guarda facturas ni costos y no alimenta Inventarios.
- No lee fotos ni escaneos.
- Solo se probó con facturas con las columnas Precio / Descto. / Recargo / Monto (Embotelladora Andina); otros proveedores pueden requerir ajustes del lector.
