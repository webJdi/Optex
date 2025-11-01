# Firebase Setup Instructions

## Current Status
✅ Server is running successfully
⚠️ Firebase not connected - cannot fetch APC limits from Firestore

## Quick Setup to Enable APC Limits

### Option 1: Service Account Key File (Recommended)

1. **Download Firebase Service Account Key:**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Select your project: `optex-b13d3`
   - Click the gear icon ⚙️ → Project Settings
   - Go to "Service Accounts" tab
   - Click "Generate New Private Key"
   - Save the downloaded JSON file

2. **Place the Key File:**
   - Save the JSON file as: `d:\github\Optex\fastapi_sim\serviceAccountKey.json`
   - The backend will automatically detect and use it

3. **Restart the Server:**
   - Stop the current server (Ctrl+C)
   - Run `run_server.bat` again
   - You should see: `✓ Firebase initialized with service account key`

### Option 2: Environment Variable (Alternative)

If you don't want to store the key file in the project:

```powershell
# Set environment variable pointing to your key file
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\your\serviceAccountKey.json"

# Then start the server
cd d:\github\Optex\fastapi_sim
.\run_server.bat
```

### Option 3: Test Without Firebase (Use Engineering Limits Only)

The optimization will still work, but it will only use hard-coded engineering limits:

- **Current behavior:** Only engineering limits optimization runs
- **With Firebase:** Both APC limits (from Firestore) + Engineering limits optimization runs

## Verify Firebase Connection

Once you add the service account key, you should see:

```
✓ Firebase initialized with service account key: d:\github\Optex\fastapi_sim\serviceAccountKey.json
✓ Firestore client ready
```

When you run optimization, it will fetch APC limits:

```
Running optimization with APC limits...
✓ Loaded APC limit for trad_fuel_rate_kg_hr: [1000, 1600]
✓ Loaded APC limit for alt_fuel_rate_kg_hr: [200, 800]
✓ Loaded APC limit for raw_meal_feed_rate_tph: [120, 200]
...
```

## Test the Optimization

Even without Firebase, you can test the optimization:

```bash
cd d:\github\Optex\fastapi_sim
python test_optimization.py
```

This will:
- ✅ Run optimization with engineering limits
- ⚠️ Skip APC limits optimization (Firebase not connected)
- ✅ Still show economic analysis

## Next Steps

1. **Download service account key** from Firebase Console
2. **Save as** `serviceAccountKey.json` in the `fastapi_sim` folder
3. **Restart server** - it will auto-detect the key
4. **Run test** to verify both optimization cycles work

---

**Note:** The server is fully functional without Firebase, but you won't get the dual optimization (APC vs Engineering limits) feature until Firebase is connected.
