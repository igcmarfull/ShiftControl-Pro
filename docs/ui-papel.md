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

## Ausencias y cobertura (rediseño)

`renderAbsencePanel()` (en `index.html`) sigue siendo el único renderizador; se conservaron los ids que usan otras partes (`absenceStatsGrid`, `absenceControlCard`, `absenceTypeFilter`, `absenceSearch`, `uncoveredShiftsList`, `upcomingReturnsList`) y las acciones existentes (`openAbsenceReplacementCenter`, `deleteAbsence`, `openWorkerDrawer`). Estilos `.ab-*` en `src/ui-papel.css`.

- **Tarjetas:** ausencias activas con desglose por tipo (licencias, vacaciones, permisos, otras); turnos por cubrir desde hoy (los de fechas pasadas se indican aparte); vuelven esta semana (el «retorno» es el día siguiente al fin de la ausencia); cobertura de los casos no finalizados.
- **Lista:** pestañas Todas / Activas / Por cubrir / Finalizadas (el filtro de cobertura anterior se reemplazó por la pestaña «Por cubrir»; `absenceMobilePending()` la usa). Las activas muestran el avance («Día X de N»), las finalizadas quedan atenuadas y sin botón de urgencia.
- **Turnos sin cobertura:** agrupados por ausencia. Los de hoy en adelante tienen «Cubrir»; los de fechas anteriores quedan como historial («Ver detalle»).
- **Franja de 14 días:** por día, turnos afectados cubiertos o con faltantes.
- No cambia ninguna regla de cobertura: usa `absenceCoverage()` y `absenceCurrentStatus()` tal como estaban.

Verificación: capturas con datos simulados (claro/oscuro, escritorio y celular) sin errores de consola. Sin datos reales de producción.

## Menú «Centro» del celular (pestaña Acciones)

`src/v20-interface.js` (`buildMenu`, `applyMenuFilter`) reemplaza la lista anterior de la pestaña **Acciones**:

- Buscador de módulos (filtra por nombre sin tildes) y accesos de inicio (Bandeja ADMIN o Inicio operativo, según el rol).
- Grupos plegables con los mismos módulos y orden que la barra lateral: Operación, Planificación, Administración y Tienda. Operación arranca abierto; al buscar se abren los grupos con coincidencias.
- Íconos de `ShiftControlPapel.icon(view)` (`src/ui-papel.js`) y resaltado del módulo activo; el contador de Centro de trabajo se lee de `#workcenterNavBadge`.
- Cada módulo se muestra solo si `ShiftControlPermissions.canOpenView(view)` lo permite; un grupo sin módulos permitidos no aparece.
- `render()` se ejecuta cada 1,5 s: el estado de grupos y búsqueda se guarda en `menuState` y el panel solo se reescribe cuando cambia su contenido, para no perder el foco ni los grupos abiertos.
- Se quitaron las descripciones de cada módulo. Las pestañas **Avisos** y **Navegar** no cambian.

Verificación: pruebas en navegador con datos simulados (administrador y Jefa de Isla; claro/oscuro): plegar grupos, búsqueda con foco conservado, mensaje sin resultados y navegación. Sin pruebas con datos reales.

## Incidencias operativas (rediseño)

`renderOpsIncidents()` (en `index.html`) sigue siendo el renderizador; se conservan `IncidentModule`, `updateOpsIncidentStatus`, `archiveOpsIncident`, `saveOpsIncident`, el formulario (mismos ids) y los contadores `incidentOpenCount`, `incidentReviewCount` e `incidentResolvedCount`. Estilos `.ic-*` / `.inc-*` en `src/ui-papel.css`.

- **Lista:** pestañas Todas / Abiertas / En revisión / Resueltas con contador, filtro de prioridad y buscador (título, descripción, reportante, responsable y tipo). Agrupada en Abiertas, En revisión y Resueltas; las resueltas quedan atenuadas. Cada fila lleva ícono por tipo, prioridad, tipo, turno, responsable y las mismas acciones de antes (tomar en revisión, marcar resuelta, reabrir, archivar según el rol).
- **Gráficos** (`renderIncidentCharts`): incidencias por semana (8 semanas, por `createdAt`) y por tipo (máx. 5), de las incidencias no archivadas del área. Un solo color; cada barra tiene `title` con el detalle.
- **Escritorio (≥ 821 px):** el formulario «Registrar incidencia» pasa a un panel lateral que abre «Nueva incidencia» (`focusIncidentForm` → `openIncidentDrawer`), se cierra con ✕, el fondo o Esc, y también al guardar. En celular (≤ 820 px) el formulario es una hoja que sube desde abajo (se cierra con ✕ o tocando fuera), la lista va antes que el gráfico, queda un solo botón «Hoy», el gráfico «Por tipo» se oculta y cada tarjeta muestra solo su acción principal más un menú «⋯» con el resto (`<details class="ic-more">`); la línea «Reportó / Asignada» no se muestra en celular.
- El texto del adjunto ahora dice «Por ahora solo se guarda el nombre del archivo.»

Verificación: pruebas en navegador con datos simulados (claro/oscuro, escritorio y celular): pestañas, búsqueda con foco conservado, filtro de prioridad, abrir/cerrar el panel, guardado, cambio de estado. Sin pruebas con datos reales.

## Operación del día (rediseño, escritorio)

`renderToday()` sigue siendo el renderizador. `src/ui-today.js` (IIFE, se carga después de `ui-workcenter.js`) envuelve `window.renderToday` y, después de cada render, dibuja dos bloques extra; no cambia ninguna regla de asistencia. Estilos `.od-*` en `src/ui-papel.css`. El celular (< 768 px) no cambia.

- **Arriba (`#odTop`):** anillo de confirmados (planificados con registro de asistencia), seis cifras (planificados, presentes, atrasos, ausentes, licencias, sin confirmar), franja de alerta (usa el texto de `#todayProblems`) y cobertura por turno A/B/C con color según el estado (verde completo, ámbar parcial, rojo sin cubrir). Las tarjetas y el cuadro «Problemas» originales se ocultan en escritorio pero siguen en el DOM (los ids se conservan).
- **Tablero de turnos:** mismo contenido y acciones (`quickPresent`, `openTodayExceptions`, `markPendingPresent`); se agregó avatar con iniciales, «Reiniciar día» pasó a un menú «⋯» (`clearTodayExecutions`, que ya pedía confirmación) y se quitó la franja inferior de totales, que ahora está en la cabecera. Se eliminó el cartel de demo de esta pantalla.
- **Abajo (`#odLow`):** asistencia de los últimos 7 días (presentes sobre planificados por día, hasta la fecha elegida; un día sin turnos planificados se muestra con «—»), excepciones y reemplazos del día (incluye los pendientes) y relevo del siguiente turno (solo si la fecha elegida es hoy; horario desde `settings.A/B/C`).
- La app no guarda la hora de llegada, por eso no hay línea de tiempo de llegadas.

Verificación: pruebas en navegador con datos simulados (claro/oscuro, escritorio y celular): confirmar a un trabajador actualiza el resumen, el menú «⋯» ofrece «Reiniciar día» y, al aceptarlo, los registros del día se borran. Sin pruebas con datos reales.

## Operación del día · filtro de área y celular

- **Selector «Todas · Isla · Tienda»** (`#todayAreaSeg`, solo administrador; las jefas ya ven solo su área). El estado vive en `todayAreaFilter`; `setTodayArea()` vuelve a dibujar. `todayVisibleRows(date)` y `todayVisibleExecs(date)` aplican el filtro (área = `ShiftControlAreas.employeeArea`) y las usan `renderToday`, `markPendingPresent` y `src/ui-today.js`. `confirmToday` (cierra la jornada completa) sigue usando todo el personal, sin filtro.
- En «Todas» cada trabajador muestra una etiqueta de área y el resumen indica «Isla x/y · Tienda x/y». Quien no tiene área asignada solo aparece en «Todas».
- **Celular (< 768 px):** el mismo resumen (anillo, cuatro cifras, alerta y cobertura A/B/C) reemplaza las tarjetas y recuadros anteriores; los turnos plegables conservan sus acciones. Los bloques de 7 días, excepciones y relevo van en un panel plegable (`#odFold`), y el administrador tiene «Marcar pendientes presentes» y el menú «⋯» con «Reiniciar día» (antes no estaban disponibles en celular).

Verificación: pruebas en navegador con datos simulados (Todas = Isla + Tienda, «Marcar pendientes presentes» con Isla elegida solo marcó a Isla; la Jefa de Isla no ve el selector y solo ve su área). Sin pruebas con datos reales.

Alineación (Operación del día, escritorio): la franja superior centra verticalmente las cifras junto al anillo, las tarjetas de cobertura A/B/C centran su contenido y las barras de los 7 días se alinean al pie de su tarjeta.
