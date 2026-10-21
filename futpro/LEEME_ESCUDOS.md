# Escudos en FutPro — REDES Y MARCA

Esta versión tiene 2113 entradas de clubes en 132 ligas y 66 países. No se ha alterado `data/world.js`.

## Listo para usar

- En `js/crests.js` hay **275** URLs iniciales; el instalador ampliado busca muchas más de escudos identificados en catálogos públicos, empezando por equipos de Chile y de las principales ligas. Se muestran automáticamente si tienes internet.
- Se utiliza **carga diferida** y hay respaldo visual: si no hay red o falta imagen, aparece el escudo generado por FutPro.
- Para descargar escudos y disponer de ellos **sin conexión**, en Mac abre Terminal en la carpeta `futpro` y ejecuta `bash DESCARGAR_ESCUDOS.command`. Requiere Python 3 e internet para instalar. Puedes ejecutar el mismo archivo cuantas veces quieras: las imágenes existentes no se descargan de nuevo.
- El instalador actualizado cruza los **2113** clubes con dos catálogos por país y más de 100 equivalencias de nombres confirmadas, descarga los SVG/PNG identificados y escribe `js/crests-local.js`, que tiene prioridad sobre las URLs. Los que no encuentre conservan el escudo generado.

## Limitaciones

**Este ZIP no contiene físicamente los cientos de imágenes oficiales:** desde el entorno de preparación no estaba disponible la descarga masiva de archivos binarios. Sí contiene las URLs verificadas de los equipos indicados y la herramienta para bajarlos a tu Mac.

Los escudos oficiales pueden estar sujetos a marcas y derechos de propiedad intelectual. Verificar permisos antes de distribuir el juego comercialmente. Fuentes: https://github.com/JoseArroyave/football-logos y https://github.com/diegosy12/Escudos_Futbol_2025-26. Las licencias de código de los repositorios no conceden necesariamente derechos sobre marcas de clubes.

Esta actualización conserva el mismo instalador `DESCARGAR_ESCUDOS.command`, que ahora identifica más variantes de nombres y filiales. Los clubes sin coincidencia confiable conservan su escudo generado.

Archivos modificados: `index.html`, `js/ui-icons.js`. Archivos añadidos: `js/crests.js`, `js/crests-local.js`, `assets/clubes-futpro.json`, `assets/crests/README.txt`, `tools/instalar_escudos.py`, `DESCARGAR_ESCUDOS.command`, `tests/test_escudos_installer.py`, este LEEME.

## Ampliación de octubre de 2026

Se amplió el reconocimiento de nombres y filiales sin cambiar el modo de instalación.
En la revisión de los dos catálogos remotos se identificaron aproximadamente **1088 clubes** del total de 2113 con coincidencia directa o normalización inequívoca, antes de añadir las equivalencias específicas manuales. Esa cifra es de *candidatos de escudo*, no de descargas confirmadas: algunas imágenes pueden fallar o no superar la validación. El instalador siempre muestra la cantidad real al finalizar.

**El mismo botón sigue funcionando:** `DESCARGAR_ESCUDOS.command`. Vuelve a ejecutarlo para agregar nuevos archivos sin perder los existentes.

## Descarga completa incluida (octubre 2026)

Esta rama ya incluye en `assets/crests/` los escudos descargados: **1712 de 2113** clubes (ver `assets/escudos-fuentes.csv`). Los 401 restantes conservan el escudo generado: son clubes sin escudo en las dos fuentes públicas, o ficticios.

- El instalador ahora cubre más países y ~250 equivalencias de nombres revisadas a mano.
- Si la API de GitHub no responde, usa `git` como respaldo para listar los archivos (requiere tener `git`).
- Algunos SVG muy pesados (>2,5 MB) se descartan; los SVG con imágenes rasterizadas incrustadas (data:image) se admiten, nada externo.
