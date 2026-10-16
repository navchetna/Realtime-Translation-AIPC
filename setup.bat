@echo off
REM ============================================================================
REM  Realtime Translation Demo - Centralized Setup Script
REM  Sets up ASR (Whisper), LLM (Ollama), TTS (Supertonic) and the frontend.
REM ============================================================================

setlocal enabledelayedexpansion

SET ROOT_DIR=%~dp0
cd /d "%ROOT_DIR%"

echo ================================================================================
echo Realtime Translation Demo - Complete Setup
echo ================================================================================
echo.
echo Components:
echo   1. ASR      - Whisper speech recognition  (backend\ASR)
echo   2. LLM      - Ollama translation           (backend\LLM)
echo   3. TTS      - Supertonic text-to-speech    (backend\TTS)
echo   4. Frontend - Web UI                       (frontend)
echo ================================================================================
echo.

set "SELECTION="
set /p "SELECTION=Enter components to set up as comma-separated numbers (e.g. 1,3), or press Enter for all: "
if "%SELECTION%"=="" set "SELECTION=1,2,3,4"

set DO_ASR=0
set DO_LLM=0
set DO_TTS=0
set DO_FE=0

for %%i in (%SELECTION:,= %) do (
    if "%%i"=="1" (
        set DO_ASR=1
    ) else if "%%i"=="2" (
        set DO_LLM=1
    ) else if "%%i"=="3" (
        set DO_TTS=1
    ) else if "%%i"=="4" (
        set DO_FE=1
    ) else (
        echo ERROR: Invalid selection '%%i'. Valid options are 1, 2, 3, 4.
        exit /b 1
    )
)

if %DO_ASR%==0 if %DO_LLM%==0 if %DO_TTS%==0 if %DO_FE%==0 (
    echo ERROR: No valid components selected.
    exit /b 1
)

echo.
echo Will set up:
if %DO_ASR%==1 echo   - ASR
if %DO_LLM%==1 echo   - LLM
if %DO_TTS%==1 echo   - TTS
if %DO_FE%==1 echo   - Frontend
echo.
pause

SET /A TOTAL_STEPS=0
if %DO_ASR%==1 SET /A TOTAL_STEPS+=1
if %DO_LLM%==1 SET /A TOTAL_STEPS+=1
if %DO_TTS%==1 SET /A TOTAL_STEPS+=1
if %DO_FE%==1 SET /A TOTAL_STEPS+=1
SET /A CURRENT_STEP=0
SET /A FAILED_STEPS=0

REM ============================================================================
REM Step: ASR Setup
REM ============================================================================
if %DO_ASR%==1 (
    SET /A CURRENT_STEP+=1
    echo.
    echo ================================================================================
    echo [!CURRENT_STEP!/%TOTAL_STEPS%] Setting up ASR ^(Whisper^)
    echo ================================================================================
    echo.
    cd /d "%ROOT_DIR%backend\ASR"
    call setup.bat
    if errorlevel 1 (
        echo ERROR: ASR setup failed
        SET /A FAILED_STEPS+=1
    ) else (
        echo ASR setup completed successfully
    )
)

REM ============================================================================
REM Step: LLM Setup
REM ============================================================================
if %DO_LLM%==1 (
    SET /A CURRENT_STEP+=1
    echo.
    echo ================================================================================
    echo [!CURRENT_STEP!/%TOTAL_STEPS%] Setting up LLM ^(Ollama^)
    echo ================================================================================
    echo.
    cd /d "%ROOT_DIR%backend\LLM"
    call setup.bat
    if errorlevel 1 (
        echo ERROR: LLM setup failed
        SET /A FAILED_STEPS+=1
    ) else (
        echo LLM setup completed successfully
    )
)

REM ============================================================================
REM Step: TTS Setup
REM ============================================================================
if %DO_TTS%==1 (
    SET /A CURRENT_STEP+=1
    echo.
    echo ================================================================================
    echo [!CURRENT_STEP!/%TOTAL_STEPS%] Setting up TTS ^(Supertonic^)
    echo ================================================================================
    echo.
    cd /d "%ROOT_DIR%backend\TTS"
    call setup.bat
    if errorlevel 1 (
        echo ERROR: TTS setup failed
        SET /A FAILED_STEPS+=1
    ) else (
        echo TTS setup completed successfully
    )
)

REM ============================================================================
REM Step: Frontend Setup
REM ============================================================================
if %DO_FE%==1 (
    SET /A CURRENT_STEP+=1
    echo.
    echo ================================================================================
    echo [!CURRENT_STEP!/%TOTAL_STEPS%] Setting up Frontend
    echo ================================================================================
    echo.
    cd /d "%ROOT_DIR%frontend"

    where npm >nul 2>&1
    if errorlevel 1 (
        echo npm not found. Attempting to install Node.js...
        where winget >nul 2>&1
        if not errorlevel 1 (
            winget install --id=OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
            set "PATH=%PATH%;%ProgramFiles%\nodejs"
        )
        where npm >nul 2>&1
        if errorlevel 1 (
            echo WARNING: npm is still not available.
            echo          Install Node.js manually from https://nodejs.org/ then run:
            echo            cd frontend ^&^& npm install
            SET /A FAILED_STEPS+=1
            goto :summary
        )
    )

    echo Installing frontend dependencies...
    call npm install
    if errorlevel 1 (
        echo ERROR: npm install failed
        SET /A FAILED_STEPS+=1
    ) else (
        echo Frontend dependencies installed successfully
    )
)

:summary
cd /d "%ROOT_DIR%"

echo.
echo ================================================================================
echo Setup Summary
echo ================================================================================
echo.

if %FAILED_STEPS% EQU 0 (
    echo Status: ALL COMPONENTS SET UP SUCCESSFULLY
) else (
    SET /A SUCCESS_STEPS=%TOTAL_STEPS%-%FAILED_STEPS%
    echo Status: SETUP COMPLETED WITH %FAILED_STEPS% ERROR^(S^)
    echo !SUCCESS_STEPS! out of %TOTAL_STEPS% components were set up successfully.
)
echo.

if exist "backend\ASR\distil_whisper_large\openvino_encoder_model.xml" (echo [X] ASR      - Ready) else (echo [ ] ASR      - Not installed)
where ollama >nul 2>&1
if not errorlevel 1 (echo [X] LLM      - Ollama installed) else (echo [ ] LLM      - Not installed)
if exist "backend\TTS\ov_model_fp16\vocoder.xml" (echo [X] TTS      - Ready) else if exist "backend\TTS\ov_model_fp32\vocoder.xml" (echo [X] TTS      - Ready) else (echo [ ] TTS      - Not installed)
if exist "frontend\node_modules\" (echo [X] Frontend - Ready) else (echo [ ] Frontend - Not installed)

echo.
echo ================================================================================
echo Next Steps
echo ================================================================================
echo.
echo Start each service in its own terminal:
echo.
echo   ASR:      cd backend\ASR ^&^& start_server.bat
echo   TTS:      cd backend\TTS ^&^& start_server.bat
echo   Frontend: cd frontend    ^&^& npm run dev
echo.
echo Ollama runs as a background service after installation.
echo Then open http://localhost:3000 in your browser.
echo.

pause
