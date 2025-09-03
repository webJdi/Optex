import React from 'react';
import PlantKPI from '../components/PlantKPI';
import ProcessChart from '../components/ProcessChart';
import OptimizerControl from '../components/OptimizerControl';
import { Box, Container, Typography, Button, Stack, AppBar, Toolbar, Grid } from '@mui/material';
import { useRouter } from 'next/router';

const bgLight = '#f6fafd';
const bgDark = '#183c4a';
const accent = '#0ea5e9';
const cardBg = '#fff';
const headingColor = '#183c4a';
const subHeadingColor = '#3b5d6c';
const buttonBg = accent;
const buttonText = '#fff';
const buttonOutline = bgDark;

export default function Landing() {
  const router = useRouter();
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: bgLight }}>
      {/* Menubar */}
      <AppBar position="static" elevation={0} sx={{ bgcolor: '#fff', color: headingColor, borderBottom: '1px solid #e0e7ef' }}>
        <Toolbar sx={{ minHeight: 64, px: { xs: 2, md: 4 } }}>
          <Typography variant="h6" fontWeight={800} sx={{ flexGrow: 1, letterSpacing: -1 }}>
            Optex
          </Typography>
          <Button variant="text" sx={{ color: headingColor, fontWeight: 600, textTransform: 'none', mx: 1 }}>Products</Button>
          <Button variant="text" sx={{ color: headingColor, fontWeight: 600, textTransform: 'none', mx: 1 }}>Pricing</Button>
          <Button variant="text" sx={{ color: headingColor, fontWeight: 600, textTransform: 'none', mx: 1 }}>Learn</Button>
          <Button variant="outlined" sx={{ color: accent, borderColor: accent, fontWeight: 700, borderRadius: 2, textTransform: 'none', ml: 2 }} onClick={() => router.push('/login')}>Login</Button>
          <Button variant="contained" sx={{ bgcolor: accent, color: buttonText, fontWeight: 700, borderRadius: 2, textTransform: 'none', ml: 2 }}>Sign Up</Button>
        </Toolbar>
      </AppBar>

      {/* Segment 1: Hero/Header */}
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Box component="header" mb={10}>
          <Typography
            variant="h2"
            fontWeight={900}
            sx={{ color: headingColor, mb: 2, letterSpacing: -1, fontSize: { xs: 32, md: 48 } }}
          >
            Get paid early, save automatically, optimize all your process
          </Typography>
          <Typography
            variant="h6"
            sx={{ color: subHeadingColor, mb: 4, fontWeight: 500 }}
          >
            Supports cement plants with real-time optimization, powerful integrations, and autonomous control tools.
          </Typography>
          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              size="large"
              sx={{
                bgcolor: buttonBg,
                color: buttonText,
                fontWeight: 700,
                borderRadius: 2,
                px: 4,
                py: 1.5,
                boxShadow: 2,
                textTransform: 'none',
                '&:hover': { bgcolor: accent }
              }}
            >
              Get Started
            </Button>
            <Button
              variant="outlined"
              size="large"
              sx={{
                color: buttonOutline,
                borderColor: buttonOutline,
                fontWeight: 700,
                borderRadius: 2,
                px: 4,
                py: 1.5,
                boxShadow: 1,
                textTransform: 'none',
                '&:hover': { bgcolor: bgLight, borderColor: accent, color: accent }
              }}
            >
              Learn More
            </Button>
          </Stack>
        </Box>
      </Container>

      {/* Segment 2: Features/Stats with dark background */}
      <Box sx={{ bgcolor: bgDark, py: 8 }}>
        <Container maxWidth="lg">
          <Grid container spacing={4}>
            <Grid item xs={12} md={4}>
              <Typography variant="h4" fontWeight={700} color="#fff" mb={2}>3k+ Plants Optimized</Typography>
              <Typography color="#b6d4e3">Instant process control, energy savings, and quality boost.</Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="h4" fontWeight={700} color="#fff" mb={2}>99.9% Uptime</Typography>
              <Typography color="#b6d4e3">Autonomous AI-driven operations, always running.</Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="h4" fontWeight={700} color="#fff" mb={2}>Instant Insights</Typography>
              <Typography color="#b6d4e3">Live analytics, predictive maintenance, and reporting.</Typography>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Segment 3: Graphs and App Stats */}
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Grid container spacing={4} mb={6}>
          <Grid item xs={12} md={6}>
            <ProcessChart />
          </Grid>
          <Grid item xs={12} md={6}>
            <PlantKPI />
          </Grid>
        </Grid>
        <Box>
          <OptimizerControl />
        </Box>
      </Container>
    </Box>
  );
}
