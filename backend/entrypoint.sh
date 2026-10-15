#!/bin/sh
set -e
cd /app

CERTS_DIR="${CERTS_DIR:-/certs}"
mkdir -p "$CERTS_DIR" "$DATA_DIR"

if [ ! -f "$CERTS_DIR/server.crt" ] || [ ! -f "$CERTS_DIR/server.key" ]; then
  echo "Génération du certificat auto-signé pédagogique..."
  CERTS_DIR="$CERTS_DIR" python generate_certs.py
fi

echo "Démarrage HTTPS pédagogique sur le port 8443..."
exec uvicorn main:app \
  --host 0.0.0.0 \
  --port 8443 \
  --ssl-certfile "$CERTS_DIR/server.crt" \
  --ssl-keyfile "$CERTS_DIR/server.key"
