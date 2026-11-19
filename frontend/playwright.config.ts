import { defineConfig, devices } from '@playwright/test'

// End-to-end tests drive the real UI against the real FastAPI backend and seeded SQLite DB.
// Start both servers first (see README) or let Playwright start them.
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure' },
  webServer: [
    {
      command: process.platform === 'win32'
        ? '..\\backend\\.venv\\Scripts\\python -m uvicorn app.main:app --port 8000 --app-dir ../backend'
        : '../backend/.venv/bin/python -m uvicorn app.main:app --port 8000 --app-dir ../backend',
      url: 'http://127.0.0.1:8000/api/health',
      reuseExistingServer: true,
    },
    { command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: true },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
