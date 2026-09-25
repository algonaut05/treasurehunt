@echo off
setlocal
cd /d "%~dp0"

if not exist ".env.local" (
  echo Missing .env.local. Create it from .env.example and add the Firebase settings.
  pause
  exit /b 1
)

if not exist "node_modules\.bin\vite.cmd" (
  echo Dependencies are missing. Run npm install in this folder first.
  pause
  exit /b 1
)

powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if errorlevel 1 (
  echo Starting ENGQUEST API on port 3001...
  start "ENGQUEST API" /D "%~dp0" cmd /k npm run server
) else (
  echo ENGQUEST API is already running on port 3001.
)

powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if errorlevel 1 (
  echo Starting ENGQUEST site on port 5173...
  start "ENGQUEST Site" /D "%~dp0" cmd /k npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
) else (
  echo ENGQUEST site is already running on port 5173.
)

timeout /t 3 /nobreak >nul
start "" "http://127.0.0.1:5173"
endlocal
