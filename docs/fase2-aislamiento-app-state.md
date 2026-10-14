# Fase 2 del aislamiento de `app_state`: procedimiento y reversión

Estado: **aplicada en producción el 14-10-2026** (autorizada por el propietario).
La Jefa de Tienda sigue desactivada. Este documento no autoriza nada nuevo: cada
paso que escribe en Supabase requiere autorización expresa.

## Registro de la aplicación (14-10-2026)

- Respaldo previo: `shiftcontrol_backup.app_state_before_fase2` (1 fila, sin acceso
  para `anon` ni `authenticated`). Verificación previa con `'abierto'`: OK.
- La herramienta de migraciones de Supabase no ejecuta ninguna sentencia `DROP`
  sin confirmación del propietario y esa confirmación no llegó (se comprobó con
  un `DROP` de un objeto inexistente). La migración se aplicó entonces desde el
  *SQL Editor* del panel de Supabase, en una transacción, con el contenido de
  `20261014200100_lock_app_state_to_admin.sql`. Como el editor no registra el
  historial, la versión `20261014200100` se insertó a mano en
  `supabase_migrations.schema_migrations`, con el mismo número que el archivo.
- Verificación posterior con `'bloqueado'`: `VERIFICACIÓN OK`. Administrador:
  lee, actualiza e inserta (14 trabajadores, 673 turnos, 3 facturas). Jefa de
  Isla: lectura, actualización e inserción directas bloqueadas; la función por
  área devuelve 13 trabajadoras y 666 turnos, 0 depósitos y 0 historial; guardar
  sin cambios deja el estado idéntico. Jefa de Tienda inactiva y usuario sin
  sesión: sin acceso.
- Huella de las policies tras aplicar: `7e9f95ed8b01e0d9cd1638018f2150b2` (la
  misma que produce la base local con la fase 2). Datos idénticos al respaldo
  (14 trabajadores, 673 turnos, 31 asistencias, 3 facturas). El linter de
  seguridad no muestra advertencias nuevas.
- Pendiente tras la fase 2: que el propietario confirme en la app el panel de
  gerente y el de la Jefa de Isla, y la reactivación de la Jefa de Tienda
  (paso 6, con autorización).

## Qué hace y qué no hace

`supabase/migrations/20261014200100_lock_app_state_to_admin.sql` reemplaza las
tres policies de `app_state` que permiten a cualquier miembro activo leer y
escribir (`*_for_active_members`) por tres que solo permiten al administrador
activo de la empresa (`*_for_admins`, con `is_company_admin`).

- No toca datos, tablas, funciones ni membresías.
- Las jefaturas siguen trabajando por `get_area_app_state`,
  `get_app_state_version` y `save_area_app_state`, que ya existen (fase 1) y que
  la app publicada usa.
- Cierra el límite conocido de la auditoría (hallazgo 6): una jefa con
  conocimientos técnicos podía leer y modificar desde la consola todo el estado
  de la empresa.

Solo se afecta a quien no sea administrador y acceda directo a `app_state`.

## Estado verificado el 14-10-2026 (solo lectura)

- Las 18 migraciones aplicadas en producción coinciden con las del repositorio;
  la única pendiente es la fase 2.
- Membresías: 1 administrador activo, 1 Jefa de Isla activa (`ESTACION`),
  1 Jefa de Tienda inactiva (`TIENDA`) y 1 jefatura antigua inactiva sin área.
- Policies actuales de `app_state`: las tres de miembros activos. Huella
  (`md5` de nombre, comando, roles, `qual` y `with_check`):
  `ef360d8c596c770a3138fa5c75fe4d19`. Es la misma que produce la base local con
  la fase 1 y la que deja la reversión.
- `src/storage.js` usa las funciones por área cuando la sesión es de una jefa.

## Pruebas disponibles

| Script | Dónde | Qué comprueba |
| --- | --- | --- |
| `supabase/tests/fase2_local.sql` | Base local desechable, con datos ficticios | Administrador con acceso completo y aislado de otras empresas; jefa de isla sin select, update, insert ni delete directos; sus funciones por área (recorte, guardar sin cambios idéntico, turno propio aceptado, turno de tienda rechazado, factura nunca autoaprobada, versión vieja rechazada con `40001`); jefa de tienda inactiva sin acceso; jefa de tienda reactivada solo con su área; anónimos y otra empresa sin acceso; policies exactas. |
| `supabase/tests/fase2_produccion.sql` | Producción, con datos reales | Lo mismo sobre los usuarios reales, imprimiendo solo conteos. Es un único bloque `DO` que siempre termina en una excepción con el informe (`VERIFICACIÓN OK` o `VERIFICACIÓN FALLÓ`), lo que deshace de forma atómica cualquier escritura de prueba y funciona aunque la herramienta no muestre los `NOTICE`. Se ejecuta con `'abierto'` antes de la fase 2 y con `'bloqueado'` después (variable `v_esperado`). |

Resultado de la preparación (base local con todas las migraciones, PostgreSQL 16):

- `fase2_local.sql` con la fase 2: todas las comprobaciones pasan. Sin la fase 2
  falla en la primera («jefa de isla lee `app_state` directo»), así que sí
  detecta el problema.
- `fase2_produccion.sql` sobre datos ficticios con la forma de producción:
  pasa con `abierto` en fase 1 y con `bloqueado` en fase 2, y falla con la
  combinación contraria. También pasa con la Jefa de Tienda activa.
- `fase2_produccion.sql` se ejecutó contra producción con `'abierto'` el
  14-10-2026, antes de la fase 2, con resultado `VERIFICACIÓN OK` (administrador:
  14 trabajadores, 673 turnos, 3 facturas; Jefa de Isla: 13 trabajadoras y
  666 turnos por la función, 0 depósitos y 0 historial; guardar sin cambios deja
  el estado idéntico). Se comprobó después que `app_state` quedó idéntico al
  respaldo. Un primer intento falló por un error del propio guion (con
  `'abierto'` la inserción directa crea una fila extra y la comparación no
  filtraba por clave), no de la aplicación; está corregido y validado en local.

Para repetir en local, con una base desechable: crear un esquema mínimo
compatible con Supabase (`auth.users`, `auth.uid()`, roles `anon` y
`authenticated`, `storage.buckets`, `storage.objects`), crear antes de
`202607260002` la tabla original
`app_state(id uuid pk default gen_random_uuid(), key text not null unique, data jsonb not null, updated_at timestamptz default now())`,
aplicar todas las migraciones en orden y ejecutar
`psql -v ON_ERROR_STOP=1 -f supabase/tests/fase2_local.sql`.

## Procedimiento propuesto

Cada paso 3 en adelante necesita autorización.

1. **Cliente publicado.** Confirmar que Vercel sirve la versión que usa las
   funciones por área (commit `eee9b71` o posterior). No hay service worker: a
   quien tenga la app abierta desde antes le basta recargar. Pedir a la Jefa de
   Isla que recargue y no tenga cambios sin sincronizar (indicador
   «Sincronizado»).
2. **Verificación previa (opcional, solo lectura).** `list_migrations` y la
   huella de policies de arriba. Con autorización, ejecutar
   `fase2_produccion.sql` con `'abierto'`.
3. **Respaldo.** Con autorización:
   `create table shiftcontrol_backup.app_state_before_fase2 as table public.app_state;`
   seguido de `revoke all on shiftcontrol_backup.app_state_before_fase2 from public, anon, authenticated;`
   (el esquema `shiftcontrol_backup` ya existe y no es accesible a esos roles).
   Anotar conteos: 4 usuarios, 14 trabajadoras, 655 turnos, 29 asistencias y
   3 facturas el 14-10-2026.
4. **Aplicar** `20261014200100_lock_app_state_to_admin.sql` como una sola
   migración (el archivo no trae `begin`/`commit`: se aplica en la transacción
   de la herramienta de migraciones). El efecto es inmediato.
5. **Verificar de inmediato.** `fase2_produccion.sql` con `'bloqueado'` y, en la
   app, que el gerente sigue cargando y guardando y que la Jefa de Isla
   (idealmente en su teléfono con 4G) abre su panel, asigna un turno y lo ve el
   gerente sin recargar. Revisar `get_advisors` (seguridad) y los logs de API
   por errores `42501` o `401` de `app_state`.
6. **Reactivar a la Jefa de Tienda** solo con la fase 2 verificada:
   `update public.company_memberships set active = true where role = 'CHIEF' and area = 'TIENDA';`
   Repetir `fase2_produccion.sql` con `'bloqueado'` (ahora también valida su
   área) y que ella inicie sesión: debe ver solo el personal y los datos de
   Tienda.
7. Actualizar `docs/auditoria-2026-10-14.md` y la nota de «Pendiente» en
   `docs/architecture.md`.

## Reversión

Disparadores: la Jefa de Isla (o de Tienda) no puede cargar o guardar; errores
`42501` repetidos en los logs; un administrador sin acceso.

1. **Revertir** con `supabase/rollback/20261014200100_lock_app_state_to_admin.rollback.sql`.
   Es una transacción: elimina las policies de administrador y recrea las tres
   de miembros activos con su definición original; falla sin cambiar nada si el
   resultado no queda exactamente así. Es idempotente.
2. **Comprobar** que la huella de policies vuelve a `ef360d8c596c770a3138fa5c75fe4d19`
   y ejecutar `fase2_produccion.sql` con `'abierto'`.
3. **Mientras esté revertida**, mantener inactiva a la Jefa de Tienda (con las
   policies abiertas podría leer y escribir todo `app_state`). Si ya se había
   reactivado:
   `update public.company_memberships set active = false where role = 'CHIEF' and area = 'TIENDA';`
4. Los datos no se tocan en ningún sentido. Si hubiera que recuperarlos, la
   copia está en `shiftcontrol_backup.app_state_before_fase2` (paso 3) y en
   `shiftcontrol_backup.snapshot_before_area_cutover`.

Probado en local: `fase 1 → fase 2 → reversión` deja las policies con la misma
huella que la fase 1, y ejecutar la reversión dos veces es inofensivo.

## Riesgos conocidos

- Un navegador con una versión de la app anterior al PR #5 dejaría de guardar
  para una jefa tras la fase 2. Se resuelve recargando.
- `app_state` conserva un `UNIQUE (key)` heredado además de la clave primaria
  `(company_id, key)`. Con una sola empresa no afecta; una segunda empresa no
  podría usar la misma clave de estado.
- La tabla original `app_state` no está en las migraciones: la base no se puede
  reconstruir solo con el repositorio.
- Las funciones `SECURITY DEFINER` expuestas a `authenticated` que marca el
  linter son las funciones por área y las que usan las policies; su exposición
  es intencional. No se les debe retirar `EXECUTE`.
