import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import Person2Icon from '@mui/icons-material/Person2';
import { textColor, glowCol2, cardBg } from './ColorPalette';

interface PageHeaderProps {
  pageName: string;
}

const PageHeader: React.FC<PageHeaderProps> = ({ pageName }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
    <Typography variant="h4" sx={{fontFamily: `'Montserrat', sans-serif`, color: textColor, fontWeight: 400 }}>{pageName}</Typography>
    <Button sx={{ color: glowCol2, borderRadius: 12, transition: '0.3s', border: `1px solid ${glowCol2}`, fontWeight: 700, textTransform: 'none', height: 50, width: 50,
      '&:hover': { background: glowCol2, color: cardBg }
    }}>
      <Person2Icon />
    </Button>
  </Box>
);

export default PageHeader;
