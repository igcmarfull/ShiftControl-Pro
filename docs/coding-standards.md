# Estándares de código actuales

## Alcance

No existe configuración de formatter, linter, TypeScript, compilador o pruebas automatizadas. Estas reglas consolidan las convenciones observadas y las restricciones necesarias para mantener compatible el runtime actual; no introducen un framework nuevo.

## JavaScript

### Entorno

- Escribir JavaScript compatible con navegador moderno y ejecución directa.
- No usar imports ESM, sintaxis que requiera transpilación ni paquetes no cargados explícitamente.
- Los archivos extraídos usan IIFE para limitar variables locales y publican su API en `window`.
- Declarar de forma explícita los globals que deba consumir `index.html`.

Patrón actual:

```js
(function(){
  window.ExampleModule = {
    getAll(){
      // ...
    }
  };
})();
```

### Dependencias globales

- Comprobar que una dependencia global existe antes de invocarla cuando el orden o la carga pueda variar.
- Usar `window.Nombre` en los límites entre archivos.
- No renombrar funciones usadas por atributos HTML inline sin actualizar todos sus consumidores.
- Buscar redefiniciones posteriores antes de editar una función global: varias capas históricas envuelven o sustituyen implementaciones.

### Estado

- Obtener el estado modular mediante `window.ShiftControlState.get()` en los módulos ya extraídos.
- Mantener sincronizados `state`, `window.state` y `ShiftControlState.data`.
- Evitar sustituir la referencia compartida sin una migración deliberada; preferir mutación controlada cuando el contrato depende de identidad.
- Después de una mutación persistente, usar el mecanismo vigente de guardado.
- No crear un segundo estado canónico en `AppState` mientras el runtime siga consumiendo el estado legacy.

### Datos

- Usar fechas ISO (`YYYY-MM-DD`, `YYYY-MM` o fecha-hora ISO) según el campo existente.
- Mantener los códigos de turno actuales `A`, `B`, `C` y los códigos ya interpretados por planificación.
- Generar identificadores con el helper o mecanismo ya utilizado por el área.
- Normalizar arreglos opcionales antes de operar sobre ellos.
- Preservar referencias entre trabajadores, planes, ejecuciones, ausencias y jornadas adicionales.
- No inferir esquemas desde archivos vacíos.

### Errores y degradación

- La persistencia local debe continuar disponible si falla Supabase.
- Capturar y registrar errores de integración con contexto suficiente.
- No ocultar silenciosamente un error que pueda perder datos.
- Mantener las comprobaciones defensivas de renderizadores opcionales.

## HTML

- Conservar los identificadores de vistas y controles consumidos por JavaScript.
- Mantener las clases `.view`, la navegación por `data-view` y el contrato de `showView`.
- Reconocer que existen manejadores inline; no eliminar globals asociados sin migrarlos.
- Añadir atributos de accesibilidad siguiendo los patrones existentes cuando se toque un control.
- Evitar reordenar etiquetas `<script>` sin analizar dependencias e inicialización.

## CSS

- La base combina estilos inline versionados y `src/v20-interface.css`.
- Respetar las variables CSS ya definidas y los breakpoints del área intervenida.
- Evitar reglas globales no acotadas que puedan afectar vistas históricas.
- No trasladar o consolidar estilos como efecto secundario de una corrección funcional.
- Conservar reglas de impresión cuando se modifiquen reportes.

## Texto, fechas y moneda

- La interfaz está escrita en español.
- Los formateadores observados usan locale `es-CL`.
- Los montos funcionales se expresan en CLP.
- Mantener terminología ya utilizada en la vista correspondiente.

## Formato de cambios

- Respetar el estilo local del archivo; el repositorio contiene estilos históricos distintos.
- Evitar reformateos amplios, cambios de comillas o compactación/expansión sin relación con la tarea.
- Una extracción debe conservar primero el comportamiento y después, en un cambio separado, mejorar forma o estructura.
- Los comentarios deben explicar contratos, compatibilidad o motivos; no repetir literalmente el código.

## Seguridad

- No registrar contraseñas, sesiones, contenido completo del estado ni datos personales en consola.
- No copiar valores de configuración o datos operativos a documentación.
- La clave del cliente Supabase es publicable, pero su seguridad depende de políticas del backend que no están en este repositorio.
- No afirmar que la autenticación local equivale a autorización de servidor.

## Verificación

No hay un comando oficial de test. Para cada cambio se debe registrar qué se verificó realmente:

1. sintaxis de los JavaScript modificados;
2. carga de `index.html` sin errores nuevos en consola;
3. navegación y renderizado del área afectada;
4. guardado y recarga cuando se modifican datos;
5. comportamiento sin red cuando se toca sincronización;
6. `git diff --check`;
7. lista exacta de archivos modificados.

La validación manual no debe presentarse como una suite automatizada.

## Documentación

- Describir estado activo, estado parcial y estado futuro por separado.
- Citar rutas y símbolos reales.
- Actualizar `docs/architecture.md` o `docs/modules.md` cuando cambie una integración.
- No convertir registros históricos `CAMBIOS_V*.md` en requisitos vigentes sin confirmación.
