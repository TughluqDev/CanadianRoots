$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host '==> Creating Python virtual environment (backend/.venv)'
if (-not (Test-Path backend/.venv)) { python -m venv backend/.venv }
backend/.venv/Scripts/python -m pip install --upgrade pip | Out-Null
backend/.venv/Scripts/pip install -r backend/requirements.txt

Write-Host '==> Caching openly licensed destination photos (optional; needs internet)'
try { backend/.venv/Scripts/python scripts/fetch_images.py } catch { Write-Warning 'Image download skipped; the app will use remote images or illustrated fallbacks.' }

Write-Host '==> Initializing and seeding SQLite'
backend/.venv/Scripts/python scripts/seed_database.py

Write-Host '==> Installing frontend dependencies'
Set-Location frontend
npm install
Set-Location $root
Write-Host "`nDone. Start the app with: ./scripts/dev.ps1"
