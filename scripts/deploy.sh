#!/bin/bash
set -e
cd "$(dirname "$0")"
git pull
npm ci
npm run build
if command -v pm2 >/dev/null 2>&1; then
  pm2 restart kelassi --update-env || pm2 start ecosystem.config.cjs
else
  echo "PM2 absent. Démarrez avec : npm start"
fi
