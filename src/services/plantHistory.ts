
import { getFirestore, setDoc, doc, Timestamp } from "firebase/firestore";
import { app } from "./firebase";

const db = getFirestore(app);

// Updated PlantReading type to match API
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

export async function historizePlantReading(reading: PlantReading) {
  try {
    const docRef = doc(db, "plant_readings", String(reading.timestamp));
    await setDoc(docRef, {
      timestamp: Timestamp.fromMillis(reading.timestamp * 1000),
      kpi: reading.kpi,
      raw_mill: reading.raw_mill,
      kiln: reading.kiln,
      production: reading.production,
    });
  } catch (e) {
    console.error("Error adding reading to Firestore", e);
  }
}
