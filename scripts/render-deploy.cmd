@echo off
REM Double-clic ou : scripts\render-deploy.cmd
REM Passe les arguments au script PowerShell (ex. commit + message) :
REM   render-deploy.cmd -Commit -Message "votre message"
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0render-deploy.ps1" %*
if errorlevel 1 exit /b 1
