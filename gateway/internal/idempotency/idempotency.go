package idempotency

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"sync"
	"time"
)

// Idempotency status states.
const (
	StatusStarted    = "STARTED"
	StatusProcessing = "PROCESSING"
	StatusCompleted  = "COMPLETED"
	StatusFailed     = "FAILED"
)

var (
	ErrConflictInFlight    = errors.New("concurrent operation already in-flight for this idempotency key")
	ErrPayloadMismatch     = errors.New("idempotency key reused with different request payload")
	ErrKeyNotFound         = errors.New("idempotency key not found")
)

// Record holds the full cached state and outbox response for an idempotent transaction.
type Record struct {
	Key          string    `json:"key"`
	AgentID      string    `json:"agent_id"`
	RequestHash  string    `json:"request_hash"`
	Status       string    `json:"status"`
	ResponseCode int       `json:"response_code"`
	ResponseBody []byte    `json:"response_body"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
	ExpiresAt    time.Time `json:"expires_at"`
}

// Store provides atomic locking and caching of requests using the Evora outbox pattern.
type Store struct {
	mu      sync.RWMutex
	records map[string]*Record
	ttl     time.Duration
}

// NewStore creates a new in-memory idempotency store with default 24h TTL.
func NewStore(ttl time.Duration) *Store {
	if ttl <= 0 {
		ttl = 24 * time.Hour
	}
	return &Store{
		records: make(map[string]*Record),
		ttl:     ttl,
	}
}

// ComputeHash generates a deterministic SHA-256 hash of the request parameters.
func ComputeHash(parts ...string) string {
	hasher := sha256.New()
	for _, p := range parts {
		hasher.Write([]byte(p))
		hasher.Write([]byte("|"))
	}
	return hex.EncodeToString(hasher.Sum(nil))
}

// Acquire attempts to claim an idempotency key.
// Returns (record, isNew, err).
// If the key already exists in COMPLETED state and hashes match, it returns isNew=false without error (safe replay).
// If the key is currently PROCESSING, it returns ErrConflictInFlight.
// If the payload hash doesn't match the original, it returns ErrPayloadMismatch.
func (s *Store) Acquire(key string, agentID string, requestHash string) (*Record, bool, error) {
	if key == "" {
		return nil, false, errors.New("idempotency key cannot be empty")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	rec, exists := s.records[key]
	if exists {
		// Check hash match
		if rec.RequestHash != requestHash {
			return nil, false, fmt.Errorf("%w: original hash %s != current hash %s",
				ErrPayloadMismatch, rec.RequestHash, requestHash)
		}

		if rec.Status == StatusStarted || rec.Status == StatusProcessing {
			// Check if lock expired (e.g. crashed process after 2 minutes)
			if time.Since(rec.UpdatedAt) < 2*time.Minute {
				return rec, false, ErrConflictInFlight
			}
			// Stale lock reclamation
			rec.Status = StatusProcessing
			rec.UpdatedAt = time.Now().UTC()
			return rec, true, nil
		}

		// Completed or Failed replay
		return rec, false, nil
	}

	now := time.Now().UTC()
	newRecord := &Record{
		Key:         key,
		AgentID:     agentID,
		RequestHash: requestHash,
		Status:      StatusProcessing,
		CreatedAt:   now,
		UpdatedAt:   now,
		ExpiresAt:   now.Add(s.ttl),
	}
	s.records[key] = newRecord
	return newRecord, true, nil
}

// Complete marks an idempotency key as COMPLETED and persists the exact response body.
func (s *Store) Complete(key string, statusCode int, responseBody []byte) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	rec, exists := s.records[key]
	if !exists {
		return ErrKeyNotFound
	}

	rec.Status = StatusCompleted
	rec.ResponseCode = statusCode
	rec.ResponseBody = responseBody
	rec.UpdatedAt = time.Now().UTC()
	return nil
}

// Fail marks an idempotency key as FAILED and saves the error payload.
func (s *Store) Fail(key string, statusCode int, responseBody []byte) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	rec, exists := s.records[key]
	if !exists {
		return ErrKeyNotFound
	}

	rec.Status = StatusFailed
	rec.ResponseCode = statusCode
	rec.ResponseBody = responseBody
	rec.UpdatedAt = time.Now().UTC()
	return nil
}

// Get fetches a record by key.
func (s *Store) Get(key string) (*Record, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	rec, exists := s.records[key]
	if !exists {
		return nil, ErrKeyNotFound
	}
	return rec, nil
}

// ListRecent returns snapshot list of all idempotency records.
func (s *Store) ListRecent() []*Record {
	s.mu.RLock()
	defer s.mu.RUnlock()

	list := make([]*Record, 0, len(s.records))
	for _, r := range s.records {
		cp := *r
		list = append(list, &cp)
	}
	return list
}
