@echo off
rem Arranca el servicio de impresion en segundo plano (sin ventana).
call "%~dp0configuracion.bat"
start "" powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0impresora.ps1" -Impresora "%IMPRESORA%" -Columnas %COLUMNAS%
