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
  const [penaltyAmount, setPenaltyAmount] = useState('');
  const [damageNote, setDamageNote]       = useState('');
  const [collectNow, setCollectNow]       = useState(false);
  const [paymentMode, setPaymentMode]     = useState('CASH');
  const [returning, setReturning]         = useState(false);

  // ── Settings & Return Period Customization ──
  const [librarySettings, setLibrarySettings] = useState(null);
  const [returnDays, setReturnDays] = useState(14);
  const [customDueDate, setCustomDueDate] = useState('');

  useEffect(() => {
    api.get('/library/settings').then(r => {
      setLibrarySettings(r.data);
      if (r.data?.issue_duration_days) {
        setReturnDays(r.data.issue_duration_days);
      }
    }).catch(() => {});
  }, []);

  function previewDueDate() {
    if (customDueDate) {
      const d = new Date(customDueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffTime = d.getTime() - today.getTime();
      const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      return {
        days: diffDays,
        dateStr: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      };
    }
    const days = parseInt(returnDays) || librarySettings?.issue_duration_days || 14;
    const d = new Date();
    d.setDate(d.getDate() + days);
    return {
      days,
      dateStr: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    };
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

  // ── Search Member (Existing Members + All Eligible School Students) ──
  useEffect(() => {
    if (!memberSearch.trim()) { setMemberResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const [memRes, eligibleRes] = await Promise.allSettled([
          api.get('/library/members?search=' + encodeURIComponent(memberSearch.trim())),
          api.get('/library/members/search-eligible?search=' + encodeURIComponent(memberSearch.trim()) + '&type=STUDENT')
        ]);

        const existingMembers = (memRes.status === 'fulfilled' && Array.isArray(memRes.value?.data))
          ? memRes.value.data
          : [];
        const existingUserIds = new Set(existingMembers.map(m => m.user_id));

        const eligibleStudents = ((eligibleRes.status === 'fulfilled' && Array.isArray(eligibleRes.value?.data))
          ? eligibleRes.value.data
          : [])
          .filter(s => !existingUserIds.has(s.user_id))
          .map(s => ({
            id: null,
            user_id: s.user_id,
            student_id: s.student_id,
            name: s.name,
            card_number: 'Auto-Generate on Issue',
            member_type: 'STUDENT',
            current_issues: 0,
            class_name: s.class_name,
            roll_number: s.roll_number,
            admission_no: s.admission_no,
            is_new_student: true
          }));

        setMemberResults([...existingMembers, ...eligibleStudents]);
      } catch (err) {
        setMemberResults([]);
      }
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

  // ── When opening Return Modal, calculate suggested penalty ──
  useEffect(() => {
    if (!selectedIssueToReturn) return;
    const mrp = selectedIssueToReturn.book_mrp || selectedIssueToReturn.book_price || 0;
    if (markLost) {
      const mult = librarySettings?.lost_book_fine_multiplier || 1.0;
      setPenaltyAmount(String(Math.round(mrp * mult) || 0));
    } else if (markDamaged) {
      const mult = librarySettings?.damaged_book_fine_multiplier || 0.5;
      setPenaltyAmount(String(Math.round(mrp * mult) || 0));
    } else if (selectedIssueToReturn.overdue_days > 0) {
      setPenaltyAmount(String(selectedIssueToReturn.estimated_fine || 0));
    } else {
      setPenaltyAmount('0');
    }
  }, [selectedIssueToReturn, markLost, markDamaged, librarySettings]);

  // ── Handle Issue ──
  async function handleIssue() {
    if (!selectedMember) { toast.error('Please select a student or staff member'); return; }
    if (!selectedBook) { toast.error('Please select a book title'); return; }

    setIssuing(true);
    try {
      const payload = {
        member_id: selectedMember.id || undefined,
        user_id: selectedMember.user_id || undefined,
        student_id: selectedMember.student_id || undefined,
        book_id: selectedBook.id,
        days: returnDays,
        due_date: customDueDate || undefined,
      };
      const { data } = await api.post('/library/issue', payload);
      toast.success(`Book issued: "${data.book_title}" to ${data.member_name} (Due: ${data.due_date})`);
      setSelectedBook(null);
      setBookSearch('');
      setSelectedMember(null);
      setMemberSearch('');
      loadCurrentlyIssued();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to issue book');
    }
    setIssuing(false);
  }

  // ── Handle Return ──
  async function handleConfirmReturn() {
    if (!selectedIssueToReturn) return;
    setReturning(true);
    try {
      const payload = {
        issue_id: selectedIssueToReturn.id,
        mark_lost: markLost,
        mark_damaged: markDamaged,
        fine_amount: (markLost || markDamaged) ? parseFloat(penaltyAmount || 0) : undefined,
        condition_note: markDamaged ? damageNote : undefined,
        collect_fine_now: collectNow,
        payment_mode: collectNow ? paymentMode : undefined,
      };

      const { data } = await api.post('/library/return', payload);

      if (data.fine) {
        if (collectNow) {
          toast.success(`Book returned & fine of ₹${data.fine.amount} settled as PAID`);
        } else {
          toast.success(`Book returned. Outstanding fine of ₹${data.fine.amount} added to Fee Management (Pending)`);
        }
      } else {
        toast.success(`"${selectedIssueToReturn.book_title}" returned successfully with no fines.`);
      }

      setSelectedIssueToReturn(null);
      setMarkLost(false);
      setMarkDamaged(false);
      setPenaltyAmount('');
      setDamageNote('');
      setCollectNow(false);
      loadCurrentlyIssued();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to return book');
    }
    setReturning(false);
  }

  // ── Filtered Issues for Return Search ──
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

        <div className="page-body">

          {/* ══ Counter Header Banner ══ */}
          <div style={{
            background: 'linear-gradient(135deg, #032d60 0%, #0176d3 100%)',
            borderRadius: '20px', padding: '24px 30px', marginBottom: '24px', color: '#ffffff',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px'
          }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.18)', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>
                📖 Circulation Desk
              </div>
              <h2 style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: 800 }}>
                Library Issue &amp; Return Counter
              </h2>
              <p style={{ margin: 0, fontSize: '13.5px', color: 'rgba(255,255,255,0.85)' }}>
                Search by member name, roll number, or book title to manage book lending and returns.
              </p>
            </div>

            {/* Mode Switcher */}
            <div style={{ display: 'flex', gap: '10px', background: 'rgba(0,0,0,0.25)', padding: '6px', borderRadius: '14px' }}>
              <button
                onClick={() => setTab('ISSUE')}
                style={{
                  padding: '10px 22px', fontSize: '14px', fontWeight: 800, borderRadius: '10px', border: 'none', cursor: 'pointer',
                  background: tab === 'ISSUE' ? '#ffffff' : 'transparent',
                  color: tab === 'ISSUE' ? '#0176d3' : '#e0e7ff',
                  transition: 'all 0.2s', boxShadow: tab === 'ISSUE' ? '0 4px 12px rgba(0,0,0,0.15)' : 'none'
                }}
              >
                📤 Issue Book
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
                📥 Return Book
              </button>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════════
              TAB 1: ISSUE BOOK
             ══════════════════════════════════════════════════════════════════════ */}
          {tab === 'ISSUE' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
              
              {/* Step 1: Member Search */}
              <div style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(1,118,211,0.15)', color: '#0176d3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '15px' }}>
                    1
                  </div>
                  <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: darkMode ? '#ffffff' : '#0f172a' }}>
                    Select Student / Member
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
                      <div style={{ fontSize: '12px', color: '#0176d3', fontWeight: 600, marginTop: '2px' }}>
                        Currently Borrowed: {selectedMember.current_issues || 0} books
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
                      placeholder="Search student or teacher by name, card #, or roll..."
                      style={inputStyle}
                      autoFocus
                    />

                    {memberResults.length > 0 && (
                      <div style={{
                        marginTop: '8px', maxHeight: '240px', overflowY: 'auto',
                        background: darkMode ? '#1e293b' : '#ffffff',
                        border: `1.5px solid ${darkMode ? '#334155' : '#0176d3'}`,
                        borderRadius: '10px', boxShadow: '0 8px 22px rgba(1,118,211,0.18)'
                      }}>
                        {memberResults.map((m, idx) => (
                          <div
                            key={m.id || `eligible-${m.user_id}-${idx}`}
                            role="button"
                            tabIndex={0}
                            onClick={() => { setSelectedMember(m); setMemberResults([]); }}
                            onKeyDown={e => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setSelectedMember(m);
                                setMemberResults([]);
                              }
                            }}
                            style={{
                              padding: '10px 14px', cursor: 'pointer', fontSize: '13px',
                              borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}`,
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              background: m.is_new_student ? (darkMode ? '#1e3a8a22' : '#f0f9ff') : 'transparent'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#334155' : '#e0f2fe'}
                            onMouseLeave={e => e.currentTarget.style.background = m.is_new_student ? (darkMode ? '#1e3a8a22' : '#f0f9ff') : 'transparent'}
                          >
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <strong style={{ color: darkMode ? '#f1f5f9' : '#0f172a' }}>{m.name}</strong>
                                {m.is_new_student ? (
                                  <span style={{
                                    fontSize: '10px', fontWeight: 800, padding: '2px 6px',
                                    borderRadius: '6px', background: '#0284c7', color: '#ffffff'
                                  }}>
                                    Student (Auto-Enroll)
                                  </span>
                                ) : (
                                  <span style={{
                                    fontSize: '10.5px', fontWeight: 700, padding: '1px 6px',
                                    borderRadius: '6px', background: 'rgba(1,118,211,0.12)', color: '#0176d3'
                                  }}>
                                    Member
                                  </span>
                                )}
                              </div>
                              {m.class_name && (
                                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                                  Class: {m.class_name} · Roll: {m.roll_number || '—'} · Adm: {m.admission_no || '—'}
                                </div>
                              )}
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{
                                fontSize: '11px', color: m.is_new_student ? '#0284c7' : '#0176d3',
                                fontFamily: 'monospace', fontWeight: 700
                              }}>
                                {m.is_new_student ? '+ Enroll on Issue' : m.card_number}
                              </span>
                            </div>
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
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(1,118,211,0.15)', color: '#0176d3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '15px' }}>
                    2
                  </div>
                  <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: darkMode ? '#ffffff' : '#0f172a' }}>
                    Search Book Title
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
                        {selectedBook.available_copies > 0 ? `✅ ${selectedBook.available_copies} Copies Available` : '❌ Out of Stock'}
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
                      placeholder="Search by title, author, or subject (e.g. Physics, RD Sharma)..."
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
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                if (!isAvail) { toast.error('This book is currently out of stock'); return; }
                                setSelectedBook(b);
                                setBookResults([]);
                              }}
                              onKeyDown={e => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  if (!isAvail) { toast.error('This book is currently out of stock'); return; }
                                  setSelectedBook(b);
                                  setBookResults([]);
                                }
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

              {/* Step 3: Interactive Return Period & Due Date Customization */}
              <div style={{
                ...cardStyle, gridColumn: 'span 2', background: darkMode ? '#1e293b' : '#f8fafc',
                border: `1.5px solid ${darkMode ? '#334155' : '#cbd5e1'}`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(1,118,211,0.15)', color: '#0176d3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '15px' }}>
                      3
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '15.5px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                        Set Return Duration &amp; Due Date (वापस करने की अवधि)
                      </h4>
                      <div style={{ fontSize: '12px', color: textMuted, marginTop: '2px' }}>
                        Specify allowed borrowing days or pick an exact return date before overdue fines begin
                      </div>
                    </div>
                  </div>

                  {/* Preset duration chips + custom inputs */}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {[7, 14, 21, 30].map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => { setReturnDays(d); setCustomDueDate(''); }}
                        style={{
                          padding: '6px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
                          border: (returnDays === d && !customDueDate) ? '1.5px solid #0176d3' : `1px solid ${darkMode ? '#475569' : '#cbd5e1'}`,
                          background: (returnDays === d && !customDueDate) ? '#0176d3' : (darkMode ? '#0f172a' : '#ffffff'),
                          color: (returnDays === d && !customDueDate) ? '#ffffff' : (darkMode ? '#e2e8f0' : '#334155'),
                          boxShadow: (returnDays === d && !customDueDate) ? '0 2px 8px rgba(1,118,211,0.3)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {d} Days
                      </button>
                    ))}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '4px' }}>
                      <span style={{ fontSize: '12px', color: textMuted, fontWeight: 600 }}>Custom:</span>
                      <input
                        type="number"
                        min="1"
                        max="180"
                        value={customDueDate ? '' : returnDays}
                        placeholder="Days"
                        onChange={e => {
                          const val = parseInt(e.target.value) || 1;
                          setReturnDays(val);
                          setCustomDueDate('');
                        }}
                        style={{
                          width: '65px', padding: '6px 8px', borderRadius: '8px', fontSize: '12.5px',
                          border: `1.5px solid ${darkMode ? '#475569' : '#cbd5e1'}`,
                          background: darkMode ? '#0f172a' : '#ffffff',
                          color: darkMode ? '#ffffff' : '#0f172a', textAlign: 'center', fontWeight: 700
                        }}
                      />
                      <span style={{ fontSize: '12px', color: textMuted, fontWeight: 600 }}>or Exact Date:</span>
                      <input
                        type="date"
                        min={new Date().toISOString().split('T')[0]}
                        value={customDueDate}
                        onChange={e => setCustomDueDate(e.target.value)}
                        style={{
                          padding: '5px 10px', borderRadius: '8px', fontSize: '12.5px',
                          border: `1.5px solid ${darkMode ? '#475569' : '#cbd5e1'}`,
                          background: darkMode ? '#0f172a' : '#ffffff',
                          color: darkMode ? '#ffffff' : '#0f172a', fontWeight: 600
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Final summary bar with issue button */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px',
                  borderTop: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, paddingTop: '14px'
                }}>
                  <div style={{ fontSize: '13.5px', color: darkMode ? '#cbd5e1' : '#475569' }}>
                    📅 Allowed Period: <strong style={{ color: '#0176d3', fontSize: '15px' }}>{previewDueDate().days} Days</strong>
                    &nbsp;&nbsp;·&nbsp;&nbsp;
                    Due Date: <strong style={{ color: '#ef4444', fontSize: '15px' }}>{previewDueDate().dateStr}</strong>
                  </div>

                  <button
                    onClick={handleIssue}
                    disabled={issuing || !selectedMember || !selectedBook}
                    style={{
                      background: (!selectedMember || !selectedBook) ? (darkMode ? '#334155' : '#cbd5e1') : '#0176d3',
                      color: '#ffffff', border: 'none', borderRadius: '12px',
                      padding: '12px 34px', fontSize: '14.5px', fontWeight: 800,
                      cursor: (!selectedMember || !selectedBook) ? 'not-allowed' : 'pointer',
                      boxShadow: (selectedMember && selectedBook) ? '0 6px 18px rgba(1,118,211,0.35)' : 'none',
                      transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px'
                    }}
                  >
                    {issuing ? '⏳ Issuing...' : '✅ Confirm & Issue Book'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              TAB 2: RETURN BOOK (SEARCH BY STUDENT OR BOOK NAME)
             ══════════════════════════════════════════════════════════════════════ */}
          {tab === 'RETURN' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
              <div style={cardStyle}>
                <h4 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 700, color: darkMode ? '#ffffff' : '#0f172a' }}>
                  🔍 Search Borrowed Books to Return
                </h4>
                <input
                  value={returnSearch}
                  onChange={e => setReturnSearch(e.target.value)}
                  placeholder="Filter by student name, roll number, class, or book title..."
                  style={inputStyle}
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              CURRENTLY ISSUED BOOKS TABLE (WITH 1-CLICK RETURN)
             ══════════════════════════════════════════════════════════════════════ */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: '17px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                  📚 Active Borrowed Books ({filteredIssues.length})
                </h3>
                <p style={{ margin: 0, fontSize: '12.5px', color: '#94a3b8' }}>
                  Click &ldquo;↩ Return Book&rdquo; next to any borrower to initiate return and assess penalties.
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
                No active borrowed books found
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
                      <th>Status</th>
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
                          <div style={{ fontWeight: 600 }}>{i.class_name || 'Staff'}</div>
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
                            onClick={() => {
                              setSelectedIssueToReturn(i);
                              setMarkLost(false);
                              setMarkDamaged(false);
                              setCollectNow(false);
                            }}
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
              RETURN & PENALTY CALCULATION MODAL
             ══════════════════════════════════════════════════════════════════════ */}
          {selectedIssueToReturn && (
            <div
              role="button"
              tabIndex={0}
              aria-label="Close modal"
              style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999,
                backdropFilter: 'blur(6px)'
              }}
              onClick={e => e.target === e.currentTarget && setSelectedIssueToReturn(null)}
              onKeyDown={e => e.key === 'Escape' && setSelectedIssueToReturn(null)}
            >
              <div style={{
                background: darkMode ? '#111827' : '#ffffff', borderRadius: '20px', padding: '28px',
                width: '100%', maxWidth: '520px',
                border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
                boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                    📥 Process Book Return
                  </h3>
                  <button
                    onClick={() => setSelectedIssueToReturn(null)}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
                  >
                    ×
                  </button>
                </div>

                {/* Book & Borrower Summary Card */}
                <div style={{
                  background: darkMode ? '#1e293b' : '#f8fafc', borderRadius: '12px', padding: '16px', marginBottom: '18px',
                  border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`
                }}>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#3b82f6', marginBottom: '4px' }}>
                    📖 {selectedIssueToReturn.book_title}
                  </div>
                  <div style={{ fontSize: '13px', color: darkMode ? '#e2e8f0' : '#475569' }}>
                    Borrower: <strong>{selectedIssueToReturn.member_name}</strong> {selectedIssueToReturn.class_name ? `(${selectedIssueToReturn.class_name})` : ''}
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                    Issue Date: {selectedIssueToReturn.issue_date} · Due Date: {selectedIssueToReturn.due_date}
                  </div>

                  {selectedIssueToReturn.overdue_days > 0 && !markLost && !markDamaged && (
                    <div style={{
                      marginTop: '10px', background: 'rgba(239,68,68,0.12)', color: '#ef4444',
                      padding: '8px 12px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700
                    }}>
                      ⚠️ {selectedIssueToReturn.overdue_days} Days Overdue — Standard Late Fine: ₹{selectedIssueToReturn.estimated_fine}
                    </div>
                  )}
                </div>

                {/* Condition & Loss Checkboxes */}
                <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13.5px', color: darkMode ? '#e2e8f0' : '#334155' }}>
                    <input
                      type="checkbox"
                      checked={markLost}
                      onChange={e => {
                        setMarkLost(e.target.checked);
                        if (e.target.checked) setMarkDamaged(false);
                      }}
                    />
                    <strong>Book Lost</strong>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13.5px', color: darkMode ? '#e2e8f0' : '#334155' }}>
                    <input
                      type="checkbox"
                      checked={markDamaged}
                      disabled={markLost}
                      onChange={e => setMarkDamaged(e.target.checked)}
                    />
                    <strong>Book Damaged</strong>
                  </label>
                </div>

                {/* Penalty & Valuation Breakdown */}
                {(markLost || markDamaged) && (
                  <div style={{
                    background: darkMode ? 'rgba(245,158,11,0.1)' : '#fffbeb',
                    border: '1.5px solid #f59e0b', borderRadius: '12px', padding: '16px', marginBottom: '18px'
                  }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#b45309', marginBottom: '10px' }}>
                      {markLost ? '⚠️ Book Lost Penalty Assessment' : '⚠️ Book Damage Penalty Assessment'}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' }}>
                      <div>
                        <label style={{ fontSize: '11.5px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                          Book MRP / Valuation:
                        </label>
                        <div style={{ fontSize: '15px', fontWeight: 800, color: darkMode ? '#fff' : '#0f172a' }}>
                          ₹{selectedIssueToReturn.book_mrp || selectedIssueToReturn.book_price || 0}
                        </div>
                      </div>

                      <div>
                        <label style={{ fontSize: '11.5px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                          Penalty to Charge (₹):
                        </label>
                        <input
                          type="number"
                          value={penaltyAmount}
                          onChange={e => setPenaltyAmount(e.target.value)}
                          placeholder="Amount in ₹"
                          style={{
                            ...inputStyle, padding: '8px 10px', fontSize: '14px', fontWeight: 800,
                            borderColor: '#f59e0b'
                          }}
                        />
                      </div>
                    </div>

                    {markDamaged && (
                      <div style={{ marginTop: '8px' }}>
                        <label style={{ fontSize: '11.5px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                          Damage Description / Condition Note:
                        </label>
                        <input
                          value={damageNote}
                          onChange={e => setDamageNote(e.target.value)}
                          placeholder="e.g. Pages torn, water damage, cover missing..."
                          style={{ ...inputStyle, padding: '8px 10px', fontSize: '12.5px' }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Payment Collection & Fee Management Status Notice */}
                <div style={{
                  background: darkMode ? '#1e293b' : '#f8fafc',
                  border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                  borderRadius: '12px', padding: '14px', marginBottom: '20px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: collectNow ? '10px' : '0' }}>
                    <div>
                      <div style={{ fontSize: '12.5px', fontWeight: 700, color: darkMode ? '#fff' : '#0f172a' }}>
                        Fee Record Status: <span style={{ color: collectNow ? '#10b981' : '#f59e0b' }}>{collectNow ? 'PAID (Settled)' : 'PENDING (Outstanding Due)'}</span>
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '2px' }}>
                        {collectNow
                          ? 'Payment will be marked as paid and logged in ledger.'
                          : 'Fine will be logged as UNPAID in Fee Management until explicitly collected.'}
                      </div>
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12.5px', fontWeight: 700, color: '#0176d3' }}>
                      <input
                        type="checkbox"
                        checked={collectNow}
                        onChange={e => setCollectNow(e.target.checked)}
                      />
                      Collect Now
                    </label>
                  </div>

                  {collectNow && (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>Payment Mode:</span>
                      {['CASH', 'UPI', 'CARD', 'CHEQUE'].map(mode => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setPaymentMode(mode)}
                          style={{
                            padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, border: 'none', cursor: 'pointer',
                            background: paymentMode === mode ? '#0176d3' : (darkMode ? '#334155' : '#e2e8f0'),
                            color: paymentMode === mode ? '#fff' : (darkMode ? '#cbd5e1' : '#475569')
                          }}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Modal Footer Actions */}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setSelectedIssueToReturn(null)}
                    style={{
                      padding: '10px 18px', borderRadius: '10px', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
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
                    {returning ? '⏳ Processing Return...' : '✅ Confirm Return'}
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
