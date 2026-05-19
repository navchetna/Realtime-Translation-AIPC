@echo off
REM Start All Services - Voice-to-Voice Translation System
REM This script starts ASR, TTS, and Frontend services

SET ROOT_DIR=%~dp0
cd /d "%ROOT_DIR%"

echo ==========================================
echo Voice-to-Voice Translation System
echo Starting All Services...
echo ==========================================
echo.

REM Function to check if port is in use
netstat -ano | findstr ":8001" >nul 2>&1
if %errorlevel%==0 (
    echo WARNING: Port 8001 already in use ^(ASR Service^)
)

netstat -ano | findstr ":8000" >nul 2>&1
if %errorlevel%==0 (
    echo WARNING: Port 8000 already in use ^(TTS Service^)
)

netstat -ano | findstr ":3000" >nul 2>&1
if %errorlevel%==0 (
    echo WARNING: Port 3000 already in use ^(Frontend^)
)

echo.

REM Check if virtual environments exist
if not exist "backend\ASR\venv" (
    echo ERROR: ASR virtual environment not found
    echo Please run: cd backend\ASR ^&^& setup.bat
    pause
    exit /b 1
)

if not exist "backend\TTS\venv" (
    echo ERROR: TTS virtual environment not found
    echo Please run: cd backend\TTS ^&^& setup.bat
    pause
    exit /b 1
)

if not exist "frontend-vad\node_modules" (
    echo ERROR: Frontend dependencies not installed
    echo Please run: cd frontend-vad ^&^& npm install
    pause
    exit /b 1
)

REM Start ASR Service
echo [1/3] Starting ASR Service ^(Port 8001^)...
start "ASR Service" cmd /c "cd /d %ROOT_DIR%backend\ASR && start_server.bat"
timeout /t 2 /nobreak >nul

REM Start TTS Service
echo [2/3] Starting TTS Service ^(Port 8000^)...
start "TTS Service" cmd /c "cd /d %ROOT_DIR%backend\TTS && start_server.bat"
timeout /t 2 /nobreak >nul

REM Start Frontend
echo [3/3] Starting Frontend ^(Port 3000^)...
start "Frontend" cmd /c "cd /d %ROOT_DIR%frontend-vad && npm run dev"
timeout /t 2 /nobreak >nul

echo.
echo ==========================================
echo All Services Started!
echo ==========================================
echo.
echo Services:
echo   ASR:      http://localhost:8001
echo   TTS:      http://localhost:8000
echo   Frontend: http://localhost:3000
echo.
echo Note: Services are running in separate windows
echo       Close the windows to stop individual services
echo.

REM Wait and open browser
echo Opening frontend in 5 seconds...
timeout /t 5 /nobreak >nul
start http://localhost:3000

echo.
echo Press any key to exit this window...
pause >nul
