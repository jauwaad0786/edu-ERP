import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import {
  FileText, Plus, Download, Search, Filter, Calendar,
  CreditCard, Eye, Share2, CheckCircle2, Clock, AlertCircle, RefreshCw
} from 'lucide-react';

const STATUS_COLORS = {
  ISSUED: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  PARTIALLY_PAID: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  PAID: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  OVERDUE: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  DRAFT: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' },
};

export default function FeeBillsPage() {
  const navigate = useNavigate();
  const [bills, setBills] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');

  // Generate Bill Modal
  const [genModalOpen, setGenModalOpen] = useState(false);
  const [genMonth, setGenMonth] = useState('2026-09');
  const [genDueDate, setGenDueDate] = useState('2026-09-05');
  const [genClassId, setGenClassId] = useState('');
  const [genSubmitting, setGenSubmitting] = useState(false);

  const fetchClasses = async () => {
    try {
      const res = await api.get('/principal/classes');
      setClasses(res.data || []);
    } catch (e) {}
  };

  const fetchBills = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (selectedClass) params.append('class_id', selectedClass);
      if (selectedStatus) params.append('status', selectedStatus);
      if (selectedMonth) params.append('month', selectedMonth);

      const res = await api.get(`/fees-finance/bills?${params.toString()}`);
      setBills(res.data || []);
    } catch (err) {
      toast.error('Failed to load fee bills');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    fetchBills();
  }, [selectedClass, selectedStatus, selectedMonth]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchBills();
  };

  const handleGenerateSubmit = async (e) => {
    e.preventDefault();
    try {
      setGenSubmitting(true);
      const payload = {
        bill_month: genMonth,
        due_date: genDueDate,
        class_id: genClassId || null,
      };
      const res = await api.post('/fees-finance/bills/generate', payload);
      toast.success(`Bills generated! Generated: ${res.data.generated_count || 0}, Skipped: ${res.data.skipped_count || 0}`);
      setGenModalOpen(false);
      fetchBills();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate bills');
    } finally {
      setGenSubmitting(false);
    }
  };

  const downloadPDF = async (billId, billNo) => {
    try {
      toast.loading('Preparing PDF...', { id: 'pdf-dl' });
      const res = await api.get(`/fees-finance/bills/${billId}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${billNo}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Downloaded!', { id: 'pdf-dl' });
    } catch (e) {
      toast.error('Could not download PDF', { id: 'pdf-dl' });
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
                <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                  Pre-Due Fee Bills
                </span>
                <span className="text-xs text-slate-500">Demand Notices & Invoices</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mt-1">Fee Bills & Demand Notices</h1>
              <p className="text-xs text-slate-500">
                Generate advance fee bills before due date and issue demand notices to parents.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setGenModalOpen(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-md shadow-blue-500/20 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Generate Demand Bills
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
            <form onSubmit={handleSearchSubmit} className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by student name, admission no, or bill no..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </form>

            <div className="flex flex-wrap items-center gap-2">
              {/* Month Filter */}
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none"
              />

              {/* Class Filter */}
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none"
              >
                <option value="">All Classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.section || ''}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none"
              >
                <option value="">All Statuses</option>
                <option value="ISSUED">Issued (Unpaid)</option>
                <option value="PARTIALLY_PAID">Partially Paid</option>
                <option value="PAID">Paid</option>
                <option value="OVERDUE">Overdue</option>
              </select>

              <button
                onClick={fetchBills}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Bills Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="py-16 text-center text-slate-400 text-sm">Loading fee bills...</div>
            ) : bills.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-sm font-semibold text-slate-700">No fee bills found</p>
                <p className="text-xs text-slate-400">Click 'Generate Demand Bills' to create advance fee bills.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 uppercase bg-slate-50/50">
                      <th className="py-3 px-4">Bill No</th>
                      <th className="py-3 px-4">Student & Class</th>
                      <th className="py-3 px-4">Period</th>
                      <th className="py-3 px-4 text-right">Total Payable</th>
                      <th className="py-3 px-4 text-right">Paid</th>
                      <th className="py-3 px-4 text-right">Balance Due</th>
                      <th className="py-3 px-4">Due Date</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bills.map((b) => {
                      const st = STATUS_COLORS[b.status] || STATUS_COLORS.ISSUED;
                      return (
                        <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-xs text-slate-800">
                            {b.bill_no}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">{b.student_name}</div>
                            <div className="text-xs text-slate-500">
                              {b.admission_no} • {b.class_name}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-xs font-medium text-slate-700">
                            {b.bill_period_label}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900">
                            {fmt(b.total_payable)}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-emerald-700">
                            {fmt(b.amount_paid)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-amber-700">
                            {fmt(b.balance_due)}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-600">
                            {b.due_date}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${st.bg} ${st.text} ${st.border}`}>
                              {b.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => downloadPDF(b.id, b.bill_no)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Download Demand Notice PDF"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => navigate(`/finance/students/${b.student_id}/ledger`)}
                                className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                title="View Student Ledger"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {b.balance_due > 0 && (
                                <button
                                  onClick={() => navigate(`/finance/payments/collect?student_id=${b.student_id}`)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
                                  title="Collect Payment"
                                >
                                  Pay
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Generate Bills Modal */}
      {genModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Generate Advance Fee Bills</h3>
                <p className="text-xs text-slate-500">Calculate tuition, transport, hostel & fines</p>
              </div>
              <button
                onClick={() => setGenModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGenerateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Fee Month (YYYY-MM)</label>
                <input
                  type="month"
                  value={genMonth}
                  onChange={(e) => setGenMonth(e.target.value)}
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Due Date</label>
                <input
                  type="date"
                  value={genDueDate}
                  onChange={(e) => setGenDueDate(e.target.value)}
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Class (Optional)</label>
                <select
                  value={genClassId}
                  onChange={(e) => setGenClassId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Classes (School-Wide)</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.section || ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-[11px] text-blue-800 space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                  Auto-Calculation Rules
                </div>
                <p>• Tuition + Transport + Hostel + Unpaid Library Fines are itemized.</p>
                <p>• Approved concessions are automatically credited.</p>
                <p>• Duplicate bills for the same month are automatically prevented.</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setGenModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={genSubmitting}
                  className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition-all disabled:opacity-50"
                >
                  {genSubmitting ? 'Generating...' : 'Generate Demand Bills'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
