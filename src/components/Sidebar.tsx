import React from 'react';
import { Box, Typography, List, ListItem, Button } from '@mui/material';
import { useRouter } from 'next/router';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AllInclusiveIcon from '@mui/icons-material/AllInclusive';
import BuildIcon from '@mui/icons-material/Build';

import VideogameAssetIcon from '@mui/icons-material/VideogameAsset';
import FactoryIcon from '@mui/icons-material/Factory';
import SmartToyIcon from '@mui/icons-material/SmartToy';

const accent = '#00e6fe';
const cardBg = '#17153A';
const textColor = '#fff';
const textColor2 = '#17153A';
const gradientBg = 'linear-gradient(-120deg, #ea67cfff 0%, #5b2be1 100%)';
const menuGrad = 'linear-gradient(180deg, #262250 0%, #17163B 100%)';
const shadowDrop = '3px 5px 23px 3px rgba(0,0,0,0.39);'
const glowBg = 'linear-gradient(135deg, #40DDFF 0%, #0B98C5 100%)';


export default function Sidebar() {
  const router = useRouter();
  
  const handleNavigation = (path: string) => {
    router.push(path);
  };

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
              <Button 
                onClick={() => handleNavigation('/dashboard')}
                sx={{ 
                  color: router.pathname === '/dashboard' ? accent : textColor, 
                  //backgroundColor: router.pathname === '/dashboard' ? accent : 'transparent',
                  width:'100%', 
                  p: 1, 
                  display: 'flex', 
                  justifyContent:'space-around', 
                  textTransform: 'none',
                  '&:hover': {
                    backgroundColor: router.pathname === '/dashboard' ? accent : 'rgba(0, 230, 254, 0.1)',
                    color: router.pathname === '/dashboard' ? textColor2 : accent, 
                  }
                }}
              >
                <DashboardIcon /> <Typography fontSize={'0.9em'} sx={{fontFamily: `'Montserrat', sans-serif`}}>Dashboard</Typography>
              </Button>
            </ListItem>
            <ListItem>
              <Button 
                onClick={() => handleNavigation('/softsensors')}
                sx={{ 
                  color: router.pathname === '/softsensors' ? accent : textColor,
                  //backgroundColor: router.pathname === '/softsensors' ? accent : 'transparent',
                  width:'100%', 
                  p: 1, 
                  display: 'flex', 
                  justifyContent:'space-around', 
                  textTransform: 'none',
                  '&:hover': {
                    backgroundColor: router.pathname === '/softsensors' ? accent : 'rgba(0, 230, 254, 0.1)',
                    color: router.pathname === '/softsensors' ? textColor2 : accent,
                  }
                }}
              >
                <AllInclusiveIcon /> <Typography fontSize={'0.9em'} sx={{fontFamily: `'Montserrat', sans-serif`}}>Soft Sensors</Typography>
              </Button>
            </ListItem>
            <ListItem>
                <Button 
                  onClick={() => handleNavigation('/optimizer')}
                  sx={{ color: router.pathname === '/optimizer' ? accent : textColor, width:'100%', p: 1, display: 'flex', justifyContent:'space-around', textTransform: 'none',
                    '&:hover': {
                      backgroundColor: router.pathname === '/optimizer' ? accent : 'rgba(0, 230, 254, 0.1)',
                      color: router.pathname === '/optimizer' ? textColor2 : accent,
                    }
                  }}
                >
                  <FactoryIcon /> <Typography fontSize={'0.9em'} sx={{fontFamily: `'Montserrat', sans-serif`}}>Optimizer</Typography>
                </Button>
            </ListItem>
            
            <ListItem>
                <Button 
                  onClick={() => handleNavigation('/modelbuilder')}
                  sx={{ color: router.pathname === '/modelbuilder' ? accent : textColor, width:'100%', p: 1, display: 'flex', justifyContent:'space-around', textTransform: 'none',
                    '&:hover': {
                      backgroundColor: router.pathname === '/modelbuilder' ? accent : 'rgba(0, 230, 254, 0.1)',
                      color: router.pathname === '/modelbuilder' ? textColor2 : accent,
                    }
                  }}
                >
                  <BuildIcon /> <Typography fontSize={'0.9em'} sx={{fontFamily: `'Montserrat', sans-serif`}}>Model Builder</Typography>
                </Button>
            </ListItem>

            <ListItem sx={{ position: 'relative' }}>
                <Button 
                  //onClick={() => handleNavigation('/simulation')}
                  sx={{ color: router.pathname === '/simulation' ? accent : textColor, width:'100%', p: 1, display: 'flex', justifyContent:'space-around', textTransform: 'none',
                    '&:hover': {
                      backgroundColor: router.pathname === '/simulation' ? accent : 'rgba(0, 230, 254, 0.1)',
                      color: router.pathname === '/simulation' ? textColor2 : accent,
                    }
                  }}
                >
                  <VideogameAssetIcon /> <Typography fontSize={'0.9em'} sx={{fontFamily: `'Montserrat', sans-serif`}}>Simulation</Typography>
                </Button>
                {/* Coming Soon Flag */}
                <Box sx={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  backgroundColor: '#ff6b35',
                  color: 'white',
                  fontSize: '8px',
                  fontWeight: 'bold',
                  padding: '2px 6px',
                  borderRadius: '6px 0 0 0',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                  zIndex: 10,
                  fontFamily: `'Montserrat', sans-serif`,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Soon
                </Box>
            </ListItem>
            <ListItem sx={{ position: 'relative' }}>
                <Button 
                  //onClick={() => handleNavigation('/copilot')}
                  sx={{ color: router.pathname === '/copilot' ? accent : textColor, width:'100%', p: 1, display: 'flex', justifyContent:'space-around', textTransform: 'none',
                    '&:hover': {
                      backgroundColor: router.pathname === '/copilot' ? accent : 'rgba(0, 230, 254, 0.1)',
                      color: router.pathname === '/copilot' ? textColor2 : accent,
                    }
                  }}
                >
                  <SmartToyIcon /> <Typography fontSize={'0.9em'} sx={{fontFamily: `'Montserrat', sans-serif`}}>Co-Pilot</Typography>
                </Button>
                {/* Coming Soon Flag */}
                <Box sx={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  backgroundColor: '#ff6b35',
                  color: 'white',
                  fontSize: '8px',
                  fontWeight: 'bold',
                  padding: '2px 6px',
                  borderRadius: '6px 0 0 0',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                  zIndex: 10,
                  fontFamily: `'Montserrat', sans-serif`,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Soon
                </Box>
            </ListItem>
      </List>
    </Box>
  );
}
