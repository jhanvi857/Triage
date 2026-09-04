#!/usr/bin/env bash
set -e

echo "======================================================================"
echo "Starting Triage Multi-Surface Revenue Recovery Control Plane"
echo "1. Python ML Service (Trained Random Forest)   - http://localhost:8000"
echo "2. Go Gateway (API & Decision Engine)          - http://localhost:8080"
echo "3. Operations Cockpit (Next.js Dashboard)      - http://localhost:3000"
echo "4. Customer Storefront & Billing Portal        - http://localhost:5173"
echo "======================================================================"

# 1. Start ML Ranking Service (Python Random Forest)
(cd ml-service && python3 serve.py) &
ML_PID=$!
sleep 2

# 2. Start Go Gateway
(cd gateway && go run ./cmd/gateway/main.go) &
GATEWAY_PID=$!
sleep 2

# 3. Start Dashboard
(cd dashboard && npm run dev) &
DASHBOARD_PID=$!
sleep 1

# 4. Start Storefront
(cd storefront && npm run dev) &
STOREFRONT_PID=$!

trap "kill $ML_PID $GATEWAY_PID $DASHBOARD_PID $STOREFRONT_PID 2>/dev/null" EXIT INT TERM
wait
