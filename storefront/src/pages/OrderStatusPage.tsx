import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Smartphone, 
  Calendar, 
  Clock, 
  Percent, 
  ShieldCheck, 
  Layers, 
  Info, 
  Sparkles,
  Check,
  FileText,
  Send,
  UserCheck,
  AlertOctagon,
  CreditCard
} from 'lucide-react';

interface TriageCase {
  id: string;
  customer_name: string;
  customer_email?: string;
  plan_name: string;
  amount_inr: number;
  amount_paise: number;
  original_rail: string;
  error_code: string;
  error_desc: string;
  error_reason?: string;
  error_source?: string;
  error_step?: string;
  status: string;
  allowed_actions?: string[];
  diagnosis?: {
    root_cause: string;
    confidence_score: number;
    technical_reason: string;
    customer_facing_msg: string;
    is_recoverable: boolean;
    requires_human_review: boolean;
    recommended_action: string;
  };
  intervention?: {
    action: string;
    policy_verdict: string;
    ml_probability: number;
    ml_recommendation?: string;
    ml_expected_value_paise?: number;
    incentive_amount_paise: number;
  };
  ptp_status?: {
    promise_detected: boolean;
    promised_date?: string;
    confidence_score: number;
    parsing_method: string;
  };
  customer_facing_msg?: string;
  razorpay_payment_id?: string;
  created_at: string;
}

type RecoveryTab = 'UPI' | 'RETRY' | 'DISCOUNT' | 'PTP' | 'LINK' | 'INVOICE' | 'ESCALATE' | 'CARD_ALT' | 'UPDATE_CARD';

interface TabDefinition {
  key: RecoveryTab;
  label: string;
  subLabel: string;
  icon: React.ReactNode;
  isRecommended?: boolean;
}

export const OrderStatusPage: React.FC = () => {
  const { caseId, email } = useParams<{ caseId?: string; email?: string }>();
  const [caseData, setCaseData] = useState<TriageCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [isResolving, setIsResolving] = useState(false);
  const [activeTab, setActiveTab] = useState<RecoveryTab>('UPI');
  
  // UPI selection state
  const [selectedUpiApp, setSelectedUpiApp] = useState<string>('Google Pay');

  // Retry schedule state
  const [selectedRetryWindow, setSelectedRetryWindow] = useState<string>('30_mins');
  const [retryScheduledMsg, setRetryScheduledMsg] = useState<string | null>(null);

  // PTP state
  const [ptpMessage, setPtpMessage] = useState('');
  const [ptpLoading, setPtpLoading] = useState(false);
  const [ptpResult, setPtpResult] = useState<any>(null);

  // Link state
  const [linkSentMsg, setLinkSentMsg] = useState<string | null>(null);

  // Corporate invoice state
  const [invoiceSent, setInvoiceSent] = useState(false);

  // Escalate state
  const [escalatedMsg, setEscalatedMsg] = useState<string | null>(null);

  const fetchCase = async () => {
    try {
      if (caseId) {
        const res = await fetch(`http://localhost:8080/api/v1/triage/cases/${caseId}`);
        if (res.ok) {
          const data = await res.json();
          setCaseData(data);
          setLoading(false);
        }
      } else if (email) {
        const res = await fetch('http://localhost:8080/api/v1/triage/cases');
        if (res.ok) {
          const data = await res.json();
          const cases: TriageCase[] = Array.isArray(data) ? data : (data.cases || []);
          if (cases && cases.length > 0) {
            setCaseData(cases[0]);
            setLoading(false);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching case status', err);
    }
  };

  useEffect(() => {
    fetchCase();
    const interval = setInterval(fetchCase, 2500);
    return () => clearInterval(interval);
  }, [caseId, email]);

  // Compute legal allowed tabs strictly from policy whitelist + ML recommendation tags
  const getAvailableTabs = (c: TriageCase | null): TabDefinition[] => {
    if (!c) return [];
    const rootCause = c.diagnosis?.root_cause || (c.error_code === 'GATEWAY_TIMEOUT_504' ? 'BANK_DOWNTIME_TIMEOUT' : c.error_code);
    const mlAction = c.intervention?.action || c.intervention?.ml_recommendation || c.diagnosis?.recommended_action || '';
    
    // Whitelist rules mapping matching gateway/internal/intervention/candidates.go
    const actions = c.allowed_actions && c.allowed_actions.length > 0 
      ? c.allowed_actions 
      : (() => {
          switch (rootCause) {
            case 'INSUFFICIENT_FUNDS':
              return ['SWITCH_TO_SAVED_CARD', 'RETRY_NEXT_PAYDAY_WINDOW', 'PROMISE_TO_PAY'];
            case 'BANK_DOWNTIME_TIMEOUT':
            case 'GATEWAY_ERROR':
            case 'NETWORK_DECLINE':
              return ['RETRY_SAME_RAIL_COOLDOWN', 'SWITCH_TO_AVAILABLE_ALTERNATE_RAIL'];
            case 'OTP_DROP_OFF':
            case 'TRANSACTION_TIMEOUT':
              return ['RESUME_CHECKOUT', 'SWITCH_TO_AVAILABLE_ALTERNATE_RAIL'];
            case 'MANDATE_REVOKED':
            case 'LIMIT_EXCEEDED':
              return ['REAUTHORIZE_MANDATE', 'COLLECT_OUTSTANDING_PAYMENT'];
            case 'EXPIRED_CARD':
              return ['UPDATE_PAYMENT_METHOD'];
            case 'FRAUD_SUSPECTED':
              return ['ESCALATE_HUMAN'];
            default:
              return ['SWITCH_TO_AVAILABLE_ALTERNATE_RAIL', 'RETRY_SAME_RAIL_COOLDOWN'];
          }
        })();

    const tabs: TabDefinition[] = [];

    // 1. Switch to Saved Alternate Card
    if (actions.includes('SWITCH_TO_SAVED_CARD')) {
      const isRec = mlAction === 'SWITCH_TO_SAVED_CARD';
      tabs.push({
        key: 'CARD_ALT',
        label: 'Use Backup Card',
        subLabel: 'Visa •••• 4821 (Active)',
        icon: <CreditCard size={14} />,
        isRecommended: isRec
      });
    }

    // 2. Update Payment Method / Replace Expired Card
    if (actions.includes('UPDATE_PAYMENT_METHOD')) {
      const isRec = mlAction === 'UPDATE_PAYMENT_METHOD';
      tabs.push({
        key: 'UPDATE_CARD',
        label: 'Update Card',
        subLabel: 'Replace expired card details',
        icon: <CreditCard size={14} />,
        isRecommended: isRec
      });
    }

    // 3. Instant UPI Switch / Direct Bypass
    if (actions.includes('SWITCH_TO_AVAILABLE_ALTERNATE_RAIL') || actions.includes('RETRY_AUTHENTICATION') || actions.includes('RESUME_CHECKOUT')) {
      const isMandateBypass = rootCause === 'MANDATE_REVOKED' || rootCause === 'LIMIT_EXCEEDED';
      const isRec = mlAction === 'SWITCH_TO_AVAILABLE_ALTERNATE_RAIL' || mlAction === 'RESUME_CHECKOUT' || mlAction === 'RETRY_AUTHENTICATION';
      tabs.push({
        key: 'UPI',
        label: isMandateBypass ? 'Direct UPI Bypass' : 'Instant UPI',
        subLabel: 'Switch to instant UPI rail',
        icon: <Smartphone size={14} />,
        isRecommended: isRec
      });
    }

    // 4. Schedule Auto-Retry / Cooldown / Payday Window
    if (actions.includes('RETRY_SAME_RAIL_COOLDOWN') || actions.includes('RETRY_NEXT_PAYDAY_WINDOW') || actions.includes('RETRY_LATER')) {
      const isPayday = rootCause === 'INSUFFICIENT_FUNDS';
      const isRec = mlAction === 'RETRY_NEXT_PAYDAY_WINDOW' || mlAction === 'RETRY_SAME_RAIL_COOLDOWN' || mlAction === 'RETRY_LATER';
      tabs.push({
        key: 'RETRY',
        label: isPayday ? 'Schedule Auto-Retry' : 'Cooldown Retry',
        subLabel: isPayday ? 'Payday / salary cycle retry' : '30-minute automated cooldown',
        icon: <Clock size={14} />,
        isRecommended: isRec
      });
    }

    // 5. Promise to Pay (PTP)
    if (actions.includes('PROMISE_TO_PAY')) {
      const isRec = mlAction === 'PROMISE_TO_PAY';
      tabs.push({
        key: 'PTP',
        label: 'Promise to Pay',
        subLabel: 'Conversational date scheduling',
        icon: <Calendar size={14} />,
        isRecommended: isRec
      });
    }

    // 7. Corporate PO & Net-30 Invoicing
    if ((actions.includes('COLLECT_OUTSTANDING_PAYMENT') || actions.includes('CORPORATE_INVOICE')) && c.amount_inr >= 5000) {
      const isRec = mlAction === 'COLLECT_OUTSTANDING_PAYMENT' || mlAction === 'CORPORATE_INVOICE';
      tabs.push({
        key: 'INVOICE',
        label: 'Corporate PO',
        subLabel: 'Net-30 GST invoice',
        icon: <FileText size={14} />,
        isRecommended: isRec
      });
    }

    // 8. Human Support Escalation
    if (actions.includes('ESCALATE_HUMAN') && (tabs.length === 0 || rootCause === 'FRAUD_SUSPECTED')) {
      tabs.push({
        key: 'ESCALATE',
        label: 'Human Support',
        subLabel: 'Escalate to billing team',
        icon: <UserCheck size={14} />
      });
    }

    // Ensure the ML-recommended tab is always ordered first for the customer
    tabs.sort((a, b) => (b.isRecommended ? 1 : 0) - (a.isRecommended ? 1 : 0));

    return tabs;
  };

  const availableTabs = getAvailableTabs(caseData);

  // Automatically select the ML Recommended tab on load
  useEffect(() => {
    if (availableTabs.length > 0) {
      const recTab = availableTabs.find(t => t.isRecommended);
      if (recTab) {
        setActiveTab(recTab.key);
      } else {
        const exists = availableTabs.some(t => t.key === activeTab);
        if (!exists) {
          setActiveTab(availableTabs[0].key);
        }
      }
    }
  }, [caseData]);

  // Option 1 & Option 3: Instant settlement via UPI or Discount
  const handleResolvePayment = async (method: 'UPI' | 'DISCOUNT') => {
    if (!caseData) return;
    setIsResolving(true);
    try {
      const notes = method === 'DISCOUNT'
        ? 'Customer claimed 5% instant concession and completed payment'
        : `Customer switched rail to ${selectedUpiApp} for instant settlement`;

      const res = await fetch(`http://localhost:8080/api/v1/triage/cases/${caseData.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolution: 'RECOVERED',
          notes: notes
        })
      });

      if (res.ok) {
        const updated = await res.json();
        setCaseData(updated);
        return;
      }

      // Fallback
      const advRes = await fetch(`http://localhost:8080/api/v1/triage/cases/${caseData.id}/advance`, {
        method: 'POST'
      });
      if (advRes.ok) {
        const advUpdated = await advRes.json();
        setCaseData(advUpdated);
      }
    } catch (err) {
      console.error('Failed to resolve payment', err);
    } finally {
      setIsResolving(false);
    }
  };

  // Option 2: Schedule smart cooldown / payday auto-retry
  const handleScheduleRetry = async () => {
    if (!caseData) return;
    setIsResolving(true);
    try {
      let label = 'in 30 minutes';
      if (selectedRetryWindow === 'tomorrow') label = 'Tomorrow at 9:00 AM';
      if (selectedRetryWindow === 'salary_day') label = 'on 1st of next month (Salary Cycle)';
      if (selectedRetryWindow === '3_days') label = 'in 3 business days';

      setRetryScheduledMsg(`Auto-Retry scheduled for ${label}. Your compute quota has been reserved with zero late fees.`);

      // Inform gateway about the retry schedule
      await fetch(`http://localhost:8080/api/v1/triage/cases/${caseData.id}/advance`, {
        method: 'POST'
      });
      await fetchCase();
    } catch (err) {
      console.error('Failed to schedule retry', err);
    } finally {
      setIsResolving(false);
    }
  };

  // Option 4: PTP NLP Submission
  const handlePtpSubmit = async (e: React.FormEvent, customMsg?: string) => {
    if (e) e.preventDefault();
    const query = customMsg || ptpMessage;
    if (!query.trim() || !caseData) return;
    
    setPtpLoading(true);
    try {
      const res = await fetch(`http://localhost:8080/api/v1/triage/ptp/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query, case_id: caseData.id })
      });
      if (res.ok) {
        const data = await res.json();
        setPtpResult(data);
      }
    } catch (err) {
      console.error('Error parsing PTP message', err);
    } finally {
      setPtpLoading(false);
    }
  };

  // Option 5: Payment Link
  const handleSendPaymentLink = () => {
    setLinkSentMsg(`Payment link re-sent to ${caseData?.customer_email || 'your registered email/SMS'}. Active for 15 minutes.`);
  };

  // Option 6: Corporate Invoice
  const handleSendInvoice = () => {
    setInvoiceSent(true);
  };

  const getFriendlyRootCause = (caseItem: any) => {
    const code = caseItem.diagnosis?.root_cause || caseItem.error_code || 'PAYMENT_DECLINED';
    const reason = caseItem.error_reason || '';
    const desc = caseItem.error_desc || '';

    if (code === 'EXPIRED_CARD' || code === 'CARD_EXPIRED' || reason.includes('card_expired') || desc.includes('expired')) {
      return {
        title: 'Payment Card Expired',
        explanation: 'This payment card validity date has passed. Permanent decline on dead instrument — automated retries permanently suspended by policy.',
        type: 'expired_card'
      };
    }
    if (code === 'MANDATE_REVOKED' || code === 'LIMIT_EXCEEDED' || reason.includes('mandate') || desc.includes('mandate') || desc.includes('e-mandate') || desc.includes('limit')) {
      return {
        title: 'Recurring e-Mandate Limit Exceeded',
        explanation: 'This charge exceeds your configured daily or monthly e-mandate transaction threshold set with your bank. You can instantly bypass the mandate ceiling via UPI or alternate schedule.',
        type: 'mandate'
      };
    }
    if (code === 'INSUFFICIENT_FUNDS' || code === 'BAD_REQUEST_ERROR' || reason.includes('funds') || desc.includes('insufficient')) {
      return {
        title: 'Insufficient Account Balance',
        explanation: 'Your issuing bank declined the charge because the available balance was lower than the invoice amount. No funds were debited from your account.',
        type: 'customer_funds'
      };
    }
    if (code === 'BANK_DOWNTIME_TIMEOUT' || code === 'BANK_SYSTEM_ERROR' || code === 'GATEWAY_ERROR' || code === 'NETWORK_DECLINE' || reason.includes('bank') || desc.includes('timeout') || desc.includes('network') || desc.includes('server')) {
      return {
        title: 'Issuing Bank Technical Outage',
        explanation: 'The card network experienced a temporary core gateway timeout with your bank. The payment infrastructure failed to acknowledge the authorization in time.',
        type: 'bank_outage'
      };
    }
    if (code === 'OTP_DROP_OFF' || code === 'TRANSACTION_TIMEOUT' || reason.includes('otp')) {
      return {
        title: '3D-Secure Verification Timeout',
        explanation: 'The SMS OTP verification session timed out before bank confirmation. Your card was not charged.',
        type: 'timeout'
      };
    }
    return {
      title: caseItem.error_desc || 'Card Authentication Failed',
      explanation: caseItem.diagnosis?.technical_reason || caseItem.error_desc || 'The issuing bank declined authorization for this transaction.',
      type: 'generic'
    };
  };

  if (loading) {
    return (
      <div className="status-page-wrap">
        <div className="diagnostic-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <div className="spinner" style={{ margin: '0 auto 1.5rem' }}></div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Retrieving Real-Time Order Diagnostics...
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Polling Triage payment gateway on <code>localhost:8080</code>
          </p>
        </div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="status-page-wrap">
        <div className="diagnostic-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <AlertTriangle size={36} color="var(--danger-color)" style={{ margin: '0 auto 1rem' }} />
          <h2>Order Reference Not Found</h2>
          <p style={{ color: 'var(--text-secondary)', margin: '1rem 0' }}>
            We could not locate active decline telemetry for this checkout session.
          </p>
          <Link to="/" className="btn-primary" style={{ display: 'inline-flex', width: 'auto' }}>
            Return to Storefront
          </Link>
        </div>
      </div>
    );
  }

  const isRecovered = caseData.status === 'RECOVERED';
  const friendlyCause = getFriendlyRootCause(caseData);
  const discountedPriceINR = (caseData.amount_inr * 0.95).toFixed(2);
  const discountSavingsINR = (caseData.amount_inr * 0.05).toFixed(2);
  const isPermanentDecline = caseData.diagnosis?.root_cause === 'EXPIRED_CARD' || 
    caseData.error_code === 'CARD_EXPIRED' || 
    caseData.error_code === 'EXPIRED_CARD' ||
    caseData.error_reason === 'card_expired' ||
    caseData.diagnosis?.is_recoverable === false;
  const mlProbability = caseData.intervention?.ml_probability;
  const activeTabDef = availableTabs.find(t => t.key === activeTab);

  return (
    <div className="status-page-wrap font-sans">
      <div className="diagnostic-card">
        {/* Navigation & Header */}
        <div className="diagnostic-card-header">
          <div>
            <Link to="/" className="back-link">
              <ArrowLeft size={14} />
              <span>Back to Plans</span>
            </Link>
            <div className="case-badge">
              CASE REFERENCE: <strong>{caseData.id}</strong>
            </div>
            <h1 className="case-title">{caseData.plan_name}</h1>
          </div>
          <div className="status-pill-wrap">
            <span className={`status-pill ${caseData.status.toLowerCase()}`}>
              {caseData.status}
            </span>
          </div>
        </div>

        <div className="diagnostic-card-body">
          {/* 1. Status Alert Hero Banner */}
          <div className={`status-hero-alert ${isRecovered ? 'recovered' : 'failed'}`}>
            <div className="status-hero-icon">
              {isRecovered ? (
                <CheckCircle2 size={28} color="var(--accent-color)" />
              ) : (
                <AlertTriangle size={28} color="var(--danger-color)" />
              )}
            </div>
            <div className="status-hero-content">
              <h2>
                {isRecovered
                  ? 'Payment Successfully Recovered!'
                  : `Payment Interrupted: ${friendlyCause.title}`}
              </h2>
              <p>
                {isRecovered
                  ? `Your payment of ₹${caseData.amount_inr.toFixed(2)} was captured via alternative rail. Your cloud capacity has been provisioned.`
                  : friendlyCause.explanation}
              </p>
            </div>
          </div>

          {/* 2. Structured Failure Reason Breakdown */}
          {!isRecovered && (
            <div className="reason-breakdown-box">
              <div className="reason-breakdown-title">
                <Info size={14} />
                <span>Technical Decline Telemetry</span>
              </div>
              <div className="reason-grid">
                <div className="reason-stat">
                  <span className="reason-stat-label">Identified Root Cause</span>
                  <span className="reason-stat-value" style={{ color: 'var(--danger-color)' }}>
                    {caseData.diagnosis?.root_cause || caseData.error_code || 'BAD_REQUEST_ERROR'}
                  </span>
                </div>
                <div className="reason-stat">
                  <span className="reason-stat-label">Decline Origin</span>
                  <span className="reason-stat-value">
                    {caseData.error_source ? `${caseData.error_source.toUpperCase()} GATEWAY` : 'ISSUER BANK'}
                  </span>
                </div>
                <div className="reason-stat">
                  <span className="reason-stat-label">Original Rail</span>
                  <span className="reason-stat-value">{caseData.original_rail?.toUpperCase() || 'CARD'}</span>
                </div>
                <div className="reason-stat">
                  <span className="reason-stat-label">Invoice Value</span>
                  <span className="reason-stat-value">₹{caseData.amount_inr.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
                {/* 3. MULTI-OPTION CUSTOMER RECOVERY CENTER OR PERMANENT DECLINE REFUSAL */}
          {!isRecovered ? (
            isPermanentDecline ? (
              /* DEDICATED EXPIRED CARD REFUSAL TO AUTO-RETRY VIEW */
              <div className="refusal-box">
                <div className="refusal-badge">
                  <AlertOctagon size={14} />
                  <span>Permanent Decline · Refusal to Auto-Retry</span>
                </div>

                <h3 className="refusal-heading">
                  This card cannot be safely retried
                </h3>

                <p className="refusal-desc">
                  This payment card validity date has passed. Our deterministic policy engine has permanently halted automated retry cycles to protect against issuing bank penalty fees and card lockouts.
                </p>

                <div className="refusal-rules-card">
                  <div className="refusal-rule-item">
                    <AlertTriangle size={14} color="#D97706" style={{ flexShrink: 0 }} />
                    <span><strong>Automated Retries:</strong> 0 attempts scheduled (Halted by Policy)</span>
                  </div>
                  <div className="refusal-rule-item">
                    <ShieldCheck size={14} color="#DC2626" style={{ flexShrink: 0 }} />
                    <span><strong>Policy Guardrail:</strong> Hard decline on permanently expired instrument</span>
                  </div>
                  <div className="refusal-rule-item">
                    <UserCheck size={14} color="#059669" style={{ flexShrink: 0 }} />
                    <span><strong>Routing Target:</strong> Retention &amp; Human Recovery Desk</span>
                  </div>
                </div>

                {escalatedMsg ? (
                  <div style={{ padding: '0.85rem', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, fontSize: '0.85rem', color: '#166534', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Check size={14} />
                    <span>{escalatedMsg}</span>
                  </div>
                ) : (
                  <button
                    className="btn-primary"
                    style={{ background: '#B91C1C', borderColor: '#991B1B', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    onClick={() => setEscalatedMsg(`Connecting you with our recovery team. Priority Ticket #${caseData.id} routed to Account Retention Desk.`)}
                    disabled={isResolving}
                  >
                    <UserCheck size={16} />
                    <span>Connect with Recovery Specialist</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="recovery-solution-box">
                <div className="solution-badge">
                  <Sparkles size={13} />
                  <span>Autonomous Recovery Center</span>
                </div>

                <div className="solution-message" style={{ marginBottom: '1rem' }}>
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                    {availableTabs.length === 1 
                      ? 'Authorized Settlement Method' 
                      : 'Select your preferred method to complete this order:'}
                  </p>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                    {availableTabs.length === 1 
                      ? 'Our policy engine has authorized a single direct recovery route for this decline cause.' 
                      : `Our policy engine has generated ${availableTabs.length} authorized settlement pathways tailored to this decline.`}
                  </p>
                </div>

                {/* Dynamic Navigation Tabs based strictly on allowed actions */}
                {availableTabs.length > 1 && (
                  <div className="recovery-tabs-nav">
                    {availableTabs.map((tab, idx) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveTab(tab.key)}
                        className={`recovery-nav-item ${activeTab === tab.key ? 'active' : ''} ${tab.isRecommended ? 'is-recommended' : ''}`}
                      >
                        {tab.icon}
                        <span>{idx + 1}. {tab.label}</span>
                        {tab.isRecommended && (
                          <span className="tab-recommended-badge">
                            <Sparkles size={10} /> Recommended
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* TAB 1: INSTANT UPI SWITCH / DIRECT BYPASS */}
                {activeTab === 'UPI' && (
                  <div className="recovery-tab-content">
                    {activeTabDef?.isRecommended && (
                      <div className="ml-recommendation-callout">
                        <Sparkles size={16} className="ml-callout-icon" />
                        <div>
                          <div className="ml-callout-title">
                            AI Recommended Recovery Strategy {mlProbability ? `· ${(mlProbability * 100).toFixed(1)}% Recovery Probability` : ''}
                          </div>
                          <div className="ml-callout-desc">
                            The Random Forest ranking model evaluated Instant UPI switch as highest Expected Value for this decline profile.
                          </div>
                        </div>
                      </div>
                    )}

                    <div style={{ marginBottom: '0.85rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                        Switch to Instant UPI Authorization
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                        Bypasses card gateway congestions and e-mandate limits. Generates instant on-rail receipt.
                      </div>
                    </div>

                    {/* UPI Provider Selection */}
                    <div className="upi-app-grid">
                      {['Google Pay', 'PhonePe', 'Paytm', 'BHIM UPI'].map((app) => (
                        <div
                          key={app}
                          onClick={() => setSelectedUpiApp(app)}
                          className={`upi-app-card ${selectedUpiApp === app ? 'selected' : ''}`}
                        >
                          <Smartphone size={16} />
                          <span>{app}</span>
                        </div>
                      ))}
                    </div>

                    <button
                      className="btn-primary"
                      onClick={() => handleResolvePayment('UPI')}
                      disabled={isResolving}
                    >
                      {isResolving ? (
                        <>
                          <RefreshCw className="spinner" size={16} />
                          <span>Authorizing {selectedUpiApp}...</span>
                        </>
                      ) : (
                        <>
                          <Smartphone size={16} />
                          <span>Complete with 1-Click UPI ({selectedUpiApp})</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* TAB 2: SMART SCHEDULE & COOLDOWN */}
                {activeTab === 'RETRY' && (
                  <div className="recovery-tab-content">
                    {activeTabDef?.isRecommended && (
                      <div className="ml-recommendation-callout">
                        <Sparkles size={16} className="ml-callout-icon" />
                        <div>
                          <div className="ml-callout-title">
                            AI Recommended Recovery Strategy {mlProbability ? `· ${(mlProbability * 100).toFixed(1)}% Recovery Probability` : ''}
                          </div>
                          <div className="ml-callout-desc">
                            Random Forest scoring identified scheduled retry as optimal based on customer salary proximity and clearing windows.
                          </div>
                        </div>
                      </div>
                    )}

                    <div style={{ marginBottom: '0.85rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                        Smart Automated Cooldown Retry
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                        Our autonomous engine will re-attempt payment when bank traffic clears. Zero late fee guarantee.
                      </div>
                    </div>

                    <div className="retry-schedule-grid">
                      <div
                        onClick={() => setSelectedRetryWindow('30_mins')}
                        className={`retry-time-card ${selectedRetryWindow === '30_mins' ? 'selected' : ''}`}
                      >
                        <div className="retry-time-title">In 30 Minutes</div>
                        <div className="retry-time-sub">Best for temporary bank downtime &amp; network congestion</div>
                      </div>

                      <div
                        onClick={() => setSelectedRetryWindow('tomorrow')}
                        className={`retry-time-card ${selectedRetryWindow === 'tomorrow' ? 'selected' : ''}`}
                      >
                        <div className="retry-time-title">Tomorrow 9:00 AM</div>
                        <div className="retry-time-sub">Morning clearing cycle at issuer bank</div>
                      </div>

                      <div
                        onClick={() => setSelectedRetryWindow('salary_day')}
                        className={`retry-time-card ${selectedRetryWindow === 'salary_day' ? 'selected' : ''}`}
                      >
                        <div className="retry-time-title">1st of Next Month</div>
                        <div className="retry-time-sub">Aligned with monthly salary / payday credit</div>
                      </div>

                      <div
                        onClick={() => setSelectedRetryWindow('3_days')}
                        className={`retry-time-card ${selectedRetryWindow === '3_days' ? 'selected' : ''}`}
                      >
                        <div className="retry-time-title">In 3 Days</div>
                        <div className="retry-time-sub">Standard dunning cooldown retry window</div>
                      </div>
                    </div>

                    <button
                      className="btn-primary"
                      onClick={handleScheduleRetry}
                      disabled={isResolving}
                    >
                      {isResolving ? (
                        <>
                          <RefreshCw className="spinner" size={16} />
                          <span>Registering Schedule...</span>
                        </>
                      ) : (
                        <>
                          <Clock size={16} />
                          <span>Confirm Auto-Retry Schedule</span>
                        </>
                      )}
                    </button>

                    {retryScheduledMsg && (
                      <div style={{ marginTop: '0.85rem', padding: '0.75rem', background: 'var(--accent-light)', border: '1px solid var(--accent-border)', borderRadius: 6, fontSize: '0.85rem', color: 'var(--accent-color)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Check size={14} />
                        <span>{retryScheduledMsg}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: 5% EARLY CONCESSION */}
                {activeTab === 'DISCOUNT' && (
                  <div className="recovery-tab-content">
                    {activeTabDef?.isRecommended && (
                      <div className="ml-recommendation-callout">
                        <Sparkles size={16} className="ml-callout-icon" />
                        <div>
                          <div className="ml-callout-title">
                            AI Recommended Recovery Strategy {mlProbability ? `· ${(mlProbability * 100).toFixed(1)}% Recovery Probability` : ''}
                          </div>
                          <div className="ml-callout-desc">
                            The Random Forest model evaluated this 5% discount incentive as maximizing net expected revenue for this customer.
                          </div>
                        </div>
                      </div>
                    )}

                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                        5% Instant Settlement Incentive
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                        Triage has pre-approved an immediate discount to complete this invoice now without delay.
                      </div>
                    </div>

                    <div style={{ background: 'var(--surface-subtle)', padding: '1rem', borderRadius: 8, marginBottom: '1.25rem', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                        <span>Original Plan Price:</span>
                        <span style={{ textDecoration: 'line-through' }}>₹{caseData.amount_inr.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--accent-color)', fontWeight: 600, marginBottom: '0.5rem' }}>
                        <span>5% Automated Concession:</span>
                        <span>- ₹{discountSavingsINR}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.5rem' }}>
                        <span>Final Net Amount:</span>
                        <span style={{ color: 'var(--accent-color)' }}>₹{discountedPriceINR}</span>
                      </div>
                    </div>

                    <button
                      className="btn-primary"
                      onClick={() => handleResolvePayment('DISCOUNT')}
                      disabled={isResolving}
                    >
                      {isResolving ? (
                        <>
                          <RefreshCw className="spinner" size={16} />
                          <span>Applying Waiver...</span>
                        </>
                      ) : (
                        <>
                          <Percent size={16} />
                          <span>Claim 5% Discount &amp; Pay ₹{discountedPriceINR}</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* TAB 4: PROMISE TO PAY (PTP) */}
                {activeTab === 'PTP' && (
                  <div className="recovery-tab-content">
                    {activeTabDef?.isRecommended && (
                      <div className="ml-recommendation-callout">
                        <Sparkles size={16} className="ml-callout-icon" />
                        <div>
                          <div className="ml-callout-title">
                            AI Recommended Recovery Strategy {mlProbability ? `· ${(mlProbability * 100).toFixed(1)}% Recovery Probability` : ''}
                          </div>
                          <div className="ml-callout-desc">
                            Conversational date scheduling selected to give maximum payment flexibility while maintaining commitment.
                          </div>
                        </div>
                      </div>
                    )}

                    <div style={{ marginBottom: '0.75rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                        Conversational Promise to Pay (NLP)
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                        Tell us when you plan to settle. Type in natural English or Hindi:
                      </div>
                    </div>

                    <form onSubmit={(e) => handlePtpSubmit(e)} className="ptp-input-row" style={{ marginTop: '0.5rem' }}>
                      <input
                        type="text"
                        className="ptp-input"
                        placeholder="e.g. 'I will pay this Friday once salary is credited'"
                        value={ptpMessage}
                        onChange={(e) => setPtpMessage(e.target.value)}
                      />
                      <button
                        type="submit"
                        className="btn-primary"
                        style={{ width: 'auto', padding: '0.6rem 1.25rem' }}
                        disabled={ptpLoading || !ptpMessage.trim()}
                      >
                        {ptpLoading ? <RefreshCw className="spinner" size={14} /> : <span>Confirm Date</span>}
                      </button>
                    </form>

                    {/* Fast Click Templates */}
                    <div className="quick-chips-row">
                      {[
                        'Pay tomorrow at 10 AM',
                        'Debit on 5th after salary',
                        'Haan next Monday ko karunga',
                        'I need 3 days time'
                      ].map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          className="quick-chip"
                          onClick={() => setPtpMessage(chip)}
                        >
                          "{chip}"
                        </button>
                      ))}
                    </div>

                    {ptpResult && (
                      <div style={{ marginTop: '1rem', padding: '0.85rem', background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
                        {ptpResult.promise_detected ? (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-color)', fontWeight: 600, fontSize: '0.88rem' }}>
                              <Check size={16} />
                              <span>Promise Scheduled for: {ptpResult.promised_date}</span>
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                              Parsed via: <code>{ptpResult.parsing_method}</code> • Confidence: {(ptpResult.confidence_score * 100).toFixed(0)}%
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--danger-color)', fontSize: '0.85rem' }}>
                            <AlertTriangle size={16} />
                            <span>Could not parse exact date. Ambiguous promise safely routed to customer support.</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 5: RE-AUTHENTICATION LINK (OTP Drop-off) */}
                {activeTab === 'LINK' && (
                  <div className="recovery-tab-content">
                    {activeTabDef?.isRecommended && (
                      <div className="ml-recommendation-callout">
                        <Sparkles size={16} className="ml-callout-icon" />
                        <div>
                          <div className="ml-callout-title">
                            AI Recommended Recovery Strategy {mlProbability ? `· ${(mlProbability * 100).toFixed(1)}% Recovery Probability` : ''}
                          </div>
                          <div className="ml-callout-desc">
                            Direct 3DS re-authentication link generated for frictionless verification completion.
                          </div>
                        </div>
                      </div>
                    )}

                    <div style={{ marginBottom: '0.85rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                        Direct Re-Authentication Payment Link
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                        We will SMS / WhatsApp a direct one-click authorization link to complete your 3D-Secure authentication without restarting checkout.
                      </div>
                    </div>

                    {linkSentMsg ? (
                      <div style={{ padding: '0.85rem', background: 'var(--accent-light)', border: '1px solid var(--accent-border)', borderRadius: 6, fontSize: '0.85rem', color: 'var(--accent-color)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Check size={14} />
                        <span>{linkSentMsg}</span>
                      </div>
                    ) : (
                      <button
                        className="btn-primary"
                        onClick={handleSendPaymentLink}
                        disabled={isResolving}
                      >
                        <Send size={16} />
                        <span>Resend Secure 1-Click Payment Link</span>
                      </button>
                    )}
                  </div>
                )}

                {/* TAB 6: CORPORATE PO & NET-30 INVOICING */}
                {activeTab === 'INVOICE' && (
                  <div className="recovery-tab-content">
                    {activeTabDef?.isRecommended && (
                      <div className="ml-recommendation-callout">
                        <Sparkles size={16} className="ml-callout-icon" />
                        <div>
                          <div className="ml-callout-title">
                            AI Recommended Recovery Strategy {mlProbability ? `· ${(mlProbability * 100).toFixed(1)}% Recovery Probability` : ''}
                          </div>
                          <div className="ml-callout-desc">
                            High-value transaction eligible for Net-30 Corporate Invoicing and GST PO reconciliation.
                          </div>
                        </div>
                      </div>
                    )}

                    <div style={{ marginBottom: '0.85rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                        Corporate Purchase Order &amp; Net-30 Invoice
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                        Convert this ₹{caseData.amount_inr.toFixed(2)} purchase to a Corporate Net-30 GST invoice payable via NEFT/RTGS wire.
                      </div>
                    </div>

                    {invoiceSent ? (
                      <div style={{ padding: '0.85rem', background: 'var(--accent-light)', border: '1px solid var(--accent-border)', borderRadius: 6, fontSize: '0.85rem', color: 'var(--accent-color)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Check size={14} />
                        <span>Net-30 GST Invoice dispatched to {caseData.customer_email || 'your billing email'}.</span>
                      </div>
                    ) : (
                      <button
                        className="btn-primary"
                        onClick={handleSendInvoice}
                        disabled={isResolving}
                      >
                        <FileText size={16} />
                        <span>Generate &amp; Email Net-30 GST Invoice</span>
                      </button>
                    )}
                  </div>
                )}

                {/* TAB 7: ESCALATE TO HUMAN */}
                {activeTab === 'ESCALATE' && (
                  <div className="recovery-tab-content">
                    <div style={{ marginBottom: '0.85rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                        Escalate to Billing Specialist
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                        Self-serve recovery is restricted for this decline cause. Our operations team will assist you directly.
                      </div>
                    </div>

                    {escalatedMsg ? (
                      <div style={{ padding: '0.85rem', background: 'var(--accent-light)', border: '1px solid var(--accent-border)', borderRadius: 6, fontSize: '0.85rem', color: 'var(--accent-color)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Check size={14} />
                        <span>{escalatedMsg}</span>
                      </div>
                    ) : (
                      <button
                        className="btn-primary"
                        onClick={() => setEscalatedMsg('Ticket created in Billing Operations Queue. A specialist will contact you shortly.')}
                        disabled={isResolving}
                      >
                        <UserCheck size={16} />
                        <span>Request Priority Human Review</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          ) : (
            /* RECOVERED RECEIPT STATE */
            <div className="recovery-solution-box" style={{ borderColor: 'var(--accent-color)', background: 'var(--accent-light)' }}>
              <div className="solution-badge">
                <Check size={13} />
                <span>Payment Settlement Confirmed</span>
              </div>
              <div className="solution-message">
                <p style={{ fontWeight: 600, color: 'var(--accent-color)' }}>
                  Transaction Captured Idempotently on Razorpay
                </p>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.4rem', fontFamily: 'monospace' }}>
                  Payment ID: <strong>{caseData.razorpay_payment_id || `pay_upi_${caseData.id.toLowerCase()}`}</strong> • Settlement: Real-time on Alternative Rail
                </div>
              </div>
            </div>
          )}

          {/* Stepper Pipeline */}
          <div className="stepper-container">
            <div className="stepper-header">
              <ShieldCheck size={16} color="var(--accent-color)" />
              <span>Autonomous Triage Telemetry Pipeline</span>
            </div>

            <div className="stepper-track">
              <div className="step-item done">
                <div className="step-circle"><Check size={13} /></div>
                <div className="step-label">1. Ingested</div>
              </div>
              <div className={`step-item ${caseData.status !== 'NEW' ? 'done' : 'active'}`}>
                <div className="step-circle">2</div>
                <div className="step-label">2. Diagnosed</div>
              </div>
              <div className={`step-item ${caseData.status === 'INTERVENING' || caseData.status === 'RECOVERED' || caseData.status === 'ESCALATED' ? 'done' : 'active'}`}>
                <div className="step-circle">3</div>
                <div className="step-label">3. ML Ranked</div>
              </div>
              <div className={`step-item ${caseData.status === 'RECOVERED' ? 'done' : caseData.status === 'ESCALATED' ? 'active' : ''}`}>
                <div className="step-circle">{caseData.status === 'RECOVERED' ? <Check size={13} /> : '4'}</div>
                <div className="step-label">{caseData.status === 'RECOVERED' ? '4. Captured' : '4. Settle / Escalate'}</div>
              </div>
            </div>
          </div>

          {/* Split-Screen Demo Callout */}
          <div className="split-screen-banner">
            <Layers size={18} color="#68D391" style={{ flexShrink: 0 }} />
            <div>
              <strong>Live Telemetry Synced:</strong> Inspect the <strong>Triage Dispatch Dashboard (Right Screen)</strong> to see <code>{caseData.id}</code> update with audit logs, deterministic policy decisions, and machine learning rankings.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderStatusPage;
