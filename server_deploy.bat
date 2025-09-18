@echo off
setlocal enabledelayedexpansion

echo ==============================================
echo   DICD Management System Server Deployment
echo ==============================================
echo.

REM Check administrator privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] This script requires administrator privileges.
    echo Please right-click and select "Run as administrator".
    pause
    exit /b 1
)

REM Installation paths and network settings
set INSTALL_DIR=%ProgramFiles%\DICD_Management_System
set LOG_DIR=%INSTALL_DIR%\logs
set REPORT_DIR=%INSTALL_DIR%\reports
set SERVICE_NAME=DICD_Management_Service

REM Server IP settings
set /p SERVER_IP=Enter server IP address (default: 0.0.0.0, all interfaces): 
if "!SERVER_IP!"=="" set SERVER_IP=0.0.0.0

REM Server port settings
set /p SERVER_PORT=Enter backend server port (default: 8080): 
if "!SERVER_PORT!"=="" set SERVER_PORT=8080

echo.
echo Installation Information:
echo - Installation directory: %INSTALL_DIR%
echo - Server IP: %SERVER_IP%
echo - Backend port: %SERVER_PORT%
echo.
echo Note: MySQL and Nginx configuration will be performed separately.
echo.

REM Create a log file for error tracking
set LOGFILE=%TEMP%\dicd_deploy_log.txt
echo Deployment started at %date% %time% > "%LOGFILE%"
echo Installation paths: >> "%LOGFILE%"
echo   INSTALL_DIR=%INSTALL_DIR% >> "%LOGFILE%"
echo   SERVER_IP=%SERVER_IP% >> "%LOGFILE%"
echo   SERVER_PORT=%SERVER_PORT% >> "%LOGFILE%"

REM Verify Python installation
echo Checking Python installation...
python --version >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Python is not installed.
    echo Please install Python 3.10 or higher and try again.
    echo Visit https://www.python.org/downloads/
    echo Python check failed >> "%LOGFILE%"
    pause
    exit /b 1
)

REM Get Python version
for /f "tokens=2" %%V in ('python --version 2^>^&1') do set PYTHON_VERSION=%%V
echo Python version: %PYTHON_VERSION%
echo Python version: %PYTHON_VERSION% >> "%LOGFILE%"

REM Prepare server environment
echo Preparing server environment...
echo Preparing server environment... >> "%LOGFILE%"

REM Create necessary directories
echo Creating directories...
echo Creating directories... >> "%LOGFILE%"

REM Check if directories already exist
if exist "%INSTALL_DIR%" (
    echo Installation directory already exists. 
    echo Checking if it's in use...
    echo Installation directory exists >> "%LOGFILE%"
    
    REM Stop service if running
    echo Stopping existing service...
    net stop %SERVICE_NAME% >nul 2>&1
    echo Waiting for service to stop...
    timeout /t 5 /nobreak > nul
)

REM Create directories with error handling
if not exist "%INSTALL_DIR%" (
    mkdir "%INSTALL_DIR%" 2>>"%LOGFILE%"
    if %errorLevel% neq 0 (
        echo [ERROR] Failed to create installation directory.
        echo [ERROR] Failed to create installation directory >> "%LOGFILE%"
        echo Check permissions or if the directory is in use.
        pause
        exit /b 1
    )
)

if not exist "%LOG_DIR%" (
    mkdir "%LOG_DIR%" 2>>"%LOGFILE%"
    if %errorLevel% neq 0 (
        echo [ERROR] Failed to create log directory.
        echo [ERROR] Failed to create log directory >> "%LOGFILE%"
        pause
        exit /b 1
    )
)

if not exist "%REPORT_DIR%" (
    mkdir "%REPORT_DIR%" 2>>"%LOGFILE%"
    if %errorLevel% neq 0 (
        echo [ERROR] Failed to create report directory.
        echo [ERROR] Failed to create report directory >> "%LOGFILE%"
        pause
        exit /b 1
    )
)

REM Copy all files from current directory to installation path
echo Copying files...
echo Copying files... >> "%LOGFILE%"

REM Wait to ensure all resources are released
timeout /t 3 /nobreak > nul

REM Try copying with error handling and retries
set COPY_ATTEMPTS=0
:COPY_RETRY
set /a COPY_ATTEMPTS+=1
echo Copy attempt %COPY_ATTEMPTS%...
echo Copy attempt %COPY_ATTEMPTS%... >> "%LOGFILE%"

xcopy /E /I /Y ".\*" "%INSTALL_DIR%" 2>>"%LOGFILE%"
if %errorLevel% neq 0 (
    echo [WARNING] Error during file copy, attempt %COPY_ATTEMPTS%.
    echo [WARNING] Error during file copy, attempt %COPY_ATTEMPTS% >> "%LOGFILE%"
    
    if %COPY_ATTEMPTS% lss 3 (
        echo Waiting for resources to be released...
        timeout /t 10 /nobreak > nul
        echo Retrying...
        goto COPY_RETRY
    ) else (
        echo [ERROR] Failed to copy files after %COPY_ATTEMPTS% attempts.
        echo [ERROR] Failed to copy files after %COPY_ATTEMPTS% attempts >> "%LOGFILE%"
        echo Check if any files are in use or locked.
        pause
        exit /b 1
    )
) else (
    echo Files copied successfully.
    echo Files copied successfully >> "%LOGFILE%"
)

REM Change to installation directory
cd "%INSTALL_DIR%"
if %errorLevel% neq 0 (
    echo [ERROR] Failed to change to installation directory.
    echo [ERROR] Failed to change to installation directory >> "%LOGFILE%"
    pause
    exit /b 1
)

REM Create Python virtual environment
echo Creating Python virtual environment...
echo Creating Python virtual environment... >> "%LOGFILE%"

REM Check if venv already exists
if exist "venv" (
    echo Virtual environment already exists, skipping creation.
    echo Virtual environment already exists >> "%LOGFILE%"
) else (
    python -m venv venv 2>>"%LOGFILE%"
    if %errorLevel% neq 0 (
        echo [ERROR] Failed to create virtual environment.
        echo [ERROR] Failed to create virtual environment >> "%LOGFILE%"
        pause
        exit /b 1
    )
)

REM Activate virtual environment
echo Activating virtual environment...
echo Activating virtual environment... >> "%LOGFILE%"
call venv\Scripts\activate.bat
if %errorLevel% neq 0 (
    echo [ERROR] Failed to activate virtual environment.
    echo [ERROR] Failed to activate virtual environment >> "%LOGFILE%"
    pause
    exit /b 1
)

REM Install required packages
echo Installing required Python packages...
echo Installing required Python packages... >> "%LOGFILE%"

REM Check if requirements.txt exists
if not exist "requirements.txt" (
    echo Creating requirements.txt...
    echo Creating requirements.txt... >> "%LOGFILE%"
    
    (
    echo fastapi>=0.68.0,<0.69.0
    echo uvicorn>=0.15.0,<0.16.0
    echo sqlalchemy>=1.4.0,<1.5.0
    echo mysql-connector-python>=8.0.26,<8.1.0
    echo pydantic>=1.8.0,<1.9.0
    echo python-multipart>=0.0.5,<0.1.0
    echo email-validator>=1.1.3,<1.2.0
    echo numpy>=1.21.0,<1.22.0
    echo pandas>=1.3.0,<1.4.0
    echo reportlab>=3.6.0,<3.7.0
    echo openpyxl>=3.0.9,<3.1.0
    echo xlsxwriter>=3.0.3,<3.1.0
    ) > requirements.txt
)

pip install -r requirements.txt 2>>"%LOGFILE%"
if %errorLevel% neq 0 (
    echo [WARNING] Some packages might have failed to install.
    echo [WARNING] Some packages failed to install >> "%LOGFILE%"
    echo Continuing deployment, but check the log file for details.
    echo Log file: %LOGFILE%
    echo.
)

REM Update server configuration file
echo Updating server configuration...
echo Updating server configuration... >> "%LOGFILE%"
set CONFIG_FILE=%INSTALL_DIR%\backend\config.json

REM Check if config file exists
if exist "%CONFIG_FILE%" (
    echo Updating production environment settings...
    powershell -Command "try { $config = Get-Content -Raw '%CONFIG_FILE%' | ConvertFrom-Json; $config.production.HOST = '%SERVER_IP%'; $config.production.PORT = %SERVER_PORT%; $config | ConvertTo-Json -Depth 10 | Set-Content '%CONFIG_FILE%' } catch { Write-Output 'Error updating config.json: $_' }" 2>>"%LOGFILE%"
    if %errorLevel% neq 0 (
        echo [WARNING] Failed to update server configuration.
        echo [WARNING] Failed to update server configuration >> "%LOGFILE%"
    )
)

REM Set environment variables
echo Setting environment variables...
echo Setting environment variables... >> "%LOGFILE%"
setx DICD_ENV "production" /M 2>>"%LOGFILE%"
setx DICD_HOST "%SERVER_IP%" /M 2>>"%LOGFILE%"
setx DICD_PORT "%SERVER_PORT%" /M 2>>"%LOGFILE%"

REM Download NSSM service registration tool if not already available
echo Preparing NSSM service registration tool...
echo Preparing NSSM service registration tool... >> "%LOGFILE%"
if not exist "%INSTALL_DIR%\tools\nssm.exe" (
    echo Downloading NSSM...
    
    REM Create tools directory
    if not exist "%INSTALL_DIR%\tools" mkdir "%INSTALL_DIR%\tools"
    
    REM Download and extract NSSM
    powershell -Command "Invoke-WebRequest -Uri 'https://nssm.cc/release/nssm-2.24.zip' -OutFile '%INSTALL_DIR%\tools\nssm.zip'" 2>>"%LOGFILE%"
    if %errorLevel% neq 0 (
        echo [WARNING] Failed to download NSSM.
        echo [WARNING] Failed to download NSSM >> "%LOGFILE%"
        echo You may need to download it manually.
    ) else {
        powershell -Command "Expand-Archive -Path '%INSTALL_DIR%\tools\nssm.zip' -DestinationPath '%INSTALL_DIR%\tools'" 2>>"%LOGFILE%"
        copy "%INSTALL_DIR%\tools\nssm-2.24\win64\nssm.exe" "%INSTALL_DIR%\tools\nssm.exe" 2>>"%LOGFILE%"
        del "%INSTALL_DIR%\tools\nssm.zip" 2>>"%LOGFILE%"
        rmdir /S /Q "%INSTALL_DIR%\tools\nssm-2.24" 2>>"%LOGFILE%"
    }
)

REM Check if NSSM is available
if not exist "%INSTALL_DIR%\tools\nssm.exe" (
    echo [ERROR] NSSM not found.
    echo [ERROR] NSSM not found >> "%LOGFILE%"
    echo Cannot register Windows service.
    pause
    exit /b 1
)

REM Register Windows service
echo Registering Windows service...
echo Registering Windows service... >> "%LOGFILE%"

REM Stop and remove existing service if it exists
echo Stopping existing service...
echo Stopping existing service... >> "%LOGFILE%"
net stop %SERVICE_NAME% >nul 2>&1
timeout /t 5 /nobreak > nul

echo Removing existing service...
echo Removing existing service... >> "%LOGFILE%"
"%INSTALL_DIR%\tools\nssm.exe" remove %SERVICE_NAME% confirm >nul 2>&1
timeout /t 5 /nobreak > nul

REM Create the service with retries
echo Creating service...
echo Creating service... >> "%LOGFILE%"
set SERVICE_ATTEMPTS=0
:SERVICE_RETRY
set /a SERVICE_ATTEMPTS+=1
echo Service creation attempt %SERVICE_ATTEMPTS%...
echo Service creation attempt %SERVICE_ATTEMPTS%... >> "%LOGFILE%"

"%INSTALL_DIR%\tools\nssm.exe" install %SERVICE_NAME% "%INSTALL_DIR%\venv\Scripts\python.exe" 2>>"%LOGFILE%"
if %errorLevel% neq 0 (
    echo [WARNING] Error during service creation, attempt %SERVICE_ATTEMPTS%.
    echo [WARNING] Error during service creation, attempt %SERVICE_ATTEMPTS% >> "%LOGFILE%"
    
    if %SERVICE_ATTEMPTS% lss 3 (
        echo Waiting before retry...
        timeout /t 10 /nobreak > nul
        echo Retrying...
        goto SERVICE_RETRY
    ) else (
        echo [ERROR] Failed to create service after %SERVICE_ATTEMPTS% attempts.
        echo [ERROR] Failed to create service after %SERVICE_ATTEMPTS% attempts >> "%LOGFILE%"
        pause
        exit /b 1
    )
)

REM Configure service parameters
echo Configuring service parameters...
echo Configuring service parameters... >> "%LOGFILE%"
"%INSTALL_DIR%\tools\nssm.exe" set %SERVICE_NAME% AppParameters "%INSTALL_DIR%\backend\main.py" 2>>"%LOGFILE%"
"%INSTALL_DIR%\tools\nssm.exe" set %SERVICE_NAME% AppDirectory "%INSTALL_DIR%" 2>>"%LOGFILE%"
"%INSTALL_DIR%\tools\nssm.exe" set %SERVICE_NAME% DisplayName "DICD Management System" 2>>"%LOGFILE%"
"%INSTALL_DIR%\tools\nssm.exe" set %SERVICE_NAME% Description "DICD Management System Backend Service" 2>>"%LOGFILE%"
"%INSTALL_DIR%\tools\nssm.exe" set %SERVICE_NAME% Start SERVICE_AUTO_START 2>>"%LOGFILE%"
"%INSTALL_DIR%\tools\nssm.exe" set %SERVICE_NAME% AppStdout "%LOG_DIR%\service.log" 2>>"%LOGFILE%"
"%INSTALL_DIR%\tools\nssm.exe" set %SERVICE_NAME% AppStderr "%LOG_DIR%\service_error.log" 2>>"%LOGFILE%"
"%INSTALL_DIR%\tools\nssm.exe" set %SERVICE_NAME% AppRotateFiles 1 2>>"%LOGFILE%"
"%INSTALL_DIR%\tools\nssm.exe" set %SERVICE_NAME% AppRotateSeconds 86400 2>>"%LOGFILE%"

REM Add Windows firewall rules
echo Adding Windows firewall rules...
echo Adding Windows firewall rules... >> "%LOGFILE%"

REM Add rule for backend port
echo Adding rule for backend port %SERVER_PORT%...
netsh advfirewall firewall add rule name="DICD Backend" dir=in action=allow protocol=TCP localport=%SERVER_PORT% 2>>"%LOGFILE%"
if %errorLevel% neq 0 (
    echo [WARNING] Failed to add firewall rule for backend port.
    echo [WARNING] Failed to add firewall rule for backend port >> "%LOGFILE%"
) else (
    echo Firewall rule for backend port added successfully.
    echo Firewall rule for backend port added successfully >> "%LOGFILE%"
)

REM Start the service
echo Starting DICD Management Service...
echo Starting DICD Management Service... >> "%LOGFILE%"
net start %SERVICE_NAME% 2>>"%LOGFILE%"
if %errorLevel% neq 0 (
    echo [WARNING] Failed to start service.
    echo [WARNING] Failed to start service >> "%LOGFILE%"
    echo Check the log files for details:
    echo - %LOG_DIR%\service.log
    echo - %LOG_DIR%\service_error.log
) else (
    echo Service started successfully!
    echo Service started successfully >> "%LOGFILE%"
)

echo.
echo ==============================================
echo   Server Installation Completed!
echo ==============================================
echo.
echo Server Information:
echo - Installation directory: %INSTALL_DIR%
echo - Service name: %SERVICE_NAME%
echo - Server IP: %SERVER_IP%
echo - Backend port: %SERVER_PORT%
echo.
echo API access: http://%SERVER_IP%:%SERVER_PORT%/
echo.
echo Note: MySQL and Nginx configuration will need to be performed separately.
echo.
echo If you encounter any issues, check the log files:
echo - Service logs: %LOG_DIR%\service.log and %LOG_DIR%\service_error.log
echo - Deployment log: %LOGFILE%
echo.

pause
