import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Drawer, List, ListItem, ListItemIcon, ListItemText, Divider, Button } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AllInclusiveIcon from '@mui/icons-material/AllInclusive';
import MessageIcon from '@mui/icons-material/Message';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';

const accent = '#00e6fe';
const cardBg = '#17153A';
const textColor = '#fff';
const gradientBg = 'linear-gradient(-120deg, #ea67cfff 0%, #5b2be1 100%)';
const menuGrad = 'linear-gradient(180deg, #262250 0%, #17163B 100%)';
const shadowDrop = '3px 5px 23px 3px rgba(0,0,0,0.39);'

export default function Dashboard() {


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
      }}>
        {/* Sidebar */}
        <Box sx={{
          width: { xs: '100%', md: '15vw' },
          height: {xs: '10vh', md: '90vh' },
          background: menuGrad,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          py: 4,
          gap: 2,
        }}>
          <Typography variant="h6" sx={{ color: textColor, mb: 4, fontWeight: 700, fontSize: 18 }}>
            Optex
          </Typography>
          <List
            sx={{ width: '90%' }}
          >
            <ListItem>
              <Button sx={{ color: accent, width:'100%', p: 1, display: 'flex', justifyContent:'space-around', textTransform: 'none' }}><DashboardIcon /> <Typography fontSize={'0.9em'}>Dashboard</Typography></Button>
            </ListItem>
            <ListItem>
              <Button sx={{ color: accent, width:'100%', p: 1, display: 'flex', justifyContent:'space-around', textTransform: 'none' }}><AllInclusiveIcon /> <Typography fontSize={'0.9em'}>Optimizer</Typography></Button>
            </ListItem>
            <ListItem>
              <Button sx={{ color: accent, width:'100%', p: 1, display: 'flex', justifyContent:'space-around', textTransform: 'none' }}><MessageIcon /> <Typography fontSize={'0.9em'}>Messages</Typography></Button>
            </ListItem>
            <ListItem>
              <Button sx={{ color: accent, width:'100%', p: 1, display: 'flex', justifyContent:'space-around', textTransform: 'none' }}><SwapHorizIcon /> <Typography fontSize={'0.9em'}>Swap</Typography></Button>
            </ListItem>
          </List>
        </Box>
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
          {/* Wallet Cards */}
          <Box sx={{ display: 'flex', gap: 3, mb: 2 }}>
            <Paper sx={{ background: cardBg, p: 3, borderRadius: 4, color: textColor, minWidth: 180, boxShadow: '0 4px 24px 0 rgba(0,230,254,0.12)' }}>
              <Typography variant="h6" sx={{ color: accent }}>1.9678 BTC</Typography>
              <Typography sx={{ color: '#b6d4e3', fontSize: 14 }}>+12.5%</Typography>
            </Paper>
            <Paper sx={{ background: cardBg, p: 3, borderRadius: 4, color: textColor, minWidth: 180, boxShadow: '0 4px 24px 0 rgba(162,89,236,0.12)' }}>
              <Typography variant="h6" sx={{ color: accent }}>23.234 ETH</Typography>
              <Typography sx={{ color: '#f36', fontSize: 14 }}>-5.23%</Typography>
            </Paper>
            <Paper sx={{ background: cardBg, p: 3, borderRadius: 4, color: textColor, minWidth: 180, boxShadow: '0 4px 24px 0 rgba(91,43,225,0.12)' }}>
              <Typography variant="h6" sx={{ color: accent }}>380.234 LTC</Typography>
              <Typography sx={{ color: '#39e669', fontSize: 14 }}>+39.66%</Typography>
            </Paper>
          </Box>
          {/* Chart Placeholder */}
          <Paper sx={{ background: cardBg, borderRadius: 4, p: 4, mb: 2, minHeight: 220, boxShadow: '0 4px 24px 0 rgba(0,230,254,0.08)' }}>
            <Typography sx={{ color: accent, fontWeight: 700, mb: 2 }}>Trend</Typography>
            <Box sx={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b6d4e3', opacity: 0.7 }}>
              {/* Chart would go here */}
              <Typography>Chart Placeholder</Typography>
            </Box>
          </Paper>
          {/* Notifications */}
          <Paper sx={{ background: cardBg, borderRadius: 4, p: 3, minHeight: 120, boxShadow: '0 4px 24px 0 rgba(0,230,254,0.08)' }}>
            <Typography sx={{ color: accent, fontWeight: 700, mb: 2 }}>Notifications</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ color: textColor, fontSize: 15 }}>
                <b>Clifford Hale</b> sent you a message<br />
                <span style={{ color: '#b6d4e3', fontSize: 13 }}>2 hours ago</span>
              </Box>
              <Box sx={{ color: textColor, fontSize: 15 }}>
                <b>Lottie Marsh</b> sent you coin <span style={{ color: accent }}>+380.234 LTC</span><br />
                <span style={{ color: '#b6d4e3', fontSize: 13 }}>5 hours ago</span>
              </Box>
              <Box sx={{ color: textColor, fontSize: 15 }}>
                <b>BTC</b> price surge <span style={{ color: '#39e669' }}>+39.69%</span><br />
                <span style={{ color: '#b6d4e3', fontSize: 13 }}>3 hours ago</span>
              </Box>
              <Box sx={{ color: textColor, fontSize: 15 }}>
                <b>Danny Jacobs</b> <span style={{ color: '#b6d4e3' }}>Besok jangan lupa mabar mincraft</span><br />
                <span style={{ color: '#b6d4e3', fontSize: 13 }}>1 hour ago</span>
              </Box>
            </Box>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}
