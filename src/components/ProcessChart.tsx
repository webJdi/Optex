import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';

export default function ProcessChart() {
  // Placeholder for process chart (e.g., temperature, feed rates)
  return (
    <Card elevation={4} sx={{ borderRadius: 4 }}>
      <CardContent>
        <Typography variant="h4" fontWeight={700} color="text.primary" mb={3}>
          Process Trends
        </Typography>
        <Box height={192} bgcolor="#f6fafd" borderRadius={2} display="flex" alignItems="center" justifyContent="center" border={1} borderColor="grey.200">
          {/* Chart will be rendered here */}
          <Typography color="text.disabled" variant="body1">Live process chart placeholder</Typography>
        </Box>
      </CardContent>
    </Card>
  );
}
