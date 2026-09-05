package audit

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/ledger/gateway/internal/storage"
)

// Audit actions.
const (
	ActionPurchaseInitiated    = "PURCHASE_INITIATED"
	ActionGateEvaluation       = "GATE_EVALUATION"
	ActionApprovalRequested    = "APPROVAL_REQUESTED"
	ActionApprovalGranted      = "APPROVAL_GRANTED"
	ActionApprovalRejected     = "APPROVAL_REJECTED"
	ActionRazorpayOrderCreated = "RAZORPAY_ORDER_CREATED"
	ActionPaymentCaptured      = "PAYMENT_CAPTURED"
	ActionPaymentFailed        = "PAYMENT_FAILED"
	ActionOverBudgetRejected   = "OVER_BUDGET_REJECTED"
	ActionIdempotencyReplay    = "IDEMPOTENCY_REPLAY"
	ActionBudgetReset          = "BUDGET_RESET"
)

// Entry is an immutable, hash-chained record in the Ledger audit trail.
type Entry struct {
	ID             string    `json:"id"`
	EventID        string    `json:"event_id"`
	Timestamp      time.Time `json:"timestamp"`
	AgentID        string    `json:"agent_id"`
	Action         string    `json:"action"`
	Reasoning      string    `json:"reasoning"`
	GateDecision   string    `json:"gate_decision"`
	GateReason     string    `json:"gate_reason"`
	RuleBreakdown  string    `json:"rule_breakdown,omitempty"`
	OrderID        string    `json:"order_id,omitempty"`
	AmountPaise    int64     `json:"amount_paise"`
	Currency       string    `json:"currency"`
	IdempotencyKey string    `json:"idempotency_key,omitempty"`
	Status         string    `json:"status"`
	PrevHash       string    `json:"prev_hash"`
	EntryHash      string    `json:"entry_hash"`
}

// Filter params for querying the audit log.
type Filter struct {
	AgentID      string
	Action       string
	GateDecision string
	Limit        int
}

// Logger maintains the append-only audit trail and live SSE subscriber fan-out.
type Logger struct {
	mu          sync.RWMutex
	entries     []Entry
	lastHash    string
	subscribers map[chan Entry]struct{}
	subMu       sync.RWMutex
	db          *storage.DB
}

// AttachDB wires a SQLite-backed store so entries survive a process restart.
// Safe to call once at startup; persistence is best-effort and never blocks
// or fails a request if the write errors.
func (l *Logger) AttachDB(db *storage.DB) {
	l.mu.Lock()
	l.db = db
	l.mu.Unlock()
}

// LoadFromDB rebuilds the in-memory hash chain from persisted entries, so a
// restarted gateway resumes the same chain instead of starting a new one.
// Call once at startup, after AttachDB, before serving traffic.
func (l *Logger) LoadFromDB() error {
	if l.db == nil {
		return nil
	}
	records, err := l.db.LoadAuditChain()
	if err != nil {
		return err
	}

	l.mu.Lock()
	defer l.mu.Unlock()
	for _, r := range records {
		l.entries = append(l.entries, Entry{
			ID: r.ID, EventID: r.EventID, Timestamp: r.Timestamp, AgentID: r.AgentID,
			Action: r.Action, Reasoning: r.Reasoning, GateDecision: r.GateDecision,
			GateReason: r.GateReason, RuleBreakdown: r.RuleBreakdown, OrderID: r.OrderID,
			AmountPaise: r.AmountPaise, Currency: r.Currency, IdempotencyKey: r.IdempotencyKey,
			Status: r.Status, PrevHash: r.PrevHash, EntryHash: r.EntryHash,
		})
		l.lastHash = r.EntryHash
	}
	return nil
}

// NewLogger creates a new hash-chained audit logger.
func NewLogger() *Logger {
	return &Logger{
		entries:     make([]Entry, 0),
		lastHash:    "0000000000000000000000000000000000000000000000000000000000000000",
		subscribers: make(map[chan Entry]struct{}),
	}
}

// Append creates, hash-chains, stores, and broadcasts a new audit log entry.
func (l *Logger) Append(e Entry) Entry {
	l.mu.Lock()
	defer l.mu.Unlock()

	if e.ID == "" {
		e.ID = uuid.New().String()
	}
	if e.EventID == "" {
		e.EventID = fmt.Sprintf("evt_%s", uuid.New().String()[:12])
	}
	if e.Timestamp.IsZero() {
		e.Timestamp = time.Now().UTC()
	}
	if e.Currency == "" {
		e.Currency = "INR"
	}

	e.PrevHash = l.lastHash
	e.EntryHash = l.calculateHash(e)
	l.lastHash = e.EntryHash

	l.entries = append(l.entries, e)
	db := l.db

	// Broadcast asynchronously to all active SSE subscribers
	go l.broadcast(e)

	// Persist synchronously so the caller can trust the entry survived a
	// restart before it returns. Best-effort: a write failure is logged,
	// not fatal, since the in-memory chain is already authoritative for
	// the current process.
	if db != nil {
		if err := db.SaveAuditEntry(storage.AuditEntryRecord{
			ID: e.ID, EventID: e.EventID, Timestamp: e.Timestamp, AgentID: e.AgentID,
			Action: e.Action, Reasoning: e.Reasoning, GateDecision: e.GateDecision,
			GateReason: e.GateReason, RuleBreakdown: e.RuleBreakdown, OrderID: e.OrderID,
			AmountPaise: e.AmountPaise, Currency: e.Currency, IdempotencyKey: e.IdempotencyKey,
			Status: e.Status, PrevHash: e.PrevHash, EntryHash: e.EntryHash,
		}); err != nil {
			log.Printf("[WARN] audit entry %s not persisted to SQLite: %v", e.EventID, err)
		}
	}

	return e
}

func (l *Logger) calculateHash(e Entry) string {
	hasher := sha256.New()
	hasher.Write([]byte(e.PrevHash))
	hasher.Write([]byte("|"))
	hasher.Write([]byte(e.EventID))
	hasher.Write([]byte("|"))
	hasher.Write([]byte(e.Timestamp.Format(time.RFC3339Nano)))
	hasher.Write([]byte("|"))
	hasher.Write([]byte(e.AgentID))
	hasher.Write([]byte("|"))
	hasher.Write([]byte(e.Action))
	hasher.Write([]byte("|"))
	hasher.Write([]byte(e.Reasoning))
	hasher.Write([]byte("|"))
	hasher.Write([]byte(e.GateDecision))
	hasher.Write([]byte("|"))
	hasher.Write([]byte(e.GateReason))
	hasher.Write([]byte("|"))
	hasher.Write([]byte(fmt.Sprintf("%d", e.AmountPaise)))
	hasher.Write([]byte("|"))
	hasher.Write([]byte(e.OrderID))
	hasher.Write([]byte("|"))
	hasher.Write([]byte(e.Status))

	return hex.EncodeToString(hasher.Sum(nil))
}

func (l *Logger) broadcast(e Entry) {
	l.subMu.RLock()
	defer l.subMu.RUnlock()

	for ch := range l.subscribers {
		select {
		case ch <- e:
		default:
			// Non-blocking drop if client is saturated
		}
	}
}

// Subscribe registers a new listener channel for live SSE event streaming.
func (l *Logger) Subscribe() chan Entry {
	l.subMu.Lock()
	defer l.subMu.Unlock()

	ch := make(chan Entry, 64)
	l.subscribers[ch] = struct{}{}
	return ch
}

// Unsubscribe removes an SSE subscriber channel.
func (l *Logger) Unsubscribe(ch chan Entry) {
	l.subMu.Lock()
	defer l.subMu.Unlock()

	if _, exists := l.subscribers[ch]; exists {
		delete(l.subscribers, ch)
		close(ch)
	}
}

// Query returns entries matching the given filter in reverse chronological order.
func (l *Logger) Query(f Filter) []Entry {
	l.mu.RLock()
	defer l.mu.RUnlock()

	var result []Entry
	for i := len(l.entries) - 1; i >= 0; i-- {
		e := l.entries[i]
		if f.AgentID != "" && e.AgentID != f.AgentID {
			continue
		}
		if f.Action != "" && e.Action != f.Action {
			continue
		}
		if f.GateDecision != "" && e.GateDecision != f.GateDecision {
			continue
		}
		result = append(result, e)
		if f.Limit > 0 && len(result) >= f.Limit {
			break
		}
	}
	return result
}

// VerifyIntegrity traverses the hash chain and verifies all cryptographic proofs.
func (l *Logger) VerifyIntegrity() (bool, int, error) {
	l.mu.RLock()
	defer l.mu.RUnlock()

	expectedPrev := "0000000000000000000000000000000000000000000000000000000000000000"
	for idx, e := range l.entries {
		if e.PrevHash != expectedPrev {
			return false, idx, fmt.Errorf("hash chain broken at index %d: expected prev %s, got %s",
				idx, expectedPrev, e.PrevHash)
		}
		computedHash := l.calculateHash(e)
		if e.EntryHash != computedHash {
			return false, idx, fmt.Errorf("tampered entry hash at index %d: stored %s, computed %s",
				idx, e.EntryHash, computedHash)
		}
		expectedPrev = e.EntryHash
	}
	return true, len(l.entries), nil
}

// Count returns total number of logged entries.
func (l *Logger) Count() int {
	l.mu.RLock()
	defer l.mu.RUnlock()
	return len(l.entries)
}

// Helper to serialize rule breakdown to JSON string.
func EncodeRuleBreakdown(v interface{}) string {
	b, err := json.Marshal(v)
	if err != nil {
		return "{}"
	}
	return string(b)
}
