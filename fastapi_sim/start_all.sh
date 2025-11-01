#!/bin/bash
# Start both FastAPI server and optimizer worker
# For single Render deployment

# Start optimizer worker in background
python optimizer_worker.py &

# Start main FastAPI server (foreground)
uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
