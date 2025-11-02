import { useState } from 'react';
import { Button, Box, Typography, Alert, CircularProgress } from '@mui/material';

export default function TestBackend() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const testBackendConnection = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log('Testing backend connection...');
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      console.log('Backend URL:', backendUrl);

      // Test health endpoint
      const healthResponse = await fetch(`${backendUrl}/health`);
      console.log('Health response status:', healthResponse.status);
      
      if (!healthResponse.ok) {
        throw new Error(`Health check failed: ${healthResponse.status}`);
      }
      
      const healthData = await healthResponse.json();
      console.log('Health data:', healthData);

      // Test plant data endpoint
      const plantResponse = await fetch(`${backendUrl}/live_plant_state`);
      console.log('Plant response status:', plantResponse.status);
      
      if (!plantResponse.ok) {
        throw new Error(`Plant data failed: ${plantResponse.status}`);
      }
      
      const plantData = await plantResponse.json();
      console.log('Plant data:', plantData);

      setResult({
        backendUrl,
        health: healthData,
        plantData: {
          timestamp: plantData.timestamp,
          kpi: plantData.kpi,
          // Just show a subset to avoid too much data
        }
      });

    } catch (err: any) {
      console.error('Backend connection error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        Backend Connection Test
      </Typography>
      
      <Button 
        variant="contained" 
        onClick={testBackendConnection} 
        disabled={loading}
        sx={{ mb: 2 }}
      >
        {loading ? <CircularProgress size={20} /> : 'Test Backend Connection'}
      </Button>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Error: {error}
        </Alert>
      )}

      {result && (
        <Box>
          <Alert severity="success" sx={{ mb: 2 }}>
            Backend connection successful!
          </Alert>
          
          <Typography variant="h6">Backend URL:</Typography>
          <Typography variant="body2" sx={{ mb: 2, fontFamily: 'monospace' }}>
            {result.backendUrl}
          </Typography>

          <Typography variant="h6">Health Check:</Typography>
          <pre style={{ backgroundColor: '#f5f5f5', padding: '10px', overflow: 'auto' }}>
            {JSON.stringify(result.health, null, 2)}
          </pre>

          <Typography variant="h6" sx={{ mt: 2 }}>Plant Data Sample:</Typography>
          <pre style={{ backgroundColor: '#f5f5f5', padding: '10px', overflow: 'auto' }}>
            {JSON.stringify(result.plantData, null, 2)}
          </pre>
        </Box>
      )}
    </Box>
  );
}