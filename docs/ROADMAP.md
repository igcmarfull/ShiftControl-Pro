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
- Interfaz externa en `src/v20-interface.css` y `src/v20-interface.js`.

### Parcial o coexistente

- `index.html` sigue concentrando la mayor parte de la lógica funcional y visual.
- `AppState` coexiste con el estado legacy, pero no lo reemplaza.
- El bootstrap remoto se invoca desde dos puntos.
- Existen almacenes locales fuera del estado principal.
- Los módulos extraídos separan operaciones de datos, pero no toda la UI ni la lógica de dominio.
- Varias capas de versión envuelven o redefinen funciones globales.

### Presente pero no integrado

- adaptadores `src/storage/local.js`, `src/storage/supabase.js` y `src/storage/sync.js`;
- `ShiftControlBridge.start()`;
- implementación de `AdditionalModule`;
- archivos de schema, service y UI de trabajadores, actualmente vacíos.

## Secuencia técnica derivada del estado actual

### 1. Estabilizar la línea base

Objetivo: poder demostrar que una extracción conserva el comportamiento existente.

- inventariar flujos críticos y claves persistentes;
- definir comprobaciones repetibles de carga, renderizado y guardado;
- registrar el contrato de globals y orden de scripts;
- identificar redefiniciones efectivas de funciones.

Resultado esperado: una referencia verificable del sistema actual, sin cambios funcionales.

### 2. Consolidar inicialización y estado

Objetivo: reducir las rutas duplicadas ya presentes.

- determinar un único propietario del bootstrap;
- aclarar el papel de `AppState` frente a `ShiftControlState`;
- preservar una sola referencia canónica;
- documentar la carga remota y el fallback local.

Resultado esperado: el mismo estado y comportamiento con menos ambigüedad de inicialización.

### 3. Consolidar persistencia existente

Objetivo: resolver la coexistencia entre la capa activa y los adaptadores no cargados.

- comparar el contrato de `src/storage.js` con `src/storage/*`;
- elegir una sola ruta para el estado principal;
- clasificar los almacenes paralelos que hoy quedan fuera de la sincronización;
- verificar guardado local, recuperación remota y operación sin red.

Resultado esperado: persistencia vigente explícita y sin caminos nominales sin uso.

### 4. Completar extracciones ya iniciadas

Objetivo: continuar la separación de operaciones existentes sin añadir casos de uso.

- verificar e integrar o descartar, mediante una decisión explícita, `AdditionalModule`;
- mover gradualmente lógica de UI o servicio solo cuando exista un consumidor comprobado;
- mantener los globals de compatibilidad durante cada extracción;
- retirar archivos vacíos únicamente si se confirma que no representan trabajo planificado.

Resultado esperado: responsabilidades existentes ubicadas en módulos cargados y comprobables.

### 5. Reducir el monolito de forma incremental

Objetivo: extraer áreas existentes una por una.

- escoger un límite funcional ya implementado;
- conservar DOM, almacenamiento y resultados;
- separar datos, comportamiento y renderizado en cambios pequeños;
- eliminar la implementación antigua solo después de verificar consumidores y redefiniciones.

Resultado esperado: menos lógica en `index.html` sin ampliar el producto.

## Fuera de este roadmap

No se asumen nuevas pantallas, roles, integraciones, tablas, endpoints, reglas de negocio ni cambios de plataforma. Tampoco se fija una versión o fecha para las etapas: el repositorio no contiene evidencia suficiente para establecer esos compromisos.

Los documentos históricos `docs/ROADMAP.md`, `docs/ARCHITECTURE.md` y `docs/ARQUITECTURA.md` describen objetivos de momentos anteriores. Este archivo refleja el avance observable y no los sustituye como registro histórico.
