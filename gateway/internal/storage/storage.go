package storage

import (
	"database/sql"
	"fmt"
	"time"

	_ "modernc.org/sqlite"

	"github.com/ledger/gateway/internal/catalog"
)

// OrderRecord models an order in storage.
type OrderRecord struct {
	ID                string    `json:"id"`
	AgentID           string    `json:"agent_id"`
	ProductID         string    `json:"product_id"`
	ProductName       string    `json:"product_name"`
	Quantity          int       `json:"quantity"`
	UnitPricePaise    int64     `json:"unit_price_paise"`
	TotalAmountPaise  int64     `json:"total_amount_paise"`
	Currency          string    `json:"currency"`
	Status            string    `json:"status"` // CREATED, PENDING_APPROVAL, REJECTED, PAID, FAILED
	IdempotencyKey    string    `json:"idempotency_key"`
	RazorpayOrderID   string    `json:"razorpay_order_id"`
	RazorpayPaymentID string    `json:"razorpay_payment_id"`
	Reasoning         string    `json:"reasoning"`
	GateVerdict       string    `json:"gate_verdict"`
	GateReason        string    `json:"gate_reason"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

// ApprovalRecord models a pending or resolved manual approval.
type ApprovalRecord struct {
	ID          string     `json:"id"`
	OrderID     string     `json:"order_id"`
	AgentID     string     `json:"agent_id"`
	AmountPaise int64      `json:"amount_paise"`
	Currency    string     `json:"currency"`
	Reason      string     `json:"reason"`
	Status      string     `json:"status"` // PENDING, APPROVED, REJECTED
	Reviewer    string     `json:"reviewer,omitempty"`
	ReviewedAt  *time.Time `json:"reviewed_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}

// DB wraps database operations for Ledger.
type DB struct {
	db *sql.DB
}

// NewDB initializes the database connection (SQLite by default, or Postgres if DATABASE_URL is set).
func NewDB(dataSourceName string) (*DB, error) {
	if dataSourceName == "" {
		dataSourceName = "ledger.db"
	}

	driver := "sqlite"
	db, err := sql.Open(driver, dataSourceName)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(10 * time.Minute)

	s := &DB{db: db}
	if err := s.InitSchema(); err != nil {
		return nil, fmt.Errorf("failed to initialize schema: %w", err)
	}

	return s, nil
}

// InitSchema applies database tables and seeds catalog.
func (s *DB) InitSchema() error {
	schema := `
	CREATE TABLE IF NOT EXISTS budget_buckets (
		agent_id TEXT PRIMARY KEY,
		capacity_paise INTEGER NOT NULL,
		remaining_paise INTEGER NOT NULL,
		spent_paise INTEGER NOT NULL DEFAULT 0,
		currency TEXT NOT NULL DEFAULT 'INR',
		refill_rate_paise_per_sec INTEGER NOT NULL DEFAULT 0,
		last_refill_at TIMESTAMP NOT NULL,
		created_at TIMESTAMP NOT NULL,
		updated_at TIMESTAMP NOT NULL
	);

	CREATE TABLE IF NOT EXISTS orders (
		id TEXT PRIMARY KEY,
		agent_id TEXT NOT NULL,
		product_id TEXT NOT NULL,
		product_name TEXT NOT NULL,
		quantity INTEGER NOT NULL DEFAULT 1,
		unit_price_paise INTEGER NOT NULL,
		total_amount_paise INTEGER NOT NULL,
		currency TEXT NOT NULL DEFAULT 'INR',
		status TEXT NOT NULL,
		idempotency_key TEXT UNIQUE,
		razorpay_order_id TEXT,
		razorpay_payment_id TEXT,
		reasoning TEXT,
		gate_verdict TEXT NOT NULL,
		gate_reason TEXT,
		created_at TIMESTAMP NOT NULL,
		updated_at TIMESTAMP NOT NULL
	);

	CREATE TABLE IF NOT EXISTS audit_logs (
		id TEXT PRIMARY KEY,
		event_id TEXT UNIQUE NOT NULL,
		timestamp TIMESTAMP NOT NULL,
		agent_id TEXT NOT NULL,
		action TEXT NOT NULL,
		reasoning TEXT,
		gate_decision TEXT NOT NULL,
		gate_reason TEXT,
		rule_breakdown TEXT,
		order_id TEXT,
		amount_paise INTEGER NOT NULL DEFAULT 0,
		currency TEXT NOT NULL DEFAULT 'INR',
		idempotency_key TEXT,
		status TEXT NOT NULL,
		prev_hash TEXT,
		entry_hash TEXT
	);

	CREATE TABLE IF NOT EXISTS idempotency_records (
		idempotency_key TEXT PRIMARY KEY,
		agent_id TEXT NOT NULL,
		request_hash TEXT NOT NULL,
		status TEXT NOT NULL,
		response_code INTEGER,
		response_body TEXT,
		created_at TIMESTAMP NOT NULL,
		updated_at TIMESTAMP NOT NULL,
		expires_at TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS approvals (
		id TEXT PRIMARY KEY,
		order_id TEXT NOT NULL,
		agent_id TEXT NOT NULL,
		amount_paise INTEGER NOT NULL,
		currency TEXT NOT NULL DEFAULT 'INR',
		reason TEXT,
		status TEXT NOT NULL DEFAULT 'PENDING',
		reviewer TEXT,
		reviewed_at TIMESTAMP,
		created_at TIMESTAMP NOT NULL
	);

	CREATE TABLE IF NOT EXISTS products (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		category TEXT NOT NULL,
		description TEXT,
		price_paise INTEGER NOT NULL,
		currency TEXT NOT NULL DEFAULT 'INR',
		stock INTEGER NOT NULL DEFAULT 100,
		created_at TIMESTAMP NOT NULL
	);
	`
	_, err := s.db.Exec(schema)
	if err != nil {
		return err
	}

	// Seed products if empty
	return s.seedDefaultProducts()
}

func (s *DB) seedDefaultProducts() error {
	var count int
	err := s.db.QueryRow("SELECT COUNT(*) FROM products").Scan(&count)
	if err != nil || count > 0 {
		return err
	}

	now := time.Now().UTC()
	for _, p := range catalog.DefaultProducts() {
		_, err := s.db.Exec(`
			INSERT OR REPLACE INTO products (id, name, category, description, price_paise, currency, stock, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`, p.ID, p.Name, p.Category, p.Description, p.PricePaise, p.Currency, p.Stock, now)
		if err != nil {
			return err
		}
	}
	return nil
}

// SaveOrder inserts or updates an order.
func (s *DB) SaveOrder(o OrderRecord) error {
	_, err := s.db.Exec(`
		INSERT OR REPLACE INTO orders (
			id, agent_id, product_id, product_name, quantity,
			unit_price_paise, total_amount_paise, currency, status,
			idempotency_key, razorpay_order_id, razorpay_payment_id,
			reasoning, gate_verdict, gate_reason, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, o.ID, o.AgentID, o.ProductID, o.ProductName, o.Quantity,
		o.UnitPricePaise, o.TotalAmountPaise, o.Currency, o.Status,
		o.IdempotencyKey, o.RazorpayOrderID, o.RazorpayPaymentID,
		o.Reasoning, o.GateVerdict, o.GateReason, o.CreatedAt, o.UpdatedAt)
	return err
}

// GetOrder fetches an order by ID.
func (s *DB) GetOrder(id string) (*OrderRecord, error) {
	row := s.db.QueryRow(`
		SELECT id, agent_id, product_id, product_name, quantity,
			   unit_price_paise, total_amount_paise, currency, status,
			   idempotency_key, razorpay_order_id, razorpay_payment_id,
			   reasoning, gate_verdict, gate_reason, created_at, updated_at
		FROM orders WHERE id = ?
	`, id)

	var o OrderRecord
	err := row.Scan(&o.ID, &o.AgentID, &o.ProductID, &o.ProductName, &o.Quantity,
		&o.UnitPricePaise, &o.TotalAmountPaise, &o.Currency, &o.Status,
		&o.IdempotencyKey, &o.RazorpayOrderID, &o.RazorpayPaymentID,
		&o.Reasoning, &o.GateVerdict, &o.GateReason, &o.CreatedAt, &o.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &o, nil
}

// ListOrders returns recent orders.
func (s *DB) ListOrders(limit int) ([]OrderRecord, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := s.db.Query(`
		SELECT id, agent_id, product_id, product_name, quantity,
			   unit_price_paise, total_amount_paise, currency, status,
			   idempotency_key, razorpay_order_id, razorpay_payment_id,
			   reasoning, gate_verdict, gate_reason, created_at, updated_at
		FROM orders ORDER BY created_at DESC LIMIT ?
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []OrderRecord
	for rows.Next() {
		var o OrderRecord
		if err := rows.Scan(&o.ID, &o.AgentID, &o.ProductID, &o.ProductName, &o.Quantity,
			&o.UnitPricePaise, &o.TotalAmountPaise, &o.Currency, &o.Status,
			&o.IdempotencyKey, &o.RazorpayOrderID, &o.RazorpayPaymentID,
			&o.Reasoning, &o.GateVerdict, &o.GateReason, &o.CreatedAt, &o.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, o)
	}
	return list, nil
}

// SaveApproval stores an approval record.
func (s *DB) SaveApproval(a ApprovalRecord) error {
	_, err := s.db.Exec(`
		INSERT OR REPLACE INTO approvals (id, order_id, agent_id, amount_paise, currency, reason, status, reviewer, reviewed_at, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, a.ID, a.OrderID, a.AgentID, a.AmountPaise, a.Currency, a.Reason, a.Status, a.Reviewer, a.ReviewedAt, a.CreatedAt)
	return err
}

// GetApproval fetches an approval record by ID.
func (s *DB) GetApproval(id string) (*ApprovalRecord, error) {
	row := s.db.QueryRow(`
		SELECT id, order_id, agent_id, amount_paise, currency, reason, status, reviewer, reviewed_at, created_at
		FROM approvals WHERE id = ?
	`, id)

	var a ApprovalRecord
	err := row.Scan(&a.ID, &a.OrderID, &a.AgentID, &a.AmountPaise, &a.Currency, &a.Reason, &a.Status, &a.Reviewer, &a.ReviewedAt, &a.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

// ListPendingApprovals returns all approvals awaiting review.
func (s *DB) ListPendingApprovals() ([]ApprovalRecord, error) {
	rows, err := s.db.Query(`
		SELECT id, order_id, agent_id, amount_paise, currency, reason, status, reviewer, reviewed_at, created_at
		FROM approvals WHERE status = 'PENDING' ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []ApprovalRecord
	for rows.Next() {
		var a ApprovalRecord
		if err := rows.Scan(&a.ID, &a.OrderID, &a.AgentID, &a.AmountPaise, &a.Currency, &a.Reason, &a.Status, &a.Reviewer, &a.ReviewedAt, &a.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, a)
	}
	return list, nil
}

// AuditEntryRecord mirrors audit.Entry for persistence (kept dependency-free of the audit package).
type AuditEntryRecord struct {
	ID             string
	EventID        string
	Timestamp      time.Time
	AgentID        string
	Action         string
	Reasoning      string
	GateDecision   string
	GateReason     string
	RuleBreakdown  string
	OrderID        string
	AmountPaise    int64
	Currency       string
	IdempotencyKey string
	Status         string
	PrevHash       string
	EntryHash      string
}

// SaveAuditEntry persists a single hash-chained audit entry.
func (s *DB) SaveAuditEntry(e AuditEntryRecord) error {
	_, err := s.db.Exec(`
		INSERT OR REPLACE INTO audit_logs (
			id, event_id, timestamp, agent_id, action, reasoning,
			gate_decision, gate_reason, rule_breakdown, order_id,
			amount_paise, currency, idempotency_key, status, prev_hash, entry_hash
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, e.ID, e.EventID, e.Timestamp, e.AgentID, e.Action, e.Reasoning,
		e.GateDecision, e.GateReason, e.RuleBreakdown, e.OrderID,
		e.AmountPaise, e.Currency, e.IdempotencyKey, e.Status, e.PrevHash, e.EntryHash)
	return err
}

// LoadAuditChain returns all persisted audit entries in insertion order, for
// rebuilding the in-memory hash chain on restart and for offline verification.
func (s *DB) LoadAuditChain() ([]AuditEntryRecord, error) {
	rows, err := s.db.Query(`
		SELECT id, event_id, timestamp, agent_id, action, reasoning,
			   gate_decision, gate_reason, rule_breakdown, order_id,
			   amount_paise, currency, idempotency_key, status, prev_hash, entry_hash
		FROM audit_logs ORDER BY rowid ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []AuditEntryRecord
	for rows.Next() {
		var e AuditEntryRecord
		if err := rows.Scan(&e.ID, &e.EventID, &e.Timestamp, &e.AgentID, &e.Action, &e.Reasoning,
			&e.GateDecision, &e.GateReason, &e.RuleBreakdown, &e.OrderID,
			&e.AmountPaise, &e.Currency, &e.IdempotencyKey, &e.Status, &e.PrevHash, &e.EntryHash); err != nil {
			return nil, err
		}
		list = append(list, e)
	}
	return list, nil
}

// Close closes the database connection.
func (s *DB) Close() error {
	return s.db.Close()
}
