// Service to fetch cement plant readings from FastAPI backend

export interface KpiModel {
  shc_kcal_kg: number;
  lsf: number;
  sec_kwh_ton: number;
  tsr_pct: number;
}

export interface PlantReading {
  timestamp: number;
  kpi: KpiModel;
  raw_mill: any;
  kiln: any;
  production: any;
}

export async function fetchPlantReading(): Promise<PlantReading> {
  const res = await fetch('http://127.0.0.1:8000/live_plant_state');
  if (!res.ok) throw new Error('Failed to fetch plant reading');
  return await res.json();
}
