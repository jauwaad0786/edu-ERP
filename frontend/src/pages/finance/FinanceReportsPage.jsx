import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import {
  FileSpreadsheet, Download, Calendar, Layers, TrendingUp,
  CreditCard, CheckCircle2, DollarSign, Printer
} from 'lucide-react';

export default function FinanceReportsPage() {
  const [session, setSession] = useState('2026-27');
  const [reportType, setReportType] = useState('DAILY'); // DAILY | SERVICE | MONTHLY
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/fees-finance/dashboard?session=${session}`);
      setData(res.data);
    } catch (err) {
      toast.error('Failed to load finance reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [session]);

  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

  const exportCSV = () => {
    if (!data) return;
    let csv = '';
    if (reportType === 'MONTHLY') {
      csv = 'Month,Total Billed,Total Collected,Outstanding,Expenses,Net Surplus\n';
      data.monthly_summary?.forEach((m) => {
        csv += `"${m.month_label}",${m.billed},${m.collected},${m.outstanding},${m.expenses},${m.net_surplus}\n`;
      });
    } else if (reportType === 'SERVICE') {
      csv = 'Service Name,Department,Billed,Collected,Outstanding\n';
      data.service_wise?.forEach((s) => {
        csv += `"${s.name}","${s.department}",${s.billed},${s.collected},${s.outstanding}\n`;
      });
    } else {
      csv = 'Payment Mode,Amount Collected\n';
      Object.entries(data.today_collection?.by_mode || {}).forEach(([m, amt]) => {
        csv += `"${m}",${amt}\n`;
      });
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Finance_Report_${reportType}_${session}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success('CSV Exported!');
  };

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
                  Financial Analytics
                </span>
                <span className="text-xs text-slate-500">Audit & Ledger Statements</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mt-1">Finance & Collection Reports</h1>
              <p className="text-xs text-slate-500">
                Generate daily cashier reconciliation, service revenue distributions, and executive P&L statements.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={exportCSV}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Export CSV
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                <Printer className="w-4 h-4" />
                Print Statement
              </button>
            </div>
          </div>

          {/* Report Type Selectors */}
          <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
            {[
              { id: 'DAILY', label: 'Daily Collection & Reconciliation', icon: CreditCard },
              { id: 'SERVICE', label: 'Service / Department Revenue', icon: Layers },
              { id: 'MONTHLY', label: 'Month-Wise Financial Performance', icon: Calendar },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = reportType === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setReportType(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    active
                      ? 'bg-slate-900 text-white shadow-md'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Report Display Area */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
            {reportType === 'DAILY' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Today's Counter Collection Breakdown</h3>
                    <p className="text-xs text-slate-500">Date: {data?.today_collection?.date}</p>
                  </div>
                  <div className="text-lg font-black text-emerald-700">
                    Total: {fmt(data?.today_collection?.total_amount)}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Mode Breakdown */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-700 uppercase">Payment Mode Breakdown</span>
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl text-xs">
                      {Object.entries(data?.today_collection?.by_mode || {}).map(([mode, amt]) => (
                        <div key={mode} className="p-3 flex justify-between">
                          <span className="font-semibold text-slate-700">{mode}</span>
                          <span className="font-bold text-slate-900">{fmt(amt)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Cashier Reconciliation */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-700 uppercase">Cashier Collection Summary</span>
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl text-xs">
                      {data?.today_collection?.by_collector?.map((c, i) => (
                        <div key={i} className="p-3 flex justify-between">
                          <span className="font-semibold text-slate-700">{c.collector}</span>
                          <span className="font-bold text-emerald-700">{fmt(c.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {reportType === 'SERVICE' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Service & Department Revenue Breakdown</h3>
                    <p className="text-xs text-slate-500">Academic Session: {session}</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 uppercase bg-slate-50/50">
                        <th className="py-3 px-4">Service Name</th>
                        <th className="py-3 px-4">Department</th>
                        <th className="py-3 px-4 text-right">Total Billed</th>
                        <th className="py-3 px-4 text-right">Collected</th>
                        <th className="py-3 px-4 text-right">Outstanding</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {data?.service_wise?.map((s, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-bold text-slate-900">{s.name}</td>
                          <td className="py-3 px-4 uppercase text-slate-600 font-semibold">{s.department}</td>
                          <td className="py-3 px-4 text-right text-slate-800">{fmt(s.billed)}</td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-700">{fmt(s.collected)}</td>
                          <td className="py-3 px-4 text-right font-bold text-amber-700">{fmt(s.outstanding)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {reportType === 'MONTHLY' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Monthly Income, Expenses & Net Surplus ({session})</h3>
                    <p className="text-xs text-slate-500">April {session.split('-')[0]} to March {parseInt(session.split('-')[0]) + 1}</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 uppercase bg-slate-50/50">
                        <th className="py-3 px-4">Calendar Month</th>
                        <th className="py-3 px-4 text-right">Invoiced / Billed</th>
                        <th className="py-3 px-4 text-right">Collected</th>
                        <th className="py-3 px-4 text-right">Outstanding</th>
                        <th className="py-3 px-4 text-right">Expenses</th>
                        <th className="py-3 px-4 text-right">Net Surplus</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {data?.monthly_summary?.map((m, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-bold text-slate-900">{m.month_label}</td>
                          <td className="py-3 px-4 text-right text-slate-700">{fmt(m.billed)}</td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-700">{fmt(m.collected)}</td>
                          <td className="py-3 px-4 text-right font-semibold text-amber-700">{fmt(m.outstanding)}</td>
                          <td className="py-3 px-4 text-right text-rose-700">{fmt(m.expenses)}</td>
                          <td className={`py-3 px-4 text-right font-black ${m.net_surplus >= 0 ? 'text-indigo-900' : 'text-rose-600'}`}>
                            {fmt(m.net_surplus)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
