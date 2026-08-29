import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';

export default function HostelAttendance() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  const [loading, setLoading]   = useState(true);
  const [hostels, setHostels]   = useState([]);
  const [selectedHostel, setSelectedHostel] = useState('');
  const [selectedDate, setSelectedDate]     = useState(new Date().toISOString().slice(0, 10));
  const [residents, setResidents] = useState([]);
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    api.get('/hostel/hostels').then((res) => {
      setHostels(res.data);
      if (res.data.length > 0) {
        setSelectedHostel(res.data[0].id);
      }
    });
  }, []);

  const fetchAttendance = async () => {
    if (!selectedHostel) return;
    try {
      setLoading(true);
      const res = await api.get('/hostel/attendance', {
        params: { hostel_id: selectedHostel, date: selectedDate }
      });
      setResidents(res.data);
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

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Night Roll Call &amp; Attendance" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div className="page-body">
          {/* Header */}
          <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
            <div>
              <h2 className="fw-bold mb-1" style={{ color: darkMode ? '#f8fafc' : '#1e293b' }}>Hostel Night Attendance</h2>
              <p className="text-muted mb-0">Record night roll call presence, track leaves, and out-pass status for all active residents.</p>
            </div>
            <button
              className="btn btn-primary d-flex align-items-center gap-2"
              onClick={handleSaveAttendance}
              disabled={saving || residents.length === 0}
              style={{ borderRadius: '10px', padding: '10px 20px', fontWeight: 600 }}
            >
              <i className="ti ti-device-floppy fs-5"></i>
              {saving ? 'Saving...' : 'Save Roll Call'}
            </button>
          </div>

          {/* Quick Metrics */}
          <div className="row g-3 mb-4">
            <div className="col-md-3">
              <div className="card border-0 shadow-sm p-3" style={{ borderRadius: '16px', background: darkMode ? '#1e293b' : '#ffffff' }}>
                <span className="text-muted small fw-semibold">TOTAL RESIDENTS</span>
                <h3 className="fw-bold mb-0 mt-1" style={{ color: '#6366f1' }}>{residents.length}</h3>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card border-0 shadow-sm p-3" style={{ borderRadius: '16px', background: darkMode ? '#1e293b' : '#ffffff' }}>
                <span className="text-muted small fw-semibold">PRESENT</span>
                <h3 className="fw-bold mb-0 mt-1 text-success">{presentCount}</h3>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card border-0 shadow-sm p-3" style={{ borderRadius: '16px', background: darkMode ? '#1e293b' : '#ffffff' }}>
                <span className="text-muted small fw-semibold">ABSENT</span>
                <h3 className="fw-bold mb-0 mt-1 text-danger">{absentCount}</h3>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card border-0 shadow-sm p-3" style={{ borderRadius: '16px', background: darkMode ? '#1e293b' : '#ffffff' }}>
                <span className="text-muted small fw-semibold">ON LEAVE / OUT-PASS</span>
                <h3 className="fw-bold mb-0 mt-1 text-warning">{leaveCount}</h3>
              </div>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="card border-0 shadow-sm p-3 mb-4" style={{ borderRadius: '16px', background: darkMode ? '#1e293b' : '#ffffff' }}>
            <div className="row g-3 align-items-center">
              <div className="col-md-4">
                <label className="form-label small fw-semibold text-muted mb-1">SELECT HOSTEL</label>
                <select
                  className="form-select"
                  value={selectedHostel}
                  onChange={(e) => setSelectedHostel(e.target.value)}
                >
                  {hostels.map((h) => (
                    <option key={h.id} value={h.id}>{h.name} ({h.gender})</option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label small fw-semibold text-muted mb-1">DATE</label>
                <input
                  type="date"
                  className="form-control"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>
              <div className="col-md-5 d-flex gap-2 align-items-end justify-content-md-end">
                <button className="btn btn-sm btn-outline-success px-3" onClick={() => markAll('PRESENT')}>
                  Mark All Present
                </button>
                <button className="btn btn-sm btn-outline-danger px-3" onClick={() => markAll('ABSENT')}>
                  Mark All Absent
                </button>
              </div>
            </div>
          </div>

          {/* Roll Call Table */}
          <div className="card border-0 shadow-sm" style={{ borderRadius: '16px', background: darkMode ? '#1e293b' : '#ffffff', overflow: 'hidden' }}>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead style={{ background: darkMode ? '#0f172a' : '#f8fafc', color: darkMode ? '#cbd5e1' : '#64748b' }}>
                  <tr>
                    <th className="py-3 px-4">Resident</th>
                    <th className="py-3">Room &amp; Bed</th>
                    <th className="py-3 text-center">Status</th>
                    <th className="py-3">Remarks / Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="4" className="text-center py-5 text-muted">
                        <div className="spinner-border spinner-border-sm me-2 text-primary" role="status"></div>
                        Loading residents...
                      </td>
                    </tr>
                  ) : residents.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="text-center py-5 text-muted">
                        No active residents found in this hostel.
                      </td>
                    </tr>
                  ) : (
                    residents.map((r, idx) => (
                      <tr key={r.student_id}>
                        <td className="px-4">
                          <div className="fw-bold" style={{ color: darkMode ? '#f8fafc' : '#0f172a' }}>{r.student_name}</div>
                          <small className="text-muted">{r.admission_no}</small>
                        </td>
                        <td>
                          <span className="badge bg-light text-dark border px-2 py-1">
                            Room {r.room_number} &bull; Bed {r.bed_number}
                          </span>
                        </td>
                        <td className="text-center">
                          <div className="btn-group btn-group-sm" role="group">
                            <button
                              type="button"
                              className={`btn ${r.status === 'PRESENT' ? 'btn-success fw-bold' : 'btn-outline-secondary'}`}
                              onClick={() => setStatusForResident(idx, 'PRESENT')}
                            >
                              Present
                            </button>
                            <button
                              type="button"
                              className={`btn ${r.status === 'ABSENT' ? 'btn-danger fw-bold' : 'btn-outline-secondary'}`}
                              onClick={() => setStatusForResident(idx, 'ABSENT')}
                            >
                              Absent
                            </button>
                            <button
                              type="button"
                              className={`btn ${r.status === 'ON_LEAVE' ? 'btn-warning fw-bold' : 'btn-outline-secondary'}`}
                              onClick={() => setStatusForResident(idx, 'ON_LEAVE')}
                            >
                              Leave
                            </button>
                            <button
                              type="button"
                              className={`btn ${r.status === 'OUT_PASS' ? 'btn-info fw-bold' : 'btn-outline-secondary'}`}
                              onClick={() => setStatusForResident(idx, 'OUT_PASS')}
                            >
                              Out-Pass
                            </button>
                          </div>
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="Optional note..."
                            value={r.remarks || ''}
                            onChange={(e) => setRemarksForResident(idx, e.target.value)}
                            style={{ maxWidth: '280px' }}
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
