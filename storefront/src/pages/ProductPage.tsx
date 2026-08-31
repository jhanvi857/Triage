import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Check, 
  CreditCard, 
  Clock, 
  Building2, 
  Ban, 
  Lock, 
  Server,
  Zap,
  X,
  AlertOctagon,
  User,
  ShieldCheck,
  Mail,
  LogOut,
  type LucideIcon
} from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  desc: string;
  pricePaise: number;
  displayPrice: string;
  period: string;
  featured?: boolean;
  features: string[];
}

const plans: Plan[] = [
  {
    id: 'compute_pack',
    name: 'AI Inference Credits Pack',
    desc: 'Prepaid 10M token compute package with burst priority and real-time fallbacks',
    pricePaise: 180000,
    displayPrice: '1,800',
    period: 'one-time pack',
    features: [
      '10,000,000 Model Tokens',
      'Low latency P99 inference',
      'Multi-region burst routing',
      'Real-time token usage alerts'
    ]
  },
  {
    id: 'gpu_node',
    name: 'H100 On-Demand GPU Node',
    desc: 'High throughput dedicated training and inference node with 80GB VRAM',
    pricePaise: 360000,
    displayPrice: '3,600',
    period: '24-hour block',
    featured: true,
    features: [
      '1x NVIDIA H100 80GB SXM5',
      '3.2 Tbps InfiniBand interconnect',
      'Fast NVMe local cache storage',
      'Zero setup provisioning delay'
    ]
  },
  {
    id: 'cluster_monthly',
    name: 'Enterprise GPU Cluster',
    desc: 'Dedicated 8-node compute cluster for continuous fine-tuning pipelines',
    pricePaise: 480000,
    displayPrice: '4,800',
    period: 'monthly tier',
    features: [
      '8x H100 SXM5 GPU cluster',
      'SLA-backed 99.95% uptime',
      'Dedicated VPC private subnet',
      'Priority enterprise support'
    ]
  },
  {
    id: 'compliance_license',
    name: 'Multi-Agent Compliance License',
    desc: 'Full SOC2 Type II, RBI mandate compliance and cryptographic audit ledger package',
    pricePaise: 1250000,
    displayPrice: '12,500',
    period: 'annual license',
    features: [
      'Cryptographic SHA-256 Ledger',
      'RBI Auto-Debit e-mandate suite',
      'Multi-channel AI Agent dispatch',
      'Audit log export API'
    ]
  }
];

interface FailureScenario {
  id: string;
  title: string;
  desc: string;
  icon: LucideIcon;
  code: string;
  reason: string;
  source: string;
  step: string;
  description: string;
}

const failureScenarios: FailureScenario[] = [
  {
    id: 'insufficient_funds',
    title: 'Insufficient Balance Decline',
    desc: 'Simulates customer low funds. Triage halts instant retry and shifts to payday schedule or backup card',
    icon: Ban,
    code: 'INSUFFICIENT_FUNDS',
    reason: 'insufficient_funds',
    source: 'bank',
    step: 'payment_authorization',
    description: 'Transaction was declined due to insufficient account balance'
  },
  {
    id: 'bank_outage',
    title: 'HDFC / Axis Core Outage',
    desc: 'Simulates issuing bank downtime. System routes to 30-min cooldown or alternate card rail',
    icon: Building2,
    code: 'GATEWAY_TIMEOUT_504',
    reason: 'bank_network_timeout',
    source: 'gateway',
    step: 'payment_authorization',
    description: 'Issuing bank network error: bank server did not respond in time'
  },
  {
    id: 'auth_timeout',
    title: '3D-Secure / OTP Timeout',
    desc: 'Simulates customer dropping out or 3DS verification window timing out',
    icon: Clock,
    code: 'TRANSACTION_TIMEOUT',
    reason: 'otp_expired',
    source: 'customer',
    step: 'payment_authentication',
    description: 'Payment timed out because 3D-Secure OTP verification was not completed'
  },
  {
    id: 'mandate_limit',
    title: 'Mandate Limit Exceeded',
    desc: 'Simulates recurring subscription debit hitting RBI per-transaction ceiling',
    icon: Lock,
    code: 'LIMIT_EXCEEDED',
    reason: 'mandate_max_amount_breached',
    source: 'bank',
    step: 'payment_initiation',
    description: 'Auto-debit request exceeds maximum registered e-mandate limit of ₹15,000'
  },
  {
    id: 'expired_card',
    title: 'Expired Card / Dead Instrument',
    desc: 'Simulates expired card on file. System refuses auto-retry and routes to human retention desk',
    icon: AlertOctagon,
    code: 'CARD_EXPIRED',
    reason: 'card_expired',
    source: 'bank',
    step: 'payment_initiation',
    description: 'The card expiry date has passed. Permanent decline on dead instrument'
  }
];

export default function ProductPage() {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');

  // Authentication State
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem('triage_user_email') !== null ? Boolean(localStorage.getItem('triage_user_email')) : true;
  });
  const [userEmail, setUserEmail] = useState<string>(() => {
    return localStorage.getItem('triage_user_email') || 'jhanvip8507@gmail.com';
  });
  const [userName, setUserName] = useState<string>(() => {
    return localStorage.getItem('triage_user_name') || 'Jhanvi Patel';
  });
  const [loginEmailInput, setLoginEmailInput] = useState<string>('');
  const [recentAccounts, setRecentAccounts] = useState<string[]>([]);

  // Fetch real recent accounts from gateway
  useEffect(() => {
    fetch('http://localhost:8080/api/v1/triage/cases')
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : (data.cases || []);
        const emails = Array.from(new Set(list.map((c: any) => c.customer_email).filter(Boolean))) as string[];
        setRecentAccounts(emails);
      })
      .catch(() => {});
  }, []);

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = loginEmailInput.trim().toLowerCase();
    if (!cleanEmail) return;

    let computedName = cleanEmail.split('@')[0].replace(/[._-]/g, ' ');
    computedName = computedName.charAt(0).toUpperCase() + computedName.slice(1);

    setUserEmail(cleanEmail);
    setUserName(computedName);
    setIsLoggedIn(true);

    localStorage.setItem('triage_user_email', cleanEmail);
    localStorage.setItem('triage_user_name', computedName);
  };

  const handleSignOut = () => {
    setIsLoggedIn(false);
    setUserEmail('');
    setUserName('');
    setLoginEmailInput('');
    localStorage.removeItem('triage_user_email');
    localStorage.removeItem('triage_user_name');
  };

  const executeFailureScenario = async (plan: Plan, scenario: FailureScenario) => {
    setIsProcessing(true);
    setProcessingStatus(`Connecting to Razorpay Sandbox (${scenario.title})...`);

    try {
      const email = userEmail || 'storefront-demo@example.com';
      const webhookPayload = {
        entity: 'event',
        event: 'payment.failed',
        contains: ['payment'],
        payload: {
          payment: {
            entity: {
              id: `pay_test_${Math.random().toString(36).substring(2, 10)}`,
              amount: plan.pricePaise,
              currency: 'INR',
              status: 'failed',
              order_id: `order_${Math.random().toString(36).substring(2, 10)}`,
              method: 'card',
              description: plan.name,
              email: email,
              contact: '+919876543210',
              error_code: scenario.code,
              error_description: scenario.description,
              error_source: scenario.source,
              error_step: scenario.step,
              error_reason: scenario.reason
            }
          }
        },
        created_at: Math.floor(Date.now() / 1000)
      };

      setProcessingStatus('Transmitting verified payment failure event to Triage Gateway...');

      const response = await fetch('http://localhost:8080/api/v1/webhooks/razorpay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Debug-Mode': 'true'
        },
        body: JSON.stringify(webhookPayload)
      });

      let caseId = '';
      if (response.ok) {
        const data = await response.json();
        if (data.case_id) {
          caseId = data.case_id;
        } else if (data.case && data.case.id) {
          caseId = data.case.id;
        }
      }

      setProcessingStatus('Triage Autonomous Diagnosis Complete. Redirecting to recovery view...');
      
      setTimeout(() => {
        setIsProcessing(false);
        setSelectedPlan(null);
        if (caseId) {
          navigate(`/status/${caseId}`);
        } else {
          navigate(`/status/email/${email}`);
        }
      }, 600);
    } catch (err) {
      console.error('Failed to dispatch webhook', err);
      setIsProcessing(false);
      navigate(`/status/email/${userEmail || 'storefront-demo@example.com'}`);
    }
  };

  return (
    <div>
      {/* Top Navbar */}
      <nav className="navbar">
        <div className="brand">
          <Server className="text-emerald-700" size={22} />
          <span>Ledger Cloud Services</span>
          <span className="brand-badge">Merchant Storefront</span>
        </div>
        <div className="nav-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isLoggedIn ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--surface-subtle)', padding: '5px 12px', borderRadius: '20px', border: '1px solid var(--border-subtle)', fontSize: '0.78rem' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--accent-color)', display: 'inline-block' }}></span>
                <strong style={{ color: 'var(--text-primary)' }}>{userName}</strong>
                <span style={{ color: 'var(--text-muted)' }}>({userEmail})</span>
                <button
                  onClick={handleSignOut}
                  style={{ color: 'var(--danger-color)', background: 'none', border: 'none', fontWeight: 600, cursor: 'pointer', paddingLeft: '4px', fontSize: '0.75rem' }}
                >
                  Sign Out
                </button>
              </div>

              <Link
                to="/portal"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  backgroundColor: '#E6FFFA',
                  color: '#234E52',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  border: '1px solid #81E6D9'
                }}
              >
                <User size={14} />
                <span>My Billing &amp; Invoices</span>
              </Link>
            </>
          ) : (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Customer Login Required</span>
          )}

          <div className="sandbox-pill">
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#D69E2E', display: 'inline-block' }}></span>
            <span>Razorpay Test Mode Active</span>
          </div>
        </div>
      </nav>

      {/* Main Content: Step 1 Sign-In OR Step 2 Infrastructure Plans */}
      {!isLoggedIn ? (
        <div className="container" style={{ maxWidth: 520, margin: '3.5rem auto' }}>
          <div className="portal-login-box" style={{ margin: 0, maxWidth: '100%' }}>
            <div style={{ width: 48, height: 48, background: 'var(--accent-light)', color: 'var(--accent-color)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <ShieldCheck size={26} />
            </div>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
              Customer Sign In
            </h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.75rem' }}>
              Sign in with your billing email to configure cloud compute capacity and simulate real-time revenue recovery.
            </p>

            <form onSubmit={handleSignIn} style={{ textAlign: 'left' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                Your Work Billing Email
              </label>
              <input
                type="email"
                className="portal-input"
                value={loginEmailInput}
                onChange={(e) => setLoginEmailInput(e.target.value)}
                placeholder="e.g. dev@company.com"
                required
                autoFocus
              />

              <button
                type="submit"
                className="btn-primary"
                style={{ width: '100%', padding: '0.8rem', fontSize: '0.92rem', marginBottom: '0.85rem' }}
              >
                Continue to Cloud Plans &rarr;
              </button>

              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: 1.4, background: 'var(--surface-subtle)', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                <strong style={{ color: 'var(--accent-color)' }}>⚡ Real Outbound Email:</strong> Live SMTP emails with 1-click recovery links are dispatched directly to real personal/work inboxes (e.g. Gmail / Outlook). Demo accounts (<code>@example.com</code>) run in simulation mode.
              </div>
            </form>

            {recentAccounts.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', textAlign: 'left' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
                  Quick Sign In (Active Accounts):
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {recentAccounts.slice(0, 3).map((accEmail) => (
                    <div
                      key={accEmail}
                      className="portal-quick-account-btn"
                      onClick={() => {
                        let name = accEmail.split('@')[0].replace(/[._-]/g, ' ');
                        name = name.charAt(0).toUpperCase() + name.slice(1);
                        setUserEmail(accEmail);
                        setUserName(name);
                        setIsLoggedIn(true);
                        localStorage.setItem('triage_user_email', accEmail);
                        localStorage.setItem('triage_user_name', name);
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{accEmail.split('@')[0]}</span>
                      <span style={{ color: 'var(--accent-color)', fontFamily: 'monospace', fontSize: '0.75rem' }}>{accEmail}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="container">
          <header className="hero">
            <div className="hero-tag">
              <Zap size={14} />
              <span>Instant Cloud Infrastructure</span>
            </div>
            <h1>Select Your Cloud Capacity</h1>
            <p>
              Signed in as <strong>{userName}</strong> ({userEmail}). Select a plan below to test Razorpay checkout and autonomous revenue recovery.
            </p>
          </header>

          {/* Pricing Cards */}
          <div className="plans-grid">
            {plans.map((plan) => (
              <div 
                key={plan.id} 
                className={`plan-card ${plan.featured ? 'featured' : ''}`}
              >
                {plan.featured && (
                  <div className="featured-ribbon">Most Popular</div>
                )}
                <h2 className="plan-title">{plan.name}</h2>
                <p className="plan-desc">{plan.desc}</p>
                
                <div className="plan-price-block">
                  <span className="price-currency">₹</span>
                  <span className="price-amount">{plan.displayPrice}</span>
                  <span className="price-period"> / {plan.period}</span>
                </div>

                <ul className="plan-features">
                  {plan.features.map((feature, idx) => (
                    <li key={idx}>
                      <Check size={16} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button 
                  className="btn-primary"
                  onClick={() => setSelectedPlan(plan)}
                >
                  <CreditCard size={18} />
                  <span>Pay with Razorpay</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interactive Checkout & Failure Simulator Modal */}
      {selectedPlan && (
        <div className="modal-backdrop" onClick={() => !isProcessing && setSelectedPlan(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="sandbox-badge">
                  <span>SANDBOX SIMULATION</span>
                </div>
                <h2>Simulate Payment Failure</h2>
                <p>
                  Purchasing <strong>{selectedPlan.name}</strong> for <strong>₹{selectedPlan.displayPrice}</strong> as <strong>{userEmail}</strong>
                </p>
              </div>
              {!isProcessing && (
                <button className="close-btn" onClick={() => setSelectedPlan(null)}>
                  <X size={20} />
                </button>
              )}
            </div>

            {isProcessing ? (
              <div className="processing-state">
                <div className="spinner"></div>
                <h3>{processingStatus}</h3>
                <p>Simulating Razorpay webhook transmission and Triage diagnostic evaluation</p>
              </div>
            ) : (
              <div className="scenarios-list">
                <p className="scenarios-label">
                  Select a realistic decline scenario to test Triage autonomous recovery:
                </p>
                
                {failureScenarios.map((scenario) => {
                  const Icon = scenario.icon;
                  return (
                    <button
                      key={scenario.id}
                      className="scenario-btn"
                      onClick={() => executeFailureScenario(selectedPlan, scenario)}
                    >
                      <div className="scenario-icon">
                        <Icon size={20} />
                      </div>
                      <div className="scenario-info">
                        <div className="scenario-title-row">
                          <span className="scenario-title">{scenario.title}</span>
                          <span className="scenario-code">{scenario.code}</span>
                        </div>
                        <p className="scenario-desc">{scenario.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
