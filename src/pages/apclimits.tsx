/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useRequireAuth } from '../hooks/useAuth';
import { fetchPlantReading, PlantReading } from '../services/plantApi';
import { fetchMLPredictions, PredictionResponse } from '../services/mlPredictions';
import { getSoftSensorHistoricalData, historizeSoftSensorReading } from '../services/plantHistory';
import { Box, Typography, Paper, Dialog, DialogActions, DialogContent, DialogTitle, Button, TextField } from '@mui/material';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import Sidebar from '../components/Sidebar';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import PageHeader from '../components/PageHeader';
import { accent, cardBg, textColor, textColor2, textColor3, gradientBg, glowBg1, glowBg2, glowBg3, glowBg4, shadowDrop, col1, col2, col3, col4, glowCol1, glowCol2, glowCol3, glowCol4 } from '../components/ColorPalette';
import { updateApcLimits } from '../services/firebase';



const manipulatedVars = [
  { name: 'Lorem Ipsum', pv: 36, ll: 36, hl: 45 },
  { name: 'Lorem Ipsum', pv: 36, ll: 36, hl: 45 },
  { name: 'Lorem Ipsum', pv: 36, ll: 36, hl: 45 },
  { name: 'Lorem Ipsum', pv: 36, ll: 36, hl: 45 },
];
const controlledVars = [
  { name: 'Lorem Ipsum', pv: 36, ll: 36, hl: 45 },
  { name: 'Lorem Ipsum', pv: 36, ll: 36, hl: 45 },
  { name: 'Lorem Ipsum', pv: 36, ll: 36, hl: 45 },
  { name: 'Lorem Ipsum', pv: 36, ll: 36, hl: 45 },
];

export default function SoftSensors() {
  const { user, loading } = useRequireAuth();

  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [selectedVar, setSelectedVar] = useState(null);
  const [updatedValues, setUpdatedValues] = useState({ pv: '', ll: '', hl: '' });

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

  const handleOpenModal = (variable) => {
    setSelectedVar(variable);
    setUpdatedValues({ pv: variable.pv, ll: variable.ll, hl: variable.hl });
    setOpen(true);
  };

  const handleCloseModal = () => {
    setOpen(false);
    setSelectedVar(null);
  };

  const handleSave = async () => {
    if (selectedVar) {
      await updateApcLimits(selectedVar.name, updatedValues);
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
                <Typography sx={{ color: textColor, width: 120 }}> </Typography>
                <Typography sx={{ color: textColor, width: 40 }}>PV</Typography>
                <Typography sx={{ color: textColor, width: 40 }}>LL</Typography>
                <Typography sx={{ color: textColor, width: 40 }}>HL</Typography>
              </Box>
              {manipulatedVars.map((row, idx) => (
                <Box key={idx} sx={{ display: 'flex', gap: 2, alignItems: 'center', mt: 1 }}>
                  <Typography sx={{ color: textColor, width: 120 }}>{row.name}</Typography>
                  <Paper
                    sx={{ width: 40, textAlign: 'center', bgcolor: cardBg, color: textColor, p: 1, cursor: 'pointer' }}
                    onClick={() => handleOpenModal(row)}
                  >
                    {row.pv}
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
                <Typography sx={{ color: textColor, width: 120 }}> </Typography>
                <Typography sx={{ color: textColor, width: 40 }}>PV</Typography>
                <Typography sx={{ color: textColor, width: 40 }}>LL</Typography>
                <Typography sx={{ color: textColor, width: 40 }}>HL</Typography>
              </Box>
              {controlledVars.map((row, idx) => (
                <Box key={idx} sx={{ display: 'flex', gap: 2, alignItems: 'center', mt: 1 }}>
                  <Typography sx={{ color: textColor, width: 120 }}>{row.name}</Typography>
                  <Paper
                    sx={{ width: 40, textAlign: 'center', bgcolor: cardBg, color: textColor, p: 1, cursor: 'pointer' }}
                    onClick={() => handleOpenModal(row)}
                  >
                    {row.pv}
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
        <DialogTitle>Update Values</DialogTitle>
        <DialogContent>
          <TextField
            label="PV"
            value={updatedValues.pv}
            onChange={(e) => setUpdatedValues({ ...updatedValues, pv: e.target.value })}
            fullWidth
            margin="dense"
          />
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