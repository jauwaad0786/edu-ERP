import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';

export default function HostelAttendance() {
  const [darkMode, setDarkMode] = useState(localStorage.getItem('ederp_theme') === 'dark');
  const [loading, setLoading]   = useState(true);
  const [hostels, setHostels]   = useState([]);
  const [selectedHostel, setSelectedHostel] = useState('');
  const [selectedDate, setSelectedDate]     = useState(new Date().toISOString().slice(0, 10));
  const [residents, setResidents] = useState([]);
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    api.get('/hostel/hostels').then((res) => {
      setHostels(res.data || []);
      if (res.data && res.data.length > 0) {
        setSelectedHostel(res.data[0].id);
      }
    }).catch(() => {});
  }, []);

  const fetchAttendance = async () => {
    if (!selectedHostel) return;
    try {
      setLoading(true);
      const res = await api.get('/hostel/attendance', {
        params: { hostel_id: selectedHostel, date: selectedDate }
      });
      setResidents(res.data || []);
    } catch (err) {
      toast.error('Failed to load roll call records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [selectedHostel, selectedDate]);

  const setStatusForResident = (index, status) => {
    const next = [...residents];
    next[index].status = status;
    setResidents(next);
  };

  const setRemarksForResident = (index, remarks) => {
    const next = [...residents];
    next[index].remarks = remarks;
    setResidents(next);
  };

  const markAll = (status) => {
    setResidents(residents.map((r) => ({ ...r, status })));
  };

  const handleSaveAttendance = async () => {
    try {
      setSaving(true);
      await api.post('/hostel/attendance', {
        hostel_id: selectedHostel,
        date: selectedDate,
        entries: residents.map((r) => ({
          student_id: r.student_id,
          allocation_id: r.allocation_id,
          status: r.status,
          remarks: r.remarks,
        })),
      });
      toast.success('Night roll call attendance saved successfully!');
      fetchAttendance();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const presentCount = residents.filter((r) => r.status === 'PRESENT').length;
  const absentCount  = residents.filter((r) => r.status === 'ABSENT').length;
  const leaveCount   = residents.filter((r) => r.status === 'ON_LEAVE' || r.status === 'OUT_PASS').length;

  const cardStyle = {
    background: darkMode ? '#1e293b' : '#fff',
    border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
    borderRadius: 12, padding: 20,
  };
  const inputStyle = {
    width: '100%', padding: '9px 12px', fontSize: 13,
    border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`, borderRadius: 8, outline: 'none', boxSizing: 'border-box',
    background: darkMode ? '#0f172a' : '#ffffff', color: darkMode ? '#ffffff' : '#0f172a',
    marginBottom: 0,
  };
  const labelStyle = { fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4, display: 'block' };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: darkMode ? '#0f172a' : '#f8fafc' }}>
      <Sidebar darkMode={darkMode} />
      <div style={{ marginLeft: 232, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Navbar title="Night Roll Call &amp; Attendance" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div style={{ padding: '24px 28px' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: darkMode ? '#f8fafc' : '#0f172a' }}>
                Hostel Night Roll Call &amp; Attendance
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                Conduct night curfew roll calls, mark present / absent / leaves, and track out-pass residents.
              </p>
            </div>
            <button
              onClick={handleSaveAttendance}
              disabled={saving || residents.length === 0}
              style={{
                background: '#10b981', color: '#fff', border: 'none', borderRadius: 8,
                padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: saving || residents.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
              }}
            >
              <i className="ti ti-device-floppy" style={{ fontSize: 16 }}></i>
              {saving ? 'Saving...' : 'Save Roll Call'}
            </button>
          </div>

          {/* Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
            <div style={cardStyle}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>TOTAL RESIDENTS</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#4f46e5', marginTop: 4 }}>{residents.length}</div>
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>PRESENT</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#16a34a', marginTop: 4 }}>{presentCount}</div>
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>ABSENT</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#dc2626', marginTop: 4 }}>{absentCount}</div>
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>ON LEAVE / OUT-PASS</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#d97706', marginTop: 4 }}>{leaveCount}</div>
            </div>
          </div>

          {/* Controls Bar */}
          <div style={{ ...cardStyle, padding: 14, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ ...labelStyle, marginBottom: 0, fontSize: 12 }}>HOSTEL:</label>
                <select
                  style={{ ...inputStyle, width: 'auto', minWidth: 200 }}
                  value={selectedHostel}
                  onChange={(e) => setSelectedHostel(e.target.value)}
                >
                  {hostels.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ ...labelStyle, marginBottom: 0, fontSize: 12 }}>DATE:</label>
                <input
                  type="date"
                  style={{ ...inputStyle, width: 'auto' }}
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => markAll('PRESENT')}
                style={{
                  background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0',
                  padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer'
                }}
              >
                Mark All Present
              </button>
              <button
                onClick={() => markAll('ABSENT')}
                style={{
                  background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
                  padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer'
                }}
              >
                Mark All Absent
              </button>
            </div>
          </div>

          {/* Roll Call Table Card */}
          <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: darkMode ? '#0f172a' : '#f8fafc', borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>RESIDENT</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>ROOM &amp; BED</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11, textAlign: 'center' }}>ROLL CALL STATUS</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>WARDEN REMARKS</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                        Loading residents...
                      </td>
                    </tr>
                  ) : residents.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '50px 0', color: '#94a3b8' }}>
                        No active residents found in this hostel.
                      </td>
                    </tr>
                  ) : (
                    residents.map((r, idx) => (
                      <tr key={r.student_id} style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}` }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 700, color: darkMode ? '#f8fafc' : '#0f172a' }}>{r.student_name}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>{r.admission_no}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            background: darkMode ? '#334155' : '#f1f5f9', color: darkMode ? '#cbd5e1' : '#475569',
                            padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600
                          }}>
                            Room {r.room_number} &bull; Bed {r.bed_number}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', borderRadius: 6, overflow: 'hidden', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
                            {[
                              { label: 'Present', val: 'PRESENT', bg: '#16a34a' },
                              { label: 'Absent', val: 'ABSENT', bg: '#dc2626' },
                              { label: 'Leave', val: 'ON_LEAVE', bg: '#d97706' },
                              { label: 'Out-Pass', val: 'OUT_PASS', bg: '#2563eb' },
                            ].map((btn) => (
                              <button
                                key={btn.val}
                                type="button"
                                onClick={() => setStatusForResident(idx, btn.val)}
                                style={{
                                  padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                  border: 'none',
                                  background: r.status === btn.val ? btn.bg : (darkMode ? '#1e293b' : '#fff'),
                                  color: r.status === btn.val ? '#fff' : (darkMode ? '#94a3b8' : '#64748b'),
                                  borderRight: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`
                                }}
                              >
                                {btn.label}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <input
                            type="text"
                            placeholder="Optional note / reason..."
                            value={r.remarks || ''}
                            onChange={(e) => setRemarksForResident(idx, e.target.value)}
                            style={{ ...inputStyle, maxWidth: 280, padding: '6px 10px', fontSize: 12 }}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
