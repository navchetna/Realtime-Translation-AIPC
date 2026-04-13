@echo off
set PYTHONUTF8=1
set TTS_DTYPE=float32
set LANGUAGES=hindi,punjabi,tamil
uvicorn server:app --host 0.0.0.0 --port 5000
pause
