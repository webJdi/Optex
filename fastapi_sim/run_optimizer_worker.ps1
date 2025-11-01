Write-Host "Starting Optimizer Worker..." -ForegroundColor Green
Write-Host ""
Write-Host "This worker runs independently and checks for optimization requests every 10 seconds" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

python optimizer_worker.py
