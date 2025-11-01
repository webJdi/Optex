# Dual Optimization System - Setup & Usage Guide

## Overview
The backend now includes a **dual optimization system** that compares optimization results using:
1. **APC Limits** - Fetched from Firebase Firestore (user-configured constraints)
2. **Engineering Limits** - Hard-coded safety/equipment design limits

The optimization uses **pricing-based economics** instead of fixed weights, calculating profit in $/hour.

---

## 🔧 Backend Setup

### 1. Firebase Configuration

The backend tries two methods to initialize Firebase:

**Option A: Service Account Key File (Recommended for Development)**
1. Download your Firebase service account key from [Firebase Console](https://console.firebase.google.com/)
   - Go to Project Settings → Service Accounts
   - Click "Generate New Private Key"
2. Save the JSON file as `serviceAccountKey.json` in the `fastapi_sim/` directory
3. The backend will automatically detect and use it

**Option B: Default Credentials (Production/Render)**
- If no service account key is found, the backend uses default credentials
- Set environment variable: `GOOGLE_APPLICATION_CREDENTIALS` pointing to your key file
- Or deploy to a platform with built-in Firebase auth (like Render with env vars)

### 2. Install Dependencies

Make sure you have the required packages:
```bash
cd fastapi_sim
pip install firebase-admin optuna
```

### 3. Start Backend Server

```bash
cd fastapi_sim
python main.py
```

The server should show:
```
✓ Firebase initialized successfully
✓ Firestore client ready
```

---

## 🧪 Testing the Optimization

### Quick Test with Python Script

Run the test script to verify everything works:

```bash
cd fastapi_sim
python test_optimization.py
```

This will:
- ✅ Fetch current pricing configuration
- ✅ Fetch optimization history (if any)
- ✅ Run dual optimization (APC vs Engineering limits)
- ✅ Show economic comparison ($/hour)

**Expected Output:**
```
📊 APC-CONSTRAINED OPTIMIZATION:
  Economic Value: $1250.50/hour
  Optimization Score: 45.2345

📊 ENGINEERING-CONSTRAINED OPTIMIZATION:
  Economic Value: $1380.75/hour
  Optimization Score: 48.7891

💰 ECONOMIC COMPARISON:
  Potential Gain: $130.25/hour (10.4%)
```

### Manual API Testing

**Test Pricing Endpoints:**
```bash
# Get current pricing
curl http://localhost:8000/get_pricing

# Update pricing
curl -X POST http://localhost:8000/update_pricing \
  -H "Content-Type: application/json" \
  -d '{
    "limestone_price_per_ton": 18.0,
    "clay_price_per_ton": 14.0,
    "traditional_fuel_price_per_kg": 0.10,
    "alternative_fuel_price_per_kg": 0.04,
    "clinker_selling_price_per_ton": 55.0,
    "electricity_price_per_kwh": 0.12,
    "byproduct_credit_per_ton": 6.0
  }'
```

**Test Optimization:**
```bash
curl -X POST http://localhost:8000/optimize_targets \
  -H "Content-Type: application/json" \
  -d '{"segment": "Clinkerization", "n_data": 50}'
```

**Get Optimization History:**
```bash
curl http://localhost:8000/optimization_history
```

---

## 🎨 Frontend Components

### 1. OptimizationHistory Component

**Location:** `src/components/OptimizationHistory.tsx`

**Features:**
- 📈 Convergence plots showing how optimization improves over trials
- 🔄 Toggle between APC limits, Engineering limits, or both
- 📊 Summary cards showing best values and trial counts
- ⏱️ Auto-refresh every 30 seconds

**Usage:**
```tsx
import OptimizationHistory from '@/components/OptimizationHistory';

function MyPage() {
  return <OptimizationHistory />;
}
```

### 2. PricingConfiguration Component

**Location:** `src/components/PricingConfiguration.tsx`

**Features:**
- 💵 Edit all pricing parameters with validation
- 💾 Save configuration to backend
- 🔄 Reset to fetch current values
- 📝 Inline descriptions for each price
- ℹ️ Info card explaining how pricing affects optimization

**Usage:**
```tsx
import PricingConfiguration from '@/components/PricingConfiguration';

function MyPage() {
  return <PricingConfiguration />;
}
```

---

## 📊 Key Optimization Variables

### Optimization Variables (Manipulated)
- `trad_fuel_rate_kg_hr` - Traditional fuel feed rate
- `alt_fuel_rate_kg_hr` - Alternative fuel feed rate
- `raw_meal_feed_rate_tph` - Raw material feed rate
- `kiln_speed_rpm` - Kiln rotation speed
- `id_fan_speed_pct` - Induced draft fan speed

### Constraint Variables (Monitored)
- `burning_zone_temp_c` - Kiln burning zone temperature
- `kiln_motor_torque_pct` - Motor torque percentage
- `kiln_inlet_o2_pct` - Oxygen level at kiln inlet
- `id_fan_power_kw` - ID fan power consumption

### Engineering Limits (Hard-coded Safety)
```python
ENGINEERING_LIMITS = {
    'trad_fuel_rate_kg_hr': (900, 1800),
    'alt_fuel_rate_kg_hr': (100, 1000),
    'raw_meal_feed_rate_tph': (100, 220),
    'kiln_speed_rpm': (2.0, 5.5),
    'id_fan_speed_pct': (60, 95),
    'burning_zone_temp_c': (1400, 1500),
    'kiln_motor_torque_pct': (45, 85),
    'kiln_inlet_o2_pct': (2.0, 6.0),
    'id_fan_power_kw': (100, 300),
}
```

### APC Limits (From Firebase)
Stored in Firestore collection `apclimits`:
```json
{
  "mappingKey": "trad_fuel_rate_kg_hr",
  "type": "MV",
  "LL": 1000,
  "HL": 1600,
  "PV": 1350
}
```

---

## 🔬 How the Optimization Works

### Economic Objective Function

Instead of fixed weights (old approach), the optimizer now calculates **actual profit in $/hour**:

```python
Revenue = (clinker_production_tph × clinker_price) 
        + (byproducts_tph × byproduct_credit)

Costs = (limestone_tph × limestone_price)
      + (clay_tph × clay_price)
      + (trad_fuel_kg_hr × trad_fuel_price)
      + (alt_fuel_kg_hr × alt_fuel_price)
      + (electricity_kwh × electricity_price)

Economic Value = Revenue - Costs  ($/hour)
```

### Dual Optimization Process

1. **Fetch APC Limits** from Firebase `apclimits` collection
2. **Run Optimization #1** with APC limits (500 trials using Optuna TPE sampler)
3. **Run Optimization #2** with engineering limits (same settings)
4. **Track Trial History** for convergence plotting
5. **Return Both Results** with economic values for comparison

### Constraint Handling

The optimizer uses **soft penalties** for constraint violations:
- Gradual penalty proportional to violation magnitude
- Higher penalties for safety-critical constraints (e.g., temperature, under-oxygenation)
- Allows optimizer to explore near-boundary solutions

---

## 📝 Integration Examples

### Create a New Optimizer Page

```tsx
// src/pages/optimizer.tsx
import React, { useState } from 'react';
import { Box, Tabs, Tab } from '@mui/material';
import Sidebar from '@/components/Sidebar';
import OptimizationHistory from '@/components/OptimizationHistory';
import PricingConfiguration from '@/components/PricingConfiguration';

export default function OptimizerPage() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#0a0e27' }}>
      <Sidebar />
      <Box sx={{ flex: 1, p: 3 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
          <Tab label="Optimization History" />
          <Tab label="Pricing Configuration" />
        </Tabs>
        
        {activeTab === 0 && <OptimizationHistory />}
        {activeTab === 1 && <PricingConfiguration />}
      </Box>
    </Box>
  );
}
```

### Trigger Optimization from Frontend

```tsx
async function runOptimization() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  
  const response = await fetch(`${backendUrl}/optimize_targets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      segment: 'Clinkerization',
      n_data: 50
    })
  });
  
  const result = await response.json();
  
  console.log('APC Economic Value:', result.apc_optimization.economic_value);
  console.log('Engineering Economic Value:', result.engineering_optimization.economic_value);
}
```

---

## 🐛 Troubleshooting

### Firebase Initialization Fails
- Ensure `serviceAccountKey.json` is in `fastapi_sim/` directory
- Check that the service account has Firestore permissions
- Verify Firebase project ID matches in the credentials

### Optimization Returns Error
- Check that plant simulator has enough historical data (need 50+ data points)
- Verify Firebase `apclimits` collection has entries for all variables
- Ensure ML models are loaded (check console for model loading messages)

### Frontend Can't Connect
- Verify `NEXT_PUBLIC_BACKEND_URL` in `.env.local` (should be `http://localhost:8000` or Render URL)
- Check CORS is enabled on backend
- Ensure backend server is running

### Optimization Takes Too Long
- Default is 500 trials per optimization (× 2 = 1000 trials total)
- Reduce trials in `optimize_with_limits()` function if needed
- Typical runtime: 1-2 minutes for dual optimization

---

## 📈 Expected Results

**Typical Economic Values:**
- APC Limits: $1,200 - $1,400/hour
- Engineering Limits: $1,300 - $1,500/hour
- Potential Gain: 5-15%

**Key Insights:**
- Engineering limits usually allow higher economic value (less restrictive)
- APC limits provide safer, more conservative operation
- Price changes directly impact optimal setpoints (e.g., higher clinker price → increase production)

---

## 🚀 Next Steps

1. **Test the optimization** using `test_optimization.py`
2. **Create a dedicated optimizer page** with both components
3. **Configure pricing** to match your actual costs/revenue
4. **Run dual optimization** and compare results
5. **Monitor convergence plots** to verify optimizer performance
6. **Integrate with APC limits page** to update constraints dynamically

---

## 📚 API Reference

### POST /optimize_targets
**Request:**
```json
{
  "segment": "Clinkerization",
  "n_data": 50
}
```

**Response:**
```json
{
  "apc_optimization": {
    "success": true,
    "suggested_targets": { ... },
    "economic_value": 1250.50,
    "optimization_score": 45.23,
    "limit_type": "apc"
  },
  "engineering_optimization": {
    "success": true,
    "suggested_targets": { ... },
    "economic_value": 1380.75,
    "optimization_score": 48.78,
    "limit_type": "engineering"
  }
}
```

### POST /update_pricing
**Request:**
```json
{
  "limestone_price_per_ton": 15.0,
  "clay_price_per_ton": 12.0,
  "traditional_fuel_price_per_kg": 0.08,
  "alternative_fuel_price_per_kg": 0.03,
  "clinker_selling_price_per_ton": 50.0,
  "electricity_price_per_kwh": 0.10,
  "byproduct_credit_per_ton": 5.0
}
```

### GET /optimization_history
**Response:** Array of optimization runs with trial details

---

**Questions?** Check the backend console logs for detailed optimization progress!
