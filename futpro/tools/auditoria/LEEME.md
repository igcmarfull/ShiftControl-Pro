# Herramientas de la auditoría de goles y mercado

Scripts de Node (sin dependencias) que usan `tests/harness.js`. Los resultados completos están en `docs/AUDITORIA_GOLES_MERCADO.md`.

| Script | Qué mide |
|---|---|
| `collect.js semilla POS1,POS2 temporadas salida.jsonl` | una línea por partido del protagonista (puesto, nivel, liga, rival, goles, minutos…) |
| `an.js` | resume los `d*.jsonl` del directorio actual: goles por partido según puesto, nivel, liga, rival, titularidad |
| `collect2.js semilla POS1,POS2 temporadas salida.jsonl` | ofertas, fichajes, reputación y habilidad de remate durante la carrera |
| `an2.js` | resume los `m*.jsonl`: ofertas según rendimiento y evolución de la reputación |
| `engine.js` | motor detallado sin protagonista: goles por partido y reparto por puesto del que marca |
| `herolvl.js [raiz] [ligas]` | protagonista delantero con distintos niveles frente al delantero de la IA |
| `attrs.js` | influencia de los atributos (remate, pases, físico) en los goles |
| `ai.js` | máximos goleadores de la simulación rápida (IA) por calidad de liga |
| `consist.js` | consistencia entre el libro de estadísticas, los acumulados y las temporadas |
| `star.js liga nivel extra_remate` | delantero hecho a mano en una liga débil: ofertas y reputación durante 5 años |

Ejemplo: `node tools/auditoria/collect.js 11 ST,ST 14 /tmp/d11.jsonl` y luego `node tools/auditoria/an.js` desde la carpeta con los `.jsonl`.
Las pruebas de equilibrio con constantes alternativas se hicieron sobre una copia de `js/match.js` leyendo `SW`, `SB`, `PG` y `CAPK` del entorno; no están en el repositorio.
