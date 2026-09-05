package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/ledger/gateway/internal/api"
)

func main() {
	loadDotEnv()

	port := getEnv("PORT", "8080")
	thresholdINR := getEnvInt64("MANUAL_APPROVAL_THRESHOLD_INR", 10000)
	budgetCapINR := getEnvInt64("DEFAULT_BUDGET_CAP_INR", 10000)
	dbPath := getEnv("DB_PATH", "ledger.db")
	rzpKeyID := getEnv("RAZORPAY_KEY_ID", "mock")
	rzpSecret := getEnv("RAZORPAY_KEY_SECRET", "")
	rzpWebhookSecret := getEnv("RAZORPAY_WEBHOOK_SECRET", "")

	smtpHost := getEnv("SMTP_HOST", "")
	smtpPort := getEnv("SMTP_PORT", "587")
	smtpUser := getEnv("SMTP_USER", "")

	cfg := api.Config{
		Port:                         port,
		ManualApprovalThresholdPaise: thresholdINR * 100,
		DefaultAgentCapacityPaise:    budgetCapINR * 100,
		RazorpayKeyID:                rzpKeyID,
		RazorpayKeySecret:            rzpSecret,
		RazorpayWebhookSecret:        rzpWebhookSecret,
		DBPath:                       dbPath,
	}

	server, err := api.NewServer(cfg)
	if err != nil {
		log.Fatalf("[FATAL] Failed to initialize Ledger Gateway: %v", err)
	}

	modeStr := "Mock Sandbox Emulator (Zero-dependency)"
	if rzpKeyID != "mock" && rzpKeyID != "" {
		modeStr = fmt.Sprintf("Live Razorpay Test Mode (Key: %s...)", rzpKeyID[:min(len(rzpKeyID), 8)])
	}

	mailerStatus := "Direct DNS MX Resolution (Set SMTP_HOST in .env for custom relay)"
	if smtpHost != "" && smtpUser != "" {
		mailerStatus = fmt.Sprintf("Authenticated SMTP Relay (%s:%s as %s)", smtpHost, smtpPort, smtpUser)
	}

	fmt.Println(`
   __    ____ ___   ____ ____ ___ 
  / /   / __// _ \ / ___// __// _ \
 / /__ / _/ / // // (_ // _/ / , _/
/____//___//____/ \___//___//_/|_|  v1.0.0
                                  
Autonomous Payment Recovery & Triage Gateway
Built on Razorpay Test-Mode APIs & Token-Bucket Gating`)
	fmt.Println("------------------------------------------------------------")
	fmt.Printf("[GATEWAY] Listening on            : http://0.0.0.0:%s\n", port)
	fmt.Printf("[POLICY]  Spend Budget Cap/Agent  : ₹%d (Token Bucket)\n", budgetCapINR)
	fmt.Printf("[POLICY]  High-Value Threshold    : ₹%d (Requires Human Approval)\n", thresholdINR)
	fmt.Printf("[STORAGE] Database Engine         : SQLite (%s)\n", dbPath)
	fmt.Printf("[RAZORPAY] Integration Engine     : %s\n", modeStr)
	fmt.Printf("[MAILER]  Email Delivery Engine   : %s\n", mailerStatus)
	fmt.Printf("[SSE]     Audit Event Stream      : http://localhost:%s/api/v1/audit/stream\n", port)
	fmt.Println("------------------------------------------------------------")

	httpServer := &http.Server{
		Addr:         ":" + port,
		Handler:      server,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
	}

	// Graceful shutdown handling
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	go func() {
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[FATAL] Server error: %v", err)
		}
	}()

	<-stop
	fmt.Println("\n[GATEWAY] Shutting down gracefully...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := httpServer.Shutdown(ctx); err != nil {
		log.Printf("[ERROR] Server shutdown error: %v", err)
	}
	fmt.Println("[GATEWAY] Stopped cleanly.")
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

func getEnvInt64(key string, defaultVal int64) int64 {
	if val := os.Getenv(key); val != "" {
		if n, err := strconv.ParseInt(val, 10, 64); err == nil {
			return n
		}
	}
	return defaultVal
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func loadDotEnv() {
	paths := []string{".env", "../.env", "gateway/.env"}
	for _, p := range paths {
		content, err := os.ReadFile(p)
		if err == nil {
			lines := strings.Split(string(content), "\n")
			for _, line := range lines {
				line = strings.TrimSpace(line)
				if line == "" || strings.HasPrefix(line, "#") {
					continue
				}
				parts := strings.SplitN(line, "=", 2)
				if len(parts) == 2 {
					k := strings.TrimSpace(parts[0])
					v := strings.Trim(strings.TrimSpace(parts[1]), `"'`)
					if os.Getenv(k) == "" {
						os.Setenv(k, v)
					}
				}
			}
			return
		}
	}
}
