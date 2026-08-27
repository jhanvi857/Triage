package ptp

import (
	"testing"
	"time"
)

func TestPTPParser_DeterministicExtraction(t *testing.T) {
	refTime := time.Date(2026, 8, 27, 10, 0, 0, 0, time.UTC)

	// 1. "Bhai 5th ko debit karna"
	res1 := Parse("Bhai 5th ko debit karna", refTime)
	if !res1.PromiseDetected || res1.PromisedDate != "2026-09-05" {
		t.Errorf("expected 2026-09-05, got detected=%v date=%s (method=%s)", res1.PromiseDetected, res1.PromisedDate, res1.ParsingMethod)
	}

	// 2. Numeric slash date: "05/09/2026"
	res2 := Parse("Please debit on 05/09/2026", refTime)
	if !res2.PromiseDetected || res2.PromisedDate != "2026-09-05" {
		t.Errorf("expected 2026-09-05, got detected=%v date=%s", res2.PromiseDetected, res2.PromisedDate)
	}

	// 3. Month name date: "5 September"
	res3 := Parse("Retry on 5 September", refTime)
	if !res3.PromiseDetected || res3.PromisedDate != "2026-09-05" {
		t.Errorf("expected 2026-09-05, got detected=%v date=%s", res3.PromiseDetected, res3.PromisedDate)
	}

	// 4. Affirmation keyword: "haan"
	res4 := Parse("haan", refTime)
	if !res4.PromiseDetected {
		t.Errorf("expected affirmation promise detected, got false")
	}

	// 5. Relative day: "tomorrow"
	res5 := Parse("charge me tomorrow", refTime)
	if !res5.PromiseDetected || res5.PromisedDate != "2026-08-28" {
		t.Errorf("expected 2026-08-28, got detected=%v date=%s", res5.PromiseDetected, res5.PromisedDate)
	}

	// 6. Ambiguous natural language must be ESCALATED TO HUMAN (Zero LLM guessing)
	ambiguous := "Actually things are complicated, I'll probably be able to pay sometime after salary comes..."
	res6 := Parse(ambiguous, refTime)
	if res6.PromiseDetected || !res6.NeedsHumanReview {
		t.Errorf("expected ambiguous language to be escalated to human, got detected=%v needs_review=%v", res6.PromiseDetected, res6.NeedsHumanReview)
	}
}
