#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SECRETS="$ROOT/secrets"

cp "$SECRETS/api.env" "$ROOT/apps/api/.env"
echo "Synced apps/api/.env"

cp "$SECRETS/ngrok.env" "$ROOT/.env.ngrok"
echo "Synced .env.ngrok"

cp "$SECRETS/ngrok.yml" "$ROOT/infrastructure/ngrok/ngrok.yml"
echo "Synced infrastructure/ngrok/ngrok.yml"

API_URL=$(node -pe "JSON.parse(require('fs').readFileSync('$SECRETS/mobile.env.json','utf8')).apiUrl")
SYNC_DAYS=$(node -pe "JSON.parse(require('fs').readFileSync('$SECRETS/mobile.env.json','utf8')).syncWindowDays")
PROD=$(node -pe "JSON.parse(require('fs').readFileSync('$SECRETS/mobile.env.json','utf8')).production")

for f in environment.ts environment.prod.ts; do
  cat > "$ROOT/apps/mobile/src/environments/$f" <<EOF
export const environment = {
  production: $PROD,
  apiUrl: '$API_URL',
  syncWindowDays: $SYNC_DAYS,
};
EOF
done
echo "Synced mobile environments"
echo "Done. Run: npm run dev"
