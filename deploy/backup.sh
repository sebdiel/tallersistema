#!/bin/sh
# Respaldo diario de PostgreSQL (lo ejecuta el servicio "backup" de docker-compose.prod.yml).
# Formato "custom" de pg_dump: comprimido y restaurable con pg_restore.
set -eu

RETENCION_DIAS="${RETENCION_DIAS:-14}"

respaldar() {
  archivo="/backups/taller_$(date +%Y%m%d_%H%M).dump"
  if pg_dump -Fc -f "$archivo.tmp"; then
    mv "$archivo.tmp" "$archivo"
    echo "[backup] $(date '+%F %T') OK $archivo ($(du -h "$archivo" | cut -f1))"
  else
    rm -f "$archivo.tmp"
    echo "[backup] $(date '+%F %T') ERROR al respaldar" >&2
  fi
  # Borrar respaldos más antiguos que la retención.
  find /backups -name 'taller_*.dump' -mtime +"$RETENCION_DIAS" -delete
}

# Un respaldo al arrancar y luego uno cada 24 horas.
while true; do
  respaldar
  sleep 86400
done
