import React, { useState, useEffect } from 'react';
import { fetchPlantReading, PlantReading } from '../services/plantApi';
import { fetchMLPredictions, PredictionResponse } from '../services/mlPredictions';
import { getHistoricalData } from '../services/plantHistory';
import { Box, Typography, Paper } from '@mui/material';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import Sidebar from '../components/Sidebar';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { accent, cardBg, textColor, textColor2, textColor3, gradientBg, glowBg1, glowBg2, glowBg3, glowBg4, shadowDrop, col1, col2, col3, col4 } from '../components/ColorPalette';


// ML-based soft sensor definitions  
const softSensors = [
  {
    id: 'cement_strength',
    name: 'Cement Strength',
    unit: 'MPa',
    color: col1,
    getValue: (predictions: PredictionResponse | null) => predictions?.strength_mpa || 0,
  },
  {
    id: 'lsf_prediction',
    name: 'LSF Prediction',
    unit: '',
    color: col2,
    getValue: (predictions: PredictionResponse | null) => predictions?.lsf_predicted || 0,
  },
  {
    id: 'free_lime',
    name: 'Free Lime Content',
    unit: '%',
    color: col3,
    getValue: (predictions: PredictionResponse | null) => predictions?.free_lime_pct || 0,
  },
  {
    id: 'blaine_fineness',
    name: 'Blaine Fineness',
    unit: 'cm²/g',
    color: col4,
    getValue: (predictions: PredictionResponse | null) => predictions?.blaine_cm2_g || 0,
  }
];

export default function SoftSensors() {
  const [reading, setReading] = useState<PlantReading | null>(null);
  const [predictions, setPredictions] = useState<PredictionResponse | null>(null);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [sensorTrends, setSensorTrends] = useState<any>({});
  const [lastUpdated, setLastUpdated] = useState<string>('');

  useEffect(() => {
    const fetchCurrentData = async () => {
      try {
        const data = await fetchPlantReading();
        setReading(data);
        
        // Fetch ML predictions based on current plant state
        const predData = await fetchMLPredictions();
        setPredictions(predData);
        
        // Update timestamp when data is successfully fetched
        setLastUpdated(new Date().toLocaleTimeString());
      } catch (e) {
        console.error('Error fetching data', e);
      }
    };
    
    fetchCurrentData();
    const interval = setInterval(fetchCurrentData, 10000); // Update every 30s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchHistoricalData = async () => {
      const data = await getHistoricalData(144); // 24 hours of data (every 10 mins)
      setHistoricalData(data);
      
      // Calculate trends for each sensor using predictions
      const trends: any = {};
      softSensors.forEach(sensor => {
        if (predictions) {
          const currentValue = sensor.getValue(predictions);
           // Calculate average from historical data for this sensor
           const values = historicalData.map(d => sensor.getValue(d));
           const avgValue = values.length ? values.reduce((a, b) => a + b, 0) / values.length : currentValue;
           // Calculate percent change from average to current
           const change = avgValue !== 0 ? ((currentValue - avgValue) / avgValue) * 100 : 0;

           trends[sensor.id] = {
             current: currentValue,
             change,
             data: Array.from({ length: 24 }, (_, i) => ({
               time: Date.now() - (23 - i) * 300000, // 5-minute intervals
               value: currentValue + (Math.random() - 0.5) * currentValue * 0.1
             }))
           };
        }
      });
      setSensorTrends(trends);
    };
    
    if (predictions) {
      fetchHistoricalData();
    }
    const interval = setInterval(fetchHistoricalData, 120000); // Update every 2 mins
    return () => clearInterval(interval);
  }, [predictions]);

  useEffect(() => {
    document.body.style.margin = '0';
    return () => { document.body.style.margin = ''; };
  }, []);

  const renderSensorCard = (sensor: any) => {
    const trend = sensorTrends[sensor.id];
    if (!trend) return null;

    const isPositive = trend.change >= 0;
    const changeColor = isPositive ? '#4caf50' : '#f44336';

    return (
      <Paper
        key={sensor.id}
        sx={{
          background: cardBg,
          
          borderRadius: 3,
          p: 3,
          height: 180,
          width: '15vw',
          position: 'relative',
          overflow: 'hidden',
          transition: '0.3s',
          '&:hover': {
            borderColor: sensor.color,
            boxShadow: `0 4px 20px ${sensor.color}30`,
          }
        }}
      >
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Typography sx={{ color: textColor, fontSize: 14, fontWeight: 500 }}>
            {sensor.name}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {isPositive ? (
              <TrendingUpIcon sx={{ color: changeColor, fontSize: 16 }} />
            ) : (
              <TrendingDownIcon sx={{ color: changeColor, fontSize: 16 }} />
            )}
            <Typography sx={{ color: changeColor, fontSize: 12, fontWeight: 600 }}>
              {isPositive ? '+' : ''}{Math.abs(trend.change).toFixed(2)}%
            </Typography>
          </Box>
        </Box>

        {/* Current Value */}
        <Typography sx={{ 
          color: textColor, 
          fontSize: 28, 
          fontWeight: 700,
          mb: 2,
          lineHeight: 1
        }}>
          {trend.current.toFixed(2)}
          <Typography component="span" sx={{ fontSize: 14, color: '#b6d4e3', ml: 1 }}>
            {sensor.unit}
          </Typography>
        </Typography>

        {/* Mini Chart */}
        <Box sx={{ 
          position: 'absolute', 
          bottom: 0, 
          left: 0, 
          right: 0, 
          height: 80,
          opacity: 0.8
        }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend.data}>
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke={sensor.color}
                strokeWidth={2}
                dot={false}
                activeDot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </Box>
      </Paper>
    );
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      width: '100vw',
      background: gradientBg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      fontFamily: `'Montserrat', sans-serif`,
    }}>
      <Box sx={{
        width: { xs: '100%', md: '95vw' },
        height: {xs: '100%', md: '90vh' },
        background: cardBg,
        borderRadius: 6,
        display: 'flex',
        flexDirection: 'row',
        overflow: 'hidden',
        boxShadow: shadowDrop,
      }}>
        <Sidebar />

        {/* Main Content */}
        <Box sx={{
          flex: 1,
          p: 5,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          overflow: 'auto'
        }}>
          {/* Header */}
          <Box sx={{ mb: 1 }}>
            <Typography variant="h4" sx={{fontFamily: `'Montserrat', sans-serif`, color: textColor, fontWeight: 400, mb: 1 }}>
              Soft Sensors
            </Typography>
          </Box>

          {/* Prediction Status Panel */}
          <Paper sx={{
            background: cardBg,
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: 4,
            p: 1,
            mb: 1
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography sx={{ color: accent, fontWeight: 700, fontSize: 18 }}>
                ML Model Status
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: predictions?.prediction_confidence === 'high' ? '#4caf50' : 
                             predictions?.prediction_confidence === 'low' ? '#ff9800' : '#f44336'
                }} />
                <Typography sx={{ color: textColor, fontSize: 14 }}>
                  Confidence: {predictions?.prediction_confidence || 'Loading...'}
                </Typography>
                <Typography sx={{ color: '#b6d4e3', fontSize: 12, ml: 2 }}>
                  Last updated: {lastUpdated || 'Loading...'}
                </Typography>
              </Box>
            </Box>
          </Paper>

          {/* Sensor Grid */}
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr' },
            gap: 3,
            mb: 4
          }}>
            {softSensors.map(sensor => renderSensorCard(sensor))}
          </Box>

        
        </Box>
      </Box>
    </Box>
  );
}