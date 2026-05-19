@echo off
REM Central Setup Script for Voice-to-Voice Services
REM Sets up Frontend, ASR, TTS, and LLM services

setlocal enabledelayedexpansion

SET ROOT_DIR=%~dp0
cd /d "%ROOT_DIR%"

echo ================================================================================
echo Voice-to-Voice - Complete System Setup
echo ================================================================================
echo.
echo This script will set up all services:
echo   1. Frontend (React/Next.js)
echo   2. ASR (Automatic Speech Recognition)
echo   3. TTS (Text-to-Speech)
echo   4. LLM (Large Language Model)
echo.
echo Estimated time: 15-30 minutes (depending on internet speed)
echo ================================================================================
echo.
pause

SET /A TOTAL_STEPS=4
SET /A CURRENT_STEP=0
SET /A FAILED_STEPS=0

REM ============================================================================
REM Step 1: Frontend Setup
REM ============================================================================
SET /A CURRENT_STEP+=1
echo.
echo ================================================================================
echo [%CURRENT_STEP%/%TOTAL_STEPS%] Setting up Frontend
echo ================================================================================
echo.

cd "%ROOT_DIR%frontend"

REM Check if Node.js is installed
echo Checking Node.js installation...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed
    echo Please install Node.js from https://nodejs.org/
    echo.
    SET /A FAILED_STEPS+=1
    goto :step2
)

node --version
npm --version
echo.

REM Install dependencies
echo Installing frontend dependencies...
call npm install
if errorlevel 1 (
    echo ERROR: Failed to install frontend dependencies
    SET /A FAILED_STEPS+=1
    goto :step2
)
echo Frontend dependencies installed successfully
echo.

REM Build frontend
echo Building frontend...
call npm run build
if errorlevel 1 (
    echo WARNING: Frontend build failed
    echo You can try building manually later with: cd frontend && npm run build
    REM Don't fail completely, continue with other services
) else (
    echo Frontend built successfully
)
echo.

:step2
REM ============================================================================
REM Step 2: ASR Setup
REM ============================================================================
SET /A CURRENT_STEP+=1
echo.
echo ================================================================================
echo [%CURRENT_STEP%/%TOTAL_STEPS%] Setting up ASR (Automatic Speech Recognition)
echo ================================================================================
echo.

cd "%ROOT_DIR%backend\ASR"

REM Check if setup.bat exists
if not exist "setup.bat" (
    echo WARNING: ASR setup.bat not found, skipping ASR setup
    SET /A FAILED_STEPS+=1
    goto :step3
)

REM Run ASR setup
echo Running ASR setup script...
call setup.bat
if errorlevel 1 (
    echo ERROR: ASR setup failed
    SET /A FAILED_STEPS+=1
) else (
    echo ASR setup completed successfully
)
echo.

:step3
REM ============================================================================
REM Step 3: TTS Setup
REM ============================================================================
SET /A CURRENT_STEP+=1
echo.
echo ================================================================================
echo [%CURRENT_STEP%/%TOTAL_STEPS%] Setting up TTS (Text-to-Speech)
echo ================================================================================
echo.

cd "%ROOT_DIR%backend\TTS"

REM Check if setup.bat exists
if not exist "setup.bat" (
    echo WARNING: TTS setup.bat not found, skipping TTS setup
    SET /A FAILED_STEPS+=1
    goto :step4
)

REM Run TTS setup
echo Running TTS setup script...
call setup.bat
if errorlevel 1 (
    echo ERROR: TTS setup failed
    SET /A FAILED_STEPS+=1
) else (
    echo TTS setup completed successfully
)
echo.

:step4
REM ============================================================================
REM Step 4: LLM Setup
REM ============================================================================
SET /A CURRENT_STEP+=1
echo.
echo ================================================================================
echo [%CURRENT_STEP%/%TOTAL_STEPS%] Setting up LLM (Large Language Model)
echo ================================================================================
echo.

cd "%ROOT_DIR%backend\LLM"

REM Check if setup.bat exists
if not exist "setup.bat" (
    echo WARNING: LLM setup.bat not found, skipping LLM setup
    SET /A FAILED_STEPS+=1
    goto :summary
)

REM Run LLM setup
echo Running LLM setup script...
call setup.bat
if errorlevel 1 (
    echo ERROR: LLM setup failed
    SET /A FAILED_STEPS+=1
) else (
    echo LLM setup completed successfully
)
echo.

:summary
REM ============================================================================
REM Setup Summary
REM ============================================================================
cd "%ROOT_DIR%"

echo.
echo ================================================================================
echo Setup Summary
echo ================================================================================
echo.

SET /A SUCCESS_STEPS=%TOTAL_STEPS%-%FAILED_STEPS%

if %FAILED_STEPS% EQU 0 (
    echo Status: ALL SERVICES SETUP SUCCESSFULLY
    echo.
    echo All components are ready to use!
) else (
    echo Status: SETUP COMPLETED WITH %FAILED_STEPS% ERROR(S)
    echo.
    echo %SUCCESS_STEPS% out of %TOTAL_STEPS% services were set up successfully.
    echo Please check the error messages above and try to fix the failed components.
)

echo.
echo ================================================================================
echo Installed Services
echo ================================================================================
echo.

REM Check each service
if exist "frontend\node_modules\" (
    echo [X] Frontend     - Ready
) else (
    echo [ ] Frontend     - Not installed
)

if exist "backend\ASR\.venv\" (
    echo [X] ASR          - Ready
) else (
    echo [ ] ASR          - Not installed
)

if exist "backend\TTS\.venv\" (
    echo [X] TTS          - Ready
) else (
    echo [ ] TTS          - Not installed
)

if exist "backend\LLM\.venv\" (
    echo [X] LLM          - Ready
) else (
    echo [ ] LLM          - Not installed
)

echo.
echo ================================================================================
echo Next Steps
echo ================================================================================
echo.
echo To start the services:
echo.
echo   Frontend:
echo     cd frontend
echo     npm run dev
echo.
echo   ASR Server:
echo     cd backend\ASR
echo     start_server.bat
echo.
echo   TTS Server:
echo     cd backend\TTS
echo     start_server.bat
echo.
echo   LLM Server:
echo     cd backend\LLM
echo     start_server.bat
echo.
echo Or use individual service directories to start each service.
echo.
echo ================================================================================
echo.

if %FAILED_STEPS% EQU 0 (
    echo Setup completed successfully!
) else (
    echo Setup completed with errors. Please review the logs above.
)

echo.
pause
