import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import {
  DollarSign, TrendingUp, AlertCircle, FileText, CheckCircle2,
  Calendar, Layers, Download, Plus, ArrowUpRight, ArrowDownRight,
  CreditCard, RefreshCw, ChevronRight, PieChart as PieIcon, Users
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  Legend, PieChart, Pie, Cell, LineChart, Line
} from 'recharts';

const SESSIONS = ['2026-27', '2025-26', '2024-25'];
const COLORS = ['#2563EB', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#64748B'];

export default function FinanceDashboard() {
  const navigate = useNavigate();
  const [session, setSession] = useState('2026-27');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/fees-finance/dashboard?session=${session}`);
      setData(res.data);
    } catch (err) {
      toast.error('Failed to load finance dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [session]);

  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-y-auto">
        <Navbar />

        <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
          {/* Header Banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 p-6 rounded-2xl text-white shadow-xl">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-blue-500/20 text-blue-300 text-xs font-semibold rounded-full border border-blue-400/30">
                  School Finance & Fee Management
                </span>
                <span className="text-xs text-slate-400">● Live Central Ledger</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Finance Command Center</h1>
              <p className="text-slate-300 text-sm">
                Single source of truth for fee billing, collections, multi-department allocation, and surplus tracking.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Session Selector */}
              <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/20">
                <Calendar className="w-4 h-4 text-blue-300" />
                <span className="text-xs font-medium text-slate-300">Session:</span>
                <select
                  value={session}
                  onChange={(e) => setSession(e.target.value)}
                  className="bg-transparent text-white font-semibold text-sm outline-none cursor-pointer"
                >
                  {SESSIONS.map((s) => (
                    <option key={s} value={s} className="bg-slate-800 text-white">
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => navigate('/finance/payments/collect')}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-md shadow-emerald-500/30 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Collect Fee
              </button>
            </div>
          </div>

          {/* Quick Nav Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {[
              { label: 'Fee Bills', path: '/finance/bills', icon: FileText, color: 'text-blue-600 bg-blue-50' },
              { label: 'Collect Payment', path: '/finance/payments/collect', icon: CreditCard, color: 'text-emerald-600 bg-emerald-50' },
              { label: 'Receipts', path: '/finance/receipts', icon: CheckCircle2, color: 'text-indigo-600 bg-indigo-50' },
              { label: 'Outstanding', path: '/finance/outstanding', icon: AlertCircle, color: 'text-amber-600 bg-amber-50' },
              { label: 'Expenses', path: '/finance/expenses', icon: ArrowDownRight, color: 'text-rose-600 bg-rose-50' },
              { label: 'Fee Setup', path: '/finance/setup', icon: Layers, color: 'text-purple-600 bg-purple-50' },
            ].map((btn, i) => {
              const Icon = btn.icon;
              return (
                <button
                  key={i}
                  onClick={() => navigate(btn.path)}
                  className="flex items-center gap-2.5 p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-left shadow-sm transition-all hover:shadow hover:border-slate-300 group"
                >
                  <div className={`p-2 rounded-lg ${btn.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold text-slate-700 group-hover:text-slate-900">{btn.label}</span>
                </button>
              );
            })}
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Total Billed */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold tracking-wide uppercase">Total Billed</span>
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-900">{fmt(data?.total_billed)}</div>
              <p className="text-xs text-slate-500">Total fees invoiced in {session}</p>
            </div>

            {/* Total Collected */}
            <div className="bg-white p-5 rounded-2xl border border-emerald-200/80 shadow-sm space-y-2 bg-gradient-to-br from-white to-emerald-50/30">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold tracking-wide uppercase text-emerald-800">Total Collected</span>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-emerald-700">{fmt(data?.total_collected)}</div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
                <span>{data?.collection_percentage || 0}%</span>
                <span className="text-slate-400 font-normal">collection rate</span>
              </div>
            </div>

            {/* Outstanding */}
            <div className="bg-white p-5 rounded-2xl border border-amber-200/80 shadow-sm space-y-2 bg-gradient-to-br from-white to-amber-50/30">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold tracking-wide uppercase text-amber-800">Outstanding</span>
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                  <AlertCircle className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-amber-700">{fmt(data?.outstanding)}</div>
              <p className="text-xs text-slate-500">Pending student balance</p>
            </div>

            {/* Expenses */}
            <div className="bg-white p-5 rounded-2xl border border-rose-200/80 shadow-sm space-y-2 bg-gradient-to-br from-white to-rose-50/30">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold tracking-wide uppercase text-rose-800">Expenses</span>
                <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                  <ArrowDownRight className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-rose-700">{fmt(data?.total_expenses)}</div>
              <p className="text-xs text-slate-500">Salaries, fuel, ops & maintenance</p>
            </div>

            {/* Net Surplus */}
            <div className="bg-white p-5 rounded-2xl border border-indigo-200/80 shadow-sm space-y-2 bg-gradient-to-br from-white to-indigo-50/40">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold tracking-wide uppercase text-indigo-800">Net Surplus</span>
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className={`text-2xl font-bold ${(data?.net_surplus || 0) >= 0 ? 'text-indigo-900' : 'text-rose-600'}`}>
                {fmt(data?.net_surplus)}
              </div>
              <p className="text-xs text-slate-500">Total Collected − Total Expenses</p>
            </div>
          </div>

          {/* Service-wise Breakdown & Daily Collection */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Service-wise Income */}
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Income by Service / Department</h2>
                  <p className="text-xs text-slate-500">Central revenue contribution from Academic, Transport, Hostel, and Library</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg">
                  {data?.service_wise?.length || 0} Services
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {data?.service_wise?.map((srv, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-slate-100 bg-slate-50/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">{srv.name}</span>
                      <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded">
                        {srv.department}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Collected:</span>
                        <span className="font-semibold text-emerald-700">{fmt(srv.collected)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Billed:</span>
                        <span className="text-slate-700">{fmt(srv.billed)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Pending:</span>
                        <span className="font-semibold text-amber-700">{fmt(srv.outstanding)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Today's Counter Collection */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Today's Counter Collection</h2>
                  <p className="text-xs text-slate-500">Daily reconciliation by mode & cashier</p>
                </div>
                <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>

              <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 text-center space-y-1">
                <span className="text-xs font-semibold text-emerald-800 uppercase">Today's Total</span>
                <div className="text-2xl font-black text-emerald-700">{fmt(data?.today_collection?.total_amount)}</div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">By Payment Mode</span>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(data?.today_collection?.by_mode || {}).map(([m, amt]) => (
                    <div key={m} className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 flex justify-between items-center text-xs">
                      <span className="text-slate-600 font-medium">{m}</span>
                      <span className="font-bold text-slate-800">{fmt(amt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Month-by-Month Performance Table */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Month-Wise Financial Performance ({session})</h2>
                <p className="text-xs text-slate-500">Monthly billing, collections, operational expenses, and net monthly surplus</p>
              </div>
              <button
                onClick={() => navigate('/finance/reports')}
                className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                <span>View Full Reports</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 uppercase bg-slate-50/50">
                    <th className="py-3 px-4">Fee Month</th>
                    <th className="py-3 px-4 text-right">Total Billed</th>
                    <th className="py-3 px-4 text-right">Collected</th>
                    <th className="py-3 px-4 text-right">Outstanding</th>
                    <th className="py-3 px-4 text-right">Expenses</th>
                    <th className="py-3 px-4 text-right">Net Surplus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data?.monthly_summary?.map((m, i) => (
                    <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-800">{m.month_label}</td>
                      <td className="py-3 px-4 text-right text-slate-700">{fmt(m.billed)}</td>
                      <td className="py-3 px-4 text-right font-semibold text-emerald-700">{fmt(m.collected)}</td>
                      <td className="py-3 px-4 text-right font-medium text-amber-700">{fmt(m.outstanding)}</td>
                      <td className="py-3 px-4 text-right text-rose-700">{fmt(m.expenses)}</td>
                      <td className={`py-3 px-4 text-right font-bold ${m.net_surplus >= 0 ? 'text-indigo-900' : 'text-rose-600'}`}>
                        {fmt(m.net_surplus)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
