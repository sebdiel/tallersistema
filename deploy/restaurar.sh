#!/bin/sh
# Restaura un respaldo en la base de producción.
#   ./deploy/restaurar.sh backups/taller_20261018_0300.dump
# ATENCIÓN: reemplaza los datos actuales por los del respaldo.
set -eu

ARCHIVO="${1:?Uso: ./deploy/restaurar.sh backups/archivo.dump}"
COMPOSE="docker compose --env-file .env.prod -f docker-compose.prod.yml"

[ -f "$ARCHIVO" ] && [ -r "$ARCHIVO" ] || { echo "No se puede leer el respaldo: $ARCHIVO" >&2; exit 1; }

echo "Se reemplazarán TODOS los datos actuales por los de $ARCHIVO."
printf "Escriba RESTAURAR para continuar: "
read -r confirmacion
[ "$confirmacion" = "RESTAURAR" ] || { echo "Cancelado."; exit 1; }

$COMPOSE stop backend
trap '$COMPOSE start backend' EXIT
$COMPOSE exec -T db pg_restore -U taller -d taller_db --clean --if-exists --no-owner --exit-on-error --single-transaction < "$ARCHIVO"
$COMPOSE start backend
trap - EXIT
echo "Restauración terminada."
