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

## Cierre del día (rediseño)

`renderDailySummaryContent()` (en `index.html`) sigue siendo el renderizador; conserva el mismo cálculo de estado (asistencia, cobertura, incidencias de hoy, checklist, cuadratura y avisos financieros). Estilos `.cd-*` en `src/ui-papel.css`.

- **Cabecera:** chip «Jornada abierta/cerrada» y botón «Cerrar jornada» (o «Reabrir jornada» si ya está cerrada).
- **Cerrar:** `dailySummaryClose()` avisa de lo que `confirmToday()` no revisa (checklist sin enviar, incidencias abiertas de hoy, cuadratura de caja sin registrar) y luego llama a `confirmToday()`, que mantiene sus propios avisos y su lógica de cierre. No bloquea el cierre: pide confirmación, como antes. **Reabrir** usa `reopenToday()`.
- **Lista de cierre (5 pasos):** asistencia, cobertura, checklist, incidencias de hoy y caja; cada paso muestra ✓ o un botón para resolverlo. La franja superior enumera lo que falta (explica el antiguo «Urgente», que salía de incidencias abiertas creadas hoy, además de ausencias sin cobertura o checklist sin enviar).
- **Resumen del día:** presentes, atrasos, licencias/permisos/vacaciones y sin confirmar; finanzas (diferencia de cuadratura, faltantes de caja de hoy, turnos extra por pagar y los avisos de gastos y facturas).
- **Últimas jornadas:** 7 días con Cerrada / Sin cerrar (solo si ese día tenía turnos planificados) / Sin turnos / Abierta.
- No se incluyen los pasos «depósito» y «entrega de turno» del Centro de trabajo: no hay un dato confiable para el depósito y la entrega ya se refleja en el cierre de la jornada.

Verificación: pruebas en navegador con datos simulados (claro/oscuro, escritorio y celular): con pendientes, «Cerrar jornada» muestra primero el aviso nuevo y después los de `confirmToday`; la jornada queda cerrada, el botón cambia a «Reabrir jornada» y al reabrir vuelve a abierta. Sin pruebas con datos reales.

## Evaluación mensual (rediseño)

`src/ui-evaluaciones.js` (cargado tras `ui-today.js`) envuelve `window.renderEvaluations()`: ejecuta la función original de `index.html` (contadores, filtro de jefatura) y después dibuja la vista nueva. No cambia el modelo de `EvaluationModule` ni el editor (`openEvaluation`, `newEvaluationFor`, `saveEvaluation`, `deleteEvaluationFromList`).

- **Resumen:** anillo «X de N evaluadas» (aprobadas + en revisión), Completadas / Borradores (incluye en revisión) / Sin evaluar y promedio del mes. El promedio sale de `scores` (valores 1–5) de las evaluaciones enviadas o aprobadas; la comparación con el mes anterior solo aparece si ese mes tiene datos. Se oculta mientras el editor está abierto.
- **Lista:** pestañas por estado (la de «En revisión» solo si hay), selector Todas/Isla/Tienda (sin área definida cuenta como Isla, igual que `recordArea`), buscador existente (`#evalSearchInput`) y filas agrupadas Borradores · En revisión · Sin evaluar · Completadas.
- **Botones:** «Evaluar siguiente» (primer borrador, si no, primer pendiente) y «Nuevo personal» (`newEvaluation()`).
- Se retiró la vista en grilla/lista y las tarjetas antiguas; los filtros viejos siguen en el DOM (ocultos) porque `onEvalFilterChange()` los lee.

Verificación: pruebas en navegador con datos simulados (claro/oscuro, escritorio y celular): pestañas, área, búsqueda, «Evaluar siguiente» y abrir una evaluación aprobada funcionan; sin errores de consola. Limitación: no se probó con datos reales de producción.

## Centro ejecutivo (rediseño)

`src/ui-executive.js` (cargado tras `ui-evaluaciones.js`) envuelve `window.renderDashboard()`. La función original de `index.html` sigue calculando prioridades (`#decisionCenter`), alertas (`#alerts`) y el estado de la estación (`#v16Health`); esos contenedores y los bloques antiguos (Centro de operaciones, Avance del turno, Prioridades/Estado operativo, Compromisos, Alertas/Actividad) quedan en el DOM pero ocultos por CSS. El módulo nuevo lee esos resultados y dibuja `#exRoot` bajo la cabecera.

- **Franja principal:** anillo de cobertura y seis cifras (Personal, Ausencias activas, Reemplazos, Turnos extra, Excepciones, Por revisar). «Por revisar» cuenta las prioridades de `#decisionCenter`, las mismas que lista «Lo que conviene revisar» (antes la cifra venía de otro cálculo y no coincidía con el panel de alertas).
- **Cobertura por turno:** anillos A/B/C (presentes / planificados).
- **Más detalle del día** (plegable solo en celular): asistencia de 7 días (presentes / planificados por día, promedio de los días con turnos), ausencias activas (`state.absences`), próximos 3 días (personal planificado por turno; en rojo un turno sin nadie), finanzas de hoy (`FinanceReconciliationModule` y `ShortageModule`; «Sin registro» si no hay cuadratura), incidencias abiertas (`IncidentModule`, no archivadas ni resueltas) y evaluaciones del mes.
- **Compromisos pendientes:** total sin pagar, aprobado frente a por aprobar y cuántos son reemplazos (subconjunto del total, no se suman).
- **Últimos movimientos:** máximo 5; las «Jornada cerrada para …» del mismo día se agrupan en una línea.
- Chip de estado junto a los botones de la cabecera, copiado de `#v16Health`.

Verificación: pruebas en navegador con datos simulados (claro/oscuro, escritorio y celular), sin errores de consola; el panel plegable conserva su estado al volver a dibujar. Limitaciones: no se probó con datos reales ni con una sesión real de Jefa de Isla (el servidor simulado no distingue áreas).

## Equipo de estación (rediseño y contacto)

`renderTeam()` (en `index.html`) dibuja dos tarjetas (Jefa de Isla y Jefa de Tienda) y el historial como lista con punto por área. Cada tarjeta muestra iniciales, nombre, «En el cargo desde … · N días», contacto, trabajadores activos del área (`ShiftControlAreas.employeeArea`; sin área cuenta como Isla) y los botones «Reemplazar» y «Editar contacto».

- **Contacto:** columnas `contact_email` y `contact_phone` en `company_memberships` (migración `20261014224739_chief_contact.sql`, ya aplicada en Supabase). Se eligió esa tabla y no `profiles` porque `profiles` la leen todos los compañeros de empresa; aquí solo la ven el administrador y la propia persona. La única vía de escritura es `update_chief_contact(p_area, p_email, p_phone)`, que exige ser administrador activo, valida formato y solo toca la jefatura activa del área. El correo de contacto es informativo: no cambia el correo de inicio de sesión.
- **Flujo:** el formulario de asignar/reemplazar pide teléfono (opcional) y, tras invocar `assign-chief`, llama a `update_chief_contact` con correo y teléfono (si falla, la asignación ya quedó hecha y se avisa aparte). «Editar contacto» abre un modal propio. `assign-chief` no cambió.
- **Compatibilidad:** si la base no tiene las columnas nuevas, `renderTeam()` reintenta sin ellas y oculta el contacto y el botón.
- Las jefaturas asignadas antes de esta migración quedan con contacto vacío («Sin correo de contacto» / «Sin teléfono») hasta que se complete con «Editar contacto».
- Reversión: `drop function public.update_chief_contact(text,text,text); alter table public.company_memberships drop column contact_email, drop column contact_phone;`

Verificación: pruebas en navegador con servidor simulado (claro/oscuro, escritorio y celular): las tarjetas muestran contacto, «Editar contacto» guarda y actualiza los enlaces `mailto:`/`tel:`, y el formulario de asignar guarda correo y teléfono. Se comprobó en Supabase que las columnas existen y que `anon` no puede ejecutar la función (`authenticated` sí). No se probó con una sesión real de administrador.

## Checklist operativo (solo presentación)

`src/ui-checklist.js` (cargado tras `ui-executive.js`) envuelve `window.renderOpsChecklist()` y añade, sin cambiar datos ni funciones: el anillo de avance, el resumen «N de M ítems respondidos · k con problema» y un selector segmentado Isla/Tienda para el administrador. El `<select class="ops-area-select">` original queda oculto pero sigue siendo la fuente de verdad (los botones llaman a `setOpsAdminArea()`). Se oculta el botón «Hoy» global duplicado; el de la propia pantalla (que fija `checklistDate`) se mantiene.

El resto es CSS en `src/ui-papel.css`: ítems como filas con el interruptor «Conforme / Con problema» (los mismos botones `setChecklistState`), aviso de incidencia vinculada (`createIncidentFromChecklist`), observaciones a todo el ancho, bloque de revisión y «Conexión inteligente». El bloque de evidencia de Tienda (`checklistDetailBlock`) no se tocó. En celular el historial sigue oculto como antes.

Verificación: pruebas en navegador con datos simulados (claro/oscuro, escritorio y celular): responder ítems actualiza el anillo y el resumen, el selector cambia el área y vuelve, sin errores de consola. Con el checklist del día ya enviado los botones aparecen deshabilitados, igual que antes del cambio. No se probó el envío ni la revisión con una sesión real.

## Entrega de turno (rediseño)

`src/ui-handoff.js` (cargado tras `ui-checklist.js`) envuelve `window.renderHandoffs()`. El guardado sigue siendo `saveHandoff()` y los datos siguen en `HandoffModule`; no cambian los campos (`#handoffFrom`, `#handoffTo`, `#handoffNotes`, `#handoffDate`, `#handoffShift`).

- **Cabecera:** selector segmentado Isla/Tienda (el `<select>` de área original queda oculto y sigue siendo la fuente de verdad) y selector segmentado de turno que escribe en `#handoffShift` y dispara su `change`. El «Hoy» global se mantiene.
- **Antes de entregar** (solo lectura, para la fecha elegida): checklist enviado o pendiente (`opsChecklistStore`), incidencias abiertas (`IncidentModule`, no archivadas ni resueltas), asistencias sin confirmar (planificados sin ejecución) y cuadratura de caja registrada o no (`FinanceReconciliationModule`). Cada pieza se omite si su módulo no está disponible. «Agregar a observaciones» añade ese resumen al texto de `#handoffNotes`, sin enviar nada.
- **Quién recibe:** sugerencias con el personal planificado en el turno siguiente al elegido (Mañana→B, Tarde→C, Noche→A del día siguiente), con el mismo origen que el relevo de Operación del día; un toque rellena «Recibe». «Entrega» se precarga una vez con el nombre de la sesión si está vacío.
- **Historial:** línea de tiempo con fecha y turno como chips y observaciones recortadas con «Ver más»; mismo filtro por área (`opsRecordInArea`) y mismo orden que antes. Estado vacío con mensaje corto.

Verificación: pruebas en navegador con datos simulados (claro/oscuro, escritorio y celular): el turno y el área cambian y actualizan sugerencias y pill, el resumen se agrega a las observaciones sin duplicarse, elegir una sugerencia rellena «Recibe» y guardar agrega la entrega al historial; sin errores de consola. No se probó con una sesión real de Jefa de Isla.

## Configuración (rediseño)

Solo presentación, sin JavaScript nuevo. En `index.html` se reordenó el marcado: «Feriados» pasó al grid principal (junto a Respaldo y datos), «Reiniciar sistema» salió a su propia tarjeta `.settings-danger` («Zona de riesgo») y las opciones de tema llevan una mini vista previa decorativa. Los ids y funciones se mantienen (`setTheme`, `#settingsForm`, `#companyName`, `#shiftA/B/C`, `#defaultExtraPayment`, `exportBackup`, `importBackup`, `resetSystem`, `openHolidayModal`, `#holidayTable`). El resto es CSS en `src/ui-papel.css`: tarjetas Claro/Oscuro con marca en la elegida, formulario en tres columnas para los turnos, tabla de feriados como lista con la fecha en un chip y el tipo como etiqueta, y «Reiniciar sistema» con borde rojo.

Verificación: pruebas en navegador con datos simulados (claro/oscuro, escritorio y celular): cambiar de tema actualiza la tarjeta activa, guardar la configuración conserva el valor editado, los feriados se muestran con tipo y «Eliminar», y «Reiniciar» sigue pidiendo confirmación (se canceló en la prueba). No se probó la importación de un respaldo.

## Inventarios · ancho completo

`.inv-root` (en `src/modules/inventory/inventory.css`) ya no tiene tope de 1180 px ni se centra: ocupa todo el ancho disponible, como el resto de las pantallas. En el Panel, «Requiere atención», «Últimos movimientos» y «Mermas del mes por motivo» pasan a tres columnas (`.inv-three`; dos columnas bajo 1280 px, con Mermas a todo el ancho, y una bajo 1000 px) y «Acceso y reglas por inventario» queda debajo a todo el ancho. Solo cambia la distribución (plantilla de la vista Panel en `inventory.js`); datos, permisos y funciones no se tocan. Las demás pestañas usan el mismo ancho completo.

Verificación: pruebas en navegador con el servidor simulado del módulo (administrador, 1800, 1280 y 390 px de ancho, claro/oscuro): el módulo ocupa el ancho disponible, las tres columnas inferiores se reparten y la pestaña Cigarrillos usa todo el ancho. Sin errores de consola.

## Facturas y compras (rediseño de escritorio)

Solo presentación. `src/ui-invoices.js` (cargado tras `ui-handoff.js`) envuelve `window.renderInvoices()` y añade el contador de cada pestaña (con los mismos criterios que el filtro de `renderInvoices`: todas, pendientes y pagadas aprobadas, vencidas por `invoiceDisplayStatus`, por aprobar = no aprobadas) y el total compacto en el centro del anillo por categoría (`data-total`, leído de `#invoiceCategoryDonutTotal`). El resto es CSS en `src/ui-papel.css`, dentro de `@media (min-width:821px)`: franja única con las cinco cifras (con sus mini líneas reales), pestañas en pastillas, búsqueda y filtros en una fila, tabla sin desbordes (columna lateral de 300 px y encabezados que pueden partirse en dos líneas) y anillo sobre su leyenda. El listado, las acciones (ver, editar, registrar pago para el administrador), los permisos, el CSV y las tarjetas móviles no se tocaron: el flujo móvil existente se mantiene.

Verificación: pruebas en navegador con datos simulados (claro/oscuro, escritorio y celular): la tabla cabe en su tarjeta con las acciones visibles, los contadores coinciden con las pestañas y el celular conserva su diseño. Sin errores de consola. No se probó crear, editar ni aprobar facturas.
