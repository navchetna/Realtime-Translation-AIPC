@echo off
set PYTHONUTF8=1
set ASR_DEVICE=CPU
set ASR_MODEL_DIR=openvino_models
set ASR_CONFIG_PATH=conformer_model
call .venv\Scripts\activate
uvicorn server:app --host 0.0.0.0 --port 8002
pause
