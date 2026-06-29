#!/usr/bin/env bash
# Start the full local stack: Canton sandbox + Daml JSON API + demo backend.
# Open http://localhost:4000 and click RFQ -> Quote -> Accept -> Settle.
set -euo pipefail
export PATH="$HOME/.daml/bin:$PATH"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[1/5] building DAR"
daml build >/dev/null
DAR=.daml/dist/blackrocq-0.1.0.dar
PKG=$(daml damlc inspect-dar --json "$DAR" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).main_package_id))")
echo "    package id: $PKG"

pids=()
cleanup(){ echo; echo "stopping stack..."; for p in "${pids[@]:-}"; do kill "$p" 2>/dev/null || true; done; }
trap cleanup EXIT INT TERM

echo "[2/5] starting Canton sandbox (:6865)"
daml sandbox --port 6865 >/tmp/blackrocq-sandbox.log 2>&1 & pids+=($!)
until daml ledger list-parties --host localhost --port 6865 >/dev/null 2>&1; do sleep 2; done

echo "[3/5] uploading DAR"
daml ledger upload-dar --host localhost --port 6865 "$DAR" >/dev/null

echo "[4/5] starting Daml JSON API (:7575)"
daml json-api --ledger-host localhost --ledger-port 6865 --http-port 7575 \
  --allow-insecure-tokens >/tmp/blackrocq-jsonapi.log 2>&1 & pids+=($!)
until curl -s localhost:7575/readyz >/dev/null 2>&1; do sleep 1; done

echo "[5/5] starting demo backend  ->  http://localhost:4000"
cd app && PKG_ID="$PKG" node server.js
