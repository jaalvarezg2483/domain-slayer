@echo off
REM Script para recompilar better-sqlite3 para Electron
REM Este script usa @electron/rebuild que es mas simple y confiable

echo ========================================
echo Recompilando better-sqlite3 para Electron
echo ========================================
echo.

REM Verificar que estamos en el directorio correcto
if not exist "package.json" (
    echo ERROR: No se encontro package.json
    echo Asegurate de estar en el directorio del proyecto
    pause
    exit /b 1
)

REM Verificar que @electron/rebuild esta instalado
if not exist "node_modules\@electron\rebuild" (
    echo Instalando @electron/rebuild...
    call npm install --save-dev @electron/rebuild
    if %ERRORLEVEL% NEQ 0 (
        echo ERROR: No se pudo instalar @electron/rebuild
        pause
        exit /b 1
    )
)

echo.
echo Recompilando better-sqlite3 usando @electron/rebuild...
echo.

call npx @electron/rebuild -f -w better-sqlite3

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ========================================
    echo ERROR: La compilacion fallo
    echo ========================================
    echo.
    echo Posibles causas:
    echo 1. Falta el Windows SDK - Instalalo desde Visual Studio Installer
    echo 2. Visual Studio no esta correctamente configurado
    echo.
    echo Solucion: Abre "Developer Command Prompt for VS 2022" y ejecuta este script nuevamente
    echo.
    pause
    exit /b 1
)

echo.
echo Copiando archivo a la ubicacion que Electron busca...
if exist "node_modules\better-sqlite3\build\Release\better_sqlite3.node" (
    if not exist "node_modules\better-sqlite3\lib\binding\node-v119-win32-x64" (
        mkdir "node_modules\better-sqlite3\lib\binding\node-v119-win32-x64"
    )
    copy /Y "node_modules\better-sqlite3\build\Release\better_sqlite3.node" "node_modules\better-sqlite3\lib\binding\node-v119-win32-x64\better_sqlite3.node" >nul
)

echo.
echo ========================================
echo EXITO: Compilacion completada!
echo ========================================
echo.
echo Ahora puedes ejecutar la aplicacion con:
echo   npm run electron:dev
echo.

pause
