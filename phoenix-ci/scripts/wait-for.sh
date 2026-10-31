#!/usr/bin/env bash
set -euo pipefail

URL="${1:?Usage: wait-for.sh <url> [timeout_seconds]}"
TIMEOUT="${2:-60}"
START_TIME=$(date +%s)

echo "Waiting for $URL to answer (timeout ${TIMEOUT}s)..."
while true; do
  if curl -sf "$URL" > /dev/null 2>&1; then
    echo "$URL is up!"
    exit 0
  fi
  NOW=$(date +%s)
  if [ $((NOW - START_TIME)) -ge "$TIMEOUT" ]; then
    echo "Timed out waiting for $URL" >&2
    exit 1
  fi
  sleep 1
done

