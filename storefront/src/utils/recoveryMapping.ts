/**
 * Canonical Action Taxonomy & Display Mapping for Triage Gateway
 */

export interface TriageCaseLike {
  id?: string;
  status?: string;
  error_code?: string;
  error_desc?: string;
  notes?: string;
  next_retry_at?: string;
  due_at?: string;
  payday_proximity_days?: number;
  attempts_made?: number;
  max_attempts?: number;
  ptp_status?: {
    promise_detected?: boolean;
    promised_date?: string;
    promised_time?: string;
    confidence_score?: number;
    parsing_method?: string;
  };
  intervention?: {
    action?: string;
    ml_recommendation?: string;
    next_execution_at?: string;
    cooldown_duration?: number;
  };
  diagnosis?: {
    root_cause?: string;
    customer_facing_msg?: string;
    recommended_action?: string;
  };
  recovery_plan?: {
    steps?: Array<{
      step_index?: number;
      action?: string;
      scheduled_at?: string;
      status?: string;
    }>;
  };
}

export const ACTION_DISPLAY_MAP: Record<string, string> = {
  // Retry actions
  RETRY_NEXT_PAYDAY_WINDOW: 'Retry Scheduled',
  RETRY_SAME_RAIL_COOLDOWN: 'Retry Scheduled',
  RETRY_LATER: 'Retry Scheduled',
  RETRY_SAME_RAIL: 'Retry Scheduled',

  // Promise to Pay
  PROMISE_TO_PAY: 'Promise to Pay',

  // Instrument switches
  SWITCH_TO_SAVED_CARD: 'Instrument Switch',
  SWITCH_TO_AVAILABLE_ALTERNATE_RAIL: 'Instrument Switch',

  // Payment method update
  UPDATE_PAYMENT_METHOD: 'Payment Method Update',

  // Mandate reauthorization
  REAUTHORIZE_MANDATE: 'Mandate Reauthorization',

  // Resume checkout / 1-click link
  RESUME_CHECKOUT: 'Resume Checkout',
  RETRY_AUTHENTICATION: 'Resume Checkout',
  REMINDER_NUDGE: 'Resume Checkout',

  // Corporate invoice / collection
  COLLECT_OUTSTANDING_PAYMENT: 'Corporate Invoice',
  CORPORATE_INVOICE: 'Corporate Invoice',

  // Escalation
  ESCALATE_HUMAN: 'Human Support',
  ESCALATE_TO_HUMAN: 'Human Support',

  // Concession
  INCENTIVE_DISCOUNT: 'Incentive Concession',
  INCENTIVE_DISCOUNT_5PCT: 'Incentive Concession',

  // Terminal / Guardrail
  STOP: 'Risk Stop',
  MARK_LOST_EXHAUSTED: 'Mark Lost',
};

/**
 * Derives a human-readable display label from an action and/or case status.
 */
export const getActionDisplayLabel = (action?: string, status?: string): string => {
  if (status === 'RETRY_SCHEDULED') return 'Retry Scheduled';
  if (status === 'PTP_COMMITTED') return 'Promise to Pay';
  if (status === 'ESCALATED') return 'Human Support';
  if (status === 'RECOVERED') return 'Captured & Settled';

  if (!action) return 'Recovery Action';

  return ACTION_DISPLAY_MAP[action] || action.replace(/_/g, ' ');
};

/**
 * Extracts a formatted date string for scheduled retries from existing case data.
 */
export const getScheduledDateString = (c: TriageCaseLike): string => {
  if (c.notes) {
    const match = c.notes.match(/scheduled for ([^,\.]+)/i);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  if (c.next_retry_at) {
    const d = new Date(c.next_retry_at);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    }
    return String(c.next_retry_at);
  }
  if (c.recovery_plan?.steps && c.recovery_plan.steps.length > 0) {
    const step = c.recovery_plan.steps.find((s) => s.status === 'PENDING') || c.recovery_plan.steps[0];
    if (step?.scheduled_at) {
      const d = new Date(step.scheduled_at);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
      }
      return String(step.scheduled_at);
    }
  }
  if (c.intervention?.next_execution_at) {
    const d = new Date(c.intervention.next_execution_at);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    }
    return String(c.intervention.next_execution_at);
  }
  if (c.due_at) {
    const d = new Date(c.due_at);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    }
  }
  if (c.payday_proximity_days !== undefined && c.payday_proximity_days > 0) {
    return `in ${c.payday_proximity_days} day${c.payday_proximity_days === 1 ? '' : 's'}`;
  }
  return 'Next Clearing Window';
};

/**
 * Extracts a formatted promise date string from existing case data.
 */
export const getPromiseDateString = (c: TriageCaseLike): string => {
  if (c.ptp_status?.promised_date) {
    const d = new Date(c.ptp_status.promised_date);
    if (!isNaN(d.getTime()) && c.ptp_status.promised_date.includes('-')) {
      return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    }
    return c.ptp_status.promised_date;
  }
  if (c.notes) {
    const match = c.notes.match(/registered for ([^\s\(]+)/i);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  if (c.due_at) {
    const d = new Date(c.due_at);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    }
  }
  return 'Agreed Due Date';
};

/**
 * Check if a recovery action is actively in progress.
 */
export const isRecoveryInProgress = (c: TriageCaseLike): boolean => {
  return (
    c.status === 'RETRY_SCHEDULED' ||
    c.status === 'RETRY_IN_FLIGHT' ||
    c.status === 'PTP_COMMITTED' ||
    c.status === 'ESCALATED' ||
    Boolean(c.ptp_status?.promise_detected)
  );
};
