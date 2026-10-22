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
| Base de datos de países, ligas y clubes reales (82 divisiones, ~1.400 clubes) | `data/world.js` | Activo. Ver “Estado de los datos”. |
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

## Profundidad funcional (selecciones, cantera, mercado, estadísticas)

Módulos añadidos (sin reemplazar el motor existente; partidas anteriores se migran al cargar):

| Módulo | Archivo | Qué hace |
|---|---|---|
| Talento y cantera | `js/youth.js` | Reserva nacional de promesas (jugadores reales de la simulación, 13–23 años, por país y generación); plantillas juveniles persistentes del club del jugador; estatus semanal titular/suplente/no convocado por posición; evaluación anual con desvinculación; niveles amateur (barrio, regional, semiprofesional); madurez física (un juvenil rinde menos entre adultos). |
| Selecciones por categorías | `js/nteams.js` | Sub-15, Sub-17, Sub-20, Sub-23 y absoluta con seleccionadores y nóminas persistentes; observación → microciclo → preselección → nómina final; amistosos; torneos continentales juveniles; Mundiales Sub-17 y Sub-20; torneo olímpico Sub-23; historial independiente por categoría; elegibilidad por año de nacimiento y nacionalidad. |
| Mercado | `js/scouting.js` | Reputación local/nacional/internacional, seguimiento de ojeadores e interés sin oferta, ofertas según nivel, posición y necesidades, rechazo en pruebas con enfriamiento de un año, contratos semiprofesionales, negociación, cesiones solicitadas, cupos de extranjeros y restricciones a menores. |
| Estadísticas | `js/stats.js` | Registro por temporada, equipo y competición, clasificado en: liga, copas, torneos internacionales de clubes, juvenil, amateur, amistosos y una clase por categoría de selección. Las clases no se mezclan. |

### Contratos, ofertas y negociaciones (`js/contracts.js`, pantalla `js/ui-v5.js`)
- Cada oferta lleva términos detallados: sueldo mensual/anual, fechas exactas de inicio y término, prima de fichaje o renovación, bonos (goles, asistencias, partidos, títulos, clasificación internacional), cláusula de rescisión, cesión permitida, rol prometido y estado. No todos los contratos los incluyen: dependen de edad, nivel, liga, presupuesto y situación. Menores de 16 solo reciben contratos de formación (sin cláusulas ni bonos); 16–17, contratos juveniles de hasta 3 años.
- Ciclo de una oferta: abierta → en trámite (aprobación del club, examen médico, apertura del mercado) → completada o fracasada. Al **completarse** un fichaje se cierran automáticamente las ofertas incompatibles; si **fracasa**, las demás siguen disponibles. Una operación pendiente bloquea otras aceptaciones incompatibles. Hay precontratos (últimos seis meses, continúas en tu club hasta la fecha), cesiones con fecha de término y opción de compra (el contrato del club propietario sigue vigente) y renovaciones que conservan lo no modificado.
- Negociación: contrapropuesta sobre sueldo, duración, prima, bonos, cláusula, rol y cesión. El club acepta, contraoferta, pide tiempo o se retira (hasta 3 rondas); exigir demasiado tiene consecuencias.
- Bonos y primas se pagan una sola vez por contrato y temporada, con comisión del representante, y quedan en el libro económico. Si el rol prometido no se cumple (minutos reales), hay avisos escalonados y acciones: hablar con el entrenador, reclamar a la directiva, renegociar rol, cesión o traspaso.
- Historial permanente (clubes, fechas, sueldos, renovaciones, cesiones, traspasos, bonos, ofertas aceptadas/rechazadas/retiradas/caducadas/cerradas, conflictos) guardado con la partida. Pruebas: `node tests/contracts.js`.

### Torneos de selecciones: qué es real y qué es adaptado
- **Verificado con fuentes** (formato y cupos): Sudamericano Sub-15 (2024, 10 equipos, 2 grupos de 5, semifinales); Sudamericano Sub-17 (2025, 10 equipos, 7 cupos mundialistas); Sudamericano Sub-20 (2025, grupos + hexagonal final, 4 cupos); Preolímpico sudamericano (2024, 2 cupos); Mundial Sub-17 (48 selecciones, 12 grupos, 2 primeros + 8 mejores terceros; cupos UEFA 11, CAF 10, AFC 9, Concacaf 8, Conmebol 7, OFC 3); Mundial Sub-20 (24 selecciones, 6 grupos; UEFA 5, Conmebol 5, AFC 4, CAF 4, Concacaf 4, OFC 2).
- **Adaptado / estimado**: las demás confederaciones usan el número de selecciones cargadas (74), por lo que sus formatos son versiones reducidas (marcadas "adaptado" en la pantalla Selecciones → Torneos). Las fechas son aproximadas. No existe Sub-15 oficial fuera de Conmebol: solo hay amistosos. El torneo olímpico se simula sin los tres jugadores mayores permitidos y sin Inglaterra, Escocia ni Gales.
- Las ediciones previas a mayo de 2026 son **simuladas**, no reales.

### Calibración y pruebas
`tests/` contiene un arnés en Node (sin dependencias): `node tests/invariants.js` (coherencia: ninguna selección juega contra sí misma, nóminas dentro de edad y nacionalidad, sin pruebas de academia a adultos, estadísticas por clase consistentes) y `node tests/careers.js <temporadas> <carreras> <semilla> <parte> <partes>` + `node tests/summary.js` (carreras largas con perfiles variados; proporciones de profesionales, amateur, libres, convocatorias y selección adulta).

## Profundidad de carrera

Módulos nuevos (cada uno con su pantalla; la lógica está separada de la interfaz):

- **Salud y físico** (`js/medical.js`, pantalla *Salud*): 16 tipos de lesión con zona, causa y duración propias; decisión de tratamiento (club, conservador, cirugía, rehabilitación acelerada, especialista privado) que cambia duración, recaídas y secuelas; carga de partidos, plan de prevención, molestias, alta médica y recaídas. Las zonas ya lesionadas son más frágiles.
- **Entrenadores y vestuario** (`js/staff.js`, pantalla *Vestuario*): cada entrenador tiene un estilo (formador, defensivo, ofensivo, pragmático, motivador, disciplinario, rotador) que modifica tus minutos y tu relación con él; capitán, ídolo, mentor, rival de puesto y compañeros con relación propia y acciones (consejo, ayudar, salir juntos). El ambiente mueve tu moral; el mentor acelera la progresión de los jóvenes.
- **Táctica y partido** (`js/tactics.js`, pantalla *Táctica*): rol libre (buscar el gol, crear juego, cubrir) e intensidad de presión, con pausas en el descanso y en el minuto 70 del modo minuto a minuto (`Match.fullSession`; `Match.full` conserva el comportamiento anterior). Cambio de posición con familiaridad (0–100%) y penalización de rendimiento que baja jugando y entrenando "Posición".
- **Vida personal** (`js/life.js`, pantalla *Vida personal*): estudios con notas, graduación y carrera a distancia; mudanza (familia, residencia o solo), nostalgia, idioma local con clases y adaptación al país; prensa con decisiones que mueven imagen, moral y relación con el entrenador.
- **Fin de carrera** (`js/postcareer.js`, pantalla *Después del fútbol*): legado (0–100), homenaje de despedida y tres caminos —entrenador (licencias y puestos), comentarista y representante— con simulación simplificada por temporada.
- **Decisiones** (`js/decisions.js`): cola común de decisiones con plazo; si no respondes se aplica la opción por defecto. Aparecen en Inicio y en cada pantalla.

Notas honestas: los efectos de rol/presión, carga, nostalgia, legado e ingresos posteriores son parámetros de diseño del juego, no valores calibrados con datos deportivos. La calibración de carreras largas sigue pendiente. El guardado pasa a la versión 4 y los guardados anteriores se migran al cargar. Con un partido a medias no se permite guardar.

Pruebas: `node tests/depth.js` (salud, vestuario, táctica con pausas, vida, retiro, guardado), además de `tests/invariants.js` y `tests/contracts.js`.

## Año de inicio

La pantalla de inicio permite elegir el año (1995–2026). Cambia **solo el calendario**: fechas, edades y el ciclo de torneos (Eurocopa y Copa América en años ≡ 0 mod 4, Mundial en años ≡ 2, etc.). Los clubes, ligas y selecciones siguen siendo los de 2026 y los jugadores son generados, por lo que un inicio en 2007 no reproduce plantillas ni divisiones de esa época. El año se guarda en la partida (`S.y0`) y se restaura al cargar; los guardados anteriores se leen como 2026. El Mundial mantiene su formato actual de 48 selecciones en cualquier año.

### Después del fútbol (ampliado)

- **Banquillo** (`js/coaching.js`): como director técnico, los partidos de tu club se juegan con el motor real (formación, mentalidad y pausas en el descanso y el minuto 70). El resultado de la temporada sale de la tabla real y puede terminar en despido. Los puestos de asistente y juveniles siguen simulados por temporada.
- **Representante** (`js/agency.js`): cada cliente tiene lealtad, comisiones y una carrera real: ofertas de traspaso (aceptar, pedir más, rechazar), renovaciones, ganas de irse y patrocinios. Los traspasos mueven al jugador real entre clubes.
- **Protegido** (`js/mentor.js`): un hijo con tu apellido o una promesa apadrinada. Eliges su plan de formación (intensivo, equilibrado, tranquilo), el club de su debut y cómo lo aconsejas; el vínculo puede romperse.
- **Más caminos** (`js/paths2.js`): director deportivo, presidente de club (con tu dinero) y seleccionador juvenil. La decisión anual cambia el plantel, la cantera o las finanzas del club.
- **Epílogo** (`js/epilogue.js`): historia final, récords personales, tu generación y Salón de la Fama (legado ≥ 62, cinco años después del retiro); se puede descargar como texto.

Los efectos y probabilidades de estos módulos son parámetros de diseño del juego, no valores calibrados.

## Calibración (lo medido y sus límites)

Se simularon carreras largas con `tests/careers.js` (24 carreras × 15 y 18 temporadas, más 8 × 25) y se compararon con referencias publicadas. Donde no hay una referencia fiable, el valor sigue siendo una decisión de diseño.

| Aspecto | Referencia | Antes | Ahora |
|---|---|---|---|
| Lesiones por temporada (profesional) | ≈ 2 por jugador y una grave cada ~3 temporadas (estudios de la UEFA sobre clubes de élite) | 1,2 y 0,05 graves | 2,1 y 0,31 graves; 10,8 semanas perdidas al año |
| Edad del techo de rendimiento | ≈ 25-26 años en capacidad física; 28-30 en producción (estudios con datos de seguimiento y OPTA) | 17 años y plano después | mediana 22 y se sigue creciendo hasta ≈ 25 |
| Ofertas de traspaso (profesional destacado) | sin referencia | 0 por año | 1-2 por año |
| Cesiones (joven suplente en club grande) | sin referencia | ≈ 0 | ≈ 1 por año |
| Edad media de debut en las 5 grandes ligas | 21,7 años (CIES, 2020) | no medido | contrato profesional a los 17 (mediana); el debut real no se midió |
| Edad media de retiro | 32,7 años en una muestra portuguesa | jugadores de IA se retiran a los ~34-35 | sin cambios |

Límites: la curva de desarrollo del jugador llega más tarde que antes, pero el techo de cada jugador sigue siendo poco superior a su nivel a los 13 años, por lo que el pico mediano queda en 22 y no en 25-26. La proporción de carreras que llegan a profesional (83 %) corresponde a jugadores creados por un usuario con puntos extra y no es comparable con la tasa real de canteranos. Las ofertas, la carga y el legado siguen siendo parámetros de diseño.

## Pruebas masivas y más divisiones

- **Pruebas masivas** (`js/tryouts.js`, pantalla *Pruebas masivas*): sin club (o en un club amateur) se anuncian cada mes jornadas abiertas de clubes de tu país y showcases con ojeadores de varios clubes (internacionales solo para mayores de 18). Compites contra 90-500 aspirantes: destacar entre los primeros puestos genera propuestas (cantera hasta los 19 años, prueba con el primer equipo desde los 20) e interés de otros clubes. Las probabilidades salen del nivel del jugador frente a la media de los asistentes (parámetros de diseño, no calibrados con datos reales).
- **Divisiones nuevas** (10): TFF 1. Lig (Turquía), Challenge League (Suiza), 2. Liga (Austria), National (Francia), Liga 3 (Portugal), Superettan (Suecia), OBOS-ligaen (Noruega), 1. Division (Dinamarca), I liga (Polonia) y Chance Národní liga (Chequia), con ascensos y descensos con la división superior. Las listas salen de composiciones 2025/26 (ligas europeas) o de la temporada 2026 (ligas de año calendario) consultadas en la web. Se completaron o corrigieron además Países Bajos (Eredivisie y Eerste Divisie, 18 y 20 clubes), Polonia (Ekstraklasa e I liga), Suecia (Allsvenskan y Superettan), Noruega (OBOS-ligaen, 16), Bélgica (Challenger Pro League, 16), Chequia (16), Francia (National, 17), Corea (K League 1 y 2, 12 y 17), México (Liga de Expansión, 16) y Uruguay. Siguen **parciales** por formato real en grupos: España 3.ª y 4.ª (40 y 90 clubes), Italia Serie C (60), Brasil Série D (96) y Argentina Primera Nacional (2 zonas); y por falta de lista verificable: Portugal Liga 3 (19 de 20), Ecuador Serie B (10 de 12). El nivel de cada liga es una estimación.

## Resumen de temporada, metas y logros

- **Resumen de temporada** (`js/season.js`, pantalla *Resumen de temporada*): al cerrar cada año se arma una ficha con tu club y posición final, números, cambio de media, títulos y premios, lesiones, mejor partido, partidos con la selección, decisiones que marcaron el año y el resultado de tus metas. Aparece un aviso en Inicio hasta que lo abres.
- **Metas de la temporada** (pantalla *Metas*): tres objetivos por año (goles, partidos, nota media, o no sufrir lesiones largas) calculados según tu posición, tu rol y tu temporada anterior. Cada meta cumplida da moral y fama.
- **Logros de carrera**: 21 hitos (debut, triplete, 10/20 goles, títulos, media 70/80/90, selección, Mundial, Balón de Oro…) con progreso y recompensa pequeña. Los objetivos y recompensas son parámetros de diseño.

## Mercado vivo

- **Perfil y caja de cada club** (`js/clubs.js`): comprador, vendedor, formador o equilibrado, con un presupuesto que sube y baja con las operaciones y con los resultados de la temporada (ascensos, títulos y descensos lo mueven). El perfil cambia quién compra, a quién busca y quién vende.
- **Rumores y operaciones frustradas**: las operaciones grandes pasan primero por un rumor de 1 a 3 semanas; alrededor de un tercio se cae. Los clubes vendedores sin caja se desprenden de su figura.
- **Cierre de ventana**: el último día hay más operaciones de la IA y pueden llegarte ofertas de último minuto.
- **Cláusulas de rescisión**: si tu cláusula es razonable frente a tu valor, un club con caja puede pagarla y abrirte una oferta (aceptas o negocias tu contrato).
- **Efectos en cadena**: cuando fichas por otro club, el que dejas busca un reemplazo, el titular que desplazas puede negociar su salida y parte de la afición puede molestarse.
- **Ayuda para decidir**: cada oferta muestra el nivel del club frente al tuyo, su perfil y su caja, el estilo del técnico y quién compite contigo en tu puesto. El panel "Mercado vivo" del Mercado lista los rumores y las últimas operaciones.

Las probabilidades de rumores, ventas y cláusulas son parámetros de diseño, no calibrados con datos reales.

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
- España: Primera Federación (ESP3) y Segunda Federación (ESP4) con 20 clubes cada una, **parciales** (en la realidad son 2 grupos de 20 y 5 grupos de 18, modelados como tabla única); los nombres salen de las composiciones 2025/26 publicadas por la RFEF y prensa. La Segunda División desciende 4 y la Copa del Rey incluye hasta la 3.ª categoría. El nivel de cada liga y la fuerza de cada club son estimaciones propias.
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

## Avatar editable

El avatar ya no es solo aleatorio: se puede elegir tono de piel (6), color de pelo (7), peinado (18 estilos: corto, fade, rizado, afro, mohicano, trenzas, moño, engominado, flequillo, coleta, mullet, entradas, clásico, etc.) y barba (ninguna, corta, completa, bigote). Se elige al crear la carrera (paso 1, con vista previa) y se cambia luego en **Mi jugador → Gestión → Apariencia**; "Aleatorio" sortea uno nuevo. Se guarda en `hero.av`; las carreras antiguas conservan su aspecto sorteado hasta que lo cambies.

## Atributos iniciales automáticos

Al crear la carrera, los 30 puntos extra se reparten solos entre los 7 atributos clave de la posición (según los pesos de la media) y se rehacen al cambiar de posición. Cada atributo se puede subir hasta +12 o bajar hasta −8; los puntos quitados quedan libres. Botones: "Reparto automático de la posición" y "Poner todo en 0".

## Redes y marca (`js/redes.js`, `js/ui-v14.js`)

La pantalla **Redes** ahora tiene cuatro pestañas: Feed, Marca, Comunidad y Panel.

- **Publicar:** hasta 3 publicaciones por semana (cada una cansa un poco) con 12 acciones (celebrar, familia, historia, acción solidaria, preguntas en vivo, video de jugadas, contenido de patrocinador…). Las buenas pueden hacerse virales (probabilidad según tu fama).
- **Polémicas** (decisión `redes`): tuit antiguo, provocación de un rival, foto discutiendo con el DT, hinchas críticos y noticia falsa. Cada respuesta tiene riesgo/recompensa y mueve imagen pública, moral, fama y reputación de marca. El agente puede resolverlas sin riesgo.
- **Patrocinios:** desde ~1.500 seguidores y 15 años llegan ofertas de marcas ficticias (máx. 3, una por categoría). Cláusulas de publicar y de conducta (una polémica mal resuelta puede rescindir el contrato), prima de firma, pago semanal (`patrocinio` en Finanzas) y renovaciones. Dependen de seguidores, nivel y reputación de marca.
- **Rumores de fichaje:** la prensa filtra interés de clubes superiores; puedes desmentir, dejar correr (puede convertirse en oferta real), declarar amor al club o mover el rumor con tu agente.
- **Comunidad:** club de fans con niveles (da moral semanal), cuenta parodia con memes y mensajes directos (leyenda, niño hincha, excompañero).
- **Panel:** seguidores en el tiempo, mejor publicación, polémicas y marca.

Todo se guarda en `hero.rd`; tests: `node tests/redes.js`. Calibración pendiente: los ingresos de marca no están contrastados con datos reales.

## Estadísticas: vistas de "Por temporada" (`js/ui-v15.js`)

Selector **Vista** bajo los filtros (por defecto Tabla): Tarjetas (la original), Tabla (una fila por temporada y club, con barras y total de carrera), Línea de tiempo (una tarjeta por temporada con sus cifras y competiciones) y Panorama (gráfico de goles, asistencias y nota por año + resumen por club). Respetan los filtros de clubes/selecciones/amistosos.

## Corrección: ofertas de contrato repetidas en la cantera

- El cierre de temporada juvenil (`Events.heroSeasonEnd('academy')`) se ejecutaba una vez por cada torneo juvenil que terminaba, a lo largo de ~9 semanas: la evaluación de la cantera repetía la oferta de contrato profesional (y la tirada de desvinculación). Ahora ocurre una sola vez por temporada.
- `Market.addOffer` no crea una oferta igual (mismo tipo y club) si ya hay una abierta, y al firmar contrato profesional se retiran las demás ofertas profesionales.
- Una oferta de "primer contrato profesional" a un jugador de 16 años o más produce un contrato **profesional** (antes, a los 16-17 se convertía en contrato juvenil y la cantera seguía ofreciéndolo). El contrato juvenil/de formación corresponde al ingreso a la cantera. Con contrato profesional vigente la cantera no lo desvincula.
- Edad mínima de contrato profesional en el juego: 16 años (supuesto de diseño; no se pudo confirmar una norma chilena concreta). El ascenso al primer equipo (`promoteCheck`) exige contrato profesional, 17 años y nivel cercano al del plantel; el contrato juvenil no da acceso al primer equipo.
- Pruebas: `node tests/ofertas.js`. La probabilidad anual de desvinculación de la cantera (`Youth.releaseProb`) se calibró con el comportamiento anterior (varias tiradas por temporada); queda pendiente recalibrarla.

## Convocatorias al primer equipo (`js/callups.js`)

Un juvenil de la cantera (15 años o más, con contrato juvenil o profesional) que está a menos de 14 puntos del nivel del club puede ser **citado a entrenar con el primer equipo** durante 1-2 semanas: +12% de desarrollo en el entrenamiento y +4 de moral. Mientras dura la citación, los partidos oficiales del primer equipo entran en su cola: con 30% de probabilidad no queda en la lista y, si queda, entra como suplente con 5-40% de probabilidad de jugar según la distancia al mejor de su puesto. Rinde menos que su media (madurez física). Los minutos se registran con el club (no "(juv.)"), el primer partido genera el **debut** (mensaje, noticia e historial). Lo ve en **Mi club** (tarjeta "Primer equipo"). El ascenso definitivo sigue siendo `Market.promoteCheck`.

Los umbrales son supuestos de diseño (no datos reales). Calibración en `tests/callups.js` y simulaciones aparte: un juvenil unos 6 puntos por debajo del club tiene ~2 citaciones y ~0,5 partidos al año; a unos 3 puntos, ~5 citaciones; si está muy lejos no recibe ninguna. `Sim.heroTeams` incluye el club solo mientras dura la citación (las selecciones usan `h.extraTeams`, que se reinicia cada semana).

## Resumen de temporada rediseñado (`js/ui-v16.js`)

Resumen de carrera arriba (temporadas, partidos, goles, asistencias, títulos, gráfico de la media). Cada temporada: cabecera con escudo, club, edad, puesto final y titular; indicadores (PJ, goles, asistencias, nota, minutos, media con variación); momentos destacados con icono (títulos, premios, mejor partido, hat-trick, selección, lesiones, movimientos, decisiones); metas como etiquetas; el relato queda en "Leer el relato".

## Corrección: propuestas tras firmar un precontrato

Con un precontrato firmado (`Contracts.ensure().pre`), `Market.addOffer` ya no crea propuestas de contrato nuevas (traspaso, profesional, semiprofesional, cantera, otro precontrato): solo siguen entrando renovaciones y cesiones, igual que en la regla de aceptación. Antes, `Market.transferOffers` seguía generando un precontrato (incluso del mismo club) que luego no se podía aceptar ("Ya firmaste un precontrato…"). Prueba añadida en `tests/contracts.js`.

## Viaje de prueba al extranjero (`js/tryouts.js`, `js/ui-v11.js`)

En **Pruebas masivas**, quien está sin club (o en un club amateur) puede viajar a otro país a probarse en hasta 3 clubes: elige país y clubes (con probabilidad estimada), paga el viaje (2 mil € en la misma confederación, 5 mil € en otra, +0,8 mil € por club extra; bajo 18 años lo cubre la familia) y vuelve a las 1+n semanas con los resultados. Hasta los 19 años son pruebas de cantera y desde los 20 con el primer equipo (mismas fórmulas de `Market.trialDifficulty` / `Rep.fit`). Solo se listan clubes a los que tiene sentido ir (`Tryouts.reach`): desde los 20, equipos de fuerza no mayor a tu nivel +3 (incluye divisiones bajas, hasta la 4.ª); bajo 20, aquellos donde la probabilidad es al menos 12%. El showcase internacional usa el mismo filtro. Las propuestas pasan por las reglas ya existentes: cupo de extranjeros, permiso de trabajo (Inglaterra) y menores. Desde los 16 años solo UE/EEE para menores; bajo 16 no hay viaje. Si la prueba no da propuesta, 30% de que el club quede con algo de interés. Espera de 6 semanas entre viajes. Los costos y el 30% son supuestos de diseño. Pruebas: `node tests/viaje.js`.

## Biografía (`js/bio.js`, `js/ui-v18.js`, `js/ui-v17.js`)

Nueva pantalla **Biografía** (menú Jugador): un artículo estilo enciclopedia que se escribe solo con los datos de la carrera. Incluye ficha lateral (avatar, datos, clubes, selección, títulos), introducción, contenido, **Primeros años**, **Trayectoria** (un apartado por club con llegada, debut, temporadas, títulos y distinciones), **Selección nacional**, **Estilo de juego** (cualidades y punto débil según los atributos), **Lesiones**, **Vida personal** (estudios, idiomas, residencia, representante, patrocinadores, club de fans, redes), **Hitos y récords**, **Palmarés**, **Estadísticas** (tablas de clubes y de selección, de la temporada más antigua a la más reciente, con subtotales y total) y **Cronología**, más **Retiro** al terminar la carrera. Las secciones sin datos aparecen en "Secciones por desbloquear" y la calidad del artículo sube de *Esbozo* a *En construcción*, *Artículo bueno* y *Artículo destacado* (carrera terminada, 10 temporadas o más).

Cada frase sale de un dato registrado (no se inventan hechos). Además `Hero.msg` guarda en `hero.bio.ev` los hitos de texto (convocatorias, ascenso, debut, firmas, estudios) para la cronología. Las tablas (`UI.bioTables`) viven en `ui-v17.js`. Pruebas: `node tests/bio.js`.

## Palmarés: vistas de "Mis trofeos" (`js/ui-v19.js`)

Indicadores arriba (títulos, subcampeonatos, premios, Balones de Oro) y selector **Vista** (por defecto Por competición): **Vitrina** (estantes con copas doradas, subcampeonatos en plata y medallas), **Cronología** (un nodo por año con el club y chips de títulos y premios) y **Por competición** (tablas con conteo y temporadas de títulos, subcampeonatos y distinciones por tipo).

## Resultado del partido rediseñado (`js/ui-v2.js`)

Se unió el banner de resultado y el marcador en una sola tarjeta (tira de VICTORIA/EMPATE/DERROTA con tu nota); la línea de tiempo muestra el minuto de cada evento (local arriba, visitante abajo); el relato va por tiempos con filtro **Resumen / Completo** y el marcador destacado en los goles; las estadísticas usan los colores de cada equipo (con color de contraste si son parecidos); "Tu rendimiento" suma "Tus jugadas"; y las alineaciones muestran posición, nombre y media con tu jugador resaltado. El modo minuto a minuto y las dos pieles (oscura y clara) se mantienen.

## Calendario: vistas de "Próximos" (`js/ui-v21.js`)

Selector **Vista** (por defecto Agenda): **Agenda** (tarjeta del próximo partido con fuerza de ambos equipos y lista por mes con color por tipo de competición y fuerza del rival), **Semanas** (una casilla por semana, incluidas las libres) y **Por competición** (barra de avance, balance y próximos partidos de cada competición).

## Noticias: Mi carrera rediseñada (`js/ui-v22.js`)

Arriba, tarjetas de **pendientes** (decisiones abiertas y ofertas) con acceso directo; filtros por tema con contador (Mercado y contratos, Decisiones, Salud, Partidos, Selección, Premios y logros, Otros); mensajes agrupados por fecha (esta semana, semana pasada, por mes) con icono de color por tema, titular y detalle; los últimos mensajes sin leer (hasta 10) se marcan "Nuevo" y las ofertas abiertas enlazan a Contratos. También se corrigió el prefijo duplicado "Sin respuesta a tiempo" en polémicas de redes.

## Biografía: tablas estilo Wikipedia (`js/ui-v17.js`)

Las estadísticas de Biografía usan tablas tipo "wikitable" (sin tarjetas ni etiquetas de nivel): columnas Club, Temporada, Liga (División, PJ, G), Copa nacional, Continental y Total (PJ, G, A); las columnas de copa y continental solo aparecen si hay partidos. Tres vistas: **Todo junto** (con subtotales por club; el equipo juvenil se escribe "Club (juv.)"), **Dos tablas** (clubes profesionales y categorías inferiores/amateur, con línea de total) y **Plana** (una fila por temporada y club, solo total de carrera). No se incluyen amistosos. La selección va en otra tabla por categoría con subtotales.

## Sin franjas de color laterales

Se quitaron las franjas de color en el borde de las tarjetas y filas nuevas (resumen por nivel de Biografía, agenda del calendario, competiciones, noticias nuevas, momentos del resumen de temporada, goles del relato); la categoría se distingue por el texto o la etiqueta.

## Partidos de primera división siendo juvenil

Los partidos del primer equipo que juega un juvenil citado (`js/callups.js`) se registran con el equipo profesional del club, por lo que en Biografía → Estadísticas aparecen en la tabla "Primer equipo y clubes profesionales" (y en el total profesional), separados de las competiciones juveniles del mismo club y temporada. Ambos suman en el total oficial de carrera.

## Biografía: campeonato juvenil y primer equipo separados

En las tablas de Biografía el equipo juvenil aparece como "Club (juv.)" con el nombre de su campeonato ("Campeonato Juvenil Sub-17"), sin añadir la liga profesional del club, y los partidos del primer equipo van en filas aparte bajo el club con su división ("Primera División"). Los grupos se arman por nombre aunque la carrera alterne entre juvenil y primer equipo. En la cronología el título juvenil se nombra "Campeón juvenil".

## Biografía: cesiones

El juego registra cada cesión (`hero.bio.loans`: club de origen, club de destino, fechas, opción de compra y desenlace: regreso o compra). La biografía la cuenta en la trayectoria ("En enero de 2027 fue cedido a X por Y durante 6 meses. El préstamo incluía una opción de compra de … Terminada la cesión, regresó a Y."), en la introducción, en la cronología y en las tablas como "Club (cedido)". La trayectoria ahora se arma con el registro de partidos (equipo real de cada temporada: club, juvenil o cedido). Las cesiones de partidas anteriores a este cambio solo se reconocen por el nombre de la temporada.

## Biografía: actuaciones destacadas

`hero.bio.moments` guarda, mientras se juega, pocos partidos oficiales notables: goles en una final, tripletes o más, un gol en el minuto 85 o después que decidió el partido y el primer gol con la selección (máximo 2 por año y por clase, priorizando finales). La biografía los cuenta en cada club ("Entre sus actuaciones destacadas figuran: …") y en Selección nacional, con rival, marcador, competición, fecha y minutos; los más importantes entran también en la cronología. Los títulos y las distinciones ya se contaban en cada club. Las partidas anteriores a este cambio no tienen estos momentos.

## Biografía: artículo aparte de la cronología

Biografía tiene dos pestañas: **Artículo** (solo secciones de enciclopedia: primeros años, trayectoria, selección, estilo, lesiones, vida personal, palmarés y estadísticas, retiro) y **Cronología y hitos** (hitos y récords y cronología completa, sin duplicados). Estas dos ya no aparecen dentro del artículo.

## Balón de Oro más difícil (`Events.worldAward`)

Se corrigió un error: los goles del jugador se acumulaban de toda la carrera (los de los demás se reinician cada año), así que su puntaje crecía sin límite. Ahora cuenta solo los goles y asistencias del año. Además la calidad de la liga pesa: los goles valen ×0,6 en Chile y ×1,1 en Inglaterra o España, y la liga suma `calidad × 0,35`. Con un jugador de media ~89 forzado durante 8 años (dos carreras en Chile y dos en España): antes ganaba 12 y 11 veces en 16 años; ahora 4 y 3. Valores calibrados con pocas carreras; sin contrastar con datos reales.

## Pruebas de adultos: sin clubes de primera

(Ajustado después: ver el párrafo siguiente.) Desde los 20 años, las jornadas abiertas, los showcases y el viaje de prueba al extranjero solo incluyen clubes de segunda división o inferior (y de fuerza no mayor a tu nivel +3). Las invitaciones a entrenar con un primer equipo (`seniorTrials`) ya exigían segunda división o menor. Los menores de 20 conservan las pruebas de cantera de clubes grandes.

Ajuste: desde los 20 años las pruebas abiertas (jornadas, showcases y viaje al extranjero) son desde la **3.ª división** hacia abajo (`Tryouts.minTier`); en países con 3 niveles o menos, desde la 2.ª. A los clubes de nivel superior se llega por **invitación a entrenar con el primer equipo**: ya llegaba al azar a quien está libre (`seniorTrials`) y ahora además hay un 35% de que un club del nivel inmediato superior te invite tras destacar en una prueba abierta.

## Más ligas (37 nuevas; 119 ligas en 60 países)

- **Europa:** Croacia, Serbia, Rumanía, Hungría, Bulgaria, Ucrania, Rusia, Israel (primera y segunda), Chipre, Gales (solo primera), Irlanda, Finlandia e Islandia (primera y segunda). **Rusia no tiene cupos europeos** (sanción de la UEFA); los demás entran en la Champions, Europa y Conference según un cupo pequeño y se recortan por fuerza hasta el tamaño del torneo.
- **CONCACAF:** Honduras, Panamá, Guatemala, El Salvador y Jamaica (primera división con liguilla y 1-2 cupos para la Copa de Campeones).
- **Divisiones inferiores:** Argentina (Primera B Metropolitana), Escocia (League One), Suiza (Promotion League), Dinamarca (2. Division), Polonia (II liga), Grecia (Super League 2), Inglaterra (National League) y EE. UU. (USL Championship, sin ascenso). Se ajustaron los descensos de las divisiones superiores para enlazarlas.
- Se añadieron las selecciones que faltaban (Rusia, Bulgaria, Israel, Chipre, Finlandia, Islandia, Guatemala), sus banderas, la región de nombres y los ajustes de residencia para menores (UE/EEE).
- Los clubes son reales, composición probable de la temporada 2025/26 (`v: 'k'` = conocimiento previo, `v: 'p'` = lista parcial). El nivel (`q`) de cada liga y su dispersión son estimaciones mías.
- Quedan fuera las ligas de formato por grupos (ESP3/4, ITA3, BRA4, ARG2 parcial) y Ecuador Serie B.

## Asia y Medio Oriente (+13 ligas; 132 ligas en 66 países)

Catar (primera y segunda), Emiratos Árabes (primera y segunda), Irán (Persian Gulf Pro League y Azadegan), Uzbekistán (Super Liga y Pro Liga), India (Indian Super League e I-League, sin ascenso) y Tailandia (Thai League 1 y 2), con cupos para la Liga de Campeones de la AFC, y Argentina suma la **Primera C** (4.ª división; la Primera B Metropolitana ya era la 3.ª). Se agregaron las selecciones India y Tailandia, banderas y listas de nombres indios y tailandeses.

**Retiro dorado:** desde los 30 años, la liga del Golfo (Arabia, Catar, Emiratos) y China pagan un 55% más de sueldo en primera. Y de los 31 años en adelante, con media 66 o más, los clubes de esos países se interesan al azar (cada ~10 semanas con 10% de probabilidad, ~42-58 puntos de interés), con menos exigencia de exposición internacional (-18). Los valores son supuestos de diseño.

## Finanzas personales (`js/dinero.js`, `js/ui-v23.js`)

Nueva pantalla **Finanzas personales** (menú Gestión) con cuatro pestañas:

- **Resumen:** patrimonio (caja + inversiones), variación del último año, totales de la carrera (impuestos, gastos de vida, comisiones, ingresos de inversiones, pérdidas por estafas, ayudas), gráfico y últimos movimientos.
- **Impuestos:** una tasa efectiva por país sobre sueldo, primas, bonos y patrocinios (Chile 27%, España/Inglaterra 45%, Bélgica 50%; Arabia, Catar y Emiratos 0%). Es un supuesto de diseño, no la ley fiscal real. Hace que el Golfo valga más como retiro dorado.
- **Estilo de vida** (desde los 18 años): vivienda, transporte y entorno de apoyo (4 niveles). Cuestan una parte del sueldo (con mínimos), suben la moral y el entorno de apoyo acelera la recuperación; gastar más del 55% de lo que ganas genera estrés. Sin liquidez el nivel baja solo. Los gastos continúan retirado (con una referencia que decae).
- **Inversiones:** depósito (~3%), bolsa (~7% con ciclos bajistas), propiedades (~3,5% + arriendo 4,5%, 3% de comisión al vender), negocio propio (cada año ~35% prospera / 40% estable / 25% fracasa) y club amateur local (da fama). Se compra por 10, 25 o 50% de la caja; ganancias realizadas tributan 15%.
- **Asesor financiero** (básico 0,4% anual; premium 0,9%): frena estafas, mejora los negocios y, el premium, el retorno. **Familia** (casa para los padres, ayuda mensual) y **fundación** (aporte anual que mejora imagen, fama y marca).
- Decisiones `dinero`: amigo que pide un préstamo, familiar que necesita ayuda, oferta de negocio y estafas ("inversión que no puedes perderte"); aparecen con patrimonio desde ~150 mil € (~1 vez cada 10-20 semanas como máximo).

Todos los porcentajes son supuestos de diseño, sin contrastar con datos reales. La contabilidad de estos flujos va en `hero.fx`; el dinero en caja sigue siendo `hero.money`.

## Retiro en profundidad (`js/retiro.js`, `js/ui-v24.js`, pantalla «Vida y legado»)

Envuelve `postcareer.js`, `coaching.js` y `paths2.js` (no los reemplaza). Estado en `hero.rt`. Pestañas Vida / Carrera / Reencuentros / Cierre.

- **Carrera de entrenador:** escalera de 8 peldaños (licencias y cargos). El legado acorta los cursos hasta un 35% (`score/260`) y, con legado 62+/80+, elimina la experiencia mínima de los niveles 2/Pro; con 62+ y solo la licencia 1 un club histórico ofrece ser asistente. Una buena temporada (campeón, ascenso, zona alta) ofrece el siguiente escalón (formativas → asistente → director técnico → club mayor). Como director técnico hay *confianza de la directiva* (+5 victoria, −5 derrota, vuelve a 60 cada temporada): si baja a 15 con 8+ partidos dirigidos hay destitución a mitad de temporada.
- **Vida tras el fútbol:** salud 0-100 calculada con tus lesiones graves, semanas de baja y partidos; se desgasta cada año y con menos de 50 resta capacidad en cualquier cargo. Eventos de salud (operarse cuesta dinero) y etapas a los 45, 55 y 65 años con decisiones que cuestan, mueven la salud y quedan en la historia; el texto usa el patrimonio y el gasto de Finanzas personales.
- **Presidencia con cuentas:** caja del club, ingresos (según el gasto salarial del plantel, finanzas del club y estadio), gastos, aportes de capital si hay déficit y dividendos si hay excedente; fichajes y ventas reales de jugadores (`Market.move`), estadio (3 niveles) y academia (2 inversiones por nivel). El precio de compra escala con el gasto salarial (mín. la fórmula anterior). Dos años seguidos de pérdidas que no puedes cubrir permiten vender el club.
- **Reencuentros:** cada año se anotan los compañeros más fuertes de tu vestuario y los mejores rivales de tu puesto en la liga (guarda nombre y nacimiento, porque el mundo borra a los retirados). Al retirarte un rival te rinde homenaje; si diriges un club, un excompañero retirado puede pedir sitio en tu cuerpo técnico (mejora leve del equipo) y uno en activo puede pedirte fichaje.
- **Cierre:** Salón de la Fama entre partidas (`localStorage` `futpro.hof`, solo en este navegador), tarjeta de carrera PNG y versión imprimible (PDF desde el diálogo de impresión).

Límites: las partidas anteriores no tienen compañeros/rivales anotados hasta que vuelven a jugar un año (al retirarse se anota el vestuario actual). Todos los umbrales, costos y porcentajes son supuestos de diseño probados en `tests/retiro.js`, no datos reales.

## Retiro jugable: fichas, selección, academia, agente y dinastía

**Fichas (`js/ficha.js`, `js/ui-v25.js`, pantalla «Ficha de jugadores»).** Libro de carrera estilo enciclopedia de cada jugador que sigues: protegido/hijo, representados y promesas de tu academia (`hero.fi`). Por temporada y club guarda goles y asistencias reales del acumulado de la competición; los **partidos y minutos son estimados** a partir de la alineación probable del club en cada partido (se marcan con asterisco). Anota título de liga, goleador, Balón de Oro, debut, primer gol y convocatorias (las estadísticas de selección vienen de `p.ns`). Los retirados quedan con su ficha cerrada porque el mundo borra a los retirados.

**Seleccionador jugable (`js/seleccion.js`, `js/ui-v26.js`).** Camino «Seleccionador»: Sub-17 y Sub-20/Sub-23 (licencias 1 y 2) y Absoluta (licencia Pro y 3 años de experiencia o legado 80). Armas la **convocatoria** (23, o 26 en la absoluta, con cupos por posición; el motor elige tu once y banco entre ellos) y diriges con el motor real y pausas los partidos de tu categoría (amistosos, continentales y mundiales). Cómo se integra: `NT.squadOf` y `NT.strength` usan tu lista; `NT.lineup` acepta formación y, para la absoluta, tu lista; `NT.heroPlays` encola solo los partidos de tu categoría; `Coach.job()` devuelve el cargo de selección (`club == null`). Confianza de la federación medida contra lo esperado (`(resultado − esperado)·16`), destitución con 12+ partidos y confianza ≤ 12. Cada torneo terminado registra resultado y sube la confianza; campeón o subcampeón ofrece el siguiente escalón. En la absoluta la lista mejor que la recomendada suma hasta +3 de fuerza (la calidad de las listas juveniles ya se refleja en `comp.ys`).

**Academia propia (`js/proyectos.js`, pestaña «Academia»).** Fundación 150 mil €, 5 niveles (150/450/800/1300/1900 mil € por subir), gasto anual 25 mil € por nivel. Cada año ingresan 1–3 promesas de 12–13 años de tu país (`Youth.makePros`), con potencial ajustado por nivel y legado. A los 17+ pasan a un club (compensación por formación del 8% del valor) y cobras 5% del valor en traspasos posteriores. Pueden apadrinarse o representarse y tienen ficha.

**Representados: ofertas múltiples.** Cuando hay 2+ pretendientes aparece una decisión con cada club (sueldo, rol, tu comisión), «poner a licitar» (≈55–70% de mejorar sueldo +25% y comisión ×1,3; si falla, pierdes la operación) o rechazar.

**Jugadores seguidos en tu club.** Si diriges un club (director técnico, deportivo o presidente) puedes llevar a un seguido a tu plantel (en presidencia paga la caja). Como director técnico puedes pedirle minutos (`Match.lineup` suma +8 al favorito): juega aunque sea algo peor y, con 1200+ min estimados, progresa +1 al año.

**Dinastía.** Con un hijo como protegido, «Continuar la dinastía» abre la creación de carrera con su nombre, país, posición, nivel y potencial heredados; el mundo se genera de nuevo en el año actual, la biografía y el Salón de la Fama indican «hijo de» y hay un bonus de fama inicial de `legado/10`. La partida anterior queda guardada.

Límites: las fichas solo cuentan desde que sigues al jugador; las nóminas de selección de otras categorías las sigue armando la IA; todos los umbrales, costos y porcentajes son supuestos de diseño probados en `tests/ficha.js`, `tests/seleccion.js` y `tests/proyectos.js`, no datos reales.

## Menú reorganizado (`js/ui-v28.js`, opción A)

El menú pasa de 29 a 16 entradas (jugando) o 12 (retirado) sin borrar pantallas: **Mi jugador** (Perfil · Salud · Vestuario · Vida personal), **Mi carrera** (Resumen · Metas · Historial · Palmarés · Biografía), **Entrenamientos y táctica**, **Clasificaciones y estadísticas**, **Mercado y contratos** (con Pruebas) y **Después del retiro** (Legado y caminos · Vida y proyectos · Fichas). Cada grupo envuelve la pantalla original (`merged`) y conserva sus herramientas y pestañas internas. Los identificadores antiguos (`health`, `locker`, `bio`, `post`, `retiro`…) siguen funcionando: `UI.render` los redirige a su pestaña (`UI.ALIAS`), y los avisos de las pantallas internas se suman en su grupo. Jugando se oculta Banquillo y Después del retiro; retirado se ocultan Partido, Entrenamientos, Táctica, Salud, Vestuario, Metas y Mercado, y Banquillo aparece solo si diriges un club o selección. Solo presentación: no cambia estado ni guardados.

## Goleadores de la IA calibrados (`Match.SCT`, `tests/goleadores.js`)

Antes, los goleadores de la IA terminaban la liga con ~10-14 goles (el reparto entre todo el plantel era demasiado parejo y los suplentes marcaban como titulares), por lo que un jugador mediocre con 18 goles ganaba la Bota de Oro en casi cualquier liga. Ahora `swFor` pondera por `(media/60)^8` y por rol: titulares (los 12 mejores) pesan 1, el banco 0,2 y el resto 0,03; las asistencias mantienen el peso anterior. Resultado medido en 4 temporadas de un mundo (goleador medio por calidad de liga): ≥70 → 21,5; 60-69 → 20,5; 50-59 → 17,6; <50 → 16,4 (máximos 30-37). Los goles por partido (≈2,4-2,6) no cambian: solo cambia quién los marca. Las referencias que se tomaron como objetivo (≈21-25 en ligas top, 18-20 en medias, 15-18 en el resto) son de memoria, no datos exactos. En dos carreras de prueba el jugador pasó de 5 a 1 Bota de Oro (semilla 5) con la misma trayectoria; el Balón de Oro y los premios por liga usan los goles ya ajustados.

## Fecha de nacimiento

La nueva carrera pide la **fecha de nacimiento** (día, mes y año) en lugar de la edad; la edad al comenzar (12–17) se calcula con corte al 18 de mayo del año de inicio y se muestra en el formulario. El jugador guarda la fecha exacta en `hero.bd = [año, mes 0-11, día]` (los que no la tienen, como partidas antiguas, usan el lunes de su semana de nacimiento); `FP.Date.bdText(h)` la formatea y se usa en la biografía y en el perfil. La partida preconfigurada nace el 14-09 de (año de inicio − 14). La dinastía hereda el día y mes de nacimiento del hijo. El cálculo de la edad en el juego sigue siendo por semanas, así que el cumpleaños puede desfasarse hasta una semana.

## Realismo: trayectorias, contratos, partidos y calendario

**Trayectorias más variadas (`js/desarrollo.js`, `Sim.progressPlayer`, `tests/desarrollo.js`).** Cada jugador tiene un perfil de desarrollo `dv` (−2 a +3 años, pasos de 0,5): el que madura tarde crece como alguien más joven y el temprano al revés. La primera vez que progresa, su nivel se reubica sobre su propia curva. El potencial puede revisarse cada año hasta los 23 años (explosión +4/+8 con 3%; estancamiento −3/−6 con 6%, `Sim.REV`) y el del jugador del usuario se revisa cada julio con mensaje. `Youth.potFor` suma dispersión (σ 5,5, colas). Medido en 3000 jugadores: dispersión del resultado +58 %, tardíos (+4 entre 19 y 22 años) 5,6 % → 11,3 %, media final −0,6 respecto de antes. En 6 carreras del jugador preconfigurado la media final pasó de 61-62 a 62-77.

**Contratos (`js/contratos2.js`).** Ya existían cláusula de rescisión, opción de compra, primas y bonos. Se suman la **renovación automática** (≈20-30 % de los profesionales de 19-31 años con 2+ años: +1 año si juegas los partidos pactados en la última temporada) y la **rebaja salarial por descenso** (≈45 % en primera, ≈30 % en segunda: −30/−40 % al descender). Se ven en el resumen y en el detalle del contrato.

**Partido (`Match.RL`, `js/derbis.js`, `tests/partidos.js`).** Calibrado sobre 1500 partidos de 10 ligas: goles ≈2,8 (completo) y ≈2,6 (rápido); resultados local/empate/visita ≈45/23/32; amarillas ≈3,7 (antes 2,3); rojas ≈0,13; penales ≈0,35 (antes 0,95, que daban el 27 % de los goles). Se agregan **xG** (suma ≈ goles; se muestra en las estadísticas), **VAR** (anula ~4 % de los goles de jugada desde 2018 en ligas con calidad ≥ 60 y torneos continentales; evento propio), **severidad del árbitro** por partido y **derbis** (≈50 pares curados de memoria, solo del mismo país: ×1,3 en tarjetas, un poco más de importancia y localía; ≈+33 % de amarillas). Referencias de realidad aproximadas (de memoria).

**Calendario y copas (`js/comp.js`, `js/supercopas.js`, `tests/calendario.js`).** Las ligas ya no programan jornadas en las semanas de ventana FIFA (ni la siguiente). Las copas tienen sorteo en gran parte aleatorio (los de primera entran como cabezas de serie, sorteo libre desde la segunda ronda), juega de local el club de menor categoría en las primeras rondas, y reglas por país (`Comp.CUPCFG`): Brasil, Colombia y Ecuador a ida y vuelta; semifinales a ida y vuelta en España, Italia y Portugal. Cada temporada se juega la **supercopa** (≈20 países) entre el campeón de liga y el de copa (si son el mismo, el subcampeón de liga). Medido: 0 de 145 mil partidos de liga en fecha FIFA; los ganadores de copa son de primera el 91 %; el de menor categoría fue local 2433 veces frente a 0.

Límites: todos los parámetros son supuestos de diseño; las referencias reales son de memoria. Las supercopas se juegan a un solo partido (la real de España y otras tiene formato distinto).

## Legado e ídolo por club

Pestaña **Mi club › Legado** (`js/idolo.js`, `js/ui-idolo.js`, `tests/idolo.js`).

- **Legado histórico** (0–100) por club: partidos, goles, asistencias, temporadas, ligas, copas, goles en finales, derbis, descensos evitados, ascensos, hat-tricks y ofertas rechazadas para quedarte. Estatus: Desconocido, Jugador querido (20), Referente (40), Ídolo (60), Leyenda (80), Ídolo eterno (95).
- **Escala según el club**: el mismo aporte vale menos en un club grande que en uno pequeño (`Id.size`).
- **Cariño de la hinchada** (hoy): sube y baja con el rendimiento y con cómo te vas; irse a un rival directo lo penaliza.
- **Eventos**: hinchas piden renovación (sube lo que exigen en la renovación), ovación o silbidos al volver, oferta de regreso, salón del club al retirarte, puesto de embajador o entrenador de juveniles.
- **Récords del club**: solo desde el inicio de la partida (el juego no tiene la historia real previa).
- Los pesos y umbrales son supuestos de diseño, no datos reales. Partidas anteriores se reconstruyen una vez desde el registro de estadísticas.

## Trayectoria estilo Wikipedia: formación, profesional y selecciones

Solo presentación (`js/ui-v17.js`, `js/ui-v18.js`, `js/bio.js`); no cambia el registro de estadísticas.

- **Estadísticas › Clubes** abre por defecto en «Formación y profesional»: tabla **Etapa formativa** (juvenil y amateur) y tabla **Carrera profesional**. Las vistas «Todo junto» y «Plana» siguen disponibles.
- El **total profesional** ya no incluye las ligas juveniles ni amateur; la línea final muestra ambos totales por separado.
- **Ficha lateral**: «Clubes juveniles» (solo años y club), «Clubes profesionales» (con partidos y goles, p. ej. `50 (40)`) y «Selección nacional» con una línea por categoría.
- Las selecciones siguen en su propia tabla, sin sumarse a los clubes.

## Motor narrativo de la Wiki

La Biografía se redacta con un motor determinista que lee el historial real de la partida (sin conexión, sin IA). No modifica estado, partidos, contratos, fichajes ni guardado: solo interpreta y presenta registros ya existentes.

- **Archivos**: `js/narrativa.js` (interpretación), `js/narrativa-texto.js` (redacción y conexión con `Bio.build`), `tests/narrativa.js` (pruebas) y `tests/narrativa-calibrar.js` (calibración). La ficha lateral, la cronología y la estructura de la pantalla se conservan.
- **Interpretación en contexto**: cada temporada se compara con lo esperable para su posición (goles y asistencias por 90 minutos y valoración media), se encoge hacia lo normal con pocos minutos (menos de 450: «participación limitada»; hasta 900: muestra media) y se pondera por el nivel de la competición (`N.LEVEL`): lo logrado en divisiones inferiores, juveniles o amateur pesa menos y no puede llamarse «excepcional».
- **Qué detecta**: etapas por club (cedidos y regresos incluidos), rol (titular, rotación, suplente), ascensos y descensos del club, cambios de país, lesiones de larga duración, títulos e individuales con peso, selecciones, estatus de ídolo del módulo de legado, caídas y recuperaciones, retroceso sostenido y retiro.
- **Tipos de trayectoria** (no excluyentes, puntuados con rasgos medibles): estrella, modesto, trotamundos, ídolo de club, promesa frustrada, superación, carrera interrumpida, desarrollo tardío y precoz. Cambian qué se cuenta en la introducción, no inventan hechos.
- **Jerarquía**: cada hecho recibe un peso y se coloca en introducción, club, selección, palmarés, récords o cronología; las etapas largas se redactan por tramos y las de pocos partidos se agrupan.
- **Presentación**: Introducción, Primeros años y formación, Carrera profesional por clubes, Selección nacional, Estilo de juego, Estadísticas profesionales, Estadísticas juveniles, Palmarés y distinciones, Récords y legado, Vida personal, Retiro y trayectoria posterior. Las secciones sin datos aparecen en «por desbloquear».
- **Estabilidad**: las variantes de texto se eligen con un hash del nombre y la fecha de nacimiento; la misma partida produce siempre el mismo texto, y se recalcula entera al avanzar la carrera (no se añaden párrafos sueltos).
- **Supuestos de diseño y límites**: las referencias de rendimiento (`N.BASE`) salen de carreras simuladas del propio juego y los umbrales (`z` ≥ 0,3 / 0,9 / 1,6) son decisiones de diseño, no datos reales. No se redacta ninguna causa de salida, retiro o fracaso porque el juego no la registra; las cifras económicas son solo las registradas.

## Etapas por club y legado acumulativo

- **Tablas de estadísticas** (Biografía): cada etapa (temporadas consecutivas en un club) es su propio bloque, en orden cronológico. Al volver a un club se repite su nombre con la marca «2.ª etapa», y la fila **Total club** aparece al terminar su última etapa con lo acumulado en todas («Total club (2 etapas)»). Columnas: Club (escudo y país), Div. (1.ª, 2.ª…; juveniles y amateur muestran su categoría), Temporada y, por grupo (Liga, Copa nacional, Continental, Total), PJ, G y A.
- **Legado**: el estatus es histórico y se evalúa **una sola vez por club** con todas sus etapas (`Narr.clubTotals`); volver no lo concede de nuevo. La Wiki lo cuenta una vez, con las etapas y lo acumulado. El estatus, el cariño y el salón del club ya se guardaban por club en el módulo de legado.

## Valor de mercado según rendimiento

`js/valor.js` (lógica), `js/ui-valor.js` (tarjeta «Tu valor de mercado» en Mercado › Reputación) y `tests/valor.js`.

- El valor base (nivel, potencial estimado y edad) se multiplica por un ajuste que sale de: **forma reciente** (las temporadas de los últimos dos años evaluadas por el motor narrativo según posición, nivel de la competición y minutos), **títulos y distinciones** de los últimos tres años (con peso decreciente), **rol** en el equipo y **selección absoluta**. Límites: ×0,8 a ×1,8.
- En carreras simuladas el ajuste fue de ×0,98 a ×1,27 (mediana ×1,03).
- Afecta solo a tu jugador, se calcula al consultarse (memorizado por semana) y no guarda estado. Los jóvenes se valoran sobre todo por su potencial (el ajuste pesa menos) y el rendimiento en categorías bajas pesa menos.
- Como el sueldo, el traspaso y las cláusulas parten de `Market.heroValue()`, suben o bajan con él. El número de ofertas lo sigue decidiendo el sistema de reputación e interés de clubes (`js/scouting.js`).
- Los pesos son supuestos de diseño, no datos reales.

## Página de club

`js/clubwiki.js` (datos y redacción), `js/ui-clubwiki.js` (pantalla) y `tests/clubwiki.js`. Se abre en **Mi club › Historia** y con el botón «Ver artículo del club» de la ficha de cualquier club.

- Se redacta **a demanda** con lo que el juego ya guarda: la historia de cada liga (`S.lgs[].hist`: tabla final, campeón, subcampeón), los campeones de copas y torneos internacionales (`S.hist.champs`), los goleadores de cada temporada, los récords del módulo de legado, los derbis y los datos actuales del club. **No añade nada al guardado** (la prueba lo comprueba) y cuesta unos 2 ms por artículo.
- Secciones: introducción, historia registrada (etapas por categoría), palmarés, rivalidades, jugadores destacados, tu paso por el club, tabla de temporadas y situación actual con el plantel.
- Los ascensos y descensos se deducen de la categoría de la temporada siguiente (el juego marca plazas que no siempre se llenan).
- Solo cuenta lo registrado desde el inicio de la partida: el juego no tiene la historia real previa de los clubes, y así se indica.

## Sueldos por liga y por club

`js/sueldos.js` (`FP.Wages`) y `tests/sueldos.js`. Sustituye el cálculo de sueldos de ofertas, renovaciones y representados (`Rep.wage`, comisiones del agente, sueldo estimado de un cliente).

- **Cada liga paga distinto.** El sueldo medio de un jugador de la liga sale de una referencia aproximada (en k€ al año, revisada liga por liga: p. ej. Premier ≈ 7,2 M€, La Liga ≈ 4 M€, Brasileirão ≈ 1,35 M€, Primera chilena ≈ 110 mil €, Primera B ≈ 38 mil €, Primera C argentina ≈ 12 mil €). Donde existe la tabla de clubes de `js/sueldos-datos.js`, el sueldo medio de la liga es el promedio de esa tabla ÷ 28 jugadores con ficha, para que ambas coincidan; el resto sale de `REFK` en `js/sueldos.js`. Las ligas sin referencia se deducen del peso económico del país y de la categoría. Las referencias son aproximaciones de diseño, no datos oficiales.
- **Cada club tiene su masa salarial**: referencia de la liga × 25 jugadores × presupuesto relativo del club, normalizado a media 1 (el sueldo medio de cada liga es siempre su referencia). `js/sueldos-datos.js` trae la masa aproximada (M€ al año) de **todos los clubes de 51 ligas** (primeras divisiones y segundas de las cinco grandes ligas europeas, además de la Primera B chilena): p. ej. Real Madrid 480, Premier de 80 (Burnley) a 420 (City), U. de Chile 7 y Unión Española 2,5 dentro de la Primera B. Son supuestos de diseño de memoria, no cifras oficiales; solo cuentan las proporciones dentro de cada liga. Los clubes que no están en la tabla (divisiones menores) se deducen del valor de su plantilla y su economía.
- **El jugador cobra su parte de la masa** según su valor frente a la media del plantel, con exponente `W.BETA` = 1,35: las figuras (2 o 3 jugadores) se llevan cerca de un tercio de lo que paga el club. La referencia de cada club es el punto medio entre la media de su plantel y la de su liga, para que un suplente de un grande no cobre como un desconocido. Mínimo: 10 % del sueldo medio del club (más, en los clubes ricos); techo: una parte máxima de la masa según la categoría (15 % en Primera, 10 % en segunda, 8 % en tercera, 6 % abajo) o 4 veces el valor al año. El techo también vale para las ofertas con factor de rol y agente (`Rep.wage`): una oferta de Primera B chilena ronda los 8 mil € al mes como máximo. El plantel completo suma aproximadamente la masa del club.
- Las ofertas, los términos del contrato y la tarjeta de valor muestran también el sueldo **al mes**.
- Tu tarjeta «Tu valor de mercado» muestra el sueldo a tu valor en tu club y el sueldo medio de tu liga; el artículo de cada club muestra el sueldo medio de su plantel.
- Comparado con el cálculo anterior, en carreras simuladas de 10 años los sueldos suben unas 2,5 a 4 veces en las ligas pequeñas (por ejemplo, un zaguero de la primera chilena: de 37 k€ a 150 k€ como máximo), más cerca de la realidad.

## Origen de los extranjeros

`js/origenes.js` (`FP.Origenes`) y `tests/origenes.js`. Sustituye el sorteo de nacionalidad de los extranjeros (`Core.foreignNat`): antes pesaba solo el nivel de la selección en todo el mundo y aparecían estadounidenses o burkineses en clubes chilenos. Ahora el peso de cada país depende de su cercanía con el del club: misma región futbolística (Sudamérica sur y norte, Centroamérica y Caribe, Europa latina, etc.), vínculos de idioma o historia (España–Latinoamérica, Portugal–Brasil, Francia–Magreb) y mismo continente; los países de otros continentes solo llegan de forma marginal, y con más peso en las ligas ricas (`foreignP` ≥ 0,3). También filtra a los agentes libres y a los fichajes entre clubes de la IA (`Rep.aiForeignOK`): un club de una liga modesta no ficha a jugadores de países lejanos. No cambia cuántos extranjeros hay. Solo afecta a mundos nuevos: las partidas guardadas conservan sus plantillas. Los pesos son supuestos de diseño.
