# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Optional
import numpy as np
import time
import joblib
import pandas as pd
import os
import optuna
from threading import Lock
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler

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
    def __init__(self):
        self.first_principles = CementProcessModel()
        self.ml_model = MLRelationshipModel()
        self.ml_weight = 0.3  # Weight for ML vs first principles
        
    def update_ml_model(self, plant_history):
        """Update ML model with new plant data"""
        success = self.ml_model.train_from_historical_data(plant_history)
        if success:
            print(f"✓ ML model updated with {len(plant_history)} data points")
        return success
        
    def predict_constraint_responses(self, optimization_vars, current_constraints):
        """Hybrid prediction combining first principles and ML"""
        
        # Get first-principles predictions
        fp_predictions = self.first_principles.calculate_constraint_responses(
            optimization_vars, current_constraints
        )
        
        # Get ML predictions if available
        ml_predictions = self.ml_model.predict_constraints(optimization_vars)
        
        if ml_predictions is None:
            # Use pure first principles if ML not trained
            print("Using first-principles only (ML not trained)")
            return fp_predictions
        
        # Hybrid approach: weighted combination
        hybrid_predictions = {}
        for var in fp_predictions:
            fp_value = fp_predictions[var]
            ml_value = ml_predictions[var]
            
            # Weighted average
            hybrid_value = (1 - self.ml_weight) * fp_value + self.ml_weight * ml_value
            hybrid_predictions[var] = hybrid_value
            
        print(f"Using hybrid model (FP: {1-self.ml_weight:.1f}, ML: {self.ml_weight:.1f})")
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
        # Use actual controlled values instead of calculated ones
        trad_fuel_rate_kg_hr = self.actual_values['trad_fuel_rate_kg_hr']
        alt_fuel_rate_kg_hr = self.actual_values['alt_fuel_rate_kg_hr']
        raw_meal_feed_rate_tph = self.actual_values['raw_meal_feed_rate_tph']
        kiln_speed_rpm = self.actual_values['kiln_speed_rpm']
        id_fan_speed_pct = self.actual_values['id_fan_speed_pct']
        
        # Calculate derived values based on controlled variables
        clinker_production_rate_kg_hr = raw_meal_feed_rate_tph * 1000 * 0.65
        total_energy_kcal_hr = (trad_fuel_rate_kg_hr * 7000) + (alt_fuel_rate_kg_hr * 4500)
        base_shc = total_energy_kcal_hr / clinker_production_rate_kg_hr if clinker_production_rate_kg_hr > 0 else 740
        tsr_pct = (alt_fuel_rate_kg_hr * 4500) / total_energy_kcal_hr * 100 if total_energy_kcal_hr > 0 else 25
        
        # Burning zone temperature - influenced by fuel rates and heat transfer
        burning_zone_temp_c = 1450 + (base_shc - 740) * 2 + np.random.normal(0, 5)
        burning_zone_temp_c = np.clip(burning_zone_temp_c, 1400, 1500)
        
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
                "kiln_inlet_temp_c": round(kiln_inlet_temp_c, 1),
                "trad_fuel_rate_kg_hr": round(trad_fuel_rate_kg_hr, 0),
                "alt_fuel_rate_kg_hr": round(alt_fuel_rate_kg_hr, 0),
                "raw_meal_feed_rate_tph": round(raw_meal_feed_rate_tph, 1),
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

class OptimizeRequest(BaseModel):
    segment: str = 'Clinkerization'
    n_data: int = 50
    constraint_ranges: list[ConstraintRange] = []

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
            'kiln_motor_torque_pct', 'burning_zone_temp_c', 'kiln_inlet_o2_pct', 'id_fan_power_kw'
        ],
        'optimization': [
            'trad_fuel_rate_kg_hr', 'alt_fuel_rate_kg_hr', 'raw_meal_feed_rate_tph', 'kiln_speed_rpm', 'id_fan_speed_pct'
        ]
    }
}

def get_recent_data(n=50):
    with plant_data_lock:
        return plant_data_history[-n:] if len(plant_data_history) >= n else plant_data_history[:]

def optimize_targets(segment: str = 'Clinkerization', n_data: int = 50, constraint_ranges: list = None):
    """Run optimization using hybrid first-principles + ML model"""
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
        
        variables = OPTIMIZER_VARIABLES[segment]
        
        # Convert constraint ranges to dict for easy lookup
        constraint_dict = {}
        if constraint_ranges:
            for cr in constraint_ranges:
                constraint_dict[cr['variable']] = (cr['min_value'], cr['max_value'])
        
        # Define objective function
        def objective(trial):
            # Suggest values for optimization variables
            optimization_vars = {}
            for var in variables['optimization']:
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
                    low, high = min(vals) * 0.9, max(vals) * 1.1  # Tighter range around historical data
                else:
                    # Realistic ranges based on cement plant operations
                    if var == 'trad_fuel_rate_kg_hr':
                        low, high = 900, 1800  # Typical traditional fuel range
                    elif var == 'alt_fuel_rate_kg_hr':
                        low, high = 100, 1000    # Alternative fuel range
                    elif var == 'raw_meal_feed_rate_tph':
                        low, high = 100, 220    # Feed rate range
                    elif var == 'kiln_speed_rpm':
                        low, high = 2.0, 5.5    # Kiln speed range
                    elif var == 'id_fan_speed_pct':
                        low, high = 60, 95      # ID fan speed range
                    elif 'temp' in var:
                        low, high = 1350, 1550
                    elif 'torque' in var:
                        low, high = 45, 90
                    elif 'o2' in var:
                        low, high = 2.0, 6.0
                    elif 'power' in var and 'kw' in var:
                        low, high = 100, 350
                    elif 'vibration' in var:
                        low, high = 1, 7
                    elif 'feeder' in var:
                        low, high = 10, 35
                    else:
                        low, high = 0, 100
                
                optimization_vars[var] = trial.suggest_float(var, low, high)
            
            # Use hybrid model to predict constraint responses for Clinkerization
            constraint_penalty = 0
            if segment == 'Clinkerization':
                predicted_constraints = hybrid_model.predict_constraint_responses(
                    optimization_vars, current_constraints
                )
                
                # Check if constraints are within acceptable ranges
                for var in variables['constraints']:
                    if var in predicted_constraints:
                        predicted_value = predicted_constraints[var]
                        
                        # Check user-defined constraint ranges
                        if var in constraint_dict:
                            min_val, max_val = constraint_dict[var]
                            if predicted_value < min_val or predicted_value > max_val:
                                # Gradual penalty proportional to constraint violation
                                violation = max(min_val - predicted_value, predicted_value - max_val, 0)
                                constraint_penalty += violation * 2  # Gradual penalty instead of fixed
                        
                        # Check physical limits (more severe for safety violations)
                        if var == 'burning_zone_temp_c':
                            if predicted_value < 1400 or predicted_value > 1500:
                                violation = max(1400 - predicted_value, predicted_value - 1500, 0)
                                constraint_penalty += violation * 5  # Temperature safety is critical
                        elif var == 'kiln_motor_torque_pct':
                            if predicted_value > 85:  # Only penalize over-torque (equipment damage)
                                constraint_penalty += (predicted_value - 85) * 3
                        elif var == 'kiln_inlet_o2_pct':
                            if predicted_value < 2.0:  # Under-oxygenation is dangerous
                                constraint_penalty += (2.0 - predicted_value) * 10
                            elif predicted_value > 6.0:  # Over-oxygenation wastes energy
                                constraint_penalty += (predicted_value - 6.0) * 2
                        elif var == 'id_fan_power_kw':
                            if predicted_value > 300:  # Equipment limit
                                constraint_penalty += (predicted_value - 300) * 2
            
            # Calculate objective score
            if segment == 'Clinkerization':
                # Calculate estimated clinker production from feed rate and efficiency
                feed_rate = optimization_vars.get('raw_meal_feed_rate_tph', 150)
                estimated_clinker_rate = feed_rate * 0.65  # Typical yield factor
                
                # Calculate specific heat consumption (SHC) - key efficiency metric
                trad_fuel = optimization_vars.get('trad_fuel_rate_kg_hr', 1200)
                alt_fuel = optimization_vars.get('alt_fuel_rate_kg_hr', 400)
                total_energy = trad_fuel * 7000 + alt_fuel * 4500  # kcal/hr
                shc = total_energy / (estimated_clinker_rate * 1000) if estimated_clinker_rate > 0 else 1000
                
                # Calculate TSR (alternative fuel ratio) - higher is better for sustainability
                tsr = (alt_fuel * 4500) / total_energy * 100 if total_energy > 0 else 0
                
                # Production efficiency score (normalized)
                production_score = min(estimated_clinker_rate / 120, 1.5) * 40  # Cap at 120 tph baseline
                
                # Energy efficiency score (lower SHC is better, target ~750 kcal/kg)
                energy_score = max(0, (1000 - shc) / 10)  # Higher score for lower SHC
                
                # Sustainability score (higher TSR is better, target ~30%)
                sustainability_score = min(tsr / 3, 10)  # Normalize TSR contribution
                
                # Motor efficiency (lower torque is better for motor life)
                motor_score = max(0, (85 - predicted_constraints.get('kiln_motor_torque_pct', 70)) / 2)
                
                # Combined objective with cement industry priorities
                efficiency_score = (
                    production_score * 0.45 +      # Production rate (45%)
                    energy_score * 0.20 +          # Energy efficiency (20%) 
                    sustainability_score * 0.20 +  # Sustainability/TSR (20%)
                    motor_score * 0.15             # Equipment efficiency (15%)
                )
            else:  # Raw Materials & Grinding
                # Objective: maximize throughput while minimizing power consumption
                throughput_score = optimization_vars.get('mill_throughput_tph', 150) * 0.5
                efficiency_score = (30 - optimization_vars.get('mill_power_kwh_ton', 20)) * 0.5
                efficiency_score = throughput_score + efficiency_score
            
            return efficiency_score - constraint_penalty
        
        # Run optimization with advanced sampler
        study = optuna.create_study(
            direction='maximize',
            sampler=optuna.samplers.TPESampler(n_startup_trials=20, n_ei_candidates=30)
        )
        study.optimize(objective, n_trials=500)
        
        best_params = study.best_params
        
        # Calculate final constraint responses using hybrid model
        soft_sensors = {}
        if segment == 'Clinkerization':
            final_constraints = hybrid_model.predict_constraint_responses(
                best_params, current_constraints
            )
            # Merge optimization and constraint variables
            best_params.update(final_constraints)
            
            # Calculate soft sensors using the hybrid model
            soft_sensors = hybrid_model.first_principles.calculate_soft_sensors(
                best_params, 
                final_constraints, 
                current_state
            )
        
        return {
            "segment": segment,
            "suggested_targets": best_params,
            "soft_sensors": soft_sensors,
            "optimization_score": study.best_value,
            "model_type": "hybrid_fp_ml"
        }
        
    except Exception as e:
        print(f"Optimization error: {str(e)}")
        return {"error": f"Optimizer failed: {str(e)}"}

@app.get("/optimize_targets")
def optimize_targets_api_get(segment: str = 'Clinkerization', n_data: int = 50):
    """
    Run Optuna optimizer for the selected segment and return suggested targets (GET version).
    """
    return optimize_targets(segment, n_data)

@app.post("/optimize_targets")
def optimize_targets_api_post(request: OptimizeRequest):
    """
    Run Optuna optimizer with user-defined constraint ranges (POST version).
    """
    constraint_ranges = [cr.dict() for cr in request.constraint_ranges] if request.constraint_ranges else None
    return optimize_targets(request.segment, request.n_data, constraint_ranges)

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

@app.get("/")
def read_root():
    return {"message": "Cement Plant Live Data Simulator is running"}

# Generate initial data after all functions are defined
generate_initial_data()