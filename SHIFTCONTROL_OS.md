# ShiftControl OS

## Propósito

Este archivo es la entrada principal a la documentación técnica de ShiftControl Pro. Describe el sistema que existe en el repositorio al 26 de julio de 2026; no define funcionalidades nuevas ni reemplaza al código como fuente de verdad.

## Estado actual

ShiftControl Pro es una aplicación web de una sola página que se abre directamente desde `index.html`. No hay en el repositorio un gestor de paquetes, un proceso de compilación, un framework de interfaz, una suite de pruebas ni configuración de CI.

La aplicación está en una transición gradual desde un documento HTML monolítico hacia archivos y módulos separados:

- `index.html` conserva el marcado, gran parte de los estilos, la lógica histórica, el modelo inicial, los renderizadores y los flujos funcionales.
- `src/v20-interface.css` y `src/v20-interface.js` extienden la interfaz vigente.
- `src/app/` contiene piezas de inicialización y gestión de estado.
- `src/modules/` contiene módulos activos para trabajadores, planificación,
  asistencia, jornadas adicionales, ausencias, feriados, auditoría,
  configuración y cierres diarios y mensuales.
- `src/storage.js` conecta el estado principal con `localStorage` y Supabase.
- Otros adaptadores y módulos presentes en `src/` todavía no están conectados al flujo cargado por `index.html`.

## Mapa de documentación

- [AI_CONTEXT.md](AI_CONTEXT.md): contexto breve para asistentes de IA.
- [AGENTS.md](AGENTS.md): reglas de trabajo para agentes automáticos.
- [docs/architecture.md](docs/architecture.md): arquitectura y secuencia de arranque actuales.
- [docs/modules.md](docs/modules.md): inventario de módulos técnicos y áreas funcionales.
- [docs/coding-standards.md](docs/coding-standards.md): convenciones observadas y reglas de compatibilidad.
- [docs/roadmap.md](docs/roadmap.md): estado de la modularización, sin agregar alcance funcional.
- [docs/decisions.md](docs/decisions.md): decisiones arquitectónicas observadas.
- [docs/git-workflow.md](docs/git-workflow.md): flujo Git basado en el uso actual del repositorio.

Los archivos históricos en `docs/` con nombres en mayúsculas y los registros `CAMBIOS_V*.md` sirven como antecedentes. Esta base documental en minúsculas describe el estado comprobado del código actual.

## Modelo operativo actual

```text
Navegador
  └─ index.html
      ├─ DOM, estilos y lógica monolítica
      ├─ state + save() + renderAll()
      ├─ módulos globales cargados desde src/modules/
      ├─ extensiones de UI en src/v20-interface.*
      └─ persistencia
          ├─ localStorage
          └─ Supabase mediante src/storage.js
```

La integración se realiza mediante funciones y objetos en `window`, no mediante módulos ESM. El orden de las etiquetas `<script>` es parte del contrato de ejecución.

## Fuentes de verdad

1. El comportamiento real está en `index.html` y en los archivos que este carga.
2. El estado funcional principal es el objeto mutable creado como `state` en
   `index.html`, expuesto también como `window.state` y conectado a
   `window.ShiftControlState`. `ShiftControlState.replace()` es la única
   operación autorizada para reemplazar la referencia completa.
3. La clave local principal es `shiftcontrol_pro_v2_all_replacement_candidates`.
4. `src/storage.js` envuelve `save()` y sincroniza el mismo estado con la tabla `app_state` de Supabase usando la clave configurada en `src/config.js`.
5. Algunas áreas conservan almacenes independientes en `localStorage`; están inventariadas en `docs/architecture.md`.

`window.AppState` existe, pero hoy no es el estado canónico utilizado por los renderizadores y módulos funcionales.

Las colecciones principales `employees`, `plans`, `executions`, `additional`,
`absences`, `holidays`, `audit`, `settings`, `closedMonths` y
`dailyClosures` tienen módulos activos para sus mutaciones. `index.html`
conserva la orquestación, las lecturas, los cálculos y el renderizado.

## Límites de la base

Al trabajar sobre este repositorio:

- no asumir que un archivo presente está integrado: comprobar que `index.html` lo carga;
- no asumir que la documentación histórica coincide con el runtime actual;
- preservar la compatibilidad con los globals y el orden de carga mientras siga vigente esta arquitectura;
- no crear funcionalidades a partir de nombres de archivos vacíos o de planes históricos;
- distinguir cambios de arquitectura de cambios de comportamiento;
- no incluir credenciales, sesiones ni datos operativos reales en documentación, pruebas o commits.

## Comando de uso documentado

El único modo de ejecución documentado por el repositorio es abrir `index.html` en un navegador moderno. La librería de Supabase se obtiene desde CDN, por lo que la sincronización remota requiere conectividad; el guardado local se realiza en el navegador.
