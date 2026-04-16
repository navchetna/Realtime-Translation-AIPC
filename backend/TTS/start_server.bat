@echo off
set PYTHONUTF8=1
set TTS_DTYPE=float16
set TTS_DEVICE=GPU
set LANGUAGES=hindi
uvicorn server:app --host 0.0.0.0 --port 5000
pause
