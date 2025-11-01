# APC Limit Violation Notification System

## Overview
The APC Limits page now features a persistent, Firebase-backed notification system that alerts operators when process variables violate their configured limits for extended periods.

## Features

### 1. **Persistent Violation Tracking**
- All limit violations are stored in Firebase `apc_violations` collection
- Violations persist across page refreshes and browser sessions
- Multiple tabs/windows stay synchronized via Firebase real-time listeners

### 2. **Smart Notification Logic**
- **Initial Detection**: Violation is stored in Firebase when PV crosses LL or HL
- **5-Minute Threshold**: Desktop notification sent after violation lasts 5 minutes
- **Recurring Alerts**: Notification repeats every 5 minutes until resolved
- **Auto-Clear**: Violation automatically removed when PV returns to normal range

### 3. **Visual Indicators**
- **Orange Background**: Violation < 5 minutes (warning state)
- **Red Background + Pulse**: Violation ≥ 5 minutes (critical state)
- **Duration Timer**: Shows violation duration in "MM:SS" format
- **Real-time Updates**: Visual indicators update every time data refreshes

## Firebase Collection: `apc_violations`

### Document Structure
```typescript
{
  variableName: string,        // e.g., "Burning Zone Temp"
  pv: number,                  // Current process value
  ll: number,                  // Low limit
  hl: number,                  // High limit
  violationType: 'LOW' | 'HIGH', // Which limit was violated
  startTime: Timestamp,        // When violation started
  lastNotified: Timestamp,     // When last notification was sent
}
```

### Document ID
- Uses variable name as document ID for easy lookup
- Example: `Burning_Zone_Temp`, `LSF_Prediction`

## Notification Flow

```
PV Violation Detected (PV ≤ LL or PV ≥ HL)
         ↓
Write to Firebase apc_violations collection
         ↓
Firebase listener updates all open tabs
         ↓
Visual indicator: Orange background + timer
         ↓
Wait 5 minutes (violation duration ≥ 5 min)
         ↓
Send desktop notification
         ↓
Update lastNotified timestamp in Firebase
         ↓
Wait 5 minutes (time since last notification ≥ 5 min)
         ↓
Send desktop notification again (recurring)
         ↓
Repeat until PV returns to normal
         ↓
Delete from Firebase → Visual indicators cleared
```

## Browser Notification Permissions

### First-Time Setup
1. When you first visit the APC Limits page, a permission dialog appears
2. Click "Allow" to enable desktop notifications
3. Permission is saved in browser (no need to allow again)

### Notification Features
- **Title**: Shows variable name and violation type (LOW/HIGH)
- **Body**: Displays current PV value and violated limit
- **Duration**: Shows how long violation has lasted
- **Click Action**: Clicking notification focuses the APC Limits page
- **Persistent**: Uses `requireInteraction: true` to stay visible

## Code Components

### Key Functions (in `apclimits.tsx`)

#### `storeViolation(variableName, variable)`
- Writes new violation to Firebase
- Sets `startTime` to current timestamp
- Sets `lastNotified` to 0 (not yet notified)

#### `clearViolation(variableName)`
- Deletes violation document from Firebase
- Triggered when PV returns to normal range

#### `updateLastNotified(variableName)`
- Updates `lastNotified` timestamp after sending notification
- Uses Firebase `merge: true` to preserve other fields

#### `sendLimitViolationNotification(variable)`
- Creates browser desktop notification
- Includes variable name, PV value, limit, and duration
- Handles notification click to focus page

### Firebase Listener
```typescript
useEffect(() => {
  const unsubscribe = onSnapshot(
    collection(db, 'apc_violations'), 
    (snapshot) => {
      // Update local violations state
      // Triggers re-render of visual indicators
    }
  );
  return () => unsubscribe();
}, [user]);
```

### Violation Checking Loop
```typescript
useEffect(() => {
  const checkAndNotify = async () => {
    for (const variable of allVariables) {
      const violating = variable.pv <= variable.ll || variable.pv >= variable.hl;
      const existingViolation = violations.get(variable.name);

      if (violating && !existingViolation) {
        await storeViolation(variable.name, variable);
      } else if (violating && existingViolation) {
        // Check if 5 min elapsed and send notification
        if (duration >= 5min && timeSinceLastNotification >= 5min) {
          sendNotification();
          await updateLastNotified();
        }
      } else if (!violating && existingViolation) {
        await clearViolation(variable.name);
      }
    }
  };
  
  checkAndNotify(); // Run immediately on data update
}, [manipulatedVars, controlledVars, violations]);
```

## Limitations & Notes

### Browser Notification Constraints
- **Page Must Be Open**: Notifications only work when at least one browser tab has the page open
- **Service Worker Alternative**: For true "background" notifications (page closed), would need:
  - Service worker registration
  - Web Push API implementation
  - Backend service to trigger notifications via Firebase Cloud Messaging

### Current Implementation
- ✅ Persists violations across page refreshes
- ✅ Syncs violations across multiple tabs
- ✅ Sends recurring notifications every 5 minutes
- ✅ Visual indicators update in real-time
- ❌ Does NOT send notifications when all browser tabs are closed

### Firebase Security
- Ensure Firebase security rules allow:
  - Read access to `apc_violations` for authenticated users
  - Write access to `apc_violations` for authenticated users
  - Example rule:
    ```javascript
    match /apc_violations/{document} {
      allow read, write: if request.auth != null;
    }
    ```

## Testing Checklist

- [x] Violation detected when PV crosses LL or HL
- [x] Visual indicator turns orange immediately
- [x] Duration timer starts counting
- [x] After 5 minutes, background turns red with pulse
- [x] Desktop notification appears after 5 minutes
- [x] Notification appears again 5 minutes later (recurring)
- [x] Violation persists across page refresh
- [x] Multiple tabs show same violations
- [x] Violation clears when PV returns to normal
- [x] Visual indicators disappear when violation clears

## Future Enhancements

1. **Backend Notification Service**
   - Python script monitoring `apc_violations` collection
   - Uses Firebase Cloud Messaging to send push notifications
   - Works even when browser is closed

2. **Notification History**
   - Separate `apc_violation_history` collection
   - Track all violations with timestamps
   - Generate reports on frequent violators

3. **Acknowledgement System**
   - Operator can acknowledge violation (mute notifications)
   - Adds `acknowledgedBy` and `acknowledgedAt` fields
   - Still tracks violation but stops notifications

4. **Email/SMS Alerts**
   - Integrate with SendGrid or Twilio
   - Send alerts to on-call operators
   - Escalation after multiple recurring notifications

5. **Violation Analytics**
   - Dashboard showing violation frequency
   - Heatmap of violation times
   - Correlation analysis (e.g., high temp violations during shift changes)
