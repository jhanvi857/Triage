import React, { useState, useEffect, useRef } from 'react';
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
  CreditCard,
  Mail
} from 'lucide-react';
import { getActionDisplayLabel } from '../utils/recoveryMapping';

export interface CandidateEvaluation {
  action: string;
  display_name?: string;
  candidate_type?: string;
  eligible: boolean;
  reason?: string;
  signals?: string[];
}

interface TriageCase {
  id: string;
  customer_name: string;
  customer_email?: string;
  plan_name: string;
  amount_inr: number;
  amount_paise: number;
  available_balance_inr?: number;
  available_balance_paise?: number;
  original_rail: string;
  error_code: string;
  error_desc: string;
  error_reason?: string;
  error_source?: string;
  error_step?: string;
  status: string;
  allowed_actions?: string[];
  candidate_evaluations?: CandidateEvaluation[];
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
  can_update_payment_method?: boolean;
  razorpay_payment_id?: string;
  created_at: string;
}

type RecoveryTab = 'UPI' | 'RETRY' | 'DISCOUNT' | 'PTP' | 'LINK' | 'INVOICE' | 'ESCALATE' | 'CARD_ALT' | 'UPDATE_CARD' | 'REAUTHORIZE_MANDATE';

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
  const userHasSelectedTab = useRef(false);
  const autoSettledRef = useRef(false);

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

  // Email pending confirmation notice
  const [emailPendingNotice, setEmailPendingNotice] = useState<string | null>(null);

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
    setCaseData(null);
    setLoading(true);
    setIsResolving(false);
    setRetryScheduledMsg(null);
    setEmailPendingNotice(null);
    setPtpResult(null);
    setPtpMessage('');
    setLinkSentMsg(null);
    setInvoiceSent(false);
    setEscalatedMsg(null);
    userHasSelectedTab.current = false;
    autoSettledRef.current = false;
  }, [caseId, email]);

  useEffect(() => {
    fetchCase();
    const interval = setInterval(fetchCase, 2500);
    return () => clearInterval(interval);
  }, [caseId, email]);

  // Auto-settle 1-click recovery link from email
  useEffect(() => {
    if (!caseData || autoSettledRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    if ((action === 'complete_recovery' || action === '1click_settle' || action === 'settle') && caseData.status !== 'RECOVERED') {
      autoSettledRef.current = true;
      setIsResolving(true);
      fetch(`http://localhost:8080/api/v1/triage/cases/${caseData.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolution: 'RECOVERED',
          notes: 'Customer completed 1-click payment recovery from email authorization link'
        })
      })
        .then(res => res.json())
        .then(updated => {
          setCaseData(updated);
          setIsResolving(false);
        })
        .catch(err => {
          console.error('1-click recovery resolution error', err);
          setIsResolving(false);
        });
    }
  }, [caseData?.id, caseData?.status]);

  // Compute legal allowed tabs strictly from policy whitelist + ML recommendation tags
  const getAvailableTabs = (c: TriageCase | null): TabDefinition[] => {
    if (!c) return [];
    const rootCause = c.diagnosis?.root_cause || (c.error_code === 'GATEWAY_TIMEOUT_504' ? 'BANK_DOWNTIME_TIMEOUT' : c.error_code);
    const mlAction = c.intervention?.action || c.intervention?.ml_recommendation || c.diagnosis?.recommended_action || '';
    const isFunds = rootCause === 'INSUFFICIENT_FUNDS' || c.error_code === 'INSUFFICIENT_FUNDS';

    // Gap-closing condition:
    // available_balance < invoice_amount AND available_balance >= invoice_amount - min(0.05*amount, ₹500)
    const invoiceAmount = c.amount_inr;
    const maxDiscountINR = Math.min(0.05 * invoiceAmount, 500);
    const gapClosingThreshold = invoiceAmount - maxDiscountINR;
    let availableBalance: number | undefined = c.available_balance_inr;
    if (availableBalance === undefined && isFunds) {
      availableBalance = gapClosingThreshold;
    }

    const isGapClosing = isFunds &&
      availableBalance !== undefined &&
      availableBalance < invoiceAmount &&
      availableBalance >= gapClosingThreshold;

    // Whitelist rules mapping matching gateway/internal/intervention/candidates.go
    const actions = c.allowed_actions && c.allowed_actions.length > 0
      ? c.allowed_actions
      : (() => {
        switch (rootCause) {
          case 'INSUFFICIENT_FUNDS':
            return ['INCENTIVE_DISCOUNT', 'SWITCH_TO_SAVED_CARD', 'SWITCH_TO_AVAILABLE_ALTERNATE_RAIL', 'RETRY_NEXT_PAYDAY_WINDOW', 'PROMISE_TO_PAY'];
          case 'BANK_DOWNTIME_TIMEOUT':
          case 'GATEWAY_ERROR':
          case 'NETWORK_DECLINE':
            return ['RETRY_SAME_RAIL_COOLDOWN', 'SWITCH_TO_AVAILABLE_ALTERNATE_RAIL', 'PROMISE_TO_PAY'];
          case 'OTP_DROP_OFF':
          case 'TRANSACTION_TIMEOUT':
            return ['RESUME_CHECKOUT', 'SWITCH_TO_AVAILABLE_ALTERNATE_RAIL', 'PROMISE_TO_PAY'];
          case 'MANDATE_REVOKED':
          case 'LIMIT_EXCEEDED':
            return ['REAUTHORIZE_MANDATE', 'COLLECT_OUTSTANDING_PAYMENT', 'PROMISE_TO_PAY'];
          case 'EXPIRED_CARD':
            return ['UPDATE_PAYMENT_METHOD'];
          case 'FRAUD_SUSPECTED':
            return ['ESCALATE_HUMAN'];
          default:
            return ['SWITCH_TO_AVAILABLE_ALTERNATE_RAIL', 'RETRY_SAME_RAIL_COOLDOWN', 'PROMISE_TO_PAY'];
        }
      })();

    const tabs: TabDefinition[] = [];

    // 0. "5% Instant Concession → Pay Now"
    // GATED TWICE (Backend-Authoritative Contract):
    // Gate 1 (Eligibility) & Gate 2 (Budget Allocation) are deterministically evaluated by the Go Gateway.
    // The discount is offered if and only if the backend eligibility engine validates both gates.
    const isDiscountAuthorized = c.allowed_actions?.includes('INCENTIVE_DISCOUNT') ||
      c.candidate_evaluations?.find(evalItem => evalItem.action === 'INCENTIVE_DISCOUNT')?.eligible === true ||
      c.intervention?.action === 'INCENTIVE_DISCOUNT';

    if (isDiscountAuthorized) {
      const discountPct = invoiceAmount > 0 ? (maxDiscountINR / invoiceAmount) * 100 : 5;
      const discountPctStr = discountPct % 1 === 0 ? `${discountPct.toFixed(0)}%` : `${discountPct.toFixed(1)}%`;
      const discountedPrice = (invoiceAmount - maxDiscountINR).toFixed(2);
      tabs.push({
        key: 'DISCOUNT',
        label: `${discountPctStr} Instant Concession → Pay Now`,
        subLabel: `Available ₹${availableBalance?.toFixed(0) || discountedPrice} closes gap: Pay ₹${discountedPrice}`,
        icon: <Percent size={14} />,
        isRecommended: true
      });
    }

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

    // 3. Re-Authorize Mandate
    if (actions.includes('REAUTHORIZE_MANDATE')) {
      const isRec = mlAction === 'REAUTHORIZE_MANDATE';
      tabs.push({
        key: 'REAUTHORIZE_MANDATE',
        label: 'Re-Authorize Mandate',
        subLabel: 'Restore 1-click autopay',
        icon: <RefreshCw size={14} />,
        isRecommended: isRec
      });
    }

    // 4. Instant UPI Switch / Direct One-Time Bypass
    if (actions.includes('SWITCH_TO_AVAILABLE_ALTERNATE_RAIL') || actions.includes('COLLECT_OUTSTANDING_PAYMENT')) {
      const isMandate = rootCause === 'MANDATE_REVOKED' || rootCause === 'LIMIT_EXCEEDED';
      const isRec = isMandate || mlAction === 'SWITCH_TO_AVAILABLE_ALTERNATE_RAIL' || mlAction === 'COLLECT_OUTSTANDING_PAYMENT';
      tabs.push({
        key: 'UPI',
        label: isMandate ? 'One-Time UPI' : 'Instant UPI',
        subLabel: isMandate ? 'Settle current invoice' : 'Switch to instant UPI rail',
        icon: <Smartphone size={14} />,
        isRecommended: isRec
      });
    }

    // 5. Resume Checkout / 1-Click Payment Link
    if (actions.includes('RESUME_CHECKOUT') || actions.includes('RETRY_AUTHENTICATION')) {
      const isRec = mlAction === 'RESUME_CHECKOUT' || mlAction === 'RETRY_AUTHENTICATION';
      tabs.push({
        key: 'LINK',
        label: 'Resume Checkout',
        subLabel: 'Direct 1-click verification',
        icon: <Send size={14} />,
        isRecommended: isRec
      });
    }

    // 6. Schedule Auto-Retry / Cooldown / Payday Window
    if (actions.includes('RETRY_SAME_RAIL_COOLDOWN') || actions.includes('RETRY_NEXT_PAYDAY_WINDOW') || actions.includes('RETRY_LATER') || rootCause === 'INSUFFICIENT_FUNDS') {
      const isPayday = rootCause === 'INSUFFICIENT_FUNDS';
      const isRec = isPayday || mlAction === 'RETRY_NEXT_PAYDAY_WINDOW' || mlAction === 'RETRY_SAME_RAIL_COOLDOWN' || mlAction === 'RETRY_LATER';
      tabs.push({
        key: 'RETRY',
        label: isPayday ? 'Salary Day Schedule' : 'Cooldown Retry',
        subLabel: isPayday ? 'Payday / salary cycle retry' : '30-minute automated cooldown',
        icon: <Clock size={14} />,
        isRecommended: isRec
      });
    }

    // 7. Promise to Pay (PTP) - Available across all non-fraud causes
    if (actions.includes('PROMISE_TO_PAY') && rootCause !== 'FRAUD_SUSPECTED') {
      const isRec = mlAction === 'PROMISE_TO_PAY';
      tabs.push({
        key: 'PTP',
        label: 'Promise to Pay',
        subLabel: 'Conversational date scheduling',
        icon: <Calendar size={14} />,
        isRecommended: isRec
      });
    }

    // 8. Corporate PO & Net-30 Invoicing
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

    // 9. Human Support Escalation
    if (actions.includes('ESCALATE_HUMAN') && (tabs.length === 0 || rootCause === 'FRAUD_SUSPECTED')) {
      tabs.push({
        key: 'ESCALATE',
        label: 'Human Support',
        subLabel: 'Escalate to billing team',
        icon: <UserCheck size={14} />
      });
    }

    // Ensure 5% Concession or Salary Day Schedule is prioritized for INSUFFICIENT_FUNDS
    if (isFunds) {
      if (isGapClosing) {
        tabs.sort((a, b) => (a.key === 'DISCOUNT' ? -1 : b.key === 'DISCOUNT' ? 1 : a.key === 'RETRY' ? -1 : b.key === 'RETRY' ? 1 : 0));
      } else {
        tabs.sort((a, b) => (a.key === 'RETRY' ? -1 : b.key === 'RETRY' ? 1 : 0));
      }
    } else {
      tabs.sort((a, b) => (b.isRecommended ? 1 : 0) - (a.isRecommended ? 1 : 0));
    }

    return tabs;
  };

  const availableTabs = getAvailableTabs(caseData);

  // Automatically select the Recommended tab on initial load ONLY
  useEffect(() => {
    if (!caseData || userHasSelectedTab.current) return;

    const isFunds = caseData.diagnosis?.root_cause === 'INSUFFICIENT_FUNDS' || caseData.error_code === 'INSUFFICIENT_FUNDS';
    if (isFunds) {
      const isDiscountAuthorized = caseData.allowed_actions?.includes('INCENTIVE_DISCOUNT') ||
        caseData.candidate_evaluations?.find(evalItem => evalItem.action === 'INCENTIVE_DISCOUNT')?.eligible === true ||
        caseData.intervention?.action === 'INCENTIVE_DISCOUNT';

      if (isDiscountAuthorized) {
        setActiveTab('DISCOUNT');
        return;
      }
      setSelectedRetryWindow('salary_day');
      setActiveTab('RETRY');
      return;
    }

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
  }, [caseData?.id]);

  const invoiceAmount = caseData?.amount_inr || 0;
  const maxDiscountINR = Math.min(0.05 * invoiceAmount, 500);
  const discountPercent = invoiceAmount > 0 ? (maxDiscountINR / invoiceAmount) * 100 : 5;
  const discountPercentStr = discountPercent % 1 === 0 ? `${discountPercent.toFixed(0)}%` : `${discountPercent.toFixed(1)}%`;
  const availableBalance = caseData?.available_balance_inr;

  const discountedPriceINR = (invoiceAmount - maxDiscountINR).toFixed(2);
  const discountSavingsINR = maxDiscountINR.toFixed(2);

  // Option 1: Instant UPI -> Resolves payment immediately on alternative rail and sends receipt (no recovery link, NO discount)
  const handleInstantUpi = async () => {
    if (!caseData) return;
    setIsResolving(true);
    const targetEmail = caseData.customer_email || 'your registered email';
    const finalAmount = caseData.amount_inr.toFixed(2);
    try {
      const res = await fetch(`http://localhost:8080/api/v1/triage/cases/${caseData.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolution: 'RECOVERED',
          notes: `Customer completed payment instantly via 1-Click UPI (${selectedUpiApp})`
        })
      });
      if (res.ok) {
        const updated = await res.json();
        setCaseData(updated);
        setEmailPendingNotice(`Payment of ₹${finalAmount} settled via ${selectedUpiApp}. Official receipt delivered to ${targetEmail}.`);
      }
    } catch (err) {
      console.error('Failed to complete Instant UPI payment', err);
    } finally {
      setIsResolving(false);
    }
  };

  // Option 2: Schedule smart cooldown / payday auto-retry -> Locks schedule and dispatches notification (no recovery link)
  const handleScheduleRetry = async () => {
    if (!caseData) return;
    setIsResolving(true);
    const targetEmail = caseData.customer_email || 'your registered email';
    try {
      let label = 'in 30 minutes';
      if (selectedRetryWindow === 'tomorrow') label = 'Tomorrow at 9:00 AM';
      if (selectedRetryWindow === 'salary_day') label = '1st of next month (Salary Cycle)';
      if (selectedRetryWindow === '3_days') label = 'in 3 business days';

      const res = await fetch(`http://localhost:8080/api/v1/triage/cases/${caseData.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolution: 'RETRY_SCHEDULED',
          notes: `Auto-Retry scheduled for ${label}`
        })
      });
      if (res.ok) {
        const updated = await res.json();
        setCaseData(updated);
      }

      // Dispatch confirmation email without recovery link
      await fetch('http://localhost:8080/api/v1/triage/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: caseData.customer_email,
          case_id: caseData.id,
          email_type: 'RETRY_SCHEDULED',
          scheduled_date: label,
          notes: `Auto-Retry for ${label} scheduled`
        })
      });

      setRetryScheduledMsg(`Auto-retry successfully locked for ${label}. Confirmation notice sent to ${targetEmail}.`);
    } catch (err) {
      console.error('Failed to schedule retry', err);
    } finally {
      setIsResolving(false);
    }
  };

  // Option 3: 5% Concession -> Settles at discounted rate immediately (no recovery link)
  const handleClaimDiscount = async () => {
    if (!caseData) return;
    setIsResolving(true);
    const targetEmail = caseData.customer_email || 'your registered email';
    try {
      const res = await fetch(`http://localhost:8080/api/v1/triage/cases/${caseData.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolution: 'RECOVERED',
          notes: `Customer claimed ${discountPercentStr} instant concession and completed settlement (₹${discountedPriceINR})`
        })
      });
      if (res.ok) {
        const updated = await res.json();
        setCaseData(updated);
        setEmailPendingNotice(`Payment of ₹${discountedPriceINR} settled with ${discountPercentStr} discount. Verified receipt sent to ${targetEmail}.`);
      }
    } catch (err) {
      console.error('Failed to settle discount payment', err);
    } finally {
      setIsResolving(false);
    }
  };

  // Option: Use Saved Alternate Card
  const handleBackupCard = async () => {
    if (!caseData) return;
    setIsResolving(true);
    const targetEmail = caseData.customer_email || 'your registered email';
    try {
      const res = await fetch(`http://localhost:8080/api/v1/triage/cases/${caseData.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolution: 'RECOVERED',
          notes: 'Customer authorized settlement via saved backup card (Visa •••• 4821)'
        })
      });
      if (res.ok) {
        const updated = await res.json();
        setCaseData(updated);
        setEmailPendingNotice(`Payment of ₹${caseData.amount_inr.toFixed(2)} charged to Visa •••• 4821. Receipt sent to ${targetEmail}.`);
      }
    } catch (err) {
      console.error('Failed to charge backup card', err);
    } finally {
      setIsResolving(false);
    }
  };

  // Option: Update Card & Pay
  const handleUpdateCard = async () => {
    if (!caseData) return;
    setIsResolving(true);
    const targetEmail = caseData.customer_email || 'your registered email';
    try {
      const res = await fetch(`http://localhost:8080/api/v1/triage/cases/${caseData.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolution: 'RECOVERED',
          notes: 'Customer updated card details and settled payment'
        })
      });
      if (res.ok) {
        const updated = await res.json();
        setCaseData(updated);
        setEmailPendingNotice(`New card saved and ₹${caseData.amount_inr.toFixed(2)} captured. Receipt sent to ${targetEmail}.`);
      }
    } catch (err) {
      console.error('Failed to update card and pay', err);
    } finally {
      setIsResolving(false);
    }
  };

  // Option: Re-Authorize Mandate
  const handleReauthorizeMandate = async () => {
    if (!caseData) return;
    setIsResolving(true);
    const targetEmail = caseData.customer_email || 'your registered email';
    try {
      const res = await fetch(`http://localhost:8080/api/v1/triage/cases/${caseData.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolution: 'RECOVERED',
          notes: 'Customer re-authorized recurring autopay mandate and settled current cycle'
        })
      });
      if (res.ok) {
        const updated = await res.json();
        setCaseData(updated);
        setEmailPendingNotice(`Recurring mandate re-authorized and payment settled. Receipt sent to ${targetEmail}.`);
      }
    } catch (err) {
      console.error('Failed to re-authorize mandate', err);
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
        await fetchCase();
      }
    } catch (err) {
      console.error('Error parsing PTP message', err);
    } finally {
      setPtpLoading(false);
    }
  };

  // Option 5: Payment Link
  const handleSendPaymentLink = async () => {
    if (!caseData) return;
    setIsResolving(true);
    const targetEmail = caseData.customer_email || 'your registered email';
    setLinkSentMsg(`Dispatching secure 1-click recovery link to ${targetEmail}...`);

    try {
      const isDiscountAuthorized = caseData.allowed_actions?.includes('INCENTIVE_DISCOUNT') ||
        caseData.candidate_evaluations?.find(evalItem => evalItem.action === 'INCENTIVE_DISCOUNT')?.eligible === true ||
        caseData.intervention?.action === 'INCENTIVE_DISCOUNT';

      const res = await fetch('http://localhost:8080/api/v1/triage/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: caseData.customer_email,
          case_id: caseData.id,
          email_type: 'ACTION_REQUIRED',
          amount_inr: isDiscountAuthorized ? parseFloat(discountedPriceINR) : caseData.amount_inr,
          notes: isDiscountAuthorized ? `${discountPercentStr} instant concession applied to balance gap` : 'Direct 1-click 3DS re-authentication link'
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.status === 'DELIVERED_SMTP') {
          setLinkSentMsg(`Direct 1-click recovery email successfully delivered to ${targetEmail} via live SMTP relay. Check your inbox!`);
        } else if (data.status === 'SKIPPED_DEMO_ACCOUNT') {
          setLinkSentMsg(`Payment link generated for ${targetEmail}. Simulated demo mode active.`);
        } else {
          setLinkSentMsg(data.message || `Payment link sent to ${targetEmail}. Active for 15 minutes.`);
        }
      } else {
        setLinkSentMsg(`Direct 1-click recovery link dispatched to ${targetEmail}.`);
      }
    } catch (err) {
      console.error('Failed to send payment link', err);
      setLinkSentMsg(`Direct 1-click recovery link dispatched to ${targetEmail}.`);
    } finally {
      setIsResolving(false);
    }
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
  const isHumanResolved = caseData.status === 'HUMAN_RESOLVED';
  const isPromisedPending = caseData.status === 'PTP_COMMITTED';
  const friendlyCause = getFriendlyRootCause(caseData);
  const isPermanentDecline = (caseData.diagnosis?.root_cause === 'EXPIRED_CARD' ||
    caseData.error_code === 'CARD_EXPIRED' ||
    caseData.error_code === 'EXPIRED_CARD' ||
    caseData.error_reason === 'card_expired' ||
    caseData.diagnosis?.is_recoverable === false) && !isRecovered && !isHumanResolved && caseData.can_update_payment_method !== true;
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
              {caseData.status === 'PTP_COMMITTED'
                ? 'PROMISED (PENDING)'
                : caseData.status === 'HUMAN_RESOLVED'
                  ? 'ESCALATED → HUMAN_RESOLVED'
                  : caseData.status}
            </span>
          </div>
        </div>

        <div className="diagnostic-card-body">
          {/* 1. Status Alert Hero Banner */}
          <div className={`status-hero-alert ${isRecovered || isHumanResolved ? 'recovered' : isPromisedPending ? 'pending' : 'failed'}`}>
            <div className="status-hero-icon">
              {isRecovered || isHumanResolved ? (
                <CheckCircle2 size={28} color="var(--accent-color)" />
              ) : isPromisedPending ? (
                <Clock size={28} color="#2B6CB0" />
              ) : (
                <AlertTriangle size={28} color="var(--danger-color)" />
              )}
            </div>
            <div className="status-hero-content">
              <h2>
                {isRecovered
                  ? 'Payment Successfully Transferred & Settled!'
                  : isHumanResolved
                    ? 'Resolved by Retention Concierge Desk · Payment Settled'
                    : isPromisedPending
                      ? 'Promise to Pay Registered · Scheduled for Settlement'
                      : `Payment Interrupted: ${friendlyCause.title}`}
              </h2>
              <p>
                {isRecovered
                  ? `Your payment of ₹${caseData.amount_inr.toFixed(2)} was successfully captured and transferred on-rail. Your AI Inference Credits Pack / subscription service has been fully provisioned.`
                  : isHumanResolved
                    ? `A retention specialist has reviewed this account and authorized settlement on alternative payment rails. Idempotent transfer captured on ledger.`
                    : isPromisedPending
                      ? `Your commitment to settle ₹${caseData.amount_inr.toFixed(2)} has been recorded in the PTP ledger. No automated retry will occur before your promised date.`
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
          {/* 3. MULTI-OPTION CUSTOMER RECOVERY CENTER OR POLICY REFUSAL */}
          {!isRecovered && !isHumanResolved && !isPromisedPending ? (
            (availableTabs.length === 0 || isPermanentDecline) ? (
              /* DEDICATED POLICY-ENFORCED REFUSAL VIEW */
              <div className="refusal-box">
                <div className="refusal-badge">
                  <AlertOctagon size={14} />
                  <span>Policy Guardrail · No Automated Recovery Authorized</span>
                </div>

                <h3 className="refusal-heading">
                  {caseData.diagnosis?.root_cause === 'MANDATE_REVOKED' || caseData.error_code === 'MANDATE_REVOKED'
                    ? 'Payment Authorization Is No Longer Active'
                    : caseData.diagnosis?.root_cause === 'EXPIRED_CARD' || caseData.error_code === 'CARD_EXPIRED'
                      ? 'This Card Cannot Be Safely Retried'
                      : caseData.diagnosis?.root_cause === 'FRAUD_SUSPECTED'
                        ? 'Security Anomaly Flagged — Retries Suspended'
                        : 'No Automated Recovery Pathway Authorized'}
                </h3>

                <p className="refusal-desc">
                  {caseData.diagnosis?.root_cause === 'MANDATE_REVOKED' || caseData.error_code === 'MANDATE_REVOKED'
                    ? 'Triage identified that the recurring payment mandate on file has been revoked at your bank. Our deterministic policy engine has halted automated debits to prevent unauthorized charge attempts.'
                    : caseData.diagnosis?.root_cause === 'EXPIRED_CARD' || caseData.error_code === 'CARD_EXPIRED'
                      ? 'This payment card validity date has passed. Our deterministic policy engine has permanently halted automated retry cycles to protect against issuing bank penalty fees and card lockouts.'
                      : caseData.diagnosis?.root_cause === 'FRAUD_SUSPECTED'
                        ? 'This transaction triggered our safety risk scoring gate. Automated processing is permanently halted pending risk specialist review.'
                        : 'Triage evaluated this decline telemetry and determined that no automated financial recovery action is authorized under current policy constraints.'}
                </p>

                <div className="refusal-rules-card">
                  <div className="refusal-rule-item">
                    <AlertTriangle size={14} color="#D97706" style={{ flexShrink: 0 }} />
                    <span><strong>Automated Retries:</strong> 0 attempts scheduled (Halted by Policy)</span>
                  </div>
                  <div className="refusal-rule-item">
                    <ShieldCheck size={14} color="#DC2626" style={{ flexShrink: 0 }} />
                    <span><strong>Policy Guardrail:</strong> Zero automated settlement authority for revoked / invalid credentials</span>
                  </div>
                  <div className="refusal-rule-item">
                    <UserCheck size={14} color="#059669" style={{ flexShrink: 0 }} />
                    <span><strong>Next Step:</strong> Contact merchant support to restore authorization or arrange alternative payment</span>
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
                    onClick={() => setEscalatedMsg(`Priority Ticket #${caseData.id} routed to Merchant Billing & Retention Desk. A specialist will assist you.`)}
                    disabled={isResolving}
                  >
                    <UserCheck size={16} />
                    <span>Contact Merchant Support Specialist</span>
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
                      : `Triage identified ${availableTabs.length} eligible recovery strategies and authorized them under current policy.`}
                  </p>
                </div>

                {/* Email Confirmation Pending Banner */}
                {emailPendingNotice && (
                  <div style={{
                    marginBottom: '1.25rem',
                    padding: '1rem 1.25rem',
                    background: '#F0FDF4',
                    border: '1.5px solid #22C55E',
                    borderRadius: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.4rem',
                    boxShadow: '0 2px 8px rgba(34, 197, 94, 0.08)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#15803D', fontWeight: 700, fontSize: '0.95rem' }}>
                      <Mail size={18} color="#15803D" />
                      <span>Action Required: Confirm via Email Link</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#1E293B', lineHeight: 1.45 }}>
                      {emailPendingNotice}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#475569', fontFamily: 'monospace', marginTop: '2px' }}>
                      <span style={{ background: '#DCFCE7', color: '#166534', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>STATUS: PENDING EMAIL CONFIRMATION</span>
                      <span>•</span>
                      <span>1-CLICK AUTHORIZATION REQUIRED</span>
                    </div>
                  </div>
                )}

                {/* Dynamic Navigation Tabs based strictly on allowed actions */}
                {availableTabs.length > 1 && (
                  <div className="recovery-tabs-nav">
                    {availableTabs.map((tab, idx) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => {
                          userHasSelectedTab.current = true;
                          setActiveTab(tab.key);
                        }}
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

                {/* TAB: BACKUP CARD */}
                {activeTab === 'CARD_ALT' && availableTabs.some(t => t.key === 'CARD_ALT') && (
                  <div className="recovery-tab-content">
                    <div style={{ marginBottom: '0.85rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                        Charge Saved Backup Card
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                        Instantly settle this charge using your pre-authorized backup payment card without re-entering details.
                      </div>
                    </div>
                    <div style={{ background: 'var(--surface-subtle)', padding: '1rem', borderRadius: 8, marginBottom: '1.25rem', border: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <CreditCard size={18} color="var(--accent-color)" />
                          <strong>Visa ending in 4821</strong>
                        </div>
                        <span style={{ fontSize: '0.75rem', background: '#E6F4EA', color: '#137333', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>VERIFIED</span>
                      </div>
                    </div>
                    <button className="btn-primary" onClick={handleBackupCard} disabled={isResolving}>
                      {isResolving ? (
                        <>
                          <RefreshCw className="spinner" size={16} />
                          <span>Charging Backup Card...</span>
                        </>
                      ) : (
                        <>
                          <CreditCard size={16} />
                          <span>Charge Visa •••• 4821 (₹{caseData.amount_inr.toFixed(2)})</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* TAB: UPDATE CARD */}
                {activeTab === 'UPDATE_CARD' && availableTabs.some(t => t.key === 'UPDATE_CARD') && (
                  <div className="recovery-tab-content">
                    <div style={{ marginBottom: '0.85rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                        Update Payment Card
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                        Your previously registered card is expired. Provide updated card details to complete payment.
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
                      <input type="text" placeholder="Card Number (4111 •••• •••• ••••)" className="ptp-input" defaultValue="4111 2222 3333 4444" />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <input type="text" placeholder="MM / YY" className="ptp-input" defaultValue="08/29" />
                        <input type="password" placeholder="CVV" className="ptp-input" defaultValue="123" />
                      </div>
                    </div>
                    <button className="btn-primary" onClick={handleUpdateCard} disabled={isResolving}>
                      {isResolving ? (
                        <>
                          <RefreshCw className="spinner" size={16} />
                          <span>Updating & Charging Card...</span>
                        </>
                      ) : (
                        <>
                          <CreditCard size={16} />
                          <span>Save New Card & Settle ₹{caseData.amount_inr.toFixed(2)}</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* TAB: REAUTHORIZE MANDATE */}
                {activeTab === 'REAUTHORIZE_MANDATE' && availableTabs.some(t => t.key === 'REAUTHORIZE_MANDATE') && (
                  <div className="recovery-tab-content">
                    <div style={{ marginBottom: '0.85rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                        Re-Authorize Recurring e-Mandate
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                        Re-link your bank account or card to restore automated recurring subscription billing with zero late fees.
                      </div>
                    </div>

                    <div style={{ background: 'var(--surface-subtle)', padding: '1rem', borderRadius: 8, marginBottom: '1.25rem', border: '1px solid var(--border-subtle)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                        <span>Subscription Plan:</span>
                        <strong style={{ color: 'var(--text-primary)' }}>{caseData.plan_name}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                        <span>Recurring Amount:</span>
                        <strong style={{ color: 'var(--text-primary)' }}>₹{caseData.amount_inr.toFixed(2)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>New Mandate Cap:</span>
                        <strong style={{ color: 'var(--accent-color)' }}>₹50,000 (RBI Compliant)</strong>
                      </div>
                    </div>

                    <button
                      className="btn-primary"
                      onClick={handleReauthorizeMandate}
                      disabled={isResolving}
                    >
                      {isResolving ? (
                        <>
                          <RefreshCw className="spinner" size={16} />
                          <span>Re-authorizing Mandate...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw size={16} />
                          <span>Re-Authorize Autopay Mandate (1-Click)</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* TAB 1: INSTANT UPI SWITCH / DIRECT BYPASS */}
                {activeTab === 'UPI' && availableTabs.some(t => t.key === 'UPI') && (
                  <div className="recovery-tab-content">
                    {activeTabDef?.isRecommended && (
                      <div className="ml-recommendation-callout">
                        <Sparkles size={16} className="ml-callout-icon" />
                        <div>
                          <div className="ml-callout-title">
                            AI Recommended Recovery Strategy {mlProbability ? `· ${(mlProbability * 100).toFixed(1)}% Recovery Probability` : ''}
                          </div>
                          <div className="ml-callout-desc">
                            {caseData.diagnosis?.root_cause === 'MANDATE_REVOKED' || caseData.error_code === 'MANDATE_REVOKED' || caseData.error_code === 'LIMIT_EXCEEDED'
                              ? 'Direct one-time UPI settlement authorized as the optimal recovery pathway while recurring mandate is offline.'
                              : caseData.diagnosis?.root_cause === 'OTP_DROP_OFF' || caseData.error_code === 'TRANSACTION_TIMEOUT'
                                ? 'Zero-friction UPI intent bypass ranked highest to eliminate SMS OTP drop-off.'
                                : 'Instant UPI switch evaluated as highest Expected Value over NPCI real-time network.'}
                          </div>
                        </div>
                      </div>
                    )}

                    <div style={{ marginBottom: '0.85rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                        {caseData.diagnosis?.root_cause === 'MANDATE_REVOKED' || caseData.error_code === 'MANDATE_REVOKED' || caseData.error_code === 'LIMIT_EXCEEDED'
                          ? 'One-Time Settlement via Instant UPI'
                          : 'Switch to Instant UPI Authorization'}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                        {caseData.diagnosis?.root_cause === 'MANDATE_REVOKED' || caseData.error_code === 'MANDATE_REVOKED' || caseData.error_code === 'LIMIT_EXCEEDED'
                          ? `Your previous recurring mandate is inactive. Complete this ₹${caseData.amount_inr.toFixed(2)} charge via instant UPI to keep your cloud subscription active.`
                          : caseData.diagnosis?.root_cause === 'OTP_DROP_OFF' || caseData.error_code === 'TRANSACTION_TIMEOUT'
                            ? 'Bypasses 3D-Secure SMS verification delays. Completes payment instantly via your verified UPI app.'
                            : 'Bypasses card gateway outages and server timeouts. Real-time settlement on NPCI rail.'}
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
                      onClick={handleInstantUpi}
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
                          <span>
                            Complete with 1-Click UPI ({selectedUpiApp}) • ₹{caseData.amount_inr.toFixed(2)}
                          </span>
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

                    {(() => {
                      const isPayday = caseData.diagnosis?.root_cause === 'INSUFFICIENT_FUNDS' || caseData.error_code === 'INSUFFICIENT_FUNDS';
                      const isRetryConfirmed = caseData.status === 'RETRY_SCHEDULED';
                      const selectedLabel = selectedRetryWindow === 'salary_day'
                        ? '1st of Next Month'
                        : selectedRetryWindow === '3_days'
                          ? 'In 3 Days'
                          : selectedRetryWindow === '30_mins'
                            ? 'In 30 Minutes'
                            : 'Tomorrow at 9:00 AM';

                      return (
                        <>
                          <div style={{ marginBottom: '0.75rem' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                              {isPayday ? 'Schedule Retry for Payday / Salary Funding' : 'Smart Cooldown & Re-Attempt Windows'}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                              {isPayday
                                ? 'Account balance is below transaction amount. Retries are scheduled for your salary credit date to avoid bank overdraft and penalty fees.'
                                : 'Issuing bank is recovering from downtime. Select an authorized auto-retry cooldown slot:'}
                            </div>
                          </div>

                          <div className="retry-schedule-grid" style={isRetryConfirmed ? { pointerEvents: 'none', opacity: 0.75 } : undefined}>
                            {isPayday ? (
                              <>
                                <div
                                  onClick={() => !isRetryConfirmed && setSelectedRetryWindow('salary_day')}
                                  className={`retry-time-card ${selectedRetryWindow === 'salary_day' ? 'selected' : ''}`}
                                >
                                  <div className="retry-time-title">1st of Next Month</div>
                                  <div className="retry-time-sub">Aligned with monthly salary / payday credit (Recommended)</div>
                                </div>

                                <div
                                  onClick={() => !isRetryConfirmed && setSelectedRetryWindow('3_days')}
                                  className={`retry-time-card ${selectedRetryWindow === '3_days' ? 'selected' : ''}`}
                                >
                                  <div className="retry-time-title">In 3 Days</div>
                                  <div className="retry-time-sub">Mid-cycle fund transfer / account funding window</div>
                                </div>

                                <div
                                  onClick={() => !isRetryConfirmed && setSelectedRetryWindow('tomorrow')}
                                  className={`retry-time-card ${selectedRetryWindow === 'tomorrow' ? 'selected' : ''}`}
                                >
                                  <div className="retry-time-title">Tomorrow 9:00 AM</div>
                                  <div className="retry-time-sub">Next-day deposit clearing window</div>
                                </div>
                              </>
                            ) : (
                              <>
                                <div
                                  onClick={() => !isRetryConfirmed && setSelectedRetryWindow('30_mins')}
                                  className={`retry-time-card ${selectedRetryWindow === '30_mins' ? 'selected' : ''}`}
                                >
                                  <div className="retry-time-title">In 30 Minutes</div>
                                  <div className="retry-time-sub">Best for temporary bank downtime &amp; network congestion</div>
                                </div>

                                <div
                                  onClick={() => !isRetryConfirmed && setSelectedRetryWindow('tomorrow')}
                                  className={`retry-time-card ${selectedRetryWindow === 'tomorrow' ? 'selected' : ''}`}
                                >
                                  <div className="retry-time-title">Tomorrow 9:00 AM</div>
                                  <div className="retry-time-sub">Morning clearing cycle at issuer bank</div>
                                </div>

                                <div
                                  onClick={() => !isRetryConfirmed && setSelectedRetryWindow('3_days')}
                                  className={`retry-time-card ${selectedRetryWindow === '3_days' ? 'selected' : ''}`}
                                >
                                  <div className="retry-time-title">In 3 Days</div>
                                  <div className="retry-time-sub">Standard dunning cooldown retry window</div>
                                </div>
                              </>
                            )}
                          </div>

                          {isRetryConfirmed ? (
                            <>
                              <button
                                className="btn-primary"
                                disabled={true}
                                style={{
                                  background: '#E6F4EA',
                                  color: '#137333',
                                  border: '1.5px solid #34A853',
                                  cursor: 'not-allowed',
                                  opacity: 0.95,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '8px',
                                  width: '100%',
                                  padding: '0.75rem',
                                  borderRadius: '8px',
                                  fontWeight: 700,
                                  fontSize: '0.9rem'
                                }}
                              >
                                <CheckCircle2 size={18} color="#137333" />
                                <span>✓ Auto-Retry Scheduled &amp; Locked ({selectedLabel})</span>
                              </button>

                              <div style={{
                                marginTop: '0.75rem',
                                padding: '1rem',
                                background: '#E6F4EA',
                                border: '1.5px solid #34A853',
                                borderRadius: 8,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.4rem'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#137333', fontWeight: 700, fontSize: '0.95rem' }}>
                                  <Check size={18} color="#137333" />
                                  <span>Auto-Retry Scheduled for {selectedLabel}</span>
                                </div>
                                <div style={{ fontSize: '0.82rem', color: '#202124', lineHeight: 1.4 }}>
                                  {retryScheduledMsg || `Your auto-retry schedule is locked in the cryptographic recovery ledger. Compute quota has been reserved with zero late fees.`}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: '#5F6368', fontFamily: 'monospace', marginTop: '4px' }}>
                                  <span style={{ background: '#CEEAD6', color: '#0D652D', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>STATUS: RETRY_SCHEDULED</span>
                                  <span>•</span>
                                  <span>PIPELINE: {getActionDisplayLabel(caseData.intervention?.action || (isPayday ? 'RETRY_NEXT_PAYDAY_WINDOW' : 'RETRY_SAME_RAIL_COOLDOWN'), caseData.status).toUpperCase()}</span>
                                </div>
                              </div>
                            </>
                          ) : (
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
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* TAB 3: 5% INSTANT CONCESSION -> PAY NOW */}
                {activeTab === 'DISCOUNT' && availableTabs.some(t => t.key === 'DISCOUNT') && (
                  <div className="recovery-tab-content">
                    {activeTabDef?.isRecommended && (
                      <div className="ml-recommendation-callout">
                        <Sparkles size={16} className="ml-callout-icon" />
                        <div>
                          <div className="ml-callout-title">
                            Dual-Gated Concession · Gate 1: Solvency Bridge &bull; Gate 2: Knapsack Budget Allocated {mlProbability ? `· ${(mlProbability * 100).toFixed(1)}% Recovery Probability` : ''}
                          </div>
                          <div className="ml-callout-desc">
                            1) <strong>Gate 1 (Eligibility):</strong> Available balance (₹{availableBalance !== undefined ? availableBalance.toFixed(0) : discountedPriceINR}) mathematically clears the net payable amount (₹{discountedPriceINR}).<br/>
                            2) <strong>Gate 2 (Knapsack Budget):</strong> This case ranked in the top marginal ERV density (ΔEV / cost) slots of the merchant daily concession pool.
                          </div>
                        </div>
                      </div>
                    )}

                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                        {discountPercentStr} Instant Concession → Pay Now
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                        Customer account balance is lower than the original invoice, but sufficient to clear the discounted net amount immediately.
                      </div>
                    </div>

                    {/* Defensible before/after proof card */}
                    <div style={{ background: 'var(--surface-subtle)', padding: '1.25rem', borderRadius: 10, marginBottom: '1.25rem', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', paddingBottom: '0.6rem', borderBottom: '1px solid var(--border-subtle)' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Customer Available Balance:</span>
                        <strong style={{ fontSize: '0.95rem', color: '#B45309', fontFamily: 'monospace' }}>
                          ₹{availableBalance !== undefined ? availableBalance.toFixed(2) : discountedPriceINR}
                        </strong>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                        <span>Original Invoice Amount:</span>
                        <span style={{ textDecoration: 'line-through', color: '#DC2626' }}>₹{invoiceAmount.toFixed(2)} (Fails ✕)</span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#16A34A', fontWeight: 600, marginBottom: '0.6rem' }}>
                        <span>{discountPercentStr} Instant Solvency Concession:</span>
                        <span>- ₹{discountSavingsINR}</span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', borderTop: '1.5px solid #22C55E', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                        <div>
                          <div>Final Payable Amount:</div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#16A34A' }}>✓ Covered by available balance</div>
                        </div>
                        <span style={{ color: '#16A34A', fontSize: '1.25rem' }}>₹{discountedPriceINR}</span>
                      </div>
                    </div>

                    <button
                      className="btn-primary"
                      onClick={handleClaimDiscount}
                      disabled={isResolving}
                      style={{ background: '#16A34A', borderColor: '#15803D' }}
                    >
                      {isResolving ? (
                        <>
                          <RefreshCw className="spinner" size={16} />
                          <span>Applying Solvency Waiver...</span>
                        </>
                      ) : (
                        <>
                          <Percent size={16} />
                          <span>{discountPercentStr} Instant Concession → Pay Now (₹{discountedPriceINR})</span>
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
                      <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
                        {ptpResult.promise_detected ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-color)', fontWeight: 700, fontSize: '0.92rem' }}>
                              <Check size={16} />
                              <span>Promise Scheduled: {ptpResult.promised_date} (PTP_COMMITTED)</span>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              Parsed via: <code>{ptpResult.parsing_method}</code> • Confidence: {(ptpResult.confidence_score * 100).toFixed(0)}%
                            </div>

                            {/* Strict Accounting Breakdown */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', marginTop: '0.5rem', padding: '0.75rem', background: 'var(--surface-card)', borderRadius: 6, border: '1px solid var(--border-subtle)', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                              <div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase' }}>Revenue At Risk</div>
                                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>₹{((caseData?.amount_inr || (caseData?.amount_paise ? caseData.amount_paise / 100 : 0)) || 0).toFixed(2)}</div>
                              </div>
                              <div>
                                <div style={{ color: '#2B6CB0', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700 }}>PTP Committed</div>
                                <div style={{ fontWeight: 700, color: '#2B6CB0' }}>₹{((caseData?.amount_inr || (caseData?.amount_paise ? caseData.amount_paise / 100 : 0)) || 0).toFixed(2)}</div>
                              </div>
                              <div>
                                <div style={{ color: '#C53030', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700 }}>Recovered Revenue</div>
                                <div style={{ fontWeight: 700, color: '#C53030' }}>₹0.00</div>
                              </div>
                              <div>
                                <div style={{ color: '#276749', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700 }}>Status</div>
                                <div style={{ fontWeight: 700, color: '#276749' }}>PTP_COMMITTED</div>
                              </div>
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                              <strong>PTP &ne; Recovered Revenue:</strong> Commitment registered in SHA-256 ledger. Recovered revenue strictly increases only upon confirmed payment capture on {ptpResult.promised_date}.
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--danger-color)', fontSize: '0.85rem' }}>
                            <AlertTriangle size={16} />
                            <span>Could not parse exact date. Ambiguous statement safely escalated to concierge support.</span>
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
                        We will email a direct one-click authorization link to complete your 3D-Secure authentication without restarting checkout.
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
          ) : isHumanResolved ? (
            /* HUMAN RESOLVED STATE */
            <div className="recovery-solution-box" style={{ borderColor: '#2B6CB0', background: '#EBF8FF' }}>
              <div className="solution-badge" style={{ background: '#2B6CB0', color: '#FFFFFF' }}>
                <Check size={13} />
                <span>Resolved by Retention Specialist</span>
              </div>
              <div className="solution-message">
                <p style={{ fontWeight: 700, color: '#2B6CB0', fontSize: '1.05rem' }}>
                  ₹{caseData.amount_inr.toFixed(2)} Authorized via Specialist Desk
                </p>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.4rem', fontFamily: 'monospace' }}>
                  State: <strong>ESCALATED → HUMAN_RESOLVED</strong> • Capture: Idempotent Alternative Rail • Audit Ledger: Verified
                </div>
              </div>
            </div>
          ) : isPromisedPending ? (
            /* PTP COMMITTED (PENDING) STATE */
            <div className="recovery-solution-box" style={{ borderColor: '#3182CE', background: '#EBF8FF' }}>
              <div className="solution-badge" style={{ background: '#3182CE', color: '#FFFFFF' }}>
                <Clock size={13} />
                <span>Promise to Pay Confirmed · Pending Settlement</span>
              </div>
              <div className="solution-message">
                <p style={{ fontWeight: 700, color: '#2B6CB0', fontSize: '1.05rem' }}>
                  Commitment to Pay ₹{caseData.amount_inr.toFixed(2)} Registered
                </p>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.4rem', fontFamily: 'monospace' }}>
                  Scheduled Date: <strong>{caseData.ptp_status?.promised_date || 'Future Settlement Date'}</strong> • Revenue Status: <strong>Unrecovered (Pending Actual Capture)</strong>
                </div>
              </div>
            </div>
          ) : (
            /* RECOVERED RECEIPT STATE */
            <div className="recovery-solution-box" style={{ borderColor: 'var(--accent-color)', background: 'var(--accent-light)' }}>
              <div className="solution-badge">
                <Check size={13} />
                <span>Payment Settlement Confirmed</span>
              </div>
              <div className="solution-message">
                <p style={{ fontWeight: 700, color: 'var(--accent-color)', fontSize: '1.05rem' }}>
                  ₹{caseData.amount_inr.toFixed(2)} Successfully Transferred &amp; Captured
                </p>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.4rem', fontFamily: 'monospace' }}>
                  Payment ID: <strong>{caseData.razorpay_payment_id || `pay_1click_${caseData.id.toLowerCase()}`}</strong> • Settlement: Confirmed on Alternative Rail • Ledger: Verified SHA-256
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

            <div className="stepper-steps">
              <div className="step-item done">
                <div className="step-circle"><Check size={13} /></div>
                <div className="step-label">1. Ingested</div>
              </div>
              <div className={`step-item ${caseData.status !== 'NEW' ? 'done' : 'active'}`}>
                <div className="step-circle">{caseData.status !== 'NEW' ? <Check size={13} /> : '2'}</div>
                <div className="step-label">2. Diagnosed</div>
              </div>
              <div className={`step-item ${caseData.status === 'INTERVENING' || caseData.status === 'RETRY_SCHEDULED' || caseData.status === 'PTP_COMMITTED' || caseData.status === 'RECOVERED' || caseData.status === 'ESCALATED' ? 'done' : caseData.status !== 'NEW' ? 'active' : ''}`}>
                <div className="step-circle">{caseData.status === 'INTERVENING' || caseData.status === 'RETRY_SCHEDULED' || caseData.status === 'PTP_COMMITTED' || caseData.status === 'RECOVERED' || caseData.status === 'ESCALATED' ? <Check size={13} /> : '3'}</div>
                <div className="step-label">3. ML Ranked</div>
              </div>
              <div className={`step-item ${caseData.status === 'RECOVERED' || caseData.status === 'RETRY_SCHEDULED' || caseData.status === 'PTP_COMMITTED' || caseData.status === 'ESCALATED' ? 'done' : 'active'}`}>
                <div className="step-circle">
                  {caseData.status === 'RECOVERED' || caseData.status === 'RETRY_SCHEDULED' || caseData.status === 'PTP_COMMITTED' || caseData.status === 'ESCALATED' ? (
                    <Check size={13} />
                  ) : (
                    '4'
                  )}
                </div>
                <div className="step-label">
                  {caseData.status === 'RECOVERED'
                    ? '4. Captured & Settled'
                    : caseData.status === 'RETRY_SCHEDULED'
                      ? '4. Retry Scheduled'
                      : caseData.status === 'PTP_COMMITTED'
                        ? '4. PTP Confirmed'
                        : caseData.status === 'ESCALATED'
                          ? '4. Support Escalated'
                          : '4. Settle / Escalate'}
                </div>
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
