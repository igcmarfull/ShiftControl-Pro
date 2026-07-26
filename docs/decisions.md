# Decisiones arquitectónicas observadas

## Uso de este registro

Estas entradas documentan decisiones inferidas directamente del código y del historial presente. El estado **vigente** significa que el runtime depende hoy de la decisión; **parcial** significa que hay una transición incompleta. No se registran funcionalidades hipotéticas.

## ADR-001 — Ejecución directa en navegador

- Estado: vigente.
- Contexto: el repositorio no contiene `package.json`, bundler, servidor ni artefactos de build.
- Decisión observada: `index.html` es el punto de entrada y se abre en un navegador moderno.
- Consecuencia: todo JavaScript cargado debe ser ejecutable sin compilación y el orden de scripts forma parte del runtime.

## ADR-002 — Modularización incremental del monolito

- Estado: vigente.
- Contexto: `index.html` mantiene el núcleo histórico mientras existen archivos extraídos en `src/`.
- Decisión observada: separar componentes gradualmente sin reescribir toda la aplicación.
- Consecuencia: coexisten lógica monolítica, módulos nuevos y capas de compatibilidad.

## ADR-003 — Integración mediante namespace global

- Estado: vigente.
- Contexto: no se usan imports ESM.
- Decisión observada: los archivos publican APIs como propiedades de `window` y se encapsulan habitualmente en IIFE.
- Consecuencia: nombres globales, handlers inline y orden de carga son contratos que deben preservarse durante la transición.

## ADR-004 — Estado compartido como fuente efectiva

- Estado: vigente.
- Contexto: `index.html` crea `state`; `AppState` también existe, pero no alimenta los renderizadores.
- Decisión observada: conectar el estado legacy a `ShiftControlState` y usar
  `ShiftControlState.replace(nextState)` como única operación oficial para
  sustituir la referencia completa.
- Consecuencia: `state`, `window.state` y `ShiftControlState.data` permanecen
  sincronizados después de inicialización, undo, redo, importación y
  recuperación remota.

## ADR-005 — Módulos de datos sobre el estado compartido

- Estado: vigente.
- Contexto: las diez colecciones principales tienen módulo activo.
- Decisión observada: los módulos obtienen el estado desde
  `ShiftControlState`, mutan su colección y delegan el guardado.
- Consecuencia: los módulos no son aislados ni puros; dependen del estado global y de `save()`.

## ADR-006 — Persistencia local con sincronización remota tolerante a fallos

- Estado: vigente.
- Contexto: el uso local precede a la integración de Supabase.
- Decisión observada: conservar `localStorage` como guardado inmediato y añadir sincronización diferida del estado principal a Supabase.
- Consecuencia: un fallo remoto genera una advertencia y no bloquea el trabajo local.

## ADR-007 — Sustitución canónica durante carga remota

- Estado: vigente.
- Contexto: módulos y legacy comparten una referencia mutable.
- Decisión observada: al recuperar Supabase, conservar exactamente el objeto
  recibido y publicarlo mediante `ShiftControlState.replace()`.
- Consecuencia: todos los consumidores dinámicos leen la nueva referencia y
  los campos desconocidos permanecen intactos.

## ADR-012 — Propiedad modular de las colecciones principales

- Estado: vigente.
- Contexto: la migración incremental encapsuló configuración, trabajadores,
  planificación, asistencia, jornadas adicionales, ausencias, feriados,
  auditoría y cierres.
- Decisión observada: cada colección principal tiene un módulo propietario de
  sus mutaciones runtime; `index.html` conserva reglas, coordinación y UI.
- Consecuencia: una futura persistencia relacional puede sustituirse detrás de
  contratos de módulo sin exigir primero otra extracción de dominios.

## ADR-008 — Almacenes auxiliares separados

- Estado: vigente por existencia, no consolidado.
- Contexto: varias áreas guardan sus propios objetos en claves de navegador.
- Decisión observada: incidencias, checklists, entregas, evaluaciones, autenticación, finanzas, depósitos y utilidades conservan almacenamiento independiente.
- Consecuencia: `src/storage.js` no sincroniza automáticamente todo el estado funcional de la aplicación.

## ADR-009 — Capa visual acumulativa

- Estado: vigente.
- Contexto: hay CSS y JavaScript inline de distintas versiones, más `src/v20-interface.*`.
- Decisión observada: extender o envolver la interfaz existente, incluyendo redefiniciones tardías de renderizadores.
- Consecuencia: para conocer la implementación efectiva hay que revisar el orden completo del documento, no solo la primera definición.

## ADR-010 — Dependencia de Supabase desde CDN

- Estado: vigente.
- Contexto: `index.html` carga `@supabase/supabase-js@2` desde jsDelivr.
- Decisión observada: no empaquetar la librería dentro del repositorio.
- Consecuencia: la sincronización remota depende de conectividad y disponibilidad del CDN; la ruta local sigue disponible.

## ADR-011 — Documentar antes de ampliar la arquitectura

- Estado: adoptada por esta base documental.
- Contexto: la migración contiene piezas activas, parciales, vacías y no cargadas.
- Decisión: mantener separados los hechos del runtime, los antecedentes históricos y el trabajo propuesto.
- Consecuencia: un nombre de archivo, documento de versión o módulo no cargado no se considera funcionalidad vigente.

## Temas no resueltos

El repositorio no contiene una decisión final para:

- el papel definitivo de `AppState`;
- la duplicación del bootstrap de almacenamiento;
- el destino de los adaptadores en `src/storage/`;
- la consolidación de claves locales auxiliares;
- una estrategia automatizada de pruebas;
- empaquetado o despliegue.

Resolver uno de estos temas requiere una decisión explícita y un cambio separado; este documento no selecciona una alternativa.
