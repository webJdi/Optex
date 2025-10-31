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
  mappingKey?: string; // Key to map to plant reading data
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

  // Body margin effect
  useEffect(() => {
    document.body.style.margin = '0';
    return () => { document.body.style.margin = ''; };
  }, []);

  // Fetch plant reading from backend
  useEffect(() => {
    if (!user || loading) return;
    
    const pollReading = async () => {
      try {
        const data = await fetchLatestPlantReading();
        setReading(data);
        setError(null);
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Error fetching reading';
        setError(errorMessage);
      }
    };
    
    // Initial fetch
    pollReading();
    
    // Poll every 1 minute
    const interval = setInterval(pollReading, 60000);
    return () => clearInterval(interval);
  }, [user, loading]);

  // Fetch data from Firebase and update PVs from plant reading
  useEffect(() => {
    if (!user || loading) return;
    
    const fetchData = async () => {
      const { mvLimits, cvLimits } = await fetchLimitsFromFirebase();
      setManipulatedVars(mvLimits);
      setControlledVars(cvLimits);
    };
    fetchData();
  }, [user, loading]);

  // Update PV values when reading changes
  useEffect(() => {
    if (!reading) return;
    
    console.log('Updating PV values with reading:', reading); // Debug log
    
    // Update manipulated variables
    setManipulatedVars(prev => prev.map(variable => {
      const pv = variable.mappingKey ? getNestedValue(reading, variable.mappingKey) : 0;
      console.log(`MV ${variable.name} (${variable.mappingKey}):`, pv); // Debug log
      return {
        ...variable,
        pv
      };
    }));
    
    // Update controlled variables
    setControlledVars(prev => prev.map(variable => {
      const pv = variable.mappingKey ? getNestedValue(reading, variable.mappingKey) : 0;
      console.log(`CV ${variable.name} (${variable.mappingKey}):`, pv); // Debug log
      return {
        ...variable,
        pv
      };
    }));
  }, [reading]);

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
          <Box sx={{ mb: 1 }}>
            <PageHeader pageName="APC Limits" />
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Box>
              <Typography variant="h6" sx={{ color: textColor, fontWeight: 600, mb: 2 }}>
                Manipulated Variables
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Typography sx={{ color: textColor, width: 250 }}> </Typography>
                <Typography sx={{ color: textColor, width: 40 }}>PV</Typography>
                <Typography sx={{ color: textColor, width: 40 }}>LL</Typography>
                <Typography sx={{ color: textColor, width: 40 }}>HL</Typography>
              </Box>
              {manipulatedVars.map((row: Variable, idx: number) => (
                <Box key={idx} sx={{ display: 'flex', gap: 2, alignItems: 'center', mt: 1 }}>
                  <Typography sx={{ color: textColor, width: 250 }}>{row.name}</Typography>
                  <Paper sx={{ width: 40, textAlign: 'center', bgcolor: cardBg, color: textColor, p: 1 }}>
                    {row.pv.toFixed(2)}
                  </Paper>
                  <Paper
                    sx={{ width: 40, textAlign: 'center', bgcolor: cardBg, color: textColor, p: 1, cursor: 'pointer' }}
                    onClick={() => handleOpenModal(row)}
                  >
                    {row.ll}
                  </Paper>
                  <Paper
                    sx={{ width: 40, textAlign: 'center', bgcolor: cardBg, color: textColor, p: 1, cursor: 'pointer' }}
                    onClick={() => handleOpenModal(row)}
                  >
                    {row.hl}
                  </Paper>
                </Box>
              ))}
            </Box>
            <Box>
              <Typography variant="h6" sx={{ color: textColor, fontWeight: 600, mb: 2 }}>
                Controlled Variables
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Typography sx={{ color: textColor, width: 250 }}> </Typography>
                <Typography sx={{ color: textColor, width: 40 }}>PV</Typography>
                <Typography sx={{ color: textColor, width: 40 }}>LL</Typography>
                <Typography sx={{ color: textColor, width: 40 }}>HL</Typography>
              </Box>
              {controlledVars.map((row: Variable, idx: number) => (
                <Box key={idx} sx={{ display: 'flex', gap: 2, alignItems: 'center', mt: 1 }}>
                  <Typography sx={{ color: textColor, width: 250 }}>{row.name}</Typography>
                  <Paper sx={{ width: 40, textAlign: 'center', bgcolor: cardBg, color: textColor, p: 1 }}>
                    {row.pv.toFixed(2)}
                  </Paper>
                  <Paper
                    sx={{ width: 40, textAlign: 'center', bgcolor: cardBg, color: textColor, p: 1, cursor: 'pointer' }}
                    onClick={() => handleOpenModal(row)}
                  >
                    {row.ll}
                  </Paper>
                  <Paper
                    sx={{ width: 40, textAlign: 'center', bgcolor: cardBg, color: textColor, p: 1, cursor: 'pointer' }}
                    onClick={() => handleOpenModal(row)}
                  >
                    {row.hl}
                  </Paper>
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