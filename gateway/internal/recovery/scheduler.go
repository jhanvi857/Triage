package recovery

import (
	"sync"
	"time"
)

// ScheduledStep represents a recovery step awaiting execution
type ScheduledStep struct {
	CaseID         string    `json:"case_id"`
	StepIndex      int       `json:"step_index"`
	Action         string    `json:"action"`
	ScheduledAt    time.Time `json:"scheduled_at"`
	IdempotencyKey string    `json:"idempotency_key"`
	Cancelled      bool      `json:"cancelled"`
	Executed       bool      `json:"executed"`
}

// Scheduler manages pending recovery plan steps with deterministic time control
type Scheduler struct {
	mu          sync.RWMutex
	pending     []*ScheduledStep
	simNow      time.Time // Simulated clock for demo/test; zero value means use real time
	timeAdvanced bool
}

// NewScheduler creates a new recovery step scheduler
func NewScheduler() *Scheduler {
	return &Scheduler{
		pending: make([]*ScheduledStep, 0),
	}
}

// Now returns the current time (simulated or real)
func (s *Scheduler) Now() time.Time {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.timeAdvanced {
		return s.simNow
	}
	return time.Now().UTC()
}

// AdvanceTime moves the simulated clock forward by the given duration
func (s *Scheduler) AdvanceTime(d time.Duration) time.Time {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.timeAdvanced {
		s.simNow = time.Now().UTC()
		s.timeAdvanced = true
	}
	s.simNow = s.simNow.Add(d)
	return s.simNow
}

// SetTime sets the simulated clock to a specific time
func (s *Scheduler) SetTime(t time.Time) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.simNow = t
	s.timeAdvanced = true
}

// ResetTime disables simulated time and returns to real clock
func (s *Scheduler) ResetTime() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.timeAdvanced = false
	s.simNow = time.Time{}
}

// Schedule adds a step to the pending queue
func (s *Scheduler) Schedule(step *ScheduledStep) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.pending = append(s.pending, step)
}

// SchedulePlan schedules all pending steps from a recovery plan
func (s *Scheduler) SchedulePlan(plan *RecoveryPlan) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range plan.Steps {
		step := &plan.Steps[i]
		if step.Status == StepPending {
			s.pending = append(s.pending, &ScheduledStep{
				CaseID:         plan.CaseID,
				StepIndex:      step.StepIndex,
				Action:         step.Action,
				ScheduledAt:    step.ScheduledAt,
				IdempotencyKey: step.IdempotencyKey,
			})
		}
	}
}

// GetDueSteps returns all steps where ScheduledAt <= now and not cancelled/executed
func (s *Scheduler) GetDueSteps() []*ScheduledStep {
	s.mu.RLock()
	defer s.mu.RUnlock()
	now := s.now()

	var due []*ScheduledStep
	for _, step := range s.pending {
		if !step.Cancelled && !step.Executed && !step.ScheduledAt.After(now) {
			due = append(due, step)
		}
	}
	return due
}

// GetPendingSteps returns all non-cancelled, non-executed steps
func (s *Scheduler) GetPendingSteps() []*ScheduledStep {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*ScheduledStep
	for _, step := range s.pending {
		if !step.Cancelled && !step.Executed {
			result = append(result, step)
		}
	}
	return result
}

// MarkExecuted marks a scheduled step as executed
func (s *Scheduler) MarkExecuted(caseID string, stepIndex int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, step := range s.pending {
		if step.CaseID == caseID && step.StepIndex == stepIndex {
			step.Executed = true
			return
		}
	}
}

// CancelCase cancels all pending steps for a case
func (s *Scheduler) CancelCase(caseID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, step := range s.pending {
		if step.CaseID == caseID {
			step.Cancelled = true
		}
	}
}

// GetNextDueStep returns the single next step due for a specific case
func (s *Scheduler) GetNextDueStep(caseID string) *ScheduledStep {
	s.mu.RLock()
	defer s.mu.RUnlock()
	now := s.now()

	for _, step := range s.pending {
		if step.CaseID == caseID && !step.Cancelled && !step.Executed && !step.ScheduledAt.After(now) {
			return step
		}
	}
	return nil
}

// now returns the current clock value (internal, no lock)
func (s *Scheduler) now() time.Time {
	if s.timeAdvanced {
		return s.simNow
	}
	return time.Now().UTC()
}
