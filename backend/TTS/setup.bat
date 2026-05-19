@echo off
REM Setup script for TTS API with OpenVINO (Windows batch version)
REM This script creates a virtual environment, installs dependencies,
REM downloads Supertonic-3 repo, and converts ONNX models to OpenVINO format using uv

setlocal enabledelayedexpansion

SET SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

echo ==========================================
echo TTS API Setup Script (using uv)
echo ==========================================
echo Working directory: %SCRIPT_DIR%
echo.

REM Configuration
SET VENV_DIR=%SCRIPT_DIR%.venv
SET REPO_DIR=%SCRIPT_DIR%supertonic-3
SET REPO_URL=https://huggingface.co/Supertone/supertonic-3
if not defined MODEL_PRECISION set MODEL_PRECISION=fp16
if not defined DEVICE set DEVICE=CPU

SET OV_MODEL_DIR=%SCRIPT_DIR%ov_model_%MODEL_PRECISION%

echo Configuration:
echo   Virtual environment: %VENV_DIR%
echo   Repository: %REPO_DIR%
echo   Model precision: %MODEL_PRECISION%
echo   Target device: %DEVICE%
echo   Output models: %OV_MODEL_DIR%
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

REM Step 2: Install dependencies and sync with uv
echo ------------------------------------------
echo Step 2: Installing dependencies with uv
echo ------------------------------------------
echo Syncing dependencies from pyproject.toml...
uv pip install -r requirements.txt --python "%VENV_DIR%\Scripts\python.exe"

echo Dependencies installed successfully
echo.

REM Step 3: Download Supertonic-3 repository
echo ------------------------------------------
echo Step 3: Downloading Supertonic-3 Repository
echo ------------------------------------------

if exist "%REPO_DIR%" (
    echo Repository already exists at %REPO_DIR%
    set /p response="Do you want to re-download it? (y/N): "
    if /i "!response!"=="y" (
        echo Removing existing repository...
        rmdir /s /q "%REPO_DIR%"
        goto :clone_repo
    ) else (
        echo Using existing repository
        goto :skip_clone
    )
)

:clone_repo
echo Cloning repository from %REPO_URL%...
echo This may take several minutes...
echo.
git clone %REPO_URL% "%REPO_DIR%"
if errorlevel 1 (
    echo ERROR: Failed to clone repository
    echo Make sure git is installed and you have internet connection
    exit /b 1
)
echo Repository cloned successfully
echo.

:skip_clone

REM Verify ONNX models exist
SET ONNX_DIR=%REPO_DIR%\onnx
if not exist "%ONNX_DIR%" (
    echo ERROR: ONNX models directory not found at %ONNX_DIR%
    echo The repository may not have been cloned correctly
    exit /b 1
)

REM Step 4: Convert ONNX models to OpenVINO format
echo ------------------------------------------
echo Step 4: Converting ONNX to OpenVINO format
echo ------------------------------------------

if exist "%OV_MODEL_DIR%\vocoder.xml" (
    echo OpenVINO models already exist at %OV_MODEL_DIR%
    set /p response="Do you want to reconvert them? (y/N): "
    if /i not "!response!"=="y" (
        echo Using existing OpenVINO models
        goto :skip_conversion
    )
    echo Removing existing OpenVINO models...
    rmdir /s /q "%OV_MODEL_DIR%"
)

echo Converting ONNX models to OpenVINO format...
echo Input: %ONNX_DIR%
echo Output: %OV_MODEL_DIR%
echo Precision: %MODEL_PRECISION%
echo Device: %DEVICE%
echo.

REM Activate venv to run Python script
call "%VENV_DIR%\Scripts\activate.bat"

python convert_to_openvino.py ^
    --repo-dir "%REPO_DIR%" ^
    --input-dir "%ONNX_DIR%" ^
    --output-dir "%OV_MODEL_DIR%" ^
    --precision %MODEL_PRECISION% ^
    --device %DEVICE%

if errorlevel 1 (
    echo.
    echo ERROR: Model conversion failed
    echo Make sure openvino-dev is installed
    exit /b 1
)

echo.
echo Model conversion completed successfully
echo.

:skip_conversion

REM Step 5: Verify installation
echo ------------------------------------------
echo Step 5: Verifying installation
echo ------------------------------------------

echo Checking installed packages...
SET /A PACKAGES_FOUND=0
SET /A PACKAGES_TOTAL=5

for %%p in (fastapi uvicorn openvino openvino-dev soundfile) do (
    uv pip show %%p --python "%VENV_DIR%\Scripts\python.exe" >nul 2>&1
    if errorlevel 1 (
        echo   x %%p (not installed)
    ) else (
        echo   + %%p (installed)
        SET /A PACKAGES_FOUND+=1
    )
)

echo.
echo Packages found: !PACKAGES_FOUND! / !PACKAGES_TOTAL!
echo.

REM Verify OpenVINO models
echo Checking OpenVINO model files...
SET /A MODELS_FOUND=0
SET /A MODELS_TOTAL=4

for %%m in (duration_predictor.xml text_encoder.xml vector_estimator.xml vocoder.xml) do (
    if exist "%OV_MODEL_DIR%\%%m" (
        echo   + %%m
        SET /A MODELS_FOUND+=1
    ) else (
        echo   x %%m (missing)
    )
)

echo.
echo Models found: !MODELS_FOUND! / !MODELS_TOTAL!

if !MODELS_FOUND! LSS !MODELS_TOTAL! (
    echo ERROR: Some models are missing
    echo Please rerun setup and allow model conversion
    exit /b 1
)

echo.
echo All models verified successfully
echo.

REM Verify voice styles
SET VOICE_STYLES_DIR=%REPO_DIR%\voice_styles
if exist "%VOICE_STYLES_DIR%" (
    dir /b "%VOICE_STYLES_DIR%\*.json" 2>nul | find /c /v "" > temp_count.txt
    set /p VOICE_COUNT=<temp_count.txt
    del temp_count.txt
    echo   + Voice styles directory found (!VOICE_COUNT! voices)
) else (
    echo   ! Voice styles directory not found
)

echo.
echo ==========================================
echo Setup completed successfully!
echo ==========================================
echo.
echo Next steps:
echo   1. Review the configuration in start_server.bat
echo   2. Start the server with: start_server.bat
echo   3. Test the API at http://localhost:8000
echo.
echo Paths:
echo   Virtual environment: %VENV_DIR%
echo   OpenVINO models: %OV_MODEL_DIR%
echo   Repository: %REPO_DIR%
echo   Voice styles: %VOICE_STYLES_DIR%
echo.
echo To update dependencies in the future:
echo   uv sync
echo.
echo To reconvert models with different precision:
echo   set MODEL_PRECISION=fp32
echo   setup.bat
echo.

pause
