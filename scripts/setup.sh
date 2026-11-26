#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Creating Python virtual environment (backend/.venv)"
[ -d backend/.venv ] || python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install --upgrade pip >/dev/null
backend/.venv/bin/pip install -r backend/requirements.txt

echo "==> Caching openly licensed destination photos (optional; needs internet)"
backend/.venv/bin/python scripts/fetch_images.py || echo "Image download skipped; fallbacks will be used."

echo "==> Initializing and seeding SQLite"
backend/.venv/bin/python scripts/seed_database.py

echo "==> Installing frontend dependencies"
(cd frontend && npm install)
echo
echo "Done. Start the app with: ./scripts/dev.sh"
