# Cement Plant FastAPI Simulation

This FastAPI app simulates regular cement plant readings (temperature, pressure, flow, level).

## Usage

1. Install requirements:
   ```bash
   pip install -r requirements.txt
   ```
2. Start the server:
   ```bash
   run_server.bat
   ```
3. Endpoints:
   - `/reading`: Get a single simulated reading
   - `/readings?count=10`: Get multiple readings

## Next Steps
- Integrate with Next.js frontend to fetch and display readings
- Store readings in Firebase for historization
