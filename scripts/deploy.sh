#!/bin/bash
# VPS deploy: run `cd ~/bang-gia; git pull; bash scripts/deploy.sh`
# (kept as a script because the Vultr web console mangles shifted characters like & | >)
set -e
cd ~/bang-gia
npm install --no-audit --no-fund 2>&1 | tail -2
NODE_OPTIONS='--max-old-space-size=1536' npm run build 2>&1 | tail -8
pm2 restart bang-gia
sleep 4
curl -s -o /dev/null -w 'LOCAL HTTP %{http_code}\n' http://localhost:3000
node scripts/check-viettel.mjs
