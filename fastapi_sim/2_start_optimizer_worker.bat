@echo off
echo ============================================================
echo   Starting Optimizer Background Worker
echo ============================================================
echo.
echo This worker runs optimization tasks independently
echo It polls Firebase every 10 seconds for optimization requests
echo.
echo Make sure the main server is running first!
echo.
echo Press Ctrl+C to stop the worker
echo.

cd /d "%~dp0"

if exist "venv\Scripts\python.exe" (
    echo Starting optimizer worker with virtual environment...
    venv\Scripts\python.exe optimizer_worker.py
) else (
    echo ERROR: Virtual environment not found at venv\Scripts\python.exe
    echo Please create a virtual environment first:
    echo   python -m venv venv
    echo   venv\Scripts\activate
    echo   pip install -r requirements.txt
    pause
)
