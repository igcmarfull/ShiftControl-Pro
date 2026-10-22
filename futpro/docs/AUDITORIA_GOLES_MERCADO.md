# Auditoría de goles, mercado y reputación

Mediciones hechas con las herramientas de `tools/auditoria/` (ver `LEEME.md` de esa carpeta). No se cambió ninguna regla del juego.
**Comprobado** = medido con simulaciones o confirmado leyendo el código. **Hipótesis** = plausible, sin medir. Las referencias del fútbol real son de memoria y aproximadas, no datos oficiales.

## 1. Resumen

- **Los goles desmesurados son reales y reproducibles**, y tienen tres causas en el motor de partidos detallado (el que juega el protagonista). Ninguna es un error de cálculo aislado: son equilibrios mal calibrados.
- **Las ofertas incoherentes con la trayectoria se explican por dos reglas del mercado** (la reputación internacional tiene un techo bajo en ligas débiles y las ofertas dependen del nivel, no de los goles). El mercado es coherente consigo mismo; lo que está desajustado es la producción de goles frente al nivel del jugador.
- **Las estadísticas son consistentes entre sí** (libro de estadísticas, acumulados y temporadas coinciden).
- Hay **dos hallazgos de diseño propios** (uno mío): el valor de mercado pesa igual la primera de Guatemala que la Premier, y ninguna prueba vigila la producción de goles del motor detallado.

## 2. Goles

### 2.1 Reproducción de los casos
Muestra: 16 carreras de 14 temporadas (8 delanteros, 4 extremos, 4 mediapuntas), 3.195 partidos profesionales con minutos.

| Caso | g/partido |
|---|---|
| Tus ejemplos | 0,87 (172/197), 0,73 (262/359), 0,96 (109/113), 1,27 (33/26) |
| Delantero (ST), todos los partidos pro | **0,65** (0,71 por 90 min), 39–43 % de los goles de su equipo |
| Delantero en primera división | 0,81 |
| Delantero en segunda | 0,65 |
| Extremo derecho | 0,25 · mediapunta 0,24 (asistencias: 0,15 y 0,20 por 90) |
| Escenario construido: ST de nivel 68 en Guatemala, 5 años | 176 goles en 180 partidos (1,1 g/p el primer año) |
| Mismo ST de nivel 68 en Chile, 5 años | 118 goles en 143 partidos (0,83) |

Los extremos y mediapuntas están en rangos razonables. **El problema es el delantero.**

### 2.2 Causa 1 (comprobada): todos los delanteros del motor detallado son «máximos goleadores»
Reparto de goles por puesto del que marca, motor detallado sin protagonista (150 partidos por liga; el total de goles por partido es correcto: 2,6–2,9):

| Liga | ST | Extremos | Mediapunta | Mediocampo | Defensas |
|---|---|---|---|---|---|
| ENG1 (q75) | 43 % | 32 % | 11 % | 5 % | 4 % |
| CHI1 (q58) | 37 % | 35 % | 14 % | 5 % | 2 % |
| GUA1 (q44) | 47 % | 27 % | 16 % | 4 % | 1 % |
| BRA1 (q67) | 50 % | 27 % | 5 % | 7 % | 4 % |

(El 6–8 % restante lo marcan suplentes.) Como el ST de cada equipo se lleva ~43 % de los goles de su equipo, **el delantero medio de la IA marca 0,43–0,75 por partido en todas las ligas**: nivel de máximo goleador. En la simulación rápida (los partidos del resto del mundo) el máximo goleador de una liga promedia 0,55–0,67 g/p (15–23 goles). En referencia aproximada del fútbol real: delanteros ≈ 55–60 % de los goles, mediocampo ≈ 30 %, defensas ≈ 12–14 %, y el delantero centro de un equipo ≈ 25–35 % de los goles de su equipo.
Origen: `SW_POS` (`js/match.js:8`, ST = 10 frente a 6/5/2,4/1,3/1), elevado a `q^2,5` con `SHOT_BONUS` (`:10`: defensas −20/−22, mediocampo −7/−12), y la probabilidad de gol por remate depende otra vez del remate del tirador (`:302`). Los defensas y mediocampistas quedan penalizados tres veces.

### 2.3 Causa 2 (comprobada): el protagonista que supera a su equipo acapara los goles
Mismo equipo, protagonista delantero con distintos niveles (220 partidos por celda). Entre paréntesis, el delantero rival de la IA en los mismos partidos:

| Liga (nivel del equipo) | Héroe 55 | Héroe 70 | Héroe 86 |
|---|---|---|---|
| ENG1 (st 78) | 0,12 (0,63) | 0,21 (0,63) | 0,56 (0,55) |
| CHI1 (st 61) | 0,28 (0,60) | 0,56 (0,48) | 0,95 (0,43) |
| GUA1 (st 46) | 0,65 (0,66) | 0,98 (0,66) | 0,99 (0,53) |

En una liga débil el héroe de nivel 70 marca el 56 % de los goles de su equipo y la producción se **satura en ≈ 1,0 g/p** (≈ 5 remates por partido): ese es el techo que se ve en los 109/113. En la liga fuerte el mismo héroe marca la quinta parte. Tiene sentido que el nivel relativo importe, pero la curva sube demasiado rápido y se aplana demasiado alto (`shooterFin`, `:257-262`, con `ref = st + 4` y un tope de +12).

### 2.4 Causa 3 (comprobada): la habilidad de remate sobrepesa frente al nivel general
`shotSkill = 0,4·fin + 0,3·rem + 0,2·com + 0,1·pos + moral/forma` (`js/hero.js:121`) se usa directamente en el motor, y el entrenamiento «posición» sube justamente los cinco atributos más pesados del puesto (`Hero.focusAttrs`, `:136`). En las carreras, el remate del delantero está en promedio **+3,8 sobre su nivel (máx. +10) y +4,7 sobre la fuerza de su equipo (máx. +15)**.
Prueba controlada (equipo CHI1 medio, 260 partidos):

| Perfil | Nivel | Remate | g/partido |
|---|---|---|---|
| Todo 62 | 62 | 62 | 0,40 |
| Remate 80, resto 55 | 67 | 80 | **0,90** |
| Remate 55, resto 80 | 68 | 55 | 0,28 |
| Remate 95, pases 95, físico 40 | 74 | 95 | 0,98 |
| Remate 80, pases 40 | 65 | 80 | 0,83 (asistencias 0,03) |

Los atributos sí influyen en la dirección correcta (remate → goles, pases → asistencias): es una **sensibilidad excesiva**, no un fallo.

### 2.5 Otras mediciones
- **Calidad de los rivales (comprobado)**: monótona y razonable. ST: 0,41 g/p con −10..−4 de diferencia de fuerza; 0,60 parejos; 0,77 con +4..+10; 0,91 con más de +10. Local 0,74 / visita 0,55.
- **Minutos y titularidad (comprobado)**: titulares 0,72 por 90, suplentes 0,51 por 90 (0,14 por partido). Titular el 93 % de los partidos de los delanteros.
- **Goles del equipo (comprobado)**: con un delantero protagonista el equipo marca 1,64 por partido frente a 1,38 que da el modelo rápido con las mismas fuerzas (+19 %); con extremo o mediapunta, 1,46.
- **Hat-tricks (comprobado)**: 3,8 % de los partidos de liga profesional del delantero (36 de 958); 4 o más, 13; 5 o más, 1.
- **Asistencias (comprobado)**: 0,07–0,08 por 90 el delantero, bajo para el fútbol real (≈ 0,15 aprox.). Los pases se eligen por `AS_POS` (`:9`, ST = 3,6).
- **Goles por temporada del delantero** (≥ 20 partidos pro): media 20,5; en primera división 29,0 (máx. 46).
- **Consistencia de estadísticas (comprobado)**: el libro por clases, `h.tot` y la suma de `h.seasons` coinciden exactamente en una carrera de 8 años; ningún partido tiene más goles del héroe que de su equipo (0 de 5.791); los amistosos no se mezclan. `h.tot` incluye las categorías juveniles y amateur (`js/hero.js:449-455`): si tu «partidos profesionales» sale de ese total, lleva partidos de cantera (hipótesis sobre tus cifras).
- **Penales (hipótesis)**: el mejor rematador del once los ejecuta (`:303-306`); puede sumar ~0,05–0,1 g/p al protagonista delantero. No medido por separado.

### 2.6 Cobertura de pruebas
`tests/partidos.js` fija goles totales, victorias locales, tarjetas, xG; `tests/goleadores.js` calibra solo el reparto de la simulación rápida (máximo goleador 18–27 por liga). **Ninguna prueba vigila el reparto por puesto del motor detallado ni los goles por partido del protagonista**, por eso la deriva pasó sin avisar.

### 2.7 Acoplamiento a tener en cuenta
`SW_POS` y `AS_POS` se usan en la simulación rápida (`swFor`, `:43-52`) **y** en el motor detallado (`:263-275`). Cambiarlos para arreglar al protagonista baja los máximos goleadores de la IA (en el prototipo, de 17 a 13 goles) y rompe `tests/goleadores.js`. Hay que separar las constantes (por ejemplo `SW_FULL`) antes de recalibrar.

## 3. Mercado y reputación

### 3.1 Qué pasa con un goleador extraordinario (comprobado, escenario construido)
Delantero de 20 años, nivel 68, remate 77, en un club medio de Guatemala (liga de calidad 44):

| Año | Equipo | g/p | Ofertas recibidas | Reputación local/nacional/internacional |
|---|---|---|---|---|
| 1 | Cobán Imperial | 1,12 | Irlanda 2.ª (q36) | 84 / 82 / 25 |
| 2 | → Kongsvinger (Noruega 2.ª) | 1,00 | Uruguay q46, Noruega 2.ª q50, Irán q47, Honduras q46 | 87 / 83 / 27 |
| 3 | Kongsvinger | 1,63 | Noruega 1.ª q57 ×2, Turquía 2.ª q54 | 95 / 96 / 46 |
| 4 | → Wigan (Inglaterra 3.ª) | 1,0–1,57 | Emiratos, Países Bajos q65, Dinamarca q59, Liverpool (suplente) | 88 / 90 / 52 |
| 5 | Liverpool | 1,07 | Inter, Juventus, Toluca | 98 / 99 / 91 |

Exactamente lo que describes: 28 goles en 25 partidos y ofertas de ligas menores durante dos años. Esto reproduce de nuevo el patrón de goles de tus ejemplos (176 en 180).

### 3.2 Por qué (comprobado leyendo y midiendo)
1. **Techo de reputación internacional en ligas débiles.** `Rep.targets` (`js/scouting.js:38-65`): en primera división `int = clamp((calidad − 52) × 1,4, 0, 62)`, que vale 0 para q < 52; el rendimiento solo suma `perf×6 + goles/partido×6 + 0,8×bono de goleador`, ≈ 25 como máximo. Medido: **reputación nacional 85–95 con internacional 12–20** en Tailandia, México y Chile.
2. **La visibilidad exige int alto.** `Rep.exposure` (`:75-85`): un club extranjero solo se fija en ti si `int ≥ 24 + (calidad − 48) × 1,25` (q60 → 39; q75 → 58). Con int ≈ 25, solo ven al jugador ligas q ≤ ~49: Irlanda 2.ª, Uruguay, Noruega 2.ª, Irán, Honduras.
3. **Las ofertas se filtran por nivel, no por goles.** `Rep.fit` (`:108-124`): `brecha = ovr − (nivel del club − 5)` debe ser ≥ −3; los goles no entran. `NT.heroScore` (`js/nteams.js:101`, selección) también parte del nivel y solo admite ±2 puntos de rendimiento.
4. **No hay memoria acumulada.** La reputación converge cada semana hacia un objetivo calculado con la temporada actual (`Rep.weekly`, `:67`). Los 100 goles de hace dos años no cuentan, salvo por los títulos (+2 cada uno, hasta +8).
5. **El valor pesa igual toda primera división (mío).** `js/valor.js` evalúa la forma con `N.LEVEL[tier]` (1 / 0,9 / 0,75 / 0,6, `js/narrativa.js:24`), por categoría, no por calidad de la liga (`s.q` existe pero no se usa): un goleador de la primera de Guatemala (q44) y uno de la Premier (q75) reciben el mismo ajuste de forma (hasta ×1,8).

Por qué unos goleadores terminan en clubes inferiores y otros progresan: depende de **su nivel (ovr) y de la calidad de la liga donde juegan**, no de los goles. El que comienza en una liga q ≥ 52 acumula reputación internacional y recibe ofertas de más nivel; el de una liga débil necesita dos pasos para salir. Combinado con 2.2–2.4, los goleadores «extraordinarios» son sobre todo un artefacto del motor, y el mercado, que mira el nivel, no los premia.

### 3.3 Qué el mercado sí considera (comprobado)
Edad y potencial (`Rep.fit`, `potEst`), rol y nivel del club comprador, valor, sueldo (modelo de masa salarial), goles/valoración de la temporada actual (visibilidad y valor), caps absolutas (`+20 nacional, +15..35 internacional`), títulos. **No considera**: calidad de la liga de origen más allá del nivel, goles ni premios acumulados, rendimiento en competiciones internacionales de clubes como señal propia, ni la trayectoria histórica.

## 4. Mapa del código (funciones responsables)

| Área | Funciones |
|---|---|
| Simulación de partidos | `Match.fullSession` (`match.js:195`), `attack` (`:292`), `Match.quick` (`:77`), `lambdas` (`:20`) |
| Goles y asistencias | `chooseShooter` (`:263`), `chooseAssist` (`:270`), `shooterFin` (`:257`), `SW_POS/AS_POS/SHOT_BONUS` (`:8-10`), `swFor`/`scoreGoals` (IA, `:43-76`) |
| Titulares y suplentes | `Hero.squadStatus` (`hero.js:207`), `Match.lineup` (`match.js:125`), `doSub` (`:~383`), minutos del héroe (`heroInMin/heroOutMin`) |
| Desarrollo de atributos | `Hero.trainWeek` (`hero.js:153`), `Hero.matchXP` (`:486`), `Hero.view` (`:113`, `shotSkill`) |
| Reputación | `Rep.targets` (`scouting.js:38`), `Rep.weekly` (`:67`), `Rep.exposure` (`:75`) |
| Mercado | `Rep.fit` (`:108`), `Rep.scoutWeek` (`:136`), `Rep.spark` (`:156`), `Rep.offers` (`:172`), `Market.aiRound` (`market.js:46`), `K.exec` (`clubs.js:49`), `Valor.compute` (`valor.js:27`) |
| Calendarios y estadísticas | `Comp.rows` (`comp.js:80`), `Hero.afterMatch` (`hero.js:437`), `Stats.record` (`stats.js:39`) |

## 5. Errores comprobados, desequilibrios e hipótesis

**Desequilibrios comprobados (con evidencia):**
1. Reparto de goles del motor detallado concentrado en el delantero (§2.2) y con defensas/mediocampo casi sin gol.
2. Saturación en ≈ 1,0 g/p del protagonista en ligas débiles (§2.3).
3. Habilidad de remate sobrepesada frente al nivel (§2.4).
4. Techo de reputación internacional por calidad de liga (§3.2.1–3.2.2).
5. Valor sin escala por calidad de liga (§3.2.5) (mío).
6. Sin pruebas que vigilen el motor detallado (§2.6); `SW_POS/AS_POS` acoplados (§2.7).

**Sin errores de cálculo hallados**: libro de estadísticas, acumulados y temporadas son consistentes; los goles no superan a los del equipo; los premios, VAR y penales están integrados con el marcador.

**Hipótesis sin medir**: efecto de los penales sobre el protagonista; efecto de formaciones con dos delanteros en el reparto; si los jóvenes (13–17) tienen una curva distinta (juvenil: 0,33 g/p, cuota 22 %, parece razonable); sensibilidad al azar semilla (las mediciones usan semillas 11–14, 21–24, 555, 777).

## 6. Propuesta, por orden (no aplicada)

Resultados de un prototipo sobre una copia del motor (sin tocar el repositorio):

| Cambio de prueba | Efecto medido |
|---|---|
| Separar constantes y rebalancear el motor detallado (ST 10→6, mediocampo/defensas más peso, `SHOT_BONUS` más suave, `pgMul` 1,38) | Cuota del ST 43 → 27–32 %, defensas 3 → 11–13 %, delantero IA 0,55 → 0,35–0,4; goles por partido 2,7–2,8 |
| Tope de `shooterFin` de +12 a +6 sobre el equipo | Héroe en liga débil: 1,0 → 0,6–0,75 g/p; liga fuerte casi sin cambio |

Lista de trabajo propuesta: 1) separar `SW_FULL/AS_FULL` y rebalancear con ese prototipo; 2) topar el tirador estrella; 3) mezclar la habilidad de remate con el nivel (p. ej. 70/30) o limitar su diferencia; 4) subir las asistencias del delantero; 5) reputación internacional con base por calidad de liga (que deje de ser 0 con q < 52), memoria acumulada de goles y premios, y producción ajustada por calidad de liga como pequeño bono a `Rep.fit`; 6) escalar el valor por calidad de liga; 7) pruebas nuevas: cuota del ST ≤ 35 %, delantero IA 0,3–0,45 g/p, protagonista ≤ 0,8 g/p en liga débil, goles por temporada medios por categoría y posición.
