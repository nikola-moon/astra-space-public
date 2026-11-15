@echo off
setlocal
cd /d "%~dp0frontend"
set "EXPO_NO_DOTENV=1"
set "EXPO_PUBLIC_ASTRA_SHOWCASE=1"
set "EXPO_PUBLIC_ASTRA_API_URL="
call npm.cmd ci
if errorlevel 1 exit /b 1
call npm.cmd run typecheck
if errorlevel 1 exit /b 1
call .\node_modules\.bin\expo.cmd export --platform web --output-dir "..\station\web"
exit /b %ERRORLEVEL%
