import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { Box, Typography, Paper, Button, CircularProgress } from '@mui/material';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import SpeedIcon from '@mui/icons-material/Speed';
import ScienceIcon from '@mui/icons-material/Science';
import BoltIcon from '@mui/icons-material/Bolt';

const accent = '#00e6fe';
const cardBg = '#17153A';
const textColor = '#fff';
const gradientBg = 'linear-gradient(-120deg, #ea67cfff 0%, #5b2be1 100%)';
const shadowDrop = '3px 5px 23px 3px rgba(0,0,0,0.39);';
const textColor2 = '#17153A';

const col1 = '#E07A5F';
const col2 = '#81B29A';
const col3 = '#F2CC8F';
const col4 = '#048BA8';


export default function Optimizer() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
    useEffect(() => {
        document.body.style.margin = '0';
        return () => { document.body.style.margin = ''; };
    }, []);
  const handleStart = async () => {
    setLoading(true);
    setResult(null);
    try {
      // Call backend optimizer endpoint (replace with actual endpoint)
      const res = await fetch('/api/optimizer', { method: 'POST' });
      const data = await res.json();
      setResult(data.message || 'Optimizer run complete!');
    } catch (e) {
      setResult('Failed to run optimizer.');
    }
    setLoading(false);
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
      // fontFamily removed to avoid MuiTypographyRoot override
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
        <Box sx={{ flex: 1, p: 5, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Header */}
          <Typography variant="h4" sx={{ color: textColor, fontWeight: 700, mb: 2 }}>
            Clinker Optimizer
          </Typography>
          {/* DCS-style Clinker Graphic */}
          <Paper sx={{ background: cardBg, borderRadius: 4, p: 4, mb: 2, boxShadow: shadowDrop }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <WhatshotIcon sx={{ fontSize: 60, color: accent }} />
                <Typography sx={{ color: textColor, fontWeight: 600 }}>Burning Zone Temp</Typography>
                <Typography sx={{ color: accent, fontSize: 24 }}>1450°C</Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <SpeedIcon sx={{ fontSize: 60, color: accent }} />
                <Typography sx={{ color: textColor, fontWeight: 600 }}>Kiln Speed</Typography>
                <Typography sx={{ color: accent, fontSize: 24 }}>3.5 RPM</Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <ScienceIcon sx={{ fontSize: 60, color: accent }} />
                <Typography sx={{ color: textColor, fontWeight: 600 }}>LSF</Typography>
                <Typography sx={{ color: accent, fontSize: 24 }}>98.0</Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <BoltIcon sx={{ fontSize: 60, color: accent }} />
                <Typography sx={{ color: textColor, fontWeight: 600 }}>Motor Torque</Typography>
                <Typography sx={{ color: accent, fontSize: 24 }}>70%</Typography>
              </Box>
            </Box>
          </Paper>
          {/* Start Optimizer Button */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button
              variant="contained"
              sx={{ background: accent, color: textColor, fontWeight: 700, borderRadius: 3, px: 4, py: 1, fontSize: 18 }}
              onClick={handleStart}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} sx={{ color: textColor }} /> : 'Start Optimizer'}
            </Button>
            {result && (
              <Typography sx={{ color: accent, fontWeight: 600, ml: 2 }}>{result}</Typography>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
