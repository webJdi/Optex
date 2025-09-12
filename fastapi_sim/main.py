# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict
import numpy as np
import time

app = FastAPI()

# Allow CORS for local frontend development (your original code, which is correct)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- A Simplified First-Principles Plant Simulator ---

class PlantSimulator:
    def __init__(self):
        # --- State Variables ---
        self.tick = 0
        self.limestone_quality_drift = 105.0 # LSF of incoming limestone
        self.alt_fuel_moisture = 5.0 # % moisture in alternative fuel

        # --- Control Setpoints (what operators would set) ---
        self.target_lsf = 98.0
        self.target_production_rate = 150.0 # tons/hour

    def step(self):
        """
        Runs one time-step of the simulation and calculates all KPIs.
        """
        self.tick += 1

        # --- 1. Simulate External Variability ---
        self.limestone_quality_drift += np.sin(self.tick / 200) * 0.2
        self.alt_fuel_moisture += np.sin(self.tick / 300) * 0.1
        self.target_lsf += np.random.normal(0, 0.1)
        self.target_lsf = np.clip(self.target_lsf, 97.5, 98.5)

        # --- 2. Raw Mill Simulation ---
        clay_pct = np.clip(18.0 - (self.limestone_quality_drift - 105.0) * 5, 15, 22)
        limestone_pct = 100 - clay_pct - 4.0
        material_hardness = (1.2 * limestone_pct + 0.8 * clay_pct) / 100
        raw_mill_power_kw = (18.0 + material_hardness * 5) * self.target_production_rate
        sec_kwh_ton = (raw_mill_power_kw / self.target_production_rate) + np.random.normal(0, 0.2)

        # --- 3. Pyroprocessing Simulation ---
        clinker_production_rate_kg_hr = self.target_production_rate * 1000 * 0.65
        base_shc = 740 + (self.alt_fuel_moisture - 5.0) * 10
        total_energy_kcal_hr = base_shc * clinker_production_rate_kg_hr
        tsr_pct = np.clip(25.0 - (self.alt_fuel_moisture - 5.0) * 3 + np.sin(self.tick/100) * 5, 15, 40)
        energy_from_alt_fuels = total_energy_kcal_hr * (tsr_pct / 100.0)
        energy_from_trad_fuels = total_energy_kcal_hr * (1 - tsr_pct / 100.0)
        trad_fuel_rate_kg_hr = energy_from_trad_fuels / 7000
        alt_fuel_rate_kg_hr = energy_from_alt_fuels / 4500
        
        # --- 4. Assemble the Final Data Packet ---
        final_lsf = self.target_lsf + np.random.normal(0, 0.15)
        final_shc = (total_energy_kcal_hr / clinker_production_rate_kg_hr) + np.random.normal(0, 5)

        return {
            "timestamp": int(time.time()),
            "kpi": {
                "shc_kcal_kg": round(final_shc, 1),
                "lsf": round(final_lsf, 2),
                "sec_kwh_ton": round(sec_kwh_ton, 2),
                "tsr_pct": round(tsr_pct, 2)
            },
            "raw_mill": {
                "limestone_feeder_pct": round(limestone_pct, 2),
                "clay_feeder_pct": round(clay_pct, 2),
                "power_kw": round(raw_mill_power_kw, 0)
            },
            "kiln": {
                "burning_zone_temp_c": round(1450 + (base_shc - 740) * 2 + np.random.normal(0, 5), 1),
                "trad_fuel_rate_kg_hr": round(trad_fuel_rate_kg_hr, 0),
                "alt_fuel_rate_kg_hr": round(alt_fuel_rate_kg_hr, 0),
                "kiln_speed_rpm": round(3.5 + np.sin(self.tick / 50) * 0.2, 2)
            },
            "production": {
                "clinker_rate_tph": round(clinker_production_rate_kg_hr / 1000, 2)
            }
        }

# --- Creating a single instance of the simulator ---
# This ensures the state is maintained between API calls
plant_simulator = PlantSimulator()

# --- Define Pydantic Models for the new, structured response ---
# This is good practice for type checking and API documentation
class KpiModel(BaseModel):
    shc_kcal_kg: float
    lsf: float
    sec_kwh_ton: float
    tsr_pct: float

class RawMillModel(BaseModel):
    limestone_feeder_pct: float
    clay_feeder_pct: float
    power_kw: int

class KilnModel(BaseModel):
    burning_zone_temp_c: float
    trad_fuel_rate_kg_hr: int
    alt_fuel_rate_kg_hr: int
    kiln_speed_rpm: float

class ProductionModel(BaseModel):
    clinker_rate_tph: float

class PlantStateResponse(BaseModel):
    timestamp: int
    kpi: KpiModel
    raw_mill: RawMillModel
    kiln: KilnModel
    production: ProductionModel


# --- API Endpoints ---
@app.get("/live_plant_state", response_model=PlantStateResponse)
def get_live_plant_state():
    """
    Runs one simulation step and returns the complete, structured plant state.
    This replaces your old /reading endpoint.
    """
    return plant_simulator.step()

@app.get("/")
def read_root():
    return {"message": "Cement Plant Live Data Simulator is running"}