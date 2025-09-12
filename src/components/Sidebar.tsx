import React from 'react';
import { Box, Typography, List, ListItem, Button } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AllInclusiveIcon from '@mui/icons-material/AllInclusive';

import VideogameAssetIcon from '@mui/icons-material/VideogameAsset';
import FactoryIcon from '@mui/icons-material/Factory';
import SmartToyIcon from '@mui/icons-material/SmartToy';

const accent = '#00e6fe';
const textColor = '#fff';
const menuGrad = 'linear-gradient(180deg, #262250 0%, #17163B 100%)';

export default function Sidebar() {
  return (
    <Box sx={{
      width: { xs: '100%', md: '15vw' },
      height: { xs: '10vh', md: '90vh' },
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
      <List sx={{ width: '90%' }}>
        <ListItem>
              <Button sx={{ color: accent, width:'100%', p: 1, display: 'flex', justifyContent:'space-around', textTransform: 'none' }}><DashboardIcon /> <Typography fontSize={'0.9em'}>Dashboard</Typography></Button>
            </ListItem>
            <ListItem>
              <Button sx={{ color: accent, width:'100%', p: 1, display: 'flex', justifyContent:'space-around', textTransform: 'none' }}><AllInclusiveIcon /> <Typography fontSize={'0.9em'}>Soft Sensors</Typography></Button>
            </ListItem>
            <ListItem>
              <Button sx={{ color: accent, width:'100%', p: 1, display: 'flex', justifyContent:'space-around', textTransform: 'none' }}><FactoryIcon /> <Typography fontSize={'0.9em'}>Optimizer</Typography></Button>
            </ListItem>
            <ListItem>
              <Button sx={{ color: accent, width:'100%', p: 1, display: 'flex', justifyContent:'space-around', textTransform: 'none' }}><VideogameAssetIcon /> <Typography fontSize={'0.9em'}>Simulation</Typography></Button>
            </ListItem>
            <ListItem>
              <Button sx={{ color: accent, width:'100%', p: 1, display: 'flex', justifyContent:'space-around', textTransform: 'none' }}><SmartToyIcon /> <Typography fontSize={'0.9em'}>Co-Pilot</Typography></Button>
            </ListItem>
            <ListItem>
              <Button sx={{ color: accent, width:'100%', p: 1, display: 'flex', justifyContent:'space-around', textTransform: 'none' }}><SmartToyIcon /> <Typography fontSize={'0.9em'}> Model Builder</Typography></Button>
            </ListItem>
            <ListItem>
              <Button sx={{ color: accent, width:'100%', p: 1, display: 'flex', justifyContent:'space-around', textTransform: 'none' }}><SmartToyIcon /> <Typography fontSize={'0.9em'}>Co-Pilot</Typography></Button>
            </ListItem>
      </List>
    </Box>
  );
}
