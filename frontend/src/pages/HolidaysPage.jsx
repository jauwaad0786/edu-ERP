import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar  from '../components/Navbar';
import api     from '../api/axios';
import toast   from 'react-hot-toast';

const TYPE_COLORS = {
  HOLIDAY:  { bg: '#fef1ee', color: '#ba0517' },
  FESTIVAL: { bg: '#fef5e4', color: '#dd7a01' },
  EXAM:     { bg: '#f3f0ff', color: '#5867e8' },
  EVENT:    { bg: '#eaf5ea', color: '#2e844a' },
  OTHER:    { bg: '#f1f1f1', color: '#747474' },
};
const TYPE_ICONS = {
  HOLIDAY: '🏖️', FESTIVAL: '🎉', EXAM: '📝', EVENT: '🎊', OTHER: '📌',
};

function HolidayBadge({ type }) {
  const s = TYPE_COLORS[type] || TYPE_COLORS.OTHER;
  return (
    <span style={{
      background: s.bg, color: s.color,
      padding: '3px 10px', borderRadius: 100,
      fontSize: 11, fontWeight: 700,
    }}>
      {TYPE_ICONS[type] || '📌'} {type}
    </span>
  );
}

export default function HolidaysPage() {
  const [holidays,    setHolidays]    = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [showModal,   setShowModal]   = useState(false);
  const [editItem,    setEditItem]    = useState(null);
  const [filterType,  setFilterType]  = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [msg,         setMsg]         = useState({ text: '', type: '' });
  const [saving,      setSaving]      = useState(false);

  const emptyForm = {
    title: '', date: '', end_date: '',
    holiday_type: 'HOLIDAY', applies_to: 'ALL', description: '',
  };
  const [form, setForm] = useState(emptyForm);

  function flash(text, type = 'success') {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 3500);
    if (type === 'success') toast.success(text.replace(/^✅\s*/, ''));
    else toast.error(text.replace(/^❌\s*/, ''));
  }

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/principal/holidays');
      setHolidays(res.data || []);
    } catch {
      flash('❌ Holidays load nahi hue', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditItem(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(h) {
    setEditItem(h);
    setForm({
      title:        h.title,
      date:         h.date,
      end_date:     h.end_date || '',
      holiday_type: h.holiday_type,
      applies_to:   h.applies_to,
      description:  h.description || '',
    });
    setShowModal(true);
  }

  async function saveHoliday(e) {
    e.preventDefault();
    if (!form.title || !form.date) {
      flash('❌ Title aur date zaroori hain', 'error'); return;
    }
    setSaving(true);
    try {
      if (editItem) {
        await api.put(`/principal/holidays/${editItem.id}`, form);
        flash('✅ Holiday update ho gayi');
      } else {
        await api.post('/principal/holidays', form);
        flash('✅ Holiday add ho gayi');
      }
      setShowModal(false);
      load();
    } catch (err) {
      flash(err.response?.data?.error || '❌ Save nahi hua', 'error');
    }
    setSaving(false);
  }

  async function deleteHoliday(id) {
    if (!window.confirm('Yeh holiday delete karein?')) return;
    try {
      await api.delete(`/principal/holidays/${id}`);
      flash('✅ Holiday delete ho gayi');
      load();
    } catch {
      flash('❌ Delete nahi hua', 'error');
    }
  }

  // Filter
  const filtered = holidays.filter(h => {
    const typeOk  = !filterType  || h.holiday_type === filterType;
    const monthOk = !filterMonth || h.date?.startsWith(filterMonth);
    return typeOk && monthOk;
  });

  // Group by month
  const grouped = filtered.reduce((acc, h) => {
    const key = h.date?.slice(0, 7) || 'Unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(h);
    return acc;
  }, {});

  const sortedMonths = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

  function monthLabel(ym) {
    if (!ym || ym === 'Unknown') return 'Unknown';
    const [y, m] = ym.split('-');
    return new Date(y, m - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  }

  // Stats
  const totalHolidays  = holidays.filter(h => h.holiday_type === 'HOLIDAY').length;
  const totalFestivals = holidays.filter(h => h.holiday_type === 'FESTIVAL').length;
  const totalEvents    = holidays.filter(h => h.holiday_type === 'EVENT').length;
  const upcoming = holidays.filter(h => h.date >= new Date().toISOString().split('T')[0]).length;

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Holidays" />
        <div className="page-body">

          {/* Header */}
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 className="page-title">Holiday Calendar</h2>
              <p className="page-subtitle">School holidays, festivals aur events manage karo</p>
            </div>
            <button className="btn btn-primary" onClick={openCreate}>
              + Add Holiday
            </button>
          </div>

          {/* Alert */}
          {msg.text && (
            <div style={{
              padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13,
              background: msg.type === 'error' ? '#fef1ee' : '#eaf5ea',
              color:      msg.type === 'error' ? '#ba0517' : '#2e844a',
              border: `1px solid ${msg.type === 'error' ? '#f9c9c0' : '#a3d9a5'}`,
            }}>{msg.text}</div>
          )}

          {/* Stat Cards */}
          <div className="grid-4 mb-6">
            {[
              { icon: '📅', label: 'Total Holidays', value: holidays.length, color: '#0176d3', bg: '#e8f4fd' },
              { icon: '🏖️', label: 'Holidays',       value: totalHolidays,   color: '#ba0517', bg: '#fef1ee' },
              { icon: '🎉', label: 'Festivals',       value: totalFestivals,  color: '#dd7a01', bg: '#fef5e4' },
              { icon: '🚀', label: 'Upcoming',        value: upcoming,        color: '#2e844a', bg: '#eaf5ea' },
            ].map(s => (
              <div className="stat-card" key={s.label}>
                <div className="stat-icon" style={{ background: s.bg }}>
                  <span style={{ fontSize: 20 }}>{s.icon}</span>
                </div>
                <div className="stat-label">{s.label}</div>
                <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="card mb-6">
            <div className="card-body" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', padding: '14px 20px' }}>
              <select className="form-select" style={{ width: 160 }}
                value={filterType} onChange={e => setFilterType(e.target.value)}>
                <option value="">All Types</option>
                {['HOLIDAY','FESTIVAL','EXAM','EVENT','OTHER'].map(t => (
                  <option key={t} value={t}>{TYPE_ICONS[t]} {t}</option>
                ))}
              </select>
              <input
                type="month" className="form-input" style={{ width: 180 }}
                value={filterMonth}
                onChange={e => setFilterMonth(e.target.value)}
              />
              {(filterType || filterMonth) && (
                <button className="btn btn-neutral btn-sm"
                  onClick={() => { setFilterType(''); setFilterMonth(''); }}>
                  ✕ Clear
                </button>
              )}
              <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--neutral-6)', alignSelf: 'center' }}>
                {filtered.length} records
              </span>
            </div>
          </div>

          {/* Timeline grouped by month */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--neutral-6)' }}>Loading...</div>
          ) : sortedMonths.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">📅</div>
                <p>Koi holiday nahi mili</p>
                <button className="btn btn-primary btn-sm" style={{ marginTop: 16 }} onClick={openCreate}>
                  + Pehli Holiday Add Karo
                </button>
              </div>
            </div>
          ) : (
            sortedMonths.map(ym => (
              <div key={ym} style={{ marginBottom: 24 }}>
                {/* Month label */}
                <div style={{
                  fontSize: 12, fontWeight: 700, color: 'var(--neutral-6)',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span>{monthLabel(ym)}</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--neutral-2)' }} />
                  <span style={{
                    background: 'var(--blue-10)', color: 'var(--blue-80)',
                    padding: '2px 8px', borderRadius: 20, fontSize: 11,
                  }}>{grouped[ym].length} holidays</span>
                </div>

                {/* Holiday cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {grouped[ym].sort((a, b) => a.date.localeCompare(b.date)).map(h => {
                    const isPast = h.date < new Date().toISOString().split('T')[0];
                    return (
                      <div key={h.id} style={{
                        background: '#fff',
                        border: '1px solid var(--neutral-2)',
                        borderLeft: `4px solid ${TYPE_COLORS[h.holiday_type]?.color || '#ccc'}`,
                        borderRadius: 8,
                        padding: '14px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16,
                        opacity: isPast ? 0.7 : 1,
                        transition: 'box-shadow 0.15s',
                      }}
                        onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'}
                        onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                      >
                        {/* Date box */}
                        <div style={{
                          minWidth: 52, textAlign: 'center',
                          background: TYPE_COLORS[h.holiday_type]?.bg || '#f1f1f1',
                          borderRadius: 8, padding: '8px 4px',
                        }}>
                          <div style={{
                            fontSize: 20, fontWeight: 800,
                            color: TYPE_COLORS[h.holiday_type]?.color || '#333',
                            lineHeight: 1,
                          }}>
                            {h.date?.split('-')[2]}
                          </div>
                          <div style={{
                            fontSize: 10, fontWeight: 600,
                            color: TYPE_COLORS[h.holiday_type]?.color || '#333',
                            textTransform: 'uppercase',
                          }}>
                            {new Date(h.date).toLocaleString('en-IN', { month: 'short' })}
                          </div>
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--neutral-9)' }}>
                              {h.title}
                            </span>
                            {isPast && (
                              <span style={{
                                fontSize: 10, background: '#f1f1f1', color: '#999',
                                padding: '1px 6px', borderRadius: 20, fontWeight: 600,
                              }}>Past</span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <HolidayBadge type={h.holiday_type} />
                            <span style={{
                              fontSize: 11, color: 'var(--neutral-6)',
                              background: 'var(--neutral-1)', padding: '2px 8px', borderRadius: 20,
                            }}>
                              👥 {h.applies_to}
                            </span>
                            {h.end_date && h.end_date !== h.date && (
                              <span style={{ fontSize: 11, color: 'var(--neutral-6)' }}>
                                📅 Till {h.end_date}
                              </span>
                            )}
                          </div>
                          {h.description && (
                            <div style={{ fontSize: 12, color: 'var(--neutral-6)', marginTop: 4 }}>
                              {h.description}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => openEdit(h)}
                            style={{
                              background: '#e8f4fd', color: '#0176d3',
                              border: 'none', borderRadius: 4,
                              padding: '5px 12px', fontSize: 11,
                              fontWeight: 700, cursor: 'pointer',
                            }}>
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => deleteHoliday(h.id)}
                            style={{
                              background: '#fef1ee', color: '#ba0517',
                              border: 'none', borderRadius: 4,
                              padding: '5px 12px', fontSize: 11,
                              fontWeight: 700, cursor: 'pointer',
                            }}>
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Modal ── */}
      {showModal && (
        <div className="modal-backdrop"
          onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3>{editItem ? '✏️ Edit Holiday' : '+ New Holiday'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={saveHoliday}>
              <div className="modal-body">

                <div className="form-group">
                  <label className="form-label">Title *</label>
                  <input className="form-input" required
                    placeholder="e.g. Diwali, Republic Day"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Start Date *</label>
                    <input type="date" className="form-input" required
                      value={form.date}
                      onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Date (optional)</label>
                    <input type="date" className="form-input"
                      value={form.end_date}
                      onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Type *</label>
                    <select className="form-select"
                      value={form.holiday_type}
                      onChange={e => setForm(f => ({ ...f, holiday_type: e.target.value }))}>
                      {['HOLIDAY','FESTIVAL','EXAM','EVENT','OTHER'].map(t => (
                        <option key={t} value={t}>{TYPE_ICONS[t]} {t}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Applies To</label>
                    <select className="form-select"
                      value={form.applies_to}
                      onChange={e => setForm(f => ({ ...f, applies_to: e.target.value }))}>
                      <option value="ALL">All (Students + Teachers)</option>
                      <option value="STUDENT">Students Only</option>
                      <option value="TEACHER">Teachers Only</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Description (optional)</label>
                  <textarea className="form-textarea" rows={2}
                    placeholder="Koi additional detail..."
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    style={{ width: '100%' }} />
                </div>

              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-neutral"
                  onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editItem ? '✅ Update' : '✅ Add Holiday'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
