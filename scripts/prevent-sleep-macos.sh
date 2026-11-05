#!/usr/bin/env bash
# Evita que la Mac se suspenda mientras corre el comando dado (O02).
# Uso: ./scripts/prevent-sleep-macos.sh npm run bot
# -i: sin reposo por inactividad; -s: sin reposo de sistema (con cargador).
# Igual: tapa abierta, cargador conectado y red estable. caffeinate no es magia.
set -euo pipefail
exec caffeinate -i -s "$@"
