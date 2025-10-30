/* eslint-disable @typescript-eslint/no-explicit-any */
// Service to fetch ML predictions from FastAPI backend

export interface PredictionInput {
  limestone_pct: number;
  clay_pct: number;
  iron_ore_pct: number;
  sand_pct: number;
  burning_zone_temp: number;
  kiln_speed: number;
  raw_mill_fineness: number;
}

export interface PredictionResponse {
  strength_mpa: number;
  lsf_predicted: number;
  free_lime_pct: number;
  blaine_cm2_g: number;
  prediction_confidence: string;
}

export async function fetchMLPredictions(input?: PredictionInput): Promise<PredictionResponse> {
  const url = input 
    ? 'http://127.0.0.1:8000/predict'
    : 'http://127.0.0.1:8000/predict_from_current_state';
  
  //const url = input
  //  ? `${process.env.NEXT_PUBLIC_SIM_API_URL}/predict`
  //  : `${process.env.NEXT_PUBLIC_SIM_API_URL}/predict_from_current_state`;

  const options = input 
    ? {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      }
    : { method: 'GET' };
    
  const res = await fetch(url, options);
  if (!res.ok) throw new Error('Failed to fetch ML predictions');
  return await res.json();
}