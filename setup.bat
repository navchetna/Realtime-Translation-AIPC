@echo off
setlocal EnableDelayedExpansion

echo ===========================================================
echo  Realtime Translation Demo - Full Setup Script
echo ===========================================================
echo.

REM ─── Pre-flight checks ───────────────────────────────────────
where uv >nul 2>&1
if errorlevel 1 (
    echo [ERROR] 'uv' not found. Install it from https://github.com/astral-sh/uv
    exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] 'node' not found. Install Node.js 18+ from https://nodejs.org/
    exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] 'npm' not found. Install Node.js 18+ from https://nodejs.org/
    exit /b 1
)

if "%HF_TOKEN%"=="" (
    echo [ERROR] HF_TOKEN environment variable is not set.
    echo         Run:  set HF_TOKEN=your_huggingface_token
    echo         Then re-run this script.
    exit /b 1
)

set ROOT=%~dp0
set STT_DIR=%ROOT%backend\STT
set NMT_DIR=%ROOT%backend\NMT
set FE_DIR=%ROOT%frontend

echo [INFO] Root directory : %ROOT%
echo [INFO] HF_TOKEN       : (set)
echo.

REM ═══════════════════════════════════════════════════════════
REM  SECTION 1 — STT (IndicConformer ASR)
REM ═══════════════════════════════════════════════════════════
echo -----------------------------------------------------------
echo  [1/3] Setting up STT (IndicConformer ASR)
echo -----------------------------------------------------------

cd /d "%STT_DIR%"

echo [STT] Creating Python 3.10 virtual environment...
uv venv --python=3.10 .venv
if errorlevel 1 ( echo [ERROR] uv venv failed for STT & exit /b 1 )

echo [STT] Installing dependencies...
call .venv\Scripts\activate
uv pip install -r requirements.txt
if errorlevel 1 ( echo [ERROR] pip install failed for STT & exit /b 1 )

echo [STT] Downloading IndicConformer model from HuggingFace...
python download_all.py
if errorlevel 1 (
    echo [WARN] download_all.py failed. Trying hf CLI fallback...
    where hf >nul 2>&1
    if not errorlevel 1 (
        hf download ai4bharat/indic-conformer-600m-multilingual --local-dir conformer_model
        if errorlevel 1 ( echo [ERROR] hf download failed for STT & exit /b 1 )
    ) else (
        echo [ERROR] Neither download_all.py nor hf CLI succeeded.
        exit /b 1
    )
)

echo [STT] Converting ONNX models to OpenVINO FP16...
python convert_to_openvino_fp16.py
if errorlevel 1 ( echo [ERROR] OpenVINO conversion failed for STT & exit /b 1 )

call deactivate
echo [STT] Done.
echo.

REM ═══════════════════════════════════════════════════════════
REM  SECTION 2 — NMT (IndicTrans2)
REM ═══════════════════════════════════════════════════════════
echo -----------------------------------------------------------
echo  [2/3] Setting up NMT (IndicTrans2)
echo -----------------------------------------------------------

cd /d "%NMT_DIR%"

echo [NMT] Creating Python 3.12 virtual environment...
uv venv --python=3.12 .venv
if errorlevel 1 ( echo [ERROR] uv venv failed for NMT & exit /b 1 )

echo [NMT] Installing PyTorch (CPU build)...
call .venv\Scripts\activate
uv pip install torch==2.10.0 --index-url https://download.pytorch.org/whl/cpu
if errorlevel 1 ( echo [ERROR] torch install failed for NMT & exit /b 1 )

echo [NMT] Installing remaining dependencies...
uv pip install -r requirements.txt
if errorlevel 1 ( echo [ERROR] pip install failed for NMT & exit /b 1 )

echo [NMT] Installing IndicTransToolkit...
uv pip install indictranstoolkit
if errorlevel 1 ( echo [ERROR] indictranstoolkit install failed & exit /b 1 )

echo [NMT] Converting Indic->Indic model to OpenVINO FP16...
python convert_indictrans2_ov.py ^
    --model-name ai4bharat/indictrans2-indic-indic-1B ^
    --output-dir ./openvino_models/indictrans2-indic-indic-1B-fp16/optimum ^
    --device GPU ^
    --precision FP16
if errorlevel 1 ( echo [ERROR] Indic->Indic conversion failed & exit /b 1 )

echo [NMT] Converting EN->Indic model to OpenVINO FP16...
python convert_indictrans2_ov.py ^
    --model-name ai4bharat/indictrans2-en-indic-1B ^
    --output-dir ./openvino_models/indictrans2-en-indic-1B-fp16/optimum ^
    --device GPU ^
    --precision FP16
if errorlevel 1 ( echo [ERROR] EN->Indic conversion failed & exit /b 1 )

call deactivate
echo [NMT] Done.
echo.

REM ═══════════════════════════════════════════════════════════
REM  SECTION 3 — Frontend (React + VAD assets)
REM ═══════════════════════════════════════════════════════════
echo -----------------------------------------------------------
echo  [3/3] Setting up Frontend
echo -----------------------------------------------------------

cd /d "%FE_DIR%"

echo [FE] Installing npm dependencies...
npm install
if errorlevel 1 ( echo [ERROR] npm install failed & exit /b 1 )

echo [FE] Copying VAD/ONNX assets to public/vad-assets...
npm run copy-vad-assets
if errorlevel 1 ( echo [ERROR] copy-vad-assets failed & exit /b 1 )

echo [FE] Building frontend bundle...
npm run build
if errorlevel 1 ( echo [ERROR] Frontend build failed & exit /b 1 )

echo [FE] Done.
echo.

REM ═══════════════════════════════════════════════════════════
echo ===========================================================
echo  Setup complete!
echo ===========================================================
echo.
echo  To start the application:
echo.
echo    STT server  :  cd backend\STT  ^&^&  start_server.bat
echo    NMT Indic   :  cd backend\NMT  ^&^&  start_server_indic_indic.bat
echo    NMT EN      :  cd backend\NMT  ^&^&  start_server_en_indic.bat
echo    Frontend    :  cd frontend     ^&^&  npm run dev
echo.
echo  Then open http://localhost:5173 in your browser.
echo ===========================================================
echo.
pause
