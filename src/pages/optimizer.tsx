/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef } from 'react';
import { useRequireAuth } from '../hooks/useAuth';
import { FormControl, Select, MenuItem, SelectChangeEvent } from '@mui/material';
import Sidebar from '../components/Sidebar';
import { Box, Typography, Paper, Button, CircularProgress } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
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

        // Load latest optimization results from Firebase
        const q = query(
          collection(db, 'optimized_targets'),
          orderBy('timestamp', 'desc'),
          limit(1)
        );
        
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const latestDoc = querySnapshot.docs[0].data();
          
          // Reconstruct the dual optimization response from Firebase data
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
            pricing_details: latestDoc.pricing_details || {}
          };
          
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
            pricing_details: latestDoc.pricing_details || {}
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
              {running && (
                <Typography sx={{ color: accent, fontWeight: 600, fontSize: 13 }}>
                  Time left: {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}
                </Typography>
              )}
              {result?.apc_optimization?.model_type && (
                <Typography sx={{ color: textColor2, fontSize: 12 }}>
                  Model: {result.apc_optimization.model_type === 'hybrid_fp_ml' ? 'Hybrid (FP + ML)' : result.apc_optimization.model_type}
                </Typography>
              )}
            </Box>

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
                <PlayArrowIcon sx={{ color: textColor3 }} />
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
                <StopIcon sx={{ color: textColor3 }} />
              </Box>
            </Box>
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
                  <Box sx={{ flex: 2 }}></Box>
                  <Box sx={{ 
                    flex: 1, 
                    textAlign: 'center',
                    background: 'linear-gradient(135deg, rgba(33, 150, 243, 0.1) 0%, rgba(25, 118, 210, 0.15) 100%)',
                    borderRadius: 1,
                    py: 0.5
                  }}>
                    <Typography sx={{ color: col1, fontSize: 10, fontWeight: 600 }}>
                      Actual Target
                    </Typography>
                  </Box>
                  <Box sx={{ 
                    flex: 1, 
                    textAlign: 'center',
                    background: 'linear-gradient(135deg, rgba(156, 39, 176, 0.1) 0%, rgba(123, 31, 162, 0.15) 100%)',
                    borderRadius: 1,
                    py: 0.5
                  }}>
                    <Typography sx={{ color: col2, fontSize: 10, fontWeight: 600 }}>
                      Beyond Range Target
                    </Typography>
                  </Box>
                </Box>

                {/* Variable Rows */}
                {variables[section].constraints.map((v) => (
                  <Box key={v.value} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
                    <Typography sx={{ flex: 2, color: textColor3, fontSize: 11 }}>
                      {v.label}
                    </Typography>
                    <Box sx={{ flex: 1, textAlign: 'center' }}>
                      {result?.apc_optimization?.suggested_targets?.[v.value] !== undefined && (
                        <Typography sx={{ color: col1, fontWeight: 600, fontSize: 12 }}>
                          {Number(result.apc_optimization.suggested_targets[v.value]).toFixed(2)}
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ flex: 1, textAlign: 'center' }}>
                      {result?.engineering_optimization?.suggested_targets?.[v.value] !== undefined && (
                        <Typography sx={{ color: col2, fontWeight: 600, fontSize: 12 }}>
                          {Number(result.engineering_optimization.suggested_targets[v.value]).toFixed(2)}
                        </Typography>
                      )}
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
                  <Box sx={{ flex: 2 }}></Box>
                  <Box sx={{ 
                    flex: 1, 
                    textAlign: 'center',
                    background: 'linear-gradient(135deg, rgba(33, 150, 243, 0.1) 0%, rgba(25, 118, 210, 0.15) 100%)',
                    borderRadius: 1,
                    py: 0.5
                  }}>
                    <Typography sx={{ color: col1, fontSize: 10, fontWeight: 600, fontFamily: `'Montserrat', sans-serif` }}>
                      Actual Target
                    </Typography>
                  </Box>
                  <Box sx={{ 
                    flex: 1, 
                    textAlign: 'center',
                    background: 'linear-gradient(135deg, rgba(156, 39, 176, 0.1) 0%, rgba(123, 31, 162, 0.15) 100%)',
                    borderRadius: 1,
                    py: 0.5
                  }}>
                    <Typography sx={{ color: col2, fontSize: 10, fontWeight: 600, fontFamily: `'Montserrat', sans-serif` }}>
                      Beyond Range Target
                    </Typography>
                  </Box>
                </Box>

                {/* Variable Rows */}
                {variables[section].optimization.map((v) => (
                  <Box key={v.value} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
                    <Typography sx={{ flex: 2, color: textColor3, fontSize: 11 }}>
                      {v.label}
                    </Typography>
                    <Box sx={{ flex: 1, textAlign: 'center' }}>
                      {result?.apc_optimization?.suggested_targets?.[v.value] !== undefined && (
                        <Typography sx={{ color: col1, fontWeight: 600, fontSize: 12 }}>
                          {Number(result.apc_optimization.suggested_targets[v.value]).toFixed(2)}
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ flex: 1, textAlign: 'center' }}>
                      {result?.engineering_optimization?.suggested_targets?.[v.value] !== undefined && (
                        <Typography sx={{ color: col2, fontWeight: 600, fontSize: 12 }}>
                          {Number(result.engineering_optimization.suggested_targets[v.value]).toFixed(2)}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>

          {/* Benefits Section - Middle */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            {/* Benefits within APC Limits */}
            <Box sx={{ flex: 1 }}>
              <Box sx={{ 
                background: cardBg, 
                borderRadius: 3, 
                p: 2,
                minHeight: 100,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}>
                <Typography sx={{ color: textColor3, fontWeight: 600, mb: 1, fontSize: 13 }}>
                  Benefits within APC Limits
                </Typography>
                {result?.apc_optimization?.economic_value && (
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography sx={{ color: textColor3, fontSize: 11 }}>Economic Value:</Typography>
                      <Typography sx={{ color: col1, fontWeight: 600, fontSize: 13 }}>
                        ${result.apc_optimization.economic_value.toFixed(2)}/hr
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography sx={{ color: textColor3, fontSize: 11 }}>Optimization Score:</Typography>
                      <Typography sx={{ color: col1, fontWeight: 600, fontSize: 13 }}>
                        {result.apc_optimization.optimization_score?.toFixed(2)}
                      </Typography>
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
            <Box sx={{ flex: 1 }}>
              <Box sx={{ 
                background: cardBg, 
                borderRadius: 3, 
                p: 2,
                minHeight: 100,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}>
                <Typography sx={{ color: textColor3, fontWeight: 600, mb: 1, fontSize: 13 }}>
                  Benefits within Engg Limits
                </Typography>
                {result?.engineering_optimization?.economic_value && (
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography sx={{ color: textColor3, fontSize: 11 }}>Economic Value:</Typography>
                      <Typography sx={{ color: col2, fontWeight: 600, fontSize: 13 }}>
                        ${result.engineering_optimization.economic_value.toFixed(2)}/hr
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography sx={{ color: textColor3, fontSize: 11 }}>Optimization Score:</Typography>
                      <Typography sx={{ color: col2, fontWeight: 600, fontSize: 13 }}>
                        {result.engineering_optimization.optimization_score?.toFixed(2)}
                      </Typography>
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
          <Box sx={{ display: 'flex', gap: 2, flex: 1, minHeight: 0 }}>
            {/* Benefits within APC Limits */}
            <Box sx={{ flex: 1 }}>
              <Box sx={{ background: cardBg, borderRadius: 3, p: 2, height: '100%' }}>
                <Typography sx={{ color: textColor3, fontWeight: 600, mb: 2, fontSize: 13 }}>
                  Benefits within APC Limits
                </Typography>
                
                {result?.optimization_history && result.optimization_history.length > 0 && (
                  <ResponsiveContainer width="100%" height="85%">
                    <LineChart
                      data={result.optimization_history.slice(0, Math.floor(result.optimization_history.length / 2)).map((trial, idx) => ({
                        trial: idx + 1,
                        value: trial.objective_score,
                      }))}
                      margin={{ top: 5, right: 10, left: 0, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis 
                        dataKey="trial" 
                        stroke={textColor2}
                        style={{ fontSize: 10 }}
                      />
                      <YAxis 
                        stroke={textColor2}
                        style={{ fontSize: 10 }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'rgba(30, 26, 46, 0.95)',
                          border: '1px solid rgba(33, 150, 243, 0.3)',
                          borderRadius: '4px',
                          fontSize: 11
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke={col1} 
                        strokeWidth={2}
                        dot={false}
                        name="APC Optimization"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
                
                {(!result || !result.optimization_history) && (
                  <Box sx={{ 
                    height: '85%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, rgba(33, 150, 243, 0.05) 0%, rgba(25, 118, 210, 0.08) 100%)',
                    borderRadius: 2
                  }}>
                    <Typography sx={{ color: textColor2, fontSize: 11 }}>
                      Run optimization to see convergence plot
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>

            {/* Benefits within Engineering Limits */}
            <Box sx={{ flex: 1 }}>
              <Box sx={{ background: cardBg, borderRadius: 3, p: 2, height: '100%' }}>
                <Typography sx={{ color: textColor3, fontWeight: 600, mb: 2, fontSize: 13 }}>
                  Benefits within Engg Limits
                </Typography>
                
                {result?.optimization_history && result.optimization_history.length > 0 && (
                  <ResponsiveContainer width="100%" height="85%">
                    <LineChart
                      data={result.optimization_history.slice(Math.floor(result.optimization_history.length / 2)).map((trial, idx) => ({
                        trial: idx + 1,
                        value: trial.objective_score,
                      }))}
                      margin={{ top: 5, right: 10, left: 0, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis 
                        dataKey="trial" 
                        stroke={textColor2}
                        style={{ fontSize: 10 }}
                      />
                      <YAxis 
                        stroke={textColor2}
                        style={{ fontSize: 10 }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'rgba(30, 26, 46, 0.95)',
                          border: '1px solid rgba(156, 39, 176, 0.3)',
                          borderRadius: '4px',
                          fontSize: 11
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke={col2} 
                        strokeWidth={2}
                        dot={false}
                        name="Engineering Optimization"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
                
                {(!result || !result.optimization_history) && (
                  <Box sx={{ 
                    height: '85%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, rgba(156, 39, 176, 0.05) 0%, rgba(123, 31, 162, 0.08) 100%)',
                    borderRadius: 2
                  }}>
                    <Typography sx={{ color: textColor3, fontSize: 11 }}>
                      Run optimization to see convergence plot
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
    </Box>
  );
}