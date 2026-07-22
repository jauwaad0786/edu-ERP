import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';

// NEW — Payroll "acknowledgement" feature. Principal payroll payment
// record karta hai, is-agar us payment ko is-agar staff/teacher khud
// "Yes, maine paisa receive kiya" confirm kar sake — bina kisi dashboard
// par nirbhar hue (Teacher/Accountant/Hostel Warden/etc. sab alag-alag
// pages par land karte hain), isliye ye bell Navbar mein hai jo har
// authenticated page par dikhta hai.
export default function SalaryAckBell({ darkMode }) {
  const [records, setRecords] = useState([]);
  const [open, setOpen]       = useState(false);
  const [busyId, setBusyId]   = useState(null);
  const [loaded, setLoaded]   = useState(false);

  const load = useCallback(() => {
    api.get('/auth/me/salary-records')
      .then(r => setRecords((r.data || []).filter(rec => rec.status === 'PAID' && !rec.is_acknowledged)))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => { load(); }, [load]);

  const acknowledge = async (rec) => {
    setBusyId(rec.id);
    try {
      await api.post(`/auth/me/salary-records/${rec.type.toLowerCase()}/${rec.id}/acknowledge`);
      load();
    } catch {
      // silent — bell just won't clear this one, user can retry
    }
    setBusyId(null);
  };

  if (!loaded || records.length === 0) return null;

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        title="Salary payments awaiting your confirmation"
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'relative', width: 36, height: 36, borderRadius: 9,
          border: open ? '1.5px solid #4f46e5' : `1px solid ${darkMode ? '#1e293b' : '#e8edf3'}`,
          background: darkMode ? '#141b2d' : '#fff', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <i className="ti ti-cash-banknote" style={{ fontSize: 17, color: '#16a34a' }} aria-hidden="true" />
        <span style={{
          position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, padding: '0 4px',
          borderRadius: 20, background: '#ef4444', color: '#fff', fontSize: 9, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
          border: `2px solid ${darkMode ? '#0b1220' : '#fff'}`,
        }}>{records.length}</span>
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div style={{
            position: 'absolute', top: 42, right: 0, width: 320, zIndex: 41,
            background: darkMode ? '#141b2d' : '#fff',
            border: `1px solid ${darkMode ? '#1e293b' : '#e8edf3'}`,
            borderRadius: 12, boxShadow: '0 12px 32px rgba(0,0,0,0.18)', overflow: 'hidden',
          }}>
            <div style={{
              padding: '12px 16px', fontWeight: 700, fontSize: 13,
              borderBottom: `1px solid ${darkMode ? '#1e293b' : '#e8edf3'}`,
              color: darkMode ? '#f1f5f9' : '#0f172a',
            }}>
              Confirm salary received
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {records.map(rec => (
                <div key={`${rec.type}-${rec.id}`} style={{
                  padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6,
                  borderBottom: `1px solid ${darkMode ? '#1e293b' : '#f1f5f9'}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: darkMode ? '#e2e8f0' : '#0f172a' }}>
                      {rec.month}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>
                      ₹{Number(rec.amount || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: darkMode ? '#64748b' : '#94a3b8' }}>
                    Paid {rec.payment_date || ''}{rec.note ? ` — ${rec.note}` : ''}
                  </div>
                  <button
                    disabled={busyId === rec.id}
                    onClick={() => acknowledge(rec)}
                    style={{
                      marginTop: 2, padding: '7px 0', borderRadius: 7, border: 'none',
                      background: '#16a34a', color: '#fff', fontSize: 12, fontWeight: 700,
                      cursor: 'pointer', opacity: busyId === rec.id ? 0.6 : 1,
                    }}
                  >
                    {busyId === rec.id ? 'Confirming...' : '✅ Yes, I received this'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
