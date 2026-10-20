# FUTPRO — La carrera del futbolista

Simulador de carrera de **un solo futbolista** (de los 12–17 años hasta el retiro), inspirado en Brasfoot: menús, estadísticas, decisiones y simulación, sobre un mundo de **clubes y ligas reales** que juega por su cuenta.

> Este proyecto vive en la carpeta `futpro/` y es **independiente** de ShiftControl Pro (el resto del repositorio). No comparte código, estado ni almacenamiento con esa aplicación.

## Cómo jugar

1. Abrir `futpro/index.html` en el navegador (Chrome, Edge, Firefox o Safari modernos). No requiere servidor, instalación ni conexión.
2. Elegir **Partida preconfigurada: Ignacio** o **Nueva carrera**.
3. Avanzar semana a semana (▶ Semana), de a cuatro, hasta el próximo partido o por periodos largos. Los partidos del jugador se pueden ver minuto a minuto o simular al instante.

Las partidas se guardan solas en IndexedDB del navegador y se pueden **exportar/importar** a un archivo `.fpsave` (JSON comprimido con gzip) desde Configuración → Partidas.

## Qué hay implementado (comprobado)

| Módulo | Archivo | Estado |
|---|---|---|
| Base de datos de países, ligas y clubes reales (70 divisiones, ~1.200 clubes) | `data/world.js` | Activo. Ver “Estado de los datos”. |
| Calendarios (todos contra todos, ida/vuelta, partidos por equipo), tablas, liguillas, ascensos/descensos | `js/comp.js`, `js/sim.js` | Activo |
| Copas nacionales (eliminación directa con exentos) de los 40 países | `js/comp.js` | Activo |
| Torneos continentales de clubes: Champions, Europa y Conference (fase liga de 36 equipos + repechaje + eliminatorias), Libertadores, Sudamericana (con repechaje vs terceros de Libertadores), Copa de Campeones CONCACAF, AFC Champions League, CAF Champions League, Mundial de Clubes (desde 2029, 32 equipos) | `js/tournaments.js` | Activo |
| Selecciones: Copa del Mundo (48 equipos), Eurocopa, Copa América, AFCON, Copa Asiática, Copa Oro, clasificatorias mundialistas por confederación en ventanas FIFA | `js/tournaments.js` | Activo (ver limitaciones) |
| Motor de partidos: simulación estadística (mundo) y simulación detallada minuto a minuto (jugador) con alineaciones, goles, asistencias, tarjetas, lesiones, cambios, prórroga y penales | `js/match.js` | Activo |
| Futbolista: 16 atributos (1–99), potencial oculto por carrera, entrenamiento, minutos, forma/moral/fatiga, lesiones, suspensiones | `js/hero.js` | Activo |
| Carrera: amateur/regional, pruebas, cantera, contrato juvenil y profesional, cesiones, traspasos nacionales/internacionales, representantes, renovaciones, agente libre, convocatorias a selecciones juveniles y absoluta, trofeos, premios (Bota de Oro, equipo ideal, mejor joven, Balón de Oro), retiro | `js/market.js`, `js/events.js` | Activo |
| Mundo independiente: fichajes de la IA por ventanas, cantera nueva cada año, retiros, cambios de entrenador, ascensos y descensos, noticias | `js/market.js`, `js/sim.js` | Activo |
| Guardado: IndexedDB con varias partidas, autoguardado, exportar/importar, versión de formato con migraciones, sincronización de datos nuevos | `js/storage.js` | Activo |
| Interfaz v2/v3: tema oscuro “Estadio de noche” y **modo claro** (botón sol/luna o Configuración; también automático según el sistema), inicio compacto con confianza del míster, momentos importantes (debut, convocatoria, fichaje, lesión grave, títulos), las 16 secciones, escudos y banderas dibujados, radar de atributos | `js/ui-*.js`, `css/style.css` | Activo (solo presentación) |
| Redes sociales simuladas del jugador (hinchas, prensa, club) y hitos de carrera | `js/social.js`, `js/ui-social.js` | Activo (contenido ficticio) |

## Arquitectura

Todo corre en el navegador con JavaScript clásico (sin módulos ni build): cada archivo es una IIFE que publica objetos en `window.FP`. **El orden de las etiquetas `<script>` de `index.html` es significativo.**

```
index.html
css/style.css
data/world.js        FP.DATA  países, ligas, clubes, selecciones, pendientes
js/util.js           FP.U (RNG con semilla), FP.Date, FP.fmt, FP.Names
js/core.js           FP.Core  posiciones, atributos, valor, mundo inicial
js/comp.js           FP.Comp  calendario, tablas, eliminatorias, copas
js/match.js          FP.Match motor de partidos
js/sim.js            FP.Sim   avance semanal, cierre de temporada, plantillas
js/hero.js           FP.Hero  el futbolista
js/market.js         FP.Market mercado, ofertas, contratos
js/events.js         FP.Events premios, cierres de torneos del jugador, retiro
js/tournaments.js    FP.Cont / FP.Nat torneos continentales y de selecciones
js/game.js           FP.Game  nueva carrera, preset, semana
js/storage.js        FP.Store guardado
js/ui-*.js, main.js  interfaz (ui-v2: inicio/jugador/partido; ui-v3: inicio compacto y momentos; ui-v3b: pantallas de la fase 2)
```

### Tiempo y calendario
La unidad de tiempo es la **semana** (semana 0 = lunes 18‑mayo‑2026). Cada liga define su ventana (`cal: 'year'` febrero–noviembre, `cal: 'euro'` agosto–mayo con pausa navideña). Cada semana se juegan los partidos vencidos de todas las competiciones; los partidos del jugador quedan en `S.pending` para jugarlos con el motor detallado.

### Rendimiento
- Mundo: simulación estadística (Poisson según fortaleza de plantilla, localía y semilla), con goleadores asignados por posición/calidad. ~25.000 partidos por temporada se procesan en ~2 s.
- Detalle máximo solo para los partidos del jugador.
- Ligas desactivables (Configuración → Ligas activas): se simulan en bloque al terminar su temporada.
- La creación del mundo y los saltos largos se procesan en bloques con `setTimeout` para no congelar la interfaz.
- Estado compacto: los partidos se empaquetan en arreglos al guardar, los jugadores retirados se eliminan y las competiciones terminadas se descartan. Una partida ronda los 6 MB tras 25 temporadas (comprobado).

### Estado persistente
`FP.S` es el estado completo de la partida (`S.hero`, `S.clubs`, `S.pl`, `S.comps`, `S.hist`, …). El RNG de la partida vive dentro del estado (`S.rs`), de modo que guardar y volver a cargar continúa de forma determinista.

## Estado de los datos (importante)

- **Clubes, ligas y países: reales.** Cada división tiene un nivel de verificación (`v`) visible en el juego:
  - `v` verificado con búsquedas web durante el desarrollo: Primera División de Chile (16), Segunda División Profesional (14) y Liga Profesional argentina (30). Primera B de Chile: 16 clubes reconstruidos desde calendarios publicados.
  - `k` conocimiento previo del autor (composición probable 2025‑26/2026): **puede haber errores de ascensos/descensos**.
  - `p` lista **parcial**: la división real tiene más clubes que los cargados.
- **Futbolistas: generados.** No se incluyeron plantillas reales (no hay una fuente con licencia utilizable ni acceso a ella). Todos los jugadores, entrenadores y representantes son ficticios y así se rotula en la interfaz. Nunca se atribuye un jugador real a un club.
- **Resultados anteriores a mayo de 2026: simulados**, no reales. Los participantes de torneos continentales de la primera temporada se derivan de la fortaleza de los clubes; los clasificados al Mundial 2026 son una estimación por nivel.
- El nivel de las selecciones es una **estimación del autor**, no el ranking FIFA.

### Pendientes conocidos
Ver también Configuración → Datos y pendientes dentro del juego.
- Tercera B de Chile, ligas inferiores de Argentina, Série D (96 clubes) y Serie C italiana (60) completas.
- Segunda categoría de Suiza, Austria, Dinamarca, Suecia, Noruega, Polonia, Chequia, Grecia y Turquía.
- Ligas de Europa del Este, Balcanes, Chipre, Israel, Medio Oriente fuera de Arabia Saudita, Centroamérica (salvo Costa Rica) y África subsahariana.
- Formatos Apertura/Clausura de varias ligas sudamericanas, simplificados a tabla única; MLS y Liga MX con calendario equilibrado simplificado y liguilla final.
- Playoffs de permanencia/ascenso de algunas ligas (Alemania, Francia, Países Bajos) no modelados.
- Permisos de trabajo y cupos de extranjeros no modelados; los menores de 18 solo pueden cambiar de club dentro de su país.
- Portero como posición del jugador: no disponible (el modelo de 16 atributos no incluye habilidades de arquero).
- Sub‑23/Juegos Olímpicos y Liga de Naciones no incluidos.

## Cómo actualizar la base de datos

1. Editar `data/world.js`: dentro de cada liga, `clubs` es una lista separada por `;` en orden aproximado de fortaleza. Para agregar una liga, copiar un bloque existente con un `id` nuevo.
2. Subir `FP.DATA.version` si se cambia la estructura.
3. Una partida nueva usará los datos nuevos; las partidas existentes incorporan automáticamente las ligas y clubes que falten (`Store.syncData`).

## Verificación realizada

No hay suite de pruebas automatizada en este proyecto. Se comprobó manualmente con Node (motor, 24 temporadas de una carrera completa, empaquetado/restauración del estado) y con Chromium headless abriendo `index.html` por `file://` (16 pantallas, todas las competiciones activas, partida preconfigurada, nueva carrera, minuto a minuto, guardar/cargar, exportar/importar, vista móvil). Ver el historial de commits para el detalle.
