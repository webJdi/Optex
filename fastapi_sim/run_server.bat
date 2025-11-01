@echo off
REM Start FastAPI server for cement plant simulation
REM Using virtual environment (venv)
cd /d "%~dp0"
if exist "venv\Scripts\python.exe" (
    echo Starting FastAPI server...
    echo Server will be available at http://127.0.0.1:8000
    echo.
    venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
) else (
    echo ERROR: Virtual environment not found at venv\Scripts\python.exe
    echo Please create a virtual environment first:
    echo   python -m venv venv
    echo   venv\Scripts\activate
    echo   pip install -r requirements.txt
    pause
)
