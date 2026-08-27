package ptp

import (
	"regexp"
	"strconv"
	"strings"
	"time"
)

// ParseResult holds the deterministic PTP extraction outcome
type ParseResult struct {
	OriginalMessage  string  `json:"original_message"`
	PromiseDetected  bool    `json:"promise_detected"`
	PromisedDate     string  `json:"promised_date,omitempty"` // Format: "YYYY-MM-DD"
	PromisedTime     string  `json:"promised_time,omitempty"` // RFC3339 format
	ParsingMethod    string  `json:"parsing_method"`          // "NUMERIC_DATE_REGEX", "ORDINAL_DATE_REGEX", "RELATIVE_DAY_REGEX", "AFFIRMATION_KEYWORD", "UNKNOWN_ESCALATION"
	NeedsHumanReview bool    `json:"needs_human_review"`
	EscalationReason string  `json:"escalation_reason,omitempty"`
	ConfidenceScore  float64 `json:"confidence_score"`
}

// Regex patterns for deterministic extraction
var (
	// 1. Explicit Numeric Date: 05/09/2026, 5/9/26, 2026-09-05, 05-09-2026
	reDateSlash = regexp.MustCompile(`\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b`)
	reDateISO   = regexp.MustCompile(`\b(\d{4})-(\d{1,2})-(\d{1,2})\b`)

	// 2. Month name patterns: "5th September", "5 Sep", "September 5", "5th of Sep"
	reMonthDay1 = regexp.MustCompile(`(?i)\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b`)
	reMonthDay2 = regexp.MustCompile(`(?i)\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?\b`)

	// 3. Ordinal day patterns: "5th ko debit karna", "pay on 10th", "5th"
	reOrdinalDay = regexp.MustCompile(`(?i)\b(\d{1,2})(?:st|nd|rd|th)\b`)

	// 4. Relative days: "tomorrow", "day after tomorrow", "today", "kal", "parso"
	reRelativeDay = regexp.MustCompile(`(?i)\b(tomorrow|day after tomorrow|today|kal|parso)\b`)

	// 5. Day of week: "on Monday", "next Monday", "this Friday"
	reDayOfWeek = regexp.MustCompile(`(?i)\b(?:(next|this|on)\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|somwar|mangalwar|budhwar|guruwar|shukrawar|shaniwar|ravivar)\b`)

	// 6. Simple confirmations
	reAffirmation = regexp.MustCompile(`(?i)^(yes|haan|ha|ok|okay|sure|done|yep|agree|thik hai|theek hai|kardo|kar do|debit it)[!.]?$`)

	// 7. Ambiguous/hedging patterns indicating natural language that MUST be escalated
	reAmbiguousHedging = regexp.MustCompile(`(?i)\b(probably|maybe|might|complicated|salary comes|not sure|issue|problem|sometime|difficult|financial|help|depend|doubt)\b`)
)

var monthMap = map[string]time.Month{
	"jan": time.January, "january": time.January,
	"feb": time.February, "february": time.February,
	"mar": time.March, "march": time.March,
	"apr": time.April, "april": time.April,
	"may": time.May,
	"jun": time.June, "june": time.June,
	"jul": time.July, "july": time.July,
	"aug": time.August, "august": time.August,
	"sep": time.September, "sept": time.September, "september": time.September,
	"oct": time.October, "october": time.October,
	"nov": time.November, "november": time.November,
	"dec": time.December, "december": time.December,
}

var weekdayMap = map[string]time.Weekday{
	"monday": time.Monday, "somwar": time.Monday,
	"tuesday": time.Tuesday, "mangalwar": time.Tuesday,
	"wednesday": time.Wednesday, "budhwar": time.Wednesday,
	"thursday": time.Thursday, "guruwar": time.Thursday,
	"friday": time.Friday, "shukrawar": time.Friday,
	"saturday": time.Saturday, "shaniwar": time.Saturday,
	"sunday": time.Sunday, "ravivar": time.Sunday,
}

// Parse extracts a deterministic promise-to-pay date or escalates ambiguous language to human agents
func Parse(msg string, baseTime ...time.Time) ParseResult {
	now := time.Now().UTC()
	if len(baseTime) > 0 && !baseTime[0].IsZero() {
		now = baseTime[0].UTC()
	}

	cleanMsg := strings.TrimSpace(msg)
	if cleanMsg == "" {
		return ParseResult{
			OriginalMessage:  msg,
			PromiseDetected:  false,
			ParsingMethod:    "UNKNOWN_ESCALATION",
			NeedsHumanReview: true,
			EscalationReason: "Empty or whitespace message",
			ConfidenceScore:  0.0,
		}
	}

	// Immediate Safety Guard: Detect hedging / complex reasoning language -> Escalate to human
	if reAmbiguousHedging.MatchString(cleanMsg) && len(cleanMsg) > 25 {
		return ParseResult{
			OriginalMessage:  cleanMsg,
			PromiseDetected:  false,
			ParsingMethod:    "UNKNOWN_ESCALATION",
			NeedsHumanReview: true,
			EscalationReason: "Ambiguous natural-language statement detected. Escalated to human retention desk for review.",
			ConfidenceScore:  0.0,
		}
	}

	// 1. Check ISO Date: YYYY-MM-DD
	if m := reDateISO.FindStringSubmatch(cleanMsg); len(m) == 4 {
		year, _ := strconv.Atoi(m[1])
		month, _ := strconv.Atoi(m[2])
		day, _ := strconv.Atoi(m[3])
		t := time.Date(year, time.Month(month), day, 10, 0, 0, 0, time.UTC)
		return ParseResult{
			OriginalMessage: cleanMsg,
			PromiseDetected: true,
			PromisedDate:    t.Format("2006-01-02"),
			PromisedTime:    t.Format(time.RFC3339),
			ParsingMethod:   "NUMERIC_DATE_REGEX",
			ConfidenceScore: 1.0,
		}
	}

	// 2. Check Slash/Dash Date: DD/MM/YYYY or DD/MM/YY
	if m := reDateSlash.FindStringSubmatch(cleanMsg); len(m) == 4 {
		day, _ := strconv.Atoi(m[1])
		month, _ := strconv.Atoi(m[2])
		year, _ := strconv.Atoi(m[3])
		if year < 100 {
			year += 2000
		}
		if month >= 1 && month <= 12 && day >= 1 && day <= 31 {
			t := time.Date(year, time.Month(month), day, 10, 0, 0, 0, time.UTC)
			return ParseResult{
				OriginalMessage: cleanMsg,
				PromiseDetected: true,
				PromisedDate:    t.Format("2006-01-02"),
				PromisedTime:    t.Format(time.RFC3339),
				ParsingMethod:   "NUMERIC_DATE_REGEX",
				ConfidenceScore: 1.0,
			}
		}
	}

	// 3. Check Named Month Day: "5th September"
	if m := reMonthDay1.FindStringSubmatch(cleanMsg); len(m) == 3 {
		day, _ := strconv.Atoi(m[1])
		mName := strings.ToLower(m[2])
		if monthVal, ok := monthMap[mName]; ok {
			year := now.Year()
			t := time.Date(year, monthVal, day, 10, 0, 0, 0, time.UTC)
			if t.Before(now.Truncate(24 * time.Hour)) {
				t = t.AddDate(1, 0, 0)
			}
			return ParseResult{
				OriginalMessage: cleanMsg,
				PromiseDetected: true,
				PromisedDate:    t.Format("2006-01-02"),
				PromisedTime:    t.Format(time.RFC3339),
				ParsingMethod:   "MONTH_NAME_REGEX",
				ConfidenceScore: 0.98,
			}
		}
	}

	// 4. Check Named Month Day: "September 5"
	if m := reMonthDay2.FindStringSubmatch(cleanMsg); len(m) == 3 {
		mName := strings.ToLower(m[1])
		day, _ := strconv.Atoi(m[2])
		if monthVal, ok := monthMap[mName]; ok {
			year := now.Year()
			t := time.Date(year, monthVal, day, 10, 0, 0, 0, time.UTC)
			if t.Before(now.Truncate(24 * time.Hour)) {
				t = t.AddDate(1, 0, 0)
			}
			return ParseResult{
				OriginalMessage: cleanMsg,
				PromiseDetected: true,
				PromisedDate:    t.Format("2006-01-02"),
				PromisedTime:    t.Format(time.RFC3339),
				ParsingMethod:   "MONTH_NAME_REGEX",
				ConfidenceScore: 0.98,
			}
		}
	}

	// 5. Check Ordinal Day: "5th ko debit karna", "10th"
	if m := reOrdinalDay.FindStringSubmatch(cleanMsg); len(m) == 2 {
		day, _ := strconv.Atoi(m[1])
		if day >= 1 && day <= 31 {
			// Schedule for current month, or next month if already passed
			t := time.Date(now.Year(), now.Month(), day, 10, 0, 0, 0, time.UTC)
			if t.Before(now.Truncate(24 * time.Hour)) {
				t = time.Date(now.Year(), now.Month()+1, day, 10, 0, 0, 0, time.UTC)
			}
			return ParseResult{
				OriginalMessage: cleanMsg,
				PromiseDetected: true,
				PromisedDate:    t.Format("2006-01-02"),
				PromisedTime:    t.Format(time.RFC3339),
				ParsingMethod:   "ORDINAL_DAY_REGEX",
				ConfidenceScore: 0.95,
			}
		}
	}

	// 6. Check Relative Day: "tomorrow", "day after tomorrow", "today"
	if m := reRelativeDay.FindStringSubmatch(cleanMsg); len(m) == 2 {
		rel := strings.ToLower(m[1])
		var t time.Time
		switch rel {
		case "today":
			t = now.Add(4 * time.Hour)
		case "tomorrow", "kal":
			t = now.AddDate(0, 0, 1)
		case "day after tomorrow", "parso":
			t = now.AddDate(0, 0, 2)
		}
		return ParseResult{
			OriginalMessage: cleanMsg,
			PromiseDetected: true,
			PromisedDate:    t.Format("2006-01-02"),
			PromisedTime:    t.Format(time.RFC3339),
			ParsingMethod:   "RELATIVE_DAY_REGEX",
			ConfidenceScore: 0.95,
		}
	}

	// 7. Check Day of Week: "on Monday", "next Monday"
	if m := reDayOfWeek.FindStringSubmatch(cleanMsg); len(m) == 3 {
		prefix := strings.ToLower(m[1])
		wName := strings.ToLower(m[2])
		if targetWeekday, ok := weekdayMap[wName]; ok {
			daysUntil := (int(targetWeekday) - int(now.Weekday()) + 7) % 7
			if daysUntil == 0 || prefix == "next" {
				daysUntil += 7
			}
			t := now.AddDate(0, 0, daysUntil)
			return ParseResult{
				OriginalMessage: cleanMsg,
				PromiseDetected: true,
				PromisedDate:    t.Format("2006-01-02"),
				PromisedTime:    t.Format(time.RFC3339),
				ParsingMethod:   "DAY_OF_WEEK_REGEX",
				ConfidenceScore: 0.92,
			}
		}
	}

	// 8. Check Affirmation: "yes", "haan", "ok"
	if reAffirmation.MatchString(cleanMsg) {
		t := now.AddDate(0, 0, 1) // Default to next-day retry upon affirmation
		return ParseResult{
			OriginalMessage: cleanMsg,
			PromiseDetected: true,
			PromisedDate:    t.Format("2006-01-02"),
			PromisedTime:    t.Format(time.RFC3339),
			ParsingMethod:   "AFFIRMATION_KEYWORD",
			ConfidenceScore: 0.90,
		}
	}

	// Unrecognized / unsupported pattern -> MUST NOT guess -> Escalate to human review
	return ParseResult{
		OriginalMessage:  cleanMsg,
		PromiseDetected:  false,
		ParsingMethod:    "UNKNOWN_ESCALATION",
		NeedsHumanReview: true,
		EscalationReason: "Unrecognized message structure. General natural-language comprehension is not performed by Triage; case routed to human desk.",
		ConfidenceScore:  0.0,
	}
}
