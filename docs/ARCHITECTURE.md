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
│   │   ├── planning/             # módulo activo
│   │   ├── attendance/           # módulo activo
│   │   └── additional/           # presente sin rastrear y no cargada por index.html
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
               └── módulos globales activos
                    ├── EmployeeModule
                    ├── PlanningModule
                    └── AttendanceModule
                              │
                              ▼
                     ShiftControlState
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

### 2. Creación del estado legacy

El script principal:

1. define `KEYS.data`;
2. intenta recuperar el estado JSON desde `localStorage`;
3. crea datos iniciales cuando no hay estado guardado;
4. normaliza colecciones y ajustes;
5. expone la referencia mediante `window.state`;
6. define `save()` y ejecuta un guardado;
7. registra renderizadores, eventos y flujos funcionales.

La colección principal contiene, entre otros, `settings`, `employees`, `plans`, `executions`, `additional`, `holidays`, `absences`, `closedMonths` y `audit`. El código también agrega propiedades como `dailyClosures` y una marca de carga de datos de demostración.

### 3. Carga de extensiones y persistencia

Al final del documento se cargan la librería de Supabase, la configuración, la interfaz externa y `src/storage.js`.

`src/storage.js`:

- captura la función `window.save` ya definida;
- la reemplaza con un wrapper que primero conserva el guardado original;
- programa la escritura remota con un debounce de 500 ms;
- consulta o actualiza la fila configurada de `app_state`;
- muta la referencia existente al recibir estado remoto, en vez de sustituirla;
- conserva operación local si Supabase falla;
- ejecuta `bootstrap()` al cargarse.

### 4. Carga de infraestructura y módulos

Después se declaran `AppState`, `ShiftControlBridge` y `ShiftControlState`. Se instala un fallback mínimo para empleados y luego se cargan:

- `EmployeeModule`;
- `PlanningModule`;
- `AttendanceModule`;
- `initApp`.

### 5. `DOMContentLoaded`

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

- `initialize(defaultState)`;
- `get()`;
- `set(data)`;
- `save()`;
- `syncLegacyState()`.

Sus módulos activos leen la referencia con `get()`, la mutan y llaman a `save()`.

### Estado nominal no canónico

`src/app/state.js` declara `window.AppState` con colecciones propias. En el código cargado solo se observa que `initApp()` cambia `initialized` a `true`; los renderizadores no lo usan como fuente principal.

## Persistencia

### Estado principal

- local: clave `shiftcontrol_pro_v2_all_replacement_candidates`;
- remoto: tabla `app_state`;
- identidad remota: valor `stateKey` de `src/config.js`;
- contenido remoto: objeto JSON en `data`;
- seguimiento local de sincronización: `shiftcontrol_supabase_last_sync`.

El valor publicable de Supabase está en código cliente. Debe tratarse según el modelo de seguridad de claves publicables y políticas de la base; este repositorio no contiene las políticas RLS ni migraciones SQL para verificarlas.

### Almacenes paralelos observados

El monolito mantiene además claves separadas para:

- rol y roles legacy;
- período activo y ajustes auxiliares;
- incidencias operativas;
- checklists;
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

## Integraciones presentes pero no activas

Los siguientes archivos existen, pero `index.html` no los carga:

- `src/storage/local.js`;
- `src/storage/supabase.js`;
- `src/storage/sync.js`;
- `src/modules/additional/additional.js`, que además figuraba sin rastrear en el árbol de trabajo durante este levantamiento.

Además:

- `ShiftControlBridge.start()` está definido, pero no se observa una invocación;
- `employees-schema.js`, `employees-service.js` y `employees-ui.js` no contienen código;
- `AdditionalModule` no participa actualmente en la vista de jornadas adicionales, cuya lógica permanece en `index.html`.

## Restricciones arquitectónicas actuales

- El orden de scripts es un contrato.
- El namespace global es el mecanismo de integración.
- La identidad de la referencia de estado importa para evitar divergencia entre legacy, módulos y sincronización.
- Las redefiniciones tardías pueden reemplazar implementaciones anteriores.
- No toda persistencia se sincroniza remotamente.
- No hay pruebas automatizadas que protejan la migración.
- Los respaldos y documentos históricos no son parte del runtime.
