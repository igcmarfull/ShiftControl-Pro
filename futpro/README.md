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
