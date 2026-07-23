import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar  from '../components/Navbar';
import api from '../api/axios';
import toast from 'react-hot-toast';

const STAFF_ROLE_KEYS = [
  'LIBRARIAN', 'ACCOUNTANT', 'RECEPTIONIST', 'HOSTEL', 'TRANSPORT', 'HR', 'VICE_PRINCIPAL',
];
const STAFF_ROLE_LABELS = {
  LIBRARIAN: 'Librarian', ACCOUNTANT: 'Accountant', RECEPTIONIST: 'Receptionist',
  HOSTEL: 'Hostel Staff', TRANSPORT: 'Transport Staff', HR: 'HR', VICE_PRINCIPAL: 'Vice Principal',
};

function StatCard({ icon, label, value, sub, color, darkMode }) {
  return (
    <div className="stat-card" style={{ background: darkMode ? '#141b2d' : undefined, borderColor: darkMode ? '#1e293b' : undefined }}>
      <div className="stat-icon" style={{ background: color + '16' }}>
        <i className={`ti ${icon}`} style={{ fontSize: 18, color }} aria-hidden="true" />
      </div>
      <div className="stat-label" style={{ color: darkMode ? '#94a3b8' : undefined }}>{label}</div>
      <div className="stat-value" style={{ color }}>{value ?? '—'}</div>
      {sub && <div className="stat-sub" style={{ color: darkMode ? '#64748b' : undefined }}>{sub}</div>}
    </div>
  );
}

const monthList = () => {
  const out = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < 12; i++) {
    out.push(d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
    d.setMonth(d.getMonth() - 1);
  }
  return out;
};

const EMPTY_FORM = {
  person_key: '', month: monthList()[0], amount: '', status: 'PAID',
  payment_date: new Date().toISOString().slice(0, 10), note: '',
};

export default function PayrollPage() {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  useEffect(() => { localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light'); }, [darkMode]);

  const [teachers, setTeachers] = useState([]);
  const [staff,    setStaff]    = useState([]);
  const [records,  setRecords]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [monthFilter, setMonthFilter] = useState('');
  const [typeFilter,  setTypeFilter]  = useState('');

  const [form, setForm]     = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const months = monthList();
  const cardBg = { background: darkMode ? '#141b2d' : undefined, borderColor: darkMode ? '#1e293b' : undefined };
  const fmt = n => Number(n || 0).toLocaleString('en-IN');

  useEffect(() => {
    api.get('/principal/teachers').then(r => setTeachers(r.data || [])).catch(() => {});
    // staff-list is NOT gated behind the role_based_access feature (unlike
    // /principal/users), so Payroll works even on plans without RBAC —
    // only 'payroll_system' is required.
    api.get('/principal/staff-list')
      .then(r => setStaff((r.data || []).filter(u => STAFF_ROLE_KEYS.includes(u.role) && u.is_active !== false)))
      .catch(() => {});
  }, []);

  const loadRecords = () => {
    setLoading(true);
    const params = {};
    if (monthFilter) params.month = monthFilter;
    api.get('/principal/payroll/records', { params })
      .then(r => setRecords(r.data || []))
      .catch(err => {
        setRecords([]);
        if (err?.response?.status === 403) {
          toast.error('Payroll history dekhne ki permission nahi hai');
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(loadRecords, [monthFilter]);

  // Combined dropdown options: "teacher-12" or "staff-7"
  const options = useMemo(() => ([
    ...teachers.map(t => ({
      key: `teacher-${t.id}`, id: t.id, type: 'TEACHER',
      label: `${t.name} ${t.employee_id ? `(${t.employee_id})` : ''} — Teacher`,
      salary: t.salary,
    })),
    ...staff.map(u => ({
      key: `staff-${u.id}`, id: u.id, type: 'STAFF',
      label: `${u.name} — ${STAFF_ROLE_LABELS[u.role] || u.role}`,
      salary: u.salary,
    })),
  ]), [teachers, staff]);

  const selected = options.find(o => o.key === form.person_key);

  const onSelectPerson = (key) => {
    const opt = options.find(o => o.key === key);
    setForm(f => ({ ...f, person_key: key, amount: opt?.salary ? String(opt.salary) : f.amount }));
  };

  const submit = async () => {
    if (!selected) { toast.error('Teacher ya Staff select karo'); return; }
    if (!form.amount || Number(form.amount) <= 0) { toast.error('Amount sahi bharo'); return; }

    setSaving(true);
    try {
      const url = selected.type === 'TEACHER'
        ? `/principal/teachers/${selected.id}/salary/record`
        : `/principal/users/${selected.id}/salary/record`;

      await api.post(url, {
        month: form.month,
        amount: parseFloat(form.amount),
        status: form.status,
        payment_date: form.payment_date,
        note: form.note,
      });
      toast.success('Salary payment record ho gaya!');
      setForm(f => ({ ...EMPTY_FORM, month: f.month }));
      loadRecords();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Payment record nahi hua');
    }
    setSaving(false);
  };

  const filteredRecords = useMemo(() => {
    if (!typeFilter) return records;
    return records.filter(r => r.type === typeFilter);
  }, [records, typeFilter]);

  const totals = useMemo(() => {
    const thisMonthRecs = records.filter(r => r.month === (monthFilter || months[0]));
    const paid = thisMonthRecs.filter(r => r.status === 'PAID').reduce((s, r) => s + r.amount, 0);
    const pending = thisMonthRecs.filter(r => r.status !== 'PAID').reduce((s, r) => s + r.amount, 0);
    return { paid, pending, count: thisMonthRecs.length };
  }, [records, monthFilter, months]);

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Payroll" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />
        <div className="page-body">

          <div className="page-header flex justify-between items-center">
            <div>
              <h2 className="page-title">Payroll</h2>
              <p className="page-subtitle">Teacher ya Staff select karke salary payment record karo</p>
            </div>
            <button className="btn btn-neutral btn-sm" onClick={() => navigate('/finance/expenses')}>
              View in Expenses
            </button>
          </div>

          <div className="grid-4 mb-6">
            <StatCard icon="ti-users" label="Teachers + Staff" value={teachers.length + staff.length}
              sub={`${teachers.length} teachers · ${staff.length} staff`} color="#4f46e5" darkMode={darkMode} />
            <StatCard icon="ti-checkbox" label="Paid (selected month)" value={`₹${fmt(totals.paid)}`}
              sub={monthFilter || months[0]} color="#16a34a" darkMode={darkMode} />
            <StatCard icon="ti-clock" label="Pending" value={`₹${fmt(totals.pending)}`}
              sub="Not yet paid" color="#d97706" darkMode={darkMode} />
            <StatCard icon="ti-receipt" label="Records" value={totals.count}
              sub="This month" color="#0891b2" darkMode={darkMode} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 20, alignItems: 'start' }}>

            {/* ── Record Payment Form ── */}
            <div className="card" style={{ margin: 0, ...cardBg }}>
              <div className="card-header">
                <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <i className="ti ti-cash-banknote" style={{ color: '#16a34a', fontSize: 17 }} aria-hidden="true" /> Record Payment
                </h4>
              </div>
              <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label className="form-label">Teacher / Staff *</label>
                  <select className="form-select" value={form.person_key} onChange={e => onSelectPerson(e.target.value)}>
                    <option value="">Select person</option>
                    <optgroup label="Teachers">
                      {options.filter(o => o.type === 'TEACHER').map(o => (
                        <option key={o.key} value={o.key}>{o.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Staff">
                      {options.filter(o => o.type === 'STAFF').map(o => (
                        <option key={o.key} value={o.key}>{o.label}</option>
                      ))}
                    </optgroup>
                  </select>
                  {selected && (
                    <div style={{ fontSize: 11, color: darkMode ? '#64748b' : '#94a3b8', marginTop: 4 }}>
                      {selected.salary ? `Base salary: ₹${fmt(selected.salary)} / month` : 'Base salary set nahi hai — amount manually daalo'}
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="form-label">Month</label>
                    <select className="form-select" value={form.month} onChange={e => setForm(f => ({ ...f, month: e.target.value }))}>
                      {months.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Amount (₹) *</label>
                    <input className="form-input" type="number" value={form.amount}
                      onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="form-label">Payment Date</label>
                    <input className="form-input" type="date" value={form.payment_date}
                      onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} />
                  </div>
                  <div>
                    <label className="form-label">Status</label>
                    <select className="form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                      <option value="PAID">Paid</option>
                      <option value="PENDING">Pending</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="form-label">Note (optional)</label>
                  <input className="form-input" placeholder="e.g. Full month salary" value={form.note}
                    onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
                </div>

                <button className="btn btn-primary btn-sm" disabled={saving} onClick={submit} style={{ marginTop: 6 }}>
                  {saving ? 'Recording...' : 'Record Payment'}
                </button>
                <div style={{ fontSize: 11, color: darkMode ? '#64748b' : '#94a3b8' }}>
                  Payment record hote hi ek linked Expense entry bhi auto-ban jaayegi (Finance → Expenses mein dikhegi).
                </div>
              </div>
            </div>

            {/* ── Recent Records ── */}
            <div className="card" style={{ margin: 0, ...cardBg }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <i className="ti ti-list-details" style={{ color: '#4f46e5', fontSize: 17 }} aria-hidden="true" /> Payment History
                </h4>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <select className="form-select" style={{ width: 110, fontSize: 12 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                    <option value="">All Types</option>
                    <option value="TEACHER">Teachers</option>
                    <option value="STAFF">Staff</option>
                  </select>
                  <select className="form-select" style={{ width: 170, fontSize: 12 }} value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
                    <option value="">All Months</option>
                    {months.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Person</th><th>Type</th><th>Month</th><th>Amount</th><th>Status</th><th>Received?</th><th>Date</th><th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--neutral-4)' }}>Loading...</td></tr>
                    ) : filteredRecords.length === 0 ? (
                      <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--neutral-4)' }}>Koi payment record nahi</td></tr>
                    ) : filteredRecords.map(r => (
                      <tr key={`${r.type}-${r.id}`}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{r.person_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--neutral-5)' }}>
                            {r.type === 'TEACHER' ? (r.employee_id || '—') : (r.role_label || '—')}
                          </div>
                        </td>
                        <td>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                            background: r.type === 'TEACHER' ? '#eff6ff' : '#f5f3ff',
                            color:      r.type === 'TEACHER' ? '#0176d3' : '#7c3aed',
                          }}>{r.type === 'TEACHER' ? 'Teacher' : 'Staff'}</span>
                        </td>
                        <td style={{ fontSize: 12 }}>{r.month}</td>
                        <td style={{ fontWeight: 700, fontSize: 13, color: '#16a34a' }}>₹{fmt(r.amount)}</td>
                        <td>
                          <span style={{
                            padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                            background: r.status === 'PAID' ? '#dcfce7' : '#fef3c7',
                            color:      r.status === 'PAID' ? '#16a34a' : '#d97706',
                          }}>{r.status}</span>
                        </td>
                        <td>
                          {r.is_acknowledged ? (
                            <span title={r.acknowledged_at ? new Date(r.acknowledged_at).toLocaleString('en-IN') : ''}
                              style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <i className="ti ti-circle-check" aria-hidden="true" /> Confirmed
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--neutral-5)' }}>Awaiting</span>
                          )}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--neutral-6)' }}>{r.payment_date || '—'}</td>
                        <td style={{ fontSize: 12, color: 'var(--neutral-6)' }}>{r.note || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .theme-dark { background: #0b1220; }
        .theme-dark .main-content { background: #0b1220; }
        .theme-dark .card, .theme-dark .stat-card { background: #141b2d !important; border-color: #1e293b !important; }
        .theme-dark .card-header { border-color: #1e293b !important; }
        .theme-dark h2, .theme-dark h3, .theme-dark h4, .theme-dark .page-title, .theme-dark .stat-value { color: #f1f5f9 !important; }
        .theme-dark .page-subtitle, .theme-dark .stat-label, .theme-dark .stat-sub { color: #94a3b8 !important; }
        .theme-dark .table-container, .theme-dark table { background: #141b2d !important; }
        .theme-dark th { background: #1c2436 !important; color: #94a3b8 !important; border-color: #1e293b !important; }
        .theme-dark td { border-color: #1e293b !important; color: #cbd5e1 !important; }
        .theme-dark .btn-neutral { background: #1e293b !important; color: #cbd5e1 !important; border-color: #334155 !important; }
        .theme-dark .form-select, .theme-dark .form-input { background: #0f172a !important; color: #e2e8f0 !important; border-color: #334155 !important; }
        .theme-dark .form-label { color: #94a3b8 !important; }
      `}</style>
    </div>
  );
}
