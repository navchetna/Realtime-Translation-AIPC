@echo off
REM Setup script for Whisper ASR with OpenVINO GenAI (Windows batch version)
REM This script creates a virtual environment, installs dependencies,
REM and downloads the Whisper model using uv

setlocal enabledelayedexpansion

SET SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

echo ==========================================
echo Whisper ASR Setup Script (using uv)
echo ==========================================
echo Working directory: %SCRIPT_DIR%
echo.

REM Configuration
SET VENV_DIR=%SCRIPT_DIR%.venv
if not defined MODEL_NAME set MODEL_NAME=OpenVINO/distil-whisper-large-v3-int4-ov
SET MODEL_DIR=%SCRIPT_DIR%distil_whisper_large

echo Configuration:
echo   Virtual environment: %VENV_DIR%
echo   Model: %MODEL_NAME%
echo   Model directory: %MODEL_DIR%
echo.

REM Step 1: Create virtual environment with uv
echo ------------------------------------------
echo Step 1: Creating virtual environment with uv
echo ------------------------------------------

if exist "%VENV_DIR%" (
    echo Virtual environment already exists at %VENV_DIR%
    set /p response="Do you want to recreate it? (y/N): "
    if /i "!response!"=="y" (
        echo Removing existing virtual environment...
        rmdir /s /q "%VENV_DIR%"
        echo Creating new virtual environment with uv...
        uv venv "%VENV_DIR%"
    )
) else (
    echo Creating virtual environment with uv at %VENV_DIR%...
    uv venv "%VENV_DIR%"
)
if errorlevel 1 (
    echo ERROR: Failed to create virtual environment with uv
    echo Make sure uv is installed: pip install uv
    exit /b 1
)
echo Virtual environment ready
echo.

REM Step 2: Install dependencies with uv
echo ------------------------------------------
echo Step 2: Installing dependencies with uv
echo ------------------------------------------
echo Installing requirements...
uv pip install -r requirements.txt --python "%VENV_DIR%\Scripts\python.exe"
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    exit /b 1
)
echo Dependencies installed successfully
echo.

REM Step 3: Download model (REQUIRED - OpenVINO GenAI needs local model files)
echo ------------------------------------------
echo Step 3: Downloading Whisper Model
echo ------------------------------------------
echo Model: %MODEL_NAME%
echo Target directory: %MODEL_DIR%
echo.

if exist "%MODEL_DIR%\openvino_encoder_model.xml" (
    echo Model already exists at %MODEL_DIR%
    set /p response="Do you want to re-download it? (y/N): "
    if /i not "!response!"=="y" (
        echo Using existing model
        goto :skip_model_download
    )
)

echo Downloading model from HuggingFace...
echo This may take a few minutes depending on your connection...
echo.

REM Install huggingface-hub if needed
uv pip install "huggingface_hub[cli]" --python "%VENV_DIR%\Scripts\python.exe"

REM Activate venv to use hf
call "%VENV_DIR%\Scripts\activate.bat"

REM Download the model
hf download %MODEL_NAME% --local-dir "%MODEL_DIR%"
if errorlevel 1 (
    echo ERROR: Model download failed
    echo Please check your internet connection and try again
    exit /b 1
)

echo Model downloaded successfully to %MODEL_DIR%
echo.

:skip_model_download

REM Step 4: Verify installation
echo ------------------------------------------
echo Step 4: Verifying installation
echo ------------------------------------------

echo Checking installed packages...
SET ALL_INSTALLED=1

for %%p in (fastapi uvicorn openvino openvino-genai soundfile numpy) do (
    uv pip show %%p --python "%VENV_DIR%\Scripts\python.exe" >nul 2>&1
    if errorlevel 1 (
        echo   x %%p (not installed)
        SET ALL_INSTALLED=0
    ) else (
        echo   + %%p (installed)
    )
)

if !ALL_INSTALLED!==0 (
    echo.
    echo ERROR: Some packages are missing
    exit /b 1
)

echo.
echo All required packages installed successfully
echo.

echo ==========================================
echo Setup completed successfully!
echo ==========================================
echo.
echo Next steps:
echo   1. Review the configuration in start_server.bat
echo   2. Start the server with: start_server.bat
echo   3. Test the API at http://localhost:8001
echo.
echo Environment location: %VENV_DIR%
echo Model location: %MODEL_DIR%
echo.
echo IMPORTANT: The start_server.bat will automatically use the downloaded model.
echo To use a different model, set ASR_MODEL_NAME environment variable before starting.
echo.
echo Available models:
echo   - OpenVINO/distil-whisper-large-v3-int4-ov (default, quantized, ~1GB)
echo   - openvino/whisper-base (~150MB)
echo   - openvino/whisper-small (~500MB)
echo   - openvino/whisper-medium (~1.5GB)
echo   - openvino/whisper-large (~3GB)
echo.

pause
