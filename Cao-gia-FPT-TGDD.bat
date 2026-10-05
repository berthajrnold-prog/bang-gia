@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Cao gia FPT + TGDD tu may nay va gui len VPS...
echo.
call npx tsx --env-file=.env.local scripts/scrape-local.mjs
echo.
pause
