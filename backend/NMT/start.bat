@echo off
setlocal EnableDelayedExpansion

set PYTHONUTF8=1
set NMT_DEVICE=GPU
set NMT_MODEL_DIR=./openvino_models/indictrans2-indic-indic-1B-fp16/optimum/optimum

for /f "delims=" %%i in ('findstr /c:"HF_TOKEN=" "..\..\..\.env"') do set "%%i"

call .venv\Scripts\activate
uvicorn server_indic_indic:app --host 0.0.0.0 --port 8004 --timeout-graceful-shutdown 10
