@echo off
REM Start script for Whisper ASR API Server (Windows batch version)

SET SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

echo ==========================================
echo Starting Whisper ASR API Server
echo ==========================================
echo.

REM Configuration - Modify these as needed
if not defined HOST set HOST=0.0.0.0
if not defined PORT set PORT=8001
if not defined ASR_DEVICE set ASR_DEVICE=GPU
if not defined ASR_MODEL_NAME set ASR_MODEL_NAME=%SCRIPT_DIR%distil_whisper_large
if not defined LOG_IO set LOG_IO=1

SET VENV_DIR=%SCRIPT_DIR%.venv

echo Configuration:
echo   Host: %HOST%
echo   Port: %PORT%
echo   Device: %ASR_DEVICE%
echo   Model: %ASR_MODEL_NAME%
echo   Log I/O: %LOG_IO%
echo.
echo Paths:
echo   Virtual environment: %VENV_DIR%
echo.

REM Verify virtual environment exists
if not exist "%VENV_DIR%" (
    echo ERROR: Virtual environment not found at %VENV_DIR%
    echo Please run setup.sh first
    exit /b 1
)

REM Activate virtual environment
echo Activating virtual environment...
call "%VENV_DIR%\Scripts\activate.bat"

echo ==========================================
echo Starting FastAPI server...
echo ==========================================
echo.

REM Start the server
python server.py
