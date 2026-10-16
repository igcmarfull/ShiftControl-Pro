# Marca Prosercom

La aplicación se presenta como la herramienta de **Prosercom** («Prosercom · Operaciones»). El nombre «ShiftControl Pro» ya no se muestra en la interfaz; sigue en comentarios del código, en los nombres de las variables globales (`ShiftControlAuth`, `ShiftControlState`, …) y en documentos históricos, que no se modifican.

## Estado

- **Activo:**
  - Pantalla de acceso nueva (`#loginScreen`) con el logo de Prosercom: panel azul con franjas de la marca en escritorio; en celular, pantalla blanca con el logo centrado y las franjas en la esquina. Se conservan los tres formularios (ingreso, activar cuenta y recuperar contraseña), sus ids y la lógica de autenticación.
  - Logo de la barra lateral y de los informes impresos, título de la pestaña («Prosercom · Operaciones») e íconos del navegador.
  - Textos visibles sin el nombre del producto (acceso, impresión, Configuración).
- **Archivos:** `src/brand-prosercom.css` (se carga al final de `<head>`; reafirma con `!important` el estilo de los campos del acceso porque `ui-papel.css` fuerza el fondo de todos los `input`), y `src/assets/prosercom-logo.png`, `prosercom-mark.png` y `prosercom-icon.png`.
- **Provisional:** el nombre «Operaciones» que acompaña a Prosercom en la barra lateral, el acceso y el título.
- **No integrado (trabajo futuro):** paleta de colores de la marca en el resto de la aplicación (hoy el acento sigue siendo el azul de `ui-papel.css`), modo oscuro del acceso, marca configurable por empresa en la base de datos y logo vectorial (SVG).
