/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useRequireAuth } from '../../hooks/useAuth';
import { fetchPlantReading, PlantReading } from '../../services/plantApi';
import { fetchMLPredictions, PredictionResponse } from '../../services/mlPredictions';
import { getSoftSensorHistoricalData, historizeSoftSensorReading } from '../../services/plantHistory';
import { getSensorFeatureValues, SensorFeatureValue } from '../../services/sensorFeatures';
import { Box, Typography, Paper, IconButton, Chip } from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import Sidebar from '../../components/Sidebar';
import PageHeader from '../../components/PageHeader';
import { accent, cardBg, textColor, textColor2, textColor3, gradientBg, glowBg1, glowBg2, glowBg3, glowBg4, shadowDrop, col1, col2, col3, col4, glowCol1, glowCol2, glowCol3, glowCol4 } from '../../components/ColorPalette';

// ML-based soft sensor definitions  
const softSensors = [
  {
    id: 'cement_strength',
    name: 'Cement Strength',
    unit: 'MPa',
    color: glowCol1,
    description: 'Predictive model for cement compressive strength based on raw material composition and process parameters.',
    getValue: (data: any) => data.strength_mpa || data.kpi?.strength_mpa || 0,
    targetRange: { min: 42.5, max: 52.5 },
    criticalFactors: ['Clinker quality', 'Fineness', 'Chemical composition', 'Curing conditions']
  },
  {
    id: 'lsf_prediction',
    name: 'LSF Prediction',
    unit: '',
    color: glowCol2,
    description: 'Lime Saturation Factor prediction for optimal clinker formation and cement quality control.',
    getValue: (data: any) => data.lsf_predicted || data.kpi?.lsf || 0,
    targetRange: { min: 0.92, max: 0.98 },
    criticalFactors: ['CaO content', 'SiO2 content', 'Raw material ratios', 'Kiln temperature']
  },
  {
    id: 'free_lime',
    name: 'Free Lime Content',
    unit: '%',
    color: glowCol3,
    description: 'Free lime content prediction for clinker quality assessment and process optimization.',
    getValue: (data: any) => data.free_lime_pct || data.free_lime || data.kiln?.free_lime_pct || 0,
    targetRange: { min: 0.5, max: 2.0 },
    criticalFactors: ['Kiln temperature', 'Residence time', 'Raw material fineness', 'Fuel quality']
  },
  {
    id: 'blaine_fineness',
    name: 'Blaine Fineness',
    unit: 'cm²/g',
    color: glowCol4,
    description: 'Cement fineness prediction for optimal grinding performance and cement properties.',
    getValue: (data: any) => data.blaine_cm2_g || data.raw_mill?.blaine_cm2_g || 0,
    targetRange: { min: 3200, max: 3800 },
    criticalFactors: ['Mill speed', 'Ball charge', 'Material hardness', 'Separator efficiency']
  }
];

  

export default function SoftSensorDetail() {
  const { user, loading: authLoading } = useRequireAuth();
  const router = useRouter();
  const { id } = router.query;
  
  const [reading, setReading] = useState<PlantReading | null>(null);
  const [predictions, setPredictions] = useState<PredictionResponse | null>(null);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [currentSensor, setCurrentSensor] = useState<any>(null);
  const [sensorData, setSensorData] = useState<any>(null);
  const [featureValues, setFeatureValues] = useState<SensorFeatureValue[]>([]);

  // Find the current sensor based on ID - only run when authenticated
  useEffect(() => {
    if (!user || !id) return;
    
    console.log('Finding sensor with ID:', id);
    const sensor = softSensors.find(s => s.id === id);
    console.log('Found sensor:', sensor);
    setCurrentSensor(sensor);
  }, [user, id]);

  // Body margin effect
  useEffect(() => {
    document.body.style.margin = '0';
    return () => { document.body.style.margin = ''; };
  }, []);

  // Main data fetching effect - only run when authenticated and sensor is selected
  useEffect(() => {
    if (!user || !currentSensor) return;
    
    const fetchCurrentData = async () => {
      try {
        console.log('Fetching current data for sensor:', currentSensor?.id);
        const data = await fetchPlantReading();
        setReading(data);
        
        // Fetch ML predictions based on current plant state
        const predData = await fetchMLPredictions();
        console.log('Predictions received:', predData);
        setPredictions(predData);
        
        // Historize soft sensor predictions
        if (data && predData) {
          historizeSoftSensorReading(data.timestamp, predData);
        }

        // Fetch feature values for current sensor
        if (currentSensor) {
          const features = await getSensorFeatureValues(currentSensor.id);
          setFeatureValues(features);
        }
      } catch (e) {
        console.error('Error fetching data', e);
      }
    };
    
    fetchCurrentData();
    const interval = setInterval(fetchCurrentData, 10000);
    return () => clearInterval(interval);
  }, [user, currentSensor]);

  // Historical data fetching effect - only run when authenticated
  useEffect(() => {
    if (!user || !currentSensor || !predictions) return;
    
    const fetchHistoricalData = async () => {
      console.log('Fetching historical data for sensor:', currentSensor?.id);
      const data = await getSoftSensorHistoricalData(72); // 12 hours of data for detailed view
      console.log('Historical data received:', data);
      setHistoricalData(data);
      
      if (currentSensor && predictions) {
        const currentValue = currentSensor.getValue(predictions);
        console.log('Current value:', currentValue);
        
        const chartData = data.map(d => ({
          time: new Date(d.timestamp).toLocaleTimeString(),
          value: currentSensor.getValue(d),
          timestamp: d.timestamp
        }));
        console.log('Chart data mapped:', chartData);
        
        // Calculate trend change
        let change = 0;
        if (data.length >= 2) {
          const recentHistoricalValues = data.slice(-3); // Get last 3 data points
          const recentAverage = recentHistoricalValues.reduce((sum: number, point: any) => sum + currentSensor.getValue(point), 0) / recentHistoricalValues.length;
          change = recentAverage !== 0 ? ((currentValue - recentAverage) / recentAverage) * 100 : 0;
        }
        console.log('Calculated change:', change);
        
        const sensorDataObject = { 
          current: currentValue, 
          data: chartData,
          chartData: chartData, // Add chartData property for chart rendering
          change: change,
          isInRange: currentValue >= currentSensor.targetRange.min && currentValue <= currentSensor.targetRange.max
        };
        console.log('Setting sensor data:', sensorDataObject);
        setSensorData(sensorDataObject);
      }
    };
    
    fetchHistoricalData();
    const interval = setInterval(fetchHistoricalData, 120000); // Update every 2 mins
    return () => clearInterval(interval);
  }, [user, currentSensor, predictions]);

  // Show loading spinner while checking authentication
  if (authLoading) {
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
        <Typography sx={{ color: '#fff', fontSize: 16, opacity: 0.8 }}>Loading...</Typography>
        
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

  if (!currentSensor) {
    return <div>Loading...</div>;
  }

  const isPositive = sensorData?.change >= 0;
  const changeColor = isPositive ? '#4caf50' : '#f44336';

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
        height: { xs: '100%', md: '90vh' },
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
          overflow: 'auto',
          '&::-webkit-scrollbar': {
                        width: '6px',
                      },
                      '&::-webkit-scrollbar-track': {
                        background: 'transparent',
                      },
                      '&::-webkit-scrollbar-thumb': {
                        background: `${accent}40`,
                        borderRadius: '3px',
                      },
        }}>
          {/* Header with Back Button */}
          <Box sx={{ display: 'flex', alignItems: 'space-between', gap: 2, mb: 2 }}>
            <IconButton
              onClick={() => router.push('/softsensors')}
              sx={{
                color: textColor3,
                '&:hover': {
                  color: currentSensor.color,
                  background: `${currentSensor.color}20`
                }
              }}
            >
              <ArrowBackIcon />
            </IconButton>
            <PageHeader pageName={currentSensor.name} />
          </Box>

          {/* Sensor Overview */}
          <Box sx={{
            background: cardBg,
            display: 'flex',
            flexDirection:'row',
            justifyContent: 'space-around',
            width: '100%'
          }}>
            <Box
            sx={{ 
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                width: '70%',
                border: `1px solid ${currentSensor.color}30`,
                p: 2,
                mb: 0,
                borderRadius: 2,
                m: 1
                }}>
              <Box>
                <Typography sx={{ 
                  color: textColor, 
                  fontSize: 32, 
                  fontWeight: 300,
                  fontFamily: `'Montserrat', sans-serif`
                }}>
                  {sensorData?.current?.toFixed(2) || '---'}
                  <Typography component="span" sx={{ fontSize: 18, color: textColor3, ml: 1 }}>
                    {currentSensor.unit}
                  </Typography>
                </Typography>
                <Typography sx={{ color: textColor3, fontSize: 16, mt: 1 }}>
                  Target Range: {currentSensor.targetRange.min} - {currentSensor.targetRange.max} {currentSensor.unit}
                </Typography>
              </Box>
              
              {sensorData && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {isPositive ? (
                    <TrendingUpIcon sx={{ color: changeColor, fontSize: 24 }} />
                  ) : (
                    <TrendingDownIcon sx={{ color: changeColor, fontSize: 24 }} />
                  )}
                  <Typography sx={{ color: changeColor, fontSize: 18, fontWeight: 600 }}>
                    {isPositive ? '+' : ''}{Math.abs(sensorData.change).toFixed(2)}%
                  </Typography>
                </Box>
              )}
            </Box>

            <Box
                sx={{
                    display: 'flex',
                flexDirection: 'column',
                width: '100%',
                border: `1px solid ${currentSensor.color}30`,
                p: 3,
                mb: 2,
                borderRadius: 2,
                background: `${currentSensor.color}05`
                }}
            >
              <Typography sx={{ 
                color: textColor, 
                fontSize: 16, 
                fontWeight: 600, 
                mb: 2,
                fontFamily: `'Montserrat', sans-serif`
              }}>
                Model Input Features
              </Typography>
              
              <Box sx={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                gap: 2 
              }}>
                {featureValues.map((feature, index) => (
                  <Box key={index} sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    p: 2,
                    borderRadius: 1,
                    background: feature.status === 'critical' ? '#f4433610' :
                                feature.status === 'warning' ? '#ff980010' : 
                                `${currentSensor.color}10`,
                    border: `1px solid ${
                      feature.status === 'critical' ? '#f44336' :
                      feature.status === 'warning' ? '#ff9800' : 
                      currentSensor.color
                    }20`
                  }}>
                    <Box>
                      <Typography sx={{ 
                        color: textColor2, 
                        fontSize: 12, 
                        fontWeight: 500,
                        fontFamily: `'Montserrat', sans-serif`
                      }}>
                        {feature.label}
                      </Typography>
                      <Typography sx={{ 
                        color: textColor, 
                        fontSize: 14, 
                        fontWeight: 600,
                        fontFamily: `'Montserrat', sans-serif`
                      }}>
                        {feature.value} {feature.unit}
                      </Typography>
                    </Box>
                    <Chip 
                      size="small"
                      label={feature.status}
                      sx={{
                        fontSize: 10,
                        height: 20,
                        background: feature.status === 'critical' ? '#f44336' :
                                   feature.status === 'warning' ? '#ff9800' : '#4caf50',
                        color: 'white',
                        fontWeight: 600
                      }}
                    />
                  </Box>
                ))}
              </Box>
            </Box>

            <Typography sx={{ color: textColor2, fontSize: 14, lineHeight: 1.6 }}>
              {currentSensor.description}
            </Typography>
          </Box>

          {/* Detailed Chart */}
          <Paper sx={{
            background: cardBg,
            borderRadius: 3,
            p: 4,
            border: `1px solid ${currentSensor.color}30`,
            height: 400
          }}>
            <Typography sx={{ 
              color: textColor, 
              fontSize: 20, 
              fontWeight: 500, 
              mb: 3,
              fontFamily: `'Montserrat', sans-serif`
            }}>
              12-Hour Trend
            </Typography>
            
            {sensorData?.chartData && sensorData.chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={sensorData.chartData}>
                  <defs>
                    <filter id="detailed-glow" x="-50%" y="-50%" width="200%" height="200%">
                      <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor={currentSensor.color} floodOpacity="0.8" />
                    </filter>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="time" 
                    stroke={textColor3}
                    fontSize={12}
                    tick={{ fill: textColor3 }}
                  />
                  <YAxis 
                    stroke={textColor3}
                    fontSize={12}
                    tick={{ fill: textColor3 }}
                    domain={['dataMin - 5', 'dataMax + 5']}
                  />
                  <Tooltip 
                    contentStyle={{
                      background: cardBg,
                      border: `1px solid ${currentSensor.color}`,
                      borderRadius: 8,
                      color: textColor
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke={currentSensor.color}
                    strokeWidth={3}
                    dot={{ fill: currentSensor.color, strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: currentSensor.color }}
                    filter="url(#detailed-glow)"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ 
                height: 300, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: textColor3
              }}>
                Loading chart data...
              </Box>
            )}
          </Paper>

          
        </Box>
      </Box>
    </Box>
  );
}