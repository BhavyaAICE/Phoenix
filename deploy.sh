#!/usr/bin/env bash
# Phoenix Deployment Script
set -euo pipefail

echo "======================================"
echo "    Project Phoenix - Deployment      "
echo "======================================"

TARGET="${1:-help}"

case "$TARGET" in
  docker)
    echo "-> Deploying with Docker Compose..."
    docker compose up -d --build
    echo "-> Stack running on http://localhost:3000 (frontend) and http://localhost:8000 (backend)"
    ;;

  seed)
    echo "-> Seeding database with demo data..."
    (cd phoenix-backend && npm run seed)
    ;;

  smoke)
    BACKEND_URL="${2:-http://localhost:8000}"
    FRONTEND_URL="${3:-http://localhost:3000}"
    VERSION="${4:-}"
    echo "-> Running smoke tests against $BACKEND_URL and $FRONTEND_URL..."
    ./phoenix-ci/scripts/smoke.sh "$BACKEND_URL" "$FRONTEND_URL" "$VERSION"
    ;;

  *)
    echo "Usage: ./deploy.sh [docker | seed | smoke]"
    echo "  docker        - Build and launch the containerized stack"
    echo "  seed          - Seed the database (Atlas or local) with demo accounts"
    echo "  smoke <urls>  - Execute end-to-end smoke verification"
    exit 1
    ;;
esac

