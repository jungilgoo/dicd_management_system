@echo off
cd /d "C:\Program Files\DICD_Management_System"
call "C:\Program Files\DICD_Management_System\venv\Scripts\activate.bat"
"C:\Program Files\DICD_Management_System\venv\Scripts\python.exe" -m backend.main
