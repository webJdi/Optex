import React from 'react';
import { Card, CardContent, Typography, Box, Stack } from '@mui/material';

export default function PlantKPI() {
  // Placeholder for plant KPIs (energy, quality, sustainability)
  return (
    <Card elevation={4} sx={{ borderRadius: 4 }}>
      <CardContent>
        <Typography variant="h4" fontWeight={700} color="text.primary" mb={3}>
          Key Performance Indicators
        </Typography>
        <Stack spacing={2}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="body1" color="text.secondary">Energy Usage</Typography>
            <Typography fontWeight={600} color="primary">-- kWh</Typography>
          </Box>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="body1" color="text.secondary">Production Rate</Typography>
            <Typography fontWeight={600} color="primary">-- T/hr</Typography>
          </Box>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="body1" color="text.secondary">Quality Index</Typography>
            <Typography fontWeight={600} color="primary">--</Typography>
          </Box>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="body1" color="text.secondary">Sustainability Score</Typography>
            <Typography fontWeight={600} color="primary">--</Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
