@echo off
set ROOT_DIR=%~dp0
cd /d "%ROOT_DIR%BE"
call gradlew.bat %*
