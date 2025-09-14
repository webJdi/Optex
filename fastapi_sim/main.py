# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict
import numpy as np
import time
import joblib
import pandas as pd
import os

app = FastAPI()

# Allow CORS for local frontend development (your original code, which is correct)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Load ML Models for Predictions ---
def load_models():
    """Load all SVR models from the models directory"""
    models = {}
    import os
    current_dir = os.path.dirname(os.path.abspath(__file__))
    
    model_files = {
        'strength': os.path.join(current_dir, 'models', 'strength_svr_model.pkl'),
        'lsf': os.path.join(current_dir, 'models', 'lsf_svr_model.pkl'), 
        'free_lime': os.path.join(current_dir, 'models', 'free_lime_svr_model.pkl'),
        'blaine': os.path.join(current_dir, 'models', 'blaine_svr_model.pkl')
    }
    
    for model_name, file_path in model_files.items():
        try:
            print(f"Attempting to load {model_name} from {file_path}")
            if os.path.exists(file_path):
                with open(file_path, 'rb') as f:
                    loaded_object = joblib.load(f)
                    print(f"  Loaded object type: {type(loaded_object)}")
                    print(f"  Object details: {str(loaded_object)[:100]}...")
                    if hasattr(loaded_object, 'predict'):
                        models[model_name] = loaded_object
                        print(f"✓ Loaded {model_name} model (has predict method)")
                    else:
                        print(f"✗ Object has no predict method - Type: {type(loaded_object)}")
                        models[model_name] = None
            else:
                print(f"✗ File not found: {file_path}")
                models[model_name] = None
        except Exception as e:
            print(f"✗ Failed to load {model_name} model: {e}")
            models[model_name] = None
    
    return models

# Load models at startup
ml_models = load_models()

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
        
        # Mill throughput calculation based on power and material properties
        mill_throughput_tph = self.target_production_rate + np.random.normal(0, 2)
        
        # Mill power consumption per ton
        mill_power_kwh_ton = sec_kwh_ton + np.random.normal(0, 0.5)
        
        # Mill vibration - increases with throughput and material hardness
        base_vibration = 2.5 + material_hardness * 3
        mill_vibration_mm_s = base_vibration + (mill_throughput_tph / 200) * 2 + np.random.normal(0, 0.3)
        mill_vibration_mm_s = np.clip(mill_vibration_mm_s, 1.0, 8.0)
        
        # Separator speed - adjusted based on fineness requirements
        separator_speed_rpm = 75 + (self.target_lsf - 98) * 50 + np.random.normal(0, 5)
        separator_speed_rpm = np.clip(separator_speed_rpm, 60, 120)

        # --- 3. Pyroprocessing Simulation ---
        clinker_production_rate_kg_hr = self.target_production_rate * 1000 * 0.65
        base_shc = 740 + (self.alt_fuel_moisture - 5.0) * 10
        total_energy_kcal_hr = base_shc * clinker_production_rate_kg_hr
        tsr_pct = np.clip(25.0 - (self.alt_fuel_moisture - 5.0) * 3 + np.sin(self.tick/100) * 5, 15, 40)
        energy_from_alt_fuels = total_energy_kcal_hr * (tsr_pct / 100.0)
        energy_from_trad_fuels = total_energy_kcal_hr * (1 - tsr_pct / 100.0)
        trad_fuel_rate_kg_hr = energy_from_trad_fuels / 7000
        alt_fuel_rate_kg_hr = energy_from_alt_fuels / 4500
        
        # Burning zone temperature - influenced by fuel rates and heat transfer
        burning_zone_temp_c = 1450 + (base_shc - 740) * 2 + np.random.normal(0, 5)
        burning_zone_temp_c = np.clip(burning_zone_temp_c, 1400, 1500)
        
        # Kiln speed - optimized for residence time and production rate
        base_kiln_speed = 3.5
        kiln_speed_rpm = base_kiln_speed + (clinker_production_rate_kg_hr - 97500) / 50000 + np.sin(self.tick / 50) * 0.2
        kiln_speed_rpm = np.clip(kiln_speed_rpm, 2.8, 4.5)
        
        # Kiln motor torque - related to material load and kiln speed
        material_load_factor = clinker_production_rate_kg_hr / 100000
        kiln_motor_torque_pct = 65 + material_load_factor * 20 + (4.0 - kiln_speed_rpm) * 5 + np.random.normal(0, 3)
        kiln_motor_torque_pct = np.clip(kiln_motor_torque_pct, 50, 85)
        
        # O2 level - controlled based on combustion efficiency
        excess_air_factor = 1.15 + (tsr_pct - 25) * 0.01
        o2_level_pct = (excess_air_factor - 1) * 21 + np.random.normal(0, 0.3)
        o2_level_pct = np.clip(o2_level_pct, 2.0, 6.0)
        
        # Clinker temperature at cooler discharge
        clinker_temp_c = burning_zone_temp_c - 1200 + np.random.normal(0, 10)
        clinker_temp_c = np.clip(clinker_temp_c, 80, 120)
        
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
                "power_kw": round(raw_mill_power_kw, 0),
                "mill_power_kwh_ton": round(mill_power_kwh_ton, 2),
                "mill_vibration_mm_s": round(mill_vibration_mm_s, 2),
                "separator_speed_rpm": round(separator_speed_rpm, 0),
                "mill_throughput_tph": round(mill_throughput_tph, 1)
            },
            "kiln": {
                "burning_zone_temp_c": round(burning_zone_temp_c, 1),
                "trad_fuel_rate_kg_hr": round(trad_fuel_rate_kg_hr, 0),
                "alt_fuel_rate_kg_hr": round(alt_fuel_rate_kg_hr, 0),
                "kiln_speed_rpm": round(kiln_speed_rpm, 2),
                "kiln_motor_torque_pct": round(kiln_motor_torque_pct, 1),
                "o2_level_pct": round(o2_level_pct, 2)
            },
            "production": {
                "clinker_rate_tph": round(clinker_production_rate_kg_hr / 1000, 2),
                "clinker_temp_c": round(clinker_temp_c, 1)
            }
        }

# --- Creating a single instance of the simulator ---
plant_simulator = PlantSimulator()

class KpiModel(BaseModel):
    shc_kcal_kg: float
    lsf: float
    sec_kwh_ton: float
    tsr_pct: float

class RawMillModel(BaseModel):
    limestone_feeder_pct: float
    clay_feeder_pct: float
    power_kw: int
    mill_power_kwh_ton: float
    mill_vibration_mm_s: float
    separator_speed_rpm: float
    mill_throughput_tph: float

class KilnModel(BaseModel):
    burning_zone_temp_c: float
    trad_fuel_rate_kg_hr: int
    alt_fuel_rate_kg_hr: int
    kiln_speed_rpm: float
    kiln_motor_torque_pct: float
    o2_level_pct: float

class ProductionModel(BaseModel):
    clinker_rate_tph: float
    clinker_temp_c: float

class PlantStateResponse(BaseModel):
    timestamp: int
    kpi: KpiModel
    raw_mill: RawMillModel
    kiln: KilnModel
    production: ProductionModel

# --- ML Prediction Models ---
class PredictionInput(BaseModel):
    # Input features for ML predictions (typical cement plant parameters)
    #Input features for LSF
    limestone_pct: float = 80.0
    clay_pct: float = 12.0
    mill_power: float = 100.0
    mill_vibration: float = 4.0

    #Input features for Free Lime
    burning_zone_temp: float = 1450.0
    kiln_speed: float = 3.5
    kiln_motor_torque: float = 70.0
    o2_level: float = 4.0

    #Input features for Blaine
    separator_speed: float = 80.0
    mill_throughput: float = 150.0
    clinker_temperature: float = 100.0

    #Input features for Strength
    raw_mill_lsf: float = 98.0
    free_lime: float = 1.2
    
class PredictionResponse(BaseModel):
    strength_mpa: float
    lsf_predicted: float
    free_lime_pct: float
    blaine_cm2_g: float
    prediction_confidence: str

# --- ML Prediction Functions ---
def make_predictions(input_data: PredictionInput) -> PredictionResponse:
    """Make predictions using loaded ML models"""
    
    # Prepare feature vectors for each model based on the new PredictionInput structure
    features_lsf = pd.DataFrame([{
        'limestone_feeder_pct': input_data.limestone_pct,
        'clay_feeder_pct': input_data.clay_pct, 
        'mill_power_kwh_ton': input_data.mill_power,
        'mill_vibration_mm_s':input_data.mill_vibration
    }])
    
    features_free_lime = pd.DataFrame([{
        'burning_zone_temp_c':input_data.burning_zone_temp,
        'kiln_speed_rpm':input_data.kiln_speed,
        'kiln_motor_torque_pct':input_data.kiln_motor_torque,
        'o2_level_pct':input_data.o2_level
    }])
    
    features_blaine = pd.DataFrame([{
        'separator_speed_rpm': input_data.separator_speed,
        'mill_throughput_tph': input_data.mill_throughput,
        'clinker_temp_c': input_data.clinker_temperature
    }])
    
    features_strength = pd.DataFrame([{
        'raw_meal_lsf': input_data.raw_mill_lsf,
        'clinker_free_lime': input_data.free_lime
    }])
    
    # Debug: Print input features being sent to models
    print("\n=== ML MODEL INPUT DEBUGGING ===")
    print(f"LSF Model Input: {features_lsf}")
    print(f"  - limestone_pct: {input_data.limestone_pct}")
    print(f"  - clay_pct: {input_data.clay_pct}")
    print(f"  - mill_power: {input_data.mill_power}")
    print(f"  - mill_vibration: {input_data.mill_vibration}")
    
    print(f"Free Lime Model Input: {features_free_lime}")
    print(f"  - burning_zone_temp: {input_data.burning_zone_temp}")
    print(f"  - kiln_speed: {input_data.kiln_speed}")
    print(f"  - kiln_motor_torque: {input_data.kiln_motor_torque}")
    print(f"  - o2_level: {input_data.o2_level}")
    
    print(f"Blaine Model Input: {features_blaine}")
    print(f"  - separator_speed: {input_data.separator_speed}")
    print(f"  - mill_throughput: {input_data.mill_throughput}")
    print(f"  - clinker_temperature: {input_data.clinker_temperature}")
    
    print(f"Strength Model Input: {features_strength}")
    print(f"  - raw_mill_lsf: {input_data.raw_mill_lsf}")
    print(f"  - free_lime: {input_data.free_lime}")
    print("================================\n")
    
    predictions = {}
    confidence = "high"
    
    # Debug: Print model availability
    print("=== MODEL AVAILABILITY ===")
    for model_name, model in ml_models.items():
        print(f"{model_name}: {'✓ Loaded' if model is not None else '✗ Not loaded'}")
    print("===========================\n")
    
    # Make predictions with each model
    try:
        if ml_models['lsf'] is not None:
            lsf_pred = ml_models['lsf'].predict(features_lsf)[0]
            predictions['lsf'] = lsf_pred
            print(f"LSF Prediction: {lsf_pred}")
        else:
            predictions['lsf'] = 98.0  # fallback
            confidence = "low"
            print("LSF: Using fallback value (model not loaded)")
            
        if ml_models['free_lime'] is not None:
            free_lime_pred = ml_models['free_lime'].predict(features_free_lime)[0]
            predictions['free_lime'] = free_lime_pred
            print(f"Free Lime Prediction: {free_lime_pred}")
        else:
            predictions['free_lime'] = 1.2  # fallback
            confidence = "low"
            print("Free Lime: Using fallback value (model not loaded)")
            
        if ml_models['blaine'] is not None:
            blaine_pred = ml_models['blaine'].predict(features_blaine)[0]
            predictions['blaine'] = blaine_pred
            print(f"Blaine Prediction: {blaine_pred}")
        else:
            predictions['blaine'] = 3200.0  # fallback
            confidence = "low"
            print("Blaine: Using fallback value (model not loaded)")
            
        if ml_models['strength'] is not None:
            strength_pred = ml_models['strength'].predict(features_strength)[0]
            predictions['strength'] = strength_pred
            print(f"Strength Prediction: {strength_pred}")
        else:
            predictions['strength'] = 35.0  # fallback
            confidence = "low"
            print("Strength: Using fallback value (model not loaded)")
            confidence = "low"
            
    except Exception as e:
        print(f"Prediction error: {e}")
        print(f"Model availability: {[(k, v is not None) for k, v in ml_models.items()]}")
        # Fallback values if prediction fails
        predictions = {
            'strength': 35.0,
            'lsf': 98.0, 
            'free_lime': 1.2,
            'blaine': 3200.0
        }
        confidence = "error"
    
    return PredictionResponse(
        strength_mpa=round(predictions['strength'], 1),
        lsf_predicted=round(predictions['lsf'], 2),
        free_lime_pct=round(predictions['free_lime'], 2),
        blaine_cm2_g=round(predictions['blaine'], 0),
        prediction_confidence=confidence
    )


# --- API Endpoints ---
@app.get("/live_plant_state", response_model=PlantStateResponse)
def get_live_plant_state():
    """
    Runs one simulation step and returns the complete, structured plant state.
    This replaces your old /reading endpoint.
    """
    return plant_simulator.step()

@app.post("/predict", response_model=PredictionResponse)
def predict_cement_properties(input_data: PredictionInput):
    """
    Make ML predictions for cement properties based on input parameters
    """
    return make_predictions(input_data)

@app.get("/predict_from_current_state", response_model=PredictionResponse)
def predict_from_current_plant_state():
    """
    Make predictions using current plant state as input
    """
    current_state = plant_simulator.step()
    
    # Convert current plant state to prediction input with simulation values
    prediction_input = PredictionInput(
        limestone_pct=current_state['raw_mill']['limestone_feeder_pct'],
        clay_feeder_pct=current_state['raw_mill']['clay_feeder_pct'],
        mill_power=current_state['raw_mill']['mill_power_kwh_ton'],
        mill_vibration=current_state['raw_mill']['mill_vibration_mm_s'],
        burning_zone_temp=current_state['kiln']['burning_zone_temp_c'],
        kiln_speed=current_state['kiln']['kiln_speed_rpm'],
        kiln_motor_torque=current_state['kiln']['kiln_motor_torque_pct'],
        o2_level=current_state['kiln']['o2_level_pct'],
        separator_speed=current_state['raw_mill']['separator_speed_rpm'],
        mill_throughput=current_state['raw_mill']['mill_throughput_tph'],
        clinker_temperature=current_state['production']['clinker_temp_c'],
        raw_mill_lsf=current_state['kpi']['lsf'],  # Use current simulated LSF
        free_lime=1.2  # Default value, could be enhanced with simulation
    )
    
    return make_predictions(prediction_input)

@app.get("/test_prediction")
def test_prediction():
    """Simple test endpoint for debugging"""
    try:
        # Test with hardcoded values
        test_input = PredictionInput(
            limestone_pct=75.0,
            clay_pct=15.0,
            mill_power=100.0,
            mill_vibration=4.5,
            burning_zone_temp=1450.0,
            kiln_speed=3.5,
            kiln_motor_torque=70.0,
            o2_level=4.2,
            separator_speed=80.0,
            mill_throughput=150.0,
            clinker_temperature=100.0,
            raw_mill_lsf=98.0,
            free_lime=1.2
        )
        
        result = make_predictions(test_input)
        return {"status": "success", "prediction": result}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/debug/models")
def debug_models():
    """Debug endpoint to check model loading status"""
    return {
        "models_loaded": {k: v is not None for k, v in ml_models.items()},
        "model_types": {k: str(type(v)) if v else None for k, v in ml_models.items()}
    }

@app.get("/")
def read_root():
    return {"message": "Cement Plant Live Data Simulator is running"}