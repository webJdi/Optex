# 🎯 Dual Optimization System - Quick Start

## ✅ What's Been Implemented

### Backend Changes (fastapi_sim/main.py)

1. **Firebase Integration**
   - Auto-detects `serviceAccountKey.json` or uses default credentials
   - Fetches APC limits from Firestore `apclimits` collection
   - Graceful fallback if Firebase unavailable

2. **Pricing-Based Economics**
   - Replaced fixed weights with real $/hour profit calculation
   - Configurable pricing for materials, fuels, electricity, and products
   - Economic objective drives optimization decisions

3. **Dual Optimization Engine**
   - Runs two parallel optimizations: APC limits vs Engineering limits
   - Uses Optuna TPE sampler (500 trials each)
   - Tracks trial history for convergence analysis
   - Returns economic comparison ($/hour potential gain)

4. **New API Endpoints**
   ```
   POST /optimize_targets         → Run dual optimization
   POST /update_pricing           → Update pricing config
   GET  /get_pricing             → Get current pricing
   GET  /optimization_history    → Get trial history
   ```

### Frontend Components

1. **OptimizationHistory.tsx**
   - Convergence plots (like gradient descent visualization)
   - Toggle between APC/Engineering/Both
   - Auto-refresh every 30 seconds
   - Summary stats for latest runs

2. **PricingConfiguration.tsx**
   - Edit all 7 pricing parameters
   - Save/Reset functionality
   - Validation and helpful descriptions
   - Shows how pricing affects optimization

### Testing Tools

1. **test_optimization.py**
   - Automated test script for all endpoints
   - Verifies dual optimization works
   - Shows economic comparison
   - Tests pricing and history endpoints

---

## 🚀 How to Use

### Step 1: Setup Firebase (One-Time)

**Option A: Download Service Account Key**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project `optex-b13d3`
3. Settings → Service Accounts → Generate New Private Key
4. Save as `d:\github\Optex\fastapi_sim\serviceAccountKey.json`

**Option B: Use Environment Variable**
```bash
set GOOGLE_APPLICATION_CREDENTIALS=path\to\serviceAccountKey.json
```

### Step 2: Start Backend

```bash
cd d:\github\Optex\fastapi_sim
python main.py
```

**Expected Output:**
```
✓ Firebase initialized with service account key
✓ Firestore client ready
✓ Loaded 4 ML models successfully
Uvicorn running on http://localhost:8000
```

### Step 3: Test Optimization

```bash
cd d:\github\Optex\fastapi_sim
python test_optimization.py
```

**What It Does:**
- ✅ Fetches current pricing
- ✅ Gets optimization history
- ✅ Runs dual optimization (takes ~2 minutes)
- ✅ Shows APC vs Engineering results
- ✅ Displays economic gain potential

### Step 4: Use Frontend Components

Add to your Next.js page:

```tsx
import OptimizationHistory from '@/components/OptimizationHistory';
import PricingConfiguration from '@/components/PricingConfiguration';

export default function OptimizerPage() {
  return (
    <Box>
      <PricingConfiguration />
      <OptimizationHistory />
    </Box>
  );
}
```

---

## 📊 Expected Results

### Typical Optimization Output

```
📊 APC-CONSTRAINED OPTIMIZATION:
  Economic Value: $1,250.50/hour
  Optimization Score: 45.2345
  
  Suggested Targets:
    trad_fuel_rate_kg_hr: 1,350.25
    alt_fuel_rate_kg_hr: 450.80
    raw_meal_feed_rate_tph: 180.50
    kiln_speed_rpm: 4.2
    id_fan_speed_pct: 78.5

📊 ENGINEERING-CONSTRAINED OPTIMIZATION:
  Economic Value: $1,380.75/hour
  Optimization Score: 48.7891
  
  Suggested Targets:
    trad_fuel_rate_kg_hr: 1,450.00
    alt_fuel_rate_kg_hr: 520.30
    raw_meal_feed_rate_tph: 195.00
    kiln_speed_rpm: 4.5
    id_fan_speed_pct: 82.0

💰 ECONOMIC COMPARISON:
  APC Limits:         $1,250.50/hour
  Engineering Limits: $1,380.75/hour
  Potential Gain:     $130.25/hour (10.4%)
```

### Key Insights

- **Engineering limits** typically allow higher profit (less restrictive)
- **APC limits** provide safer, more conservative operation
- **Potential gain** shows economic benefit of relaxing APC constraints
- **Convergence plots** help verify optimizer is working properly

---

## 🔧 Configuration

### Pricing Parameters (Default Values)

| Parameter | Default | Unit | Description |
|-----------|---------|------|-------------|
| Limestone Price | $15 | $/ton | Raw material cost |
| Clay Price | $12 | $/ton | Raw material cost |
| Traditional Fuel | $0.08 | $/kg | Coal/petcoke cost |
| Alternative Fuel | $0.03 | $/kg | Waste-derived fuel |
| Clinker Price | $50 | $/ton | Product revenue |
| Electricity | $0.10 | $/kWh | Power cost |
| Byproduct Credit | $5 | $/ton | Secondary revenue |

### Engineering Limits (Hard-coded Safety)

| Variable | Min | Max | Unit |
|----------|-----|-----|------|
| Traditional Fuel | 900 | 1800 | kg/hr |
| Alternative Fuel | 100 | 1000 | kg/hr |
| Raw Meal Feed | 100 | 220 | tph |
| Kiln Speed | 2.0 | 5.5 | rpm |
| ID Fan Speed | 60 | 95 | % |
| Burning Zone Temp | 1400 | 1500 | °C |
| Motor Torque | 45 | 85 | % |
| Inlet O2 | 2.0 | 6.0 | % |
| ID Fan Power | 100 | 300 | kW |

---

## 📝 Files Created/Modified

### Backend
- ✅ `fastapi_sim/main.py` - Updated with dual optimization system
- ✅ `fastapi_sim/test_optimization.py` - Test script for endpoints
- ✅ `fastapi_sim/OPTIMIZATION_SETUP.md` - Detailed setup guide
- ✅ `fastapi_sim/QUICKSTART.md` - This file

### Frontend
- ✅ `src/components/OptimizationHistory.tsx` - Convergence plot component
- ✅ `src/components/PricingConfiguration.tsx` - Pricing UI component

---

## 🐛 Troubleshooting

### "Firebase initialization failed"
- Check that `serviceAccountKey.json` exists in `fastapi_sim/` folder
- Verify service account has Firestore read permissions

### "Not enough plant data for optimization"
- Backend needs 50+ historical data points from simulator
- Run the simulator for a few minutes to generate data

### "Optimization returns None"
- Check that APC limits exist in Firebase `apclimits` collection
- Ensure limits are reasonable (not too restrictive)

### Frontend components don't load
- Verify `NEXT_PUBLIC_BACKEND_URL` in `.env.local`
- Check that backend is running on correct port
- Install required packages: `npm install recharts @mui/icons-material`

---

## 🎯 Next Steps

1. **Run the test script** to verify everything works:
   ```bash
   cd fastapi_sim
   python test_optimization.py
   ```

2. **Adjust pricing** to match your actual costs/revenue:
   - Use PricingConfiguration component in frontend
   - Or call POST `/update_pricing` endpoint

3. **Create optimizer page** combining both components:
   - Pricing configuration at top
   - Optimization history below
   - Add "Run Optimization" button

4. **Monitor results** and tune constraints:
   - Check convergence plots for proper optimization
   - Compare APC vs Engineering results
   - Adjust limits if needed

5. **Integrate with operations**:
   - Schedule periodic optimization runs
   - Apply suggested targets to plant controls
   - Track economic performance over time

---

## 📚 Resources

- **Detailed Guide:** `OPTIMIZATION_SETUP.md`
- **API Docs:** FastAPI auto-generated at `http://localhost:8000/docs`
- **Component Docs:** See inline TypeScript comments in components
- **Test Script:** `test_optimization.py` for API testing examples

---

**Ready to optimize! 🚀**

Run `python test_optimization.py` to see it in action!
