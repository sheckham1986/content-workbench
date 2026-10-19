@echo off
setlocal EnableExtensions
cd /d "%~dp0"

if not exist ".content-workbench.pid" (
  echo Content Workbench is not running.
  pause
  exit /b 0
)

set /p WORKBENCH_PID=<".content-workbench.pid"
taskkill /PID %WORKBENCH_PID% /T /F >nul 2>&1
del /q ".content-workbench.pid" >nul 2>&1
echo Content Workbench has stopped.
timeout /t 2 /nobreak >nul
