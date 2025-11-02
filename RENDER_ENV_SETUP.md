# Render Environment Configuration Guide

## 🚀 Current Status
- ✅ **Backend Deployed**: https://optex-wc0v.onrender.com
- ✅ **Basic Functionality**: Health check, plant simulation, basic optimization
- ⚠️ **Missing**: Firebase integration for APC limits

## 📋 Required Environment Variables on Render

### 1. Backend Communication
```
BACKEND_URL=https://optex-wc0v.onrender.com
```
✅ **Status**: Already configured in render.yaml

### 2. Firebase Integration (Optional but Recommended)

#### Option A: Service Account Key (Recommended)
Upload Firebase service account key as a Render secret file:

1. **Get Firebase Service Account Key**:
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Select project: `optex-b13d3`
   - Project Settings → Service Accounts → Generate New Private Key
   - Download the JSON file

2. **Upload to Render**:
   - Go to your Render service dashboard
   - Environment → Secret Files
   - Add new file: `/etc/secrets/serviceAccountKey.json`
   - Copy-paste the entire JSON content

3. **Environment Variable**:
   ```
   GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/serviceAccountKey.json
   ```

#### Option B: Project ID Only (Basic)
If you don't want to upload the service account key:
```
FIREBASE_PROJECT_ID=optex-b13d3
```
✅ **Status**: Already configured in render.yaml

## 🔧 How to Add Environment Variables on Render

### Method 1: Via Render Dashboard
1. Go to https://dashboard.render.com/
2. Select your `optex-backend` service
3. Go to **Environment** tab
4. Click **Add Environment Variable**
5. Add the required variables

### Method 2: Via render.yaml (Current Approach)
The `render.yaml` file already includes the basic configuration. For Firebase:

1. **Upload the service account key** as a secret file (see Option A above)
2. **Redeploy** the service

## 📊 What Each Variable Does

| Variable | Purpose | Required |
|----------|---------|----------|
| `BACKEND_URL` | Internal API communication for optimizer worker | ✅ Yes |
| `GOOGLE_APPLICATION_CREDENTIALS` | Firebase service account for APC limits | 🔄 Optional |
| `FIREBASE_PROJECT_ID` | Firebase project for basic auth | 🔄 Optional |

## 🧪 Testing After Configuration

1. **Health Check**: https://optex-wc0v.onrender.com/health
   - Should show `"firebase_connected": true`

2. **APC Limits**: Frontend optimizer should show both:
   - ✅ APC Limits Optimization (from Firebase)
   - ✅ Engineering Limits Optimization (hardcoded)

3. **Settings Sync**: Pricing and ML/FP ratio should sync from Firebase

## 🚨 Current Limitations Without Firebase

Without Firebase configuration, the backend will:
- ✅ **Still work** for basic plant simulation and optimization
- ✅ **Use engineering limits** for optimization (hardcoded safety limits)
- ❌ **Miss APC limits** from Firebase (operator-defined limits)
- ❌ **Miss settings sync** (pricing, ML/FP ratios from Firebase)

The system is **fully functional** without Firebase, but you lose the dynamic configuration features.

## 🔄 Next Steps

1. **Test current deployment** - everything should work except Firebase features
2. **Optionally add Firebase** - only if you need APC limits sync
3. **Monitor logs** - check Render logs for any Firebase connection messages

The backend is production-ready as-is! 🚀