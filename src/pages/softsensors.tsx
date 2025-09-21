/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useRequireAuth } from '../hooks/useAuth';
import { fetchPlantReading, PlantReading } from '../services/plantApi';
import { fetchMLPredictions, PredictionResponse } from '../services/mlPredictions';
import { getSoftSensorHistoricalData, historizeSoftSensorReading } from '../services/plantHistory';
import { Box, Typography, Paper } from '@mui/material';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import Sidebar from '../components/Sidebar';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import PageHeader from '../components/PageHeader';
import { accent, cardBg, textColor, textColor2, textColor3, gradientBg, glowBg1, glowBg2, glowBg3, glowBg4, shadowDrop, col1, col2, col3, col4, glowCol1, glowCol2, glowCol3, glowCol4 } from '../components/ColorPalette';

// Type definitions
interface SoftSensorData {
  timestamp: number;
  strength_mpa?: number;
  lsf_predicted?: number;
  free_lime_pct?: number;
  free_lime?: number;
  blaine_cm2_g?: number;
  kpi?: {
    strength_mpa?: number;
    lsf?: number;
  };
  kiln?: {
    free_lime_pct?: number;
  };
  raw_mill?: {
    blaine_cm2_g?: number;
  };
}

interface SoftSensor {
  id: string;
  name: string;
  unit: string;
  color: string;
  getValue: (data: SoftSensorData | PredictionResponse) => number;
}

interface TrendData {
  time: number;
  value: number;
}

interface SensorTrend {
  current: number;
  data: TrendData[];
}

interface SensorTrends {
  [key: string]: SensorTrend;
}

// ML-based soft sensor definitions  
const softSensors: SoftSensor[] = [
  {
    id: 'cement_strength',
    name: 'Cement Strength',
    unit: 'MPa',
    color: glowCol1,
    getValue: (data: SoftSensorData | PredictionResponse) => data.strength_mpa || 0,
  },
  {
    id: 'lsf_prediction',
    name: 'LSF Prediction',
    unit: '',
    color: glowCol2,
    getValue: (data: SoftSensorData | PredictionResponse) => data.lsf_predicted || 0,
  },
  {
    id: 'free_lime',
    name: 'Free Lime Content',
    unit: '%',
    color: glowCol3,
    getValue: (data: SoftSensorData | PredictionResponse) => data.free_lime_pct || (data as SoftSensorData).free_lime || 0,
  },
  {
    id: 'blaine_fineness',
    name: 'Blaine Fineness',
    unit: 'cm²/g',
    color: glowCol4,
    getValue: (data: SoftSensorData | PredictionResponse) => data.blaine_cm2_g || 0,
  }
];

export default function SoftSensors() {
  const { user, loading } = useRequireAuth();
  const router = useRouter();
  const [reading, setReading] = useState<PlantReading | null>(null);
  const [predictions, setPredictions] = useState<PredictionResponse | null>(null);
  const [historicalData, setHistoricalData] = useState<SoftSensorData[]>([]);
  const [sensorTrends, setSensorTrends] = useState<SensorTrends>({});
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // Main data fetching effect - only run when authenticated
  useEffect(() => {
    if (!user) return;
    
    const fetchCurrentData = async () => {
      try {
        const data = await fetchPlantReading();
        setReading(data);
        
        // Fetch ML predictions based on current plant state
        const predData = await fetchMLPredictions();
        setPredictions(predData);
        
        // Historize soft sensor predictions
        if (data && predData) {
          historizeSoftSensorReading(data.timestamp, predData);
        }
        
        // Update timestamp when data is successfully fetched
        setLastUpdated(new Date().toLocaleTimeString());
      } catch (e) {
        console.error('Error fetching data', e);
      }
    };
    
    fetchCurrentData();
    const interval = setInterval(fetchCurrentData, 10000); // Update every 30s
    return () => clearInterval(interval);
  }, [user]);

  // Historical data fetching effect - only run when authenticated and predictions are available
  useEffect(() => {
    if (!user || !predictions) return;
    
    const fetchHistoricalData = async () => {
      const data = await getSoftSensorHistoricalData(18); // 3 hour of soft sensor data
      console.log('Fetched soft sensor historical data:', data);
      setHistoricalData(data);
      const trends: SensorTrends = {};
      softSensors.forEach(sensor => {
        if (predictions) {
          const currentValue = sensor.getValue(predictions);
          // Use soft sensor historical data for trend plot
          trends[sensor.id] = {
            current: currentValue,
            data: data.map(d => ({
              time: d.timestamp,
              value: sensor.getValue(d)
            }))
          };
        }
      });
      setSensorTrends(trends);
    };
    
    fetchHistoricalData();
    const interval = setInterval(fetchHistoricalData, 120000); // Update every 2 mins
    return () => clearInterval(interval);
  }, [user, predictions]);

  // Body margin effect
  useEffect(() => {
    document.body.style.margin = '0';
    return () => { document.body.style.margin = ''; };
  }, []);

  // Show loading spinner while checking authentication
  if (loading) {
      return (
        <Box sx={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1e1a2e 0%, #16213e 100%)',
        }}>
          {/* CSS Spinner */}
          <Box sx={{
            width: 50,
            height: 50,
            border: '4px solid rgba(106, 130, 251, 0.2)',
            borderTop: '4px solid #6a82fb',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            mb: 2
          }} />
          
          {/* CSS Animation */}
          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </Box>
      );
    }

  // If not authenticated, useRequireAuth will redirect to login
  if (!user) {
    return null;
  }

  const renderSensorCard = (sensor: SoftSensor) => {
    const trend = sensorTrends[sensor.id];
    if (!trend) return null;
    let change = 0;
    if (trend.data.length >= 2) {
      const recentHistoricalValues = trend.data.slice(-3); // Last 3 historical points
      const recentAverage = recentHistoricalValues.reduce((sum: number, point: TrendData) => sum + point.value, 0) / recentHistoricalValues.length;
      change = recentAverage !== 0 ? ((trend.current - recentAverage) / recentAverage) * 100 : 0;
    }
    const isPositive = change >= 0;
    const changeColor = isPositive ? '#4caf50' : '#f44336';
  const plotData = trend.data.length > 2 ? trend.data.slice(0, -2) : trend.data;
  
  const enhancedPlotData = plotData.map((point: TrendData, index: number) => ({
    ...point,
    value: point.value + (index % 2 === 0 ? 0.001 : -0.001) // Tiny variation for rendering
  }));
    return (
      <Paper
        key={sensor.id}
        onClick={() => router.push(`/softsensor/${sensor.id}`)}
        sx={{
          background: cardBg,
          borderRadius: 3,
          p: 3,
          height: 180,
          width: '13vw',
          border: `1px solid ${sensor.color}20`,
          position: 'relative',
          overflow: 'hidden',
          transition: '0.3s',
          cursor: 'pointer',
          '&:hover': {
            borderColor: sensor.color,
            boxShadow: `0 4px 20px ${sensor.color}50`,
            transform: 'translateY(-2px)',
          }
        }}
      >
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Typography sx={{ color: textColor3, fontSize: 14, fontWeight: 500, fontFamily: `'Montserrat', sans-serif` }}>
            {sensor.name}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {isPositive ? (
              <TrendingUpIcon sx={{ color: changeColor, fontSize: 16 }} />
            ) : (
              <TrendingDownIcon sx={{ color: changeColor, fontSize: 16 }} />
            )}
            <Typography sx={{ color: changeColor, fontSize: 12, fontWeight: 600 }}>
              {isPositive ? '+' : ''}{Math.abs(change).toFixed(2)}%
            </Typography>
          </Box>
        </Box>

        {/* Current Value */}
        <Typography sx={{ 
          color: textColor, 
          fontSize: 28, 
          mb: 2,
          lineHeight: 1,
          fontFamily: `'Montserrat', sans-serif`, fontWeight: 200
        }}>
          {trend.current.toFixed(2)}
          <Typography component="span" sx={{ fontSize: 14, color: '#b6d4e3', ml: 1, fontFamily: `'Montserrat', sans-serif`, fontWeight: 200 }}>
            {sensor.unit}
          </Typography>
        </Typography>

        {/* Mini Chart */}
        <Box sx={{ 
          position: 'absolute', 
          bottom: 0, 
          left: 0, 
          right: 0, 
          height: 120,
          opacity: 0.9
        }}>
          <ResponsiveContainer width="80%" height="100%">
            <LineChart data={enhancedPlotData}>
              <defs>
                <filter id={`neon-shadow-${sensor.id}`} x="-20%" y="-20%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor={sensor.color} floodOpacity="0.9" />
                </filter>
              </defs>
              <YAxis
                hide
                domain={[(dataMin: number) => {
                  const min = dataMin * 0.90;
                  const max = dataMin * 1.10;
                  return Math.abs(max - min) < 0.01 ? min - 0.1 : min;
                }, (dataMax: number) => {
                  const min = dataMax * 0.90;
                  const max = dataMax * 1.10;
                  return Math.abs(max - min) < 0.01 ? max + 0.1 : max;
                }]}
              />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke={sensor.color} 
                strokeWidth={3}
                dot={false}
                activeDot={false}
                filter={`url(#neon-shadow-${sensor.id})`}
                strokeOpacity={0.9}
                connectNulls={true}
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
          p: 4,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          overflow: 'auto'
        }}>
          {/* Header */}
          <Box sx={{ mb: 1 }}>
            <PageHeader pageName="Soft Sensors" />
          </Box>

          

          {/* Sensor Grid */}
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr 1fr' },
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