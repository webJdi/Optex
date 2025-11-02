# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Optional, List, Any
import numpy as np
import time
import joblib
import pandas as pd
import os
import optuna
from threading import Lock
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
import firebase_admin
from firebase_admin import credentials, firestore
import asyncio
from contextlib import asynccontextmanager

# Global variable for background task
background_task = None
optimizer_enabled = True  # Flag to enable/disable optimizer

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan - startup and shutdown events"""
    # Startup: Start the optimizer worker in background
    global background_task, optimizer_enabled
    print("\n🚀 Starting application with integrated optimizer worker...")
    
    if optimizer_enabled:
        background_task = asyncio.create_task(optimizer_worker_loop())
        print("✓ Optimizer worker started")
    else:
        print("⚠ Optimizer worker disabled")
    
    yield  # Application runs here
    
    # Shutdown: Cancel the background task
    print("\n🛑 Shutting down optimizer worker...")
    if background_task:
        background_task.cancel()
        try:
            await background_task
        except asyncio.CancelledError:
            print("✓ Optimizer worker stopped")

app = FastAPI(lifespan=lifespan)

# Allow CORS for local frontend development (your original code, which is correct)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Firebase Admin SDK
try:
    # Initialize Firebase if not already initialized
    if not firebase_admin._apps:
        import os
        
        # Try production path first (Render secret files)
        service_key_path = "/etc/secrets/serviceAccountKey.json"
        
        # Fallback to local development path
        if not os.path.exists(service_key_path):
            service_key_path = os.path.join(os.path.dirname(__file__), "serviceAccountKey.json")
        
        if os.path.exists(service_key_path):
            cred = credentials.Certificate(service_key_path)
            firebase_admin.initialize_app(cred)
            print(f"✓ Firebase initialized with service account key: {service_key_path}")
        else:
            # Use default credentials (works with environment variables)
            firebase_admin.initialize_app(options={
                'projectId': 'optex-b13d3',
            })
            print("✓ Firebase initialized with default credentials")
    
    db = firestore.client()
    print("✓ Firestore client ready")
except Exception as e:
    print(f"⚠ Firebase initialization failed: {e}")
    print("⚠ Optimization will proceed without APC limits from Firebase")
    db = None

# Pricing configuration (can be updated via API)
class PricingConfig(BaseModel):
    limestone_price_per_ton: float = 15.0  # $/ton
    clay_price_per_ton: float = 12.0  # $/ton
    traditional_fuel_price_per_kg: float = 0.08  # $/kg
    alternative_fuel_price_per_kg: float = 0.03  # $/kg (cheaper alternative)
    clinker_selling_price_per_ton: float = 50.0  # $/ton
    electricity_price_per_kwh: float = 0.10  # $/kWh
    byproduct_credit_per_ton: float = 5.0  # $/ton (revenue from byproducts)

# Global pricing config
pricing_config = PricingConfig()

# Optimization history storage
optimization_history = []
optimization_history_lock = Lock()

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

# Generate initial plant data for optimization
def generate_initial_data():
    """Generate initial plant data on server startup"""
    print("Generating initial plant data...")
    for i in range(20):  # Generate 20 initial records
        store_plant_data()
    print(f"Generated {len(plant_data_history)} initial plant data records")

# First-principles process relationships for cement manufacturing
class CementProcessModel:
    def __init__(self):
        # Physical constants and relationships based on cement chemistry and process engineering
        self.fuel_temp_coefficient = 0.8     # °C per 100 kg/hr fuel
        self.feed_rate_speed_coefficient = 0.02  # RPM per t/h feed rate
        self.speed_torque_coefficient = 8.0   # % torque per RPM
        self.fan_speed_o2_coefficient = -0.03 # % O2 per fan speed %
        self.fan_speed_power_coefficient = 2.5 # kW per fan speed %
        
    def calculate_constraint_responses(self, optimization_vars, current_constraints):
        """Calculate constraint variable changes based on first principles"""
        
        trad_fuel = optimization_vars.get('trad_fuel_rate_kg_hr', 1200)
        alt_fuel = optimization_vars.get('alt_fuel_rate_kg_hr', 400)
        feed_rate = optimization_vars.get('raw_meal_feed_rate_tph', 150)
        kiln_speed = optimization_vars.get('kiln_speed_rpm', 3.5)
        id_fan_speed = optimization_vars.get('id_fan_speed_pct', 75)
        
        current_torque = current_constraints.get('kiln_motor_torque_pct', 70)
        current_temp = current_constraints.get('burning_zone_temp_c', 1450)
        current_o2 = current_constraints.get('kiln_inlet_o2_pct', 3.5)
        current_fan_power = current_constraints.get('id_fan_power_kw', 180)
        
        # First-principles calculations for real clinker process
        
        # 1. Burning Zone Temperature - affected by total fuel input and heat balance
        total_fuel_energy = trad_fuel * 7000 + alt_fuel * 4500  # kcal/hr
        base_energy_demand = feed_rate * 1600  # kcal/t typical energy demand
        energy_balance = (total_fuel_energy - base_energy_demand) / 100000
        new_temp = current_temp + energy_balance * self.fuel_temp_coefficient
        
        # 2. Kiln Motor Torque - affected by kiln speed and material load
        material_load_factor = feed_rate / 150  # Normalized load
        speed_effect = (kiln_speed - 3.5) * self.speed_torque_coefficient
        load_effect = (material_load_factor - 1.0) * 15  # Material resistance
        new_torque = current_torque + speed_effect + load_effect
        
        # 3. Kiln Inlet O2 - affected by ID fan speed and fuel consumption
        total_fuel_rate = trad_fuel + alt_fuel
        combustion_air_demand = total_fuel_rate / 100  # Simplified air demand
        fan_air_supply = id_fan_speed * 2  # Air supply from fan
        excess_air_ratio = fan_air_supply / max(combustion_air_demand, 1)
        new_o2 = 21 * (excess_air_ratio - 1) / max(excess_air_ratio, 1)
        
        # 4. ID Fan Power - cubic relationship with fan speed (fan laws)
        fan_power_ratio = (id_fan_speed / 75) ** 3  # Cubic fan law
        new_fan_power = 180 * fan_power_ratio  # Base 180 kW at 75% speed
        
        # Apply physical and safety limits
        new_temp = max(1400, min(1500, new_temp))    # Refractory limits
        new_torque = max(50, min(85, new_torque))    # Motor torque limits
        new_o2 = max(2.0, min(6.0, new_o2))         # Combustion efficiency limits
        new_fan_power = max(50, min(300, new_fan_power))  # Fan motor limits
        
        return {
            'burning_zone_temp_c': new_temp,
            'kiln_motor_torque_pct': new_torque,
            'kiln_inlet_o2_pct': new_o2,
            'id_fan_power_kw': new_fan_power
        }
    
    def calculate_soft_sensors(self, optimization_vars, constraint_responses, current_state):
        """Calculate soft sensor outputs: LSF, Clinker Production Rate, Energy Efficiency"""
        
        trad_fuel = optimization_vars.get('trad_fuel_rate_kg_hr', 1200)
        alt_fuel = optimization_vars.get('alt_fuel_rate_kg_hr', 400)
        feed_rate = optimization_vars.get('raw_meal_feed_rate_tph', 150)
        burning_temp = constraint_responses.get('burning_zone_temp_c', 1450)
        
        # 1. LSF Calculation - based on limestone content and process conditions
        limestone_pct = current_state.get('raw_mill', {}).get('limestone_feeder_pct', 75)
        base_lsf = 95 + (limestone_pct - 75) * 0.3  # Limestone chemistry effect
        temp_effect = (burning_temp - 1450) * 0.02   # Temperature effect on saturation
        calculated_lsf = base_lsf + temp_effect
        
        # 2. Clinker Production Rate - based on feed rate and calcination efficiency
        calcination_efficiency = min(1.0, (burning_temp - 1400) / 100)  # Temperature-dependent efficiency
        clinker_yield = 0.65 * calcination_efficiency  # Typical 65% yield at full efficiency
        clinker_production_rate = feed_rate * clinker_yield
        
        # 3. Specific Heat Consumption (SHC) - key energy efficiency metric
        total_fuel_energy = trad_fuel * 7000 + alt_fuel * 4500  # kcal/hr
        shc_kcal_kg = total_fuel_energy / (clinker_production_rate * 1000) if clinker_production_rate > 0 else 800
        
        # 4. TSR (Thermal Substitution Ratio) - alternative fuel usage
        tsr_pct = (alt_fuel * 4500) / (total_fuel_energy) * 100 if total_fuel_energy > 0 else 0
        
        return {
            'calculated_lsf': max(95, min(105, calculated_lsf)),
            'clinker_production_rate_tph': max(0, min(200, clinker_production_rate)),
            'shc_kcal_kg': max(600, min(1000, shc_kcal_kg)),
            'tsr_pct': max(0, min(50, tsr_pct))
        }

# ML-based soft sensor for LSF prediction
def predict_lsf_from_features(limestone_pct, clay_pct, mill_power, mill_vibration):
    """
    Predict LSF using the trained soft sensor model
    
    Args:
        limestone_pct: Limestone feeder percentage
        clay_pct: Clay feeder percentage  
        mill_power: Mill power consumption (kWh/ton)
        mill_vibration: Mill vibration (mm/s)
    
    Returns:
        Predicted LSF value
    """
    if ml_models['lsf'] is None:
        print("⚠ LSF model not loaded, using fallback")
        return 97.5  # Default target LSF
    
    try:
        # Prepare features for LSF model - MUST match training data column names
        features_lsf = pd.DataFrame([{
            'limestone_feeder_pct': limestone_pct,
            'clay_feeder_pct': clay_pct,
            'mill_power_kwh_ton': mill_power,
            'mill_vibration_mm_s': mill_vibration
        }])
        
        print(f"LSF Model Input: limestone={limestone_pct:.2f}%, clay={clay_pct:.2f}%, power={mill_power:.2f}, vib={mill_vibration:.2f}")
        
        # Predict LSF using ML model
        lsf_pred = ml_models['lsf'].predict(features_lsf)[0]
        
        print(f"✓ LSF Model Prediction: {lsf_pred:.2f}")
        
        # LSF typically ranges from 85-105 in cement manufacturing
        # Only clamp to prevent extreme outliers
        if lsf_pred < 80 or lsf_pred > 110:
            print(f"⚠ LSF prediction {lsf_pred:.2f} outside extreme range [80-110], clamping")
            lsf_pred = np.clip(lsf_pred, 80.0, 110.0)
        
        return float(lsf_pred)
        
    except Exception as e:
        print(f"✗ LSF prediction error: {e}")
        import traceback
        traceback.print_exc()
        return 97.5  # Fallback

# ML-based relationship learning
class MLRelationshipModel:
    def __init__(self):
        self.models = {}
        self.scalers = {}
        self.is_trained = False
        
    def train_from_historical_data(self, plant_history):
        """Train ML models to learn complex relationships"""
        if len(plant_history) < 10:
            return False
            
        # Prepare training data
        X_data = []
        y_temp = []
        y_torque = []
        y_o2 = []
        y_fan_power = []
        
        for record in plant_history:
            # Features: optimization variables (what we control)
            features = [
                record['kiln']['trad_fuel_rate_kg_hr'],
                record['kiln']['alt_fuel_rate_kg_hr'],
                record['kiln'].get('raw_meal_feed_rate_tph', record['production']['clinker_rate_tph'] / 0.65),
                record['kiln']['kiln_speed_rpm'],
                record['kiln'].get('id_fan_speed_pct', 75)
            ]
            
            # Targets: constraint variables (what we monitor/constrain)
            temp = record['kiln']['burning_zone_temp_c']
            torque = record['kiln'].get('kiln_motor_torque_pct', 70)
            o2 = record['kiln'].get('kiln_inlet_o2_pct', record['kiln'].get('o2_level_pct', 3.5))
            fan_power = record['kiln'].get('id_fan_power_kw', 180)
            
            X_data.append(features)
            y_temp.append(temp)
            y_torque.append(torque)
            y_o2.append(o2)
            y_fan_power.append(fan_power)
        
        X = np.array(X_data)
        
        # Train separate models for each constraint variable
        self.scalers['X'] = StandardScaler()
        X_scaled = self.scalers['X'].fit_transform(X)
        
        # Burning zone temperature model
        self.models['temp'] = RandomForestRegressor(n_estimators=50, random_state=42)
        self.models['temp'].fit(X_scaled, y_temp)
        
        # Kiln motor torque model
        self.models['torque'] = RandomForestRegressor(n_estimators=50, random_state=42)
        self.models['torque'].fit(X_scaled, y_torque)
        
        # Kiln inlet O2 model
        self.models['o2'] = RandomForestRegressor(n_estimators=50, random_state=42)
        self.models['o2'].fit(X_scaled, y_o2)
        
        # ID fan power model
        self.models['fan_power'] = RandomForestRegressor(n_estimators=50, random_state=42)
        self.models['fan_power'].fit(X_scaled, y_fan_power)
        
        self.is_trained = True
        return True
        
    def predict_constraints(self, optimization_vars):
        """Predict constraint variables using ML models"""
        if not self.is_trained:
            return None
            
        features = np.array([[
            optimization_vars.get('trad_fuel_rate_kg_hr', 1200),
            optimization_vars.get('alt_fuel_rate_kg_hr', 400),
            optimization_vars.get('raw_meal_feed_rate_tph', 150),
            optimization_vars.get('kiln_speed_rpm', 3.5),
            optimization_vars.get('id_fan_speed_pct', 75)
        ]])
        
        X_scaled = self.scalers['X'].transform(features)
        
        predictions = {
            'burning_zone_temp_c': float(self.models['temp'].predict(X_scaled)[0]),
            'kiln_motor_torque_pct': float(self.models['torque'].predict(X_scaled)[0]),
            'kiln_inlet_o2_pct': float(self.models['o2'].predict(X_scaled)[0]),
            'id_fan_power_kw': float(self.models['fan_power'].predict(X_scaled)[0])
        }
        
        return predictions

# Hybrid model combining first principles and ML
class HybridProcessModel:
    def __init__(self, ml_weight=0.3):
        self.first_principles = CementProcessModel()
        self.ml_model = MLRelationshipModel()
        self.ml_weight = ml_weight  # Weight for ML vs first principles (configurable)
        
    def set_ml_weight(self, ml_weight):
        """Update the ML weight ratio"""
        self.ml_weight = ml_weight
        print(f"ML weight updated to: {ml_weight:.2f} (FP: {1-ml_weight:.2f})")
        
    def update_ml_model(self, plant_history):
        """Update ML model with new plant data"""
        success = self.ml_model.train_from_historical_data(plant_history)
        if success:
            print(f"✓ ML model updated with {len(plant_history)} data points")
        return success
        
    def predict_constraint_responses(self, optimization_vars, current_constraints, current_mill_state=None):
        """Hybrid prediction combining first principles and ML, now including LSF soft sensor
        
        Args:
            optimization_vars: Dict with optimization variables including raw_meal_feed_rate_tph and limestone_to_clay_ratio
            current_constraints: Current constraint variable values
            current_mill_state: Dict with current mill_power_kwh_ton and mill_vibration_mm_s from plant
        """
        
        # Get first-principles predictions
        fp_predictions = self.first_principles.calculate_constraint_responses(
            optimization_vars, current_constraints
        )
        
        # Get ML predictions if available
        ml_predictions = self.ml_model.predict_constraints(optimization_vars)
        
        if ml_predictions is None:
            # Use pure first principles if ML not trained
            print("Using first-principles only (ML not trained)")
            hybrid_predictions = fp_predictions
        else:
            # Hybrid approach: weighted combination
            hybrid_predictions = {}
            for var in fp_predictions:
                fp_value = fp_predictions[var]
                ml_value = ml_predictions[var]
                
                # Weighted average
                hybrid_value = (1 - self.ml_weight) * fp_value + self.ml_weight * ml_value
                hybrid_predictions[var] = hybrid_value
                
            print(f"Using hybrid model (FP: {1-self.ml_weight:.1f}, ML: {self.ml_weight:.1f})")
        
        # Add LSF prediction using soft sensor with actual mill parameters
        # Extract optimization variables
        feed_rate = optimization_vars.get('raw_meal_feed_rate_tph', 150)
        limestone_to_clay_ratio = optimization_vars.get('limestone_to_clay_ratio', 4.0)  # New MV!
        
        # Calculate limestone and clay percentages from feed_rate and ratio
        # limestone_to_clay_ratio = limestone_pct / clay_pct
        # limestone_pct + clay_pct + minor_components = 100
        # Assuming minor components = 5%
        minor_components = 5.0
        remaining = 100.0 - minor_components
        
        # limestone_pct = ratio * clay_pct
        # ratio * clay_pct + clay_pct = remaining
        # clay_pct * (ratio + 1) = remaining
        clay_pct = remaining / (limestone_to_clay_ratio + 1)
        limestone_pct = limestone_to_clay_ratio * clay_pct
        
        # Use actual mill parameters from current plant state if available
        if current_mill_state:
            mill_power = current_mill_state.get('mill_power_kwh_ton', 15.0)
            mill_vibration = current_mill_state.get('mill_vibration_mm_s', 4.0)
            print(f"✓ Using actual mill parameters: Power={mill_power:.2f} kWh/ton, Vibration={mill_vibration:.2f} mm/s")
        else:
            # Estimate mill power based on feed rate (fallback)
            mill_power = 15.0 + (feed_rate / 10)  # kWh/ton estimate
            mill_vibration = 3.5 + (feed_rate - 150) * 0.02
            print(f"⚠ Estimating mill parameters: Power={mill_power:.2f} kWh/ton, Vibration={mill_vibration:.2f} mm/s")
        
        # Use soft sensor to predict LSF
        predicted_lsf = predict_lsf_from_features(
            limestone_pct=limestone_pct,
            clay_pct=clay_pct,
            mill_power=mill_power,
            mill_vibration=mill_vibration
        )
        
        print(f"✓ Feed Ratio: {limestone_to_clay_ratio:.2f} → Limestone: {limestone_pct:.1f}%, Clay: {clay_pct:.1f}% → LSF: {predicted_lsf:.2f}")
        
        # Add LSF to hybrid predictions
        hybrid_predictions['lsf_predicted'] = predicted_lsf
            
        return hybrid_predictions

# Initialize hybrid model
hybrid_model = HybridProcessModel()

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
        
        # --- Control System Variables ---
        self.optimizer_targets = None  # Current optimizer targets
        self.actual_values = {
            'trad_fuel_rate_kg_hr': 1200.0,
            'alt_fuel_rate_kg_hr': 400.0, 
            'raw_meal_feed_rate_tph': 150.0,
            'kiln_speed_rpm': 3.5,
            'id_fan_speed_pct': 75.0
        }
        self.control_active = False
        self.control_response_rate = 0.1  # How fast the plant responds (0.1 = 10% per step)
        self.last_control_update = time.time()

    def step(self):
        """
        Runs one time-step of the simulation and calculates all KPIs.
        """
        self.tick += 1
        
        # Apply control actions first (move towards targets)
        self.apply_control_actions()

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

        # --- 3. Pyroprocessing Simulation (using actual controlled values) ---
        # Use actual controlled values with realistic disturbances
        # Add fuel flow disturbances (pressure variations, fuel quality variations)
        # Increased disturbances for better visibility
        trad_fuel_disturbance = np.random.normal(0, 40) + np.sin(self.tick / 100) * 30  # ±70 kg/hr variation
        alt_fuel_disturbance = np.random.normal(0, 20) + np.sin(self.tick / 120) * 15   # ±35 kg/hr variation
        
        trad_fuel_rate_kg_hr = self.actual_values['trad_fuel_rate_kg_hr'] + trad_fuel_disturbance
        trad_fuel_rate_kg_hr = np.clip(trad_fuel_rate_kg_hr, 900, 1800)  # Keep within safe limits
        
        alt_fuel_rate_kg_hr = self.actual_values['alt_fuel_rate_kg_hr'] + alt_fuel_disturbance
        alt_fuel_rate_kg_hr = np.clip(alt_fuel_rate_kg_hr, 100, 1000)
        
        # Log disturbances every 10 ticks for debugging
        if self.tick % 10 == 0:
            print(f"🔥 Tick {self.tick}: Trad Fuel: {self.actual_values['trad_fuel_rate_kg_hr']:.0f} → {trad_fuel_rate_kg_hr:.0f} (Δ{trad_fuel_disturbance:+.0f})")
        
        raw_meal_feed_rate_tph = self.actual_values['raw_meal_feed_rate_tph']
        kiln_speed_rpm = self.actual_values['kiln_speed_rpm']
        id_fan_speed_pct = self.actual_values['id_fan_speed_pct']
        
        # Calculate derived values based on controlled variables
        clinker_production_rate_kg_hr = raw_meal_feed_rate_tph * 1000 * 0.65
        total_energy_kcal_hr = (trad_fuel_rate_kg_hr * 7000) + (alt_fuel_rate_kg_hr * 4500)
        base_shc = total_energy_kcal_hr / clinker_production_rate_kg_hr if clinker_production_rate_kg_hr > 0 else 740
        tsr_pct = (alt_fuel_rate_kg_hr * 4500) / total_energy_kcal_hr * 100 if total_energy_kcal_hr > 0 else 25
        
        # Burning zone temperature - influenced by fuel rates and heat transfer
        # Use fuel deviation from setpoint instead of SHC (more realistic)
        fuel_deviation = (trad_fuel_rate_kg_hr - 1200) + (alt_fuel_rate_kg_hr - 400) * 0.5  # Combined fuel effect
        fuel_heat_effect = fuel_deviation * 0.15  # Temperature increases ~0.15°C per kg/hr fuel increase
        thermal_disturbance = np.random.normal(0, 12)  # Increased temperature noise for visibility
        thermal_lag = np.sin(self.tick / 80) * 8  # Thermal inertia oscillation (faster cycle, larger amplitude)
        
        burning_zone_temp_c = 1450 + fuel_heat_effect + thermal_disturbance + thermal_lag
        burning_zone_temp_c = np.clip(burning_zone_temp_c, 1400, 1500)
        
        # Log temperature fluctuations every 10 ticks
        if self.tick % 10 == 0:
            print(f"🌡️  Tick {self.tick}: Burning Zone Temp: {burning_zone_temp_c:.1f}°C (Base: 1450 + Fuel Effect: {fuel_heat_effect:+.1f} + Noise: {thermal_disturbance:+.1f} + Lag: {thermal_lag:+.1f})")
            print(f"    SHC: {base_shc:.1f} kcal/kg | Trad Fuel: {trad_fuel_rate_kg_hr:.0f} kg/hr | Alt Fuel: {alt_fuel_rate_kg_hr:.0f} kg/hr")
        
        # Kiln motor torque - related to material load and kiln speed
        material_load_factor = clinker_production_rate_kg_hr / 100000
        kiln_motor_torque_pct = 65 + material_load_factor * 20 + (4.0 - kiln_speed_rpm) * 5 + np.random.normal(0, 3)
        kiln_motor_torque_pct = np.clip(kiln_motor_torque_pct, 50, 85)
        
        # Calculate excess air factor based on controlled fan speed
        excess_air_factor = 1.0 + (id_fan_speed_pct - 70) * 0.005
        
        # ID Fan Power follows cubic fan law
        id_fan_power_kw = 180 * (id_fan_speed_pct / 75) ** 3
        id_fan_power_kw = np.clip(id_fan_power_kw, 50, 300)
        
        # O2 levels - kiln inlet and outlet
        kiln_inlet_o2_pct = (excess_air_factor - 1) * 21 + np.random.normal(0, 0.3)
        kiln_inlet_o2_pct = np.clip(kiln_inlet_o2_pct, 2.0, 6.0)
        
        kiln_outlet_o2_pct = kiln_inlet_o2_pct - 0.7 + np.random.normal(0, 0.2)
        kiln_outlet_o2_pct = np.clip(kiln_outlet_o2_pct, 1.5, 4.0)
        
        # Kiln inlet temperature
        kiln_inlet_temp_c = 850 + (burning_zone_temp_c - 1450) * 0.3 + np.random.normal(0, 15)
        kiln_inlet_temp_c = np.clip(kiln_inlet_temp_c, 800, 900)
        
        # Clinker temperature at cooler discharge
        clinker_temp_c = burning_zone_temp_c - 1200 + np.random.normal(0, 10)
        clinker_temp_c = np.clip(clinker_temp_c, 80, 120)
        
        # --- 4. Calculate LSF using Soft Sensor (instead of simulated value) ---
        # Use the ML-based soft sensor for LSF prediction
        predicted_lsf = predict_lsf_from_features(
            limestone_pct=limestone_pct,
            clay_pct=clay_pct,
            mill_power=mill_power_kwh_ton,
            mill_vibration=mill_vibration_mm_s
        )
        
        # --- 5. Assemble the Final Data Packet ---
        final_shc = (total_energy_kcal_hr / clinker_production_rate_kg_hr) + np.random.normal(0, 5)
        
        # Calculate limestone to clay ratio from raw material percentages
        limestone_to_clay_ratio = limestone_pct / clay_pct if clay_pct > 0 else 4.0

        return {
            "timestamp": int(time.time()),
            "kpi": {
                "shc_kcal_kg": round(final_shc, 1),
                "lsf": round(predicted_lsf, 2),  # Using soft sensor prediction
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
                "kiln_inlet_temp_c": round(kiln_inlet_temp_c, 1),
                "trad_fuel_rate_kg_hr": round(trad_fuel_rate_kg_hr, 0),
                "alt_fuel_rate_kg_hr": round(alt_fuel_rate_kg_hr, 0),
                "raw_meal_feed_rate_tph": round(raw_meal_feed_rate_tph, 1),
                "limestone_to_clay_ratio": round(limestone_to_clay_ratio, 2),
                "kiln_speed_rpm": round(kiln_speed_rpm, 2),
                "kiln_motor_torque_pct": round(kiln_motor_torque_pct, 1),
                "id_fan_speed_pct": round(id_fan_speed_pct, 1),
                "id_fan_power_kw": round(id_fan_power_kw, 0),
                "kiln_inlet_o2_pct": round(kiln_inlet_o2_pct, 2),
                "kiln_outlet_o2_pct": round(kiln_outlet_o2_pct, 2)
            },
            "production": {
                "clinker_rate_tph": round(clinker_production_rate_kg_hr / 1000, 2),
                "clinker_temp_c": round(clinker_temp_c, 1)
            }
        }
        
    def apply_optimizer_targets(self, targets):
        """Apply optimizer targets to the plant control system"""
        self.optimizer_targets = targets
        self.control_active = True
        self.last_control_update = time.time()
        
    def apply_control_actions(self):
        """Move actual values towards optimizer targets with realistic control dynamics"""
        if not self.control_active or not self.optimizer_targets:
            return
            
        # Target values from optimizer
        target_values = {
            'trad_fuel_rate_kg_hr': self.optimizer_targets.trad_fuel_rate_kg_hr,
            'alt_fuel_rate_kg_hr': self.optimizer_targets.alt_fuel_rate_kg_hr,
            'raw_meal_feed_rate_tph': self.optimizer_targets.raw_meal_feed_rate_tph,
            'kiln_speed_rpm': self.optimizer_targets.kiln_speed_rpm,
            'id_fan_speed_pct': self.optimizer_targets.id_fan_speed_pct
        }
        
        # Apply control actions with realistic response rates and disturbances
        for variable, target in target_values.items():
            current = self.actual_values[variable]
            error = target - current
            
            # Different control response rates for different variables
            if variable in ['trad_fuel_rate_kg_hr', 'alt_fuel_rate_kg_hr']:
                response_rate = 0.15  # Fuel systems respond faster
            elif variable == 'kiln_speed_rpm':
                response_rate = 0.05  # Kiln speed changes slowly
            else:
                response_rate = self.control_response_rate
                
            # Apply control action with noise/disturbances
            control_action = error * response_rate
            disturbance = np.random.normal(0, abs(control_action) * 0.1)  # 10% noise
            
            new_value = current + control_action + disturbance
            
            # Apply physical limits
            if variable == 'trad_fuel_rate_kg_hr':
                new_value = np.clip(new_value, 1000, 1500)
            elif variable == 'alt_fuel_rate_kg_hr':
                new_value = np.clip(new_value, 200, 600)
            elif variable == 'raw_meal_feed_rate_tph':
                new_value = np.clip(new_value, 120, 180)
            elif variable == 'kiln_speed_rpm':
                new_value = np.clip(new_value, 3.0, 4.5)
            elif variable == 'id_fan_speed_pct':
                new_value = np.clip(new_value, 70, 85)
                
            self.actual_values[variable] = new_value
            
    def get_control_status(self):
        """Get current control system status"""
        if not self.optimizer_targets:
            # Create default targets if none exist
            default_targets = OptimizerTargets(
                trad_fuel_rate_kg_hr=self.actual_values['trad_fuel_rate_kg_hr'],
                alt_fuel_rate_kg_hr=self.actual_values['alt_fuel_rate_kg_hr'],
                raw_meal_feed_rate_tph=self.actual_values['raw_meal_feed_rate_tph'],
                kiln_speed_rpm=self.actual_values['kiln_speed_rpm'],
                id_fan_speed_pct=self.actual_values['id_fan_speed_pct'],
                timestamp=time.time()
            )
        else:
            default_targets = self.optimizer_targets
            
        actual_targets = OptimizerTargets(
            trad_fuel_rate_kg_hr=self.actual_values['trad_fuel_rate_kg_hr'],
            alt_fuel_rate_kg_hr=self.actual_values['alt_fuel_rate_kg_hr'],
            raw_meal_feed_rate_tph=self.actual_values['raw_meal_feed_rate_tph'],
            kiln_speed_rpm=self.actual_values['kiln_speed_rpm'],
            id_fan_speed_pct=self.actual_values['id_fan_speed_pct'],
            timestamp=time.time()
        )
        
        # Calculate control errors
        control_errors = {}
        if self.optimizer_targets:
            control_errors = {
                'trad_fuel_rate_kg_hr': self.optimizer_targets.trad_fuel_rate_kg_hr - self.actual_values['trad_fuel_rate_kg_hr'],
                'alt_fuel_rate_kg_hr': self.optimizer_targets.alt_fuel_rate_kg_hr - self.actual_values['alt_fuel_rate_kg_hr'],
                'raw_meal_feed_rate_tph': self.optimizer_targets.raw_meal_feed_rate_tph - self.actual_values['raw_meal_feed_rate_tph'],
                'kiln_speed_rpm': self.optimizer_targets.kiln_speed_rpm - self.actual_values['kiln_speed_rpm'],
                'id_fan_speed_pct': self.optimizer_targets.id_fan_speed_pct - self.actual_values['id_fan_speed_pct']
            }
        
        return ControlStatus(
            targets=default_targets,
            actual_values=actual_targets,
            control_errors=control_errors,
            control_active=self.control_active,
            last_update=self.last_control_update
        )

# --- Creating a single instance of the simulator ---
plant_simulator = PlantSimulator()
plant_data_history = []
plant_data_lock = Lock()

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
    kiln_inlet_temp_c: float
    trad_fuel_rate_kg_hr: float
    alt_fuel_rate_kg_hr: float
    raw_meal_feed_rate_tph: float
    kiln_speed_rpm: float
    kiln_motor_torque_pct: float
    id_fan_speed_pct: float
    id_fan_power_kw: float
    kiln_inlet_o2_pct: float
    kiln_outlet_o2_pct: float

class ProductionModel(BaseModel):
    clinker_rate_tph: float
    clinker_temp_c: float

class PlantStateResponse(BaseModel):
    timestamp: int
    kpi: KpiModel
    raw_mill: RawMillModel
    kiln: KilnModel
    production: ProductionModel

class OptimizerTargets(BaseModel):
    """Optimizer targets that will be applied to the plant simulator"""
    trad_fuel_rate_kg_hr: float
    alt_fuel_rate_kg_hr: float
    raw_meal_feed_rate_tph: float
    kiln_speed_rpm: float
    id_fan_speed_pct: float
    timestamp: Optional[float] = None  # When these targets were set
    
class ControlStatus(BaseModel):
    """Status of the plant control system"""
    targets: OptimizerTargets
    actual_values: OptimizerTargets
    control_errors: Dict[str, float]  # target - actual for each variable
    control_active: bool
    last_update: float

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

class ConstraintRange(BaseModel):
    variable: str
    min_value: float
    max_value: float

class OptimizationResult(BaseModel):
    segment: str
    optimization_type: str  # "apc_limits" or "engineering_limits"
    suggested_targets: Dict[str, float]
    soft_sensors: Dict[str, float]
    optimization_score: float
    economic_value: float  # $/hour
    constraint_violations: List[str]
    model_type: str
    
class DualOptimizationResponse(BaseModel):
    apc_optimization: OptimizationResult
    engineering_optimization: OptimizationResult
    optimization_history: List[Dict[str, Any]]  # Trial history for plotting (contains floats and nested dicts)
    pricing_details: Dict[str, float]

class OptimizeRequest(BaseModel):
    segment: str = 'Clinkerization'
    n_data: int = 50
    constraint_ranges: list[ConstraintRange] = []
    use_custom_pricing: bool = False
    custom_pricing: Optional[PricingConfig] = None

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

# --- Store plant data for optimization ---
def store_plant_data():
    data = plant_simulator.step()
    with plant_data_lock:
        plant_data_history.append(data)
        # Keep only last 1000 records
        if len(plant_data_history) > 1000:
            plant_data_history.pop(0)
    return data

@app.get("/live_plant_state", response_model=PlantStateResponse)
def get_live_plant_state():
    """
    Runs one simulation step and returns the complete, structured plant state.
    This replaces your old /reading endpoint.
    """
    return store_plant_data()
# --- API Endpoints ---

# --- Optuna-based Optimizer ---
OPTIMIZER_VARIABLES = {
    'Raw Materials & Grinding': {
        'constraints': [
            'limestone_feeder_pct', 'clay_feeder_pct', 'mill_vibration_mm_s', 'separator_speed_rpm'
        ],
        'optimization': [
            'power_kw', 'mill_throughput_tph', 'mill_power_kwh_ton'
        ]
    },
    'Clinkerization': {
        'constraints': [
            'kiln_motor_torque_pct', 'burning_zone_temp_c', 'kiln_inlet_o2_pct', 'id_fan_power_kw', 'lsf_predicted'
        ],
        'optimization': [
            'trad_fuel_rate_kg_hr', 'alt_fuel_rate_kg_hr', 'raw_meal_feed_rate_tph', 'limestone_to_clay_ratio', 'kiln_speed_rpm', 'id_fan_speed_pct'
        ]
    }
}

# Engineering hard limits (safety and equipment design limits)
ENGINEERING_LIMITS = {
    'trad_fuel_rate_kg_hr': (900, 1800),
    'alt_fuel_rate_kg_hr': (100, 1000),
    'raw_meal_feed_rate_tph': (100, 220),
    'limestone_to_clay_ratio': (3.0, 5.0),  # Typical limestone to clay ratio for cement raw mix
    'kiln_speed_rpm': (2.0, 5.5),
    'id_fan_speed_pct': (60, 95),
    'burning_zone_temp_c': (1400, 1500),
    'kiln_motor_torque_pct': (45, 85),
    'kiln_inlet_o2_pct': (2.0, 6.0),
    'id_fan_power_kw': (100, 300),
    'lsf_predicted': (97.0, 99.0)  # LSF target range for optimal clinker quality
}

async def fetch_apc_limits_from_firebase():
    """Fetch APC limits from Firebase apclimits collection"""
    if db is None:
        print("⚠ Firebase not initialized, using default limits")
        return {}
    
    try:
        apc_limits = {}
        docs = db.collection('apclimits').stream()
        
        for doc in docs:
            data = doc.to_dict()
            variable_name = doc.id
            
            # Map Firebase document ID to backend variable name
            mapping_key = data.get('mappingKey', '')
            if mapping_key:
                # Extract variable name from mapping key (e.g., "kiln.alt_fuel_rate_kg_hr" -> "alt_fuel_rate_kg_hr")
                var_name = mapping_key.split('.')[-1] if '.' in mapping_key else mapping_key
                
                ll = float(data.get('ll', 0))
                hl = float(data.get('hl', 100))
                
                apc_limits[var_name] = (ll, hl)
                print(f"✓ Loaded APC limit for {var_name}: [{ll}, {hl}]")
        
        return apc_limits
    except Exception as e:
        print(f"✗ Error fetching APC limits from Firebase: {e}")
        return {}

async def fetch_optimizer_settings_from_firebase():
    """Fetch optimizer settings (pricing and ML/FP ratio) from Firebase"""
    if db is None:
        print("⚠ Firebase not initialized, using default settings")
        return None, 0.3
    
    try:
        settings_ref = db.collection('optimizer_settings').document('current')
        settings_doc = settings_ref.get()
        
        if settings_doc.exists:
            settings_data = settings_doc.to_dict()
            pricing_data = settings_data.get('pricing')
            ml_fp_ratio = settings_data.get('mlFpRatio', 0.3)
            
            if pricing_data:
                pricing = PricingConfig(**pricing_data)
                print(f"✓ Loaded pricing from Firebase")
                print(f"✓ Loaded ML/FP ratio: {ml_fp_ratio:.2f} (FP: {1-ml_fp_ratio:.2f})")
                return pricing, ml_fp_ratio
            
        print("⚠ No settings found in Firebase, using defaults")
        return None, 0.3
    except Exception as e:
        print(f"✗ Error fetching settings from Firebase: {e}")
        return None, 0.3

def calculate_economic_value(optimization_vars, pricing: PricingConfig):
    """Calculate economic value (profit) in $/hour based on optimization variables"""
    
    # Extract variables
    trad_fuel = optimization_vars.get('trad_fuel_rate_kg_hr', 1200)
    alt_fuel = optimization_vars.get('alt_fuel_rate_kg_hr', 400)
    feed_rate = optimization_vars.get('raw_meal_feed_rate_tph', 150)
    
    # Assume typical composition for raw meal
    limestone_fraction = 0.75  # 75% limestone
    clay_fraction = 0.20  # 20% clay
    
    # Calculate costs ($/hour)
    limestone_cost = feed_rate * limestone_fraction * pricing.limestone_price_per_ton
    clay_cost = feed_rate * clay_fraction * pricing.clay_price_per_ton
    trad_fuel_cost = trad_fuel * pricing.traditional_fuel_price_per_kg
    alt_fuel_cost = alt_fuel * pricing.alternative_fuel_price_per_kg
    
    # Calculate clinker production (t/h)
    clinker_production = feed_rate * 0.65  # 65% yield
    
    # Calculate revenue ($/hour)
    clinker_revenue = clinker_production * pricing.clinker_selling_price_per_ton
    byproduct_revenue = clinker_production * 0.1 * pricing.byproduct_credit_per_ton  # 10% byproducts
    
    # Calculate electricity cost
    id_fan_power = optimization_vars.get('id_fan_power_kw', 180)
    electricity_cost = id_fan_power * pricing.electricity_price_per_kwh
    
    # Total costs and revenues
    total_cost = limestone_cost + clay_cost + trad_fuel_cost + alt_fuel_cost + electricity_cost
    total_revenue = clinker_revenue + byproduct_revenue
    
    # Economic value (profit per hour)
    economic_value = total_revenue - total_cost
    
    return economic_value

def get_recent_data(n=50):
    with plant_data_lock:
        return plant_data_history[-n:] if len(plant_data_history) >= n else plant_data_history[:]

async def optimize_with_limits(
    segment: str, 
    n_data: int, 
    limit_type: str,  # "apc" or "engineering"
    limits_dict: Dict[str, tuple],
    pricing: PricingConfig,
    constraint_ranges: list = None
):
    """Run optimization with specified limits (APC or Engineering)"""
    global plant_data_history, hybrid_model
    
    try:
        data = get_recent_data(n_data)
        if not data:
            return {"error": "Not enough plant data for optimization."}
        
        # Update ML model with latest data
        hybrid_model.update_ml_model(data)
        
        # Get current plant state
        current_state = plant_simulator.step()
        current_constraints = {
            'burning_zone_temp_c': current_state['kiln']['burning_zone_temp_c'],
            'kiln_motor_torque_pct': current_state['kiln']['kiln_motor_torque_pct'],
            'kiln_inlet_o2_pct': current_state['kiln']['kiln_inlet_o2_pct'],
            'id_fan_power_kw': current_state['kiln']['id_fan_power_kw']
        }
        
        # Get current mill state for LSF calculation
        current_mill_state = {
            'mill_power_kwh_ton': current_state['raw_mill']['mill_power_kwh_ton'],
            'mill_vibration_mm_s': current_state['raw_mill']['mill_vibration_mm_s']
        }
        print(f"✓ Current mill state: Power={current_mill_state['mill_power_kwh_ton']:.2f} kWh/ton, Vibration={current_mill_state['mill_vibration_mm_s']:.2f} mm/s")
        
        variables = OPTIMIZER_VARIABLES[segment]
        
        # Convert constraint ranges to dict for easy lookup
        constraint_dict = {}
        if constraint_ranges:
            for cr in constraint_ranges:
                constraint_dict[cr['variable']] = (cr['min_value'], cr['max_value'])
        
        # Trial history for plotting
        trial_history = []
        
        # Define objective function
        def objective(trial):
            # Suggest values for optimization variables
            optimization_vars = {}
            for var in variables['optimization']:
                # Use provided limits (APC or Engineering)
                if var in limits_dict:
                    low, high = limits_dict[var]
                else:
                    # Extract values based on variable location in data structure
                    vals = []
                    for d in data:
                        val = None
                        if var in d.get('kpi', {}):
                            val = d['kpi'][var]
                        elif var in d.get('raw_mill', {}):
                            val = d['raw_mill'][var]
                        elif var in d.get('kiln', {}):
                            val = d['kiln'][var]
                        elif var in d.get('production', {}):
                            val = d['production'][var]
                        
                        if val is not None:
                            vals.append(val)
                    
                    if vals:
                        low, high = min(vals) * 0.9, max(vals) * 1.1
                    else:
                        # Fallback to engineering limits
                        low, high = ENGINEERING_LIMITS.get(var, (0, 100))
                
                optimization_vars[var] = trial.suggest_float(var, low, high)
            
            # Use hybrid model to predict constraint responses for Clinkerization
            constraint_penalty = 0
            constraint_violations = []
            predicted_constraints = {}
            
            if segment == 'Clinkerization':
                # Pass current mill state for accurate LSF prediction
                predicted_constraints = hybrid_model.predict_constraint_responses(
                    optimization_vars, current_constraints, current_mill_state
                )
                
                # Check constraints against specified limits
                for var in variables['constraints']:
                    if var in predicted_constraints:
                        predicted_value = predicted_constraints[var]
                        
                        # Get limit for this constraint
                        if var in limits_dict:
                            min_val, max_val = limits_dict[var]
                        elif var in constraint_dict:
                            min_val, max_val = constraint_dict[var]
                        else:
                            min_val, max_val = ENGINEERING_LIMITS.get(var, (0, 1000))
                        
                        # Check if constraint is violated
                        if predicted_value < min_val or predicted_value > max_val:
                            violation = max(min_val - predicted_value, predicted_value - max_val, 0)
                            constraint_penalty += violation * 10  # Heavy penalty for violations
                            constraint_violations.append(f"{var}: {predicted_value:.2f} (limit: [{min_val}, {max_val}])")
            
            # Calculate economic value using pricing
            economic_value = calculate_economic_value(optimization_vars, pricing)
            
            # Economic objective (maximize profit)
            objective_score = economic_value - constraint_penalty
            
            # Store trial history with variable values
            trial_data = {
                'trial': trial.number,
                'economic_value': economic_value,
                'constraint_penalty': constraint_penalty,
                'objective_score': objective_score,
                'optimization_vars': optimization_vars.copy()
            }
            
            # Add constraint predictions if available
            if segment == 'Clinkerization' and predicted_constraints:
                trial_data['constraint_vars'] = predicted_constraints.copy()
            
            trial_history.append(trial_data)
            
            return objective_score
        
        # Run optimization
        study = optuna.create_study(
            direction='maximize',
            sampler=optuna.samplers.TPESampler(n_startup_trials=20, n_ei_candidates=30)
        )
        study.optimize(objective, n_trials=100, show_progress_bar=False)
        
        best_params = study.best_params
        
        # Calculate final constraint responses and economic value
        soft_sensors = {}
        final_economic_value = 0
        constraint_violations = []
        
        if segment == 'Clinkerization':
            # Pass current mill state for final constraint calculation
            final_constraints = hybrid_model.predict_constraint_responses(
                best_params, current_constraints, current_mill_state
            )
            best_params.update(final_constraints)
            
            # Calculate soft sensors
            soft_sensors = hybrid_model.first_principles.calculate_soft_sensors(
                best_params, 
                final_constraints, 
                current_state
            )
            
            # Check for constraint violations in final solution
            for var in variables['constraints']:
                if var in best_params:
                    value = best_params[var]
                    if var in limits_dict:
                        min_val, max_val = limits_dict[var]
                    else:
                        min_val, max_val = ENGINEERING_LIMITS.get(var, (0, 1000))
                    
                    if value < min_val or value > max_val:
                        constraint_violations.append(f"{var}: {value:.2f} outside [{min_val}, {max_val}]")
        
        # Calculate final economic value
        final_economic_value = calculate_economic_value(best_params, pricing)
        
        return OptimizationResult(
            segment=segment,
            optimization_type=limit_type,
            suggested_targets=best_params,
            soft_sensors=soft_sensors,
            optimization_score=study.best_value,
            economic_value=final_economic_value,
            constraint_violations=constraint_violations,
            model_type="hybrid_fp_ml"
        ), trial_history
        
    except Exception as e:
        print(f"Optimization error ({limit_type}): {str(e)}")
        return None, []

@app.post("/optimize_targets")
async def optimize_targets_api_post(request: OptimizeRequest):
    """
    INTERNAL ENDPOINT - Called by optimizer worker only.
    Run dual optimization with both APC limits and engineering limits.
    Frontend should NOT call this directly - use GET endpoint instead.
    """
    global pricing_config, optimization_history, hybrid_model
    
    # Fetch settings from Firebase (pricing and ML/FP ratio)
    firebase_pricing, ml_fp_ratio = await fetch_optimizer_settings_from_firebase()
    
    # Use Firebase pricing if available, otherwise use custom or default
    if firebase_pricing:
        pricing = firebase_pricing
    elif request.use_custom_pricing and request.custom_pricing:
        pricing = request.custom_pricing
    else:
        pricing = pricing_config
    
    # Update hybrid model ML weight
    hybrid_model.set_ml_weight(ml_fp_ratio)
    
    # Fetch APC limits from Firebase
    apc_limits = await fetch_apc_limits_from_firebase()
    
    # Run optimization with APC limits
    print("Running optimization with APC limits...")
    apc_result, apc_history = await optimize_with_limits(
        segment=request.segment,
        n_data=request.n_data,
        limit_type="apc_limits",
        limits_dict=apc_limits,
        pricing=pricing,
        constraint_ranges=[cr.dict() for cr in request.constraint_ranges] if request.constraint_ranges else None
    )
    
    # Run optimization with Engineering limits
    print("Running optimization with Engineering limits...")
    eng_result, eng_history = await optimize_with_limits(
        segment=request.segment,
        n_data=request.n_data,
        limit_type="engineering_limits",
        limits_dict=ENGINEERING_LIMITS,
        pricing=pricing,
        constraint_ranges=[cr.dict() for cr in request.constraint_ranges] if request.constraint_ranges else None
    )
    
    # Store in global history
    with optimization_history_lock:
        optimization_history.append({
            'timestamp': time.time(),
            'segment': request.segment,
            'apc_economic_value': apc_result.economic_value if apc_result else 0,
            'eng_economic_value': eng_result.economic_value if eng_result else 0,
            'apc_history': apc_history,
            'eng_history': eng_history
        })
        
        # Keep only last 100 optimization runs
        if len(optimization_history) > 100:
            optimization_history = optimization_history[-100:]
    
    # Debug: Print first history item to verify structure
    combined_history = apc_history + eng_history
    if combined_history:
        print(f"🔍 Backend Debug: First history item keys: {combined_history[0].keys()}")
        print(f"🔍 Backend Debug: First history item: {combined_history[0]}")
    
    # Prepare pricing details for response
    pricing_details = {
        'limestone_price_per_ton': pricing.limestone_price_per_ton,
        'clay_price_per_ton': pricing.clay_price_per_ton,
        'traditional_fuel_price_per_kg': pricing.traditional_fuel_price_per_kg,
        'alternative_fuel_price_per_kg': pricing.alternative_fuel_price_per_kg,
        'clinker_selling_price_per_ton': pricing.clinker_selling_price_per_ton,
        'electricity_price_per_kwh': pricing.electricity_price_per_kwh,
        'byproduct_credit_per_ton': pricing.byproduct_credit_per_ton
    }
    
    return DualOptimizationResponse(
        apc_optimization=apc_result,
        engineering_optimization=eng_result,
        optimization_history=apc_history + eng_history,  # Combined history for plotting
        pricing_details=pricing_details
    )

@app.get("/optimize_targets")
async def optimize_targets_api_get(segment: str = 'Clinkerization', n_data: int = 50):
    """
    Trigger optimization request - actual optimization runs in background worker.
    This endpoint just updates Firebase state to request optimization.
    """
    if db is None:
        return {"error": "Firebase not initialized"}
    
    try:
        # Update optimizer state in Firebase to trigger worker
        state_ref = db.collection('optimizer_state').document('current')
        
        # Set timer to 0 to trigger immediate run
        update_data = {
            'running': True,
            'autoSchedule': True,
            'timer': 0,  # Set to 0 to trigger immediate optimization
            'lastUpdateTime': int(time.time() * 1000),
            'segment': segment
        }
        
        state_ref.set(update_data, merge=True)
        
        print(f"🎯 Optimization triggered via GET endpoint: {update_data}")
        
        return {
            "status": "queued",
            "message": f"Optimization request queued for {segment}. The background worker will process it within 10 seconds.",
            "note": "Worker polls every 10 seconds and will run optimization when timer=0"
        }
    except Exception as e:
        print(f"✗ Error triggering optimization: {e}")
        return {"error": str(e)}

@app.post("/update_pricing")
def update_pricing_api(new_pricing: PricingConfig):
    """
    Update global pricing configuration.
    """
    global pricing_config
    pricing_config = new_pricing
    return {
        "status": "success",
        "message": "Pricing configuration updated",
        "pricing": pricing_config.dict()
    }

@app.get("/get_pricing")
def get_pricing_api():
    """
    Get current pricing configuration.
    """
    return pricing_config

@app.get("/optimization_history")
def get_optimization_history_api():
    """
    Get historical optimization results for analysis.
    """
    with optimization_history_lock:
        return {
            "total_runs": len(optimization_history),
            "history": optimization_history
        }

@app.post("/apply_optimizer_targets")
def apply_optimizer_targets_api(targets: OptimizerTargets):
    """
    Apply optimizer targets to the plant control system.
    """
    targets.timestamp = time.time()
    plant_simulator.apply_optimizer_targets(targets)
    return {
        "status": "success",
        "message": "Optimizer targets applied to plant control system",
        "targets": targets.dict(),
        "timestamp": targets.timestamp
    }

@app.get("/control_status", response_model=ControlStatus)
def get_control_status_api():
    """
    Get current control system status including targets, actual values, and errors.
    """
    return plant_simulator.get_control_status()

@app.get("/debug/plant_history")
def debug_plant_history():
    """Debug endpoint to check plant data history"""
    with plant_data_lock:
        return {
            "total_records": len(plant_data_history),
            "latest_record": plant_data_history[-1] if plant_data_history else None,
            "available_variables": list(plant_data_history[-1].keys()) if plant_data_history else []
        }

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
        o2_level=current_state['kiln']['kiln_inlet_o2_pct'],
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

# ============================================================
# INTEGRATED OPTIMIZER WORKER
# ============================================================

async def run_optimization_internal(segment: str):
    """
    Run optimization internally (same process)
    Returns the optimization result
    """
    try:
        print(f"🔧 Running optimization for {segment} internally...")
        
        # Create the request object
        from pydantic import BaseModel
        
        # Call the existing optimize_targets function logic
        # We'll use a simple HTTP call to localhost to reuse existing logic
        import httpx
        
        backend_url = os.getenv('BACKEND_URL', 'http://localhost:8000')
        
        payload = {
            "segment": segment,
            "n_data": 50,
            "use_custom_pricing": False
        }
        
        async with httpx.AsyncClient(timeout=600.0) as client:
            response = await client.post(
                f'{backend_url}/optimize_targets',
                json=payload
            )
            
            if response.status_code == 200:
                result = response.json()
                print(f"✓ Optimization completed for {segment}")
                
                # Save to Firebase
                save_optimization_to_firebase_internal(result, segment)
                return result
            else:
                print(f"✗ Optimization failed with status {response.status_code}")
                return None
    except Exception as e:
        print(f"✗ Error running optimization: {e}")
        import traceback
        traceback.print_exc()
        return None

def save_optimization_to_firebase_internal(result, segment):
    """Save optimization results to Firebase optimized_targets collection"""
    try:
        if not db:
            print("⚠ Firebase not available, skipping save")
            return
        
        # Convert optimization_history to a simple list if it exists
        opt_history = result.get('optimization_history', [])
        if opt_history and isinstance(opt_history, list):
            opt_history = [
                {
                    'trial': item.get('trial', idx + 1),
                    'economic_value': float(item.get('economic_value', 0)),
                    'constraint_penalty': float(item.get('constraint_penalty', 0)),
                    'objective_score': float(item.get('objective_score', 0)),
                    'optimization_vars': item.get('optimization_vars', {}),
                    'constraint_vars': item.get('constraint_vars', {})
                }
                for idx, item in enumerate(opt_history)
            ]
        else:
            opt_history = []
        
        optimization_record = {
            'timestamp': firestore.SERVER_TIMESTAMP,
            'segment': segment,
            'apc_targets': result.get('apc_optimization', {}).get('suggested_targets', {}),
            'apc_economic_value': result.get('apc_optimization', {}).get('economic_value', 0),
            'apc_optimization_score': result.get('apc_optimization', {}).get('optimization_score', 0),
            'engineering_targets': result.get('engineering_optimization', {}).get('suggested_targets', {}),
            'engineering_economic_value': result.get('engineering_optimization', {}).get('economic_value', 0),
            'engineering_optimization_score': result.get('engineering_optimization', {}).get('optimization_score', 0),
            'economic_benefit': (result.get('engineering_optimization', {}).get('economic_value', 0) -
                                result.get('apc_optimization', {}).get('economic_value', 0)),
            'pricing_details': result.get('pricing_details', {}),
            'optimization_history': opt_history
        }
        
        db.collection('optimized_targets').add(optimization_record)
        print(f"💾 Optimization results saved to Firebase (history: {len(opt_history)} trials)")
    except Exception as e:
        print(f"⚠ Error saving to Firebase: {e}")

# Global variables for logging throttling
_last_heartbeat_log = 0
_last_state_log = 0
_last_check_log = 0

async def check_and_run_optimization():
    """
    Check Firebase for optimization state and run if needed
    """
    print(f"🔄 CHECK START - {time.strftime('%H:%M:%S')}")  # ALWAYS log, no throttling
    
    global background_optimization_state, _last_check_log, _last_state_log
    
    current = time.time()
    
    try:
        if not db:
            print("⚠ Firebase not connected - skipping optimization check")
            return
        
        print(f"✓ Firebase connected, fetching state...")
        
        # Get current optimizer state
        state_ref = db.collection('optimizer_state').document('current')
        state_doc = state_ref.get()
        
        print(f"✓ State document fetched, exists={state_doc.exists}")
        
        if not state_doc.exists:
            print("⚠ optimizer_state/current document does not exist in Firebase")
            return
        
        state = state_doc.to_dict()
        print(f"✓ State loaded: {state}")
        
        # Check if optimizer is enabled
        running = state.get('running', False)
        auto_schedule = state.get('autoSchedule', False)
        
        print(f"✓ Checking: running={running}, autoSchedule={auto_schedule}")
        
        if not running or not auto_schedule:
            print(f"⏸️ Optimizer paused: running={running}, autoSchedule={auto_schedule}")
            return
        
        print(f"✓ Optimizer is active, proceeding...")
        
        segment = state.get('segment', 'Clinkerization')
        timer = state.get('timer', 300)  # Default 5 minutes
        last_update = state.get('lastUpdateTime')
        
        print(f"✓ Config: segment={segment}, timer={timer}, lastUpdate={last_update}")
        
        # Handle first run (no lastUpdateTime set yet)
        if last_update is None or last_update == 0:
            print(f"🚀 First optimization run for {segment}...")
            
            # Run optimization immediately
            result = await run_optimization_internal(segment)
            
            if result:
                # Set initial timer and timestamp
                state_ref.update({
                    'timer': 300,  # Reset to 5 minutes
                    'lastUpdateTime': int(time.time() * 1000)
                })
                background_optimization_state["last_run"] = time.time()
                background_optimization_state["next_run"] = time.time() + 300
                print(f"✓ First optimization completed, timer set to 300s")
            return
        
        # Calculate elapsed time since last update
        current_time = time.time() * 1000  # Convert to milliseconds
        elapsed = (current_time - last_update) / 1000  # Convert to seconds
        
        print(f"✓ Time check: elapsed={elapsed:.0f}s, timer={timer}s")
        
        # Update next run time for status endpoint
        background_optimization_state["next_run"] = (last_update / 1000) + timer
        
        # Check if timer has expired (or is set to 0 for immediate run)
        if elapsed >= timer:
            print(f"⏰ Timer expired ({elapsed:.0f}s >= {timer}s)! Running optimization for {segment}...")
            
            # Run optimization
            result = await run_optimization_internal(segment)
            
            if result:
                # Reset timer and update last run time
                state_ref.update({
                    'timer': timer,
                    'lastUpdateTime': int(time.time() * 1000)
                })
                background_optimization_state["last_run"] = time.time()
                background_optimization_state["next_run"] = time.time() + timer
                print(f"✓ Optimization completed and timer reset to {timer}s")
            else:
                print(f"✗ Optimization failed, will retry in {timer}s")
                # Still update the timer to avoid rapid retries
                state_ref.update({
                    'lastUpdateTime': int(time.time() * 1000)
                })
    except Exception as e:
        print(f"✗ Error in optimization check: {e}")
        import traceback
        traceback.print_exc()

async def optimizer_worker_loop():
    """Background task that polls for optimization requests every 10 seconds"""
    global _last_heartbeat_log
    
    print("=" * 60)
    print("🤖 Integrated Optimizer Worker Started")
    print("=" * 60)
    print("👀 Watching for optimization requests...")
    print("Polling interval: 10 seconds")
    print(f"Firebase connected: {db is not None}")
    print()
    
    # Initial Firebase check
    if db is not None:
        try:
            state_ref = db.collection('optimizer_state').document('current')
            state_doc = state_ref.get()
            if state_doc.exists:
                state = state_doc.to_dict()
                print(f"📋 Initial optimizer_state: running={state.get('running')}, autoSchedule={state.get('autoSchedule')}, timer={state.get('timer')}")
            else:
                print("⚠ WARNING: optimizer_state/current document does not exist!")
                print("   Please create it in Firebase with: {running: true, autoSchedule: true, timer: 300, segment: 'Clinkerization'}")
        except Exception as e:
            print(f"⚠ Error checking initial state: {e}")
    else:
        print("⚠ WARNING: Firebase not initialized - optimizer will not run")
    
    print()
    _last_heartbeat_log = time.time()
    
    while True:
        try:
            # Heartbeat every 30 seconds to confirm worker is alive
            current = time.time()
            if current - _last_heartbeat_log >= 30:
                print(f"💓 Worker heartbeat - {time.strftime('%H:%M:%S')}")
                _last_heartbeat_log = current
            
            print(f"🔵 About to call check_and_run_optimization...")
            await check_and_run_optimization()
            print(f"🟢 check_and_run_optimization completed")
            await asyncio.sleep(10)  # Check every 10 seconds
        except asyncio.CancelledError:
            print("🛑 Optimizer worker cancelled")
            break
        except Exception as e:
            print(f"❌ Error in optimizer worker: {e}")
            import traceback
            traceback.print_exc()
            await asyncio.sleep(10)  # Wait before retrying

# ============================================================
# API ENDPOINTS
# ============================================================

@app.get("/")
def read_root():
    return {"message": "Cement Plant Live Data Simulator is running"}

@app.get("/health")
def health_check():
    """Health check endpoint for deployment monitoring"""
    return {
        "status": "healthy",
        "firebase_connected": db is not None,
        "simulator_running": True,
        "timestamp": time.time()
    }

# Background optimization state
background_optimization_state = {
    "running": False,
    "last_run": None,
    "next_run": None
}

@app.post("/start_background_optimization")
async def start_background_optimization(segment: str = "Clinkerization"):
    """Start background optimization scheduler - can be called from frontend"""
    global background_optimization_state, background_task, optimizer_enabled
    
    try:
        # Enable optimizer
        optimizer_enabled = True
        
        # Start background task if not already running
        if background_task is None or background_task.done():
            background_task = asyncio.create_task(optimizer_worker_loop())
            print("✓ Optimizer worker started")
        
        # Update Firebase state if available
        if db is not None:
            state_ref = db.collection('optimizer_state').document('current')
            state_ref.set({
                'running': True,
                'autoSchedule': True,
                'timer': 300,
                'lastUpdateTime': int(time.time() * 1000),
                'segment': segment
            }, merge=True)
        
        background_optimization_state["running"] = True
        background_optimization_state["next_run"] = time.time() + 300
        
        return {
            "status": "success", 
            "message": f"Background optimization started for {segment}",
            "optimizer_running": True,
            "segment": segment
        }
    except Exception as e:
        print(f"Error starting optimizer: {e}")
        return {"error": str(e)}

@app.post("/stop_background_optimization")
async def stop_background_optimization():
    """Stop background optimization scheduler - can be called from frontend"""
    global background_optimization_state, background_task, optimizer_enabled
    
    try:
        # Disable optimizer
        optimizer_enabled = False
        
        # Cancel background task
        if background_task and not background_task.done():
            background_task.cancel()
            try:
                await background_task
            except asyncio.CancelledError:
                print("✓ Optimizer worker stopped")
            background_task = None
        
        # Update Firebase state if available
        if db is not None:
            state_ref = db.collection('optimizer_state').document('current')
            state_ref.set({
                'running': False,
                'autoSchedule': False,
                'timer': 300,
                'lastUpdateTime': int(time.time() * 1000)
            }, merge=True)
        
        background_optimization_state["running"] = False
        
        return {
            "status": "success", 
            "message": "Background optimization stopped",
            "optimizer_running": False
        }
    except Exception as e:
        print(f"Error stopping optimizer: {e}")
        return {"error": str(e)}

@app.get("/optimizer_status")
async def get_optimizer_status():
    """Get current optimizer status - useful for frontend to check state"""
    global background_task, optimizer_enabled, background_optimization_state
    
    is_running = background_task is not None and not background_task.done() and optimizer_enabled
    
    # Get Firebase state if available
    firebase_state = {}
    if db is not None:
        try:
            state_ref = db.collection('optimizer_state').document('current')
            state_doc = state_ref.get()
            if state_doc.exists:
                firebase_state = state_doc.to_dict()
        except Exception as e:
            print(f"Error fetching Firebase state: {e}")
    
    return {
        "optimizer_running": is_running,
        "optimizer_enabled": optimizer_enabled,
        "background_task_active": background_task is not None and not background_task.done(),
        "last_run": background_optimization_state.get("last_run"),
        "next_run": background_optimization_state.get("next_run"),
        "firebase_state": firebase_state
    }

@app.post("/trigger_optimization_now")
async def trigger_optimization_now(segment: str = "Clinkerization"):
    """Manually trigger an immediate optimization run (bypass timer)"""
    global background_optimization_state
    
    try:
        print(f"🔥 Manual optimization trigger for {segment}...")
        
        # Run optimization immediately
        result = await run_optimization_internal(segment)
        
        if result:
            background_optimization_state["last_run"] = time.time()
            
            # Update Firebase state
            if db is not None:
                state_ref = db.collection('optimizer_state').document('current')
                state_ref.update({
                    'lastUpdateTime': int(time.time() * 1000),
                    'timer': 300  # Reset timer
                })
            
            return {
                "status": "success",
                "message": f"Optimization completed for {segment}",
                "result": result
            }
        else:
            return {
                "status": "error",
                "message": "Optimization failed"
            }
    except Exception as e:
        print(f"Error in manual optimization: {e}")
        return {"error": str(e)}

@app.get("/check_and_run_optimization")
async def check_and_run_optimization():
    """Check if optimization should run based on Firebase state and execute if needed"""
    if db is None:
        return {"error": "Firebase not initialized"}
    
    try:
        # Get current optimizer state
        state_ref = db.collection('optimizer_state').document('current')
        state_doc = state_ref.get()
        
        if not state_doc.exists:
            return {"status": "no_state", "message": "No optimizer state found"}
        
        state = state_doc.to_dict()
        
        if not state.get('running') or not state.get('autoSchedule'):
            return {"status": "not_running", "message": "Optimizer not running"}
        
        # Calculate elapsed time since last update
        last_update = state.get('lastUpdateTime')
        if last_update:
            # Convert Firestore timestamp to seconds
            if hasattr(last_update, 'timestamp'):
                last_update_seconds = last_update.timestamp()
            else:
                last_update_seconds = last_update
            
            current_time = time.time()
            elapsed = current_time - last_update_seconds
            timer = state.get('timer', 300)
            
            # Check if 5 minutes (300 seconds) have passed
            if elapsed >= timer:
                # Time to run optimization
                segment = state.get('segment', 'Clinkerization')
                
                # Run optimization
                result = await optimize_targets_api_get(segment)
                
                # Reset timer
                state_ref.update({
                    'timer': 300,
                    'lastUpdateTime': firestore.SERVER_TIMESTAMP
                })
                
                return {
                    "status": "optimization_ran",
                    "message": f"Optimization executed for {segment}",
                    "result": result
                }
            else:
                remaining = timer - elapsed
                return {
                    "status": "waiting",
                    "message": f"Waiting for optimization",
                    "remaining_seconds": int(remaining)
                }
        
        return {"status": "no_timestamp", "message": "No last update timestamp"}
    except Exception as e:
        return {"error": str(e)}

# ========================================
# ML BUILDER ENDPOINTS
# ========================================
from ml_builder_service import (
    load_dataset, analyze_dataset, univariate_analysis, bivariate_analysis,
    correlation_analysis, split_dataset, train_model, tune_hyperparameters,
    download_model, get_model_summary
)

@app.post("/ml/upload_dataset")
async def upload_dataset_endpoint(
    session_id: str,
    filename: str,
    data: str  # base64 encoded
):
    """Upload and load a dataset"""
    return load_dataset(session_id, data, filename)

@app.get("/ml/analyze_dataset")
async def analyze_dataset_endpoint(session_id: str):
    """Get comprehensive dataset analysis"""
    return analyze_dataset(session_id)

@app.get("/ml/univariate")
async def univariate_endpoint(session_id: str, column: str):
    """Univariate analysis for a column"""
    return univariate_analysis(session_id, column)

@app.get("/ml/bivariate")
async def bivariate_endpoint(session_id: str, col1: str, col2: str):
    """Bivariate analysis between two columns"""
    return bivariate_analysis(session_id, col1, col2)

@app.get("/ml/correlation")
async def correlation_endpoint(session_id: str):
    """Correlation analysis with heatmap"""
    return correlation_analysis(session_id)

@app.post("/ml/split_dataset")
async def split_dataset_endpoint(
    session_id: str,
    target_column: str,
    test_size: float = 0.2,
    random_state: int = 42,
    feature_columns: Optional[List[str]] = None
):
    """Split dataset into train/test sets"""
    return split_dataset(session_id, target_column, test_size, random_state, feature_columns)

@app.post("/ml/train_model")
async def train_model_endpoint(
    session_id: str,
    model_type: str,
    hyperparameters: Optional[Dict[str, Any]] = None
):
    """Train a machine learning model"""
    if hyperparameters is None:
        hyperparameters = {}
    return train_model(session_id, model_type, **hyperparameters)

@app.post("/ml/tune_hyperparameters")
async def tune_hyperparameters_endpoint(
    session_id: str,
    model_type: str,
    n_trials: int = 50
):
    """Hyperparameter tuning with Optuna"""
    return tune_hyperparameters(session_id, model_type, n_trials)

@app.get("/ml/shap_analysis")
async def shap_analysis_endpoint(
    session_id: str,
    model_name: str,
    max_samples: int = 100
):
    """SHAP analysis for model interpretability (disabled - requires shap library)"""
    return {
        "error": "SHAP analysis is disabled to reduce deployment size",
        "message": "To enable SHAP analysis, add 'shap==0.45.1' to requirements.txt and redeploy",
        "alternative": "Use feature importance from the model summary instead"
    }

@app.get("/ml/download_model")
async def download_model_endpoint(
    session_id: str,
    model_name: str,
    format: str = "joblib"
):
    """Download trained model"""
    return download_model(session_id, model_name, format)

@app.get("/ml/model_summary")
async def model_summary_endpoint(session_id: str):
    """Get summary of ML session"""
    return get_model_summary(session_id)

# Generate initial data after all functions are defined
generate_initial_data()