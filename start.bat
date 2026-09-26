@echo off
title Track IT - Launcher
echo ===================================================
echo            Track IT Launcher         
echo ===================================================
echo.

:: 1. Check if Node.js is installed
echo [1/4] Checking Node.js installation...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org/ and try again.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VERSION=%%v
echo Node.js version: %NODE_VERSION%

:: 2. Check if npm is installed
echo.
echo [2/4] Checking npm installation...
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm is not installed or not in PATH.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('npm -v') do set NPM_VERSION=%%v
echo npm version: v%NPM_VERSION%

:: 3. Check dependencies and install
echo.
echo [3/4] Checking project dependencies...
if not exist "node_modules\" (
    echo node_modules folder not found. Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed. Please check errors above.
        pause
        exit /b 1
    )
) else (
    echo node_modules found. Ensuring all dependencies are installed...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed. Please check errors above.
        pause
        exit /b 1
    )
)

:: 4. Launch Application and Open Browser
echo.
echo [4/4] Starting development server & opening browser...
echo.
echo Opening AgroWeather AI at http://localhost:5173 ...
echo Press Ctrl+C to stop the server.
echo ===================================================
echo.

:: Launch default browser after 3 seconds in a background process
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:5173"

:: Run frontend dev server
call npm run dev

pause
