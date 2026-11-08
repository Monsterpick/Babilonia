#!/bin/sh
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Necesitas Node.js 22+"; exit 1; }
corepack enable 2>/dev/null
[ -d node_modules ] || pnpm install
[ -d apps/dashboard/dist ] || pnpm build
( sleep 3; (xdg-open http://127.0.0.1:7420 || open http://127.0.0.1:7420) >/dev/null 2>&1 ) &
exec pnpm start
