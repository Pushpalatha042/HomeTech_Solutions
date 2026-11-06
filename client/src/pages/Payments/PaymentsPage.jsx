import { useState, useEffect } from 'react';
import { Download, CreditCard, CheckCircle2, FileText, Printer, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import DashboardSidebar from '../../components/sidebar/DashboardSidebar';
import Modal from '../../components/common/Modal';
import api from '../../api';
import { getServiceImage, homeMaintenanceImg } from '../../assets/images';

export default function PaymentsPage() {
  const { notify } = useAuth();
  const [activeTab, setActiveTab] = useState('payments');
  const [filterTab, setFilterTab] = useState('All Payments');
  const [payments, setPayments] = useState([]);
  const [totalSpent, setTotalSpent] = useState(0);
  const [loading, setLoading] = useState(true);

  // Selected Invoice for Modal View
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/payments/my')
      .then(({ data }) => {
        setPayments(data.payments || []);
        setTotalSpent(data.totalSpent || 0);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleViewInvoice = async (paymentId) => {
    setInvoiceLoading(true);
    try {
      const { data } = await api.get(`/payments/${paymentId}/invoice`);
      setSelectedInvoice(data);
    } catch (err) {
      notify('Failed to generate invoice details.', 'danger');
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="dashboard-layout">
      <DashboardSidebar activeTab={activeTab} onSelectTab={setActiveTab} />

      <main className="dashboard-main">
        <div className="flex-between" style={{ marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--primary-navy)' }}>
              Payments & Invoices
            </h1>
            <p style={{ color: 'var(--secondary-text)', fontSize: '15px' }}>
              Track all payment receipts, transaction references, and download official invoices.
            </p>
          </div>
        </div>

        {/* Tab Controls (Prototype Page 10) */}
        <div className="card" style={{ padding: '16px 20px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className={`btn ${filterTab === 'All Payments' ? 'btn-navy' : 'btn-outline'} btn-small`}
              onClick={() => setFilterTab('All Payments')}
            >
              All Payments
            </button>
            <button
              className={`btn ${filterTab === 'Invoices' ? 'btn-navy' : 'btn-outline'} btn-small`}
              onClick={() => setFilterTab('Invoices')}
            >
              Invoices
            </button>
          </div>
        </div>

        {/* Payments Table (Prototype Page 10) */}
        <section className="card" style={{ padding: '24px', marginBottom: '24px' }}>
          {loading ? (
            <p style={{ textAlign: 'center', padding: '30px' }}>Loading payment records...</p>
          ) : payments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <img
                src="/assets/images/home-maintenance.jpg"
                alt="No Payments"
                style={{ width: '130px', height: '85px', objectFit: 'cover', borderRadius: 'var(--radius-md)', opacity: 0.8 }}
              />
              <h3>No payments recorded yet</h3>
              <p style={{ color: 'var(--secondary-text)' }}>
                Completed service payments will appear here with downloadable tax invoices.
              </p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Transaction ID</th>
                    <th>Service</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Payment Status</th>
                    <th>Invoice</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p._id}>
                      <td>
                        <strong>{p.paymentId}</strong>
                        <div style={{ fontSize: '12px', color: 'var(--secondary-text)' }}>
                          Ref: {p.transactionReference}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <img
                            src={getServiceImage(p.bookingId?.serviceId)}
                            alt="Service"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = homeMaintenanceImg;
                            }}
                            style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: 'var(--radius-sm)',
                              objectFit: 'cover'
                            }}
                          />
                          <strong>
                            {p.bookingId?.serviceId?.name || p.bookingId?.category || 'Home Service'}
                          </strong>
                        </div>
                      </td>
                      <td>
                        {new Date(p.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td>
                        <strong>₹{Number(p.amount).toLocaleString('en-IN')}</strong>
                      </td>
                      <td>
                        <span className="badge badge-paid">
                          <CheckCircle2 size={12} /> {p.paymentStatus}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-outline btn-small"
                          onClick={() => handleViewInvoice(p._id)}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <FileText size={14} /> Download
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Bottom Total Spent Banner matching Prototype */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: '12px',
              paddingTop: '20px',
              marginTop: '16px',
              borderTop: '2px solid var(--border-light)'
            }}
          >
            <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--secondary-text)' }}>
              Total Spent:
            </span>
            <strong style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary-navy)' }}>
              ₹{totalSpent.toLocaleString('en-IN')}
            </strong>
          </div>
        </section>

        {/* Demo Payment Notice */}
        <div
          style={{
            background: 'var(--accent-yellow-light)',
            padding: '14px 20px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--accent-yellow)',
            fontSize: '13px',
            color: 'var(--primary-navy)'
          }}
        >
          ℹ <strong>Notice:</strong> Payments in this MVP are processed in a test/mock workflow. No real credit card charges are made. Ready for Razorpay integration in production.
        </div>
      </main>

      {/* Invoice Viewer / Print Modal */}
      <Modal
        isOpen={Boolean(selectedInvoice)}
        onClose={() => setSelectedInvoice(null)}
        title={`Invoice ${selectedInvoice?.invoiceNumber || ''}`}
        maxWidth="680px"
      >
        {selectedInvoice && (
          <div className="printable-invoice" style={{ padding: '10px 0' }}>
            <div className="flex-between" style={{ borderBottom: '2px solid var(--primary-navy)', paddingBottom: '16px', marginBottom: '20px' }}>
              <div>
                <h2 style={{ color: 'var(--primary-navy)', fontWeight: 800 }}>HomeTech Solutions</h2>
                <p style={{ fontSize: '12px', color: 'var(--secondary-text)' }}>
                  123, Green Street, Vijayawada, AP, India<br />
                  GSTIN: 37AAAAA0000A1Z5 • support@hometech.demo
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h3 style={{ fontSize: '20px', color: 'var(--primary-navy)' }}>TAX INVOICE</h3>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Invoice #: {selectedInvoice.invoiceNumber}</span>
                <div style={{ fontSize: '12px', color: 'var(--secondary-text)' }}>
                  Date: {new Date(selectedInvoice.date).toLocaleDateString('en-IN')}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px', fontSize: '13px' }}>
              <div>
                <strong style={{ display: 'block', marginBottom: '4px' }}>Billed To:</strong>
                <div>{selectedInvoice.customer?.name}</div>
                <div>{selectedInvoice.customer?.phone}</div>
                <div>{selectedInvoice.customer?.address || 'Customer Address'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong style={{ display: 'block', marginBottom: '4px' }}>Payment Info:</strong>
                <div>Method: {selectedInvoice.paymentMethod}</div>
                <div>Txn Ref: {selectedInvoice.transactionReference}</div>
                <div style={{ color: 'var(--success)', fontWeight: 700 }}>Status: PAID</div>
              </div>
            </div>

            {/* Financials Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-color)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '8px', textAlign: 'left' }}>Item / Service</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Rate</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}>
                    <strong>{selectedInvoice.service?.name || 'Home Maintenance Service'}</strong>
                    <div style={{ fontSize: '11px', color: 'var(--secondary-text)' }}>
                      Category: {selectedInvoice.service?.category || 'General'}
                    </div>
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', borderBottom: '1px solid var(--border-light)' }}>
                    ₹{selectedInvoice.financials?.subtotal}
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', borderBottom: '1px solid var(--border-light)' }}>
                    ₹{selectedInvoice.financials?.subtotal}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '8px' }}>GST ({selectedInvoice.financials?.gstRate})</td>
                  <td style={{ padding: '8px' }} />
                  <td style={{ padding: '8px', textAlign: 'right' }}>₹{selectedInvoice.financials?.gstAmount}</td>
                </tr>
                <tr style={{ fontWeight: 800, fontSize: '15px', borderTop: '2px solid var(--border-color)' }}>
                  <td style={{ padding: '10px 8px' }}>Total Amount Paid</td>
                  <td style={{ padding: '10px 8px' }} />
                  <td style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--primary-navy)' }}>
                    ₹{selectedInvoice.financials?.grandTotal}
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn-outline btn-small" onClick={handlePrint}>
                <Printer size={15} /> Print Invoice
              </button>
              <button className="btn btn-navy btn-small" onClick={() => setSelectedInvoice(null)}>
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
