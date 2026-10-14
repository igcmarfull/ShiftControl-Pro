# Auditoría funcional — 14 de octubre de 2026

Rama de trabajo: `claude/hola-maquina-nik02q` (parte de `main`, commit `f238a05`).
Producción no fue modificada. No se aplicaron migraciones en Supabase.

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
   recursion detected in policy"). **Migración correctora preparada:**
   `20261014000001_fix_memberships_admin_policy.sql` (probada en PostgreSQL,
   idempotente, pendiente de aplicar por el administrador).
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
   HTML guardado desde el navegador; se reemplazan al renderizar). Conviene
   limpiarlos si el repositorio es o será público. **Pendiente.**
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
- `supabase/migrations/20261014000002_chief_areas.sql` y la Edge Function
  `assign-chief`: una jefatura activa por área. La migración impide además que
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

Límite conocido: la separación es de la aplicación. Una jefa con
conocimientos técnicos podría leer el JSON completo desde Supabase. Aislarlo
en la base de datos requiere dividir `app_state` por área.

Para activarla en producción, en este orden:

1. Clasificar al personal con área "Isla" o "Tienda" desde «Trabajadores».
2. Aplicar `20261014000001_fix_memberships_admin_policy.sql`,
   `20261014000002_chief_areas.sql` y
   `20261014000003_checklist_evidence_storage.sql` (bucket privado de fotos
   del checklist).
3. Desplegar la Edge Function `assign-chief`.
4. Asignar la Jefa de Tienda desde «Equipo de estación».

Sin los pasos 2 y 3, la aplicación sigue funcionando como antes con una sola
Jefa de Isla.

## Decisiones pendientes del propietario

1. Aplicar en Supabase la migración `20261014000001` (y revisar si
   `20260804000001` ya está aplicada o corregida a mano).
2. Definir si la Jefa de Tienda debe ver «Facturas y compras».
3. Autorizar la limpieza de datos incrustados en `index.html`.
