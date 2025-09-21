/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { useRequireAuth } from '../hooks/useAuth';
import { FormControl, Select, MenuItem, SelectChangeEvent } from '@mui/material';
import Sidebar from '../components/Sidebar';
import { Box, Typography, Paper, Button, CircularProgress } from '@mui/material';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import SpeedIcon from '@mui/icons-material/Speed';
import ScienceIcon from '@mui/icons-material/Science';
import BoltIcon from '@mui/icons-material/Bolt';
import { accent, cardBg, textColor, textColor2, gradientBg, shadowDrop, col1, col2, col3, col4 } from '../components/ColorPalette';
import PageHeader from '../components/PageHeader';

// Type definitions for optimizer
interface OptimizationTarget {
  [key: string]: number;
}

interface OptimizerResult {
  suggested_targets?: OptimizationTarget;
  model_type?: string;
  optimization_score?: number;
  error?: string;
}

type SectionType = 'Raw Materials & Grinding' | 'Clinkerization';

export default function Optimizer() {
  const { user, loading: authLoading } = useRequireAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OptimizerResult | null>(null);
  const [section, setSection] = useState<SectionType>('Clinkerization');
  const [timer, setTimer] = useState<number>(300); // 5 min in seconds
  const [running, setRunning] = useState(false);

  // Timer effect - only run when authenticated
  useEffect(() => {
    if (!user) return;
    
    let interval: NodeJS.Timeout | null = null;
    if (running && timer > 0) {
      interval = setInterval(() => setTimer(t => t - 1), 1000);
    }
    if (timer === 0 && running) {
      setRunning(false);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [user, running, timer]);

  // Body margin effect
  useEffect(() => {
    document.body.style.margin = '0';
    return () => { document.body.style.margin = ''; };
  }, []);

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

  // Variable lists for each section
  const variables = {
    'Raw Materials & Grinding': {
      constraints: [
        { label: 'Limestone Feeder (%)', value: 'limestone_feeder_pct' },
        { label: 'Clay Feeder (%)', value: 'clay_feeder_pct' },
        { label: 'Mill Vibration (mm/s)', value: 'mill_vibration_mm_s' },
        { label: 'Separator Speed (RPM)', value: 'separator_speed_rpm' },
      ],
      optimization: [
        { label: 'Mill Power (kW)', value: 'power_kw' },
        { label: 'Mill Throughput (t/h)', value: 'mill_throughput_tph' },
        { label: 'Mill Power Consumption (kWh/t)', value: 'mill_power_kwh_ton' },
      ]
    },
    'Clinkerization': {
      constraints: [
        { label: 'Kiln Motor Torque (%)', value: 'kiln_motor_torque_pct' },
        { label: 'Burning Zone Temp (°C)', value: 'burning_zone_temp_c' },
        { label: 'Kiln Inlet O₂ (%)', value: 'kiln_inlet_o2_pct' },
        { label: 'ID Fan Power (kW)', value: 'id_fan_power_kw' },
      ],
      optimization: [
        { label: 'Traditional Fuel Rate (kg/hr)', value: 'trad_fuel_rate_kg_hr' },
        { label: 'Alternative Fuel Rate (kg/hr)', value: 'alt_fuel_rate_kg_hr' },
        { label: 'Raw Meal Feed Rate (t/h)', value: 'raw_meal_feed_rate_tph' },
        { label: 'Kiln Speed (RPM)', value: 'kiln_speed_rpm' },
        { label: 'ID Fan Speed (%)', value: 'id_fan_speed_pct' },
      ]
    }
  };

  const handleStart = async () => {
    setLoading(true);
    setResult(null);
    setRunning(true);
    setTimer(300);
    try {
      const res = await fetch(`http://localhost:8000/optimize_targets?segment=${encodeURIComponent(section)}`);
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ error: 'Failed to run optimizer.' });
    }
    setLoading(false);
  };

  const handleStop = () => {
    setRunning(false);
    setTimer(300);
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
        <Box sx={{ flex: 1, p: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <PageHeader pageName="Optimizer" />
          {/* Header Row with Dropdown */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h4" sx={{fontFamily: `'Montserrat', sans-serif`, color: textColor, fontWeight: 400 }}>
              Clinker Optimizer
            </Typography>
            <FormControl variant="standard" sx={{ minWidth: 220 }}>
              <Select
                value={section}
                onChange={(e: SelectChangeEvent) => setSection(e.target.value as SectionType)}
                sx={{ color: accent, fontWeight: 700, fontSize: 16, background: cardBg, borderRadius: 2 }}
              >
                <MenuItem value="Raw Materials & Grinding">Raw Materials & Grinding</MenuItem>
                <MenuItem value="Clinkerization">Clinkerization</MenuItem>
              </Select>
            </FormControl>
          </Box>
          {/* Vertical Cards for Constraint and Optimization Variables */}
          <Box sx={{ display: 'flex', gap: 4, mb: 2 }}>
            {/* Constraint Variables Card */}
            <Paper sx={{ background: cardBg, borderRadius: 4, p: 4, flex: 1, boxShadow: shadowDrop, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="h6" sx={{ color: accent, fontWeight: 700, mb: 2 }}>Constraint Variables</Typography>
              {variables[section].constraints.map((v, idx) => (
                <Box key={v.value} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                  <Typography sx={{ color: textColor, fontWeight: 600 }}>{v.label}</Typography>
                  {result && result.suggested_targets && result.suggested_targets[v.value] && (
                    <Typography sx={{ color: accent, fontWeight: 700, fontSize: 18 }}>
                      {Number(result.suggested_targets[v.value]).toFixed(2)}
                    </Typography>
                  )}
                </Box>
              ))}
            </Paper>
            {/* Optimization Variables Card */}
            <Paper sx={{ background: cardBg, borderRadius: 4, p: 4, flex: 1, boxShadow: shadowDrop, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="h6" sx={{ color: accent, fontWeight: 700, mb: 2 }}>Optimization Variables</Typography>
              {variables[section].optimization.map((v, idx) => (
                <Box key={v.value} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                  <Typography sx={{ color: textColor, fontWeight: 600 }}>{v.label}</Typography>
                  {result && result.suggested_targets && result.suggested_targets[v.value] && (
                    <Typography sx={{ color: accent, fontWeight: 700, fontSize: 18 }}>
                      {Number(result.suggested_targets[v.value]).toFixed(2)}
                    </Typography>
                  )}
                </Box>
              ))}
            </Paper>
          </Box>
          {/* Optimizer Controls & Output */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {!running ? (
              <Button
                variant="contained"
                sx={{ background: accent, color: textColor, fontWeight: 700, borderRadius: 3, px: 4, py: 1, fontSize: 18 }}
                onClick={handleStart}
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} sx={{ color: textColor }} /> : 'Start Optimizer'}
              </Button>
            ) : (
              <Button
                variant="outlined"
                sx={{ borderColor: accent, color: accent, fontWeight: 700, borderRadius: 3, px: 4, py: 1, fontSize: 18 }}
                onClick={handleStop}
              >
                Stop Optimizer
              </Button>
            )}
            {running && (
              <Typography sx={{ color: accent, fontWeight: 600, ml: 2 }}>
                Time left: {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}
              </Typography>
            )}
            {result && result.model_type && (
              <Typography sx={{ color: textColor, fontWeight: 600, ml: 2, fontSize: 14 }}>
                Model: {result.model_type === 'hybrid_fp_ml' ? 'Hybrid (First Principles + ML)' : result.model_type}
              </Typography>
            )}
            {result && result.optimization_score && (
              <Typography sx={{ color: accent, fontWeight: 600, ml: 2, fontSize: 14 }}>
                Score: {Number(result.optimization_score).toFixed(2)}
              </Typography>
            )}
          </Box>
          {/* Optimizer Output & Error Handling */}
          {result && result.error && (
            <Paper sx={{ background: cardBg, borderRadius: 4, p: 3, mt: 3 }}>
              <Typography variant="h6" sx={{ color: '#f36', fontWeight: 700, mb: 2 }}>Optimizer Error</Typography>
              <Typography sx={{ color: textColor, fontSize: 16 }}>{result.error}</Typography>
            </Paper>
          )}
        </Box>
      </Box>
    </Box>
  );
}