import React, { useState, useEffect } from 'react';
import { fetchPlantReading, PlantReading } from '../services/plantApi';
import { historizePlantReading, getHistoricalData } from '../services/plantHistory';
import { Box, Typography, Paper, Button, FormControl, InputLabel, Select, MenuItem, IconButton } from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import Sidebar from '../components/Sidebar';
import DashboardIcon from '@mui/icons-material/Dashboard'
import AllInclusiveIcon from '@mui/icons-material/AllInclusive';
import VideogameAssetIcon from '@mui/icons-material/VideogameAsset';
import FactoryIcon from '@mui/icons-material/Factory';
import SmartToyIcon from '@mui/icons-material/SmartToy';

const accent = '#00e6fe';
const cardBg = '#17153A';
const textColor = '#fff';
const textColor2 = '#17153A';
const gradientBg = 'linear-gradient(-120deg, #ea67cfff 0%, #5b2be1 100%)';
const menuGrad = 'linear-gradient(180deg, #262250 0%, #17163B 100%)';
const shadowDrop = '3px 5px 23px 3px rgba(0,0,0,0.39);'
const glowBg = 'linear-gradient(135deg, #40DDFF 0%, #0B98C5 100%)';

export default function Dashboard() {
  const [reading, setReading] = useState<PlantReading | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [selectedKpis, setSelectedKpis] = useState<string[]>(['kpi.shc_kcal_kg']);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    const pollReading = async () => {
      try {
        const data = await fetchPlantReading();
        setReading(data);
        await historizePlantReading(data);
        setError(null);
      } catch (e: any) {
        setError(e.message || 'Error fetching reading');
      }
    };
    pollReading();
    interval = setInterval(pollReading, 60000); // poll every 1 min
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchHistoricalData = async () => {
      const data = await getHistoricalData(50);
      setHistoricalData(data);
    };
    fetchHistoricalData();
    
    // Refresh chart data every 2 minutes
    const chartInterval = setInterval(fetchHistoricalData, 120000); // 2 minutes
    return () => clearInterval(chartInterval);
  }, []);

  const getChartData = () => {
    return historicalData.map(item => {
      const dataPoint: any = {
        time: new Date(item.timestamp).toLocaleTimeString(),
      };
      
      selectedKpis.forEach((kpi, index) => {
        const value = kpi.includes('.') ? 
          kpi.split('.').reduce((o: any, i: string) => o && o[i], item) : 
          item[kpi];
        dataPoint[`value${index}`] = value;
      });
      
      return dataPoint;
    });
  };

  const addKpi = () => {
    if (selectedKpis.length < 3) {
      setSelectedKpis([...selectedKpis, 'kpi.lsf']);
    }
  };

  const removeKpi = (index: number) => {
    if (selectedKpis.length > 1) {
      setSelectedKpis(selectedKpis.filter((_, i) => i !== index));
    }
  };

  const updateKpi = (index: number, value: string) => {
    const newKpis = [...selectedKpis];
    newKpis[index] = value;
    setSelectedKpis(newKpis);
  };

  const colors = [accent, '#39e669', '#f36'];

  const kpiOptions = [
    { value: 'kpi.shc_kcal_kg', label: 'Specific Heat Consumption (kcal/kg)' },
    { value: 'kpi.lsf', label: 'Lime Saturation Factor' },
    { value: 'kpi.sec_kwh_ton', label: 'Specific Power Consumption (kWh/t)' },
    { value: 'kpi.tsr_pct', label: 'TSR (Alt. Fuel Ratio %)' },
    // Raw Mill parameters
    { value: 'raw_mill.limestone_feeder_pct', label: 'Limestone Feeder (%)' },
    { value: 'raw_mill.clay_feeder_pct', label: 'Clay Feeder (%)' },
    { value: 'raw_mill.power_kw', label: 'Raw Mill Power (kW)' },
    { value: 'raw_mill.mill_power_kwh_ton', label: 'Mill Power Consumption (kWh/t)' },
    { value: 'raw_mill.mill_vibration_mm_s', label: 'Mill Vibration (mm/s)' },
    { value: 'raw_mill.separator_speed_rpm', label: 'Separator Speed (RPM)' },
    { value: 'raw_mill.mill_throughput_tph', label: 'Mill Throughput (t/h)' },
    // Kiln parameters
    { value: 'kiln.burning_zone_temp_c', label: 'Burning Zone Temperature (°C)' },
    { value: 'kiln.trad_fuel_rate_kg_hr', label: 'Traditional Fuel Rate (kg/hr)' },
    { value: 'kiln.alt_fuel_rate_kg_hr', label: 'Alternative Fuel Rate (kg/hr)' },
    { value: 'kiln.kiln_speed_rpm', label: 'Kiln Speed (RPM)' },
    { value: 'kiln.kiln_motor_torque_pct', label: 'Kiln Motor Torque (%)' },
    { value: 'kiln.o2_level_pct', label: 'O2 Level (%)' },
    // Production parameters
    { value: 'production.clinker_rate_tph', label: 'Clinker Production Rate (t/h)' },
    { value: 'production.clinker_temp_c', label: 'Clinker Temperature (°C)' }
  ];


  useEffect(() => {
    document.body.style.margin = '0';
    return () => { document.body.style.margin = ''; };
  }, []);


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
        }}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h5" sx={{ color: textColor, fontWeight: 700 }}>Dashboard</Typography>
            <Button sx={{ background: accent, color: '#222', borderRadius: 3, fontWeight: 700, textTransform: 'none' }}>Profile</Button>
          </Box>
          {/* KPI Cards */}
          <Box 
            sx={{ 
              display: 'flex',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 3,
              mb: 2
            }}>
            <Paper 
              sx={{
                background: glowBg,
                border: '1px solid rgba(255, 255, 255, 0.2)',
                p: 3,
                borderRadius: 4,
                color: textColor2,
                minWidth: 200,
                transition: '0.3s',
                '&:hover': {
                  boxShadow: '0 4px 24px 0 rgba(0,230,254,0.5)',
                  background: glowBg
                },
              }}>
              <Typography variant="h6">
                {reading ? `${reading.kpi.shc_kcal_kg} kcal/kg` : 'Loading...'}
              </Typography>
              <Typography sx={{ color: textColor2, fontSize: 14 }}>Specific Heat Consumption</Typography>
            </Paper>
            <Paper 
              sx={{
                background: glowBg,
                border: '1px solid rgba(255, 255, 255, 0.2)',
                p: 3,
                borderRadius: 4,
                color: textColor2,
                minWidth: 200,
                transition: '0.3s',
                '&:hover': {
                  boxShadow: '0 4px 24px 0 rgba(0,230,254,0.5)',
                  background: glowBg
                },
              }}>
              <Typography variant="h6">
                {reading ? `${reading.kpi.lsf}` : 'Loading...'}
              </Typography>
              <Typography sx={{ color: textColor2, fontSize: 14 }}>Lime Saturation Factor (LSF)</Typography>
            </Paper>
            <Paper 
              sx={{
                background: glowBg,
                border: '1px solid rgba(255, 255, 255, 0.2)',
                p: 3,
                borderRadius: 4,
                color: textColor2,
                minWidth: 200,
                transition: '0.3s',
                '&:hover': {
                  boxShadow: '0 4px 24px 0 rgba(0,230,254,0.5)',
                  background: glowBg
                },
              }}>
              <Typography variant="h6">
                {reading ? `${reading.kpi.sec_kwh_ton} kWh/t` : 'Loading...'}
              </Typography>
              <Typography sx={{ color: textColor2, fontSize: 14 }}>Specific Power Consumption</Typography>
            </Paper>
            <Paper 
              sx={{
                background: glowBg,
                border: '1px solid rgba(255, 255, 255, 0.2)',
                p: 3,
                borderRadius: 4,
                color: textColor2,
                minWidth: 200,
                transition: '0.3s',
                '&:hover': {
                  boxShadow: '0 4px 24px 0 rgba(0,230,254,0.5)',
                  background: glowBg
                },
              }}>
              <Typography variant="h6">
                {reading ? `${reading.kpi.tsr_pct} %` : 'Loading...'}
              </Typography>
              <Typography sx={{ color: textColor2, fontSize: 14 }}>TSR (Alt. Fuel Ratio)</Typography>
            </Paper>
          </Box>

          {/* Second Row of KPI Cards - New Parameters */}
          <Box 
            sx={{ 
              display: 'flex',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 3,
              mb: 2
            }}>
            <Paper 
              sx={{
                background: glowBg,
                border: '1px solid rgba(255, 255, 255, 0.2)',
                p: 3,
                borderRadius: 4,
                color: textColor2,
                minWidth: 200,
                transition: '0.3s',
                '&:hover': {
                  boxShadow: '0 4px 24px 0 rgba(0,230,254,0.5)',
                  background: glowBg
                },
              }}>
              <Typography variant="h6">
                {reading ? `${reading.raw_mill.mill_throughput_tph} t/h` : 'Loading...'}
              </Typography>
              <Typography sx={{ color: textColor2, fontSize: 14 }}>Mill Throughput</Typography>
            </Paper>
            <Paper 
              sx={{
                background: glowBg,
                border: '1px solid rgba(255, 255, 255, 0.2)',
                p: 3,
                borderRadius: 4,
                color: textColor2,
                minWidth: 200,
                transition: '0.3s',
                '&:hover': {
                  boxShadow: '0 4px 24px 0 rgba(0,230,254,0.5)',
                  background: glowBg
                },
              }}>
              <Typography variant="h6">
                {reading ? `${reading.kiln.kiln_motor_torque_pct} %` : 'Loading...'}
              </Typography>
              <Typography sx={{ color: textColor2, fontSize: 14 }}>Kiln Motor Torque</Typography>
            </Paper>
            <Paper 
              sx={{
                background: glowBg,
                border: '1px solid rgba(255, 255, 255, 0.2)',
                p: 3,
                borderRadius: 4,
                color: textColor2,
                minWidth: 200,
                transition: '0.3s',
                '&:hover': {
                  boxShadow: '0 4px 24px 0 rgba(0,230,254,0.5)',
                  background: glowBg
                },
              }}>
              <Typography variant="h6">
                {reading ? `${reading.kiln.o2_level_pct} %` : 'Loading...'}
              </Typography>
              <Typography sx={{ color: textColor2, fontSize: 14 }}>O2 Level</Typography>
            </Paper>
            <Paper 
              sx={{
                background: glowBg,
                border: '1px solid rgba(255, 255, 255, 0.2)',
                p: 3,
                borderRadius: 4,
                color: textColor2,
                minWidth: 200,
                transition: '0.3s',
                '&:hover': {
                  boxShadow: '0 4px 24px 0 rgba(0,230,254,0.5)',
                  background: glowBg
                },
              }}>
              <Typography variant="h6">
                {reading ? `${reading.production.clinker_temp_c} °C` : 'Loading...'}
              </Typography>
              <Typography sx={{ color: textColor2, fontSize: 14 }}>Clinker Temperature</Typography>
            </Paper>
          </Box>


          {/* Interactive Chart */}
          <Paper
            sx={{
              background: cardBg,
              borderRadius: 4,
              p: 4,
              mb: 2,
              minHeight: 400,
              }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography sx={{
                color: accent,
                fontWeight: 700,
                fontSize: 18
                }}>
                  KPI Trend
              </Typography>
            </Box>
            
            {/* Chart and Selectors Side by Side */}
            <Box sx={{ display: 'flex', gap: 3, height: 300 }}>
              {/* Chart Area - 80% width */}
              <Box sx={{ flex: '0 0 80%' }}>
                {historicalData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={getChartData()}>
                      <XAxis 
                        dataKey="time" 
                        stroke="#b6d4e3"
                        fontSize={12}
                      />
                      <YAxis 
                        yAxisId="left"
                        stroke="#b6d4e3"
                        fontSize={12}
                      />
                      {selectedKpis.length > 1 && (
                        <YAxis 
                          yAxisId="right"
                          orientation="right"
                          stroke="#b6d4e3"
                          fontSize={12}
                        />
                      )}
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: cardBg,
                          border: '1px solid rgba(255,255,255,0.2)',
                          borderRadius: 8,
                          color: textColor
                        }}
                      />
                      <Legend />
                      {selectedKpis.map((kpi, index) => (
                        <Line 
                          key={index}
                          type="monotone" 
                          dataKey={`value${index}`}
                          stroke={colors[index]} 
                          strokeWidth={2}
                          dot={{ fill: colors[index], strokeWidth: 2, r: 4 }}
                          activeDot={{ r: 6, fill: colors[index] }}
                          yAxisId={index < 2 ? "left" : "right"}
                          name={kpiOptions.find(opt => opt.value === kpi)?.label || kpi}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <Box
                    sx={{
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#b6d4e3',
                      opacity: 0.7
                    }}>
                    <Typography>Loading historical data...</Typography>
                  </Box>
                )}
              </Box>
              
              {/* Selectors Area - 20% width */}
              <Box sx={{ flex: '0 0 20%', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <IconButton 
                    onClick={addKpi}
                    disabled={selectedKpis.length >= 3}
                    sx={{ 
                      color: accent,
                      '&:disabled': { color: 'rgba(255,255,255,0.3)' }
                    }}
                  >
                    <AddIcon />
                  </IconButton>
                  <Typography sx={{ color: '#b6d4e3', fontSize: 12 }}>
                    {selectedKpis.length}/3
                  </Typography>
                </Box>
                
                {selectedKpis.map((kpi, index) => (
                  <Box key={index} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{ color: colors[index], fontSize: 14, fontWeight: 600 }}>
                        Var {index + 1}
                      </Typography>
                      {selectedKpis.length > 1 && (
                        <IconButton 
                          onClick={() => removeKpi(index)}
                          sx={{ color: '#f36', padding: 0.5 }}
                          size="small"
                        >
                          <RemoveIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                    <FormControl variant="standard" sx={{ width: '100%' }}>
                      <Select
                        value={kpi}
                        onChange={(e) => updateKpi(index, e.target.value)}
                        sx={{
                          color: textColor,
                          fontSize: 12,
                          '&:before': {
                            borderBottomColor: colors[index],
                          },
                          '&:hover:not(.Mui-disabled):before': {
                            borderBottomColor: colors[index],
                          },
                          '&:after': {
                            borderBottomColor: colors[index],
                          },
                        }}
                      >
                        {kpiOptions.map((option) => (
                          <MenuItem key={option.value} value={option.value} sx={{ fontSize: 12 }}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                ))}
              </Box>
            </Box>
          </Paper>
          
        </Box>
      </Box>
    </Box>
  );
}
