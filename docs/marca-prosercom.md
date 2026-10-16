# Marca Prosercom

La aplicación se presenta como la herramienta de **Prosercom** («Prosercom · Operaciones»). El nombre «ShiftControl Pro» ya no se muestra en la interfaz; sigue en comentarios del código, en los nombres de las variables globales (`ShiftControlAuth`, `ShiftControlState`, …) y en documentos históricos, que no se modifican.

## Estado

- **Activo:**
  - Pantalla de acceso nueva (`#loginScreen`) con el logo de Prosercom: panel azul con franjas de la marca en escritorio; en celular, pantalla blanca con el logo centrado y las franjas en la esquina. Se conservan los tres formularios (ingreso, activar cuenta y recuperar contraseña), sus ids y la lógica de autenticación.
  - Logo de la barra lateral y de los informes impresos, título de la pestaña («Prosercom · Operaciones») e íconos del navegador.
  - Textos visibles sin el nombre del producto (acceso, impresión, Configuración).
  - Paleta de la marca en toda la aplicación, en tema claro y oscuro: azul marino `#0c3b82` (acción principal), azul `#0f4c9c` (acento de datos), verde `#2f9e44` (positivo) y azul claro `#e8f0fb` (fondos suaves). Se aplica sobrescribiendo las variables de color de `ui-papel.css` (`--blue`, `--green`, `--act-*`, `--soft-*`, `--ok-*`, `--pri-*`) y el color de los avatares del usuario. Los colores de estado (naranja, rojo, amarillo) no cambian. Hay colores fijos en el código de algunas pantallas que no usan esas variables y siguen con su tono anterior.
- **Archivos:** `src/brand-prosercom.css` (se carga al final de `<head>`; reafirma con `!important` el estilo de los campos del acceso porque `ui-papel.css` fuerza el fondo de todos los `input`), y `src/assets/prosercom-logo.png`, `prosercom-mark.png` y `prosercom-icon.png`.
- **Provisional:** el nombre «Operaciones» que acompaña a Prosercom en la barra lateral, el acceso y el título.
- **No integrado (trabajo futuro):** revisar pantalla por pantalla los colores fijos que no usan variables, modo oscuro del acceso, marca configurable por empresa en la base de datos y logo vectorial (SVG).
