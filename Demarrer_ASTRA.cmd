@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  py -3 -m venv .venv
  if errorlevel 1 exit /b 1
)
".venv\Scripts\python.exe" -c "import fastapi, uvicorn, dotenv, pydantic" >nul 2>nul
if errorlevel 1 (
  ".venv\Scripts\python.exe" -m pip install --disable-pip-version-check -r station\requirements.txt
  if errorlevel 1 exit /b 1
)
".venv\Scripts\python.exe" start.py %*
exit /b %ERRORLEVEL%
