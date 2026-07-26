# Roadmap técnico

## Regla de alcance

Este roadmap no propone funcionalidades nuevas. Ordena únicamente la modularización y consolidación técnica que ya se observa iniciada en el repositorio. Cualquier ejecución requiere una tarea explícita y debe conservar el comportamiento existente.

## Estado al 26 de julio de 2026

### Presente y activo

- SPA ejecutable directamente desde `index.html`.
- Estado legacy persistido localmente.
- `ShiftControlState` conectado al estado principal.
- Sincronización del estado principal mediante `src/storage.js` y Supabase.
- `EmployeeModule` cargado y usado por múltiples flujos.
- `PlanningModule` cargado y usado por planificación.
- `AttendanceModule` cargado y usado por asistencia, ausencias y reemplazos.
- `AdditionalModule` cargado y usado para las mutaciones de jornadas adicionales.
- `AbsenceModule`, `HolidayModule`, `AuditModule`, `SettingsModule`,
  `MonthClosureModule` y `DailyClosureModule` cargados y usados.
- Referencia canónica unificada mediante `ShiftControlState.replace()`.
- Interfaz externa en `src/v20-interface.css` y `src/v20-interface.js`.

### Parcial o coexistente

- `index.html` sigue concentrando la mayor parte de la lógica funcional y visual.
- `AppState` coexiste con el estado legacy, pero no lo reemplaza.
- El bootstrap remoto se invoca desde dos puntos.
- Existen almacenes locales fuera del estado principal.
- Los módulos son propietarios de las mutaciones de las colecciones
  principales, pero no de toda la UI ni de la lógica de dominio.
- Varias capas de versión envuelven o redefinen funciones globales.

### Presente pero no integrado

- adaptadores `src/storage/local.js`, `src/storage/supabase.js` y `src/storage/sync.js`;
- `ShiftControlBridge.start()`;
- archivos de schema, service y UI de trabajadores, actualmente vacíos.

## Hito V1 Architecture Stable

La extracción de módulos de estado se considera completa para el alcance V1.
No se requieren más módulos antes del siguiente hito. El cierre de V1 exige:

- orden de carga válido para los módulos usados durante bootstrap;
- documentación alineada con el runtime;
- regresión manual de carga, flujos principales, persistencia, reemplazo de
  estado y consola;
- rama limpia, sincronizada y etiquetada.

### Excepciones aceptadas en V1

- `index.html` conserva el bootstrap/demo y algunas asignaciones mecánicas de
  empleados y planificación;
- las lecturas, reglas de negocio, coordinación, cálculos y renderizados siguen
  en el monolito;
- `AppState`, los adaptadores no cargados y los almacenes auxiliares permanecen
  fuera del estado canónico;
- el bootstrap remoto continúa invocado desde `src/storage.js` e `initApp()`.

Estas excepciones están documentadas y no crean una segunda referencia
canónica del estado.

## Fase siguiente aprobada, todavía no implementada

Después de cerrar y etiquetar V1 comienza una fase independiente de migración
a Supabase. Su primer alcance nominal comprende `companies`, `users` y
`roles`.

Esta documentación no define todavía tablas, campos, relaciones, permisos,
RLS, endpoints ni estrategia de migración. Esos contratos deben surgir de una
auditoría y diseño aprobados antes de modificar el runtime.

## Deuda técnica posterior, no bloqueante

- decidir el papel definitivo de `AppState`;
- eliminar o integrar adaptadores de almacenamiento no cargados;
- consolidar el bootstrap remoto duplicado;
- clasificar y migrar, cuando corresponda, los almacenes locales auxiliares;
- incorporar pruebas automatizadas y CI;
- reducir el monolito solo cuando exista un objetivo independiente aprobado.

## Fuera de este roadmap

No se asumen nuevas pantallas, roles, integraciones, tablas, endpoints, reglas de negocio ni cambios de plataforma. Tampoco se fija una versión o fecha para las etapas: el repositorio no contiene evidencia suficiente para establecer esos compromisos.

`docs/ARQUITECTURA.md` y los registros `CAMBIOS_V*.md` conservan antecedentes
históricos. Este archivo describe exclusivamente la secuencia técnica vigente.
