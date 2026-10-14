# Arquitectura actual

## Alcance

Este documento describe exclusivamente la arquitectura comprobada en el repositorio al 26 de julio de 2026.

## Tipo de aplicación

ShiftControl Pro es una aplicación web de una sola página, ejecutada directamente por un navegador moderno:

- documento de entrada: `index.html`;
- JavaScript: scripts clásicos, sin módulos ESM ni transpilación;
- estilos: CSS inline en `index.html` y `src/v20-interface.css`;
- dependencia externa: `@supabase/supabase-js@2`, cargada desde jsDelivr;
- persistencia: almacenamiento del navegador más sincronización del estado principal a Supabase;
- despliegue, empaquetado y servidor: no están definidos en el repositorio.

## Estructura física

```text
.
├── index.html                    # SPA, núcleo histórico y mayor parte del runtime
├── README.txt                    # instrucción breve de ejecución
├── src/
│   ├── config.js                 # URL, clave publicable y clave de estado remoto
│   ├── storage.js                # sincronización activa localStorage/Supabase
│   ├── v20-interface.css         # estilos externos de la interfaz vigente
│   ├── v20-interface.js          # extensiones de interfaz y navegación
│   ├── app/
│   │   ├── app.js                # initApp()
│   │   ├── bridge.js             # API ShiftControlBridge, sin llamada observada a start()
│   │   ├── state.js              # AppState nominal
│   │   └── state-manager.js      # referencia y guardado del estado principal
│   ├── modules/
│   │   ├── employees/            # módulo activo y tres archivos vacíos
│   │   ├── planning/             # state.plans
│   │   ├── attendance/           # state.executions
│   │   ├── additional/           # state.additional
│   │   ├── absences/             # state.absences
│   │   ├── holidays/             # state.holidays
│   │   ├── audit/                # state.audit
│   │   ├── settings/             # state.settings
│   │   ├── month-closures/       # state.closedMonths
│   │   ├── daily-closures/       # state.dailyClosures
│   │   └── checklists/           # state.checklists
│   └── storage/
│       ├── local.js              # adaptador presente, no cargado
│       ├── supabase.js           # adaptador presente, no cargado
│       └── sync.js               # coordinador presente, no cargado
└── docs/                         # documentación y respaldos históricos
```

## Arquitectura lógica efectiva

```text
Interfaz y eventos
  index.html + src/v20-interface.js
               │
               ├── renderizadores y funciones globales de index.html
               └── diez módulos globales de estado
                              │
                              ▼
                     ShiftControlState
                    get()/replace()/save()
                              │
                              ▼
                           save()
                     ┌────────┴────────┐
                     ▼                 ▼
                localStorage      src/storage.js
                                      │
                                      ▼
                               Supabase app_state
```

No hay una capa de servicios separada activa entre los módulos y el estado. Los módulos operan directamente sobre el objeto entregado por `ShiftControlState.get()`.

## Secuencia de arranque

### 1. Construcción del documento

El navegador procesa el marcado, los estilos y varios scripts inline incluidos en `index.html`.

### 2. Carga de estado y módulos requeridos por el bootstrap

Antes del bloque monolítico se cargan `ShiftControlState`, `EmployeeModule`,
`SettingsModule`, `AdditionalModule`, `AbsenceModule`, `HolidayModule`,
`AuditModule`, `DailyClosureModule`, `PlanningModule`, `MonthClosureModule`,
`AttendanceModule`, `ShortageModule`, `IncidentModule`, `EvaluationModule` y
`ChecklistModule`. Así, los módulos de estado requeridos existen antes de la
normalización, los datos demo y cualquier renderizado.

### 3. Creación del estado legacy

El script principal:

1. define `KEYS.data`;
2. intenta recuperar el estado JSON desde `localStorage`;
3. crea datos iniciales cuando no hay estado guardado;
4. normaliza colecciones y ajustes;
5. conecta la referencia mediante `ShiftControlState.initialize(state)`;
6. define `save()` y ejecuta un guardado;
7. registra renderizadores, eventos y flujos funcionales.

La colección principal contiene, entre otros, `settings`, `employees`, `plans`, `executions`, `additional`, `holidays`, `absences`, `closedMonths` y `audit`. El código también agrega propiedades como `dailyClosures` y una marca de carga de datos de demostración.

### 4. Carga de extensiones y persistencia

Al final del documento se cargan la librería de Supabase, la configuración, la interfaz externa y `src/storage.js`.

`src/storage.js`:

- captura la función `window.save` ya definida;
- la reemplaza con un wrapper que primero conserva el guardado original y
  marca la empresa con cambios pendientes;
- programa la escritura remota con un debounce de 500 ms;
- antes de escribir, lee la fila de `app_state`; si otro usuario guardó desde
  la última sincronización, combina ambos estados a tres bandas (registros por
  `id`, y `plans`/`executions` por trabajador y fecha; ante un conflicto sobre
  el mismo dato prevalece el cambio local);
- escribe de forma condicional sobre `updated_at`, de modo que una escritura
  concurrente obliga a releer y combinar en lugar de sobrescribir;
- consulta `updated_at` cada 15 segundos y al volver a la pestaña, y aplica los
  cambios de otros usuarios sin recargar, salvo que haya un modal abierto o un
  campo con foco;
- conserva en `localStorage` la última versión acordada con Supabase y, al
  iniciar, combina los cambios locales que hayan quedado sin subir;
- muestra el estado en `.save-status`: sincronizado, guardando o sin conexión;
- para una jefa, trabaja sobre la parte del estado de su área (ver
  «Separación por área») y combina sus cambios sobre el estado completo;
- reemplaza oficialmente la referencia completa mediante
  `ShiftControlState.replace(data.data)`;
- conserva operación local si Supabase falla;
- ejecuta `bootstrap()` al cargarse.

### 5. Carga de infraestructura y módulos

Después se declaran `AppState` y `ShiftControlBridge`. Se instala un fallback
mínimo de empleados que no reemplaza el módulo ya cargado y se carga
`initApp`.

### 6. `DOMContentLoaded`

Hay más de un listener de inicialización:

- el bloque principal conecta `state` a `ShiftControlState`, llama a `renderAll()`, restaura el período activo y abre la vista diaria;
- otro listener llama a `initApp()`;
- `initApp()` vuelve a invocar `ShiftControlStorage.bootstrap()`, sincroniza la referencia legacy y marca `AppState.initialized`.

Por tanto, la carga remota puede iniciarse tanto al evaluar `src/storage.js` como desde `initApp()`.

## Estado

### Estado canónico efectivo

El estado consumido por el runtime es la referencia originada en `index.html`:

```text
state ───────────────┐
                     ├─ misma referencia esperada
window.state ────────┤
                     │
ShiftControlState.data
```

`ShiftControlState` ofrece:

- `replace(nextState)`;
- `initialize(defaultState)`;
- `get()`;
- `set(data)`;
- `save()`;
- `syncLegacyState()`.

Sus módulos activos leen la referencia con `get()`, la mutan y llaman a `save()`.

`replace(nextState)` conserva exactamente el objeto recibido y sincroniza las
tres referencias:

```text
state === window.state === ShiftControlState.get()
```

Undo, redo, importación de respaldo y recuperación remota usan esta operación.

### Estado nominal no canónico

`src/app/state.js` declara `window.AppState` con colecciones propias. En el código cargado solo se observa que `initApp()` cambia `initialized` a `true`; los renderizadores no lo usan como fuente principal.

## Persistencia

### Estado principal

- local: clave `shiftcontrol_pro_v2_all_replacement_candidates`;
- remoto: tabla `app_state`, escrita con control de concurrencia por `updated_at`;
- identidad remota: valor `stateKey` de `src/config.js`;
- contenido remoto: objeto JSON en `data`;
- seguimiento local de sincronización: `shiftcontrol_supabase_last_sync`;
- última versión acordada con Supabase: `<clave de empresa>:base`;
- marca de cambios sin subir: `<clave de empresa>:pending`.

El valor publicable de Supabase está en código cliente. Debe tratarse según el modelo de seguridad de claves publicables y políticas de la base. Las políticas RLS, funciones y migraciones están en `supabase/` (ver «Supabase en el repositorio»).

### Supabase en el repositorio

- `supabase/migrations/`: migraciones tal como están aplicadas en producción,
  con sus versiones exactas. La excepción es `20261014200100_lock_app_state_to_admin.sql`
  (fase 2), que **no está aplicada**. La tabla original `public.app_state` no
  la crea ninguna migración: existía antes y las migraciones solo la modifican,
  así que la base no se puede reconstruir desde cero solo con este directorio.
- `supabase/functions/assign-chief/`: Edge Function desplegada.
- `supabase/tests/`: scripts SQL manuales para la fase 2 (`fase2_local.sql` sobre
  una base local desechable y `fase2_produccion.sql` de solo verificación, que
  deshace todo lo que escribe). No son una suite automatizada ni se ejecutan en CI.
- `supabase/rollback/`: reversión manual de la fase 2. No es una migración y no
  debe colocarse en `supabase/migrations/`.

El procedimiento completo de la fase 2 está en `docs/fase2-aislamiento-app-state.md`.

### Almacenes paralelos observados

El monolito mantiene además claves separadas para:

- rol y roles legacy;
- período activo y ajustes auxiliares;
- incidencias operativas;
- entregas de turno;
- evaluaciones;
- avisos de asistencia;
- actividad;
- usuarios y sesiones locales;
- finanzas;
- depósitos;
- tareas, auditoría auxiliar y notificaciones revisadas.

Estos almacenes no pasan por `src/storage.js` y no forman parte del JSON sincronizado por esa capa, salvo los datos que también estén copiados expresamente al estado principal.

## Renderizado y navegación

- Las vistas son elementos `.view` dentro de `index.html`.
- `showView(id)` alterna la vista activa, aplica restricciones según el rol y dispara renderizados específicos.
- `renderAll()` recorre por nombre un conjunto de renderizadores globales y captura errores por módulo.
- El HTML usa manejadores inline, por lo que muchos nombres globales forman parte de la interfaz interna.
- Scripts de versiones posteriores envuelven funciones como `renderAll`, `renderDashboard` o `renderActualCalendar` para agregar comportamiento.
- `src/v20-interface.js` también instala y envuelve componentes después de la carga del DOM.
- `AdditionalModule` concentra las inserciones, reemplazos de colección y
  mutaciones residuales de registros `additional`; las reglas, cálculos,
  snapshots, logs y renderizado permanecen en `index.html`.

## Separación por área

`src/app/areas.js` publica `window.ShiftControlAreas` y se carga después de
`src/app/permissions.js`.

- El administrador ve y administra la isla y la tienda.
- `company_memberships.area` (`ESTACION` o `TIENDA` en Supabase) identifica
  el área de cada jefa; la app trata `ESTACION` como isla. Una jefa sin área
  se considera de isla. La asignación usa `assign_chief_area` mediante la Edge
  Function `assign-chief`.
- El área de cada trabajador se toma de `employee.area` ("Isla" o "Tienda",
  sin distinguir mayúsculas ni tildes).
- Al cargar, una jefa recibe solo los trabajadores de su área y sus registros
  de `plans`, `executions`, `absences`, `additional`, `evaluations` y
  `cashShortages`. Los datos generales se conservan.
- La Jefa de Isla conserva el criterio anterior: si nadie tiene área "Isla",
  ve a todo el personal que no sea de tienda.
- La Jefa de Tienda tiene las mismas vistas que la Jefa de Isla
  (`src/app/permissions.js`, `CHIEF_TIENDA`), sobre los datos de la tienda.
- Incidencias (`incidents`) y entregas de turno (`handoffs`) guardan `area`;
  los registros sin área son de isla. Los checklists de tienda usan la clave
  `TIENDA:<fecha>` y los de isla, `<fecha>`.
- El checklist de tienda tiene 13 puntos: los cinco generales (sin surtidores
  ni patio) y ocho controles propios (`OPS_STORE_CHECKLIST_ITEMS`). Cada punto
  respondido guarda en `details[<punto>]` responsable, fecha y hora,
  observaciones y evidencia fotográfica. Un punto con problema exige
  observaciones y responsable; al enviar el checklist queda con
  `followUp.status = 'open'` y aparece en la Bandeja ADMIN hasta que el
  gerente lo marca resuelto con un comentario. El checklist de isla no cambia.
- Las fotos se reducen en el navegador (JPEG, lado mayor 1600 px) y se suben
  al bucket privado `shiftcontrol-evidence` de Supabase Storage con la ruta
  `<empresa>/checklists/<área>/<fecha>/<archivo>`. El checklist guarda solo la
  ruta; las imágenes se muestran con enlaces firmados de una hora.
- Facturas: la Jefa de Tienda registra facturas de tienda (`area: 'TIENDA'`)
  con un respaldo opcional (foto o PDF en
  `<empresa>/invoices/<área>/<mes>/<archivo>`). Quedan con
  `aprobacion: 'pendiente_aprobacion'` hasta que el administrador las aprueba
  o rechaza con motivo; una rechazada se corrige y se reenvía. Las facturas sin
  `aprobacion` (anteriores) se consideran aprobadas. Los indicadores, el pago y
  los vencimientos usan solo facturas aprobadas. La jefa ve solo las facturas
  de su área y no registra pagos ni modifica facturas aprobadas. Las facturas
  por aprobar aparecen en la Bandeja ADMIN.
- En incidencias, checklist y entrega de turno el administrador elige el área
  que revisa con un selector Isla/Tienda.
- Las entregas de turno se guardan en `state.handoffs` mediante
  `HandoffModule` (`src/modules/handoffs/handoffs.js`). Antes quedaban solo en
  `localStorage`; `migrateLegacyHandoffs()` las incorpora una vez como entregas
  de isla.
- Aislamiento en la base de datos. **Activo en producción (fase 1)**:
  migraciones `20261014021748` y `20261014021940`. **Pendiente (fase 2)**:
  `20261014200100`, que retira a las jefaturas el acceso directo a `app_state`;
  hoy las policies siguen permitiendo a cualquier miembro activo leer y escribir
  `app_state` completo. Con la fase 2 aplicada, el administrador lee y escribe
  `app_state` completo y las jefaturas usan `get_area_app_state`,
  `get_app_state_version` y `save_area_app_state` (disponibles desde la fase 1
  y usadas ya por la app publicada). El servidor recorta el
  estado por área (mismas reglas que `src/app/areas.js`), entrega vacíos
  finanzas, depósitos, faltantes de caja e historial, y al guardar solo
  acepta registros del área: no aprueba facturas ni evaluaciones, no registra
  pagos, no cambia el área de una trabajadora ni modifica registros
  aprobados, pagados, resueltos o checklists enviados. Configuración,
  feriados y cierres solo los cambia el administrador. Una colección ausente
  o mal formada en lo enviado no se modifica. La escritura es condicional
  sobre `updated_at` (error `40001` si otro usuario guardó antes).
- `src/storage.js` usa esas funciones cuando la sesión es de una jefa; si aún
  no existen en la base, vuelve al acceso directo anterior.

## Integraciones presentes pero no activas

Los siguientes archivos existen, pero `index.html` no los carga:

- `src/storage/local.js`;
- `src/storage/supabase.js`;
- `src/storage/sync.js`;

Además:

- `ShiftControlBridge.start()` está definido, pero no se observa una invocación;
- `employees-schema.js`, `employees-service.js` y `employees-ui.js` no contienen código;

## Restricciones arquitectónicas actuales

- El orden de scripts es un contrato.
- El namespace global es el mecanismo de integración.
- La identidad de la referencia de estado importa para evitar divergencia entre legacy, módulos y sincronización.
- Las diez colecciones principales tienen módulo propietario para sus
  mutaciones runtime. `index.html` conserva lecturas, reglas, coordinación y
  renderizado.
- El bootstrap/demo conserva asignaciones mecánicas directas sobre
  `employees`, `plans` y la marca de datos demo.
- Las redefiniciones tardías pueden reemplazar implementaciones anteriores.
- No toda persistencia se sincroniza remotamente.
- No hay pruebas automatizadas de la aplicación que protejan la migración. Las
  únicas pruebas del repositorio son los scripts SQL manuales de `supabase/tests/`.
- Los respaldos y documentos históricos no son parte del runtime.
