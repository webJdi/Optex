/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { useRequireAuth } from '../hooks/useAuth';
import { PlantReading } from '../services/plantApi';
import { Box, Typography, Paper, Dialog, DialogActions, DialogContent, DialogTitle, Button, TextField } from '@mui/material';
import Sidebar from '../components/Sidebar';
import PageHeader from '../components/PageHeader';
import { accent, cardBg, textColor, textColor2, textColor3, gradientBg, glowBg1, glowBg2, glowBg3, glowBg4, shadowDrop, col1, col2, col3, col4, glowCol1, glowCol2 } from '../components/ColorPalette';
import { updateApcLimits } from '../services/firebase';
import { collection, getDocs, query, orderBy, limit, doc, setDoc, deleteDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';



interface Variable {
  name: string;
  pv: number;
  ll: number;
  hl: number;
  mappingKey?: string;
}

// Helper function to get nested property values from plant reading
function getNestedValue(obj: PlantReading | Record<string, unknown>, path: string): number {
  try {
    const result = path.split('.').reduce((current: unknown, key: string) => {
      return current && typeof current === 'object' ? (current as Record<string, unknown>)[key] : undefined;
    }, obj as unknown);
    return typeof result === 'number' ? result : 0;
  } catch {
    return 0;
  }
}

// Helper function to calculate limestone to clay ratio from plant reading
function calculateLimestoneToClayRatio(reading: PlantReading): number {
  try {
    const limestonePct = getNestedValue(reading, 'raw_mill.limestone_feeder_pct');
    const clayPct = getNestedValue(reading, 'raw_mill.clay_feeder_pct');
    
    if (clayPct > 0) {
      return limestonePct / clayPct;
    }
    return 0;
  } catch {
    return 0;
  }
}

// Fetch LSF prediction from soft sensor
const fetchLSFPrediction = async (reading: PlantReading): Promise<number> => {
  try {
    // Call the backend soft sensor prediction endpoint
    const response = await fetch('http://localhost:8000/predict_from_current_state');
    if (response.ok) {
      const data = await response.json();
      console.log('LSF Soft Sensor Prediction:', data.lsf_predicted);
      return data.lsf_predicted;
    } else {
      // Fallback to simulated LSF from plant reading
      console.log('LSF Soft Sensor unavailable, using simulated value');
      return reading.kpi.lsf;
    }
  } catch (error) {
    console.error('Error fetching LSF prediction:', error);
    // Fallback to simulated LSF
    return reading.kpi.lsf;
  }
};

const fetchLimitsFromFirebase = async () => {
  const querySnapshot = await getDocs(collection(db, 'apclimits'));
  const mvLimits: Variable[] = [];
  const cvLimits: Variable[] = [];
  
  querySnapshot.forEach((doc: any) => {
    const data = doc.data();
    console.log('Document ID:', doc.id, 'Data:', data); // Debug log
    const variable = {
      name: doc.id,
      pv: 0, // Will be updated from plant reading
      ll: parseFloat(data.ll),
      hl: parseFloat(data.hl),
      mappingKey: data.mappingKey || '', // Store the mapping key from Firebase
    };
    
    if (data.type === 'mv') {
      mvLimits.push(variable);
    } else if (data.type === 'cv') {
      cvLimits.push(variable);
    }
  });
  
  console.log('MV Limits:', mvLimits); // Debug log
  console.log('CV Limits:', cvLimits); // Debug log
  
  return { mvLimits, cvLimits };
};

// Fetch latest plant reading from Firestore
const fetchLatestPlantReading = async (): Promise<PlantReading | null> => {
  try {
    const q = query(
      collection(db, 'plant_readings'),
      orderBy('timestamp', 'desc'),
      limit(1)
    );
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.log('No plant readings found in Firestore'); // Debug log
      return null;
    }
    
    const docData = querySnapshot.docs[0].data();
    console.log('Latest plant reading:', docData); // Debug log
    console.log('Kiln data:', docData.kiln); // Debug log
    console.log('Raw mill data:', docData.raw_mill); // Debug log
    
    return {
      timestamp: docData.timestamp.toDate().getTime(),
      kpi: docData.kpi,
      raw_mill: docData.raw_mill,
      kiln: docData.kiln,
      production: docData.production,
    };
  } catch (e) {
    console.error('Error fetching latest plant reading', e);
    return null;
  }
};

export default function SoftSensors() {
  const { user, loading } = useRequireAuth();

  const [open, setOpen] = useState(false);
  const [selectedVar, setSelectedVar] = useState<Variable | null>(null);
  const [updatedValues, setUpdatedValues] = useState({ pv: '', ll: '', hl: '' });
  const [manipulatedVars, setManipulatedVars] = useState<Variable[]>([]);
  const [controlledVars, setControlledVars] = useState<Variable[]>([]);
  const [reading, setReading] = useState<PlantReading | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  // Track violations from Firebase (variable name -> violation data)
  const [violations, setViolations] = useState<Map<string, {startTime: number, lastNotified: number}>>(new Map());
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  // Body margin effect
  useEffect(() => {
    document.body.style.margin = '0';
    return () => { document.body.style.margin = ''; };
  }, []);

  // Request notification permission on component mount
  useEffect(() => {
    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          setNotificationPermission(permission);
        });
      } else {
        setNotificationPermission(Notification.permission);
      }
    }
  }, []);

  // Listen to Firebase for active violations
  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(collection(db, 'apc_violations'), (snapshot: any) => {
      const violationsMap = new Map<string, {startTime: number, lastNotified: number}>();
      
      snapshot.forEach((doc: any) => {
        const data = doc.data();
        violationsMap.set(doc.id, {
          startTime: data.startTime?.toMillis() || Date.now(),
          lastNotified: data.lastNotified?.toMillis() || 0,
        });
      });
      
      setViolations(violationsMap);
    });

    return () => unsubscribe();
  }, [user]);

  // Store violation in Firebase
  const storeViolation = async (variableName: string, variable: Variable) => {
    try {
      const violationRef = doc(db, 'apc_violations', variableName);
      await setDoc(violationRef, {
        variableName,
        pv: variable.pv,
        ll: variable.ll,
        hl: variable.hl,
        violationType: variable.pv <= variable.ll ? 'LOW' : 'HIGH',
        startTime: Timestamp.now(),
        lastNotified: Timestamp.fromMillis(0),
      });
    } catch (e) {
      console.error('Error storing violation:', e);
    }
  };

  // Clear violation from Firebase
  const clearViolation = async (variableName: string) => {
    try {
      const violationRef = doc(db, 'apc_violations', variableName);
      await deleteDoc(violationRef);
    } catch (e) {
      console.error('Error clearing violation:', e);
    }
  };

  // Update last notified time in Firebase
  const updateLastNotified = async (variableName: string) => {
    try {
      const violationRef = doc(db, 'apc_violations', variableName);
      await setDoc(violationRef, {
        lastNotified: Timestamp.now(),
      }, { merge: true });
    } catch (e) {
      console.error('Error updating notification time:', e);
    }
  };

  // Check for violations and send notifications
  useEffect(() => {
    if (!manipulatedVars.length && !controlledVars.length) return;
    if (notificationPermission !== 'granted') return;

    const checkAndNotify = async () => {
      const allVariables = [...manipulatedVars, ...controlledVars];
      const currentTime = Date.now();
      const VIOLATION_THRESHOLD = 5 * 60 * 1000; // 5 minutes in milliseconds
      const NOTIFICATION_INTERVAL = 5 * 60 * 1000; // Send notification every 5 minutes

      for (const variable of allVariables) {
        const violating = variable.pv <= variable.ll || variable.pv >= variable.hl;
        const existingViolation = violations.get(variable.name);

        if (violating) {
          if (!existingViolation) {
            // New violation detected - store in Firebase
            await storeViolation(variable.name, variable);
          } else {
            // Existing violation - check if we should send notification
            const violationDuration = currentTime - existingViolation.startTime;
            const timeSinceLastNotification = currentTime - existingViolation.lastNotified;

            if (violationDuration >= VIOLATION_THRESHOLD) {
              // Violation has lasted >5 minutes
              if (existingViolation.lastNotified === 0 || timeSinceLastNotification >= NOTIFICATION_INTERVAL) {
                // Send notification (first time or after 5 minutes)
                sendLimitViolationNotification(variable);
                await updateLastNotified(variable.name);
              }
            }
          }
        } else if (existingViolation) {
          // Violation resolved - clear from Firebase
          await clearViolation(variable.name);
        }
      }
    };

    checkAndNotify();
  }, [manipulatedVars, controlledVars, violations, notificationPermission]);

  // Function to send desktop notification
  const sendLimitViolationNotification = (variable: Variable) => {
    if (notificationPermission !== 'granted') return;

    const violationType = variable.pv <= variable.ll ? 'LOW' : 'HIGH';
    const limitValue = variable.pv <= variable.ll ? variable.ll : variable.hl;
    
    const notification = new Notification('⚠️ APC Limit Violation', {
      body: `${variable.name}: ${variable.pv.toFixed(2)} has been ${violationType} (limit: ${limitValue}) for over 5 minutes!`,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: variable.name, // Prevent duplicate notifications
      requireInteraction: true, // Keep notification until user interacts
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    // Auto-close after 30 seconds
    setTimeout(() => {
      notification.close();
    }, 30000);
  };

  // Helper function to check if variable is violating limits
  const isViolating = (variable: Variable): boolean => {
    return variable.pv <= variable.ll || variable.pv >= variable.hl;
  };

  // Helper function to get violation duration
  const getViolationDuration = (variableName: string): number => {
    const violation = violations.get(variableName);
    if (!violation) return 0;
    return Math.floor((Date.now() - violation.startTime) / 1000); // in seconds
  };

  // Fetch plant reading and limits from Firestore
  useEffect(() => {
    if (!user || loading) return;
    
    const fetchAllData = async () => {
      try {
        // Fetch both limits and latest reading
        const [limitsData, readingData] = await Promise.all([
          fetchLimitsFromFirebase(),
          fetchLatestPlantReading()
        ]);
        
        if (readingData) {
          setReading(readingData);
          
          // Fetch LSF prediction from soft sensor
          const lsfPrediction = await fetchLSFPrediction(readingData);
          
          // Update PV values immediately
          const updatedMvLimits = limitsData.mvLimits.map(variable => {
            // Special handling for Limestone to Clay Ratio - calculate from raw mill data
            if (variable.name === 'Limestone to Clay Ratio') {
              return {
                ...variable,
                pv: calculateLimestoneToClayRatio(readingData)
              };
            }
            // For other variables, use the mapping key
            return {
              ...variable,
              pv: variable.mappingKey ? getNestedValue(readingData, variable.mappingKey) : 0
            };
          });
          
          const updatedCvLimits = limitsData.cvLimits.map(variable => {
            // Special handling for LSF - use soft sensor prediction
            if (variable.name === 'LSF') {
              console.log('Using LSF Soft Sensor Prediction for PV:', lsfPrediction);
              return {
                ...variable,
                pv: lsfPrediction
              };
            }
            // For other CVs, use the mapping key
            return {
              ...variable,
              pv: variable.mappingKey ? getNestedValue(readingData, variable.mappingKey) : 0
            };
          });
          
          setManipulatedVars(updatedMvLimits);
          setControlledVars(updatedCvLimits);
          setLastUpdate(new Date());
        } else {
          // No reading available, set limits with PV = 0
          setManipulatedVars(limitsData.mvLimits);
          setControlledVars(limitsData.cvLimits);
        }
        
        setError(null);
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Error fetching data';
        setError(errorMessage);
      }
    };
    
    // Initial fetch
    fetchAllData();
    
    // Poll every 90 seconds (1.5 minutes) for real-time updates
    const interval = setInterval(fetchAllData, 90000);
    return () => clearInterval(interval);
  }, [user, loading]);

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
            borderTop: '4pxent #6a82fb',
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

  const handleOpenModal = (variable: Variable) => {
    setSelectedVar(variable);
    setUpdatedValues({ pv: variable.pv.toString(), ll: variable.ll.toString(), hl: variable.hl.toString() });
    setOpen(true);
  };

  const handleCloseModal = () => {
    setOpen(false);
    setSelectedVar(null);
  };

  const handleSave = async () => {
    if (selectedVar) {
      await updateApcLimits(selectedVar.name, {
        ll: updatedValues.ll,
        hl: updatedValues.hl,
      });
      
      // Update local state to reflect changes
      setManipulatedVars(prev => prev.map(v => 
        v.name === selectedVar.name 
          ? { ...v, ll: parseFloat(updatedValues.ll), hl: parseFloat(updatedValues.hl) }
          : v
      ));
      setControlledVars(prev => prev.map(v => 
        v.name === selectedVar.name 
          ? { ...v, ll: parseFloat(updatedValues.ll), hl: parseFloat(updatedValues.hl) }
          : v
      ));
      
      handleCloseModal();
    }
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
          gap: 1,
          overflow: 'auto'
        }}>
          {/* Header */}
          <PageHeader pageName="APC Limits" />
          
          <Box>
            {lastUpdate && (
              <Typography sx={{ color: textColor2, fontSize: 12, opacity: 0.7 }}>
                Last Updated: {lastUpdate.toLocaleTimeString()} (Auto-refresh every 90s)
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, gap: 4 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ color: textColor, fontWeight: 100, mb: 3, fontFamily: `'Montserrat', sans-serif` }}>
                Manipulated Variables
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
                <Typography sx={{ color: textColor, width: 250, fontSize: 14, opacity: 0.7 }}> </Typography>
                <Typography sx={{ color: textColor, width: 80, fontSize: 14, opacity: 0.7, textAlign: 'center' }}>PV</Typography>
                <Typography sx={{ color: textColor, width: 80, fontSize: 14, opacity: 0.7, textAlign: 'center' }}>LL</Typography>
                <Typography sx={{ color: textColor, width: 80, fontSize: 14, opacity: 0.7, textAlign: 'center' }}>HL</Typography>
              </Box>
              {manipulatedVars.map((row: Variable, idx: number) => {
                const violating = isViolating(row);
                const duration = getViolationDuration(row.name);
                
                return (
                <Box key={idx} sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mb: 2 }}>
                  <Typography sx={{ color: textColor3, width: 250, fontSize: 14 }}>
                    {row.name}
                    {violating && duration > 0 && (
                      <Typography component="span" sx={{ color: '#ff6b6b', fontSize: 11, ml: 1 }}>
                        ({Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')})
                      </Typography>
                    )}
                  </Typography>
                  <Box
                    sx={{
                      width: 80,
                      height: 50,
                      background: violating 
                        ? (duration >= 300 ? 'linear-gradient(135deg, #ff4757 0%, #c23616 100%)' : 'linear-gradient(135deg, #ffa502 0%, #ff6348 100%)')
                        : 'transparent',
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: violating ? '#fff' : textColor,
                      fontSize: 16,
                      fontWeight: 500,
                      animation: duration >= 300 ? 'pulse 2s infinite' : 'none',
                    }}
                  >
                    {row.name === 'Limestone to Clay Ratio' ? row.pv.toFixed(2) : row.pv.toFixed(0)}
                  </Box>
                  <Box
                  sx={{
                    width: 160,
                    height: 50,
                    background: 'linear-gradient(135deg, rgba(42, 39, 82, 0.6) 0%, rgba(31, 28, 68, 0.8) 100%)',
                    //border: '1px solid rgba(106, 130, 251, 0.3)',
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
                    <Box
                      sx={{
                          width: 80,
                          height: 50,
                          background: 'linear-gradient(135deg, rgba(42, 39, 82, 0.6) 0%, rgba(31, 28, 68, 0.8) 100%)',
                          borderRight: '1px solid rgba(106, 130, 251, 0.3)',
                          borderRadius: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: textColor,
                          fontSize: 16,
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          
                          '&:hover': {
                            background: 'linear-gradient(135deg, rgba(52, 49, 92, 0.8) 0%, rgba(41, 38, 78, 1) 100%)',
                            borderColor: 'rgba(106, 130, 251, 0.6)',
                            transform: 'translateY(-2px)',
                            boxShadow: '0 4px 12px rgba(106, 130, 251, 0.3)',
                          },
                        }}
                      onClick={() => handleOpenModal(row)}
                    >
                      {row.ll}
                    </Box>
                    <Box
                      sx={{
                          width: 80,
                          height: 50,
                          background: 'linear-gradient(135deg, rgba(42, 39, 82, 0.6) 0%, rgba(31, 28, 68, 0.8) 100%)',
                          
                          borderRadius: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: textColor,
                          fontSize: 16,
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          
                          '&:hover': {
                            background: 'linear-gradient(135deg, rgba(52, 49, 92, 0.8) 0%, rgba(41, 38, 78, 1) 100%)',
                            borderColor: 'rgba(106, 130, 251, 0.6)',
                            transform: 'translateY(-2px)',
                            boxShadow: '0 4px 12px rgba(106, 130, 251, 0.3)',
                          },
                        }}
                      onClick={() => handleOpenModal(row)}
                    >
                      {row.hl}
                    </Box>
                  </Box>
                </Box>
                );
              })}
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ color: textColor, fontWeight: 100, mb: 3, fontFamily: `'Montserrat', sans-serif` }}>
                Controlled Variables
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
                <Typography sx={{ color: textColor, width: 250, fontSize: 14, opacity: 0.7 }}> </Typography>
                <Typography sx={{ color: textColor, width: 80, fontSize: 14, opacity: 0.7, textAlign: 'center' }}>PV</Typography>
                <Typography sx={{ color: textColor, width: 80, fontSize: 14, opacity: 0.7, textAlign: 'center' }}>LL</Typography>
                <Typography sx={{ color: textColor, width: 80, fontSize: 14, opacity: 0.7, textAlign: 'center' }}>HL</Typography>
              </Box>
              {controlledVars.map((row: Variable, idx: number) => {
                const violating = isViolating(row);
                const duration = getViolationDuration(row.name);
                
                return (
                <Box key={idx} sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mb: 2 }}>
                  <Typography sx={{ color: textColor3, width: 250, fontSize: 14 }}>
                    {row.name}
                    {violating && duration > 0 && (
                      <Typography component="span" sx={{ color: '#ff6b6b', fontSize: 11, ml: 1 }}>
                        ({Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')})
                      </Typography>
                    )}
                  </Typography>
                  <Box
                    sx={{
                      width: 80,
                      height: 50,
                      background: violating 
                        ? (duration >= 300 ? 'linear-gradient(135deg, #ff4757 0%, #c23616 100%)' : 'linear-gradient(135deg, #ffa502 0%, #ff6348 100%)')
                        : 'transparent',
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: violating ? '#fff' : textColor,
                      fontSize: 16,
                      fontWeight: 500,
                      animation: duration >= 300 ? 'pulse 2s infinite' : 'none',
                    }}
                  >
                    {row.pv.toFixed(0)}
                  </Box>
                  <Box
                  sx={{
                    width: 160,
                    height: 50,
                    background: 'linear-gradient(135deg, rgba(42, 39, 82, 0.6) 0%, rgba(31, 28, 68, 0.8) 100%)',
                    //border: '1px solid rgba(106, 130, 251, 0.3)',
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
                      <Box
                        sx={{
                          width: 80,
                          height: 50,
                          background: 'linear-gradient(135deg, rgba(42, 39, 82, 0.6) 0%, rgba(31, 28, 68, 0.8) 100%)',
                          borderRight: '1px solid rgba(106, 130, 251, 0.3)',
                          borderRadius: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: textColor,
                          fontSize: 16,
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          
                          '&:hover': {
                            background: 'linear-gradient(135deg, rgba(52, 49, 92, 0.8) 0%, rgba(41, 38, 78, 1) 100%)',
                            borderColor: 'rgba(106, 130, 251, 0.6)',
                            transform: 'translateY(-2px)',
                            boxShadow: '0 4px 12px rgba(106, 130, 251, 0.3)',
                          },
                        }}
                        onClick={() => handleOpenModal(row)}
                      >
                        {row.ll}
                      </Box>
                      <Box
                        sx={{
                          width: 80,
                          height: 50,
                          background: 'linear-gradient(135deg, rgba(42, 39, 82, 0.6) 0%, rgba(31, 28, 68, 0.8) 100%)',
                          
                          borderRadius: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: textColor,
                          fontSize: 16,
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          
                          '&:hover': {
                            background: 'linear-gradient(135deg, rgba(52, 49, 92, 0.8) 0%, rgba(41, 38, 78, 1) 100%)',
                            borderColor: 'rgba(106, 130, 251, 0.6)',
                            transform: 'translateY(-2px)',
                            boxShadow: '0 4px 12px rgba(106, 130, 251, 0.3)',
                          },
                        }}
                        onClick={() => handleOpenModal(row)}
                      >
                        {row.hl}
                      </Box>
                  </Box>
                </Box>
                );
              })}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Add keyframes for pulse animation */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }
      `}</style>

      {/* Modal for updating values */}
      <Dialog open={open} onClose={handleCloseModal}>
        <DialogTitle>Update Limits</DialogTitle>
        <DialogContent>
          <TextField
            label="LL"
            value={updatedValues.ll}
            onChange={(e) => setUpdatedValues({ ...updatedValues, ll: e.target.value })}
            fullWidth
            margin="dense"
          />
          <TextField
            label="HL"
            value={updatedValues.hl}
            onChange={(e) => setUpdatedValues({ ...updatedValues, hl: e.target.value })}
            fullWidth
            margin="dense"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModal}>Cancel</Button>
          <Button onClick={handleSave} color="primary">Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}