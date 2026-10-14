# Auditoría funcional — 14 de octubre de 2026

Estado al cierre de la sesión de continuación: el pull request #5 está
fusionado en `main` (commit `eee9b71`) y publicado en Vercel; la fase 1 del
aislamiento está aplicada en Supabase y la fase 2 sigue pendiente (ver
`docs/fase2-aislamiento-app-state.md`). El texto de más abajo conserva el
registro de la auditoría original, hecha sobre `main` en `f238a05`; las
secciones «Cambios aplicados en producción» y «Aislamiento de app_state»
indican qué se aplicó y cuándo. En la sesión de continuación no se modificó
producción.

## Punto de partida

| Referencia | Estado |
| --- | --- |
| `main` (`f238a05`, 4 ago 2026) | Última versión estable. Sin cambios de ChatGPT. Base de la recuperación. |
| `v42-production` (`36ffecb`) | Release estable anterior; `main` agrega recuperación de contraseña y "Equipo de estación". |
| `feature/areas-estacion-tienda` (`81417a7`) | 301 commits del 12 y 13 de octubre (ChatGPT). No fusionada en `main`. Se conserva intacta. |

## Cómo se probó

- Navegador Chromium real (Playwright) contra `index.html`, con un Supabase
  simulado en memoria compartido por dos sesiones (gerente y jefa). No se usó
  la base de datos real.
- Migraciones SQL aplicadas sobre PostgreSQL 16 local con un esquema mínimo
  equivalente a Supabase (`auth.uid()`, roles `anon` y `authenticated`) para
  probar las policies RLS.
- No hay suite automatizada en el repositorio; los scripts de prueba quedaron
  fuera del repositorio.

## Hallazgos

### Críticos

1. **Pérdida de cambios entre usuarios** (`main`, `src/storage.js`). Cada
   guardado subía el JSON completo y ganaba el último. Comprobado: la jefa
   asigna un turno, el gerente guarda otro cambio y el turno de la jefa
   desaparece. Con guardados casi simultáneos se perdía el de uno de los dos.
   **Corregido.**
2. **El gerente no veía los cambios de la jefa sin recargar** (`main`). No
   existía ninguna actualización remota después del inicio. **Corregido.**
3. **Recursión infinita en RLS** (`main`,
   `supabase/migrations/20260804000001_team_management.sql`). La policy
   `company_memberships_select_admin` consulta su propia tabla. Aplicada tal
   cual, bloquea el inicio de sesión de todos los usuarios ("infinite
   recursion detected in policy"). **Ya estaba corregido en producción**
   por `20260804000002_fix_company_memberships_rls_recursion.sql`, que ahora
   está en el repositorio.
4. **La rama de ChatGPT elimina el panel de la jefa.** En
   `feature/areas-estacion-tienda` la jefa solo ve "Planificación de turnos"
   con el mensaje "El administrador aún no ha migrado los turnos de esta
   área"; todas sus escrituras quedan bloqueadas hasta una migración de base
   de datos que no existe en producción. **No fusionar.**

### Altos

5. **Vista semanal y registro real vacíos para la jefa** (`main`). Filtraban
   por área exactamente `Isla`; la planificación mensual sí tenía un
   respaldo. Con personal sin área o con otra escritura, la jefa veía grillas
   vacías. **Corregido** con el mismo criterio de la planificación mensual.
6. **La jefa puede escribir todo el estado de la empresa en Supabase**
   (policies de `app_state`). Los permisos de la jefa existen solo en la
   interfaz; técnicamente puede modificar finanzas o configuración. Es una
   limitación del modelo de un solo JSON por empresa. **Pendiente de
   decisión** (ver separación estación/tienda).

### Medios

7. **Indicador "Guardado localmente" fijo**: no reflejaba el estado real.
   **Corregido** (Sincronizado / Guardando… / Sin conexión).
8. **Nombres reales del personal incrustados en `index.html`** (restos de un
   HTML guardado desde el navegador; se reemplazan al renderizar). Eran 13
   nombres en 150 líneas de 21 contenedores del DOM pre-renderizado, servidos
   públicamente con la app. **Corregido en `index.html`** (ver «Limpieza de datos
   embebidos»). Siguen en el historial de git y en el respaldo V19.
9. **Separación estación/tienda inexistente en `main`.** El personal solo
   tiene un campo libre `area`; la tienda existe como módulo de facturas.
   **Implementada** según la definición del propietario: el gerente
   administra y ve ambas áreas, la Jefa de Isla ve la isla y la Jefa de
   Tienda ve la tienda (ver «Separación estación/tienda»).

### Bajos

10. La jefa veía el botón "Cerrar mes" aunque no tiene permiso.
    **Corregido** (se oculta con el mecanismo de permisos existente).
11. Las ausencias de los datos de demostración usan `start`/`end` sin
    `from`/`to`, y la vista semanal no las muestra. Los registros creados por
    la interfaz guardan ambos campos. **Pendiente** (solo datos demo o
    registros antiguos).
12. Al abrir la app sin conexión no se puede validar la sesión. Los cambios
    locales se conservan y se suben al volver a iniciar con conexión.

## Funciones verificadas en `main`

- Gerente: las 23 vistas abren sin errores de consola.
- Jefa: las 14 vistas de su rol abren sin errores; no ve vistas de
  administración.
- Planificación (celda individual), asistencia con reemplazo y jornada
  adicional automática, ausencias con sincronización al registro real,
  validación de jornada adicional sin motivo.
- Sincronización tras la corrección: 20 ediciones concurrentes de dos usuarios
  sin pérdidas; ajustes distintos de configuración combinados; borrados
  propagados; cambios sin conexión recuperados al reconectar o recargar; sin
  duplicados en la misma celda.

## Rama de ChatGPT: qué contiene

- Calendario nuevo por área (`area-calendar-view.js`, 1.715 líneas) que
  sustituye el panel de la jefa.
- Tabla `area_state`, RPC y seis migraciones nuevas, incluida una que bloquea
  `app_state` para las jefas. Ninguna está aplicada según el código de
  `main`.
- Pruebas y un workflow de GitHub Actions.

Ideas reutilizables más adelante, con revisión: clasificación de personal por
área y control de concurrencia por revisión. No se recomienda incorporar el
calendario nuevo.

## Separación estación/tienda

Definición del propietario: el gerente administra la tienda y la isla y
visualiza ambas; la Jefa de Isla ve la isla y la Jefa de Tienda, la tienda.

Implementación:

- `src/app/areas.js`: área de cada trabajador y recorte del estado por área.
- `src/storage.js`: cada jefa carga solo su área y sus cambios se combinan
  sobre el estado completo de Supabase.
- `src/auth.js` y `src/app/permissions.js`: área de la jefatura y vistas de la
  Jefa de Tienda.
- «Equipo de estación»: el gerente asigna o reemplaza cada jefatura.
- Supabase (ya aplicado en producción): `assign_chief_area` y el índice de una
  jefatura activa por área (`20261013030435`, `20261013035308`,
  `20261014004254`), con la Edge Function `assign-chief`. Impiden además que
  un administrador se asigne como jefa.

Verificado en navegador con tres sesiones (gerente, Jefa de Isla y Jefa de
Tienda): cada jefa ve solo su personal; ediciones simultáneas de las tres
quedan guardadas; un borrado de una jefa no afecta la otra área; el gerente ve
todo sin recargar; una trabajadora creada por la Jefa de Tienda queda en
Tienda; una reclasificación del gerente se refleja en ambas jefas; al cambiar
de usuario en la misma pestaña cada sesión carga solo su área.

Incidencias, checklist y entrega de turno también se separan por área: cada
jefa registra y ve las de su área y el gerente alterna entre Isla y Tienda.
Las entregas de turno, que antes quedaban solo en el navegador de quien las
registraba, ahora se sincronizan con Supabase (hallazgo adicional corregido).

El checklist de tienda tiene los cinco puntos generales y ocho controles de
la operación (temperaturas, vencimientos FEFO, limpieza Fast Food y Bakery,
reposición, caja, equipos, mermas y bodega 6S), con responsable, fecha,
observaciones y fotos por punto. Los incumplimientos quedan en seguimiento en
la Bandeja ADMIN hasta que el gerente los resuelve. Verificado en navegador:
foto reducida y subida, miniatura visible para la jefa y el gerente, bloqueo
de envío sin observaciones, resolución con comentario visible para la jefa, y
mensaje claro si el bucket aún no existe.

La Jefa de Tienda registra facturas de tienda con respaldo (foto o PDF); el
gerente las aprueba o rechaza con motivo desde «Facturas y compras» o la
Bandeja ADMIN, y solo las aprobadas cuentan en los totales. Verificado en
navegador: envío con foto y con PDF, aprobación y rechazo, corrección y
reenvío, totales sin facturas pendientes, bloqueo de pagos y de edición de
aprobadas para la jefa.

Límite conocido: la separación es de la aplicación. Una jefa con
conocimientos técnicos podría leer el JSON completo desde Supabase. Aislarlo
en la base de datos requiere dividir `app_state` por área.

### Estado real de Supabase (revisado el 14-10-2026 con acceso de lectura)

- Producción ya tenía aplicadas migraciones que no estaban en el repositorio:
  la corrección de la recursión (`20260804000002`, con `is_company_admin`),
  la columna `company_memberships.area` con valores `ESTACION` y `TIENDA`,
  `area_state`, `assign_chief_area` (traduce `ISLA` a `ESTACION` y no permite
  asignar administradores), una jefatura activa por área y un respaldo en
  `shiftcontrol_backup.snapshot_before_area_cutover`. Se copiaron al
  repositorio con sus versiones exactas (contenido verificado por hash).
- La Edge Function `assign-chief` desplegada corresponde a la de esta rama con
  la traducción a `ESTACION`; el repositorio quedó igual a lo desplegado.
- Las migraciones `20261014000001` y `20261014000002` de esta rama se
  eliminaron: la primera ya estaba resuelta y la segunda era incompatible con
  los valores `ESTACION`/`TIENDA`. La app interpreta `ESTACION` como isla.
- Existen ya una jefatura activa de isla (`ESTACION`) y una de tienda.

### Cambios aplicados en producción el 14-10-2026 (autorizados)

- Evidencia: bucket privado `shiftcontrol-evidence` (fotos y PDF, 5 MB),
  función `can_access_evidence_path` y policies de lectura y escritura
  (`20261014013820`, `20261014013846`, `20261014013917`, `20261014013923`).
  Verificado en producción: el administrador accede a Isla, Tienda y
  facturas generales; la jefa de isla solo a Isla; la jefa de tienda solo a
  Tienda; cuentas inactivas y otras empresas a nada.
- `20261014013623`: se quitó el permiso de ejecución de
  `handle_new_auth_user` a `anon` y `authenticated`. Verificado: el registro
  sigue creando el perfil y el inicio de sesión de cada cuenta sigue
  funcionando. El aviso del linter desapareció.
- La membresía de la Jefa de Tienda se desactivó (`active = false`) porque la
  app publicada no separa áreas y le daba lectura y escritura de todo
  `app_state`. La cuenta, el perfil y los datos se conservan; para
  reactivarla: `update public.company_memberships set active = true where
  role = 'CHIEF' and area = 'TIENDA';`.
- Datos verificados después de los cambios: 4 usuarios, 14 trabajadoras,
  655 turnos, 29 asistencias y 3 facturas.

### Aislamiento de app_state en la base de datos

- Fase 1, **aplicada en producción el 14-10-2026** (autorizada):
  `20261014021748_area_app_state_rpc.sql` con `get_area_app_state`,
  `get_app_state_version` y `save_area_app_state`, y la corrección
  `20261014021940_checklist_merge_unchanged.sql`. No cambia permisos: la app
  publicada sigue funcionando igual. Verificado en producción con los datos
  reales, en transacciones revertidas: la Jefa de Isla recibe 13
  trabajadoras y 648 turnos, sin facturas, finanzas ni historial; guardar sin
  cambios deja el estado idéntico (655 turnos, 29 asistencias, 3 facturas);
  una versión vieja se rechaza; la Jefa de Tienda desactivada no accede. Esa
  verificación detectó que un checklist de isla sin enviar recibía el campo
  `area` aunque nada cambiara; se corrigió con la segunda migración.
- Fase 2, **pendiente**: `20261014200100_lock_app_state_to_admin.sql`
  (`app_state` solo para el administrador).
- Verificado en PostgreSQL local con todas las migraciones del repositorio y
  datos con la forma de producción (14 trabajadoras, 655 turnos, 29
  asistencias, 3 facturas):
  - lectura: la isla recibe 13 trabajadoras y 609 turnos; la tienda, 1 y 46;
    ninguna recibe finanzas, depósitos, faltantes ni historial;
  - guardar sin cambios deja el estado idéntico (incluido el orden);
  - ataques de la jefa de tienda bloqueados: turnos o edición de personal de
    isla, cambio de área, autoaprobación de facturas y evaluaciones, pagos de
    jornadas, edición o borrado de registros aprobados, resolución de
    seguimientos, configuración, finanzas, cierres e historial;
  - un envío mal formado no borra datos; no quedan ids duplicados;
  - fase 2: la jefa no lee, actualiza ni inserta en `app_state`; el gerente
    mantiene acceso completo; jefas inactivas y anónimos no acceden;
  - tiempo de guardado: 51 ms con el volumen actual y 254 ms con ocho veces
    más turnos.
- Verificado en navegador con un emulador de Supabase sobre ese PostgreSQL
  (RLS y funciones reales): las pruebas de sincronización, áreas,
  incidencias, checklist con fotos, facturas, trabajo sin conexión y cambio
  de usuario pasan; desde la consola, la jefa no puede leer ni modificar
  `app_state` y una factura autoaprobada queda pendiente. Una prueba de áreas
  falló una vez de seis sin poder reproducirse.
- Compatibilidad comprobada: la app actual (`main`) sigue funcionando con la
  fase 1; la app nueva funciona sin fases, con la fase 1 y con ambas; la app
  actual deja de guardar para las jefas con la fase 2.

### Orden de publicación propuesto

1. ~~Aplicar la fase 1~~ (hecho).
2. ~~Fusionar el pull request y publicar en Vercel~~ (hecho: #5, `eee9b71`).
3. ~~Verificar con el gerente y la Jefa de Isla en producción~~ (hecho por el
   propietario: paneles, sincronización entre sesiones y desde un teléfono con 4G).
4. Aplicar la fase 2. Procedimiento, pruebas y reversión preparados en
   `docs/fase2-aislamiento-app-state.md`. **Pendiente de autorización.**
5. Reactivar la Jefa de Tienda (después de verificar la fase 2).

### Limpieza de datos embebidos (sesión de continuación)

- Alcance: el DOM pre-renderizado de `index.html` (restos de un HTML guardado)
  contenía 13 nombres de personal real, con identificadores internos, en 21
  contenedores de renderizado dinámico (`todayTable`, `planningGrid`,
  `weekGrid`, `actualCalendarGrid`, `executionTable`, `employeeTable`,
  `additionalTable`, `reportTable`, `accountingReportTable`, `auditList`,
  `absencePanelTable`, `uncoveredShiftsList`, `upcomingReturnsList` y los
  selectores de trabajadores). Los 13 trabajadores de arranque del código
  (`state` inicial y `demoEmployees`) son datos de demostración con RUT de
  patrón repetido y no se consideran sensibles.
- Cambio: esos contenedores se dejaron vacíos y en los selectores solo se
  quitaron las opciones con identificador de trabajador (se conserva «Todos»).
  Se eliminaron unos 343 mil caracteres. Todos se vuelven a pintar al iniciar.
- Verificación en Chromium con un Supabase simulado en memoria (sin tocar el
  real): para el rol administrador, el texto y el HTML de las 23 vistas son
  idénticos antes y después (normalizando identificadores y horas), con 0
  errores de consola. Para el rol jefatura la única diferencia es
  `accountingReportTable`: en la versión anterior quedaba con 13 nombres
  reales visibles en el DOM de una vista que la jefa no usa; ahora está vacío.
  No se modificó ni leyó ningún dato de Supabase.
- No se tocó: `docs/ShiftControl_Pro_V19_Respaldo.html` contiene los mismos 13
  nombres (150 líneas) y es un respaldo histórico; `AGENTS.md` prohíbe
  modificarlo sin petición explícita. El historial de git (22 commits de
  `index.html`) también los conserva; quitarlos exigiría reescribir la historia.
  Ver «Decisiones pendientes».

### Otros pendientes

- Activar la protección contra contraseñas filtradas en Supabase
  (Authentication → Settings). El linter de seguridad la sigue marcando.
- Revisar la clasificación del personal en «Trabajadores» (hoy 13 con área
  "Isla" y 1 con "TIENDA").
- Reactivar la Jefa de Tienda después de aplicar y verificar la fase 2
  (`docs/fase2-aislamiento-app-state.md`, paso 6). Hasta entonces permanece
  desactivada.
- `app_state` conserva un `UNIQUE (key)` heredado además de la clave primaria
  `(company_id, key)`: una segunda empresa no podría reutilizar la clave de
  estado. No afecta con una sola empresa. Propuesta, sin urgencia: retirarlo con
  una migración propia, verificada antes.
- La tabla original `app_state` no figura en ninguna migración: la base no se
  puede reconstruir desde cero solo con el repositorio. Propuesta: una
  migración de línea base documentada.
- Las ausencias de demostración con `start`/`end` sin `from`/`to` (hallazgo 11)
  siguen como propuesta, por decisión del propietario, para después de cerrar la
  seguridad.

Todas las migraciones aplicables y la Edge Function ya están en producción; la
excepción es la fase 2.

## Decisiones pendientes del propietario

1. Autorizar la aplicación de la fase 2 y la reactivación de la Jefa de Tienda
   (procedimiento y reversión en `docs/fase2-aislamiento-app-state.md`).
2. Decidir qué hacer con los 13 nombres que permanecen en
   `docs/ShiftControl_Pro_V19_Respaldo.html` (anonimizar el respaldo o dejarlo
   así) y en el historial de git (reescribir la historia solo si el repositorio
   es o será público; hoy no se propone).
3. Aprobar los cambios de esta rama para su fusión (`index.html` sin datos
   embebidos y documentación).
