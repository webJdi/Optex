"""
Quick test script to verify fuel and temperature fluctuations
"""
import requests
import time

print("Testing Plant Simulator Fluctuations")
print("=" * 60)

# Get 10 consecutive readings
for i in range(10):
    response = requests.get("http://localhost:8000/live_plant_state")
    if response.status_code == 200:
        data = response.json()
        
        trad_fuel = data['kiln']['trad_fuel_rate_kg_hr']
        alt_fuel = data['kiln']['alt_fuel_rate_kg_hr']
        temp = data['kiln']['burning_zone_temp_c']
        
        print(f"Reading {i+1:2d}: Trad Fuel: {trad_fuel:6.0f} kg/hr | Alt Fuel: {alt_fuel:5.0f} kg/hr | Temp: {temp:6.1f}°C")
    else:
        print(f"Error: {response.status_code}")
    
    time.sleep(1)

print("=" * 60)
print("✓ Check the values above - they should vary between readings!")
print("✓ Traditional Fuel should vary by ±70 kg/hr")
print("✓ Burning Zone Temp should vary by ±20°C")
