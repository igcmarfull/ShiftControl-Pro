#!/bin/bash
# FutPro: descarga todos los escudos verificables, una sola vez, para jugar offline.
cd "$(dirname "$0")" || exit 1
printf '\nFUTPRO - INSTALADOR DE ESCUDOS MUNDIALES\n'
printf 'No modifica partidas, contratos ni estadísticas.\n'
if command -v python3 >/dev/null 2>&1; then
  python3 tools/instalar_escudos.py "$@"
else
  echo 'Se requiere Python 3 para consultar el catálogo de escudos.'
  echo 'Instala Python 3 desde python.org y vuelve a ejecutar este archivo.'
fi
if [[ -t 0 ]]; then printf '\nPulsa Enter para cerrar...'; read -r _; fi
