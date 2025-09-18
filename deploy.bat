@echo off
setlocal enabledelayedexpansion

echo ==============================================
echo   DICD Measurement Management System Deployment
echo ==============================================
echo.

REM Check for administrator privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo This script must be run with administrator privileges.
    echo Please right-click the script and select "Run as administrator".
    pause
    exit /b 1
)

REM Set installation paths
set INSTALL_DIR=%ProgramFiles%\DICD_Management_System
set LOG_DIR=%INSTALL_DIR%\logs
set REPORT_DIR=%INSTALL_DIR%\reports
set SERVICE_NAME=DICD_Management_Service

echo Installation directory: %INSTALL_DIR%
echo.

REM Check if Python is installed
python --version >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Python is not installed.
    echo Please install Python 3.10 or higher and try again.
    echo https://www.python.org/downloads/
    pause
    exit /b 1
)

REM Check Python version
for /f "tokens=2" %%V in ('python --version 2^>^&1') do set PYTHON_VERSION=%%V
echo Python version: %PYTHON_VERSION%

REM Create necessary directories
echo Creating directories...
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"
if not exist "%REPORT_DIR%" mkdir "%REPORT_DIR%"

REM Copy all files from the current directory to the installation directory
echo Copying files...
xcopy /E /I /Y ".\*" "%INSTALL_DIR%"

REM Create Python virtual environment
echo Creating Python virtual environment...
cd "%INSTALL_DIR%"
python -m venv venv
call venv\Scripts\activate.bat

REM Install required packages
echo Installing required Python packages...
pip install -r requirements.txt

REM Database configuration
echo Setting up database...
set DB_CONFIG_FILE=%INSTALL_DIR%\backend\database\database.py

REM Get database password
set /p DB_PASSWORD=Enter MySQL database password: 

REM Update database connection settings
echo Updating database connection settings...
powershell -Command "(Get-Content '%DB_CONFIG_FILE%') -replace 'dicd_user:비밀번호@localhost', 'dicd_user:%DB_PASSWORD%@localhost' | Set-Content '%DB_CONFIG_FILE%'"

REM Test MySQL server connection
echo Testing MySQL server connection...
set MYSQL_CONN=mysql -u dicd_user -p%DB_PASSWORD% -e "SELECT 1" 2>nul
%MYSQL_CONN% >nul
if %errorLevel% neq 0 (
    echo [WARNING] Cannot connect to MySQL server. Please check database settings.
    echo You can configure the database later.
) else (
    echo MySQL server connection successful!
    
    REM Run database initialization script
    echo Initializing database...
    mysql -u dicd_user -p%DB_PASSWORD% -e "CREATE DATABASE IF NOT EXISTS dicd_management;"
)

REM Download NSSM service registration tool (if not available)
echo Preparing NSSM service registration tool...
if not exist "%INSTALL_DIR%\tools\nssm.exe" (
    mkdir "%INSTALL_DIR%\tools"
    powershell -Command "Invoke-WebRequest -Uri 'https://nssm.cc/release/nssm-2.24.zip' -OutFile '%INSTALL_DIR%\tools\nssm.zip'"
    powershell -Command "Expand-Archive -Path '%INSTALL_DIR%\tools\nssm.zip' -DestinationPath '%INSTALL_DIR%\tools'"
    copy "%INSTALL_DIR%\tools\nssm-2.24\win64\nssm.exe" "%INSTALL_DIR%\tools\nssm.exe"
    del "%INSTALL_DIR%\tools\nssm.zip"
    rmdir /S /Q "%INSTALL_DIR%\tools\nssm-2.24"
)

REM Register Windows service
echo Registering Windows service...
net stop %SERVICE_NAME% >nul 2>&1
"%INSTALL_DIR%\tools\nssm.exe" remove %SERVICE_NAME% confirm >nul 2>&1

REM Create service
"%INSTALL_DIR%\tools\nssm.exe" install %SERVICE_NAME% "%INSTALL_DIR%\venv\Scripts\python.exe"
"%INSTALL_DIR%\tools\nssm.exe" set %SERVICE_NAME% AppParameters "%INSTALL_DIR%\backend\main.py"
"%INSTALL_DIR%\tools\nssm.exe" set %SERVICE_NAME% AppDirectory "%INSTALL_DIR%"
"%INSTALL_DIR%\tools\nssm.exe" set %SERVICE_NAME% DisplayName "DICD Measurement Management System"
"%INSTALL_DIR%\tools\nssm.exe" set %SERVICE_NAME% Description "DICD Measurement Management System Backend Service"
"%INSTALL_DIR%\tools\nssm.exe" set %SERVICE_NAME% Start SERVICE_AUTO_START
"%INSTALL_DIR%\tools\nssm.exe" set %SERVICE_NAME% AppStdout "%LOG_DIR%\service.log"
"%INSTALL_DIR%\tools\nssm.exe" set %SERVICE_NAME% AppStderr "%LOG_DIR%\service_error.log"
"%INSTALL_DIR%\tools\nssm.exe" set %SERVICE_NAME% AppRotateFiles 1
"%INSTALL_DIR%\tools\nssm.exe" set %SERVICE_NAME% AppRotateSeconds 86400

REM Check Nginx installation
nginx -v >nul 2>&1
if %errorLevel% neq 0 (
    echo [WARNING] Nginx is not installed.
    echo You need to install Nginx and configure the frontend files appropriately.
) else (
    echo Creating Nginx configuration file...
    
    REM Generate Nginx configuration file
    (
    echo server {
    echo     listen 80;
    echo     server_name localhost;
    echo.
    echo     root %INSTALL_DIR%/frontend;
    echo     index index.html;
    echo.
    echo     location / {
    echo         try_files $uri $uri/ =404;
    echo     }
    echo.
    echo     location /api {
    echo         proxy_pass http://localhost:8080;
    echo         proxy_set_header Host $host;
    echo         proxy_set_header X-Real-IP $remote_addr;
    echo     }
    echo }
    ) > "%INSTALL_DIR%\nginx_dicd.conf"
    
    echo Nginx configuration file has been created: %INSTALL_DIR%\nginx_dicd.conf
    echo Please copy this file to your Nginx configuration directory and restart Nginx.
)

REM Start the service
echo Starting DICD Management Service...
net start %SERVICE_NAME%
if %errorLevel% neq 0 (
    echo [WARNING] Failed to start the service. Please check the log files.
) else (
    echo Service started successfully!
)

REM Create necessary files

REM Generate requirements.txt file
echo fastapi>=0.68.0,^<0.69.0 > "%INSTALL_DIR%\requirements.txt"
echo uvicorn>=0.15.0,^<0.16.0 >> "%INSTALL_DIR%\requirements.txt"
echo sqlalchemy>=1.4.0,^<1.5.0 >> "%INSTALL_DIR%\requirements.txt"
echo mysql-connector-python>=8.0.26,^<8.1.0 >> "%INSTALL_DIR%\requirements.txt"
echo pydantic>=1.8.0,^<1.9.0 >> "%INSTALL_DIR%\requirements.txt"
echo python-multipart>=0.0.5,^<0.1.0 >> "%INSTALL_DIR%\requirements.txt"
echo email-validator>=1.1.3,^<1.2.0 >> "%INSTALL_DIR%\requirements.txt"
echo numpy>=1.21.0,^<1.22.0 >> "%INSTALL_DIR%\requirements.txt"
echo pandas>=1.3.0,^<1.4.0 >> "%INSTALL_DIR%\requirements.txt"
echo reportlab>=3.6.0,^<3.7.0 >> "%INSTALL_DIR%\requirements.txt"
echo openpyxl>=3.0.9,^<3.1.0 >> "%INSTALL_DIR%\requirements.txt"

echo.
echo ==============================================
echo   Installation Complete!
echo ==============================================
echo.
echo Installation location: %INSTALL_DIR%
echo Service name: %SERVICE_NAME%
echo.
echo Web access URL: http://localhost/
echo API access URL: http://localhost:8080/
echo.
echo If you encounter any issues during deployment, check the log files:
echo - %LOG_DIR%\service.log
echo - %LOG_DIR%\service_error.log
echo.

pause