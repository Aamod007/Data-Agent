@echo off
title Data Agents - Full Stack
echo.
echo ============================================
echo       Data Agents - Starting Services
echo ============================================
echo.

:: ── resolve project root to wherever this .bat lives ──
set "PROJECT_ROOT=%~dp0"
cd /d "%PROJECT_ROOT%"

:: ── load .env if it exists ──
if exist ".env" (
    echo [*] Loading .env ...
    for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
        set "%%A=%%B"
    )
)

:: ── check Python is available ──
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found on PATH. Please install Python 3.9+ and try again.
    pause
    exit /b 1
)

:: ── check Node.js is available ──
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found on PATH. Please install Node.js 18+ and try again.
    pause
    exit /b 1
)

echo.
echo [1/2] Starting FastAPI backend on http://127.0.0.1:8001 ...
echo.
start "Data Agents - Backend" cmd /k "cd /d "%PROJECT_ROOT%" && python -m uvicorn backend.main:app --host 127.0.0.1 --port 8001 --reload"

:: give the backend a moment to spin up before starting the frontend
timeout /t 3 /nobreak >nul

echo [2/2] Starting Next.js frontend on http://localhost:3000 ...
echo.
start "Data Agents - Frontend" cmd /k "cd /d "%PROJECT_ROOT%frontend" && npm run dev"

echo.
echo ============================================
echo   Both services are starting in new windows
echo ============================================
echo.
echo   Backend  : http://127.0.0.1:8001
echo   Frontend : http://localhost:3000
echo   Health   : http://127.0.0.1:8001/api/health
echo.
echo   Close the spawned windows to stop each service.
echo.
pause
