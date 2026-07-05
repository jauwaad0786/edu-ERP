import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';

export default function LibraryReservations() {
  const { user } = useAuth();
  const isStudent = user?.role === 'STUDENT';
  const [darkMode, setDarkMode] = useState(localStorage.getItem('ederp_theme') === 'dark');

  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('WAITING');

  // ── New reservation form (Librarian/Principal use) ──
  const [bookSearch, setBookSearch]     = useState('');
  const [bookResults, setBookResults]   = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberResults, setMemberResults] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/library/reservations?status=' + statusFilter)
      .then(r => setReservations(r.data || []))
      .catch(() => toast.error('Reservations load nahi ho payi'))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  // Book search (only for staff creating on behalf of someone)
  useEffect(() => {
    if (isStudent || !bookSearch.trim()) { setBookResults([]); return; }
    const t = setTimeout(() => {
      api.get('/library/books?search=' + encodeURIComponent(bookSearch) + '&per_page=8')
        .then(r => setBookResults(r.data.data || []))
        .catch(() => setBookResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [bookSearch, isStudent]);

  useEffect(() => {
    if (isStudent || !memberSearch.trim()) { setMemberResults([]); return; }
    const t = setTimeout(() => {
      api.get('/library/members?search=' + encodeURIComponent(memberSearch))
        .then(r => setMemberResults(r.data || []))
        .catch(() => setMemberResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [memberSearch, isStudent]);

  async function handleCreateReservation() {
    if (!selectedBook || !selectedMember) {
      toast.error('Book aur Member dono select karo');
      return;
    }
    setCreating(true);
    try {
      await api.post('/library/reservations', {
        book_id: selectedBook.id,
        member_id: selectedMember.id,
      });
      toast.success('Reservation created');
      setSelectedBook(null);
      setSelectedMember(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Reservation nahi ho payi');
    }
    setCreating(false);
  }

  async function handleCancel(id) {
    try {
      await api.post(`/library/reservations/${id}/cancel`);
      toast.success('Reservation cancelled');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Cancel nahi ho paya');
    }
  }

  const cardStyle = {
    background: darkMode ? '#1e293b' : '#fff',
    border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
    borderRadius: 12, padding: 18,
  };
  const inputStyle = {
    width: '100%', padding: '9px 12px', fontSize: 13,
    border: '1px solid #e2e8f0', borderRadius: 8, outline: 'none', boxSizing: 'border-box',
  };

  const STATUS_COLORS = {
    WAITING:   { bg: '#fef3c7', color: '#d97706' },
    NOTIFIED:  { bg: '#eff6ff', color: '#0176d3' },
    FULFILLED: { bg: '#f0fdf4', color: '#16a34a' },
    CANCELLED: { bg: '#f1f5f9', color: '#64748b' },
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: darkMode ? '#0f172a' : '#f8fafc' }}>
      <Sidebar darkMode={darkMode} />
      <div style={{ marginLeft: 232, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Navbar title="Reservations" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div style={{ padding: 24, maxWidth: 1000 }}>

          {/* ── Create Reservation (staff only) ── */}
          {!isStudent && (
            <div style={{ ...cardStyle, marginBottom: 20 }}>
              <h4 style={{ margin: '0 0 14px', fontSize: 14, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                + New Reservation
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'start' }}>

                <div style={{ position: 'relative' }}>
                  {selectedBook ? (
                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}>
                      <strong>{selectedBook.title}</strong>
                      <button onClick={() => setSelectedBook(null)} style={{
                        float: 'right', background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 11,
                      }}>✕</button>
                    </div>
                  ) : (
                    <>
                      <input value={bookSearch} onChange={e => setBookSearch(e.target.value)}
                        placeholder="Search book title..." style={inputStyle} />
                      {bookResults.length > 0 && (
                        <div style={{
                          position: 'absolute', top: 40, left: 0, right: 0, zIndex: 10,
                          background: darkMode ? '#1e293b' : '#fff', border: '1px solid #e2e8f0',
                          borderRadius: 8, maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        }}>
                          {bookResults.map(b => (
                            <div key={b.id} onClick={() => { setSelectedBook(b); setBookSearch(''); setBookResults([]); }}
                              style={{ padding: '8px 10px', cursor: 'pointer', fontSize: 13 }}
                              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                              {b.title} <span style={{ color: '#94a3b8', fontSize: 11 }}>({b.available_copies} avail)</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div style={{ position: 'relative' }}>
                  {selectedMember ? (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}>
                      <strong>{selectedMember.name}</strong>
                      <button onClick={() => setSelectedMember(null)} style={{
                        float: 'right', background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 11,
                      }}>✕</button>
                    </div>
                  ) : (
                    <>
                      <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
                        placeholder="Search member..." style={inputStyle} />
                      {memberResults.length > 0 && (
                        <div style={{
                          position: 'absolute', top: 40, left: 0, right: 0, zIndex: 10,
                          background: darkMode ? '#1e293b' : '#fff', border: '1px solid #e2e8f0',
                          borderRadius: 8, maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        }}>
                          {memberResults.map(m => (
                            <div key={m.id} onClick={() => { setSelectedMember(m); setMemberSearch(''); setMemberResults([]); }}
                              style={{ padding: '8px 10px', cursor: 'pointer', fontSize: 13 }}
                              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                              {m.name} <span style={{ color: '#94a3b8', fontSize: 11 }}>({m.card_number})</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <button onClick={handleCreateReservation} disabled={creating} style={{
                  background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8,
                  padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                }}>
                  {creating ? 'Creating...' : 'Reserve'}
                </button>
              </div>
            </div>
          )}

          {/* ── Filter + List ── */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h4 style={{ margin: 0, fontSize: 14, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                Reservation Queue
              </h4>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                style={{ padding: '7px 10px', fontSize: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <option value="WAITING">Waiting</option>
                <option value="NOTIFIED">Notified</option>
                <option value="FULFILLED">Fulfilled</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading...</div>
            ) : reservations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Koi reservation nahi hai</div>
            ) : (
              reservations.map(r => (
                <div key={r.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 0', borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{
                      width: 24, height: 24, borderRadius: '50%', background: '#f3f0ff', color: '#7c3aed',
                      fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {r.queue_position}
                    </span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                        {r.book_title}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>
                        {r.member_name} · Reserved {new Date(r.reserved_at).toLocaleDateString('en-IN')}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                      background: STATUS_COLORS[r.status]?.bg, color: STATUS_COLORS[r.status]?.color,
                    }}>
                      {r.status}
                    </span>
                    {r.status === 'WAITING' && (
                      <button onClick={() => handleCancel(r.id)} style={{
                        background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 6,
                        padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      }}>
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
