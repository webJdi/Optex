import React, { useState, useEffect } from 'react';
import { Box, Typography, TextField, Button, Paper } from '@mui/material';
import { useRouter } from 'next/router';
import { login } from '../services/firebase';
import PageHeader from '../components/PageHeader';
import { relative } from 'path';

const bgGradient = 'linear-gradient(135deg, #a259ec 0%, #6a82fb 100%)';
const cardBg = 'rgba(24, 28, 56, 0.95)';
const accent = '#6a82fb';
const textColor = '#fff';

export default function LoginPage() {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);
	const router = useRouter();

	useEffect(() => {
		document.body.style.margin = '0';
		return () => { document.body.style.margin = ''; };
	}, []);

	const handleLogin = async () => {
		setLoading(true);
		setError('');
		try {
			await login(email, password);
			router.push('/dashboard');
		} catch (err: any) {
			setError(err.message || 'Login failed');
		} finally {
			setLoading(false);
		}
	};

	return (
	<Box sx={{ 
    height: '100vh', 
    width: '100vw', 
    background: bgGradient, 
    display: 'flex', 
    flexDirection: 'column', 
    alignItems: 'center', 
    justifyContent: 'center',
    p: 0 }}>

          <Typography 
              variant="h2"
              fontWeight={900} 
              sx={{ 
                color: textColor, 
                mb: 4, 
                letterSpacing: -1, 
                fontSize: { xs: 32, md: 48 }, 
                textAlign: 'center', 
                textShadow: '0 2px 16px #6a82fb' 
                }}>
                Optex
          </Typography>
          <Box
              sx={{
                height: 350,
                width: 800,
                padding: 0,
                borderRadius: 4,
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'flex-end',
                position: 'relative',
                overflow: 'hidden'    
              }}
          >
                <Paper
                  sx={{
                    position: 'absolute',
                    background: 'url(/cement.png)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    width: 400,
                    height: '100%',
                    left: 0,
                    zIndex: 0,
                  }}
                >
                </Paper>
                <Box
                    sx={{
                      position: 'absolute',
                      height: 350,
                      zIndex:1,
                      p: 4,
                      borderRadius: 4,
                      width:350,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      background: cardBg
                    }}>
                <Typography
                    variant="h5"
                    fontWeight={700}
                    sx={{
                      mb: 2,
                      color: textColor
                    }}>
                      Login
                </Typography>
                <TextField
                    label="Email"
                    type="email"
                    variant="outlined"
                    fullWidth
                    sx={{ mb: 2, input: { color: textColor }, label: { color: accent } }}
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                />
                <TextField
                    label="Password"
                    type="password"
                    variant="outlined"
                    fullWidth
                    sx={{ mb: 2, input: { color: textColor }, label: { color: accent } }}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                />
                {error && <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>}
                <Button 
                  variant="contained" 
                  fullWidth sx={{ 
                    fontWeight: 700, 
                    py: 1.5, 
                    bgcolor: accent, 
                    color: textColor, 
                    boxShadow: '0 2px 8px #6a82fb', ':hover': { bgcolor: '#a259ec' } }}
                  onClick={handleLogin} 
                  disabled={loading}>
                    {loading ? 'Logging in...' : 'Login'}
                </Button>
                </Box>

            </Box>
          {/* Simple glowing effect */}
      <style jsx global>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 32px 8px #6a82fb; }
          100% { box-shadow: 0 0 48px 16px #a259ec; }
        }
      `}</style>
	</Box>
	);
}
