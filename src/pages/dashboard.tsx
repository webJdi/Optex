import React, { useState, useEffect } from 'react';
import { fetchPlantReading, PlantReading } from '../services/plantApi';
import { historizePlantReading } from '../services/plantHistory';
import { Box, Typography, Paper, Button } from '@mui/material';
import Sidebar from '../components/Sidebar';
import DashboardIcon from '@mui/icons-material/Dashboard'
import AllInclusiveIcon from '@mui/icons-material/AllInclusive';
import VideogameAssetIcon from '@mui/icons-material/VideogameAsset';
import FactoryIcon from '@mui/icons-material/Factory';
import SmartToyIcon from '@mui/icons-material/SmartToy';

const accent = '#00e6fe';
const cardBg = '#17153A';
const textColor = '#fff';
const gradientBg = 'linear-gradient(-120deg, #ea67cfff 0%, #5b2be1 100%)';
const menuGrad = 'linear-gradient(180deg, #262250 0%, #17163B 100%)';
const shadowDrop = '3px 5px 23px 3px rgba(0,0,0,0.39);'
const glowBg = 'linear-gradient(135deg, #40DDFF 0%, #0B98C5 100%)';

export default function Dashboard() {
  const [reading, setReading] = useState<PlantReading | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      fontFamily: `'PT Sans', sans-serif`,
    }}>
      <Box sx={{
        width: { xs: '100%', md: '95vw' },
        height: {xs: '100%', md: '90vh' },
        background: cardBg,
        borderRadius: 6,
        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
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
                background: cardBg,
                border: '1px solid rgba(255, 255, 255, 0.2)',
                p: 3,
                borderRadius: 4,
                color: textColor,
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
              <Typography sx={{ color: '#b6d4e3', fontSize: 14 }}>Specific Heat Consumption</Typography>
            </Paper>
            <Paper 
              sx={{
                background: cardBg,
                border: '1px solid rgba(255, 255, 255, 0.2)',
                p: 3,
                borderRadius: 4,
                color: textColor,
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
              <Typography sx={{ color: '#b6d4e3', fontSize: 14 }}>Lime Saturation Factor (LSF)</Typography>
            </Paper>
            <Paper 
              sx={{
                background: cardBg,
                border: '1px solid rgba(255, 255, 255, 0.2)',
                p: 3,
                borderRadius: 4,
                color: textColor,
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
              <Typography sx={{ color: '#b6d4e3', fontSize: 14 }}>Specific Power Consumption</Typography>
            </Paper>
            <Paper 
              sx={{
                background: cardBg,
                border: '1px solid rgba(255, 255, 255, 0.2)',
                p: 3,
                borderRadius: 4,
                color: textColor,
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
              <Typography sx={{ color: '#b6d4e3', fontSize: 14 }}>TSR (Alt. Fuel Ratio)</Typography>
            </Paper>
          </Box>


          {/* Chart Placeholder */}
          <Paper
            sx={{
              background: cardBg,
              borderRadius: 4,
              p: 4,
              mb: 2,
              height: '60vh',
              }}>
            <Typography sx={{
              color: accent,
              fontWeight: 700,
              mb: 2 
              }}>
                Trend
            </Typography>
            <Box
              sx={{
                height: 160,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#b6d4e3',
                opacity: 0.7
                }}>
              {/* Chart would go here */}
              
            </Box>
          </Paper>
          
        </Box>
      </Box>
    </Box>
  );
}
