export type CaseStatus =
  | "NEW"
  | "DIAGNOSED"
  | "INTERVENING"
  | "RETRY_SCHEDULED"
  | "RETRY_IN_FLIGHT"
  | "RETRY_FAILED"
  | "PTP_COMMITTED"
  | "PTP_MISSED"
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

export interface ArmEvaluation {
  action: string;
  ml_probability: number;
  expected_value_inr: number;
  exploration_bonus: number;
  ucb_score: number;
  pull_count: number;
}

export interface ShadowBanditReport {
  mode: string;
  production_action: string;
  shadow_action: string;
  agreed_with_prod: boolean;
  shadow_ev_inr: number;
  production_ev_inr: number;
  exploration_reason: string;
  estimated_opportunity_cost_inr: number;
  arm_evaluations?: ArmEvaluation[];
  zero_execution_risk: boolean;
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
  p99_latency_ms?: number;
  absolute_uplift_pct_points: number;
  relative_uplift_pct: number;
}

export interface ModelComparisonStats {
  model_key: string;
  name: string;
  type: string;
  roc_auc: number;
  precision: number;
  recall: number;
  f1_score: number;
  accuracy: number;
  log_loss: number;
  train_time_ms: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  recovered_inr: number;
  recovery_rate_pct: number;
  absolute_uplift_pct_points: number;
  relative_uplift_pct: number;
  action_distribution?: Record<string, number>;
}

export interface BenchmarkReport {
  evaluated_at: string;
  test_cases_count: number;
  revenue_at_risk_inr: number;
  static_baseline: {
    name: string;
    recovered_inr: number;
    recovery_rate_pct: number;
  };
  models: Record<string, ModelComparisonStats>;
  champion_model: string;
  production_selected_model: string;
  selection_rationale: string;
}

export interface RetrainMetricsDelta {
  delta_roc_auc: number;
  delta_f1_score: number;
  delta_recovery_rate_pct_points: number;
  delta_recovered_inr: number;
}

export interface RetrainSummary {
  retrained_at: string;
  feedback_samples_ingested: number;
  total_training_samples: number;
  held_out_test_cases: number;
  revenue_at_risk_inr: number;
  before_retrain: {
    roc_auc: number;
    f1_score: number;
    accuracy?: number;
    recovery_rate_pct: number;
    recovered_inr: number;
  };
  after_retrain: {
    roc_auc: number;
    f1_score: number;
    accuracy?: number;
    recovery_rate_pct: number;
    recovered_inr: number;
  };
  delta: RetrainMetricsDelta;
  status: string;
}

export interface AllocationDecision {
  case_id: string;
  customer_name: string;
  amount_paise: number;
  amount_inr: number;
  root_cause: string;
  assigned_action: string;
  resource_allocated: "DISCOUNT_BUDGET" | "HUMAN_DESK" | "ZERO_COST_FALLBACK" | string;
  discount_spend_paise: number;
  discount_spend_inr: number;
  human_review_slots_used: number;
  recovery_probability: number;
  expected_value_inr: number;
  ev_density: number;
  allocation_rationale: string;
  was_constrained: boolean;
}

export interface PortfolioPlan {
  plan_id: string;
  evaluated_at: string;
  total_cases: number;
  total_at_risk_paise: number;
  total_at_risk_inr: number;
  discount_budget_limit_paise: number;
  discount_budget_limit_inr: number;
  discount_budget_spent_paise: number;
  discount_budget_spent_inr: number;
  discount_budget_remaining_inr: number;
  human_desk_capacity: number;
  human_desk_slots_used: number;
  human_desk_slots_remaining: number;
  expected_recovered_paise: number;
  expected_recovered_inr: number;
  unconstrained_expected_inr: number;
  static_baseline_expected_inr: number;
  portfolio_roi_multiple: number;
  cases_allocated_discount: number;
  cases_allocated_human_desk: number;
  cases_routed_zero_cost_fallback: number;
  decisions: AllocationDecision[];
  optimization_method: string;
}

export interface DayProjection {
  date: string;
  day_index: number;
  expected_at_risk_inr: number;
  expected_with_triage_inr: number;
  expected_without_triage_inr: number;
  net_incremental_gained_inr: number;
  triage_recovery_pct: number;
  baseline_recovery_pct: number;
}

export interface ForecastReport {
  generated_at: string;
  forecast_horizon_days: number;
  total_7day_at_risk_inr: number;
  total_7day_with_triage_inr: number;
  total_7day_without_triage_inr: number;
  net_7day_incremental_revenue_inr: number;
  relative_revenue_uplift_pct: number;
  average_daily_at_risk_inr: number;
  daily_projections: DayProjection[];
  methodology: string;
  assumption_triage_recovery_pct: number;
  assumption_baseline_recovery_pct: number;
  honesty_disclosure: string;
}

export interface PaymentInstrument {
  id: string;
  type: string;
  brand?: string;
  last4?: string;
  upi_handle?: string;
  is_active: boolean;
  success_rate?: number;
  past_tx_count?: number;
  label: string;
}

export interface CandidateEvaluation {
  action: string;
  display_name: string;
  eligible: boolean;
  reason: string;
  signals: string[];
}

export interface ActionDecisionRationale {
  recommended_action: string;
  expected_recovery_inr: number;
  recovery_probability: number;
  positive_signals: string[];
  rejected_alternatives: string[];
  policy_passed_checks: string[];
}

export interface CustomerNudgeDraft {
  approved_action: string;
  channel: "WHATSAPP" | "EMAIL" | "SMS" | string;
  headline: string;
  body: string;
  primary_cta: string;
  secondary_cta?: string;
  action_url: string;
  model_used: string;
  safety_validated: boolean;
  validation_notes?: string[];
  generated_at: string;
}

export interface InterventionDecision {
  case_id: string;
  action: string;
  reasoning: string;
  target_rail?: string;
  cooldown_duration: number;
  next_execution_at: string;
  incentive_amount_paise?: number;
  incentive_percent?: number;
  is_stopping_rule_hit: boolean;
  stopping_reason?: string;
  policy_verdict: "AUTHORIZED" | "VETOED" | string;
  policy_rules: PolicyRuleEvaluation[];
  candidate_evaluations?: CandidateEvaluation[];
  action_rationale?: ActionDecisionRationale;
  ml_rankings?: RankedCandidate[];
  ml_recommendation?: string;
  ml_probability?: number;
  ml_expected_value_paise?: number;
  shadow_bandit?: ShadowBanditReport;
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
  available_instruments?: PaymentInstrument[];
  has_alternate_saved_card?: boolean;
  alternate_saved_card_label?: string;
  alternate_card_success_count?: number;
  has_upi_available?: boolean;
  can_update_payment_method?: boolean;
  candidate_evaluations?: CandidateEvaluation[];
  action_rationale?: ActionDecisionRationale;
  diagnosis?: DiagnosticReport;
  intervention?: InterventionDecision;
  ptp_status?: PTPParseResult;
  customer_facing_msg?: string;
  customer_nudge_draft?: CustomerNudgeDraft;
  is_simulated?: boolean;
  payday_proximity_days?: number;
  historical_success_rate?: number;
  attempts_made: number;
  max_attempts: number;
  next_retry_at?: string;
  recovered_amount_paise: number;
  amount_refunded_paise?: number;
  incentive_discount_paise: number;
  razorpay_payment_id?: string;
  idempotency_key: string;
  notes?: string;
  attempts?: Array<{
    attempt_id: string;
    case_id: string;
    attempt_number: number;
    action: string;
    idempotency_key: string;
    razorpay_payment_id?: string;
    amount_at_risk_paise: number;
    recovered_paise: number;
    discount_paise?: number;
    status: string;
    failure_reason?: string;
    created_at: string;
    captured_at?: string;
  }>;
  created_at: string;
  updated_at: string;
}

export interface SummaryStats {
  total_at_risk_paise: number;
  total_at_risk_inr: number;
  total_recovered_paise: number;
  total_recovered_inr: number;
  total_ptp_committed_paise?: number;
  total_ptp_committed_inr?: number;
  recovery_rate_percent: number;
  unresolved_exceptions: number;
  total_cases: number;
  active_interventions: number;
  ptp_outstanding?: number;
  ptp_missed_count?: number;
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

// Bounded Recovery Plan Types
export interface PlanStep {
  step_index: number;
  action: string;
  scheduled_at: string;
  cooldown_duration?: string;
  status: "PENDING" | "EXECUTING" | "SUCCESS" | "FAILURE" | "SKIPPED";
  success_transition: string;
  failure_transition: string;
  stop_conditions?: string[];
  executed_at?: string;
  result?: string;
  idempotency_key: string;
}

export interface RecoveryPlan {
  case_id: string;
  steps: PlanStep[];
  max_steps: number;
  current_step_index: number;
  status: "ACTIVE" | "COMPLETED" | "STOPPED" | "ESCALATED" | "MARK_LOST_EXHAUSTED";
  created_at: string;
  updated_at: string;
}

// Portfolio Prioritization Types
export interface PriorityExplanation {
  gross_expected_recovery_paise: number;
  gross_expected_recovery_inr: number;
  net_expected_recovery_paise?: number;
  net_expected_recovery_inr?: number;
  recovery_probability: number;
  time_sensitivity: number;
  time_sensitivity_reason: string;
  customer_value_factor: number;
  intervention_cost_paise: number;
  risk_penalty_paise: number;
  final_score_paise: number;
  final_score_inr: number;
}

export interface PrioritizedOpportunity {
  case_id: string;
  customer_id: string;
  customer_name: string;
  source_type: string;
  amount_paise: number;
  amount_inr: number;
  status: string;
  action?: string;
  priority_score: number;
  priority_rank: number;
  explanation: PriorityExplanation;
}

export interface PortfolioSummary {
  total_opportunities: number;
  total_revenue_at_risk_paise: number;
  total_revenue_at_risk_inr: number;
  total_expected_recovery_paise: number;
  total_expected_recovery_inr: number;
  queue: PrioritizedOpportunity[];
}

// Customer Cross-Workflow Coordination Types
export interface OpportunitySummary {
  case_id: string;
  source_type: string;
  amount_paise: number;
  amount_inr: number;
  status: string;
  action?: string;
}

export interface CustomerState {
  customer_id: string;
  customer_name: string;
  total_revenue_at_risk_paise: number;
  total_revenue_at_risk_inr: number;
  active_opportunities: OpportunitySummary[];
  previous_interventions: number;
  active_promises: number;
  cooldown_active: boolean;
  cooldown_expires_at?: string;
  last_contact_at?: string;
  fraud_flag: boolean;
  communication_count: number;
}

export interface CoordinationDecision {
  customer_id: string;
  case_id: string;
  decision: "PROCEED" | "DEFER" | "MERGE" | "SUPPRESS" | "ESCALATE";
  reason: string;
  priority_case_id?: string;
}

// Scheduler Types
export interface ScheduledStep {
  case_id: string;
  step_index: number;
  action: string;
  scheduled_at: string;
  idempotency_key: string;
  cancelled: boolean;
  executed: boolean;
}

export interface SchedulerPendingReport {
  current_simulated_time: string;
  pending_steps_count: number;
  due_steps_count: number;
  pending_steps: ScheduledStep[];
  due_steps: ScheduledStep[];
}

