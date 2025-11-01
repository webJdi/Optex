# Cement Plant FastAPI Simulation

This FastAPI app simulates a complete cement plant with real-time readings, optimization, and integrated background worker.

## Features

- ✅ Real-time plant simulation with fluctuating process variables
- ✅ APC (Advanced Process Control) optimization
- ✅ Engineering optimization with relaxed constraints
- ✅ LSF (Lime Saturation Factor) soft sensor prediction
- ✅ **Integrated optimizer worker** - runs in background, no separate service needed
- ✅ Firebase integration for data persistence
- ✅ Automatic optimization scheduling (every 5 minutes)

## Architecture

The FastAPI server includes:
- **API Endpoints**: REST API for plant data and optimization
- **Plant Simulator**: Generates realistic process variable fluctuations
- **Background Worker**: Polls Firebase for optimization requests (integrated, no separate process)
- **Firebase Integration**: Stores plant readings, optimization results, and APC limits

## Quick Start

1. **Install requirements:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Add Firebase credentials:**
   - Place `serviceAccountKey.json` in the `fastapi_sim` folder
   - Or set up environment variables for Firebase

3. **Start the server:**
   ```bash
   run_server.bat
   ```
   OR
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

4. **Verify startup:**
   - You should see in the logs:
     ```
     🚀 Starting application with integrated optimizer worker...
     🤖 Integrated Optimizer Worker Started
     👀 Watching for optimization requests...
     ```

## API Endpoints

### Plant Simulation
- `GET /` - Root endpoint
- `GET /health` - Health check (for deployment monitoring)
- `GET /kiln` - Current kiln readings
- `GET /raw_mill` - Current raw mill readings
- `GET /cooler` - Current cooler readings
- `POST /step` - Advance simulation by one step
- `POST /set_plant_state` - Manually set plant parameters

### Optimization
- `POST /optimize_targets` - Run optimization (APC + Engineering)
- `GET /predict_from_current_state` - Get LSF soft sensor prediction
- `POST /start_background_optimization` - Enable auto-optimization (every 5 minutes)
- `POST /stop_background_optimization` - Disable auto-optimization

### Configuration
- `POST /set_pricing` - Update pricing configuration
- `GET /pricing` - Get current pricing

## Background Worker

The optimizer worker is **integrated into main.py** and runs automatically when the server starts. It:
- ✅ Polls Firebase every 10 seconds for optimization requests
- ✅ Checks if auto-schedule is enabled
- ✅ Runs optimization when timer expires (default: 5 minutes)
- ✅ Saves results to Firebase
- ✅ No separate process or service needed!

### Enable Auto-Optimization

1. In Firebase → `optimizer_state` collection → `current` document:
   ```json
   {
     "running": true,
     "autoSchedule": true,
     "timer": 300,
     "segment": "Clinkerization"
   }
   ```

2. The worker will automatically run optimization every 5 minutes

## Deployment to Render

See `DEPLOYMENT_CHECKLIST.md` for step-by-step deployment instructions.

**Key points:**
- ✅ Single web service deployment (no background worker service needed)
- ✅ Free tier eligible ($0/month)
- ✅ Upload `serviceAccountKey.json` as secret file
- ✅ Set `BACKEND_URL` environment variable to `$RENDER_EXTERNAL_URL`

## Local Development

### Running with Auto-Reload
```bash
uvicorn main:app --reload
```

### Testing Optimization
```bash
# Test optimization endpoint
curl -X POST http://localhost:8000/optimize_targets \
  -H "Content-Type: application/json" \
  -d '{"segment": "Clinkerization", "n_data": 50}'
```

### Checking Worker Status
Watch the console logs - you should see:
```
👀 Watching for optimization requests...
⏰ Timer expired! Running optimization for Clinkerization...
✓ Optimization completed and timer reset
```

## Firebase Collections

The app uses these Firebase collections:
- `plant_readings` - Historical plant data
- `apclimits` - APC limit configurations (LL/HL for each variable)
- `optimized_targets` - Optimization results
- `optimizer_state` - Optimizer worker state (running, timer, segment)
- `optimizer_settings` - Optimizer configuration (pricing, constraints)
- `apc_violations` - Active limit violations (for notifications)

## Troubleshooting

### Worker Not Starting
- Check FastAPI version: Must be 0.116+ for lifespan events
- Check logs: Should see "🤖 Integrated Optimizer Worker Started"
- Verify Firebase connection: Should see "✓ Firebase initialized"

### Optimization Not Running
- Check Firebase `optimizer_state` collection
- Ensure `running: true` and `autoSchedule: true`
- Check timer value (default: 300 seconds = 5 minutes)
- Watch logs for "⏰ Timer expired!" message

### Firebase Connection Failed
- Verify `serviceAccountKey.json` exists in `fastapi_sim` folder
- Check file permissions
- Try setting Firebase credentials as environment variables

## Files

- `main.py` - Main FastAPI server with integrated optimizer worker
- `optimizer_worker.py` - **DEPRECATED** - Worker is now integrated in main.py
- `requirements.txt` - Python dependencies (includes httpx, firebase-admin)
- `run_server.bat` - Windows batch file to start server
- `models/` - ML models for LSF prediction

## Next Steps

- Integrate with Next.js frontend to fetch and display readings ✅
- Store readings in Firebase for historization ✅
- Deploy to Render for production use
- Set up frontend environment variable to point to Render URL
