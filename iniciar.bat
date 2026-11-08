@echo off
title LiveArena
cd /d "%~dp0"
where node >nul 2>nul || (echo Necesitas Node.js 22 o superior: https://nodejs.org & pause & exit /b 1)
call corepack enable >nul 2>nul
if not exist node_modules (
  echo Instalando dependencias, solo la primera vez...
  call pnpm install || (pause & exit /b 1)
)
if not exist apps\dashboard\dist (
  echo Preparando el panel...
  call pnpm build || (pause & exit /b 1)
)
start "" http://127.0.0.1:7420
call pnpm start
pause
