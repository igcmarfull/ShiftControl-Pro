# Separación Estación / Tienda — diseño de implementación

Estado: propuesta técnica, **no desplegada**. Rama: `feature/areas-estacion-tienda`.

## Decisión funcional
- Una empresa con áreas `ESTACION` y `TIENDA`.
- ADMIN administra ambas; CHIEF solo la asignada.
- Trabajadores antiguos sin área permanecen `sin asignar` hasta clasificación explícita del ADMIN.
- El sistema debe seguir admitiendo empresas distintas en el futuro.

## Bloqueadores de seguridad comprobados
1. `app_state` almacena un JSON **completo por empresa**. Sus políticas RLS actuales permiten SELECT/INSERT/UPDATE a cualquier miembro activo de la empresa. Un CHIEF puede, por tanto, acceder a datos de ambas áreas, aunque la interfaz los oculte.
2. `company_memberships_one_active_chief` limita a **un CHIEF por empresa**, no uno por área.
3. `assign_chief` (función SQL y Edge Function) está diseñada para reemplazar la única jefatura; requiere adaptación coordinada.
4. `src/auth.js` obtiene `company_id, user_id, role, active`, sin `area`.
5. `src/storage.js` sincroniza el estado completo con `upsert`, lo que puede sobrescribir cambios simultáneos.

## Secuencia segura de implementación
1. Crear migración aditiva: columna nullable `area` en `company_memberships`, CHECK de valores, nueva restricción única por `(company_id, area)` para CHIEF. Backfill del CHIEF existente solo después de confirmar su área; no inferir.
2. Actualizar Edge Function y función SQL de asignación de jefaturas para requerir `area` y mantener historial de asignaciones. Revisar `profiles` y policies para evitar filtración entre áreas.
3. **Antes de habilitar cuentas CHIEF por área**, reemplazar el acceso CHIEF al JSON compartido `app_state` por almacenamiento autorizado por área, o por operaciones de servidor que validen cada lectura/escritura. Mantener ADMIN con acceso global. No basta filtrar en JavaScript.
4. Adaptar AuthContext, módulos y pantallas; incluir selección y migración manual de áreas para trabajadores existentes.
5. Pruebas con dos CHIEF y un ADMIN: lectura, escritura, acceso cruzado denegado, concurrencia, cambios offline y recuperación.
6. Solo tras revisión, aplicar migraciones en un entorno de prueba y luego publicar.

## Estado del código de esta rama
- `EmployeeModule.getByArea()` y `getUnassigned()` son helpers de clasificación; no hacen autorización.
- `PlanningModule.getByArea()` es helper de lectura; no hace autorización.
- **No asignar acceso CHIEF por área ni publicar esta función como seguridad efectiva hasta completar los pasos anteriores.**
