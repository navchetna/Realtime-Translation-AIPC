@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

where uv >nul 2>nul
if errorlevel 1 (
    echo [ERROR] uv is not installed. Install it first with: pip install uv
    exit /b 1
)

where git >nul 2>nul
if errorlevel 1 (
    echo [ERROR] git is not installed or not on PATH.
    exit /b 1
)

echo [1/4] Creating virtual environment with Python 3.10...
call uv venv --python 3.10
if errorlevel 1 exit /b 1

echo [2/4] Installing dependencies...
call uv pip install --python .venv torch==2.8.0 torchaudio==2.8.0 --torch-backend=cpu
if errorlevel 1 exit /b 1

call uv pip install --python .venv -r requirements.txt
if errorlevel 1 exit /b 1

set "TARGET_DIR=%SCRIPT_DIR%Fastspeech2_HS"

echo [3/4] Downloading model repository...
if exist "%TARGET_DIR%\.git" (
    echo [INFO] Fastspeech2_HS already exists. Skipping clone.
) else (
    if exist "%TARGET_DIR%" (
        echo [ERROR] %TARGET_DIR% exists but is not a git repository.
        echo [ERROR] Remove or rename it, then run setup again.
        exit /b 1
    )

    call git clone https://huggingface.co/smtiitm/FastSpeech2_HS_latest_models Fastspeech2_HS
    if errorlevel 1 exit /b 1
)

echo [4/4] Copying local integration files into Fastspeech2_HS...
copy /Y "%SCRIPT_DIR%utilities.py" "%TARGET_DIR%\" >nul
if errorlevel 1 exit /b 1
copy /Y "%SCRIPT_DIR%main_ov.py" "%TARGET_DIR%\" >nul
if errorlevel 1 exit /b 1
copy /Y "%SCRIPT_DIR%start_server.bat" "%TARGET_DIR%\" >nul
if errorlevel 1 exit /b 1
copy /Y "%SCRIPT_DIR%server.py" "%TARGET_DIR%\" >nul
if errorlevel 1 exit /b 1
copy /Y "%SCRIPT_DIR%test_tts.py" "%TARGET_DIR%\" >nul
if errorlevel 1 exit /b 1

echo.
echo Setup complete.
echo Activate the environment with: .venv\Scripts\activate
echo Then go to: Fastspeech2_HS

endlocal