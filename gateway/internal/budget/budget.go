package budget

import (
	"errors"
	"fmt"
	"sync"
	"time"
)

var (
	ErrBucketNotFound = errors.New("budget bucket not found")
)

// ErrInsufficientBudget is returned when an agent requests more than its available spend budget.
type ErrInsufficientBudget struct {
	AgentID        string `json:"agent_id"`
	RequiredPaise  int64  `json:"required_paise"`
	AvailablePaise int64  `json:"available_paise"`
	CapacityPaise  int64  `json:"capacity_paise"`
	Currency       string `json:"currency"`
}

func (e *ErrInsufficientBudget) Error() string {
	return fmt.Sprintf("insufficient budget for agent '%s': requested %d %s (%.2f INR), available %d %s (%.2f INR) out of %d %s (%.2f INR) capacity",
		e.AgentID, e.RequiredPaise, e.Currency, float64(e.RequiredPaise)/100.0,
		e.AvailablePaise, e.Currency, float64(e.AvailablePaise)/100.0,
		e.CapacityPaise, e.Currency, float64(e.CapacityPaise)/100.0)
}

// TokenBucket represents an agent's spend-budget token bucket state.
type TokenBucket struct {
	AgentID               string    `json:"agent_id"`
	CapacityPaise         int64     `json:"capacity_paise"`
	RemainingPaise        int64     `json:"remaining_paise"`
	SpentPaise            int64     `json:"spent_paise"`
	ReservedPaise         int64     `json:"reserved_paise"`
	Currency              string    `json:"currency"`
	RefillRatePaisePerSec int64     `json:"refill_rate_paise_per_sec"`
	LastRefillAt          time.Time `json:"last_refill_at"`
	CreatedAt             time.Time `json:"created_at"`
	UpdatedAt             time.Time `json:"updated_at"`
	mu                    sync.RWMutex
}

// Reservation tracks an in-flight hold on spend tokens before payment confirmation.
type Reservation struct {
	ID          string
	AgentID     string
	AmountPaise int64
	ExpiresAt   time.Time
}

// Manager coordinates token buckets across agents with thread safety.
type Manager struct {
	mu           sync.RWMutex
	buckets      map[string]*TokenBucket
	reservations map[string]*Reservation
	defaultCap   int64
}

// NewManager creates an in-memory budget manager (syncable with storage).
func NewManager(defaultCapacityPaise int64) *Manager {
	if defaultCapacityPaise <= 0 {
		defaultCapacityPaise = 1000000 // default ₹10,000.00
	}
	return &Manager{
		buckets:      make(map[string]*TokenBucket),
		reservations: make(map[string]*Reservation),
		defaultCap:   defaultCapacityPaise,
	}
}

// GetOrCreateBucket retrieves the token bucket for an agent or initializes a new one.
func (m *Manager) GetOrCreateBucket(agentID string) *TokenBucket {
	m.mu.Lock()
	defer m.mu.Unlock()

	bucket, exists := m.buckets[agentID]
	if !exists {
		now := time.Now().UTC()
		bucket = &TokenBucket{
			AgentID:               agentID,
			CapacityPaise:         m.defaultCap,
			RemainingPaise:        m.defaultCap,
			SpentPaise:            0,
			ReservedPaise:         0,
			Currency:              "INR",
			RefillRatePaisePerSec: 0,
			LastRefillAt:          now,
			CreatedAt:             now,
			UpdatedAt:             now,
		}
		m.buckets[agentID] = bucket
	}
	return bucket
}

// Reserve atomically reserves budget tokens for a pending transaction.
func (m *Manager) Reserve(agentID string, reservationID string, amountPaise int64) error {
	if amountPaise <= 0 {
		return fmt.Errorf("invalid reserve amount: %d", amountPaise)
	}

	bucket := m.GetOrCreateBucket(agentID)
	bucket.mu.Lock()
	defer bucket.mu.Unlock()

	m.refillBucketLocked(bucket)

	available := bucket.RemainingPaise - bucket.ReservedPaise
	if available < amountPaise {
		return &ErrInsufficientBudget{
			AgentID:        agentID,
			RequiredPaise:  amountPaise,
			AvailablePaise: available,
			CapacityPaise:  bucket.CapacityPaise,
			Currency:       bucket.Currency,
		}
	}

	bucket.ReservedPaise += amountPaise
	bucket.UpdatedAt = time.Now().UTC()

	m.mu.Lock()
	m.reservations[reservationID] = &Reservation{
		ID:          reservationID,
		AgentID:     agentID,
		AmountPaise: amountPaise,
		ExpiresAt:   time.Now().UTC().Add(10 * time.Minute),
	}
	m.mu.Unlock()

	return nil
}

// Commit finalizes a reservation after successful payment, deducting from remaining and increasing spent.
func (m *Manager) Commit(agentID string, reservationID string, amountPaise int64) error {
	bucket := m.GetOrCreateBucket(agentID)
	bucket.mu.Lock()
	defer bucket.mu.Unlock()

	m.mu.Lock()
	res, exists := m.reservations[reservationID]
	if exists {
		delete(m.reservations, reservationID)
	}
	m.mu.Unlock()

	if exists && res.AmountPaise > 0 {
		bucket.ReservedPaise -= res.AmountPaise
		if bucket.ReservedPaise < 0 {
			bucket.ReservedPaise = 0
		}
	}

	if bucket.RemainingPaise < amountPaise {
		bucket.RemainingPaise = 0
	} else {
		bucket.RemainingPaise -= amountPaise
	}
	bucket.SpentPaise += amountPaise
	bucket.UpdatedAt = time.Now().UTC()

	return nil
}

// Release cancels a reservation and restores reserved tokens back to available pool.
func (m *Manager) Release(agentID string, reservationID string) error {
	bucket := m.GetOrCreateBucket(agentID)
	bucket.mu.Lock()
	defer bucket.mu.Unlock()

	m.mu.Lock()
	res, exists := m.reservations[reservationID]
	if exists {
		delete(m.reservations, reservationID)
	}
	m.mu.Unlock()

	if exists {
		bucket.ReservedPaise -= res.AmountPaise
		if bucket.ReservedPaise < 0 {
			bucket.ReservedPaise = 0
		}
		bucket.UpdatedAt = time.Now().UTC()
	}

	return nil
}

// Reset resets an agent's spend budget back to the specified or default capacity.
func (m *Manager) Reset(agentID string, newCapPaise int64) *TokenBucket {
	bucket := m.GetOrCreateBucket(agentID)
	bucket.mu.Lock()
	defer bucket.mu.Unlock()

	if newCapPaise <= 0 {
		newCapPaise = m.defaultCap
	}

	now := time.Now().UTC()
	bucket.CapacityPaise = newCapPaise
	bucket.RemainingPaise = newCapPaise
	bucket.SpentPaise = 0
	bucket.ReservedPaise = 0
	bucket.LastRefillAt = now
	bucket.UpdatedAt = now

	return bucket
}

// Refill adds a specific amount of paise to the bucket up to its maximum capacity.
func (m *Manager) Refill(agentID string, addPaise int64) *TokenBucket {
	bucket := m.GetOrCreateBucket(agentID)
	bucket.mu.Lock()
	defer bucket.mu.Unlock()

	bucket.RemainingPaise += addPaise
	if bucket.RemainingPaise > bucket.CapacityPaise {
		bucket.RemainingPaise = bucket.CapacityPaise
	}
	bucket.UpdatedAt = time.Now().UTC()
	return bucket
}

// GetSnapshot returns a snapshot copy of the current bucket state.
func (m *Manager) GetSnapshot(agentID string) TokenBucket {
	bucket := m.GetOrCreateBucket(agentID)
	bucket.mu.RLock()
	defer bucket.mu.RUnlock()

	return TokenBucket{
		AgentID:               bucket.AgentID,
		CapacityPaise:         bucket.CapacityPaise,
		RemainingPaise:        bucket.RemainingPaise,
		SpentPaise:            bucket.SpentPaise,
		ReservedPaise:         bucket.ReservedPaise,
		Currency:              bucket.Currency,
		RefillRatePaisePerSec: bucket.RefillRatePaisePerSec,
		LastRefillAt:          bucket.LastRefillAt,
		CreatedAt:             bucket.CreatedAt,
		UpdatedAt:             bucket.UpdatedAt,
	}
}

// ListAllSnapshots returns states of all tracked agent token buckets.
func (m *Manager) ListAllSnapshots() []TokenBucket {
	m.mu.RLock()
	defer m.mu.RUnlock()

	list := make([]TokenBucket, 0, len(m.buckets))
	for _, b := range m.buckets {
		b.mu.RLock()
		list = append(list, TokenBucket{
			AgentID:               b.AgentID,
			CapacityPaise:         b.CapacityPaise,
			RemainingPaise:        b.RemainingPaise,
			SpentPaise:            b.SpentPaise,
			ReservedPaise:         b.ReservedPaise,
			Currency:              b.Currency,
			RefillRatePaisePerSec: b.RefillRatePaisePerSec,
			LastRefillAt:          b.LastRefillAt,
			CreatedAt:             b.CreatedAt,
			UpdatedAt:             b.UpdatedAt,
		})
		b.mu.RUnlock()
	}
	return list
}

func (m *Manager) refillBucketLocked(bucket *TokenBucket) {
	if bucket.RefillRatePaisePerSec <= 0 {
		return
	}
	now := time.Now().UTC()
	elapsed := now.Sub(bucket.LastRefillAt).Seconds()
	if elapsed >= 1.0 {
		added := int64(elapsed) * bucket.RefillRatePaisePerSec
		bucket.RemainingPaise += added
		if bucket.RemainingPaise > bucket.CapacityPaise {
			bucket.RemainingPaise = bucket.CapacityPaise
		}
		bucket.LastRefillAt = now
	}
}
