# Estilo visual «Papel» (toda la aplicación)

## Comportamiento activo

- `src/ui-papel.css` se carga en `index.html` después de `src/v20-interface.css` y `src/modules/inventory/inventory.css`.
- Define los mismos tokens (`--bg`, `--panel`, `--line`, `--text`, `--blue`, etc.) para claro (`body.light`) y oscuro (`body:not(.light)`). El tema sigue gestionándose con `applyTheme()` y `state.settings.theme`; no se añadió ningún ajuste nuevo.
- `src/ui-papel.js` (IIFE, se carga después de `src/v20-interface.js`) hace solo dos cosas sobre la barra lateral:
  - reemplaza los glifos de texto de cada `.nav-btn[data-view]` por íconos SVG (mapa `data-view` → ícono; las vistas sin entrada usan el ícono de documento);
  - convierte cada `.nav-group-title` en un encabezado plegable con contador de botones visibles. El grupo del botón activo siempre se abre; el estado plegado se guarda en `localStorage` (`shiftcontrol.nav.collapsed`) y, si no está disponible, la barra funciona igual.
- No cambia rutas, permisos, estado ni persistencia. Los `data-view`, ids y `onclick` existentes se conservan.

## Celular (≤ 820 px)

- El panel «Compromisos pendientes» ocupa el ancho completo (anula `grid-column:2` de `v20-interface.css`).
- Un degradado del color de fondo y más margen inferior evitan que el botón flotante tape el contenido.
- La hoja del «Centro» muestra una barra de arrastre y las acciones llevan su ícono en un recuadro.

## Verificación realizada

Capturas con Chromium (Playwright) y Supabase simulado en claro/oscuro, escritorio (1440×900) y celular (390×844): centro ejecutivo, operación del día, planificación, trabajadores, finanzas e inventarios, además de la hoja del «Centro». También inicio operativo e inventarios con los perfiles Jefa de Isla (celular, oscuro) y Jefa de Tienda (escritorio, claro), con datos simulados. Sin errores de consola. No existe suite automatizada.

## Pendiente / no verificado

- Los tres perfiles con datos reales de producción (las pruebas usaron datos simulados).
- Pantallas no capturadas (evaluaciones, reportes, facturas, etc.) heredan los tokens, pero no se revisaron una a una.
