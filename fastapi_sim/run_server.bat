@echo off
REM Start FastAPI server for cement plant simulation
set ANACONDA_PATH=C:\Anaconda3
if not exist "%ANACONDA_PATH%\Scripts\activate.bat" set ANACONDA_PATH=C:\ProgramData\Anaconda3
start cmd /k "%ANACONDA_PATH%\Scripts\activate.bat & conda activate base & uvicorn main:app --host 127.0.0.1 --port 8000 --reload"
