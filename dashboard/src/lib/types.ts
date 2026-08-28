export type CaseStatus =
  | "NEW"
  | "DIAGNOSED"
  | "INTERVENING"
  | "RECOVERED"
  | "LOST"
  | "ESCALATED";

export interface DiagnosticReport {
  case_id: string;
  root_cause: string;
  confidence_score: number;
  technical_reason: string;
  customer_facing_msg: string;
  is_recoverable: boolean;
  requires_human_review?: boolean;
  recommended_action: string;
  diagnosed_at: string;
}

export interface RankedCandidate {
  action: string;
  probability: number;
  probability_percent: number;
  expected_value_paise: number;
  expected_value_inr: number;
  reasoning: string;
}

export interface PolicyRuleEvaluation {
  rule_name: string;
  passed: boolean;
  reason: string;
}

export interface PTPParseResult {
  original_message: string;
  promise_detected: boolean;
  promised_date?: string;
  promised_time?: string;
  parsing_method: string;
  needs_human_review: boolean;
  escalation_reason?: string;
  confidence_score: number;
}

export interface MLMetrics {
  model_type: string;
  n_estimators: number;
  test_cases_evaluated: number;
  roc_auc: number;
  precision: number;
  recall: number;
  f1_score: number;
  accuracy: number;
  absolute_uplift_pct_points: number;
  relative_uplift_pct: number;
}

export interface InterventionDecision {
  case_id: string;
  action: string;
  reasoning: string;
  target_rail?: string;
  cooldown_duration?: number;
  next_execution_at?: string;
  incentive_amount_paise?: number;
  incentive_percent?: number;
  is_stopping_rule_hit?: boolean;
  stopping_reason?: string;
  policy_verdict?: "AUTHORIZED" | "VETOED" | string;
  policy_rules?: PolicyRuleEvaluation[];
  ml_rankings?: RankedCandidate[];
  ml_recommendation?: string;
  ml_probability?: number;
  ml_expected_value_paise?: number;
  max_attempts: number;
  current_attempt: number;
}

export interface TriageCase {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_email?: string;
  plan_name: string;
  amount_paise: number;
  amount_inr: number;
  currency: string;
  original_rail: string;
  error_code: string;
  error_desc: string;
  error_reason?: string;
  error_source?: string;
  error_step?: string;
  status: CaseStatus;
  source?: "LIVE" | "SYNTHETIC" | string;
  allowed_actions?: string[];
  diagnosis?: DiagnosticReport;
  intervention?: InterventionDecision;
  ptp_status?: PTPParseResult;
  customer_facing_msg?: string;
  is_simulated?: boolean;
  payday_proximity_days?: number;
  historical_success_rate?: number;
  attempts_made: number;
  max_attempts: number;
  next_retry_at?: string;
  recovered_amount_paise: number;
  incentive_discount_paise: number;
  razorpay_payment_id?: string;
  idempotency_key: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface SummaryStats {
  total_at_risk_paise: number;
  total_at_risk_inr: number;
  total_recovered_paise: number;
  total_recovered_inr: number;
  recovery_rate_percent: number;
  unresolved_exceptions: number;
  total_cases: number;
  active_interventions: number;
  chain_verified: boolean;
  total_blocks: number;
}

export interface ComparativeCauseStat {
  cause: string;
  total_cases: number;
  at_risk_paise: number;
  at_risk_inr: number;
  baseline_recovered_paise: number;
  baseline_recovered_inr: number;
  baseline_rate_pct: number;
  ml_recovered_paise: number;
  ml_recovered_inr: number;
  ml_rate_pct: number;
  absolute_uplift_pct_points: number;
}

export interface BatchResult {
  batch_id: string;
  total_cases: number;
  total_at_risk_paise: number;
  total_at_risk_inr: number;
  baseline_recovered_paise: number;
  baseline_recovered_inr: number;
  baseline_recovery_pct: number;
  ml_recovered_paise: number;
  ml_recovered_inr: number;
  ml_recovery_pct: number;
  absolute_uplift_pct_points: number;
  relative_uplift_pct: number;
  human_escalations_count: number;
  stopped_count: number;
  per_cause_comparison: Record<string, ComparativeCauseStat>;
  action_distribution_ml: Record<string, number>;
  action_distribution_baseline: Record<string, number>;
  model_metrics?: MLMetrics;
  exception_cases: TriageCase[];
  executed_at: string;
}

export interface RecoveryLogEntry {
  id: string;
  case_id: string;
  timestamp: string;
  previous_status: string;
  new_status: string;
  action_taken: string;
  reasoning: string;
  amount_paise: number;
  amount_inr: number;
  currency: string;
  idempotency_key: string;
  prev_hash: string;
  entry_hash: string;
}

export interface SystemActivityEvent {
  id: string;
  time: string;
  title: string;
  description: string;
  type: "recovery" | "review" | "policy" | "settlement";
}

export interface RevenueSourceRisk {
  source: string;
  amountINR: number;
  percentage: number;
  caseCount: number;
}

export interface PerformanceDataPoint {
  date: string;
  aiRecoveryINR: number;
  baselineINR: number;
}

// Legacy Ledger Types for backwards compatibility
export interface BudgetState {
  agent_id: string;
  capacity_paise: number;
  remaining_paise: number;
  spent_paise: number;
  capacity_inr: number;
  remaining_inr: number;
  spent_inr: number;
  utilization_percent: number;
  last_refilled_at: string;
}

export interface RuleEvaluation {
  rule_name: string;
  passed: boolean;
  reason: string;
  requires_approval?: boolean;
}

export interface AuditEntry {
  id: string;
  event_id: string;
  timestamp: string;
  agent_id: string;
  action: string;
  gate_decision: string;
  gate_reason?: string;
  rule_breakdown?: string;
  amount_paise: number;
  currency: string;
  order_id?: string;
  status: string;
  idempotency_key: string;
  reasoning?: string;
  prev_hash: string;
  entry_hash: string;
}

export interface ApprovalItem {
  id: string;
  agent_id: string;
  product_id: string;
  amount_paise: number;
  reason: string;
  status: string;
  created_at: string;
}

export interface ProductItem {
  id: string;
  name: string;
  description: string;
  price_paise: number;
  currency: string;
  in_stock: boolean;
  category: string;
}
