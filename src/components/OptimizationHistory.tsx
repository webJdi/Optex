import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
  Alert,
  Chip,
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface Trial {
  number: number;
  value: number;
  params: Record<string, number>;
}

interface OptimizationRun {
  timestamp: string;
  limit_type: 'apc' | 'engineering';
  trials: Trial[];
  best_value: number;
  best_params: Record<string, number>;
}

const OptimizationHistory: React.FC = () => {
  const [history, setHistory] = useState<OptimizationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'apc' | 'engineering' | 'both'>('both');

  useEffect(() => {
    fetchOptimizationHistory();
    
    // Poll every 30 seconds for new optimization runs
    const interval = setInterval(fetchOptimizationHistory, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchOptimizationHistory = async () => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const response = await fetch(`${backendUrl}/optimization_history`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }
      
      const data: OptimizationRun[] = await response.json();
      setHistory(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch optimization history');
      console.error('Error fetching optimization history:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTypeChange = (_event: React.MouseEvent<HTMLElement>, newType: 'apc' | 'engineering' | 'both' | null) => {
    if (newType !== null) {
      setSelectedType(newType);
    }
  };

  const getFilteredHistory = () => {
    if (selectedType === 'both') return history;
    return history.filter(run => run.limit_type === selectedType);
  };

  const prepareChartData = () => {
    const filteredHistory = getFilteredHistory();
    
    if (filteredHistory.length === 0) return [];

    // Get the latest run for each type
    const apcRuns = filteredHistory.filter(r => r.limit_type === 'apc');
    const engRuns = filteredHistory.filter(r => r.limit_type === 'engineering');

    const latestApc = apcRuns[apcRuns.length - 1];
    const latestEng = engRuns[engRuns.length - 1];

    // Combine trials from both, padding to same length
    const maxLength = Math.max(
      latestApc?.trials.length || 0,
      latestEng?.trials.length || 0
    );

    const chartData: { trial: number; apc?: number; engineering?: number }[] = [];
    for (let i = 0; i < maxLength; i++) {
      const dataPoint: { trial: number; apc?: number; engineering?: number } = { trial: i + 1 };
      
      if (latestApc && i < latestApc.trials.length) {
        dataPoint.apc = latestApc.trials[i].value;
      }
      
      if (latestEng && i < latestEng.trials.length) {
        dataPoint.engineering = latestEng.trials[i].value;
      }
      
      chartData.push(dataPoint);
    }

    return chartData;
  };

  const getLatestRunStats = (type: 'apc' | 'engineering') => {
    const runs = history.filter(r => r.limit_type === type);
    if (runs.length === 0) return null;
    
    const latest = runs[runs.length - 1];
    return {
      timestamp: new Date(latest.timestamp).toLocaleString(),
      bestValue: latest.best_value.toFixed(4),
      trials: latest.trials.length,
    };
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  if (history.length === 0) {
    return (
      <Alert severity="info" sx={{ m: 2 }}>
        No optimization history available. Run an optimization to see convergence plots.
      </Alert>
    );
  }

  const chartData = prepareChartData();
  const apcStats = getLatestRunStats('apc');
  const engStats = getLatestRunStats('engineering');

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
        Optimization Convergence History
      </Typography>

      {/* Filter Toggle */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography variant="body2" color="text.secondary">
          View:
        </Typography>
        <ToggleButtonGroup
          value={selectedType}
          exclusive
          onChange={handleTypeChange}
          size="small"
        >
          <ToggleButton value="apc">APC Limits</ToggleButton>
          <ToggleButton value="engineering">Engineering Limits</ToggleButton>
          <ToggleButton value="both">Both</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Stats Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 3 }}>
        {apcStats && (
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Latest APC-Constrained Optimization
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Chip label={`Best Value: ${apcStats.bestValue}`} color="primary" size="small" sx={{ mr: 1, mb: 1 }} />
                <Chip label={`${apcStats.trials} trials`} size="small" sx={{ mr: 1, mb: 1 }} />
              </Box>
              <Typography variant="caption" color="text.secondary">
                {apcStats.timestamp}
              </Typography>
            </CardContent>
          </Card>
        )}

        {engStats && (
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Latest Engineering-Constrained Optimization
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Chip label={`Best Value: ${engStats.bestValue}`} color="secondary" size="small" sx={{ mr: 1, mb: 1 }} />
                <Chip label={`${engStats.trials} trials`} size="small" sx={{ mr: 1, mb: 1 }} />
              </Box>
              <Typography variant="caption" color="text.secondary">
                {engStats.timestamp}
              </Typography>
            </CardContent>
          </Card>
        )}
      </Box>

      {/* Convergence Plot */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Convergence Plot
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Shows how the optimization objective improves over trials (similar to gradient descent)
          </Typography>
          
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="trial" 
                label={{ value: 'Trial Number', position: 'insideBottom', offset: -5 }} 
              />
              <YAxis 
                label={{ value: 'Objective Value', angle: -90, position: 'insideLeft' }} 
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
              />
              <Legend />
              
              {(selectedType === 'apc' || selectedType === 'both') && (
                <Line 
                  type="monotone" 
                  dataKey="apc" 
                  stroke="#1976d2" 
                  strokeWidth={2}
                  name="APC Limits"
                  dot={{ r: 2 }}
                  activeDot={{ r: 5 }}
                />
              )}
              
              {(selectedType === 'engineering' || selectedType === 'both') && (
                <Line 
                  type="monotone" 
                  dataKey="engineering" 
                  stroke="#9c27b0" 
                  strokeWidth={2}
                  name="Engineering Limits"
                  dot={{ r: 2 }}
                  activeDot={{ r: 5 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, textAlign: 'center' }}>
            Higher values indicate better optimization performance. Convergence shows the optimizer finding better solutions over time.
          </Typography>
        </CardContent>
      </Card>

      {/* Total Runs Summary */}
      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          Total optimization runs: {history.length} 
          {' | '}
          APC: {history.filter(r => r.limit_type === 'apc').length}
          {' | '}
          Engineering: {history.filter(r => r.limit_type === 'engineering').length}
        </Typography>
      </Box>
    </Box>
  );
};

export default OptimizationHistory;
