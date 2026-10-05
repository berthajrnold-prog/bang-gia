@echo off
chcp 65001 >nul
echo Cai dat chuong trinh tu dong cao FPT + TGDD (chay ngam, tu bat cung Windows)...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-agent.ps1"
echo.
pause
