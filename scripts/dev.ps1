# Start the FastAPI backend (port 8000) and Vite frontend (port 5173) on Windows.
$root = Split-Path -Parent $PSScriptRoot
$backend = Start-Process -PassThru -NoNewWindow -WorkingDirectory "$root/backend" `
  -FilePath "$root/backend/.venv/Scripts/python.exe" -ArgumentList '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'
Write-Host 'Backend:  http://127.0.0.1:8000/api/health  (docs at /docs)'
Write-Host 'Frontend: http://localhost:5173'
try {
  Set-Location "$root/frontend"
  npm run dev
} finally {
  Stop-Process -Id $backend.Id -ErrorAction SilentlyContinue
}
