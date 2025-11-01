import React from 'react';
import { Box, Typography, List, ListItem, Button } from '@mui/material';
import { useRouter } from 'next/router';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AllInclusiveIcon from '@mui/icons-material/AllInclusive';
import BuildIcon from '@mui/icons-material/Build';
import FactoryIcon from '@mui/icons-material/Factory';

const accent = '#00e6fe';
const textColor = '#fff';
const textColor2 = '#17153A';
const menuGrad = 'linear-gradient(180deg, #262250 0%, #17163B 100%)';


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
                  onClick={() => handleNavigation('/apclimits')}
                  sx={{ color: router.pathname === '/apclimits' ? accent : textColor, width:'100%', p: 1, display: 'flex', justifyContent:'space-around', textTransform: 'none',
                    '&:hover': {
                      backgroundColor: router.pathname === '/apclimits' ? accent : 'rgba(0, 230, 254, 0.1)',
                      color: router.pathname === '/apclimits' ? textColor2 : accent,
                    }
                  }}
                >
                  <FactoryIcon /> <Typography fontSize={'0.9em'} sx={{fontFamily: `'Montserrat', sans-serif`}}>APC Limits</Typography>
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
            
      </List>
    </Box>
  );
}
