package razorpay

import (
	"bytes"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"
)

var (
	ErrInvalidSignature = errors.New("invalid webhook signature")
)

// Config holds Razorpay credentials and mock mode flags.
type Config struct {
	KeyID         string `json:"key_id"`
	KeySecret     string `json:"key_secret"`
	WebhookSecret string `json:"webhook_secret"`
	IsMockMode    bool   `json:"is_mock_mode"`
}

// OrderRequest is the payload sent to create a Razorpay order.
type OrderRequest struct {
	Amount         int64             `json:"amount"` // in paise
	Currency       string            `json:"currency"`
	Receipt        string            `json:"receipt,omitempty"`
	Notes          map[string]string `json:"notes,omitempty"`
	PartialPayment bool              `json:"partial_payment,omitempty"`
}

// OrderResponse represents Razorpay's order entity.
type OrderResponse struct {
	ID         string            `json:"id"`
	Entity     string            `json:"entity"`
	Amount     int64             `json:"amount"`
	AmountPaid int64             `json:"amount_paid"`
	AmountDue  int64             `json:"amount_due"`
	Currency   string            `json:"currency"`
	Receipt    string            `json:"receipt"`
	Status     string            `json:"status"` // created, attempted, paid
	Attempts   int               `json:"attempts"`
	Notes      map[string]string `json:"notes,omitempty"`
	CreatedAt  int64             `json:"created_at"`
}

// PaymentResponse represents a captured Razorpay payment.
type PaymentResponse struct {
	ID        string            `json:"id"`
	Entity    string            `json:"entity"`
	Amount    int64             `json:"amount"`
	Currency  string            `json:"currency"`
	Status    string            `json:"status"` // captured, failed, refunded
	OrderID   string            `json:"order_id"`
	Method    string            `json:"method"`
	Captured  bool              `json:"captured"`
	Notes     map[string]string `json:"notes,omitempty"`
	CreatedAt int64             `json:"created_at"`
}

// WebhookPayload represents Razorpay webhook events.
type WebhookPayload struct {
	Entity    string                 `json:"entity"`
	AccountID string                 `json:"account_id"`
	Event     string                 `json:"event"`
	Contains  []string               `json:"contains"`
	Payload   map[string]interface{} `json:"payload"`
	CreatedAt int64                  `json:"created_at"`
}

// Client wraps Razorpay API interactions with seamless mock sandbox support.
type Client struct {
	cfg        Config
	httpClient *http.Client
	mu         sync.RWMutex
	mockOrders map[string]*OrderResponse
}

// NewClient initializes a Razorpay client. If KeyID is not set, mock mode is activated.
func NewClient(cfg Config) *Client {
	if cfg.KeyID == "" || cfg.KeyID == "mock" || cfg.KeyID == "test_mock" {
		cfg.IsMockMode = true
	}
	return &Client{
		cfg: cfg,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		mockOrders: make(map[string]*OrderResponse),
	}
}

// CreateOrder creates a Razorpay order in test-mode or mock sandbox.
func (c *Client) CreateOrder(req OrderRequest) (*OrderResponse, error) {
	if req.Currency == "" {
		req.Currency = "INR"
	}
	if req.Amount <= 0 {
		return nil, fmt.Errorf("invalid order amount: %d", req.Amount)
	}

	if c.cfg.IsMockMode {
		return c.createMockOrder(req)
	}

	reqBody, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}

	httpReq, err := http.NewRequest("POST", "https://api.razorpay.com/v1/orders", bytes.NewReader(reqBody))
	if err != nil {
		return nil, err
	}
	httpReq.SetBasicAuth(c.cfg.KeyID, c.cfg.KeySecret)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("razorpay api network error: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("razorpay order creation failed (status %d): %s", resp.StatusCode, string(bodyBytes))
	}

	var orderResp OrderResponse
	if err := json.Unmarshal(bodyBytes, &orderResp); err != nil {
		return nil, err
	}

	return &orderResp, nil
}

// SimulatePayment marks a mock or test order as captured and returns a payment ID.
func (c *Client) SimulatePayment(orderID string, amountPaise int64) (*PaymentResponse, error) {
	now := time.Now().UTC().Unix()
	payID := generateRandomID("pay_", 14)

	c.mu.Lock()
	defer c.mu.Unlock()

	if order, exists := c.mockOrders[orderID]; exists {
		order.Status = "paid"
		order.AmountPaid = amountPaise
		order.AmountDue = 0
		order.Attempts = 1
	}

	return &PaymentResponse{
		ID:        payID,
		Entity:    "payment",
		Amount:    amountPaise,
		Currency:  "INR",
		Status:    "captured",
		OrderID:   orderID,
		Method:    "agent_autonomous_gateway",
		Captured:  true,
		CreatedAt: now,
	}, nil
}

// VerifyWebhookSignature verifies HMAC-SHA256 signature for Razorpay webhooks.
func (c *Client) VerifyWebhookSignature(body []byte, signature string) bool {
	if c.cfg.WebhookSecret == "" || c.cfg.IsMockMode {
		return true // Sandbox / Mock accepts verification
	}

	mac := hmac.New(sha256.New, []byte(c.cfg.WebhookSecret))
	mac.Write(body)
	expectedSignature := hex.EncodeToString(mac.Sum(nil))

	return hmac.Equal([]byte(expectedSignature), []byte(signature))
}

func (c *Client) createMockOrder(req OrderRequest) (*OrderResponse, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	now := time.Now().UTC().Unix()
	orderID := generateRandomID("order_", 14)

	resp := &OrderResponse{
		ID:         orderID,
		Entity:     "order",
		Amount:     req.Amount,
		AmountPaid: 0,
		AmountDue:  req.Amount,
		Currency:   req.Currency,
		Receipt:    req.Receipt,
		Status:     "created",
		Attempts:   0,
		Notes:      req.Notes,
		CreatedAt:  now,
	}

	c.mockOrders[orderID] = resp
	return resp, nil
}

// GetMockOrder retrieves stored mock order if in mock mode.
func (c *Client) GetMockOrder(orderID string) (*OrderResponse, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	order, exists := c.mockOrders[orderID]
	return order, exists
}

func generateRandomID(prefix string, length int) string {
	bytes := make([]byte, length/2)
	_, _ = rand.Read(bytes)
	return prefix + hex.EncodeToString(bytes)
}
