@echo off
rem Imprime un ticket de prueba para revisar que la impresora responde.
call "%~dp0configuracion.bat"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0impresora.ps1" -Impresora "%IMPRESORA%" -Columnas %COLUMNAS% -Prueba
echo.
echo Impresoras instaladas en esta computadora:
powershell -NoProfile -Command "Get-Printer | Select-Object -ExpandProperty Name"
echo.
pause
