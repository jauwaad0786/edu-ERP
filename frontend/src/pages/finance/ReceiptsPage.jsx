import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import {
  CheckCircle2, Search, Download, Eye, XCircle, Filter,
  Calendar, CreditCard, RefreshCw, AlertTriangle
} from 'lucide-react';

export default function ReceiptsPage() {
  const navigate = useNavigate();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedMode, setSelectedMode] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');

  // View Modal
  const [viewPayment, setViewPayment] = useState(null);

  // Cancel Modal
  const [cancelModal, setCancelModal] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (selectedMode) params.append('payment_mode', selectedMode);
      if (selectedStatus) params.append('status', selectedStatus);
      if (selectedDepartment) params.append('department', selectedDepartment);

      const res = await api.get(`/fees-finance/payments?${params.toString()}`);
      setPayments(res.data || []);
    } catch (err) {
      toast.error('Failed to load receipts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [selectedMode, selectedStatus, selectedDepartment]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchPayments();
  };

  const handleCancelSubmit = async (e) => {
    e.preventDefault();
    if (!cancelReason.trim()) {
      toast.error('Cancellation reason is required.');
      return;
    }

    try {
      setCancelling(true);
      await api.post(`/fees-finance/payments/${cancelModal.id}/cancel`, {
        reason: cancelReason,
      });
      toast.success('Receipt cancelled successfully');
      setCancelModal(null);
      setCancelReason('');
      fetchPayments();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to cancel receipt');
    } finally {
      setCancelling(false);
    }
  };

  const downloadReceiptPDF = async (paymentId, receiptNo) => {
    try {
      toast.loading('Preparing Receipt...', { id: 'rcpt-dl' });
      const res = await api.get(`/fees-finance/payments/${paymentId}/receipt-pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${receiptNo}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Downloaded!', { id: 'rcpt-dl' });
    } catch (e) {
      toast.error('Could not download receipt', { id: 'rcpt-dl' });
    }
  };

  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-y-auto">
        <Navbar />

        <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full">
                  Official Records
                </span>
                <span className="text-xs text-slate-500">Payment Audit Trail</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mt-1">Fee Receipts & Payments</h1>
              <p className="text-xs text-slate-500">
                Official payment vouchers, service-wise allocation breakdown, and cancellation audit.
              </p>
            </div>

            <button
              onClick={() => navigate('/finance/payments/collect')}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-md shadow-emerald-500/20 active:scale-95"
            >
              <CreditCard className="w-4 h-4" />
              Collect New Payment
            </button>
          </div>

          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
            <form onSubmit={handleSearchSubmit} className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by student name, admission no, receipt no, or UTR..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </form>

            <div className="flex flex-wrap items-center gap-2">
              {/* Mode Filter */}
              <select
                value={selectedMode}
                onChange={(e) => setSelectedMode(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none"
              >
                <option value="">All Payment Modes</option>
                <option value="UPI">UPI / QR</option>
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CHEQUE">Cheque</option>
              </select>

              {/* Status Filter */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none"
              >
                <option value="">All Statuses</option>
                <option value="VALID">Valid</option>
                <option value="CANCELLED">Cancelled</option>
              </select>

              <button
                onClick={fetchPayments}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Receipts Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="py-16 text-center text-slate-400 text-sm">Loading receipts...</div>
            ) : payments.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-sm font-semibold text-slate-700">No payment receipts found</p>
                <p className="text-xs text-slate-400">Collect payments to generate receipts.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 uppercase bg-slate-50/50">
                      <th className="py-3 px-4">Receipt No</th>
                      <th className="py-3 px-4">Student & Class</th>
                      <th className="py-3 px-4">Payment Date</th>
                      <th className="py-3 px-4">Mode & Ref</th>
                      <th className="py-3 px-4 text-right">Amount Paid</th>
                      <th className="py-3 px-4">Collected By</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payments.map((p) => (
                      <tr
                        key={p.id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          p.status === 'CANCELLED' ? 'bg-rose-50/20 opacity-75' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-mono font-bold text-xs text-slate-800">
                          {p.receipt_no}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{p.student_name}</div>
                          <div className="text-xs text-slate-500">
                            {p.admission_no} • {p.class_name}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs font-medium text-slate-700">
                          {p.payment_date}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-xs text-slate-800">{p.payment_mode}</span>
                          {p.transaction_ref && (
                            <div className="text-[11px] font-mono text-slate-500 truncate max-w-[120px]">
                              {p.transaction_ref}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-700">
                          {fmt(p.total_paid)}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">
                          {p.collected_by_name}
                        </td>
                        <td className="py-3 px-4">
                          {p.status === 'VALID' ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Valid
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              Cancelled
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => downloadReceiptPDF(p.id, p.receipt_no)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Download Receipt PDF"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setViewPayment(p)}
                              className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                              title="View Breakdown"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {p.status === 'VALID' && (
                              <button
                                onClick={() => {
                                  setCancelModal(p);
                                  setCancelReason('');
                                }}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Cancel Receipt"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* View Breakdown Modal */}
      {viewPayment && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Receipt Details</h3>
                <p className="text-xs font-mono text-slate-500">{viewPayment.receipt_no}</p>
              </div>
              <button onClick={() => setViewPayment(null)} className="text-slate-400 hover:text-slate-600 p-1">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Student:</span>
                  <span className="font-bold text-slate-900">{viewPayment.student_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Date:</span>
                  <span className="text-slate-700">{viewPayment.payment_date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Mode:</span>
                  <span className="font-semibold text-slate-800">{viewPayment.payment_mode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Paid:</span>
                  <span className="font-bold text-emerald-700">{fmt(viewPayment.total_paid)}</span>
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-700 block mb-1">Service Allocations:</span>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
                  {viewPayment.allocations?.map((alc, i) => (
                    <div key={i} className="p-2.5 flex justify-between">
                      <span className="text-slate-700">{alc.fee_head_name} ({alc.department})</span>
                      <span className="font-bold text-slate-900">{fmt(alc.allocated_amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setViewPayment(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => downloadReceiptPDF(viewPayment.id, viewPayment.receipt_no)}
                className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Receipt Modal */}
      {cancelModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 bg-rose-100 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Cancel Receipt</h3>
                <p className="text-xs font-mono text-slate-500">{cancelModal.receipt_no}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Cancelling this receipt will reverse ₹{cancelModal.total_paid} from the student ledger and reinstate the unpaid balance on their bill.
            </p>

            <form onSubmit={handleCancelSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Cancellation Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows="3"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Explain why this receipt is being cancelled..."
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCancelModal(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={cancelling}
                  className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md transition-all disabled:opacity-50"
                >
                  {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
