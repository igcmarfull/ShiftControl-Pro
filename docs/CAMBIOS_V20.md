# ShiftControl Pro V20 — Base migrable

## Cambios

- Se tomó la V19 como fuente oficial.
- Se corrigió el nombre visible de la versión y el título del navegador.
- La capa visual y lógica agregada en V19 dejó de estar duplicada dentro del HTML.
- Esa capa ahora vive en `src/v20-interface.css` y `src/v20-interface.js`.
- Se conserva una copia exacta de V19 dentro de `docs/` para recuperación inmediata.
- El núcleo histórico permanece dentro de `index.html` para evitar regresiones.

## Compatibilidad

Los datos continúan usando las mismas claves de `localStorage`, por lo que abrir V20 en el mismo navegador y origen conserva la información existente.

## Siguiente etapa segura

Separar por módulos el núcleo histórico, comenzando por almacenamiento y autenticación, mediante pruebas de regresión. No conviene extraer todo de una sola vez porque el archivo contiene dependencias acumuladas entre versiones.
