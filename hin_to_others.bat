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

REM ─── Write frontend .env.local for Hindi mode ───────────────
echo VITE_SOURCE_LANG=hi> "%FE_DIR%\.env.local"
echo VITE_NMT_API_URL=http://localhost:8004/services/inference/pipeline>> "%FE_DIR%\.env.local"

REM ─── Start STT server (port 8002) ───────────────────────────
REM STT on CPU to keep GPU free for NMT
echo [1/3] Starting STT server on port 8002...
start "STT - port 8002" cmd /k "cd /d "%STT_DIR%" && set PYTHONUTF8=1 && set ASR_DEVICE=CPU && set ASR_MODEL_DIR=openvino_models && set ASR_CONFIG_PATH=conformer_model && call .venv\Scripts\activate && uvicorn server:app --host 0.0.0.0 --port 8002"

REM ─── Start NMT server (port 8004) ───────────────────────────
echo [2/3] Starting NMT Indic-Indic server on port 8004...
start "NMT Indic-Indic - port 8004" cmd /k "cd /d "%NMT_DIR%" && set PYTHONUTF8=1 && set NMT_DEVICE=GPU && set NMT_MODEL_DIR=./openvino_models/indictrans2-indic-indic-1B-fp16/optimum/optimum && set HF_TOKEN=!HF_TOKEN! && call .venv\Scripts\activate && uvicorn server_indic_indic:app --host 0.0.0.0 --port 8004 --timeout-graceful-shutdown 10"

REM ─── Start Frontend dev server (port 5173) ──────────────────
echo [3/3] Starting Frontend on port 5173...
start "Frontend - port 5173" cmd /k "cd /d "%FE_DIR%" && npm run dev"

echo.
echo ===========================================================
echo  All services starting in separate windows:
echo    STT server      : http://localhost:8002
echo    NMT server      : http://localhost:8004
echo    Frontend        : http://localhost:5173
echo ===========================================================
echo.
echo Open http://localhost:5173 in your browser.
echo Close this window or press any key to exit.
pause >nul
