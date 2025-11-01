/* eslint-disable @typescript-eslint/no-explicit-any */
// Service to fetch cement plant readings from FastAPI backend

export interface KpiModel {
  shc_kcal_kg: number;
  lsf: number;
  sec_kwh_ton: number;
  tsr_pct: number;
}

export interface RawMillModel {
  limestone_feeder_pct: number;
  clay_feeder_pct: number;
  power_kw: number;
  mill_power_kwh_ton: number;
  mill_vibration_mm_s: number;
  separator_speed_rpm: number;
  mill_throughput_tph: number;
}

export interface KilnModel {
  burning_zone_temp_c: number;
  kiln_inlet_temp_c: number;
  trad_fuel_rate_kg_hr: number;
  alt_fuel_rate_kg_hr: number;
  raw_meal_feed_rate_tph: number;
  limestone_to_clay_ratio: number;
  kiln_speed_rpm: number;
  kiln_motor_torque_pct: number;
  id_fan_speed_pct: number;
  id_fan_power_kw: number;
  kiln_inlet_o2_pct: number;
  kiln_outlet_o2_pct: number;
}

export interface ProductionModel {
  clinker_rate_tph: number;
  clinker_temp_c: number;
}

export interface PlantReading {
  timestamp: number;
  kpi: KpiModel;
  raw_mill: RawMillModel;
  kiln: KilnModel;
  production: ProductionModel;
}

export async function fetchPlantReading(): Promise<PlantReading> {
  const apiUrl = process.env.NEXT_PUBLIC_SIM_API_URL;
  //Keeping this for testing purpose
  //const res = await fetch('http://127.0.0.1:8000/live_plant_state');
  const res = await fetch(`${apiUrl}/live_plant_state`);
  if (!res.ok) throw new Error('Failed to fetch plant reading');
  return await res.json();
}
