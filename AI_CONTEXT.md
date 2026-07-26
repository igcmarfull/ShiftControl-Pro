# Contexto para IA

## Resumen

ShiftControl Pro es una SPA de navegador en español, sin build ni dependencias instaladas localmente. Se inicia abriendo `index.html`. El repositorio está en una modularización incremental, pero el monolito sigue siendo el núcleo del sistema.

Fecha de este levantamiento: 26 de julio de 2026.

## Leer primero

1. `SHIFTCONTROL_OS.md`
2. `docs/architecture.md`
3. `docs/modules.md`
4. `docs/coding-standards.md`
5. `AGENTS.md`

## Hechos esenciales

- `index.html` contiene aproximadamente 17.000 líneas y concentra DOM, CSS inline, datos iniciales, renderizadores, eventos, autenticación local y la mayoría de los flujos.
- `src/v20-interface.css` y `src/v20-interface.js` agregan la interfaz vigente.
- La única dependencia externa cargada es `@supabase/supabase-js@2` desde jsDelivr.
- La integración entre archivos se hace con globals: `window.state`, `window.ShiftControlState`, `window.EmployeeModule`, `window.PlanningModule`, `window.AttendanceModule` y otros.
- No hay `package.json`, bundler, imports ESM, servidor de aplicación, tests, linter ni CI visibles.

## Estado y persistencia

- El estado principal se crea en `index.html` y se lee inicialmente desde `localStorage`.
- `window.ShiftControlState` mantiene una referencia al mismo objeto y delega el guardado a `window.save()`.
- `src/storage.js` reemplaza `window.save` por un wrapper que conserva el guardado local y programa un `upsert` a Supabase.
- Supabase usa la tabla `app_state`, una fila identificada por la clave de `src/config.js` y un campo JSON `data`.
- Incidencias operativas, checklists, entregas, evaluaciones, autenticación, finanzas, depósitos, tareas y otros datos auxiliares también usan claves separadas de almacenamiento del navegador.

No asumir que `window.AppState` es canónico: hoy solo se declara y se marca como inicializado.

## Archivos cargados al final de `index.html`

En orden relevante:

1. CDN de Supabase.
2. `src/config.js`
3. `src/v20-interface.js`
4. `src/storage.js`
5. `src/app/state.js`
6. `src/app/bridge.js`
7. `src/app/state-manager.js`
8. fallback inline de `EmployeeModule`
9. `src/modules/employees/employees.js`
10. `src/modules/planning/planning.js`
11. `src/modules/attendance/attendance.js`
12. `src/app/app.js`
13. inicialización ligada a `DOMContentLoaded`

`src/modules/additional/additional.js` está presente como archivo no rastreado en el árbol de trabajo, pero no está cargado por `index.html`. `src/storage/local.js`, `src/storage/supabase.js` y `src/storage/sync.js` tampoco se cargan desde el documento actual. Los archivos `employees-schema.js`, `employees-service.js` y `employees-ui.js` están vacíos.

## Riesgos de compatibilidad

- Cambiar el orden de scripts puede romper dependencias globales.
- Hay funciones redefinidas o envueltas por capas históricas de la interfaz.
- Existen dos representaciones nominales de estado (`AppState` y el estado legacy), pero solo la segunda alimenta el runtime.
- La inicialización de almacenamiento aparece tanto al cargar `src/storage.js` como desde `initApp()`.
- Parte de la persistencia está en el objeto principal y parte en claves locales independientes.
- Reemplazar el objeto de estado puede desalinear referencias; el código reciente intenta preservar la identidad del objeto durante la sincronización remota.

## Forma correcta de razonar sobre un cambio

1. Encontrar el elemento o función en `index.html`.
2. Buscar redefiniciones posteriores del mismo símbolo.
3. Identificar qué archivo externo se carga y en qué orden.
4. Seguir la escritura desde el módulo hasta `ShiftControlState.save()`, `save()` y almacenamiento.
5. Distinguir el código presente del código efectivamente cargado.
6. Verificar el comportamiento en navegador y la consola si se autoriza modificar la aplicación.

No inferir requisitos desde los documentos `CAMBIOS_V*.md` ni desde archivos vacíos. Esos archivos son antecedentes, no especificaciones vigentes.
