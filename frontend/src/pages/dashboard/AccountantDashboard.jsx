// frontend/src/pages/dashboard/AccountantDashboard.jsx
// Accountant — Finance Operations Center

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { resolveTenantPath } from '../../utils/routeBuilder';
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

const C = {
  bg:      '#f0f4f8',
  surface: '#ffffff',
  border:  '#e2e8f0',
  primary: '#0176d3',
  green:   '#16a34a',
  warning: '#d97706',
  error:   '#dc2626',
  purple:  '#7c3aed',
  text:    '#1e293b',
  muted:   '#64748b',
  light:   '#f8fafc',
};

const fmt = (n) => n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '₹—';
const fmtK = (n) => {
  if (n == null) return '₹—';
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n}`;
};

function KPI({ icon, label, value, sub, color = C.primary, onClick, badge }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`,
        boxShadow: hover && onClick ? '0 6px 20px rgba(0,0,0,0.1)' : '0 1px 4px rgba(0,0,0,0.06)',
        padding: '18px 20px', cursor: onClick ? 'pointer' : 'default',
        transform: hover && onClick ? 'translateY(-2px)' : 'none',
        transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: 14,
      }}
    >
      <div style={{
        width: 50, height: 50, borderRadius: 12,
        background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <i className={`ti ${icon}`} style={{ fontSize: 22, color }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: C.muted, fontWeight: 500, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{value ?? '—'}</div>
        {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{sub}</div>}
      </div>
      {badge && (
        <span style={{
          padding: '3px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700,
          background: `${badge.color}20`, color: badge.color, flexShrink: 0,
        }}>{badge.text}</span>
      )}
    </div>
  );
}

function Card({ title, icon, action, children, extra = {} }) {
  return (
    <div style={{
      background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: '20px 22px', ...extra,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className={`ti ${icon}`} style={{ fontSize: 15, color: C.primary }} />
          <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{title}</span>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function QA({ icon, label, color, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        flex: 1, minWidth: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        padding: '14px 10px',
        background: hover ? `${color}15` : `${color}08`,
        border: `1px solid ${hover ? color + '60' : color + '25'}`,
        borderRadius: 12, cursor: 'pointer', transition: 'all 0.18s',
      }}
    >
      <i className={`ti ${icon}`} style={{ fontSize: 20, color }} />
      <span style={{ fontSize: 11, fontWeight: 600, color: C.text, textAlign: 'center', lineHeight: 1.3 }}>{label}</span>
    </button>
  );
}

const PIE_COLORS = ['#0176d3', '#16a34a', '#d97706', '#dc2626', '#7c3aed'];

export default function AccountantDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  useEffect(() => { localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light'); }, [darkMode]);

  const goTo = useCallback((path) => navigate(resolveTenantPath(path, user)), [navigate, user]);

  const [profitSummary, setProfitSummary] = useState(null);
  const [trendData,     setTrendData]     = useState([]);
  const [feesSummary,   setFeesSummary]   = useState(null);
  const [recentFees,    setRecentFees]    = useState([]);
  const [loading,       setLoading]       = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const month = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    Promise.all([
      api.get('/finance/profit-summary', { params: { month } }).catch(() => ({ data: null })),
      api.get('/finance/monthly-trend', { params: { months: 6 } }).catch(() => ({ data: [] })),
      api.get('/principal/fees/summary').catch(() => ({ data: null })),
      api.get('/principal/fees/recent-collections').catch(() => ({ data: [] })),
    ]).then(([profit, trend, fSum, rFees]) => {
      setProfitSummary(profit.data);
      setTrendData(trend.data || []);
      setFeesSummary(fSum.data);
      setRecentFees(Array.isArray(rFees.data) ? rFees.data : []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const collectRate = feesSummary
    ? Math.round(((feesSummary.collected || 0) / (feesSummary.total_demand || 1)) * 100)
    : null;

  const pieData = feesSummary ? [
    { name: 'Collected', value: feesSummary.collected || 0 },
    { name: 'Outstanding', value: feesSummary.outstanding || 0 },
  ] : [];

  const todayStr = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Finance Operations Center" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />
        <div className="page-body" style={{ background: C.bg, padding: '20px 24px', minHeight: '100vh' }}>

          {/* ── Hero ── */}
          <div style={{
            borderRadius: 18, padding: '26px 32px', marginBottom: 24,
            background: 'linear-gradient(135deg, #064e3b 0%, #065f46 40%, #047857 80%, #059669 100%)',
            color: '#fff', position: 'relative', overflow: 'hidden',
            boxShadow: '0 8px 30px rgba(5,150,105,0.35)',
          }}>
            <div style={{ position: 'absolute', top: -50, right: -30, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', opacity: 0.75, marginBottom: 6 }}>
                  {todayStr.toUpperCase()} · FINANCE OPERATIONS
                </div>
                <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>
                  Financial Command Center
                </h1>
                <p style={{ margin: '8px 0 0', opacity: 0.8, fontSize: 14 }}>
                  {feesSummary ? `Total demand: ${fmtK(feesSummary.total_demand)} · Collected: ${fmtK(feesSummary.collected)}` : 'Loading financial summary…'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => goTo('/finance/payments/collect')} style={{
                  padding: '10px 20px', borderRadius: 10, border: 'none',
                  background: '#fff', color: '#047857', fontWeight: 700, cursor: 'pointer', fontSize: 13,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <i className="ti ti-credit-card" /> Collect Payment
                </button>
                <button onClick={() => goTo('/finance/outstanding')} style={{
                  padding: '10px 20px', borderRadius: 10, border: '1.5px solid rgba(255,255,255,0.5)',
                  background: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13,
                  display: 'flex', alignItems: 'center', gap: 6, backdropFilter: 'blur(4px)',
                }}>
                  <i className="ti ti-alert-circle" /> Outstanding
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: C.muted }}>
              <i className="ti ti-loader-2" style={{ fontSize: 32, animation: 'spin 1s linear infinite' }} />
              <p style={{ marginTop: 12 }}>Loading financial data…</p>
            </div>
          ) : (
            <>
              {/* ── KPIs ── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
                <KPI icon="ti-currency-rupee" label="Total Fee Demand" value={fmtK(feesSummary?.total_demand)}
                     color={C.primary} onClick={() => goTo('/finance/bills')} />
                <KPI icon="ti-receipt" label="Total Collected" value={fmtK(feesSummary?.collected)}
                     color={C.green} onClick={() => goTo('/finance/payment-logs')} />
                <KPI icon="ti-alert-circle" label="Outstanding Dues" value={fmtK(feesSummary?.outstanding)}
                     color={feesSummary?.outstanding > 0 ? C.warning : C.green}
                     badge={feesSummary?.outstanding > 0 ? { text: 'PENDING', color: C.warning } : { text: 'CLEAR', color: C.green }}
                     onClick={() => goTo('/finance/outstanding')} />
                <KPI icon="ti-chart-pie" label="Collection Rate" value={collectRate != null ? `${collectRate}%` : '—'}
                     color={collectRate >= 80 ? C.green : C.warning}
                     badge={collectRate != null ? { text: collectRate >= 80 ? 'HEALTHY' : 'LOW', color: collectRate >= 80 ? C.green : C.warning } : null} />
                <KPI icon="ti-trending-up" label="This Month Income" value={fmtK(profitSummary?.total_income)}
                     color={C.purple} onClick={() => goTo('/finance/reports')} />
                <KPI icon="ti-trending-down" label="This Month Expense" value={fmtK(profitSummary?.total_expense)}
                     color={C.error} onClick={() => goTo('/finance/expenses')} />
              </div>

              {/* ── Row 2: Trend + Pie + Quick Actions ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 20 }}>

                <Card title="6-Month Fee Collection Trend" icon="ti-chart-line"
                  action={
                    <button onClick={() => goTo('/finance/collection-analytics')} style={{
                      fontSize: 12, color: C.primary, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600,
                    }}>Full Analytics →</button>
                  }
                >
                  {trendData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={trendData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: C.muted }} />
                        <YAxis tick={{ fontSize: 10, fill: C.muted }} tickFormatter={v => fmtK(v)} />
                        <Tooltip
                          formatter={(v, name) => [fmtK(v), name === 'collected' ? 'Collected' : 'Outstanding']}
                          contentStyle={{ fontSize: 12, borderRadius: 8 }}
                        />
                        <Bar dataKey="collected" fill={C.green} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="outstanding" fill="#fee2e2" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ textAlign: 'center', padding: 40, color: C.muted, fontSize: 13 }}>
                      <i className="ti ti-chart-bar" style={{ fontSize: 28, opacity: 0.4 }} />
                      <p>No trend data available yet</p>
                    </div>
                  )}
                </Card>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Collection Pie */}
                  <Card title="Collection Breakdown" icon="ti-chart-pie">
                    {pieData.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <ResponsiveContainer width="100%" height={130}>
                          <PieChart>
                            <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value">
                              {pieData.map((_, i) => (
                                <Cell key={i} fill={PIE_COLORS[i]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(v) => fmtK(v)} contentStyle={{ fontSize: 11, borderRadius: 7 }} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                          {pieData.map((item, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.muted }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: PIE_COLORS[i], flexShrink: 0 }} />
                              {item.name}: <strong style={{ color: C.text }}>{fmtK(item.value)}</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: 20, color: C.muted, fontSize: 12 }}>
                        No data available
                      </div>
                    )}
                  </Card>

                  {/* Quick Actions */}
                  <Card title="Quick Actions" icon="ti-bolt">
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <QA icon="ti-credit-card"      label="Collect"     color={C.green}   onClick={() => goTo('/finance/payments/collect')} />
                      <QA icon="ti-file-invoice"     label="Bills"       color={C.primary} onClick={() => goTo('/finance/bills')} />
                      <QA icon="ti-alert-circle"     label="Pending"     color={C.warning} onClick={() => goTo('/finance/outstanding')} />
                      <QA icon="ti-receipt"          label="Receipts"    color={C.purple}  onClick={() => goTo('/finance/receipts')} />
                      <QA icon="ti-report-analytics" label="Reports"     color={C.error}   onClick={() => goTo('/finance/reports')} />
                      <QA icon="ti-settings"         label="Fee Setup"   color={C.muted}   onClick={() => goTo('/finance/setup')} />
                    </div>
                  </Card>
                </div>
              </div>

              {/* ── Recent Fee Collections ── */}
              <Card title={`Recent Fee Collections (${recentFees.length})`} icon="ti-receipt"
                action={
                  <button onClick={() => goTo('/finance/payment-logs')} style={{
                    fontSize: 12, color: C.primary, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600,
                  }}>View All →</button>
                }
              >
                {recentFees.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 0', color: C.muted, fontSize: 13 }}>
                    <i className="ti ti-receipt" style={{ fontSize: 28, opacity: 0.4 }} />
                    <p style={{ marginTop: 8 }}>No recent collections</p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                          {['Student', 'Class', 'Amount', 'Mode', 'Date', 'Receipt'].map(h => (
                            <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.muted, whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {recentFees.slice(0, 8).map((r, i) => (
                          <tr key={i} style={{
                            borderBottom: `1px solid ${C.border}`,
                            background: i % 2 === 0 ? C.surface : C.light,
                          }}>
                            <td style={{ padding: '9px 10px', fontWeight: 600, color: C.text }}>{r.student_name || '—'}</td>
                            <td style={{ padding: '9px 10px', color: C.muted }}>{r.class_name || '—'}</td>
                            <td style={{ padding: '9px 10px', fontWeight: 700, color: C.green }}>{fmt(r.amount)}</td>
                            <td style={{ padding: '9px 10px' }}>
                              <span style={{
                                padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700,
                                background: `${C.primary}15`, color: C.primary,
                              }}>{r.payment_mode || r.mode || '—'}</span>
                            </td>
                            <td style={{ padding: '9px 10px', color: C.muted, whiteSpace: 'nowrap' }}>
                              {r.payment_date || r.created_at ? new Date(r.payment_date || r.created_at).toLocaleDateString('en-IN') : '—'}
                            </td>
                            <td style={{ padding: '9px 10px', color: C.muted, fontSize: 11 }}>{r.receipt_no || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
