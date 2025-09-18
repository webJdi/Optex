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
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import PowerIcon from '@mui/icons-material/Power';
import SolarPowerIcon from '@mui/icons-material/SolarPower';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import MicIcon from '@mui/icons-material/Mic';
import CloseIcon from '@mui/icons-material/Close';
import PsychologyIcon from '@mui/icons-material/Psychology';
import SendIcon from '@mui/icons-material/Send';

import { chatBg, accent, cardBg, textColor, menuGrad, textColor2, textColor3, gradientBg, glowBg1, glowBg2, glowBg3, glowBg4, glowCol1, glowCol2, glowCol3, glowCol4, shadowDrop, col1, col2, col3, col4 } from '../components/ColorPalette';

function VoiceChatButton() {
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState('');
  const [response, setResponse] = React.useState('');
  const [listening, setListening] = React.useState(false);
  const [voiceSent, setVoiceSent] = React.useState(false);

  // Voice input
  const startVoice = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.onresult = (event: any) => {
      setInput(event.results[0][0].transcript);
      setVoiceSent(true);
    };
    recognition.start();
    setListening(true);
    recognition.onend = () => {
      setListening(false);
      // Automatically send query when speaker stops
      setTimeout(() => {
        if (input) sendQuery();
      }, 100);
    };
  };

  // Voice output
  const speak = (text: string) => {
    const synth = window.speechSynthesis;
    const utter = new window.SpeechSynthesisUtterance(text);
    synth.speak(utter);
  };

  const sendQuery = async () => {
    const res = await fetch('/api/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: input }),
    });
    const data = await res.json();
    setResponse(data.answer);
    speak(data.answer);
  };

  return (
    <>
      <Box sx={{
        position: 'fixed',
        bottom: 60,
        right: 120,
        zIndex: 9999,
        bgcolor: glowBg1,
        borderRadius: '50%',
      }}>
        {/* Pulse Animation */}
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 70,
            height: 70,
            borderRadius: '50%',
            pointerEvents: 'none',
            zIndex: 0,
            boxShadow: `0 0 0 0 ${glowCol2}`,
            animation: 'pulse 1.5s infinite',
            border: `2px solid ${glowCol2}`,
          }}
        />
        {/* Floating Button */}
        <Button
          variant="contained"
          color="primary"
          sx={{
            borderRadius: '50%',
            minWidth: 0,
            width: 70,
            height: 70,
            boxShadow: 6,
            background: glowBg2,
            padding: '2px',
            position: 'relative',
            zIndex: 1,
          }}
          onClick={() => {
            setOpen(true);
            startVoice();
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              transition: 'background 0.5s, color 0.5s',
              justifyContent: 'center',
              height: '100%',
              width: '100%',
              borderRadius: '50%',
              background: cardBg,
              '&:hover': {
                background: glowBg2,
                '& .icon-hover': {
                  color: cardBg,
                },
              },
            }}
          >
            {open ? (
              <MicIcon className="icon-hover" sx={{ fontSize: 32, color: glowCol2, transition: 'color 0.2s' }} />
            ) : (
              <PsychologyIcon className="icon-hover" sx={{ fontSize: 32, color: glowCol2, transition: 'color 0.2s' }} />
            )}
          </Box>
        </Button>
        {/* Text bubble above button */}
        {voiceSent && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 80,
              left: '50%',
              transform: 'translateX(-50%)',
              bgcolor: 'rgba(38, 34, 79, 0.7)',
              color: textColor,
              px: 2,
              py: 3,
              borderRadius: '20px',
              boxShadow: 4,
              minWidth: 220,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              fontSize: 16,
              zIndex: 2,
              border: `1px solid ${glowCol2}`,
              transition: 'opacity 0.3s',
            }}
          >
            <span style={{ flex: 1, fontSize: 14 }}>{input}</span>
            <Button
              variant="contained"
              color="primary"
              size="small"
              
              sx={{
                borderRadius: 12,
                minWidth: 0,
                px: 1.5,
                py: 0.5,
                fontSize: 14,
                boxShadow: 2,
                background: 'transparent',
                '&:hover': {
                  background: 'rgba(255, 255, 255, 0.1)',
                }
              }}
              onClick={sendQuery}
            >
              <SendIcon />
            </Button>
          </Box>
        )}
      </Box>
      {/* Pulse keyframes */}
      <style>
        {`
          @keyframes pulse {
            0% {
              box-shadow: 0 0 0 0 ${glowCol2};
              opacity: 0.7;
            }
            70% {
              box-shadow: 0 0 0 24px rgba(0,230,254,0);
              opacity: 0;
            }
            100% {
              box-shadow: 0 0 0 0 ${glowCol2};
              opacity: 0;
            }
          }
        `}
      </style>
    </>
  );
}

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
          p: 4,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h4" sx={{fontFamily: `'Montserrat', sans-serif`, color: textColor, fontWeight: 400 }}>Dashboard</Typography>
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
                background: cardBg,
                border: '1px solid'+ glowCol1,
                p: 3,
                borderRadius: 4,
                color: glowCol1,
                display: 'flex',
                flexDirection: 'row',
                minWidth: 200,
                transition: '0.3s',
                '&:hover': {
                  boxShadow: '0 4px 24px 0 rgba(0,230,254,0.5)',
                  //background: glowBg1
                },
              }}>
                <LocalFireDepartmentIcon fontSize="large" sx={{ color: glowCol1 }} />
                <Box
                  sx={{ display: 'flex', flexDirection: 'column', ml: 2, justifyContent: 'center' }}
                >
                  <Typography variant="h6">
                  {reading ? `${reading.kpi.shc_kcal_kg} kcal/kg` : 'Loading...'}
                  </Typography>
                  <Typography sx={{ color: glowCol1, fontSize: 12 }}>Specific Heat Consumption</Typography>
                </Box>
            </Paper>


            <Paper 
              sx={{
                background: cardBg,
                border: '1px solid '+ glowCol2,
                p: 3,
                borderRadius: 4,
                color: glowCol2,
                display: 'flex',
                flexDirection: 'row',
                minWidth: 200,
                transition: '0.3s',
                '&:hover': {
                  boxShadow: '0 4px 24px 0'+ glowCol2,
                  //background: glowBg2
                },
              }}>
              <LocalShippingIcon fontSize="large" sx={{ color: glowCol2 }} />
              <Box
                sx={{ display: 'flex', flexDirection: 'column', ml: 2, justifyContent: 'center' }}
              >
                <Typography variant="h6">
                  {reading ? `${reading.kpi.lsf}` : 'Loading...'}
                </Typography>
                <Typography sx={{ color: glowCol2, fontSize: 12 }}>Lime Saturation Factor (LSF)</Typography>
              </Box>
            </Paper>


            <Paper 
              sx={{
                background: cardBg,
                border: '1px solid '+ glowCol3,
                p: 3,
                borderRadius: 4,
                color: glowCol3,
                minWidth: 200,
                display: 'flex',
                flexDirection: 'row',
                transition: '0.3s',
                '&:hover': {
                  boxShadow: '0 4px 24px 0'+ glowCol3,
                  //background: glowBg3
                },
              }}>
              <PowerIcon fontSize="large" sx={{ color: glowCol3 }} />
              <Box
                sx={{ display: 'flex', flexDirection: 'column', ml: 2, justifyContent: 'center' }}
              >
                <Typography variant="h6">
                  {reading ? `${reading.kpi.sec_kwh_ton} kWh/t` : 'Loading...'}
                </Typography>
                <Typography sx={{ color: glowCol3, fontSize: 12 }}>Specific Power Consumption</Typography>
              </Box>
            </Paper>


            <Paper 
              sx={{
                background: cardBg,
                border: '1px solid '+ glowCol4,
                p: 3,
                borderRadius: 4,
                color: glowCol4,
                minWidth: 200,
                display: 'flex',
                flexDirection: 'row',
                transition: '0.3s',
                '&:hover': {
                  boxShadow: '0 4px 24px 0'+ glowCol4,
                  //background: glowBg4
                },
              }}>
              <SolarPowerIcon fontSize="large" sx={{ color: glowCol4 }} />
              <Box
                sx={{ display: 'flex', flexDirection: 'column', ml: 2, justifyContent: 'center' }}
              >
                <Typography variant="h6">
                  {reading ? `${reading.kpi.tsr_pct} %` : 'Loading...'}
                </Typography>
                <Typography sx={{ color: glowCol4, fontSize: 12 }}>TSR (Alt. Fuel Ratio)</Typography>
              </Box>
            </Paper>
 

          </Box>


          {/* Interactive Chart */}
          <Paper
            sx={{
              background: 'linear-gradient(120deg, #17153A 0%, #1a1a3d 100%)',
              borderRadius: 8,
              p: 4,
              mb: 0,
              minHeight: 350,
              boxShadow: '0 4px 32px 0 rgba(0,230,254,0.12)',
              position: 'relative',
              overflow: 'visible',
            }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography sx={{
                color: accent,
                fontWeight: 400,
                fontSize: 18,
                fontFamily: 'Montserrat, sans-serif'
                }}>
                  KPI Trend
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 3, height: 400 }}>
              <Box sx={{ flex: '0 0 80%', position: 'relative' }}>
                {historicalData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={getChartData()} margin={{ top: 30, right: 30, left: 0, bottom: 0 }}>
                      <defs>
                        <filter id="neon-glow" x="-50%" y="-50%" width="200%" height="200%">
                          <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#00e6fe" floodOpacity="0.7" />
                          <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#fff" floodOpacity="0.3" />
                        </filter>
                      </defs>
                      <XAxis 
                        dataKey="time" 
                        stroke="#4dd0e1"
                        fontSize={13}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#b6d4e3', fontWeight: 500 }}
                      />
                      <YAxis 
                        yAxisId="left"
                        stroke="#4dd0e1"
                        fontSize={13}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#b6d4e3', fontWeight: 500 }}
                        width={40}
                        domain={[dataMin => Math.floor(dataMin * 0.98), dataMax => Math.ceil(dataMax * 1.02)]}
                      />
                      {selectedKpis.length > 1 && (
                        <YAxis 
                          yAxisId="right"
                          orientation="right"
                          stroke="#ea67cf"
                          fontSize={13}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#ea67cf', fontWeight: 500 }}
                          width={40}
                          domain={[dataMin => Math.floor(dataMin * 0.98), dataMax => Math.ceil(dataMax * 1.02)]}
                        />
                      )}
                      <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                      <Tooltip 
                        contentStyle={{
                          background: 'rgba(23,21,58,0.95)',
                          border: '1px solid #00e6fe',
                          borderRadius: 12,
                          color: textColor,
                          fontWeight: 700,
                          fontSize: 16,
                          boxShadow: '0 2px 16px 0 #00e6fe44',
                        }}
                        itemStyle={{ fontWeight: 700, fontSize: 15 }}
                        labelStyle={{ color: accent, fontWeight: 700, fontSize: 15 }}
                        cursor={{ stroke: accent, strokeWidth: 2, opacity: 0.3 }}
                        formatter={(value, name, props) => [value, name]}
                      />
                      <Legend wrapperStyle={{ color: textColor, fontWeight: 700, fontSize: 15 }} />
                      {selectedKpis.map((kpi, index) => (
                        <Line 
                          key={index}
                          type="monotone"
                          dataKey={`value${index}`}
                          stroke={colors[index]}
                          strokeWidth={4}
                          dot={false}
                          activeDot={false}
                          yAxisId={index === 0 ? "left" : "right"}
                          name={kpiOptions.find(opt => opt.value === kpi)?.label || kpi}
                          filter="url(#neon-glow)"
                          strokeOpacity={0.5}
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
              
              {/* Selectors Area */}
              <Box sx={{ flex: '0 0 20%', display: 'flex', flexDirection: 'column', gap: 0 }}>
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
                        Variable {index + 1}
                      </Typography>
                      {selectedKpis.length > 1 && (
                        <IconButton 
                          onClick={() => removeKpi(index)}
                          sx={{ color: accent, padding: 0.5 }}
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
      <VoiceChatButton />
    </Box>
    
  );
}
