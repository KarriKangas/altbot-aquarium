@echo off
setlocal
cd /d "%~dp0"

set "AQUARIUM_BUNDLED_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin"
if exist "%AQUARIUM_BUNDLED_NODE%\node.exe" set "PATH=%AQUARIUM_BUNDLED_NODE%;%PATH%"

where node >nul 2>nul
if errorlevel 1 goto :need_node

for /f %%v in ('node -p "Number(process.versions.node.split('.')[0])"') do set "AQUARIUM_NODE_MAJOR=%%v"
if %AQUARIUM_NODE_MAJOR% LSS 22 goto :need_node

if not exist node_modules\ (
  echo Feeding the fish for the first time...
  call npm install
  if errorlevel 1 exit /b 1
)

start "" /min powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:3000/'"
call npm run dev
exit /b %errorlevel%

:need_node
echo Altbot Aquarium needs Node.js 22 or newer.
pause
exit /b 1
