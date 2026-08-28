import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
    name: 'Compute Credits Pack',
    desc: 'Prepaid pack of 500 hours of standard GPU/CPU compute for ML inference & batch jobs.',
    pricePaise: 50000,
    displayPrice: '500.00',
    period: 'pack',
    features: ['500 Compute Hours', 'Auto-scaling enabled', 'API & CLI access', 'Standard 99.5% SLA']
  },
  {
    id: 'inference_sub',
    name: 'Inference Subscription',
    desc: 'Monthly dedicated throughput endpoints with zero cold-starts and low latency.',
    pricePaise: 250000,
    displayPrice: '2,500.00',
    period: 'month',
    featured: true,
    features: ['Dedicated L4 Endpoints', 'Sub-20ms P99 Latency', 'Unlimited burst tokens', 'Priority 24/7 routing']
  },
  {
    id: 'enterprise_license',
    name: 'Enterprise License',
    desc: 'Annual license with dedicated account manager, VPC peering, and custom compliance SLA.',
    pricePaise: 1200000,
    displayPrice: '12,000.00',
    period: 'year',
    features: ['Custom VPC deployment', 'SOC2 / HIPAA compliance', 'Dedicated TAM & Slack channel', '99.99% uptime SLA']
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
    title: 'Insufficient Funds (Low Balance)',
    desc: 'Simulates issuing bank declining debit due to insufficient customer balance',
    icon: Ban,
    code: 'BAD_REQUEST_ERROR',
    reason: 'payment_failed',
    source: 'bank',
    step: 'payment_authentication',
    description: 'Payment processing failed due to error at bank: insufficient funds in customer account'
  },
  {
    id: 'bank_decline',
    title: 'Bank System Decline / Downtime',
    desc: 'Simulates core banking gateway timeout or technical failure at the issuer',
    icon: Building2,
    code: 'GATEWAY_ERROR',
    reason: 'bank_technical_decline',
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

  const executeFailureScenario = async (plan: Plan, scenario: FailureScenario) => {
    setIsProcessing(true);
    setProcessingStatus(`Connecting to Razorpay Sandbox (${scenario.title})...`);

    try {
      const email = 'storefront-demo@example.com';
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
      navigate(`/status/email/storefront-demo@example.com`);
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
        <div className="nav-right">
          <div className="sandbox-pill">
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#D69E2E', display: 'inline-block' }}></span>
            <span>Razorpay Test Mode Active</span>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container">
        <header className="hero">
          <div className="hero-tag">
            <Zap size={14} />
            <span>Instant Cloud Infrastructure</span>
          </div>
          <h1>Select Your Cloud Capacity</h1>
          <p>
            Enterprise compute and inference endpoints with automated failover and 99.9% recovery SLA.
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

      {/* Interactive Checkout & Failure Simulator Modal */}
      {selectedPlan && (
        <div className="modal-backdrop" onClick={() => !isProcessing && setSelectedPlan(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <CreditCard size={20} color="var(--accent-color)" />
                <span>Razorpay Checkout Widget</span>
              </h3>
              <button 
                className="modal-close" 
                onClick={() => !isProcessing && setSelectedPlan(null)}
                disabled={isProcessing}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              {/* Order Summary Strip */}
              <div className="order-summary-strip">
                <div>
                  <div className="order-summary-title">{selectedPlan.name}</div>
                  <div className="order-summary-sub">Customer: storefront-demo@example.com</div>
                </div>
                <div className="order-summary-price">
                  ₹{selectedPlan.displayPrice}
                </div>
              </div>

              {isProcessing ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
                  <div className="spinner" style={{ margin: '0 auto 1.5rem' }}></div>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                    Processing Transaction
                  </h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    {processingStatus}
                  </p>
                </div>
              ) : (
                <>
                  <div className="scenario-title">
                    Trigger Failure Mode (Demo Scenarios):
                  </div>
                  <div className="scenario-options">
                    {failureScenarios.map((scenario) => {
                      const Icon = scenario.icon;
                      return (
                        <button
                          key={scenario.id}
                          className="scenario-btn danger"
                          onClick={() => executeFailureScenario(selectedPlan, scenario)}
                        >
                          <Icon size={20} className="scenario-btn-icon" color="var(--danger-color)" />
                          <div>
                            <div className="scenario-btn-title">
                              <span>{scenario.title}</span>
                              <span style={{ fontSize: '0.68rem', background: '#FED7D7', color: '#9B2C2C', padding: '1px 5px', borderRadius: 3, fontWeight: 700 }}>
                                {scenario.code}
                              </span>
                            </div>
                            <div className="scenario-btn-desc">{scenario.desc}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <Lock size={12} />
                    <span>Gated server-to-server webhook ingestion with real-time audit ledger logging.</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
