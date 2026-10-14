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

## Bandeja ADMIN (rediseño)

`renderAdminInbox()` (en `index.html`) muestra una sola lista «Requiere tu decisión», ordenada por urgencia, con botones de acción por fila y filtros por categoría (Todo, Inventarios, Dinero, Operación, Personas). Estilos `.abx-*` en `src/ui-papel.css`.

Fuentes de datos (todas ya existentes; no se agregó ninguna entidad ni tabla):

- Ausencias sin cobertura de hoy e incidencias de prioridad alta (urgentes), otras incidencias abiertas y trabajadores sin revisión hoy: `v14DailySnapshot()` y módulo de incidencias.
- Facturas por aprobar: `InvoiceModule` (`aprobacion === 'pendiente_aprobacion'`). Los botones Aprobar/Rechazar usan `approveInvoice` / `rejectInvoice`.
- Faltantes de caja, cuadraturas y gastos con estado «Pendiente» o «En revisión»: `financeStore()`.
- Incumplimientos de checklist de Tienda y checklists con observaciones: igual que antes.
- Evaluaciones enviadas: `EvaluationModule`.
- Ajustes de inventario pendientes: `InventoryApi.adjustments(companyId,'pending')`, agrupados por inventario. Se consulta de forma asíncrona (máx. una vez por minuto); si el servidor no tiene Inventarios habilitados o falla, simplemente no aparece esa fila.
- Cierres atrasados: días de los últimos 14 con turnos planificados y sin cierre de jornada (`DailyClosureModule`), más el estado del mes (`MonthClosureModule`). Cada día atrasado trae «Revisar y cerrar», que abre ese día en «Cierre del día» (no cierra nada por sí solo).

No se muestran depósitos: el módulo no expone un estado de «sin arquear» verificable.
La tarjeta de estado superior pasó a ser «Requiere atención» / «Todo al día» según haya urgentes (antes decía siempre «Operación estable»).

Verificación: capturas con datos simulados en claro/oscuro, escritorio y celular, y prueba de filtros y de «Aprobar factura». Sin datos reales de producción: conviene revisar que «Cierres atrasados» tenga sentido con el uso real de los cierres.

## Centro de trabajo (rediseño)

Estructura en `index.html` (`#workcenter`) y estilos `.wc-*` en `src/ui-papel.css`. `src/ui-workcenter.js` (IIFE, se carga después de `ui-papel.js`) solo dibuja lo visual:

- **Anillo de avance:** lee el contador del cierre guiado (`#v17CloseProgress`, p. ej. «3/7»).
- **Línea de tiempo del turno:** usa los porcentajes de los flujos ya calculados (`#v16Workflows`) y el horario del turno de `settings.A/B/C` (por defecto 07–15, 15–23, 23–07). El marcador «Ahora» sale del reloj.
- **Estadísticas y chip de integridad:** conservan los ids `v52PendingTotal`, `v52HighTotal`, `v52FlowTotal`, `v52WorkStatus` que ya actualiza el script V52. El panel de integridad solo se muestra si hay hallazgos.
- **Asistencia del turno:** `v14DailySnapshot()` (presentes, atrasados, excepciones, sin confirmar y cobertura por turno A/B/C).
- **Pagos pendientes:** `AdditionalModule.getAll()` con `paid !== 'Pagado'`; solo para el administrador. Las barras muestran los 6 turnos extra más recientes.

Los paneles que ya generaban los datos (prioridades, pendientes accionables, entrega de turno) se mantienen y solo se reubican (`mountWorkCenter`); el panel original de flujos queda oculto porque la línea de tiempo lo reemplaza. No se cambió ninguna regla de negocio. En celular el orden es: atención, pendientes, cierre guiado, asistencia y pagos.

Verificación: capturas con datos simulados (claro/oscuro, escritorio y celular) y perfil Jefa de Isla sin errores de consola. Sin datos reales de producción.
