import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import {
  CreditCard, Search, CheckCircle2, FileText, Download,
  User, DollarSign, Calendar, ArrowRight, ShieldCheck, Printer, RefreshCw
} from 'lucide-react';

const PAYMENT_MODES = [
  { id: 'UPI', label: 'UPI / QR Code', icon: '⚡' },
  { id: 'CASH', label: 'Cash Counter', icon: '💵' },
  { id: 'CARD', label: 'Debit / Credit Card', icon: '💳' },
  { id: 'BANK_TRANSFER', label: 'Bank Transfer (NEFT/RTGS)', icon: '🏛️' },
  { id: 'CHEQUE', label: 'Cheque / DD', icon: '📝' },
];

export default function CollectPaymentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preSelectedStudentId = searchParams.get('student_id');

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Student Ledger & Pending Bills
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [ledgerData, setLedgerData] = useState(null);

  // Selected Charges for Payment
  const [selectedItems, setSelectedItems] = useState({});
  const [customPayAmount, setCustomPayAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [transactionRef, setTransactionRef] = useState('');
  const [remarks, setRemarks] = useState('');
  const [collecting, setCollecting] = useState(false);

  // Success Receipt Modal
  const [receiptModal, setReceiptModal] = useState(null);

  const searchStudents = async (query) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      setSearching(true);
      const res = await api.get(`/principal/students?search=${encodeURIComponent(query.trim())}`);
      setSearchResults(res.data?.data || res.data || []);
    } catch (e) {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const loadStudentFinancials = async (studentId) => {
    try {
      setLoadingLedger(true);
      const res = await api.get(`/fees-finance/students/${studentId}/ledger`);
      setLedgerData(res.data);

      // Auto-select all unpaid items by default
      const itemMap = {};
      let total = 0;
      (res.data.bills || []).forEach((b) => {
        if (b.status !== 'PAID') {
          (b.items || []).forEach((it) => {
            if (it.balance_amount > 0) {
              itemMap[it.id] = {
                bill_id: b.id,
                bill_item_id: it.id,
                fee_head_id: it.fee_head_id,
                fee_head_name: it.fee_head_name,
                department: it.department,
                amount: it.balance_amount,
                max: it.balance_amount,
                selected: true,
              };
              total += it.balance_amount;
            }
          });
        }
      });
      setSelectedItems(itemMap);
      setCustomPayAmount(total.toFixed(2));
    } catch (err) {
      toast.error('Failed to load student ledger');
    } finally {
      setLoadingLedger(false);
    }
  };

  useEffect(() => {
    if (preSelectedStudentId) {
      api.get(`/principal/students/${preSelectedStudentId}`).then((r) => {
        const s = r.data;
        setSelectedStudent(s);
        loadStudentFinancials(s.id);
      }).catch(() => {});
    }
  }, [preSelectedStudentId]);

  const handleSelectStudent = (student) => {
    setSelectedStudent(student);
    setSearchResults([]);
    setSearchQuery('');
    loadStudentFinancials(student.id);
  };

  const toggleItem = (itemId) => {
    const next = { ...selectedItems };
    if (next[itemId]) {
      next[itemId].selected = !next[itemId].selected;
      setSelectedItems(next);

      // Recalculate total
      const tot = Object.values(next)
        .filter((i) => i.selected)
        .reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);
      setCustomPayAmount(tot.toFixed(2));
    }
  };

  const handleItemAmountChange = (itemId, val) => {
    const next = { ...selectedItems };
    if (next[itemId]) {
      const num = parseFloat(val) || 0;
      next[itemId].amount = Math.min(num, next[itemId].max);
      setSelectedItems(next);

      const tot = Object.values(next)
        .filter((i) => i.selected)
        .reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);
      setCustomPayAmount(tot.toFixed(2));
    }
  };

  const handleCollectSubmit = async (e) => {
    e.preventDefault();
    const payAmt = parseFloat(customPayAmount) || 0;
    if (payAmt <= 0) {
      toast.error('Please specify a payment amount greater than zero.');
      return;
    }

    try {
      setCollecting(true);
      const allocations = Object.values(selectedItems)
        .filter((i) => i.selected && i.amount > 0)
        .map((i) => ({
          bill_id: i.bill_id,
          bill_item_id: i.bill_item_id,
          fee_head_id: i.fee_head_id,
          amount: i.amount,
        }));

      const payload = {
        student_id: selectedStudent.id,
        amount: payAmt,
        payment_mode: paymentMode,
        transaction_ref: transactionRef,
        allocations: allocations,
        remarks: remarks,
      };

      const res = await api.post('/fees-finance/payments/collect', payload);
      toast.success('Payment collected successfully!');
      setReceiptModal(res.data.payment);
      // Reload financial ledger
      loadStudentFinancials(selectedStudent.id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to collect payment');
    } finally {
      setCollecting(false);
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
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full">
                  Counter POS
                </span>
                <span className="text-xs text-slate-500">Multi-Service Fee Collection</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mt-1">Fee Payment Collection</h1>
              <p className="text-xs text-slate-500">
                Collect tuition, transport, hostel, and library dues with automatic multi-department credit.
              </p>
            </div>

            <button
              onClick={() => navigate('/finance/receipts')}
              className="flex items-center gap-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              View Past Receipts
            </button>
          </div>

          {/* Student Search Bar */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
              Step 1: Search & Select Student
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  searchStudents(e.target.value);
                }}
                placeholder="Search by student name, admission number, or mobile..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />

              {/* Search Dropdown Results */}
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-60 overflow-y-auto divide-y divide-slate-100">
                  {searchResults.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSelectStudent(s)}
                      className="w-full p-3 text-left hover:bg-emerald-50/50 flex items-center justify-between transition-colors text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600">
                          {s.user?.name ? s.user.name.charAt(0) : 'S'}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{s.user?.name || s.name}</div>
                          <div className="text-slate-500">
                            Adm: {s.admission_no} • Class: {s.class_ref?.name || s.class_name || '—'}
                          </div>
                        </div>
                      </div>
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        Select <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Student Overview Banner (If selected) */}
          {selectedStudent && (
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl text-white shadow-lg space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-lg font-bold text-emerald-300">
                    {selectedStudent.user?.name ? selectedStudent.user.name.charAt(0) : 'S'}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">{selectedStudent.user?.name || selectedStudent.name}</h2>
                    <p className="text-xs text-slate-300">
                      Adm No: <span className="font-mono text-emerald-300">{selectedStudent.admission_no}</span> • Class: {selectedStudent.class_ref?.name || selectedStudent.class_name || '—'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/10 text-right">
                    <div className="text-[10px] uppercase font-semibold text-slate-400">Total Outstanding</div>
                    <div className="text-xl font-bold text-amber-300">{fmt(ledgerData?.outstanding)}</div>
                  </div>
                  <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/10 text-right">
                    <div className="text-[10px] uppercase font-semibold text-slate-400">Total Paid</div>
                    <div className="text-xl font-bold text-emerald-400">{fmt(ledgerData?.total_paid)}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Payment Collection Form */}
          {selectedStudent && (
            <form onSubmit={handleCollectSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Itemized Dues Selection */}
              <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Step 2: Select Applicable Charges</h3>
                    <p className="text-xs text-slate-500">Pick charges to clear or enter custom amounts</p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg">
                    {Object.keys(selectedItems).length} Unpaid Items
                  </span>
                </div>

                {loadingLedger ? (
                  <div className="py-12 text-center text-slate-400 text-xs">Loading ledger...</div>
                ) : Object.keys(selectedItems).length === 0 ? (
                  <div className="py-12 text-center space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                    <p className="text-sm font-bold text-slate-800">All Dues Cleared!</p>
                    <p className="text-xs text-slate-400">This student has no pending fee bills.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {Object.entries(selectedItems).map(([id, itm]) => (
                      <div
                        key={id}
                        className={`p-3.5 flex items-center justify-between gap-3 transition-colors ${
                          itm.selected ? 'bg-emerald-50/40' : 'bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={itm.selected}
                            onChange={() => toggleItem(id)}
                            className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                          />
                          <div>
                            <div className="text-xs font-bold text-slate-800">{itm.fee_head_name}</div>
                            <div className="text-[11px] text-slate-500">
                              Dept: <span className="font-semibold uppercase">{itm.department}</span> • Due: {fmt(itm.max)}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">Paying ₹</span>
                          <input
                            type="number"
                            min="0"
                            max={itm.max}
                            step="any"
                            value={itm.amount}
                            disabled={!itm.selected}
                            onChange={(e) => handleItemAmountChange(id, e.target.value)}
                            className="w-24 p-1.5 text-right font-bold text-xs bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Column: Payment Details & Collect Button */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-base font-bold text-slate-900">Step 3: Payment & Receipt</h3>

                {/* Total Payment Amount */}
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 space-y-1">
                  <label className="block text-[11px] font-bold text-emerald-800 uppercase">
                    Total Amount to Collect
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-lg font-bold text-emerald-700">₹</span>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      value={customPayAmount}
                      onChange={(e) => setCustomPayAmount(e.target.value)}
                      required
                      className="w-full pl-8 pr-3 py-2 bg-white border border-emerald-300 rounded-lg text-xl font-black text-emerald-800 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Payment Mode */}
                <div className="space-y-1.5 text-xs">
                  <label className="block font-bold text-slate-700">Payment Mode</label>
                  <div className="grid grid-cols-1 gap-1.5">
                    {PAYMENT_MODES.map((m) => (
                      <label
                        key={m.id}
                        className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          paymentMode === m.id
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span>{m.icon}</span>
                          <span>{m.label}</span>
                        </span>
                        <input
                          type="radio"
                          name="payMode"
                          value={m.id}
                          checked={paymentMode === m.id}
                          onChange={(e) => setPaymentMode(e.target.value)}
                          className="sr-only"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                {/* Transaction Ref */}
                <div className="space-y-1 text-xs">
                  <label className="block font-bold text-slate-700">
                    Transaction Ref / UPI UTR / Cheque No
                  </label>
                  <input
                    type="text"
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                    placeholder="e.g. UPI Ref # / Cheque #123456"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Remarks */}
                <div className="space-y-1 text-xs">
                  <label className="block font-bold text-slate-700">Remarks (Optional)</label>
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="e.g. Paid at counter by Father"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={collecting}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-5 h-5" />
                  {collecting ? 'Processing...' : 'Collect Payment & Issue Receipt'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Success Receipt Modal */}
      {receiptModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Payment Successfully Collected!</h3>
              <p className="text-xs text-slate-500">Official receipt has been generated and credited to student ledger.</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Receipt No:</span>
                <span className="font-mono font-bold text-slate-900">{receiptModal.receipt_no}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Student:</span>
                <span className="font-bold text-slate-900">{receiptModal.student_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount Paid:</span>
                <span className="font-bold text-emerald-700 text-sm">{fmt(receiptModal.total_paid)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Mode:</span>
                <span className="font-semibold text-slate-800">{receiptModal.payment_mode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Transaction Date:</span>
                <span className="text-slate-700">{receiptModal.payment_date}</span>
              </div>
            </div>

            {/* Department Breakdown */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-700 uppercase">Allocations</span>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl text-xs">
                {receiptModal.allocations?.map((alc, i) => (
                  <div key={i} className="p-2.5 flex justify-between">
                    <span className="text-slate-700 font-medium">{alc.fee_head_name} ({alc.department})</span>
                    <span className="font-bold text-slate-900">{fmt(alc.allocated_amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setReceiptModal(null)}
                className="flex-1 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-xl"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => downloadReceiptPDF(receiptModal.id, receiptModal.receipt_no)}
                className="flex-1 py-2.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md flex items-center justify-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                Download PDF Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
