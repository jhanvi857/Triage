package forecast

import (
	"testing"
	"time"

	"github.com/ledger/gateway/internal/recovery"
)

func TestForecastEngine_7DayProjectionCalculations(t *testing.T) {
	engine := NewEngine()
	engine.SetRates(68.15, 61.33)

	cases := []*recovery.Case{
		{
			ID:          "CASE-001",
			AmountPaise: 500000,
			CreatedAt:   time.Now().UTC(),
		},
		{
			ID:          "CASE-002",
			AmountPaise: 750000,
			CreatedAt:   time.Now().UTC(),
		},
	}

	report := engine.Generate7DayForecast(cases)

	if report.ForecastHorizonDays != 7 {
		t.Errorf("expected 7-day horizon, got %d", report.ForecastHorizonDays)
	}

	if len(report.DailyProjections) != 7 {
		t.Fatalf("expected 7 daily projections, got %d", len(report.DailyProjections))
	}

	if report.Total7DayAtRiskINR <= 0 {
		t.Errorf("expected positive at-risk revenue, got %.2f", report.Total7DayAtRiskINR)
	}

	if report.Total7DayWithTriageINR <= report.Total7DayWithoutTriageINR {
		t.Errorf("expected triage recovery (%.2f) to exceed baseline (%.2f)", report.Total7DayWithTriageINR, report.Total7DayWithoutTriageINR)
	}

	if report.Net7DayIncrementalRevenueINR <= 0 {
		t.Errorf("expected positive net incremental revenue, got %.2f", report.Net7DayIncrementalRevenueINR)
	}

	if report.Methodology == "" || report.HonestyDisclosure == "" {
		t.Errorf("missing methodology or honesty disclosure in forecast report")
	}
}
