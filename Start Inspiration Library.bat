@echo off
rem Double-click to open Inspiration Library with the Drain button (Windows).
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Inspiration Library needs Node.js ^(free^) to connect your AI.
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
rem Register the inspiration-library:// link so the app's Connect AI button can start this by itself.
set "IL_BG=%~dp0scripts\start-background.cmd"
reg add "HKCU\Software\Classes\inspiration-library" /ve /d "URL:Inspiration Library" /f >nul
reg add "HKCU\Software\Classes\inspiration-library" /v "URL Protocol" /d "" /f >nul
reg add "HKCU\Software\Classes\inspiration-library\shell\open\command" /ve /d "cmd.exe /c start \"\" /min \"%IL_BG%\"" /f >nul
echo Starting Inspiration Library. Keep this window open while you use the Drain button.
node scripts\server.js --open
pause
