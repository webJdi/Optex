/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useRequireAuth } from '../hooks/useAuth';
import { PlantReading } from '../services/plantApi';
import { Box, Typography, Paper, Dialog, DialogActions, DialogContent, DialogTitle, Button, TextField } from '@mui/material';
import Sidebar from '../components/Sidebar';
import PageHeader from '../components/PageHeader';
import { accent, cardBg, textColor, textColor2, textColor3, gradientBg, glowBg1, glowBg2, glowBg3, glowBg4, shadowDrop, col1, col2, col3, col4, glowCol1, glowCol2, glowCol3, glowCol4 } from '../components/ColorPalette';
import { updateApcLimits } from '../services/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
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
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [selectedVar, setSelectedVar] = useState<Variable | null>(null);
  const [updatedValues, setUpdatedValues] = useState({ pv: '', ll: '', hl: '' });
  const [manipulatedVars, setManipulatedVars] = useState<Variable[]>([]);
  const [controlledVars, setControlledVars] = useState<Variable[]>([]);
  const [reading, setReading] = useState<PlantReading | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Body margin effect
  useEffect(() => {
    document.body.style.margin = '0';
    return () => { document.body.style.margin = ''; };
  }, []);

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
              <Typography variant="h6" sx={{ color: textColor, fontWeight: 600, mb: 3 }}>
                Manipulated Variables
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
                <Typography sx={{ color: textColor, width: 250, fontSize: 14, opacity: 0.7 }}> </Typography>
                <Typography sx={{ color: textColor, width: 80, fontSize: 14, opacity: 0.7, textAlign: 'center' }}>PV</Typography>
                <Typography sx={{ color: textColor, width: 80, fontSize: 14, opacity: 0.7, textAlign: 'center' }}>LL</Typography>
                <Typography sx={{ color: textColor, width: 80, fontSize: 14, opacity: 0.7, textAlign: 'center' }}>HL</Typography>
              </Box>
              {manipulatedVars.map((row: Variable, idx: number) => (
                <Box key={idx} sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mb: 2 }}>
                  <Typography sx={{ color: textColor, width: 250, fontSize: 14 }}>{row.name}</Typography>
                  <Box
                    sx={{
                      width: 80,
                      height: 50,
                      
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: textColor,
                      fontSize: 16,
                      fontWeight: 500,
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
              ))}
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ color: textColor, fontWeight: 600, mb: 3 }}>
                Controlled Variables
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
                <Typography sx={{ color: textColor, width: 250, fontSize: 14, opacity: 0.7 }}> </Typography>
                <Typography sx={{ color: textColor, width: 80, fontSize: 14, opacity: 0.7, textAlign: 'center' }}>PV</Typography>
                <Typography sx={{ color: textColor, width: 80, fontSize: 14, opacity: 0.7, textAlign: 'center' }}>LL</Typography>
                <Typography sx={{ color: textColor, width: 80, fontSize: 14, opacity: 0.7, textAlign: 'center' }}>HL</Typography>
              </Box>
              {controlledVars.map((row: Variable, idx: number) => (
                <Box key={idx} sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mb: 2 }}>
                  <Typography sx={{ color: textColor, width: 250, fontSize: 14 }}>{row.name}</Typography>
                  <Box
                    sx={{
                      width: 80,
                      height: 50,
                      
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: textColor,
                      fontSize: 16,
                      fontWeight: 500,
                      
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
              ))}
            </Box>
          </Box>
        </Box>
      </Box>

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