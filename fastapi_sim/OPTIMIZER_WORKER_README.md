# Optimizer Worker - Background Optimization Service

## Overview

The Optimizer Worker is a **separate Python process** that runs independently from the main FastAPI server. This separation ensures that long-running optimization tasks don't block the main API server, allowing the plant simulator and soft sensors to continue running smoothly.

## How It Works

1. **Independent Process**: Runs as a separate Python script
2. **Firebase Polling**: Checks Firebase every 10 seconds for optimization state
3. **Auto-Scheduling**: When `running=true` and timer expires, triggers optimization via API call
4. **Non-Blocking**: Main API server remains responsive during optimization

## Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────┐
│   Frontend UI   │────────▶│  FastAPI Server  │◀────────│  Firebase   │
│  (optimizer.tsx)│         │   (main.py)      │         │  Firestore  │
└─────────────────┘         └──────────────────┘         └─────────────┘
                                     ▲                           ▲
                                     │                           │
                                     │  HTTP API Call            │  Poll State
                                     │                           │
                            ┌────────┴────────────┐             │
                            │  Optimizer Worker   │─────────────┘
                            │ (optimizer_worker.py)│
                            └─────────────────────┘
```

## Running the Worker

### Windows (PowerShell)
```powershell
cd fastapi_sim
.\run_optimizer_worker.ps1
```

### Windows (Command Prompt)
```cmd
cd fastapi_sim
run_optimizer_worker.bat
```

### Manual Start
```bash
cd fastapi_sim
python optimizer_worker.py
```

## What Happens When Running

1. **Worker starts** and initializes Firebase connection
2. **Polls Firebase** every 10 seconds checking `optimizer_state/current` document
3. **When conditions are met**:
   - `running = true`
   - `autoSchedule = true`
   - Time elapsed >= timer (300 seconds)
4. **Triggers optimization** by calling `http://localhost:8000/optimize_targets`
5. **Updates Firebase** with new timer value after completion
6. **Repeats** the cycle

## Console Output

```
============================================================
🚀 Optimizer Worker Started
============================================================

👀 Watching for optimization requests...
Polling interval: 10 seconds
Press Ctrl+C to stop

Optimizer not running (running=False, autoSchedule=False)
Optimizer not running (running=False, autoSchedule=False)
Time since last update: 45s / 300s
⏳ Waiting... 255s remaining
Time since last update: 305s / 300s
⏰ Timer expired! Running optimization for Clinkerization...
✓ Optimization completed for Clinkerization
✓ Optimization completed and timer reset
```

## Benefits

✅ **Non-Blocking**: Main API server stays responsive  
✅ **Reliable**: Worker continues even if UI is closed  
✅ **Scalable**: Can run multiple workers if needed  
✅ **Simple**: No complex task queue required  
✅ **Debuggable**: Clear console output shows exactly what's happening  

## Stopping the Worker

Press `Ctrl+C` in the terminal where the worker is running.

## Dependencies

The worker uses the same dependencies as the main server:
- `firebase-admin` - Firebase SDK
- `requests` - HTTP requests to call optimization API

## Troubleshooting

### Worker doesn't start
- Ensure Firebase credentials are available (`serviceAccountKey.json`)
- Check that Python path is correct

### Optimization not triggering
- Verify `running=true` and `autoSchedule=true` in Firebase
- Check that main API server is running on port 8000
- Verify timer has elapsed (>= 300 seconds)

### Multiple optimizations running
- Only run one worker instance at a time
- Stop old worker before starting new one

## Production Deployment

For production, consider:
1. Using a process manager (PM2, systemd, supervisor)
2. Adding logging to file instead of console
3. Implementing health checks
4. Adding retry logic for failed optimizations
5. Using environment variables for configuration
