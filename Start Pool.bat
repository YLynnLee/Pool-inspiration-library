@echo off
rem Double-click to open Pool with the Drain button (Windows).
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Pool needs Node.js ^(free^) to connect your AI.
  echo Opening the download page - install it, then double-click this file again.
  start "" https://nodejs.org/en/download
  pause
  exit /b 1
)
if not exist node_modules\playwright (
  echo First run: setting up ^(about a minute^)...
  call npm install --no-audit --no-fund
  if errorlevel 1 ( pause & exit /b 1 )
)
rem Register the pool:// link so the app's Connect AI button can start this by itself.
set "POOL_BG=%~dp0scripts\start-background.cmd"
reg add "HKCU\Software\Classes\pool" /ve /d "URL:Pool" /f >nul
reg add "HKCU\Software\Classes\pool" /v "URL Protocol" /d "" /f >nul
reg add "HKCU\Software\Classes\pool\shell\open\command" /ve /d "cmd.exe /c start \"\" /min \"%POOL_BG%\"" /f >nul
echo Starting Pool. Keep this window open while you use the Drain button.
node scripts\server.js --open
pause
