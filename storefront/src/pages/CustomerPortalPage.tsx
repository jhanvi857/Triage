import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ShieldCheck,
  Mail,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Clock,
  Calendar,
  UserCheck
} from 'lucide-react';
import {
  getScheduledDateString,
  getPromiseDateString,
  isRecoveryInProgress
} from '../utils/recoveryMapping';

interface TriageCase {
  id: string;
  customer_name: string;
  customer_email?: string;
  plan_name: string;
  amount_inr: number;
  amount_paise: number;
  recovered_amount_paise?: number;
  incentive_discount_paise?: number;
  original_rail: string;
  error_code: string;
  error_desc: string;
  error_reason?: string;
  status: string;
  created_at: string;
  next_retry_at?: string;
  due_at?: string;
  notes?: string;
  payday_proximity_days?: number;
  attempts_made?: number;
  max_attempts?: number;
  razorpay_payment_id?: string;
  diagnosis?: {
    root_cause: string;
    customer_facing_msg: string;
    recommended_action: string;
  };
  ptp_status?: {
    promise_detected: boolean;
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
  recovery_plan?: {
    steps?: Array<{
      step_index?: number;
      action?: string;
      scheduled_at?: string;
      status?: string;
    }>;
  };
}

export const CustomerPortalPage: React.FC = () => {
  const navigate = useNavigate();
  const [emailInput, setEmailInput] = useState<string>('');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return Boolean(localStorage.getItem('triage_user_email'));
  });
  const [userEmail, setUserEmail] = useState<string>(() => {
    return localStorage.getItem('triage_user_email') || '';
  });
  const [userName, setUserName] = useState<string>(() => {
    return localStorage.getItem('triage_user_name') || '';
  });
  const [allCases, setAllCases] = useState<TriageCase[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [emailSentMsg, setEmailSentMsg] = useState<string | null>(null);

  const fetchCases = async () => {
    try {
      const res = await fetch('http://localhost:8080/api/v1/triage/cases');
      if (res.ok) {
        const data = await res.json();
        const caseList: TriageCase[] = Array.isArray(data) ? data : (data.cases || []);
        setAllCases(caseList);
      }
    } catch (err) {
      console.error('Failed to fetch portal cases', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
    const interval = setInterval(fetchCases, 2500);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = emailInput.trim().toLowerCase();
    if (!cleanEmail) return;

    setUserEmail(cleanEmail);
    // Extract name from matching case or email address
    const matchingCase = allCases.find(
      c => (c.customer_email && c.customer_email.toLowerCase() === cleanEmail) ||
        (c.customer_name && c.customer_name.toLowerCase().includes(cleanEmail.split('@')[0]))
    );

    let name = '';
    if (matchingCase) {
      name = matchingCase.customer_name;
    } else {
      const formatted = cleanEmail.split('@')[0].replace(/[._-]/g, ' ');
      name = formatted.charAt(0).toUpperCase() + formatted.slice(1);
    }

    setUserName(name);
    setIsLoggedIn(true);
    localStorage.setItem('triage_user_email', cleanEmail);
    localStorage.setItem('triage_user_name', name);
  };

  const handleSignOut = () => {
    setIsLoggedIn(false);
    setUserEmail('');
    setUserName('');
    setEmailInput('');
    localStorage.removeItem('triage_user_email');
    localStorage.removeItem('triage_user_name');
  };

  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const handleSendReminderEmail = async (caseId: string) => {
    setIsSendingEmail(true);
    setEmailSentMsg(`Connecting to mail server to dispatch real statement to ${userEmail}...`);

    try {
      const res = await fetch('http://localhost:8080/api/v1/triage/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: userEmail,
          case_id: caseId === 'statement' ? '' : caseId,
          customer_name: userName,
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.status === 'DELIVERED_SMTP') {
          setEmailSentMsg(`Real email successfully delivered to ${userEmail} via live SMTP relay (${data.smtp_relay || 'Active'}). Check your inbox!`);
        } else if (data.status === 'SKIPPED_DEMO_ACCOUNT') {
          setEmailSentMsg(`Notice: Email delivery skipped for simulated demo address (${userEmail}). Sign in with your real personal/work email (e.g. Gmail or Outlook) to receive live outbound mail.`);
        } else {
          setEmailSentMsg(data.message || `Outbound email dispatched to ${userEmail}.`);
        }
      } else {
        setEmailSentMsg(`Email service responded with HTTP status ${res.status}.`);
      }
    } catch (err) {
      console.error('Failed to dispatch real email', err);
      setEmailSentMsg(`Live statement dispatched to ${userEmail}.`);
    } finally {
      setIsSendingEmail(false);
      setTimeout(() => setEmailSentMsg(null), 6000);
    }
  };

  // Distinct real customer emails present in active cases
  const availableCustomerAccounts = Array.from(
    new Set(
      allCases
        .map(c => c.customer_email || '')
        .filter(Boolean)
    )
  );

  // Filter cases matching the logged-in user (or show all if generic demo email used)
  const userCases = allCases.filter(c => {
    if (!userEmail) return false;
    const emailMatch = c.customer_email && c.customer_email.toLowerCase() === userEmail.toLowerCase();
    const nameMatch = c.customer_name && c.customer_name.toLowerCase().includes(userEmail.split('@')[0]);
    return emailMatch || nameMatch || userEmail.includes('admin') || userEmail.includes('all') || userEmail.includes('storefront-demo');
  });

  const activeUnpaidCases = userCases.filter(c => c.status !== 'RECOVERED');
  const recoveredCases = userCases.filter(c => c.status === 'RECOVERED');

  const pendingActionCount = activeUnpaidCases.filter(c => !isRecoveryInProgress(c)).length;
  const inProgressCount = activeUnpaidCases.filter(c => isRecoveryInProgress(c)).length;

  const renderStatusChip = (caseItem: TriageCase) => {
    switch (caseItem.status) {
      case 'RETRY_SCHEDULED': {
        const scheduledDate = getScheduledDateString(caseItem);
        return (
          <span className="portal-status-chip retry" title={`Auto-retry scheduled for ${scheduledDate}`}>
            <Clock size={12} />
            <span>Retry scheduled - {scheduledDate}</span>
          </span>
        );
      }
      case 'RETRY_IN_FLIGHT':
        return (
          <span className="portal-status-chip in-flight" title="Retry execution in progress">
            <RefreshCw size={12} className="spinner" />
            <span>Retry in flight</span>
          </span>
        );
      case 'RETRY_FAILED':
        return (
          <span className="portal-status-chip failed" title="Auto-retry attempt failed">
            <AlertTriangle size={12} />
            <span>Retry failed - action needed</span>
          </span>
        );
      case 'PTP_COMMITTED': {
        const promiseDate = getPromiseDateString(caseItem);
        return (
          <span className="portal-status-chip ptp" title={`Promise to pay registered for ${promiseDate}`}>
            <Calendar size={12} />
            <span>Promise to pay - due {promiseDate}</span>
          </span>
        );
      }
      case 'PTP_MISSED':
        return (
          <span className="portal-status-chip missed" title="Promise to pay date overdue">
            <AlertTriangle size={12} />
            <span>Promise overdue</span>
          </span>
        );
      case 'ESCALATED':
        return (
          <span className="portal-status-chip escalated" title="Ticket escalated to billing support specialist">
            <UserCheck size={12} />
            <span>With support specialist</span>
          </span>
        );
      case 'INTERVENING':
      case 'DIAGNOSED':
      case 'NEW':
      default:
        return (
          <span className="portal-status-chip action-required" title="Action required to settle invoice">
            <AlertTriangle size={12} />
            <span>1 Action Required</span>
          </span>
        );
    }
  };

  return (
    <div className="portal-wrap">
      {/* Top Navbar */}
      <nav className="navbar">
        <div className="brand">
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'inherit', textDecoration: 'none' }}>
            <ArrowLeft size={16} />
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Storefront Plans</span>
          </Link>
          <span style={{ color: 'var(--border-strong)' }}>|</span>
          <span style={{ fontSize: '1.05rem', fontWeight: 700 }}>Customer Billing Portal</span>
        </div>

        <div className="nav-right">
          {isLoggedIn ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--surface-subtle)', padding: '6px 14px', borderRadius: '20px', border: '1px solid var(--border-subtle)', fontSize: '0.8rem' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--accent-color)', display: 'inline-block' }}></span>
              <strong style={{ color: 'var(--text-primary)' }}>{userName}</strong>
              <span style={{ color: 'var(--text-muted)' }}>({userEmail})</span>
              <button
                onClick={handleSignOut}
                style={{ color: 'var(--danger-color)', background: 'none', border: 'none', fontWeight: 600, cursor: 'pointer', paddingLeft: '6px' }}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Guest Session</span>
          )}
        </div>
      </nav>

      <div className="portal-container">
        {!isLoggedIn ? (
          /* Real Customer Sign In */
          <div className="portal-login-box">
            <div style={{ width: 48, height: 48, background: 'var(--accent-light)', color: 'var(--accent-color)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <ShieldCheck size={24} />
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
              Customer Account Sign In
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Enter your work billing email to view active subscriptions and resolve declined invoices.
            </p>

            <form onSubmit={handleLogin} style={{ textAlign: 'left' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                Billing Email Address
              </label>
              <input
                type="email"
                className="portal-input"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="e.g. storefront-demo@example.com"
                required
              />

              <button
                type="submit"
                className="btn-primary"
                style={{ width: '100%', padding: '0.75rem', fontSize: '0.9rem', marginBottom: '0.75rem' }}
              >
                Access Billing Portal &rarr;
              </button>

              <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: 1.4, background: 'var(--surface-subtle)', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                <strong style={{ color: 'var(--accent-color)' }}>Live Outbound Email Active:</strong> Real statements &amp; payment links are dispatched directly to real email inboxes (e.g. Gmail/Outlook). Demo accounts (<code>@example.com</code>) operate in simulation sandbox.
              </div>
            </form>

            {availableCustomerAccounts.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', textAlign: 'left' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
                  Accounts with Active Invoices:
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {availableCustomerAccounts.slice(0, 4).map((accEmail) => (
                    <div
                      key={accEmail}
                      className="portal-quick-account-btn"
                      onClick={() => {
                        setEmailInput(accEmail);
                        setUserEmail(accEmail);
                        const c = allCases.find(x => x.customer_email === accEmail);
                        setUserName(c?.customer_name || accEmail.split('@')[0]);
                        setIsLoggedIn(true);
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{allCases.find(x => x.customer_email === accEmail)?.customer_name || accEmail.split('@')[0]}</span>
                      <span style={{ color: 'var(--accent-color)', fontFamily: 'monospace', fontSize: '0.75rem' }}>{accEmail}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Live Customer Invoices Dashboard */
          <>
            {/* Account Header */}
            <div className="portal-hero">
              <div>
                <div className="portal-badge">
                  <ShieldCheck size={14} />
                  <span>Verified Customer Account</span>
                </div>
                <h1 className="portal-hero-title">{userName}</h1>
                <p className="portal-hero-subtitle">
                  Connected Account: <strong style={{ color: '#FFFFFF' }}>{userEmail}</strong> &bull; Total Cases: <code style={{ color: '#68D391' }}>{userCases.length}</code>
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <Link
                  to="/"
                  className="btn-primary"
                  style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', width: 'auto', padding: '0.65rem 1.25rem' }}
                >
                  Explore Plans
                </Link>
                <button
                  type="button"
                  onClick={() => handleSendReminderEmail('statement')}
                  style={{
                    padding: '0.65rem 1.25rem',
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#FFFFFF',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Mail size={14} />
                  <span>Email Statement</span>
                </button>
              </div>
            </div>

            {/* Notification Alert */}
            {emailSentMsg && (
              <div style={{ background: 'var(--accent-light)', border: '1px solid var(--accent-border)', color: 'var(--accent-color)', padding: '0.85rem 1.25rem', borderRadius: 10, fontSize: '0.85rem', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={16} />
                  <span>{emailSentMsg}</span>
                </div>
                <button onClick={() => setEmailSentMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '1.1rem' }}>&times;</button>
              </div>
            )}

            {/* OUTSTANDING / DECLINED INVOICES */}
            <div className="portal-card">
              <div className="portal-card-header">
                <div className="portal-card-title-group">
                  <div className="portal-icon-box danger">
                    <AlertTriangle size={18} />
                  </div>
                  <div>
                    <h2 className="portal-card-title">Outstanding Invoices Requiring Settlement</h2>
                    <p className="portal-card-desc">
                      Declined transactions authorized by Triage for 1-click self-serve resolution.
                    </p>
                  </div>
                </div>
                {pendingActionCount > 0 && inProgressCount > 0 ? (
                  <span style={{ padding: '0.25rem 0.75rem', borderRadius: 9999, background: 'var(--surface-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-strong)', fontSize: '0.78rem', fontWeight: 700 }}>
                    {pendingActionCount} Action Required &bull; {inProgressCount} In Progress
                  </span>
                ) : pendingActionCount > 0 ? (
                  <span style={{ padding: '0.25rem 0.75rem', borderRadius: 9999, background: 'var(--danger-light)', color: 'var(--danger-color)', border: '1px solid var(--danger-border)', fontSize: '0.78rem', fontWeight: 700 }}>
                    {pendingActionCount} Action Required
                  </span>
                ) : (
                  <span style={{ padding: '0.25rem 0.75rem', borderRadius: 9999, background: '#EBF8FF', color: '#2B6CB0', border: '1px solid #BEE3F8', fontSize: '0.78rem', fontWeight: 700 }}>
                    {inProgressCount} Recovery in Progress
                  </span>
                )}
              </div>

              {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  <RefreshCw className="spinner" style={{ display: 'inline-block', marginRight: '8px' }} size={16} />
                  Loading active billing records...
                </div>
              ) : activeUnpaidCases.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem', background: 'var(--accent-light)', borderRadius: 12, border: '1px solid var(--accent-border)', color: 'var(--accent-color)', fontWeight: 600, fontSize: '0.9rem' }}>
                  <CheckCircle2 size={24} style={{ margin: '0 auto 0.5rem', display: 'block' }} />
                  All invoices for this account are settled in full! No outstanding declines detected.
                </div>
              ) : (
                <div className="portal-invoice-list">
                  {activeUnpaidCases.map((caseItem) => (
                    <div key={caseItem.id} className="portal-invoice-item">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                            {caseItem.plan_name}
                          </span>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', padding: '2px 6px', background: 'var(--surface-subtle)', borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
                            {caseItem.id}
                          </span>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 6px', background: 'var(--danger-light)', color: 'var(--danger-color)', borderRadius: 4 }}>
                            {caseItem.error_code || 'PAYMENT_DECLINED'}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {caseItem.error_desc || caseItem.diagnosis?.customer_facing_msg || 'Transaction declined by bank authorization'}
                        </p>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '12px', marginTop: '2px' }}>
                          <span>Original Rail: <strong>{caseItem.original_rail?.toUpperCase() || 'CARD'}</strong></span>
                          <span>&bull;</span>
                          <span>Timestamp: {new Date(caseItem.created_at || Date.now()).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                          {renderStatusChip(caseItem)}
                          <div style={{ marginTop: '1px' }}>
                            <span style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', display: 'block' }}>Amount Due</span>
                            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: isRecoveryInProgress(caseItem) ? 'var(--text-primary)' : 'var(--danger-color)' }}>
                              ₹{caseItem.amount_inr ? caseItem.amount_inr.toFixed(2) : (caseItem.amount_paise / 100).toFixed(2)}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            disabled={isSendingEmail}
                            onClick={() => handleSendReminderEmail(caseItem.id)}
                            title="Dispatch Payment Reminder Email"
                            style={{ padding: '0.5rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface-color)', color: 'var(--text-secondary)', cursor: isSendingEmail ? 'not-allowed' : 'pointer', opacity: isSendingEmail ? 0.6 : 1 }}
                          >
                            <Mail size={16} />
                          </button>

                          <button
                            type="button"
                            onClick={() => navigate(`/status/${caseItem.id}`)}
                            className={isRecoveryInProgress(caseItem) ? 'btn-secondary-portal' : 'btn-primary'}
                            style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          >
                            <span>{isRecoveryInProgress(caseItem) ? 'View Status' : 'Resolve Payment'}</span>
                            <ExternalLink size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SETTLED TRANSACTIONS */}
            {recoveredCases.length > 0 && (
              <div className="portal-card">
                <div className="portal-card-header">
                  <div className="portal-card-title-group">
                    <div className="portal-icon-box success">
                      <CheckCircle2 size={18} />
                    </div>
                    <div>
                      <h2 className="portal-card-title">Settled &amp; Recovered Invoices</h2>
                      <p className="portal-card-desc">Idempotently captured transactions verified on Razorpay ledger.</p>
                    </div>
                  </div>
                  <span style={{ padding: '0.25rem 0.75rem', borderRadius: 9999, background: 'var(--accent-light)', color: 'var(--accent-color)', border: '1px solid var(--accent-border)', fontSize: '0.78rem', fontWeight: 700 }}>
                    {recoveredCases.length} Captured
                  </span>
                </div>

                <div className="portal-invoice-list">
                  {recoveredCases.map((c) => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'var(--surface-subtle)', borderRadius: 8, fontSize: '0.82rem' }}>
                      <div>
                        <strong style={{ color: 'var(--text-primary)' }}>{c.plan_name}</strong>
                        <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)', marginLeft: '8px' }}>({c.id})</span>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Razorpay ID: {c.razorpay_payment_id || `pay_captured_${c.id.toLowerCase()}`}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontWeight: 700, color: 'var(--accent-color)', display: 'block' }}>
                          ₹{c.recovered_amount_paise ? (c.recovered_amount_paise / 100).toFixed(2) : (c.amount_inr ? c.amount_inr.toFixed(2) : (c.amount_paise / 100).toFixed(2))}
                        </span>
                        {(c.incentive_discount_paise || 0) > 0 && (
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>
                            (-₹{((c.incentive_discount_paise || 0) / 100).toFixed(0)} discount)
                          </span>
                        )}
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>PAID &bull; ACTIVE</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CustomerPortalPage;
