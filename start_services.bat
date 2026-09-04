@echo off
echo ======================================================================
echo Starting Triage Multi-Surface Revenue Recovery Control Plane
echo 1. Python ML Service (Trained Random Forest)   - http://localhost:8000
echo 2. Go Gateway (API ^& Decision Engine)          - http://localhost:8080
echo 3. Operations Cockpit (Next.js Dashboard)      - http://localhost:3000
echo 4. Customer Storefront ^& Billing Portal        - http://localhost:5173
echo ======================================================================

start "Triage ML Service (Random Forest)" cmd /k "cd ml-service && python serve.py"
timeout /t 2 /nobreak >nul

start "Triage Go Gateway" cmd /k "cd gateway && go run ./cmd/gateway/main.go"
timeout /t 2 /nobreak >nul

start "Triage Dashboard" cmd /k "cd dashboard && npm run dev"
timeout /t 2 /nobreak >nul

start "Triage Storefront" cmd /k "cd storefront && npm run dev"

echo All 4 services launched in dedicated terminal windows.
