@echo off
REM Start script for LLM API Server (Windows)
setlocal enabledelayedexpansion
REM Start script for TTS API Server (Windows batch version)

SET SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

echo ==========================================
echo Starting TTS API Server
echo ==========================================
echo.

REM Configuration - Environment Variables
REM Override these before running to customize

REM Server settings
if not defined HOST set HOST=0.0.0.0
if not defined PORT set PORT=8000

REM Backend selection: onnx or openvino
if not defined BACKEND set BACKEND=openvino

REM Device settings
if not defined DEVICE set DEVICE=GPU
if not defined PRECISION set PRECISION=fp32

REM Model paths
if not defined MODEL_PRECISION set MODEL_PRECISION=fp16
if "%BACKEND%"=="onnx" (
    if not defined MODEL_DIR set MODEL_DIR=%SCRIPT_DIR%supertonic-3\onnx
) else (
    if not defined MODEL_DIR set MODEL_DIR=%SCRIPT_DIR%ov_model_%MODEL_PRECISION%
)
if not defined CONFIG_DIR set CONFIG_DIR=%SCRIPT_DIR%supertonic-3\onnx
if not defined VOICE_STYLES_DIR set VOICE_STYLES_DIR=%SCRIPT_DIR%supertonic-3\voice_styles

REM Inference settings
if not defined DIFFUSION_STEPS set DIFFUSION_STEPS=8
if not defined DEFAULT_VOICE set DEFAULT_VOICE=alloy
if not defined DEFAULT_LANGUAGE set DEFAULT_LANGUAGE=en

SET VENV_DIR=%SCRIPT_DIR%.venv

echo Configuration:
echo   Backend: %BACKEND%
echo   Host: %HOST%
echo   Port: %PORT%
echo   Device: %DEVICE%
echo   Precision: %PRECISION%
echo   Diffusion steps: %DIFFUSION_STEPS%
echo   Default voice: %DEFAULT_VOICE%
echo   Default language: %DEFAULT_LANGUAGE%
echo.
echo Paths:
echo   Virtual environment: %VENV_DIR%
echo   Model directory: %MODEL_DIR%
echo   Config directory: %CONFIG_DIR%
echo   Voice styles: %VOICE_STYLES_DIR%
echo.

REM Verify virtual environment exists
if not exist "%VENV_DIR%" (
    echo ERROR: Virtual environment not found at %VENV_DIR%
    echo Please run setup.bat first
    exit /b 1
)

REM Activate virtual environment
echo Activating virtual environment...
call "%VENV_DIR%\Scripts\activate.bat"
if errorlevel 1 (
    echo ERROR: Could not activate virtual environment
    exit /b 1
)

REM Verify model directory exists
if not exist "%MODEL_DIR%" (
    echo ERROR: Model directory not found at %MODEL_DIR%
    echo.
    echo Available model directories:
    dir /b /ad ov_model_* 2>nul
    echo.
    echo Please run setup.bat first or set MODEL_DIR environment variable
    exit /b 1
)

REM Verify config directory exists
if not exist "%CONFIG_DIR%" (
    echo ERROR: Config directory not found at %CONFIG_DIR%
    echo Please run setup.bat first to download supertonic-3 repository
    exit /b 1
)

REM Verify voice styles directory exists
if not exist "%VOICE_STYLES_DIR%" (
    echo WARNING: Voice styles directory not found at %VOICE_STYLES_DIR%
    echo TTS may not work without voice styles
)

REM Verify model files exist based on backend
if "%BACKEND%"=="onnx" (
    echo Checking ONNX models...
    SET /A MODELS_FOUND=0
    for %%m in (duration_predictor.onnx text_encoder.onnx vector_estimator.onnx vocoder.onnx) do (
        if exist "%MODEL_DIR%\%%m" (
            SET /A MODELS_FOUND+=1
        )
    )

    if !MODELS_FOUND! LSS 4 (
        echo ERROR: Missing ONNX model files in %MODEL_DIR%
        echo Found: !MODELS_FOUND! / 4
        echo Please run setup.bat to download models
        exit /b 1
    )
    echo   All 4 ONNX models verified
) else (
    echo Checking OpenVINO models...
    SET /A MODELS_FOUND=0
    for %%m in (duration_predictor.xml text_encoder.xml vector_estimator.xml vocoder.xml) do (
        if exist "%MODEL_DIR%\%%m" (
            SET /A MODELS_FOUND+=1
        )
    )

    if !MODELS_FOUND! LSS 4 (
        echo ERROR: Missing OpenVINO model files in %MODEL_DIR%
        echo Found: !MODELS_FOUND! / 4
        echo Please run setup.bat to convert ONNX models
        exit /b 1
    )
    echo   All 4 OpenVINO models verified
)
echo.

echo ==========================================
echo Starting FastAPI server...
echo ==========================================
echo.
echo Press Ctrl+C to stop the server
echo.

REM Start the server
python api_server.py
