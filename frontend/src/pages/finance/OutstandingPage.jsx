import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import {
  AlertCircle, Search, Filter, Phone, MessageSquare,
  CreditCard, Eye, Download, Calendar, RefreshCw
} from 'lucide-react';

export default function OutstandingPage() {
  const navigate = useNavigate();
  const [bills, setBills] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedClass, setSelectedClass] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [search, setSearch] = useState('');

  const fetchClasses = async () => {
    try {
      const res = await api.get('/principal/classes');
      setClasses(res.data || []);
    } catch (e) {}
  };

  const fetchOutstanding = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedClass) params.append('class_id', selectedClass);
      if (selectedMonth) params.append('month', selectedMonth);

      const res = await api.get(`/fees-finance/outstanding?${params.toString()}`);
      setBills(res.data || []);
    } catch (err) {
      toast.error('Failed to load outstanding dues');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    fetchOutstanding();
  }, [selectedClass, selectedMonth]);

  const filteredBills = bills.filter((b) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      b.student_name?.toLowerCase().includes(s) ||
      b.admission_no?.toLowerCase().includes(s) ||
      b.bill_no?.toLowerCase().includes(s)
    );
  });

  const totalOutstanding = filteredBills.reduce((sum, b) => sum + (b.balance_due || 0), 0);

  const sendWhatsAppReminder = (bill) => {
    const text = `Dear Parent, this is a reminder regarding the pending fee of ₹${bill.balance_due} for ${bill.student_name} (${bill.admission_no}) for the period ${bill.bill_period_label}. Due date: ${bill.due_date}. Please pay to avoid late fines.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
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
                <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full">
                  Defaulter Tracking
                </span>
                <span className="text-xs text-slate-500">Unpaid Student Arrears</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mt-1">Outstanding Fees & Defaulters</h1>
              <p className="text-xs text-slate-500">
                Track pending balances by class, fee period, and send instant payment reminders.
              </p>
            </div>

            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-right">
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wide">Total Unpaid Dues</span>
              <div className="text-xl font-bold text-amber-800">{fmt(totalOutstanding)}</div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search defaulter by student name, admission no, or bill no..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none"
              />

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

              <button
                onClick={fetchOutstanding}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="py-16 text-center text-slate-400 text-sm">Loading defaulters...</div>
            ) : filteredBills.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <AlertCircle className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="text-sm font-bold text-slate-800">No Defaulters Found!</p>
                <p className="text-xs text-slate-400">All student dues are clear for the selected filter.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 uppercase bg-slate-50/50">
                      <th className="py-3 px-4">Student & Class</th>
                      <th className="py-3 px-4">Bill No</th>
                      <th className="py-3 px-4">Period</th>
                      <th className="py-3 px-4 text-right">Total Payable</th>
                      <th className="py-3 px-4 text-right">Amount Paid</th>
                      <th className="py-3 px-4 text-right">Pending Dues</th>
                      <th className="py-3 px-4">Due Date</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredBills.map((b) => (
                      <tr key={b.id} className="hover:bg-amber-50/20 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{b.student_name}</div>
                          <div className="text-[11px] text-slate-500">
                            {b.admission_no} • {b.class_name}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-800">{b.bill_no}</td>
                        <td className="py-3 px-4 text-slate-700">{b.bill_period_label}</td>
                        <td className="py-3 px-4 text-right text-slate-800 font-medium">{fmt(b.total_payable)}</td>
                        <td className="py-3 px-4 text-right text-emerald-700 font-semibold">{fmt(b.amount_paid)}</td>
                        <td className="py-3 px-4 text-right text-amber-700 font-bold text-sm">{fmt(b.balance_due)}</td>
                        <td className="py-3 px-4 text-rose-600 font-semibold">{b.due_date}</td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => sendWhatsAppReminder(b)}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Send WhatsApp Reminder"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => navigate(`/finance/students/${b.student_id}/ledger`)}
                              className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                              title="View Ledger"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => navigate(`/finance/payments/collect?student_id=${b.student_id}`)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                            >
                              Pay
                            </button>
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
    </div>
  );
}
