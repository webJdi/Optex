import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import Person2Icon from '@mui/icons-material/Person2';
import { textColor, glowCol2, glowCol3, cardBg } from './ColorPalette';
import LogoutIcon from '@mui/icons-material/Logout';
import { useRouter } from 'next/router';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';

interface PageHeaderProps {
  pageName: string;
}

const PageHeader: React.FC<PageHeaderProps> = ({ pageName }) => {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/'); // Redirect to login page
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
      <Typography variant="h4" sx={{fontFamily: `'Montserrat', sans-serif`, color: textColor, fontWeight: 400 }}>{pageName}</Typography>
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Button sx={{ color: glowCol3, borderRadius: 12, transition: '0.3s', border: `1px solid ${glowCol3}`, fontWeight: 700, textTransform: 'none', height: 40, width: 40,
          '&:hover': { background: glowCol3, color: cardBg }
        }}>
          <Person2Icon />
        </Button>

        <Button 
          onClick={handleLogout}
          sx={{ color: glowCol2, borderRadius: 12, transition: '0.3s', border: `1px solid ${glowCol2}`, fontWeight: 700, textTransform: 'none', height: 40, width: 40,
            '&:hover': { background: glowCol2, color: cardBg }
          }}
        >
          <LogoutIcon />
        </Button>
      </Box>
    </Box>
  );
};

export default PageHeader;
