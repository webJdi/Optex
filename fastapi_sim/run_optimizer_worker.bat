@echo off
echo Starting Optimizer Worker...
echo.
echo This worker runs independently and checks for optimization requests every 10 seconds
echo Press Ctrl+C to stop
echo.

python optimizer_worker.py
