import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Divider,
  InputAdornment,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import RefreshIcon from '@mui/icons-material/Refresh';

interface PricingConfig {
  limestone_price_per_ton: number;
  clay_price_per_ton: number;
  traditional_fuel_price_per_kg: number;
  alternative_fuel_price_per_kg: number;
  clinker_selling_price_per_ton: number;
  electricity_price_per_kwh: number;
  byproduct_credit_per_ton: number;
}

const PricingConfiguration: React.FC = () => {
  const [pricing, setPricing] = useState<PricingConfig>({
    limestone_price_per_ton: 15.0,
    clay_price_per_ton: 12.0,
    traditional_fuel_price_per_kg: 0.08,
    alternative_fuel_price_per_kg: 0.03,
    clinker_selling_price_per_ton: 50.0,
    electricity_price_per_kwh: 0.10,
    byproduct_credit_per_ton: 5.0,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchPricing();
  }, []);

  const fetchPricing = async () => {
    try {
      setLoading(true);
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const response = await fetch(`${backendUrl}/get_pricing`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch pricing: ${response.statusText}`);
      }
      
      const data = await response.json();
      setPricing(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch pricing configuration');
      console.error('Error fetching pricing:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof PricingConfig, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0) {
      setPricing(prev => ({ ...prev, [field]: numValue }));
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const response = await fetch(`${backendUrl}/update_pricing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pricing),
      });

      if (!response.ok) {
        throw new Error(`Failed to update pricing: ${response.statusText}`);
      }

      const result = await response.json();
      setSuccess(result.message || 'Pricing updated successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update pricing');
      console.error('Error updating pricing:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    fetchPricing();
    setSuccess(null);
    setError(null);
  };

  const pricingFields: Array<{
    key: keyof PricingConfig;
    label: string;
    unit: string;
    description: string;
    prefix?: string;
  }> = [
    {
      key: 'limestone_price_per_ton',
      label: 'Limestone Price',
      unit: '$/ton',
      description: 'Cost of limestone raw material',
      prefix: '$'
    },
    {
      key: 'clay_price_per_ton',
      label: 'Clay Price',
      unit: '$/ton',
      description: 'Cost of clay raw material',
      prefix: '$'
    },
    {
      key: 'traditional_fuel_price_per_kg',
      label: 'Traditional Fuel Price',
      unit: '$/kg',
      description: 'Cost of traditional fuel (e.g., coal)',
      prefix: '$'
    },
    {
      key: 'alternative_fuel_price_per_kg',
      label: 'Alternative Fuel Price',
      unit: '$/kg',
      description: 'Cost of alternative fuel (waste-derived)',
      prefix: '$'
    },
    {
      key: 'clinker_selling_price_per_ton',
      label: 'Clinker Selling Price',
      unit: '$/ton',
      description: 'Revenue from clinker sales',
      prefix: '$'
    },
    {
      key: 'electricity_price_per_kwh',
      label: 'Electricity Price',
      unit: '$/kWh',
      description: 'Cost of electrical power',
      prefix: '$'
    },
    {
      key: 'byproduct_credit_per_ton',
      label: 'Byproduct Credit',
      unit: '$/ton',
      description: 'Revenue from byproduct sales',
      prefix: '$'
    },
  ];

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 1 }}>
        Pricing Configuration
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure pricing parameters for economic-based optimization
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
              gap: 3,
            }}
          >
            {pricingFields.map((field) => (
              <Box key={field.key}>
                <TextField
                  fullWidth
                  label={field.label}
                  type="number"
                  value={pricing[field.key]}
                  onChange={(e) => handleInputChange(field.key, e.target.value)}
                  InputProps={{
                    startAdornment: field.prefix && (
                      <InputAdornment position="start">{field.prefix}</InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">{field.unit}</InputAdornment>
                    ),
                  }}
                  helperText={field.description}
                  inputProps={{
                    step: field.key.includes('electricity') || field.key.includes('fuel') ? 0.01 : 1,
                    min: 0,
                  }}
                />
              </Box>
            ))}
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Economic Impact Preview */}
          <Box sx={{ mb: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              Economic Impact Preview
            </Typography>
            <Typography variant="body2" color="text.secondary">
              These prices are used to calculate the economic value ($/hour) in the optimization objective function.
              Lower fuel and material costs with higher clinker prices will drive the optimizer toward higher production rates.
            </Typography>
          </Box>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={handleReset}
              disabled={saving}
            >
              Reset
            </Button>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>
            💡 How Pricing Affects Optimization
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            The optimizer uses these prices to calculate economic value in $/hour:
          </Typography>
          <Box component="ul" sx={{ pl: 2, m: 0 }}>
            <Typography component="li" variant="body2" color="text.secondary">
              <strong>Revenue:</strong> Clinker production × selling price + byproduct credits
            </Typography>
            <Typography component="li" variant="body2" color="text.secondary">
              <strong>Costs:</strong> Raw materials + traditional fuel + alternative fuel + electricity
            </Typography>
            <Typography component="li" variant="body2" color="text.secondary">
              <strong>Objective:</strong> Maximize (Revenue - Costs) while meeting constraints
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default PricingConfiguration;
