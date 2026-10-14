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
   **Pendiente de decisión.**

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

## Decisiones pendientes del propietario

1. Aplicar en Supabase la migración `20261014000001` (y revisar si
   `20260804000001` ya está aplicada o corregida a mano).
2. Definir el alcance de la separación estación/tienda: quién administra la
   tienda, qué personal pertenece a cada una y qué debe ver cada jefatura.
3. Autorizar la limpieza de datos incrustados en `index.html`.
