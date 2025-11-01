/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRequireAuth } from '../hooks/useAuth';
import { FormControl, Select, MenuItem, SelectChangeEvent } from '@mui/material';
import Sidebar from '../components/Sidebar';
import { Box, Typography, Paper, Button, CircularProgress, Modal, TextField, Slider } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SettingsIcon from '@mui/icons-material/Settings';
import StopIcon from '@mui/icons-material/Stop';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import SpeedIcon from '@mui/icons-material/Speed';
import ScienceIcon from '@mui/icons-material/Science';
import BoltIcon from '@mui/icons-material/Bolt';
import { accent, cardBg, textColor, textColor2, textColor3, gradientBg, shadowDrop, col1, col2, col3, col4 } from '../components/ColorPalette';
import PageHeader from '../components/PageHeader';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// Type definitions for optimizer
interface OptimizationTarget {
  [key: string]: number;
}

interface OptimizationResult {
  success?: boolean;
  segment?: string;
  optimization_type?: string;
  suggested_targets?: OptimizationTarget;
  soft_sensors?: Record<string, number>;
  optimization_score?: number;
  economic_value?: number;
  constraint_violations?: string[];
  model_type?: string;
  error?: string;
}

interface DualOptimizationResponse {
  apc_optimization?: OptimizationResult;
  engineering_optimization?: OptimizationResult;
  optimization_history?: Array<{
    trial: number;
    economic_value: number;
    constraint_penalty: number;
    objective_score: number;
    optimization_vars?: Record<string, number>;
    constraint_vars?: Record<string, number>;
  }>;
  pricing_details?: Record<string, number>;
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
  const [result, setResult] = useState<DualOptimizationResponse | null>(null);
  const [section, setSection] = useState<SectionType>('Clinkerization');
  const [timer, setTimer] = useState<number>(300); // 5 min in seconds
  const [running, setRunning] = useState(false);
  const [autoSchedule, setAutoSchedule] = useState(false);
  const hasLoadedInitialState = useRef(false); // Track if we've loaded state from Firebase
  
  // State for toggling chart lines
  const [hiddenOptimizationLines, setHiddenOptimizationLines] = useState<Record<string, boolean>>({});
  const [hiddenConstraintLines, setHiddenConstraintLines] = useState<Record<string, boolean>>({});
  
  // Settings modal state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pricing, setPricing] = useState({
    limestone_price_per_ton: 50,
    clay_price_per_ton: 40,
    traditional_fuel_price_per_kg: 0.15,
    alternative_fuel_price_per_kg: 0.08,
    clinker_selling_price_per_ton: 120,
    electricity_price_per_kwh: 0.12,
    byproduct_credit_per_ton: 10
  });
  const [mlFpRatio, setMlFpRatio] = useState(0.3); // ML weight (FP weight = 1 - mlFpRatio)

  // Memoize chart data to prevent flickering on re-renders
  const optimizationChartData = useMemo(() => {
    if (!result?.optimization_history || result.optimization_history.length === 0) return [];
    
    const apcData = result.optimization_history.slice(0, Math.floor(result.optimization_history.length / 2));
    return apcData.map((trial, idx) => {
      const vars = trial.optimization_vars || {};
      return {
        trial: idx + 1,
        trad_fuel: vars.trad_fuel_rate_kg_hr || null,
        alt_fuel: vars.alt_fuel_rate_kg_hr || null,
        raw_meal: vars.raw_meal_feed_rate_tph || null,
        kiln_speed: vars.kiln_speed_rpm || null,
        fan_speed: vars.id_fan_speed_pct || null,
      };
    });
  }, [result?.optimization_history]);

  const constraintChartData = useMemo(() => {
    if (!result?.optimization_history || result.optimization_history.length === 0) return [];
    
    const apcData = result.optimization_history.slice(0, Math.floor(result.optimization_history.length / 2));
    return apcData.map((trial, idx) => {
      const constraints = trial.constraint_vars || {};
      return {
        trial: idx + 1,
        torque: constraints.kiln_motor_torque_pct || null,
        temp: constraints.burning_zone_temp_c || null,
        o2: constraints.kiln_inlet_o2_pct || null,
        fan_power: constraints.id_fan_power_kw || null,
        benefit: trial.economic_value || null,
      };
    });
  }, [result?.optimization_history]);

  // Load initial optimizer state and latest results on mount - ONLY ONCE
  useEffect(() => {
    if (!user) return;
    
    const loadInitialData = async () => {
      try {
        const { db } = await import('../services/firebase');
        const { collection, query, orderBy, limit, getDocs, doc, getDoc } = await import('firebase/firestore');
        
        // Load optimizer state from Firebase
        const stateDocRef = doc(db, 'optimizer_state', 'current');
        const stateDoc = await getDoc(stateDocRef);
        
        if (stateDoc.exists()) {
          const state = stateDoc.data();
          const isRunning = state.running || false;
          const isAutoSchedule = state.autoSchedule || false;
          
          setRunning(isRunning);
          setAutoSchedule(isAutoSchedule);
          
          // Calculate remaining time based on last update
          if (isRunning && state.lastUpdateTime) {
            const elapsed = Math.floor((Date.now() - state.lastUpdateTime) / 1000);
            const remaining = Math.max(0, (state.timer || 300) - elapsed);
            setTimer(remaining);
          } else {
            setTimer(state.timer || 300);
          }
          
          console.log('Loaded optimizer state from Firebase:', { isRunning, isAutoSchedule });
        }

        // Mark that we've loaded the initial state
        hasLoadedInitialState.current = true;

        // Load settings (pricing and ML/FP ratio) from Firebase
        const settingsDocRef = doc(db, 'optimizer_settings', 'current');
        const settingsDoc = await getDoc(settingsDocRef);
        
        if (settingsDoc.exists()) {
          const settings = settingsDoc.data();
          if (settings.pricing) {
            setPricing(settings.pricing);
          }
          if (settings.mlFpRatio !== undefined) {
            setMlFpRatio(settings.mlFpRatio);
          }
          console.log('Loaded settings from Firebase:', settings);
        }

        // Load latest optimization results from Firebase
        const q = query(
          collection(db, 'optimized_targets'),
          orderBy('timestamp', 'desc'),
          limit(1)
        );
        
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const latestDoc = querySnapshot.docs[0].data();
          
          const reconstructedResult: DualOptimizationResponse = {
            apc_optimization: {
              suggested_targets: latestDoc.apc_targets || {},
              economic_value: latestDoc.apc_economic_value || 0,
              optimization_score: latestDoc.apc_optimization_score || 0,
              model_type: 'hybrid_fp_ml',
              success: true
            },
            engineering_optimization: {
              suggested_targets: latestDoc.engineering_targets || {},
              economic_value: latestDoc.engineering_economic_value || 0,
              optimization_score: latestDoc.engineering_optimization_score || 0,
              model_type: 'hybrid_fp_ml',
              success: true
            },
            pricing_details: latestDoc.pricing_details || {},
            optimization_history: latestDoc.optimization_history || []  // Load convergence plot data
          };
          
          console.log('Loaded optimization_history:', latestDoc.optimization_history);
          console.log('Reconstructed result:', reconstructedResult);
          
          setResult(reconstructedResult);
          console.log('Loaded latest optimization from Firebase');
        }
      } catch (error) {
        console.error('Error loading initial data:', error);
      }
    };

    loadInitialData();
  }, [user]);

  // Save optimizer state to Firebase whenever it changes (only save running/autoSchedule, not timer)
  // DO NOT save on initial mount - only save when user clicks play/stop buttons
  useEffect(() => {
    if (!user || !hasLoadedInitialState.current) return;
    
    const saveStateToFirebase = async () => {
      try {
        const { db } = await import('../services/firebase');
        const { doc, setDoc } = await import('firebase/firestore');
        
        const stateDocRef = doc(db, 'optimizer_state', 'current');
        await setDoc(stateDocRef, {
          running,
          autoSchedule,
          timer,
          lastUpdateTime: Date.now(),
          userId: user.uid
        });
        
        console.log('Saved state to Firebase:', { running, autoSchedule, timer });
      } catch (error) {
        console.error('Error saving optimizer state:', error);
      }
    };

    saveStateToFirebase();
  }, [user, running, autoSchedule]); // Removed timer from dependencies

  // Poll for new optimization results (doesn't trigger optimization, just loads results)
  useEffect(() => {
    if (!user || !autoSchedule || !running) return;
    
    // Poll every 15 seconds to reload results when background worker completes optimization
    const pollInterval = setInterval(async () => {
      try {
        const { db } = await import('../services/firebase');
        const { collection, query, orderBy, limit, getDocs } = await import('firebase/firestore');
        
        const q = query(
          collection(db, 'optimized_targets'),
          orderBy('timestamp', 'desc'),
          limit(1)
        );
        
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const latestDoc = querySnapshot.docs[0].data();
          
          const reconstructedResult: DualOptimizationResponse = {
            apc_optimization: {
              suggested_targets: latestDoc.apc_targets || {},
              economic_value: latestDoc.apc_economic_value || 0,
              optimization_score: latestDoc.apc_optimization_score || 0,
              model_type: 'hybrid_fp_ml',
              success: true
            },
            engineering_optimization: {
              suggested_targets: latestDoc.engineering_targets || {},
              economic_value: latestDoc.engineering_economic_value || 0,
              optimization_score: latestDoc.engineering_optimization_score || 0,
              model_type: 'hybrid_fp_ml',
              success: true
            },
            pricing_details: latestDoc.pricing_details || {},
            optimization_history: latestDoc.optimization_history || []  // Load convergence plot data
          };
          
          setResult(reconstructedResult);
        }
      } catch (error) {
        console.error('Error polling for results:', error);
      }
    }, 15000); // Poll every 15 seconds
    
    return () => clearInterval(pollInterval);
  }, [user, autoSchedule, running]);

  // Timer countdown effect (UI only - actual optimization runs in background worker)
  useEffect(() => {
    if (!user || !running) return;
    
    let interval: NodeJS.Timeout | null = null;
    if (timer > 0) {
      interval = setInterval(() => setTimer(t => t - 1), 1000);
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
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      
      // Call the GET endpoint which queues the optimization request
      const res = await fetch(`${backendUrl}/optimize_targets?segment=${encodeURIComponent(section)}`);
      const data = await res.json();
      
      if (data.status === 'queued') {
        console.log('Optimization queued:', data.message);
        
        // Start auto-schedule timer - worker will handle actual optimization
        setRunning(true);
        setAutoSchedule(true);
        setTimer(300); // Reset to 5 minutes
        
        // Update timer in Firebase
        const { db } = await import('../services/firebase');
        const { doc, setDoc } = await import('firebase/firestore');
        const stateDocRef = doc(db, 'optimizer_state', 'current');
        await setDoc(stateDocRef, {
          running: true,
          autoSchedule: true,
          timer: 300,
          lastUpdateTime: Date.now(),
          segment: section
        });
      } else if (data.error) {
        console.error('Error queuing optimization:', data.error);
      }
    } catch (error) {
      console.error('Failed to queue optimization:', error);
    }
    setLoading(false);
  };

  const handleStop = () => {
    setRunning(false);
    setAutoSchedule(false);
    setTimer(300);
  };

  // Save settings to Firebase
  const handleSaveSettings = async () => {
    try {
      const { db } = await import('../services/firebase');
      const { doc, setDoc } = await import('firebase/firestore');
      
      const settingsDocRef = doc(db, 'optimizer_settings', 'current');
      await setDoc(settingsDocRef, {
        pricing,
        mlFpRatio,
        lastUpdated: Date.now(),
        userId: user?.uid
      });
      
      console.log('Settings saved to Firebase:', { pricing, mlFpRatio });
      setSettingsOpen(false);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  // Save optimization results to Firebase
  const saveOptimizationToFirebase = async (data: DualOptimizationResponse) => {
    try {
      const { db } = await import('../services/firebase');
      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
      
      const optimizationRecord = {
        timestamp: serverTimestamp(),
        segment: section,
        apc_targets: data.apc_optimization?.suggested_targets || {},
        apc_economic_value: data.apc_optimization?.economic_value || 0,
        apc_optimization_score: data.apc_optimization?.optimization_score || 0,
        engineering_targets: data.engineering_optimization?.suggested_targets || {},
        engineering_economic_value: data.engineering_optimization?.economic_value || 0,
        engineering_optimization_score: data.engineering_optimization?.optimization_score || 0,
        economic_benefit: data.engineering_optimization?.economic_value && data.apc_optimization?.economic_value
          ? data.engineering_optimization.economic_value - data.apc_optimization.economic_value
          : 0,
        pricing_details: data.pricing_details || {}
      };
      
      await addDoc(collection(db, 'optimized_targets'), optimizationRecord);
      console.log('Optimization saved to Firebase');
    } catch (error) {
      console.error('Error saving to Firebase:', error);
    }
  };

  // Calculate economic benefit
  const getEconomicBenefit = () => {
    if (!result?.apc_optimization?.economic_value || !result?.engineering_optimization?.economic_value) {
      return null;
    }
    const apcValue = result.apc_optimization.economic_value;
    const engValue = result.engineering_optimization.economic_value;
    const benefit = engValue - apcValue;
    const percentBenefit = (benefit / apcValue) * 100;
    return { benefit, percentBenefit, apcValue, engValue };
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
        <Box sx={{ flex: 1, p: 4, display: 'flex', flexDirection: 'column', gap: 2, overflow: 'auto' }}>
          <PageHeader pageName="Optimizer" />
          
          {/* Header Row with Controls */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {loading && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={16} sx={{ color: accent }} />
                  <Typography sx={{ color: textColor2, fontSize: 12 }}>
                    Running optimization...
                  </Typography>
                </Box>
              )}
              
              
            </Box>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                background: textColor3,
                p: 1,
                borderRadius: 2,
              }}
            >
              {running && (
                <Typography sx={{ color: textColor, fontWeight: 600, fontSize: 13 }}>
                  Next Target: {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}
                </Typography>
              )}
                <Box sx={{
                  width: 120,
                  height: 30,
                  background: 'linear-gradient(135deg, rgba(42, 39, 82, 0.6) 0%, rgba(31, 28, 68, 0.8) 100%)',
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                }}>
                  <Box
                    sx={{
                      width: 60,
                      height: 30,
                      background: running || loading 
                        ? 'linear-gradient(135deg, rgba(106, 130, 251, 0.4) 0%, rgba(80, 100, 200, 0.6) 100%)'
                        : 'linear-gradient(135deg, rgba(42, 39, 82, 0.6) 0%, rgba(31, 28, 68, 0.8) 100%)',
                      borderRight: '1px solid rgba(106, 130, 251, 0.3)',
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: (running || loading) ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      opacity: (running || loading) ? 0.6 : 1,
                      '&:hover': (running || loading) ? {} : {
                        background: 'linear-gradient(135deg, rgba(52, 49, 92, 0.8) 0%, rgba(41, 38, 78, 1) 100%)',
                        borderColor: 'rgba(106, 130, 251, 0.6)',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 4px 12px rgba(106, 130, 251, 0.3)',
                      },
                    }}
                    onClick={() => {
                      if (!running && !loading) handleStart();
                    }}
                  >
                    <PlayArrowIcon sx={{ color: textColor }} />
                  </Box>
                  <Box
                    sx={{
                      width: 60,
                      height: 30,
                      background: (!running && !loading) 
                        ? 'linear-gradient(135deg, rgba(42, 39, 82, 0.4) 0%, rgba(31, 28, 68, 0.6) 100%)'
                        : 'linear-gradient(135deg, rgba(42, 39, 82, 0.6) 0%, rgba(31, 28, 68, 0.8) 100%)',
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: (!running && !loading) ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      opacity: (!running && !loading) ? 0.4 : 1,
                      '&:hover': (!running && !loading) ? {} : {
                        background: 'linear-gradient(135deg, rgba(52, 49, 92, 0.8) 0%, rgba(41, 38, 78, 1) 100%)',
                        borderColor: 'rgba(106, 130, 251, 0.6)',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 4px 12px rgba(106, 130, 251, 0.3)',
                      },
                    }}
                    onClick={() => {
                      if (running || loading) handleStop();
                    }}
                  >
                    <StopIcon sx={{ color: textColor }} />
                  </Box>
                </Box>
              </Box>
              <Button onClick={() => setSettingsOpen(true)}>
                <SettingsIcon sx={{ color: textColor3, '&:hover': { color: '#fff' } }} />
              </Button>
          </Box>

          

          {/* Variables Section - Top */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            {/* Constraint Variables */}
            <Box sx={{ flex: 1 }}>
              <Box sx={{ background: cardBg, borderRadius: 3, p: 2 }}>
                <Typography sx={{ color: textColor, fontWeight: 300, mb: 2, fontSize: 14, fontFamily: `'Montserrat', sans-serif` }}>
                  Constraint Variables
                </Typography>
                
                {/* Header Row */}
                <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                  <Box sx={{ flex: 5 }}></Box>
                  <Box sx={{ 
                    flex: 1, 
                    textAlign: 'center',
                    borderRadius: 1,
                    py: 0.5
                  }}>
                    <Typography sx={{ color: textColor3, fontSize: 12, fontWeight: 600 }}>
                      Actual Target
                    </Typography>
                  </Box>
                  <Box sx={{ 
                    flex: 1, 
                    textAlign: 'center',
                    borderRadius: 1,
                    py: 0.5
                  }}>
                    <Typography sx={{ color: textColor3, fontSize: 10, fontWeight: 600 }}>
                      Beyond Range Target
                    </Typography>
                  </Box>
                </Box>

                {/* Variable Rows */}
                {variables[section].constraints.map((v) => (
                  
                    <Box key={v.value} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
                      <Typography sx={{ flex: 2, color: textColor3, fontSize: 14 }}>
                        {v.label}
                      </Typography>
                      <Box
                        sx={{
                          width: 160,
                          height: 40,
                          background: 'linear-gradient(135deg, rgba(42, 39, 82, 0.6) 0%, rgba(31, 28, 68, 0.8) 100%)',
                          borderRadius: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: textColor,
                          fontSize: 16,
                          fontWeight: 500,
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',

                        }}
                      >
                      <Box sx={{ flex: 1, textAlign: 'center' }}>
                        {result?.apc_optimization?.suggested_targets?.[v.value] !== undefined && (
                          <Typography sx={{ color: textColor, fontWeight: 600, fontSize: 14 }}>
                            {Number(result.apc_optimization.suggested_targets[v.value]).toFixed(2)}
                          </Typography>
                        )}
                      </Box>
                      <Box sx={{ flex: 1, textAlign: 'center' }}>
                        {result?.engineering_optimization?.suggested_targets?.[v.value] !== undefined && (
                          <Typography sx={{ color: col4, fontWeight: 600, fontSize: 14 }}>
                            {Number(result.engineering_optimization.suggested_targets[v.value]).toFixed(2)}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>

            {/* Optimization Variables */}
            <Box sx={{ flex: 1 }}>
              <Box sx={{ background: cardBg, borderRadius: 3, p: 2 }}>
                <Typography sx={{ color: textColor, fontWeight: 300, mb: 2, fontSize: 14, fontFamily: `'Montserrat', sans-serif` }}>
                  Optimization Variables
                </Typography>
                
                {/* Header Row */}
                <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                  <Box sx={{ flex: 5 }}></Box>
                  <Box sx={{ 
                    flex: 1, 
                    textAlign: 'center',
                    borderRadius: 1,
                    py: 0.5
                  }}>
                    <Typography sx={{ color: textColor3, fontSize: 12, fontWeight: 600 }}>
                      Actual Target
                    </Typography>
                  </Box>
                  <Box sx={{ 
                    flex: 1, 
                    textAlign: 'center',
                    borderRadius: 1,
                    py: 0.5
                  }}>
                    <Typography sx={{ color: textColor3, fontSize: 10, fontWeight: 600 }}>
                      Beyond Range Target
                    </Typography>
                  </Box>
                </Box>

                {/* Variable Rows */}
                {variables[section].optimization.map((v) => (
                  <Box key={v.value} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
                    <Typography sx={{ flex: 2, color: textColor3, fontSize: 14 }}>
                      {v.label}
                    </Typography>
                    <Box
                        sx={{
                          width: 160,
                          height: 40,
                          background: 'linear-gradient(135deg, rgba(42, 39, 82, 0.6) 0%, rgba(31, 28, 68, 0.8) 100%)',
                          borderRadius: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: textColor,
                          fontSize: 16,
                          fontWeight: 500,
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',

                        }}
                      >
                    <Box sx={{ flex: 1, textAlign: 'center' }}>
                      {result?.apc_optimization?.suggested_targets?.[v.value] !== undefined && (
                        <Typography sx={{ color: textColor, fontWeight: 600, fontSize: 14 }}>
                          {Number(result.apc_optimization.suggested_targets[v.value]).toFixed(2)}
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ flex: 1, textAlign: 'center' }}>
                      {result?.engineering_optimization?.suggested_targets?.[v.value] !== undefined && (
                        <Typography sx={{ color: col4, fontWeight: 600, fontSize: 14 }}>
                          {Number(result.engineering_optimization.suggested_targets[v.value]).toFixed(2)}
                        </Typography>
                      )}
                    </Box>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>

          {/* Benefits Section - Middle */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2, background: textColor3, borderRadius: 3 }}>
            {/* Benefits within APC Limits */}
            <Box sx={{ flex: 1 }}>
              <Box sx={{ 
                
                borderRadius: 3, 
                p: 1,
                minHeight: 50,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}>

                {result?.apc_optimization?.economic_value && (
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography sx={{ color: textColor, fontSize: 14, padding:1 }}>Benefits within APC Limits</Typography>
                      
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: 1,
                          borderRadius: 2,
                          background: cardBg
                        }}
                      >
                      <Typography sx={{ color: col4, fontWeight: 600, fontSize: 13 }}>
                        ${result.apc_optimization.economic_value.toFixed(2)}/hr
                      </Typography>
                      </Box>
                    </Box>
                  </Box>
                )}
                {!result?.apc_optimization && (
                  <Typography sx={{ color: textColor3, fontSize: 11, textAlign: 'center' }}>
                    Run optimization to see benefits
                  </Typography>
                )}
              </Box>
            </Box>

            {/* Benefits within Engineering Limits */}
            <Box sx={{ flex: 1,
              
             }}>
              <Box sx={{ 
                
                borderRadius: 3, 
                p: 1,
                minHeight: 50,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}>
                {result?.engineering_optimization?.economic_value && (
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography sx={{ color: textColor, fontSize: 14, padding: 1 }}>Benefits within Engg Limits</Typography>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: 1,
                          borderRadius: 2,
                          background: cardBg
                        }}
                      >
                      <Typography sx={{ color: col4, fontWeight: 600, fontSize: 13 }}>
                        ${result.engineering_optimization.economic_value.toFixed(2)}/hr
                      </Typography>
                      </Box>
                    </Box>
                  </Box>
                )}
                {!result?.engineering_optimization && (
                  <Typography sx={{ color: textColor3, fontSize: 11, textAlign: 'center' }}>
                    Run optimization to see benefits
                  </Typography>
                )}
              </Box>
            </Box>
          </Box>

          {/* Plots Section - Bottom */}
          <Box sx={{ display: 'flex', gap: 2, flex: 1, minHeight: 300 }}>
            {/* Optimization Variables Trend (APC only) */}
            <Box sx={{ flex: 1, minHeight: 300 }}>
              <Box sx={{ background: cardBg, borderRadius: 3, p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Typography sx={{ color: textColor3, fontWeight: 600, mb: 2, fontSize: 13 }}>
                  Optimization Variables Trend (APC)
                </Typography>
                
                {result?.optimization_history && result.optimization_history.length > 0 && (
                  <Box sx={{ flex: 1, minHeight: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={optimizationChartData}
                        margin={{ top: 5, right: 60, left: 0, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis 
                          dataKey="trial" 
                          stroke={textColor2}
                          style={{ fontSize: 10 }}
                          label={{ value: 'Trial', position: 'insideBottom', offset: -10, style: { fontSize: 10, fill: textColor2 } }}
                        />
                        <YAxis 
                          yAxisId="left"
                          stroke={textColor2}
                          style={{ fontSize: 10 }}
                          label={{ value: 'Flow Rates & %', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: textColor2 } }}
                        />
                        <YAxis 
                          yAxisId="right"
                          orientation="right"
                          stroke={textColor2}
                          style={{ fontSize: 10 }}
                          domain={[0, 10]}
                          label={{ value: 'Kiln Speed (rpm)', angle: 90, position: 'insideRight', style: { fontSize: 10, fill: textColor2 } }}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'rgba(30, 26, 46, 0.95)',
                            border: '1px solid rgba(33, 150, 243, 0.3)',
                            borderRadius: '4px',
                            fontSize: 11
                          }}
                          formatter={(value: any) => {
                            if (value === null) return ['N/A', ''];
                            return [Number(value).toFixed(2), ''];
                          }}
                        />
                        <Legend 
                          wrapperStyle={{ fontSize: 10 }} 
                          onClick={(e) => {
                            const dataKey = e.dataKey as string;
                            setHiddenOptimizationLines(prev => ({
                              ...prev,
                              [dataKey]: !prev[dataKey]
                            }));
                          }}
                          iconType="line"
                        />
                        <Line yAxisId="left" type="monotone" dataKey="trad_fuel" stroke={col1} strokeWidth={1.5} dot={false} name="Trad Fuel (kg/hr)" connectNulls hide={hiddenOptimizationLines['trad_fuel']} isAnimationActive={false} />
                        <Line yAxisId="left" type="monotone" dataKey="alt_fuel" stroke={col2} strokeWidth={1.5} dot={false} name="Alt Fuel (kg/hr)" connectNulls hide={hiddenOptimizationLines['alt_fuel']} isAnimationActive={false} />
                        <Line yAxisId="left" type="monotone" dataKey="raw_meal" stroke={col3} strokeWidth={1.5} dot={false} name="Raw Meal (tph)" connectNulls hide={hiddenOptimizationLines['raw_meal']} isAnimationActive={false} />
                        <Line yAxisId="right" type="monotone" dataKey="kiln_speed" stroke={col4} strokeWidth={1.5} dot={false} name="Kiln Speed (rpm)" connectNulls hide={hiddenOptimizationLines['kiln_speed']} isAnimationActive={false} />
                        <Line yAxisId="left" type="monotone" dataKey="fan_speed" stroke={accent} strokeWidth={1.5} dot={false} name="Fan Speed (%)" connectNulls hide={hiddenOptimizationLines['fan_speed']} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>
                )}
                
                {(!result || !result.optimization_history) && (
                  <Box sx={{ 
                    flex: 1,
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, rgba(33, 150, 243, 0.05) 0%, rgba(25, 118, 210, 0.08) 100%)',
                    borderRadius: 2
                  }}>
                    <Typography sx={{ color: textColor2, fontSize: 11 }}>
                      Run optimization to see variable trends
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>

            {/* Constraint Variables & Benefits (APC only) */}
            <Box sx={{ flex: 1, minHeight: 300 }}>
              <Box sx={{ background: cardBg, borderRadius: 3, p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Typography sx={{ color: textColor3, fontWeight: 600, mb: 2, fontSize: 13 }}>
                  Constraint Variables & Benefits (APC)
                </Typography>
                
                {result?.optimization_history && result.optimization_history.length > 0 && (
                  <Box sx={{ flex: 1, minHeight: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={constraintChartData}
                        margin={{ top: 5, right: 60, left: 0, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis 
                          dataKey="trial" 
                          stroke={textColor2}
                          style={{ fontSize: 10 }}
                          label={{ value: 'Trial', position: 'insideBottom', offset: -10, style: { fontSize: 10, fill: textColor2 } }}
                        />
                        <YAxis 
                          yAxisId="left"
                          stroke={textColor2}
                          style={{ fontSize: 10 }}
                          label={{ value: 'Constraints', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: textColor2 } }}
                        />
                        <YAxis 
                          yAxisId="right"
                          orientation="right"
                          stroke="#4caf50"
                          style={{ fontSize: 10 }}
                          label={{ value: 'Benefit ($/hr)', angle: 90, position: 'insideRight', style: { fontSize: 10, fill: '#4caf50' } }}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'rgba(30, 26, 46, 0.95)',
                            border: '1px solid rgba(156, 39, 176, 0.3)',
                            borderRadius: '4px',
                            fontSize: 11
                          }}
                          formatter={(value: any, name: string) => {
                            if (value === null) return ['N/A', name];
                            return [Number(value).toFixed(2), name];
                          }}
                        />
                        <Legend 
                          wrapperStyle={{ fontSize: 10 }} 
                          onClick={(e) => {
                            const dataKey = e.dataKey as string;
                            setHiddenConstraintLines(prev => ({
                              ...prev,
                              [dataKey]: !prev[dataKey]
                            }));
                          }}
                          iconType="line"
                        />
                        <Line yAxisId="left" type="monotone" dataKey="torque" stroke={col1} strokeWidth={1.5} dot={false} name="Torque (%)" connectNulls hide={hiddenConstraintLines['torque']} isAnimationActive={false} />
                        <Line yAxisId="left" type="monotone" dataKey="temp" stroke={col2} strokeWidth={1.5} dot={false} name="Temp (°C)" connectNulls hide={hiddenConstraintLines['temp']} isAnimationActive={false} />
                        <Line yAxisId="left" type="monotone" dataKey="o2" stroke={col3} strokeWidth={1.5} dot={false} name="O₂ (%)" connectNulls hide={hiddenConstraintLines['o2']} isAnimationActive={false} />
                        <Line yAxisId="left" type="monotone" dataKey="fan_power" stroke={col4} strokeWidth={1.5} dot={false} name="Fan Power (kW)" connectNulls hide={hiddenConstraintLines['fan_power']} isAnimationActive={false} />
                        <Line yAxisId="right" type="monotone" dataKey="benefit" stroke="#4caf50" strokeWidth={2} dot={false} name="Benefit ($/hr)" connectNulls hide={hiddenConstraintLines['benefit']} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>
                )}
                
                {(!result || !result.optimization_history) && (
                  <Box sx={{ 
                    flex: 1,
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, rgba(156, 39, 176, 0.05) 0%, rgba(123, 31, 162, 0.08) 100%)',
                    borderRadius: 2
                  }}>
                    <Typography sx={{ color: textColor3, fontSize: 11 }}>
                      Run optimization to see constraint trends
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          </Box>

          {/* Error Display */}
          {!result?.apc_optimization && !result?.engineering_optimization && !loading && result && (
            <Paper sx={{ background: 'rgba(244, 67, 54, 0.1)', border: '1px solid rgba(244, 67, 54, 0.3)', borderRadius: 3, p: 2 }}>
              <Typography sx={{ color: '#f44336', fontSize: 13 }}>
                Optimization failed. Please check if the backend server is running.
              </Typography>
            </Paper>
          )}
        </Box>
      </Box>

      {/* Settings Modal */}
      <Modal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Box sx={{
          width: 600,
          maxHeight: '80vh',
          overflowY: 'auto',
          background: cardBg,
          borderRadius: 3,
          p: 4,
          boxShadow: shadowDrop
        }}>
          <Typography sx={{ color: textColor, fontSize: 20, fontWeight: 600, mb: 3 }}>
            Optimizer Settings
          </Typography>

          {/* Pricing Section */}
          <Typography sx={{ color: textColor3, fontSize: 16, fontWeight: 600, mb: 2 }}>
            Pricing Configuration
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 4 }}>
            <TextField
              label="Limestone Price ($/ton)"
              type="number"
              value={pricing.limestone_price_per_ton}
              onChange={(e) => setPricing({ ...pricing, limestone_price_per_ton: parseFloat(e.target.value) })}
              fullWidth
              InputLabelProps={{ style: { color: textColor3 } }}
              InputProps={{ style: { color: textColor } }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: 'rgba(106, 130, 251, 0.3)' },
                  '&:hover fieldset': { borderColor: 'rgba(106, 130, 251, 0.5)' },
                  '&.Mui-focused fieldset': { borderColor: accent },
                }
              }}
            />
            
            <TextField
              label="Clay Price ($/ton)"
              type="number"
              value={pricing.clay_price_per_ton}
              onChange={(e) => setPricing({ ...pricing, clay_price_per_ton: parseFloat(e.target.value) })}
              fullWidth
              InputLabelProps={{ style: { color: textColor3 } }}
              InputProps={{ style: { color: textColor } }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: 'rgba(106, 130, 251, 0.3)' },
                  '&:hover fieldset': { borderColor: 'rgba(106, 130, 251, 0.5)' },
                  '&.Mui-focused fieldset': { borderColor: accent },
                }
              }}
            />

            <TextField
              label="Traditional Fuel Price ($/kg)"
              type="number"
              value={pricing.traditional_fuel_price_per_kg}
              onChange={(e) => setPricing({ ...pricing, traditional_fuel_price_per_kg: parseFloat(e.target.value) })}
              fullWidth
              InputLabelProps={{ style: { color: textColor3 } }}
              InputProps={{ style: { color: textColor }, inputProps: { step: 0.01 } }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: 'rgba(106, 130, 251, 0.3)' },
                  '&:hover fieldset': { borderColor: 'rgba(106, 130, 251, 0.5)' },
                  '&.Mui-focused fieldset': { borderColor: accent },
                }
              }}
            />

            <TextField
              label="Alternative Fuel Price ($/kg)"
              type="number"
              value={pricing.alternative_fuel_price_per_kg}
              onChange={(e) => setPricing({ ...pricing, alternative_fuel_price_per_kg: parseFloat(e.target.value) })}
              fullWidth
              InputLabelProps={{ style: { color: textColor3 } }}
              InputProps={{ style: { color: textColor }, inputProps: { step: 0.01 } }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: 'rgba(106, 130, 251, 0.3)' },
                  '&:hover fieldset': { borderColor: 'rgba(106, 130, 251, 0.5)' },
                  '&.Mui-focused fieldset': { borderColor: accent },
                }
              }}
            />

            <TextField
              label="Clinker Selling Price ($/ton)"
              type="number"
              value={pricing.clinker_selling_price_per_ton}
              onChange={(e) => setPricing({ ...pricing, clinker_selling_price_per_ton: parseFloat(e.target.value) })}
              fullWidth
              InputLabelProps={{ style: { color: textColor3 } }}
              InputProps={{ style: { color: textColor } }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: 'rgba(106, 130, 251, 0.3)' },
                  '&:hover fieldset': { borderColor: 'rgba(106, 130, 251, 0.5)' },
                  '&.Mui-focused fieldset': { borderColor: accent },
                }
              }}
            />

            <TextField
              label="Electricity Price ($/kWh)"
              type="number"
              value={pricing.electricity_price_per_kwh}
              onChange={(e) => setPricing({ ...pricing, electricity_price_per_kwh: parseFloat(e.target.value) })}
              fullWidth
              InputLabelProps={{ style: { color: textColor3 } }}
              InputProps={{ style: { color: textColor }, inputProps: { step: 0.01 } }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: 'rgba(106, 130, 251, 0.3)' },
                  '&:hover fieldset': { borderColor: 'rgba(106, 130, 251, 0.5)' },
                  '&.Mui-focused fieldset': { borderColor: accent },
                }
              }}
            />

            <TextField
              label="Byproduct Credit ($/ton)"
              type="number"
              value={pricing.byproduct_credit_per_ton}
              onChange={(e) => setPricing({ ...pricing, byproduct_credit_per_ton: parseFloat(e.target.value) })}
              fullWidth
              InputLabelProps={{ style: { color: textColor3 } }}
              InputProps={{ style: { color: textColor } }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: 'rgba(106, 130, 251, 0.3)' },
                  '&:hover fieldset': { borderColor: 'rgba(106, 130, 251, 0.5)' },
                  '&.Mui-focused fieldset': { borderColor: accent },
                }
              }}
            />
          </Box>

          {/* ML/FP Ratio Section */}
          <Typography sx={{ color: textColor3, fontSize: 16, fontWeight: 600, mb: 2 }}>
            Model Weight Configuration
          </Typography>

          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography sx={{ color: textColor2, fontSize: 13 }}>
                ML Weight: {(mlFpRatio * 100).toFixed(0)}%
              </Typography>
              <Typography sx={{ color: textColor2, fontSize: 13 }}>
                First Principles Weight: {((1 - mlFpRatio) * 100).toFixed(0)}%
              </Typography>
            </Box>
            <Slider
              value={mlFpRatio}
              onChange={(_, value) => setMlFpRatio(value as number)}
              min={0}
              max={1}
              step={0.05}
              marks={[
                { value: 0, label: 'FP' },
                { value: 0.5, label: '50/50' },
                { value: 1, label: 'ML' }
              ]}
              sx={{
                color: accent,
                '& .MuiSlider-markLabel': { color: textColor3, fontSize: 10 },
                '& .MuiSlider-mark': { backgroundColor: textColor3 },
              }}
            />
            <Typography sx={{ color: textColor3, fontSize: 11, mt: 1, fontStyle: 'italic' }}>
              Adjust the ratio between Machine Learning model and First Principles model predictions
            </Typography>
          </Box>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button
              onClick={() => setSettingsOpen(false)}
              sx={{
                color: textColor3,
                borderColor: 'rgba(106, 130, 251, 0.3)',
                '&:hover': {
                  borderColor: 'rgba(106, 130, 251, 0.5)',
                  background: 'rgba(106, 130, 251, 0.1)',
                }
              }}
              variant="outlined"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveSettings}
              sx={{
                background: `linear-gradient(135deg, ${accent} 0%, rgba(106, 130, 251, 0.8) 100%)`,
                color: '#fff',
                '&:hover': {
                  background: `linear-gradient(135deg, rgba(106, 130, 251, 0.9) 0%, ${accent} 100%)`,
                }
              }}
              variant="contained"
            >
              Save Settings
            </Button>
          </Box>
        </Box>
      </Modal>
    </Box>
  );
}