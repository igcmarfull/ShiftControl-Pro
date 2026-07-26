# Flujo Git

## Estado observado

Al 26 de julio de 2026:

- rama activa durante el levantamiento: `feature/v31-architecture`;
- rama principal remota: `origin/main`;
- ramas locales o remotas observadas: `feat/supabase-sync`, `feature/v31-architecture`, `refactor/architecture` y una rama de análisis de agentes;
- prefijos de commits usados recientemente: `feat:`, `fix:` y `refactor:`;
- los commits recientes son pequeños y están centrados en la migración de módulos y estado;
- no hay plantilla de pull request, hooks, configuración de CI ni reglas de ramas almacenadas en el repositorio.

Este archivo no afirma políticas de GitHub que no puedan comprobarse localmente.

## Principios de trabajo

1. Revisar el estado antes de editar:

   ```bash
   git status --short
   git branch --show-current
   ```

2. Preservar archivos modificados o no rastreados que ya existan. No asumir que pertenecen a la tarea actual.
3. Crear o cambiar de rama solo si el usuario lo solicita o el alcance acordado lo requiere explícitamente.
4. Mantener cada cambio enfocado en un solo propósito.
5. No mezclar refactorización, formato y comportamiento en el mismo cambio sin necesidad.
6. No hacer commit, push, merge, rebase ni abrir pull requests sin autorización explícita.

## Ramas

Los nombres observados siguen principalmente estos patrones:

- `feature/<tema>`;
- `feat/<tema>`;
- `refactor/<tema>`;
- `agents/<tema>`.

No hay evidencia de una convención única obligatoria. Si se solicita una rama nueva, usar el patrón que corresponda al tipo de cambio y un nombre breve en minúsculas, sin alterar ramas existentes del usuario.

## Commits

Cuando el usuario autorice un commit:

- revisar el diff completo;
- incluir solo archivos pertenecientes al alcance;
- usar un mensaje imperativo y concreto;
- conservar los prefijos observados cuando sean aplicables.

Ejemplos de forma, no tareas pendientes:

```text
feat: <capacidad incorporada>
fix: <problema corregido>
refactor: <límite interno migrado>
docs: <documentación actualizada>
```

El prefijo `docs:` no se observa en el tramo reciente consultado, pero describe de forma inequívoca cambios exclusivos de documentación. Su uso debe confirmarse si el proyecto adopta una lista cerrada de prefijos.

## Verificación antes de un commit

Como mínimo:

```bash
git diff --check
git diff --name-only
git status --short
```

Además, ejecutar las comprobaciones manuales o sintácticas correspondientes al cambio. El repositorio no dispone hoy de un comando de test automatizado; no usar esa ausencia para omitir la verificación del navegador cuando se modifica el runtime.

## Push y pull requests

Antes de publicar:

- confirmar la rama y el remoto de destino;
- confirmar que no se incluyan datos locales, sesiones, credenciales o archivos ajenos;
- resumir qué se validó realmente;
- declarar riesgos o verificaciones pendientes;
- no marcar como resuelta una migración parcial si siguen existiendo consumidores legacy.

## Operaciones a evitar

- `git reset --hard` o descarte masivo de cambios;
- checkout destructivo de archivos con trabajo ajeno;
- agregar todos los archivos sin revisar;
- reescribir historial compartido sin una petición explícita;
- incorporar respaldos, datos exportados o estado del navegador;
- hacer push directo a `main` por suposición.

## Regla para agentes

Una petición de análisis, documentación o modificación de archivos no autoriza por sí sola a crear commits o publicar cambios. Esas acciones requieren instrucciones expresas e independientes.
