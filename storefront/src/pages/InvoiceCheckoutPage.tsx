import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Building2,
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  Server,
  Zap
} from 'lucide-react';

interface InvoiceData {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  daysOverdue: number;
  status: 'OVERDUE' | 'PAID' | 'PENDING';
  companyName: string;
  contactName: string;
  contactEmail: string;
  gstin: string;
  subtotalINR: number;
  taxINR: number;
  totalINR: number;
  totalPaise: number;
  items: Array<{
    description: string;
    period: string;
    qty: number;
    unitPrice: number;
    total: number;
  }>;
}

export default function InvoiceCheckoutPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [userEmail] = useState<string>(() => {
    return localStorage.getItem('triage_user_email') || 'jhanvip8507@gmail.com';
  });
  const [userName] = useState<string>(() => {
    return localStorage.getItem('triage_user_name') || 'Jhanvi Patel';
  });

  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationStatus, setSimulationStatus] = useState<string>('');

  const invoice: InvoiceData = {
    id: id || 'inv_enterprise_8841',
    invoiceNumber: id ? `INV-2026-${id.toUpperCase()}` : 'INV-2026-8841',
    issueDate: '01 Aug 2026',
    dueDate: '31 Aug 2026 (Net-30 Terms)',
    daysOverdue: 4,
    status: 'OVERDUE',
    companyName: 'Acme AI Systems & Research Corp',
    contactName: userName,
    contactEmail: userEmail,
    gstin: '27AABCU9603R1ZM',
    subtotalINR: 18000,
    taxINR: 0,
    totalINR: 18000,
    totalPaise: 1800000,
    items: [
      {
        description: 'Dedicated 8x NVIDIA H100 SXM5 GPU Node Cluster - Month of August 2026',
        period: '01 Aug - 31 Aug 2026',
        qty: 1,
        unitPrice: 18000,
        total: 18000
      },
      {
        description: 'Multi-Region High Throughput VPC Interconnect & Egress (3.2 Tbps)',
        period: 'Monthly Provisioning',
        qty: 1,
        unitPrice: 0,
        total: 0
      }
    ]
  };

  const handleSimulateOverdueFailure = async () => {
    setIsSimulating(true);
    setSimulationStatus('Broadcasting B2B Overdue Invoice telemetry to Triage Gateway...');

    try {
      const payload = {
        customer_id: `cust_corp_${invoice.id}`,
        customer_name: invoice.contactName,
        customer_email: invoice.contactEmail,
        plan_name: `Enterprise Invoice: ${invoice.invoiceNumber} (${invoice.companyName})`,
        source_type: 'OVERDUE_INVOICE',
        amount_paise: invoice.totalPaise,
        original_rail: 'BANK_TRANSFER',
        error_code: 'OVERDUE_INVOICE',
        error_desc: `B2B enterprise invoice #${invoice.invoiceNumber} past Net-30 due date by ${invoice.daysOverdue} days`,
        error_reason: 'invoice_overdue',
        error_source: 'corporate_billing',
        error_step: 'invoice_due_date',
        payday_proximity_days: 10,
        historical_success_rate: 0.85,
        attempts_made: 0,
        has_upi_available: true
      };

      const res = await fetch('http://localhost:8080/api/v1/triage/cases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const createdCase = await res.json();
        setSimulationStatus('Diagnosed as OVERDUE_INVOICE. Routing to conversational PTP recovery...');
        setTimeout(() => {
          navigate(`/status/${createdCase.id}`);
        }, 600);
      } else {
        // Fallback to synthetic webhook trigger
        const webhookPayload = {
          entity: 'event',
          event: 'payment.failed',
          contains: ['payment'],
          payload: {
            payment: {
              entity: {
                id: `pay_inv_${Math.random().toString(36).substring(2, 10)}`,
                amount: invoice.totalPaise,
                currency: 'INR',
                status: 'failed',
                description: `Invoice ${invoice.invoiceNumber} Net-30 Overdue`,
                email: invoice.contactEmail,
                error_code: 'OVERDUE_INVOICE',
                error_description: `Invoice ${invoice.invoiceNumber} overdue past Net-30 payment terms`,
                error_source: 'corporate_billing',
                error_step: 'invoice_due_date',
                error_reason: 'invoice_overdue'
              }
            }
          }
        };

        const webhookRes = await fetch('http://localhost:8080/api/v1/webhooks/razorpay', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Debug-Mode': 'true'
          },
          body: JSON.stringify(webhookPayload)
        });

        if (webhookRes.ok) {
          const hookData = await webhookRes.json();
          navigate(`/status/${hookData.case_id || hookData.case?.id}`);
        }
      }
    } catch (err) {
      console.error('Failed to trigger overdue invoice flow', err);
      navigate(`/portal`);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="status-page-wrap" style={{ minHeight: '100vh', background: 'var(--surface-subtle)', paddingBottom: '3rem' }}>
      {/* Top Navbar */}
      <nav className="navbar" style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-card)' }}>
        <div className="brand">
          <Server className="text-emerald-700" size={22} />
          <span>Ledger Cloud Services</span>
          <span className="brand-badge" style={{ background: '#FEF3C7', color: '#92400E', borderColor: '#FDE68A' }}>
            B2B Enterprise Portal
          </span>
        </div>
        <div className="nav-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--text-secondary)',
              fontSize: '0.82rem',
              fontWeight: 600,
              textDecoration: 'none'
            }}
          >
            <ArrowLeft size={14} /> Back to Storefront
          </Link>
          <div className="sandbox-pill">
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#D69E2E', display: 'inline-block' }}></span>
            <span>Razorpay Sandbox</span>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <div className="container" style={{ maxWidth: 840, margin: '2rem auto', padding: '0 1rem' }}>
        {/* Overdue Alert Banner */}
        <div
          style={{
            background: '#FEF2F2',
            border: '1.5px solid #F87171',
            borderRadius: '10px',
            padding: '1.25rem 1.5rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '1.25rem'
          }}
        >
          <div style={{ display: 'flex', gap: '12px' }}>
            <AlertTriangle size={24} color="#DC2626" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#991B1B' }}>
                Invoice Overdue · Net-30 Payment Terms Elapsed
              </div>
              <div style={{ fontSize: '0.86rem', color: '#7F1D1D', marginTop: '4px', lineHeight: 1.45 }}>
                Payment for <strong>{invoice.invoiceNumber}</strong> was due on <strong>{invoice.dueDate}</strong> ({invoice.daysOverdue} days past due). Automated services will be throttled unless a payment commitment is registered.
              </div>
              {simulationStatus && (
                <div style={{ marginTop: '8px', fontSize: '0.82rem', color: '#B91C1C', fontWeight: 600 }}>
                  ⚡ {simulationStatus}
                </div>
              )}
            </div>
          </div>

          <button
            id="btn-simulate-overdue-trigger"
            onClick={handleSimulateOverdueFailure}
            disabled={isSimulating}
            className="btn-primary"
            style={{
              background: '#DC2626',
              borderColor: '#B91C1C',
              color: '#FFFFFF',
              whiteSpace: 'nowrap',
              padding: '0.65rem 1.25rem',
              fontSize: '0.88rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)'
            }}
          >
            {isSimulating ? (
              <>
                <RefreshCw size={16} className="spinner" />
                <span>Triggering Diagnosis...</span>
              </>
            ) : (
              <>
                <Zap size={16} />
                <span>Simulate Overdue Non-Payment &rarr;</span>
              </>
            )}
          </button>
        </div>

        {/* Invoice Paper Card */}
        <div
          style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
            padding: '2.5rem'
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
                <Building2 size={24} color="var(--accent-color)" />
                <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Ledger Cloud Services Inc.
                </span>
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                100 Enterprise Boulevard, Cyber City<br />
                Financial District, Hyderabad 500081<br />
                GSTIN: 36AAACL2901P1ZW
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'inline-block', background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5', padding: '4px 12px', borderRadius: '16px', fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                OVERDUE (PAST DUE)
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                {invoice.invoiceNumber}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Issue Date: {invoice.issueDate}
              </div>
              <div style={{ fontSize: '0.82rem', color: '#DC2626', fontWeight: 600, marginTop: '2px' }}>
                Due Date: {invoice.dueDate}
              </div>
            </div>
          </div>

          {/* Billed To & Account Info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
            <div style={{ background: 'var(--surface-subtle)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                Billed To (Client Entity)
              </div>
              <div style={{ fontWeight: 700, fontSize: '0.98rem', color: 'var(--text-primary)' }}>
                {invoice.companyName}
              </div>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Attn: <strong>{invoice.contactName}</strong> ({invoice.contactEmail})
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                GSTIN: {invoice.gstin}
              </div>
            </div>

            <div style={{ background: 'var(--surface-subtle)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                Payment Terms &amp; Settlement Route
              </div>
              <div style={{ fontSize: '0.86rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                • Terms: <strong>Net-30 Days</strong><br />
                • Primary Rail: <strong>Corporate Bank Transfer / RTGS / NEFT</strong><br />
                • Recovery Interventions: <strong>Promise to Pay (PTP) / UPI Collect</strong>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
            <thead>
              <tr style={{ background: 'var(--surface-subtle)', borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Description</th>
                <th style={{ padding: '0.75rem 1rem' }}>Billing Period</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Qty</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Amount (INR)</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)', fontSize: '0.86rem' }}>
                  <td style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {item.description}
                  </td>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                    {item.period}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-primary)' }}>
                    {item.qty}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                    ₹{item.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals Summary */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2rem' }}>
            <div style={{ width: '320px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
                <span>Subtotal:</span>
                <span style={{ fontFamily: 'monospace' }}>₹{invoice.subtotalINR.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
                <span>GST (0% Zero-Rated B2B RCM):</span>
                <span style={{ fontFamily: 'monospace' }}>₹0.00</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderTop: '2px solid var(--border-subtle)', fontSize: '1.15rem', fontWeight: 800, color: '#DC2626' }}>
                <span>Outstanding Due:</span>
                <span style={{ fontFamily: 'monospace' }}>₹{invoice.totalINR.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.5rem' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              🔒 Protected by Triage Cryptographic Audit Ledger &amp; NPCI Autopay Guarantee
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleSimulateOverdueFailure}
                disabled={isSimulating}
                className="btn-primary"
                style={{
                  padding: '0.75rem 1.5rem',
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {isSimulating ? (
                  <>
                    <RefreshCw size={16} className="spinner" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Zap size={16} />
                    <span>Trigger Overdue Demo Case (PTP Flow) &rarr;</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
