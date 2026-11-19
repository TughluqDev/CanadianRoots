#!/usr/bin/env bash
# Start the FastAPI backend (port 8000) and Vite frontend (port 5173) on macOS/Linux.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
(cd "$ROOT/backend" && .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000) &
BACKEND_PID=$!
trap 'kill $BACKEND_PID 2>/dev/null || true' EXIT
echo "Backend:  http://127.0.0.1:8000/api/health  (docs at /docs)"
echo "Frontend: http://localhost:5173"
cd "$ROOT/frontend" && npm run dev
