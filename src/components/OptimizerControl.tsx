import React from 'react';
import { Card, CardContent, Typography, Box, Button, Stack } from '@mui/material';

export default function OptimizerControl() {
  // Placeholder for optimizer controls (start, stop, status)
  return (
    <Card elevation={4} sx={{ borderRadius: 4, mt: 4 }}>
      <CardContent>
        <Typography variant="h4" fontWeight={700} color="text.primary" mb={3}>
          Optimizer Controls
        </Typography>
        <Stack direction="row" spacing={2} mb={2}>
          <Button variant="contained" color="primary" sx={{ fontWeight: 600, boxShadow: 2 }}>
            Start Optimizer
          </Button>
          <Button variant="outlined" color="primary" sx={{ fontWeight: 600, boxShadow: 1 }}>
            Stop Optimizer
          </Button>
        </Stack>
        <Typography color="text.secondary" variant="body1">
          Status: <Box component="span" fontWeight={600} color="primary.main">Idle</Box>
        </Typography>
      </CardContent>
    </Card>
  );
}
