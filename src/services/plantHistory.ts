import { getFirestore, setDoc, doc, Timestamp, query, orderBy, limit, getDocs, collection } from "firebase/firestore";
import { app } from "./firebase";

const db = getFirestore(app);

// Updated PlantReading types to match expanded API
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
  trad_fuel_rate_kg_hr: number;
  alt_fuel_rate_kg_hr: number;
  kiln_speed_rpm: number;
  kiln_motor_torque_pct: number;
  o2_level_pct: number;
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

export async function getHistoricalData(limitCount: number = 50) {
  try {
    const q = query(
      collection(db, "plant_readings"),
      orderBy("timestamp", "desc"),
      limit(limitCount)
    );
    const querySnapshot = await getDocs(q);
    const data: any[] = [];
    querySnapshot.forEach((doc) => {
      const docData = doc.data();
      data.push({
        ...docData,
        timestamp: docData.timestamp.toDate().getTime(),
      });
    });
    return data.reverse(); // Return in chronological order
  } catch (e) {
    console.error("Error fetching historical data", e);
    return [];
  }
}

export interface PredictionResponse {
  strength_mpa: number;
  lsf_predicted: number;
  free_lime_pct: number;
  blaine_cm2_g: number;
  prediction_confidence: string;
}

export async function historizeSoftSensorReading(timestamp: number, prediction: PredictionResponse) {
  try {
    const docRef = doc(db, "soft_sensor_readings", String(timestamp));
    await setDoc(docRef, {
      timestamp: Timestamp.fromMillis(timestamp * 1000),
      ...prediction
    });
  } catch (e) {
    console.error("Error adding soft sensor reading to Firestore", e);
  }
}

export async function getSoftSensorHistoricalData(limitCount: number = 50) {
  try {
    const q = query(
      collection(db, "soft_sensor_readings"),
      orderBy("timestamp", "desc"),
      limit(limitCount)
    );
    const querySnapshot = await getDocs(q);
    const data: any[] = [];
    querySnapshot.forEach((doc: any) => {
      const docData = doc.data();
      data.push({
        ...docData,
        timestamp: docData.timestamp.toDate().getTime(),
      });
    });
    return data.reverse(); // Return in chronological order
  } catch (e) {
    console.error("Error fetching soft sensor historical data", e);
    return [];
  }
}
