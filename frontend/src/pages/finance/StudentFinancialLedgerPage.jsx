import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import {
  User, DollarSign, FileText, CheckCircle2, Download,
  CreditCard, ArrowLeft, Layers, Percent, Clock, AlertCircle
} from 'lucide-react';

const STATUS_COLORS = {
  ISSUED: 'bg-blue-50 text-blue-700 border-blue-200',
  PARTIALLY_PAID: 'bg-amber-50 text-amber-700 border-amber-200',
  PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  OVERDUE: 'bg-rose-50 text-rose-700 border-rose-200',
};

export default function StudentFinancialLedgerPage() {
  const { studentId } = useParams();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('bills'); // bills | payments | ledger | concessions
  const [data, setData] = useState(null);
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);

  // Concession Modal
  const [concessionModal, setConcessionModal] = useState(false);
  const [feeHeads, setFeeHeads] = useState([]);
  const [cType, setCType] = useState('SCHOLARSHIP');
  const [dType, setDType] = useState('FIXED');
  const [dVal, setDVal] = useState('');
  const [selectedFeeHead, setSelectedFeeHead] = useState('');
  const [cReason, setCReason] = useState('');
  const [savingConcession, setSavingConcession] = useState(false);

  const fetchFinancials = async () => {
    try {
      setLoading(true);
      const [ledgerRes, studentRes, headsRes] = await Promise.all([
        api.get(`/fees-finance/students/${studentId}/ledger`),
        api.get(`/principal/students/${studentId}`).catch(() => ({ data: null })),
        api.get('/fees-finance/heads').catch(() => ({ data: [] })),
      ]);
      setData(ledgerRes.data);
      setStudent(studentRes.data);
      setFeeHeads(headsRes.data || []);
    } catch (err) {
      toast.error('Failed to load student financial ledger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinancials();
  }, [studentId]);

  const handleApplyConcession = async (e) => {
    e.preventDefault();
    try {
      setSavingConcession(true);
      await api.post('/fees-finance/concessions', {
        student_id: parseInt(studentId),
        fee_head_id: selectedFeeHead ? parseInt(selectedFeeHead) : null,
        concession_type: cType,
        discount_type: dType,
        discount_value: parseFloat(dVal),
        reason: cReason,
      });
      toast.success('Concession applied successfully!');
      setConcessionModal(false);
      fetchFinancials();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to apply concession');
    } finally {
      setSavingConcession(false);
    }
  };

  const downloadBillPDF = async (billId, billNo) => {
    try {
      toast.loading('Preparing Bill...', { id: 'bill-dl' });
      const res = await api.get(`/fees-finance/bills/${billId}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${billNo}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Downloaded!', { id: 'bill-dl' });
    } catch (e) {
      toast.error('Could not download bill', { id: 'bill-dl' });
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
          {/* Back Button & Header */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setConcessionModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition-all"
              >
                <Percent className="w-3.5 h-3.5" />
                Apply Concession
              </button>
              <button
                onClick={() => navigate(`/finance/payments/collect?student_id=${studentId}`)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                <CreditCard className="w-3.5 h-3.5" />
                Collect Payment
              </button>
            </div>
          </div>

          {/* Student Profile Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-indigo-600 text-xl shadow-inner">
                {data?.student_name ? data.student_name.charAt(0) : 'S'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-slate-900">{data?.student_name}</h1>
                  <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 font-mono text-[11px] font-bold rounded-md">
                    {data?.admission_no}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Class: <span className="font-semibold text-slate-700">{data?.class_name}</span> • Session: {data?.session}
                </p>
                {student && (
                  <p className="text-xs text-slate-500">
                    Parent: {student.father_name || student.guardian_name || '—'} • Mobile: {student.parent_phone || '—'}
                  </p>
                )}
              </div>
            </div>

            {/* Balances */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <span className="text-[10px] font-semibold text-slate-500 uppercase">Total Invoiced</span>
                <div className="text-base font-bold text-slate-800">{fmt(data?.total_billed)}</div>
              </div>
              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 text-center">
                <span className="text-[10px] font-semibold text-emerald-800 uppercase">Total Paid</span>
                <div className="text-base font-bold text-emerald-700">{fmt(data?.total_paid)}</div>
              </div>
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100 text-center">
                <span className="text-[10px] font-semibold text-amber-800 uppercase">Outstanding</span>
                <div className="text-base font-bold text-amber-700">{fmt(data?.outstanding)}</div>
              </div>
              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-center">
                <span className="text-[10px] font-semibold text-indigo-800 uppercase">Advance Credit</span>
                <div className="text-base font-bold text-indigo-700">{fmt(data?.advance_credit)}</div>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200">
            {[
              { id: 'bills', label: 'Demand Bills', icon: FileText, count: data?.bills?.length },
              { id: 'payments', label: 'Payment Receipts', icon: CheckCircle2, count: data?.payments?.length },
              { id: 'ledger', label: 'Transaction Ledger', icon: Layers, count: data?.ledger_entries?.length },
              { id: 'concessions', label: 'Concessions & Waivers', icon: Percent, count: data?.concessions?.length },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all ${
                    active
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${active ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'}`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab 1: Demand Bills */}
          {activeTab === 'bills' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {data?.bills?.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">No demand bills issued yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 uppercase bg-slate-50/50">
                        <th className="py-3 px-4">Bill No</th>
                        <th className="py-3 px-4">Period</th>
                        <th className="py-3 px-4 text-right">Payable</th>
                        <th className="py-3 px-4 text-right">Paid</th>
                        <th className="py-3 px-4 text-right">Balance</th>
                        <th className="py-3 px-4">Due Date</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-center">PDF</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {data?.bills?.map((b) => (
                        <tr key={b.id} className="hover:bg-slate-50/80">
                          <td className="py-3 px-4 font-mono font-bold text-slate-800">{b.bill_no}</td>
                          <td className="py-3 px-4 font-semibold text-slate-900">{b.bill_period_label}</td>
                          <td className="py-3 px-4 text-right font-bold text-slate-800">{fmt(b.total_payable)}</td>
                          <td className="py-3 px-4 text-right font-semibold text-emerald-700">{fmt(b.amount_paid)}</td>
                          <td className="py-3 px-4 text-right font-bold text-amber-700">{fmt(b.balance_due)}</td>
                          <td className="py-3 px-4 text-slate-600">{b.due_date}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_COLORS[b.status] || STATUS_COLORS.ISSUED}`}>
                              {b.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => downloadBillPDF(b.id, b.bill_no)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                              title="Download Bill PDF"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Payment Receipts */}
          {activeTab === 'payments' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {data?.payments?.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">No payment receipts found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 uppercase bg-slate-50/50">
                        <th className="py-3 px-4">Receipt No</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Mode</th>
                        <th className="py-3 px-4">Transaction Ref</th>
                        <th className="py-3 px-4 text-right">Amount Paid</th>
                        <th className="py-3 px-4">Collected By</th>
                        <th className="py-3 px-4 text-center">Receipt PDF</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {data?.payments?.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/80">
                          <td className="py-3 px-4 font-mono font-bold text-slate-800">{p.receipt_no}</td>
                          <td className="py-3 px-4 text-slate-700">{p.payment_date}</td>
                          <td className="py-3 px-4 font-semibold text-slate-800">{p.payment_mode}</td>
                          <td className="py-3 px-4 font-mono text-slate-500">{p.transaction_ref || '—'}</td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-700">{fmt(p.total_paid)}</td>
                          <td className="py-3 px-4 text-slate-600">{p.collected_by_name}</td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => downloadReceiptPDF(p.id, p.receipt_no)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                              title="Download Receipt PDF"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Transaction Ledger */}
          {activeTab === 'ledger' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {data?.ledger_entries?.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">No ledger movements recorded.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 uppercase bg-slate-50/50">
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Department</th>
                        <th className="py-3 px-4">Description / Reference</th>
                        <th className="py-3 px-4 text-right">Debit (₹)</th>
                        <th className="py-3 px-4 text-right">Credit (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {data?.ledger_entries?.map((e) => (
                        <tr key={e.id} className="hover:bg-slate-50/80">
                          <td className="py-3 px-4 text-slate-600">{e.entry_date}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              e.entry_type === 'DEBIT' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                            }`}>
                              {e.entry_type}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-semibold uppercase text-slate-600">{e.department}</td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">{e.description}</div>
                            {e.reference_no && <div className="text-[11px] font-mono text-slate-400">{e.reference_no}</div>}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-rose-700">
                            {e.entry_type === 'DEBIT' ? fmt(e.amount) : '—'}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-700">
                            {e.entry_type === 'CREDIT' ? fmt(e.amount) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab 4: Concessions */}
          {activeTab === 'concessions' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Active Concessions & Scholarships</h3>
                  <p className="text-xs text-slate-500">Authorized fee discounts applied to this student</p>
                </div>
                <button
                  onClick={() => setConcessionModal(true)}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold"
                >
                  + Add Concession
                </button>
              </div>

              {data?.concessions?.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">No active concessions on record.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {data?.concessions?.map((c) => (
                    <div key={c.id} className="p-4 bg-purple-50/40 rounded-xl border border-purple-100 space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-purple-900">{c.concession_type.replace('_', ' ')}</span>
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-800 font-bold rounded">
                          {c.discount_type === 'PERCENTAGE' ? `${c.discount_value}% OFF` : `₹${c.discount_value} OFF`}
                        </span>
                      </div>
                      <div className="text-slate-600 font-medium">Head: {c.fee_head_name}</div>
                      <div className="text-slate-500 italic">"{c.reason}"</div>
                      <div className="text-[11px] text-slate-400 pt-1 border-t border-purple-100">
                        Approved by {c.approved_by_name}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Apply Concession Modal */}
      {concessionModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Apply Student Concession</h3>
                <p className="text-xs text-slate-500">Scholarship, sibling, or staff child discount</p>
              </div>
              <button onClick={() => setConcessionModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                ✕
              </button>
            </div>

            <form onSubmit={handleApplyConcession} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Concession Type</label>
                <select
                  value={cType}
                  onChange={(e) => setCType(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-none focus:bg-white focus:ring-2 focus:ring-purple-500"
                >
                  <option value="SCHOLARSHIP">Merit / Academic Scholarship</option>
                  <option value="SIBLING">Sibling Discount</option>
                  <option value="STAFF_CHILD">Staff Child Concession</option>
                  <option value="PRINCIPAL_SPECIAL">Principal Special Concession</option>
                  <option value="PARTIAL_WAIVER">Partial Fee Waiver</option>
                  <option value="FULL_WAIVER">Full 100% Waiver</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Applicable Fee Head</label>
                <select
                  value={selectedFeeHead}
                  onChange={(e) => setSelectedFeeHead(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-none focus:bg-white focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">All Fee Heads (Total Bill)</option>
                  {feeHeads.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.department})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Discount Type</label>
                  <select
                    value={dType}
                    onChange={(e) => setDType(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-none"
                  >
                    <option value="FIXED">Fixed Amount (₹)</option>
                    <option value="PERCENTAGE">Percentage (%)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Discount Value</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={dVal}
                    onChange={(e) => setDVal(e.target.value)}
                    placeholder={dType === 'FIXED' ? 'e.g. 500' : 'e.g. 20'}
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:bg-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Official Reason & Authorization</label>
                <textarea
                  rows="2"
                  value={cReason}
                  onChange={(e) => setCReason(e.target.value)}
                  placeholder="e.g. Approved under Merit Scholarship Scheme 2026-27"
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConcessionModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingConcession}
                  className="px-4 py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-md transition-all disabled:opacity-50"
                >
                  {savingConcession ? 'Saving...' : 'Save & Authorize'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
