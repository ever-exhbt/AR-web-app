@echo off
setlocal
echo ===================================================
echo   Ever WebAR - Production Build
echo ===================================================
echo.

:: Ensure Node.js is in PATH if installed in user local directory
if exist "%LOCALAPPDATA%\Programs\nodejs" (
    set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"
)

:: Run production build (compiles targets, syncs assets, bundles Vite)
call npm run build

if %ERRORLEVEL% equ 0 (
    echo.
    echo ===================================================
    echo   [SUCCESS] Build completed successfully!
    echo   Deployable output is in the 'dist' directory.
    echo ===================================================
) else (
    echo.
    echo ===================================================
    echo   [ERROR] Build failed with exit code %ERRORLEVEL%.
    echo ===================================================
)

echo.
pause
