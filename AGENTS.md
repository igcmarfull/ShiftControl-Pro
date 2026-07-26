# Instrucciones para agentes

Estas reglas aplican a todo el repositorio.

## Antes de cambiar archivos

1. Leer `SHIFTCONTROL_OS.md`, `AI_CONTEXT.md` y la documentación pertinente en `docs/`.
2. Revisar `git status --short` y tratar toda modificación existente como trabajo del usuario.
3. Inspeccionar el código real antes de afirmar que un módulo, una dependencia o un flujo está activo.
4. Comprobar las etiquetas `<script>` de `index.html`: la presencia de un archivo en `src/` no implica que se ejecute.

## Arquitectura que se debe preservar

- La aplicación se ejecuta directamente en el navegador desde `index.html`.
- No hay proceso de build, gestor de paquetes, framework, linter ni suite de pruebas configurados.
- `index.html` continúa siendo el núcleo histórico.
- El estado principal nace como `state`, se expone mediante `window.state` y se conecta a `window.ShiftControlState`.
- `save()` persiste el estado principal y `src/storage.js` añade la sincronización con Supabase.
- La integración entre archivos usa IIFE y objetos o funciones globales en `window`.
- El orden de carga de scripts es significativo.

No reemplazar estos contratos de forma incidental. Una migración de arquitectura debe ser solicitada, acotada y verificada como tal.

## Reglas de implementación

- Cambiar solo lo necesario para la tarea solicitada.
- No inventar funcionalidades, entidades, endpoints, tablas, permisos ni requisitos de negocio.
- No completar archivos vacíos basándose solo en su nombre.
- No duplicar lógica ya extraída a `EmployeeModule`, `PlanningModule` o `AttendanceModule`.
- Antes de usar `AdditionalModule` u otro adaptador presente, verificar si está cargado e inicializado en el runtime.
- Conservar los nombres globales consumidos por HTML inline y atributos `onclick`.
- Mantener la referencia compartida del estado; no sustituir el objeto sin revisar `state`, `window.state` y `ShiftControlState`.
- Toda escritura persistente del estado principal debe respetar el camino vigente de `save()`.
- No exponer valores de configuración, sesiones ni datos almacenados por usuarios.
- No modificar archivos históricos de respaldo salvo petición explícita.

## Estilo compatible con el código actual

- JavaScript de navegador sin transpilación.
- IIFE para archivos que solo publican una API global.
- Comprobaciones defensivas para dependencias globales que pueden no estar disponibles.
- Fechas persistidas en formatos ISO ya usados por el código.
- Identificadores de registros generados con el mecanismo existente.
- Texto de interfaz en español y formato local `es-CL` cuando corresponda.

No existe una herramienta automática de formato. Respetar el estilo del archivo intervenido y evitar reformateos masivos.

## Verificación mínima

Según el alcance del cambio:

- validar sintaxis de los JavaScript modificados;
- confirmar el orden y la existencia de scripts cargados;
- abrir `index.html` y revisar la consola cuando el cambio afecte el runtime;
- comprobar carga, guardado y renderizado si se modifica estado;
- revisar `git diff --check`, `git diff --name-only` y `git status --short`;
- dejar constancia de cualquier validación que no pueda ejecutarse.

Actualmente no existe una suite automatizada en el repositorio; no afirmar que “las pruebas pasan” si solo se realizó una comprobación manual o sintáctica.

## Git y alcance

- No crear commits, cambiar ramas, hacer push, abrir pull requests ni modificar remotos sin autorización explícita.
- No descartar, sobrescribir ni incorporar cambios preexistentes del usuario.
- Usar los prefijos de commit observados (`feat:`, `fix:`, `refactor:`) solo cuando el usuario solicite un commit.
- Seguir `docs/git-workflow.md`.

## Documentación

Actualizar esta base únicamente cuando un cambio aprobado haga que deje de describir el código real. Separar siempre:

- comportamiento activo;
- piezas presentes pero no integradas;
- antecedentes históricos;
- trabajo futuro propuesto.
