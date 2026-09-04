@echo off
setlocal EnableDelayedExpansion

echo ===========================================================
echo  Realtime Translation Demo - Starting All Services
echo ===========================================================
echo.

set ROOT=%~dp0
set STT_DIR=%ROOT%backend\STT
set NMT_DIR=%ROOT%backend\NMT
set FE_DIR=%ROOT%frontend

REM ─── Load HF_TOKEN from .env if present ─────────────────────
if exist "%ROOT%.env" (
    for /f "tokens=1,* delims==" %%a in ('findstr /B "HF_TOKEN=" "%ROOT%.env"') do (
        set HF_TOKEN=%%b
    )
)

REM ─── Start STT server (port 8002) ───────────────────────────
REM STT on CPU to keep GPU free for NMT
echo [1/3] Starting STT server on port 8002...
start "STT - port 8002" cmd /k "cd /d "%STT_DIR%" && start.bat"

REM ─── Start NMT Indic-Indic server (port 8004) ───────────────
echo [2/3] Starting NMT Indic-Indic server on port 8004...
start "NMT Indic-Indic - port 8004" cmd /k "cd /d "%NMT_DIR%" && start.bat"

REM ─── Start Frontend dev server (port 5173) ──────────────────
echo [3/3] Starting Frontend on port 5173...
start "Frontend - port 5173" cmd /k "cd /d "%FE_DIR%" && npm run dev"

echo.
echo ===========================================================
echo  All services starting in separate windows:
echo    STT server      : http://localhost:8002
echo    NMT Indic-Indic : http://localhost:8004
echo    Frontend        : http://localhost:5173
echo ===========================================================
echo.
echo Open http://localhost:5173 in your browser.
echo Close this window or press any key to exit.
pause >nul
