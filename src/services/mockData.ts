// Mock data provider for dashboard components
// Replace with live API integration later

export const getPlantKPI = async () => ({
  energyUsage: 12000, // kWh
  productionRate: 250, // T/hr
  qualityIndex: 98.5,
  sustainabilityScore: 87,
});

export const getProcessTrends = async () => ([
  { time: '08:00', temperature: 1450, feedRate: 120 },
  { time: '09:00', temperature: 1460, feedRate: 122 },
  { time: '10:00', temperature: 1445, feedRate: 119 },
]);

export const getOptimizerStatus = async () => ({
  status: 'Idle',
});
