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
  const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  const url = input 
    ? `${apiUrl}/predict`
    : `${apiUrl}/predict_from_current_state`;
  
  // For local development, use: http://localhost:8000
  // For production, use: https://optex-wc0v.onrender.com

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