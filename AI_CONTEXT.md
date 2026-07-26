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
- La integración entre archivos se hace con globals: `window.state`,
  `window.ShiftControlState` y los módulos de trabajadores, planificación,
  asistencia, jornadas adicionales, ausencias, feriados, auditoría,
  configuración y cierres.
- No hay `package.json`, bundler, imports ESM, servidor de aplicación, tests, linter ni CI visibles.

## Estado y persistencia

- El estado principal se crea en `index.html` y se lee inicialmente desde `localStorage`.
- `window.ShiftControlState` mantiene la referencia canónica. Su operación
  `replace()` sincroniza `state`, `window.state` y `ShiftControlState.data` sin
  clonar ni normalizar el objeto recibido.
- `src/storage.js` reemplaza `window.save` por un wrapper que conserva el guardado local y programa un `upsert` a Supabase.
- Supabase usa la tabla `app_state`, una fila identificada por la clave de `src/config.js` y un campo JSON `data`.
- Incidencias operativas, checklists, entregas, evaluaciones, autenticación, finanzas, depósitos, tareas y otros datos auxiliares también usan claves separadas de almacenamiento del navegador.

No asumir que `window.AppState` es canónico: hoy solo se declara y se marca como inicializado.

## Orden de carga relevante

Antes del bloque monolítico se cargan:

1. `src/app/state-manager.js`
2. `src/modules/employees/employees.js`
3. `src/modules/settings/settings.js`
4. `src/modules/additional/additional.js`
5. `src/modules/absences/absences.js`
6. `src/modules/holidays/holidays.js`
7. `src/modules/audit/audit.js`
8. `src/modules/daily-closures/daily-closures.js`
9. `src/modules/planning/planning.js`
10. `src/modules/month-closures/month-closures.js`
11. `src/modules/attendance/attendance.js`

Estos archivos están disponibles para la inicialización, normalización y datos
demo del estado.

Al final del documento se cargan, en orden relevante:

1. CDN de Supabase.
2. `src/config.js`
3. `src/v20-interface.js`
4. `src/storage.js`
5. `src/app/state.js`
6. `src/app/bridge.js`
7. fallback inline de `EmployeeModule`, que no reemplaza el módulo ya cargado
8. `src/app/app.js`
9. inicialización ligada a `DOMContentLoaded`

`src/storage/local.js`, `src/storage/supabase.js` y `src/storage/sync.js` no se cargan desde el documento actual. Los archivos `employees-schema.js`, `employees-service.js` y `employees-ui.js` están vacíos.

## Riesgos de compatibilidad

- Cambiar el orden de scripts puede romper dependencias globales.
- Hay funciones redefinidas o envueltas por capas históricas de la interfaz.
- Existen dos representaciones nominales de estado (`AppState` y el estado legacy), pero solo la segunda alimenta el runtime.
- La inicialización de almacenamiento aparece tanto al cargar `src/storage.js` como desde `initApp()`.
- Parte de la persistencia está en el objeto principal y parte en claves locales independientes.
- Toda sustitución completa debe usar `ShiftControlState.replace()`. Undo, redo,
  importación y recuperación remota ya usan esta operación.

## Forma correcta de razonar sobre un cambio

1. Encontrar el elemento o función en `index.html`.
2. Buscar redefiniciones posteriores del mismo símbolo.
3. Identificar qué archivo externo se carga y en qué orden.
4. Seguir la escritura desde el módulo hasta `ShiftControlState.save()`, `save()` y almacenamiento.
5. Distinguir el código presente del código efectivamente cargado.
6. Verificar el comportamiento en navegador y la consola si se autoriza modificar la aplicación.

No inferir requisitos desde los documentos `CAMBIOS_V*.md` ni desde archivos vacíos. Esos archivos son antecedentes, no especificaciones vigentes.
