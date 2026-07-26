# Módulos actuales

## Criterio de clasificación

Este inventario diferencia:

- **activo**: `index.html` carga el archivo y el runtime lo consume;
- **monolítico**: la funcionalidad existe dentro de `index.html`;
- **presente, no integrado**: el archivo existe, pero no se carga en el documento;
- **vacío**: el archivo existe sin implementación.

## Módulos técnicos extraídos

### Estado de aplicación

| Pieza | Estado | Responsabilidad observada |
|---|---|---|
| `src/app/state-manager.js` | Activo | Mantiene la referencia del estado, la expone con `get()`/`set()` y delega en `save()`. |
| `src/app/state.js` | Parcial | Declara `AppState`; solo se observa el uso de `initialized`. |
| `src/app/app.js` | Activo | Ejecuta el bootstrap de almacenamiento, sincroniza estado legacy y marca inicialización. |
| `src/app/bridge.js` | No iniciado | Publica `ShiftControlBridge.start()`, sin llamada observada. |

### Trabajadores

Archivo activo: `src/modules/employees/employees.js`.

API observada:

- `getAll()`;
- `find(id)`;
- `count()`;
- `create(data)`;
- `update(id, data)`;
- `remove(id)`;
- `addDocument(id, document)`;
- `removeDocument(id, index)`.

Opera sobre `state.employees`. Las altas evitan duplicados por RUT o nombre, agregan identificador, fecha de ingreso y estado activo. Las operaciones CRUD principales guardan mediante `ShiftControlState.save()`. La adición y eliminación de documentos modifican el estado, pero en el propio módulo no llaman a `save()`.

Integración observada: listados, selectores, fichas, importación CSV, planificación, operación diaria, reportes, evaluaciones y finanzas consultan `EmployeeModule`.

Archivos vacíos:

- `src/modules/employees/employees-schema.js`;
- `src/modules/employees/employees-service.js`;
- `src/modules/employees/employees-ui.js`.

No se les debe atribuir responsabilidades todavía.

### Planificación

Archivo activo: `src/modules/planning/planning.js`.

API observada:

- `getAll()`;
- `find(employeeId, date)`;
- `create(data)`;
- `remove(id)`;
- `clearEmployee(employeeId, date)`;
- `removeEmployeePlans(employeeId)`.

Opera sobre `state.plans`. `create()` actualiza un registro existente para trabajador y fecha o crea uno nuevo. Las mutaciones guardan mediante `ShiftControlState.save()`.

La interfaz de planificación, vista semanal, patrones, asignaciones masivas y eliminación relacionada con trabajadores permanece en `index.html`, consumiendo esta API.

### Asistencia

Archivo activo: `src/modules/attendance/attendance.js`.

API observada:

- `getAll()`;
- `find(employeeId, date)`;
- `create(data)`;
- `remove(id)`;
- `clearDate(date)`;
- `removeWhere(callback)`;
- `removeGeneratedByAbsence(absenceId)`;
- `removeEmployee(employeeId)`;
- `removeEmployeeReferences(employeeId)`.

Aunque el módulo se llama asistencia, opera sobre `state.executions`. Gestiona registros reales, limpieza por fecha, referencias de reemplazo y ejecuciones generadas desde ausencias. Las mutaciones guardan mediante `ShiftControlState.save()`.

Los cálculos de asistencia, reemplazos, ausencias y renderizado siguen en `index.html`.

### Jornadas adicionales

Archivo activo: `src/modules/additional/additional.js`.

Se carga antes del bloque monolítico que inicializa el estado para poder normalizar, reemplazar e insertar registros desde el arranque. Después utiliza `ShiftControlState` como referencia principal.

API observada:

- `getAll()`;
- `replaceAll(records, options)`;
- `add(data, options)`;
- `find(employeeId, date)`;
- `create(data)`;
- `update(id, data)`;
- `remove(id)`;
- `getPendingPayments()`.

Las escrituras que antes usaban asignación directa, `push()` o `unshift()` en `index.html` pasan por `replaceAll()` o `add()`. La interfaz y varias lecturas o mutaciones de campos individuales permanecen en el monolito.

## Almacenamiento

### Sincronización activa

`src/storage.js` es la capa cargada actualmente. Envuelve el `save()` global, conserva `localStorage`, recupera o actualiza el estado principal en Supabase y tolera errores remotos.

API global:

- `ShiftControlStorage.pushState()`;
- `ShiftControlStorage.bootstrap()`;
- `ShiftControlStorage.isReady()`.

### Adaptadores no cargados

| Archivo | API declarada | Estado |
|---|---|---|
| `src/storage/local.js` | `ShiftControlLocal.load/save` | Presente, no integrado |
| `src/storage/supabase.js` | `ShiftControlSupabase.load/save` | Presente, no integrado |
| `src/storage/sync.js` | `ShiftControlStorageV31.load/save` | Presente, no integrado |

Estos adaptadores esperan un `window.supabaseClient`, mientras que la capa activa crea y conserva internamente su propio cliente. Son caminos distintos en el estado actual.

## Interfaz externa

### `src/v20-interface.css`

Contiene estilos adicionales y ajustes responsivos de la interfaz. Se carga desde el `<head>` después de los estilos inline previos y convive con varios bloques CSS posteriores dentro de `index.html`.

### `src/v20-interface.js`

Está activo y:

- controla el Centro de acciones;
- conecta accesos rápidos con vistas existentes;
- instala búsqueda de trabajadores;
- adapta controles móviles del registro real;
- envuelve `renderActualCalendar` cuando está disponible;
- registra eventos de teclado, DOM y resize.

No contiene el renderizado funcional completo de esas áreas; extiende funciones y elementos del monolito.

## Áreas funcionales dentro de `index.html`

Las siguientes vistas y flujos existen hoy, pero no están extraídos como módulos JavaScript independientes completos:

| Área | Evidencia principal |
|---|---|
| Operación del día | Vista `today`, planificación diaria, presentes, excepciones, reemplazos y cierre diario |
| Centro ejecutivo | Vista `dashboard`, indicadores, prioridades, notificaciones e integridad |
| Centro de trabajo | Vista `workcenter`, montaje de prioridades, flujos y pendientes |
| Planificación | Vista `planning`, con lógica UI monolítica y datos mediante `PlanningModule` |
| Vista semanal | Vista `weekly` |
| Registro real | Vista `actual`, calendario y estados de ejecución mediante `AttendanceModule` |
| Ejecución | Vista `execution` |
| Trabajadores | Vista `employees`, con lógica UI monolítica y datos mediante `EmployeeModule` |
| Jornadas adicionales | Vista `additional`, todavía monolítica |
| Finanzas | Vista `finance`, almacén local separado para movimientos y aprobaciones |
| Depósitos | Flujo dentro del área financiera, almacén local separado |
| Reportes | Vista `reports`, reportes operativos/contables, CSV e impresión |
| Auditoría | Vista `audit`, más una auditoría auxiliar en clave local separada |
| Ausencias | Vista `absences`, sincronización de ejecuciones y cobertura de reemplazos |
| Incidencias | Vista `incidents`, clave local independiente |
| Checklists | Vista `checklists`, clave local independiente |
| Entrega de turno | Vista `handoff`, clave local independiente |
| Evaluaciones | Vista `evaluations`, clave local independiente |
| Configuración | Vista `settings` |
| Autenticación y roles | Login y sesiones locales; roles observados para administrador, jefa de isla y atendedora |

Este inventario no afirma separación de dominio: muchas áreas comparten directamente `state`, globals, DOM y claves de almacenamiento.

## Relaciones de datos observadas

- `plans.employeeId` referencia trabajadores.
- `executions.employeeId` referencia trabajadores y puede contener referencias de reemplazo.
- `additional.employeeId` referencia trabajadores y puede vincular reemplazos.
- `absences.employeeId` referencia trabajadores y puede generar ejecuciones.
- evaluaciones y movimientos financieros almacenan identificadores de trabajadores.
- al eliminar un trabajador, el flujo monolítico elimina planes y limpia referencias de asistencia mediante los módulos extraídos.

No hay esquema formal, restricciones de base de datos ni validación centralizada en el repositorio.
