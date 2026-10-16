@echo off
REM Setup script for the LLM (translation) service.
REM Translation is handled by Ollama, running the model locally.

setlocal enabledelayedexpansion

SET SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

if not defined OLLAMA_MODEL set OLLAMA_MODEL=llama3.2

echo ==========================================
echo Ollama LLM Setup Script
echo ==========================================
echo Model: %OLLAMA_MODEL%
echo.

REM Step 1: Ensure Ollama is installed
echo ------------------------------------------
echo Step 1: Checking for Ollama
echo ------------------------------------------
where ollama >nul 2>&1
if errorlevel 1 (
    echo Ollama not found. Attempting to install it...
    where winget >nul 2>&1
    if not errorlevel 1 (
        winget install --id=Ollama.Ollama -e --accept-source-agreements --accept-package-agreements
    ) else (
        echo WARNING: winget is not available.
        echo          Please install Ollama manually from https://ollama.com/download
        exit /b 1
    )
    set "PATH=%PATH%;%LOCALAPPDATA%\Programs\Ollama"
    where ollama >nul 2>&1
    if errorlevel 1 (
        echo ERROR: Ollama installation could not be verified.
        echo        Open a new terminal after installation finishes and re-run this script.
        exit /b 1
    )
    echo Ollama installed successfully.
) else (
    echo Ollama is already installed.
)
echo.

REM Step 2: Make sure the Ollama service is reachable
echo ------------------------------------------
echo Step 2: Checking Ollama service
echo ------------------------------------------
curl -s -o nul -w "" http://localhost:11434/api/tags
if errorlevel 1 (
    echo Ollama service not responding, starting it...
    start "Ollama" ollama serve
) else (
    echo Ollama service is running.
)
echo.

REM Step 3: Pull the translation model
echo ------------------------------------------
echo Step 3: Pulling model %OLLAMA_MODEL%
echo ------------------------------------------
ollama pull %OLLAMA_MODEL%
if errorlevel 1 (
    echo ERROR: Failed to pull model %OLLAMA_MODEL%
    exit /b 1
)
echo.

echo ==========================================
echo Setup completed successfully!
echo ==========================================
echo.
echo Model installed: %OLLAMA_MODEL%
echo Ollama API: http://localhost:11434
echo.
echo To use a different model:
echo   set OLLAMA_MODEL=mistral
echo   setup.bat
echo Then update VITE_OLLAMA_MODEL in the frontend configuration.
echo.

pause
