@echo off
rem Started by the inspiration-library:// link (the app's Connect AI button) on Windows:
rem runs the helper with no window of its own, logging to .helper\helper.log.
cd /d "%~dp0.."
if not exist .helper mkdir .helper
if not exist node_modules\playwright call npm install --no-audit --no-fund >> .helper\helper.log 2>&1
node scripts\server.js >> .helper\helper.log 2>&1
