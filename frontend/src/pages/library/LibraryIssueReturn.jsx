import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';

export default function LibraryIssueReturn() {
  const [darkMode, setDarkMode] = useState(localStorage.getItem('ederp_theme') === 'dark');
  const [tab, setTab] = useState('ISSUE'); // 'ISSUE' | 'RETURN'

  // ── Issue State ──
  const [memberSearch, setMemberSearch]   = useState('');
  const [memberResults, setMemberResults] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);

  const [bookSearch, setBookSearch]       = useState('');
  const [bookResults, setBookResults]     = useState([]);
  const [selectedBook, setSelectedBook]   = useState(null);

  const [issuing, setIssuing]             = useState(false);

  // ── Return State ──
  const [returnSearch, setReturnSearch]   = useState('');
  const [selectedIssueToReturn, setSelectedIssueToReturn] = useState(null);
  const [markLost, setMarkLost]           = useState(false);
  const [markDamaged, setMarkDamaged]     = useState(false);
  const [collectNow, setCollectNow]       = useState(false);
  const [returning, setReturning]         = useState(false);

  // ── Settings ──
  const [librarySettings, setLibrarySettings] = useState(null);
  useEffect(() => {
    api.get('/library/settings').then(r => setLibrarySettings(r.data)).catch(() => {});
  }, []);

  function previewDueDate() {
    const days = librarySettings?.issue_duration_days || 14;
    const d = new Date();
    d.setDate(d.getDate() + days);
    return { days, dateStr: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) };
  }

  // ── Currently Issued List ──
  const [currentlyIssued, setCurrentlyIssued] = useState([]);
  const [loadingIssued, setLoadingIssued] = useState(true);

  const loadCurrentlyIssued = useCallback(() => {
    setLoadingIssued(true);
    api.get('/library/issues?status=ISSUED&per_page=100')
      .then(r => setCurrentlyIssued(r.data?.data || []))
      .catch(() => setCurrentlyIssued([]))
      .finally(() => setLoadingIssued(false));
  }, []);

  useEffect(() => { loadCurrentlyIssued(); }, [loadCurrentlyIssued]);

  // ── Search Member (Debounced) ──
  useEffect(() => {
    if (!memberSearch.trim()) { setMemberResults([]); return; }
    const t = setTimeout(() => {
      api.get('/library/members?search=' + encodeURIComponent(memberSearch.trim()))
        .then(r => setMemberResults(r.data || []))
        .catch(() => setMemberResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [memberSearch]);

  // ── Search Book by Title/Author/Subject (Debounced) ──
  useEffect(() => {
    if (!bookSearch.trim()) { setBookResults([]); return; }
    const t = setTimeout(() => {
      api.get('/library/books?search=' + encodeURIComponent(bookSearch.trim()) + '&per_page=10')
        .then(r => setBookResults(r.data.data || []))
        .catch(() => setBookResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [bookSearch]);

  // ── Handle Issue ──
  async function handleIssue() {
    if (!selectedMember) { toast.error('Pehle Student / Member select karo'); return; }
    if (!selectedBook) { toast.error('Pehle Book select karo'); return; }

    setIssuing(true);
    try {
      const { data } = await api.post('/library/issue', {
        member_id: selectedMember.id,
        book_id: selectedBook.id,
      });
      toast.success(`Book Issue Successful: "${data.book_title}" → ${data.member_name} (Due ${data.due_date})`);
      setSelectedBook(null);
      setBookSearch('');
      setSelectedMember(null);
      setMemberSearch('');
      loadCurrentlyIssued();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Issue nahi ho paya');
    }
    setIssuing(false);
  }

  // ── Handle Return ──
  async function handleConfirmReturn() {
    if (!selectedIssueToReturn) return;
    setReturning(true);
    try {
      const { data } = await api.post('/library/return', {
        issue_id: selectedIssueToReturn.id,
        mark_lost: markLost,
        mark_damaged: markDamaged,
        collect_fine_now: collectNow,
      });

      if (data.fine) {
        toast.success(`Book Returned! Fine Generated: ₹${data.fine.amount} (${data.fine.status})`);
      } else {
        toast.success(`"${selectedIssueToReturn.book_title}" successfully returned!`);
      }

      setSelectedIssueToReturn(null);
      setMarkLost(false);
      setMarkDamaged(false);
      setCollectNow(false);
      loadCurrentlyIssued();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Return nahi ho paya');
    }
    setReturning(false);
  }

  // ── Filtered Issues for Return Tab ──
  const filteredIssues = currentlyIssued.filter(i => {
    if (!returnSearch.trim()) return true;
    const q = returnSearch.toLowerCase();
    return (
      (i.member_name || '').toLowerCase().includes(q) ||
      (i.book_title || '').toLowerCase().includes(q) ||
      (i.class_name || '').toLowerCase().includes(q) ||
      (i.roll_number || '').toLowerCase().includes(q) ||
      (i.card_number || '').toLowerCase().includes(q)
    );
  });

  const cardStyle = {
    background: darkMode ? '#111827' : '#ffffff',
    border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
    borderRadius: '16px',
    padding: '24px',
    boxShadow: darkMode ? '0 10px 25px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.05)',
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    fontSize: '14px',
    background: darkMode ? '#1e293b' : '#f8fafc',
    border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`,
    borderRadius: '10px',
    color: darkMode ? '#ffffff' : '#0f172a',
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Library Issue & Return Counter" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div className="page-body" style={{ padding: '24px', maxWidth: '1200px' }}>

          {/* ══ Counter Header Banner ══ */}
          <div style={{
            background: darkMode
              ? 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #0f172a 100%)'
              : 'linear-gradient(135deg, #4338ca 0%, #4f46e5 50%, #6366f1 100%)',
            borderRadius: '20px', padding: '24px 30px', marginBottom: '24px', color: '#ffffff',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px'
          }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.18)', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>
                📖 Circulation Desk
              </div>
              <h2 style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: 800 }}>
                Smart Book Issue &amp; Return
              </h2>
              <p style={{ margin: 0, fontSize: '13.5px', color: 'rgba(255,255,255,0.85)' }}>
                Issue and return library books by student name or book title with zero scanner dependency.
              </p>
            </div>

            {/* Quick Mode Toggle */}
            <div style={{ display: 'flex', gap: '10px', background: 'rgba(0,0,0,0.25)', padding: '6px', borderRadius: '14px' }}>
              <button
                onClick={() => setTab('ISSUE')}
                style={{
                  padding: '10px 22px', fontSize: '14px', fontWeight: 800, borderRadius: '10px', border: 'none', cursor: 'pointer',
                  background: tab === 'ISSUE' ? '#ffffff' : 'transparent',
                  color: tab === 'ISSUE' ? '#4338ca' : '#e0e7ff',
                  transition: 'all 0.2s', boxShadow: tab === 'ISSUE' ? '0 4px 12px rgba(0,0,0,0.15)' : 'none'
                }}
              >
                📤 Issue Book (किताब दें)
              </button>
              <button
                onClick={() => setTab('RETURN')}
                style={{
                  padding: '10px 22px', fontSize: '14px', fontWeight: 800, borderRadius: '10px', border: 'none', cursor: 'pointer',
                  background: tab === 'RETURN' ? '#ffffff' : 'transparent',
                  color: tab === 'RETURN' ? '#047857' : '#e0e7ff',
                  transition: 'all 0.2s', boxShadow: tab === 'RETURN' ? '0 4px 12px rgba(0,0,0,0.15)' : 'none'
                }}
              >
                📥 Return Book (किताब वापस लें)
              </button>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════════
              TAB 1: ISSUE BOOK (BY NAME & BOOK TITLE)
             ══════════════════════════════════════════════════════════════════════ */}
          {tab === 'ISSUE' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
              
              {/* Step 1: Member Search */}
              <div style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(99,102,241,0.15)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '15px' }}>
                    1
                  </div>
                  <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: darkMode ? '#ffffff' : '#0f172a' }}>
                    Student / Member Select Karein
                  </h4>
                </div>

                {selectedMember ? (
                  <div style={{
                    background: darkMode ? 'rgba(16,185,129,0.12)' : '#f0fdf4',
                    border: '1.5px solid #10b981', borderRadius: '12px', padding: '16px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: darkMode ? '#34d399' : '#15803d' }}>
                        👤 {selectedMember.name}
                      </div>
                      <div style={{ fontSize: '12.5px', color: darkMode ? '#94a3b8' : '#475569', marginTop: '4px' }}>
                        Card: <strong>{selectedMember.card_number}</strong> · Type: <strong>{selectedMember.member_type}</strong>
                      </div>
                      <div style={{ fontSize: '12px', color: '#6366f1', fontWeight: 600, marginTop: '2px' }}>
                        Currently Issued: {selectedMember.current_issues || 0} books
                      </div>
                    </div>
                    <button
                      onClick={() => { setSelectedMember(null); setMemberSearch(''); }}
                      style={{
                        background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px',
                        padding: '6px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer'
                      }}
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      value={memberSearch}
                      onChange={e => setMemberSearch(e.target.value)}
                      placeholder="Type Student / Teacher Name or Card #..."
                      style={inputStyle}
                      autoFocus
                    />

                    {memberResults.length > 0 && (
                      <div style={{
                        marginTop: '8px', maxHeight: '220px', overflowY: 'auto',
                        background: darkMode ? '#1e293b' : '#ffffff',
                        border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                        borderRadius: '10px', boxShadow: '0 8px 20px rgba(0,0,0,0.15)'
                      }}>
                        {memberResults.map(m => (
                          <div
                            key={m.id}
                            onClick={() => { setSelectedMember(m); setMemberResults([]); }}
                            style={{
                              padding: '10px 14px', cursor: 'pointer', fontSize: '13px',
                              borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}`,
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#334155' : '#f1f5f9'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <div>
                              <strong style={{ color: darkMode ? '#f1f5f9' : '#0f172a' }}>{m.name}</strong>
                              <span style={{ fontSize: '11.5px', color: '#94a3b8', marginLeft: '8px' }}>({m.member_type})</span>
                            </div>
                            <span style={{ fontSize: '11px', color: '#6366f1', fontFamily: 'monospace', fontWeight: 700 }}>
                              {m.card_number}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Step 2: Book Search */}
              <div style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(99,102,241,0.15)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '15px' }}>
                    2
                  </div>
                  <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: darkMode ? '#ffffff' : '#0f172a' }}>
                    Book Title / Name Search Karein
                  </h4>
                </div>

                {selectedBook ? (
                  <div style={{
                    background: darkMode ? 'rgba(59,130,246,0.12)' : '#eff6ff',
                    border: '1.5px solid #3b82f6', borderRadius: '12px', padding: '16px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: darkMode ? '#60a5fa' : '#1d4ed8' }}>
                        📚 {selectedBook.title}
                      </div>
                      <div style={{ fontSize: '12.5px', color: darkMode ? '#94a3b8' : '#475569', marginTop: '4px' }}>
                        Author: <strong>{selectedBook.author || 'N/A'}</strong> · Subject: <strong>{selectedBook.subject || 'General'}</strong>
                      </div>
                      <div style={{ fontSize: '12px', color: selectedBook.available_copies > 0 ? '#10b981' : '#ef4444', fontWeight: 700, marginTop: '2px' }}>
                        {selectedBook.available_copies > 0 ? `✅ ${selectedBook.available_copies} Copies Available` : '❌ No Copy Available'}
                      </div>
                    </div>
                    <button
                      onClick={() => { setSelectedBook(null); setBookSearch(''); }}
                      style={{
                        background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px',
                        padding: '6px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer'
                      }}
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      value={bookSearch}
                      onChange={e => setBookSearch(e.target.value)}
                      placeholder="Type Book Title (e.g. Physics, RD Sharma, Wings of Fire)..."
                      style={inputStyle}
                    />

                    {bookResults.length > 0 && (
                      <div style={{
                        marginTop: '8px', maxHeight: '220px', overflowY: 'auto',
                        background: darkMode ? '#1e293b' : '#ffffff',
                        border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                        borderRadius: '10px', boxShadow: '0 8px 20px rgba(0,0,0,0.15)'
                      }}>
                        {bookResults.map(b => {
                          const isAvail = b.available_copies > 0;
                          return (
                            <div
                              key={b.id}
                              onClick={() => {
                                if (!isAvail) { toast.error('Ye book currently out of stock hai'); return; }
                                setSelectedBook(b);
                                setBookResults([]);
                              }}
                              style={{
                                padding: '10px 14px', cursor: isAvail ? 'pointer' : 'not-allowed', fontSize: '13px',
                                borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}`,
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                opacity: isAvail ? 1 : 0.5
                              }}
                              onMouseEnter={e => isAvail && (e.currentTarget.style.background = darkMode ? '#334155' : '#f1f5f9')}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <div>
                                <strong style={{ color: darkMode ? '#f1f5f9' : '#0f172a' }}>{b.title}</strong>
                                <span style={{ fontSize: '11.5px', color: '#94a3b8', marginLeft: '8px' }}>by {b.author}</span>
                              </div>
                              <span style={{
                                fontSize: '11px', fontWeight: 800, padding: '3px 8px', borderRadius: '12px',
                                background: isAvail ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                                color: isAvail ? '#10b981' : '#ef4444'
                              }}>
                                {isAvail ? `${b.available_copies} Available` : '0 Available'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Step 3: Confirm Issue Bar */}
              <div style={{ ...cardStyle, gridColumn: 'span 2', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: darkMode ? '#1e293b' : '#f8fafc' }}>
                <div style={{ fontSize: '13.5px', color: darkMode ? '#94a3b8' : '#475569' }}>
                  📅 Issue Duration: <strong style={{ color: darkMode ? '#fff' : '#0f172a' }}>{previewDueDate().days} Days</strong> · Return Due Date: <strong style={{ color: '#ef4444' }}>{previewDueDate().dateStr}</strong>
                </div>
                <button
                  onClick={handleIssue}
                  disabled={issuing || !selectedMember || !selectedBook}
                  style={{
                    background: (!selectedMember || !selectedBook) ? (darkMode ? '#334155' : '#cbd5e1') : '#4f46e5',
                    color: '#ffffff', border: 'none', borderRadius: '12px',
                    padding: '12px 32px', fontSize: '14.5px', fontWeight: 800,
                    cursor: (!selectedMember || !selectedBook) ? 'not-allowed' : 'pointer',
                    boxShadow: (selectedMember && selectedBook) ? '0 6px 18px rgba(79,70,229,0.35)' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  {issuing ? '⏳ Processing Issue...' : '✅ Confirm Issue (किताब जारी करें)'}
                </button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              TAB 2: RETURN BOOK (SEARCH BY STUDENT OR BOOK NAME + MODAL)
             ══════════════════════════════════════════════════════════════════════ */}
          {tab === 'RETURN' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
              <div style={cardStyle}>
                <h4 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 700, color: darkMode ? '#ffffff' : '#0f172a' }}>
                  🔍 Search Issued Book to Return (Student ya Book ke Naam se Dhundhein)
                </h4>
                <input
                  value={returnSearch}
                  onChange={e => setReturnSearch(e.target.value)}
                  placeholder="Type Student Name, Class, Roll Number, or Book Title..."
                  style={inputStyle}
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              CURRENTLY ISSUED BOOKS TABLE (ALWAYS VISIBLE WITH 1-CLICK RETURN)
             ══════════════════════════════════════════════════════════════════════ */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: '17px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                  📚 Active Issued Books ({filteredIssues.length})
                </h3>
                <p style={{ margin: 0, fontSize: '12.5px', color: '#94a3b8' }}>
                  Click &ldquo;↩ Return Book&rdquo; button next to any entry to process instant return and fine calculation.
                </p>
              </div>
              <button
                onClick={loadCurrentlyIssued}
                style={{
                  background: darkMode ? '#1e293b' : '#f1f5f9', border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`,
                  borderRadius: '8px', padding: '6px 14px', fontSize: '12.5px', fontWeight: 700,
                  color: darkMode ? '#e2e8f0' : '#475569', cursor: 'pointer'
                }}
              >
                ⟳ Refresh
              </button>
            </div>

            {loadingIssued ? (
              <div style={{ textAlign: 'center', padding: '36px', color: '#94a3b8', fontSize: '14px' }}>Loading active loans...</div>
            ) : filteredIssues.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px', color: '#94a3b8', fontSize: '14px' }}>
                Koi active issued book nahi mili
              </div>
            ) : (
              <div className="table-container" style={{ border: 'none' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Student / Member</th>
                      <th>Class &amp; Roll</th>
                      <th>Book Title</th>
                      <th>Issue Date</th>
                      <th>Due Date</th>
                      <th>Overdue Status</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIssues.map(i => (
                      <tr key={i.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: darkMode ? '#fff' : '#0f172a' }}>{i.member_name}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>Card: {i.card_number}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{i.class_name || 'Teacher / Staff'}</div>
                          {i.roll_number && <div style={{ fontSize: '11px', color: '#94a3b8' }}>Roll: {i.roll_number}</div>}
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: '#3b82f6' }}>{i.book_title}</div>
                        </td>
                        <td style={{ fontSize: '12.5px' }}>{i.issue_date}</td>
                        <td style={{ fontSize: '12.5px', fontWeight: 700, color: i.overdue_days > 0 ? '#ef4444' : '#10b981' }}>
                          {i.due_date}
                        </td>
                        <td>
                          {i.overdue_days > 0 ? (
                            <span className="badge badge-error">
                              OVERDUE ({i.overdue_days}d) · Est. ₹{i.estimated_fine}
                            </span>
                          ) : (
                            <span className="badge badge-success">ON SCHEDULE</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            onClick={() => setSelectedIssueToReturn(i)}
                            style={{
                              background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '8px',
                              padding: '8px 16px', fontSize: '12.5px', fontWeight: 800, cursor: 'pointer',
                              boxShadow: '0 2px 8px rgba(16,185,129,0.3)', transition: 'all 0.2s'
                            }}
                          >
                            ↩ Return Book
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ══════════════════════════════════════════════════════════════════════
              RETURN CONFIRMATION MODAL
             ══════════════════════════════════════════════════════════════════════ */}
          {selectedIssueToReturn && (
            <div
              style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999,
                backdropFilter: 'blur(6px)'
              }}
              onClick={e => e.target === e.currentTarget && setSelectedIssueToReturn(null)}
            >
              <div style={{
                background: darkMode ? '#111827' : '#ffffff', borderRadius: '20px', padding: '28px',
                width: '100%', maxWidth: '480px',
                border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
                boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
              }}>
                <h3 style={{ margin: '0 0 14px', fontSize: '18px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                  📥 Confirm Book Return
                </h3>

                <div style={{
                  background: darkMode ? '#1e293b' : '#f8fafc', borderRadius: '12px', padding: '16px', marginBottom: '18px',
                  border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`
                }}>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#3b82f6', marginBottom: '4px' }}>
                    📖 {selectedIssueToReturn.book_title}
                  </div>
                  <div style={{ fontSize: '13px', color: darkMode ? '#e2e8f0' : '#475569' }}>
                    Borrower: <strong>{selectedIssueToReturn.member_name}</strong>
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                    Issue Date: {selectedIssueToReturn.issue_date} · Due Date: {selectedIssueToReturn.due_date}
                  </div>

                  {selectedIssueToReturn.overdue_days > 0 && (
                    <div style={{
                      marginTop: '10px', background: 'rgba(239,68,68,0.12)', color: '#ef4444',
                      padding: '8px 12px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700
                    }}>
                      ⚠️ {selectedIssueToReturn.overdue_days} Days Overdue — Estimated Fine: ₹{selectedIssueToReturn.estimated_fine}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px', fontSize: '13px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: darkMode ? '#e2e8f0' : '#334155' }}>
                    <input type="checkbox" checked={markLost} onChange={e => setMarkLost(e.target.checked)} />
                    <strong>Mark as Lost (किताब खो गई)</strong>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: darkMode ? '#e2e8f0' : '#334155' }}>
                    <input type="checkbox" checked={markDamaged} onChange={e => setMarkDamaged(e.target.checked)} disabled={markLost} />
                    <strong>Mark as Damaged (किताब फट/खराब हो गई)</strong>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: darkMode ? '#e2e8f0' : '#334155' }}>
                    <input type="checkbox" checked={collectNow} onChange={e => setCollectNow(e.target.checked)} />
                    <strong>Collect Fine Immediately Now (तुरंत फाइन जमा करें)</strong>
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setSelectedIssueToReturn(null)}
                    style={{
                      padding: '10px 16px', borderRadius: '10px', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                      background: darkMode ? '#1e293b' : '#f8fafc',
                      color: darkMode ? '#ffffff' : '#334155', cursor: 'pointer', fontSize: '13px', fontWeight: 600
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    disabled={returning}
                    onClick={handleConfirmReturn}
                    style={{
                      padding: '10px 24px', borderRadius: '10px', border: 'none',
                      background: '#10b981', color: '#ffffff', cursor: returning ? 'not-allowed' : 'pointer',
                      fontSize: '13.5px', fontWeight: 800, boxShadow: '0 4px 14px rgba(16,185,129,0.35)'
                    }}
                  >
                    {returning ? '⏳ Processing...' : '✅ Confirm Return'}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
