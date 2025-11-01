"""
Test script to verify Firebase is receiving fluctuating data
Run this while monitoring Firebase console
"""

import requests
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime
import time
import os

# Initialize Firebase
service_key_path = os.path.join(os.path.dirname(__file__), "fastapi_sim", "serviceAccountKey.json")
if os.path.exists(service_key_path):
    cred = credentials.Certificate(service_key_path)
    firebase_admin.initialize_app(cred)
else:
    firebase_admin.initialize_app(options={'projectId': 'optex-b13d3'})

db = firestore.client()

print("🧪 Testing Firebase Write with Fluctuating Data")
print("=" * 60)

for i in range(10):
    # Fetch from API
    response = requests.get("http://localhost:8000/live_plant_state")
    data = response.json()
    
    temp = data['kiln']['burning_zone_temp_c']
    fuel = data['kiln']['trad_fuel_rate_kg_hr']
    timestamp = data['timestamp']
    
    print(f"Iteration {i+1}: Temp={temp}°C, Fuel={fuel} kg/hr, Timestamp={timestamp}")
    
    # Write to Firebase
    doc_ref = db.collection('plant_readings').document(str(timestamp))
    doc_ref.set({
        'timestamp': firestore.SERVER_TIMESTAMP,
        'kpi': data['kpi'],
        'raw_mill': data['raw_mill'],
        'kiln': data['kiln'],
        'production': data['production']
    })
    
    print(f"  ✅ Written to Firebase (doc ID: {timestamp})")
    
    time.sleep(3)  # Wait 3 seconds between writes

print("\n" + "=" * 60)
print("✅ Test complete! Check Firebase console - you should see 10 documents")
print("   with DIFFERENT temperatures and fuel rates in the 'kiln' field")
