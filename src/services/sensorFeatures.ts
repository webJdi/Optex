import { fetchPlantReading } from './plantApi';

// Feature mappings for each soft sensor based on the Python ML models
export const sensorFeatures = {
  cement_strength: [
    { key: 'kpi.lsf', label: 'Raw Mill LSF', unit: '' },
    { key: 'kiln.free_lime_pct', label: 'Free Lime Content', unit: '%' }
  ],
  lsf_prediction: [
    { key: 'raw_mill.limestone_feeder_pct', label: 'Limestone %', unit: '%' },
    { key: 'raw_mill.clay_feeder_pct', label: 'Clay %', unit: '%' },
    { key: 'raw_mill.mill_power_kwh_ton', label: 'Mill Power', unit: 'kWh/ton' },
    { key: 'raw_mill.mill_vibration_mm_s', label: 'Mill Vibration', unit: 'mm/s' }
  ],
  free_lime: [
    { key: 'kiln.burning_zone_temp_c', label: 'Burning Zone Temp', unit: '°C' },
    { key: 'kiln.kiln_speed_rpm', label: 'Kiln Speed', unit: 'rpm' },
    { key: 'kiln.kiln_motor_torque_pct', label: 'Motor Torque', unit: '%' },
    { key: 'kiln.kiln_inlet_o2_pct', label: 'O2 Level', unit: '%' }
  ],
  blaine_fineness: [
    { key: 'raw_mill.separator_speed_rpm', label: 'Separator Speed', unit: 'rpm' },
    { key: 'raw_mill.mill_throughput_tph', label: 'Mill Throughput', unit: 'tph' },
    { key: 'production.clinker_temp_c', label: 'Clinker Temperature', unit: '°C' }
  ]
};

export interface SensorFeatureValue {
  key: string;
  label: string;
  unit: string;
  value: number;
  status: 'normal' | 'warning' | 'critical';
}

export const getSensorFeatureValues = async (sensorId: string): Promise<SensorFeatureValue[]> => {
  try {
    const plantReading = await fetchPlantReading();
    const features = sensorFeatures[sensorId as keyof typeof sensorFeatures];
    
    if (!features) {
      throw new Error(`No features defined for sensor: ${sensorId}`);
    }

    return features.map(feature => {
      // Extract nested value using dot notation
      const value = feature.key.split('.').reduce((obj: any, key: string) => {
        return obj && obj[key] !== undefined ? obj[key] : null;
      }, plantReading);

      // Determine status based on typical ranges (can be enhanced with actual thresholds)
      let status: 'normal' | 'warning' | 'critical' = 'normal';
      
      // Simple status logic - can be enhanced with proper thresholds
      if (value === null || value === undefined) {
        status = 'critical';
      } else if (feature.key.includes('temp') && (value < 1400 || value > 1500)) {
        status = 'warning';
      } else if (feature.key.includes('torque') && (value < 60 || value > 85)) {
        status = 'warning';
      } else if (feature.key.includes('o2') && (value < 3 || value > 5)) {
        status = 'warning';
      }

      return {
        key: feature.key,
        label: feature.label,
        unit: feature.unit,
        value: value !== null && value !== undefined ? parseFloat(value.toFixed(2)) : 0,
        status
      };
    });
  } catch (error) {
    console.error('Error fetching sensor feature values:', error);
    throw error;
  }
};