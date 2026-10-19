@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title Content Workbench Service

echo ==================================================
echo              Content Workbench Portable
echo ==================================================
echo.
echo IMPORTANT: Extract the whole ZIP before running.
echo Current folder: %CD%
echo.

if not exist "runtime\node.exe" (
  echo [START FAILED] runtime\node.exe was not found.
  echo Do not run this file inside the ZIP preview window.
  echo Right-click the ZIP, choose Extract All, then run this file again.
  pause
  exit /b 1
)

if not exist "app\index.html" (
  echo [START FAILED] app\index.html was not found.
  echo Please extract the complete ZIP again.
  pause
  exit /b 1
)

if not exist "config.env" (
  copy /y "config.env.example" "config.env" >nul
)

if exist ".content-workbench.pid" (
  set /p WORKBENCH_PID=<".content-workbench.pid"
  tasklist /FI "PID eq !WORKBENCH_PID!" 2>nul | find "!WORKBENCH_PID!" >nul
  if not errorlevel 1 (
    echo Content Workbench is already running. Opening the browser...
    start "" "http://127.0.0.1:4173/"
    exit /b 0
  )
)

echo Starting Content Workbench. Please wait...
echo The browser will open automatically after startup.
echo Keep this window open while using Content Workbench.
echo.
"runtime\node.exe" "portable-server.mjs"

set "WORKBENCH_EXIT=!ERRORLEVEL!"
echo.
echo [SERVICE STOPPED] Exit code: !WORKBENCH_EXIT!
echo If a port is busy, close the program using ports 4173 or 4174 and retry.
echo If security software blocked node.exe, allow runtime\node.exe and retry.
pause
exit /b !WORKBENCH_EXIT!
