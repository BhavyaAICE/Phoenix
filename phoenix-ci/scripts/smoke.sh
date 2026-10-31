#!/usr/bin/env bash
# End-to-end smoke test.
set -euo pipefail

BACKEND="${1:-http://localhost:8000}"
FRONTEND="${2:-http://localhost:3000}"
VERSION="${3:-}"

BACKEND="${BACKEND%/}"
BACKEND="${BACKEND%/api/health}"
BACKEND="${BACKEND%/health}"
BACKEND="${BACKEND%/api}"
FRONTEND="${FRONTEND%/}"

echo "-> health"
HEALTH=$(curl -sf "$BACKEND/api/health" || curl -sf "$BACKEND/health")
echo "$HEALTH"
echo "$HEALTH" | grep -Eq '"status"[[:space:]]*:[[:space:]]*"ok"' || { echo "FAIL: health not ok"; exit 1; }
echo "$HEALTH" | grep -Eq '"db"[[:space:]]*:[[:space:]]*"ok"' || { echo "FAIL: db not ok"; exit 1; }

echo "-> frontend"
curl -sf "$FRONTEND/" > /dev/null || { echo "FAIL: frontend unreachable"; exit 1; }

echo "-> login"
LOGIN=$(curl -sf -X POST "$BACKEND/api/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"alice@phoenix.dev","password":"phoenix123"}')
echo "$LOGIN"
echo "$LOGIN" | grep -q 'access_token' || { echo "FAIL: login failed"; exit 1; }

if [ -n "$VERSION" ]; then
  echo "-> version check"
  echo "$HEALTH" | grep -Eq "\"version\"[[:space:]]*:[[:space:]]*\"?$VERSION\"?" || { echo "FAIL: version mismatch"; exit 1; }
fi

echo "SMOKE OK"
