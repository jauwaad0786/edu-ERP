import React, { useState, useEffect, useRef } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';

export default function LibraryIssueReturn() {
  const [darkMode, setDarkMode] = useState(localStorage.getItem('ederp_theme') === 'dark');
  const [tab, setTab] = useState('ISSUE'); // ISSUE | RETURN

  // ── Issue state ──
  const [memberSearch, setMemberSearch]   = useState('');
  const [memberResults, setMemberResults] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);

  const [searchMode, setSearchMode]       = useState('TITLE'); // 'TITLE' | 'BARCODE'

  const [barcodeInput, setBarcodeInput]   = useState('');
  const [scannedCopy, setScannedCopy]     = useState(null);

  const [bookTitleSearch, setBookTitleSearch] = useState('');
  const [bookTitleResults, setBookTitleResults] = useState([]);
  const [selectedBookForIssue, setSelectedBookForIssue] = useState(null); // { id, title, author, available_copies }

  const [issuing, setIssuing]             = useState(false);

  // ── Return state ──
  const [returnBarcode, setReturnBarcode] = useState('');
  const [returnPreview, setReturnPreview] = useState(null); // { issue, fine estimate }
  const [markLost, setMarkLost]           = useState(false);
  const [markDamaged, setMarkDamaged]     = useState(false);
  const [collectNow, setCollectNow]       = useState(true);
  const [returning, setReturning]         = useState(false);

  // NEW
  const barcodeRef = useRef(null);
  const returnBarcodeRef = useRef(null);

  // ── Currently issued books (niche list — dashboard-style) ──
  const [currentlyIssued, setCurrentlyIssued] = useState([]);
  const [loadingIssued, setLoadingIssued] = useState(true);

  const loadCurrentlyIssued = React.useCallback(() => {
    setLoadingIssued(true);
    api.get('/library/issues?status=ISSUED&per_page=100')
      .then(r => setCurrentlyIssued(r.data?.data || []))
      .catch(() => setCurrentlyIssued([]))
      .finally(() => setLoadingIssued(false));
  }, []);

  useEffect(() => { loadCurrentlyIssued(); }, [loadCurrentlyIssued]);

  // ── Search member (debounced) ──
  useEffect(() => {
    if (!memberSearch.trim()) { setMemberResults([]); return; }
    const t = setTimeout(() => {
      api.get('/library/members?search=' + encodeURIComponent(memberSearch))
        .then(r => setMemberResults(r.data || []))
        .catch(() => setMemberResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [memberSearch]);

  // ── Barcode lookup (Issue tab) ──
  // ── Book title search (Issue tab — alternative jab barcode na ho) ──
  useEffect(() => {
    if (!bookTitleSearch.trim()) { setBookTitleResults([]); return; }
    const t = setTimeout(() => {
      api.get('/library/books?search=' + encodeURIComponent(bookTitleSearch) + '&per_page=8')
        .then(r => setBookTitleResults(r.data.data || []))
        .catch(() => setBookTitleResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [bookTitleSearch]);

  // ── Barcode lookup (Issue tab) ──
  async function handleBarcodeLookup() {
    if (!barcodeInput.trim()) return;
    try {
      const r = await api.get('/library/copies/barcode/' + barcodeInput.trim());
      setScannedCopy(r.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Barcode not found');
      setScannedCopy(null);
    }
  }

  async function handleIssue() {
    if (!selectedMember) { toast.error('Pehle member select karo'); return; }
    if (!scannedCopy && !selectedBookForIssue) { toast.error('Pehle book scan/search karo'); return; }

    const payload = { member_id: selectedMember.id };
    if (searchMode === 'BARCODE' && scannedCopy) {
      payload.barcode = scannedCopy.barcode;
    } else if (selectedBookForIssue) {
      payload.book_id = selectedBookForIssue.id; // backend khud ek AVAILABLE copy auto-pick karega
    }

    setIssuing(true);
    try {
      // NEW
      const { data } = await api.post('/library/issue', payload);
      toast.success(`Issued: ${data.book_title} → ${data.member_name} (Due ${data.due_date})`);
      setScannedCopy(null);
      setBarcodeInput('');
      setSelectedBookForIssue(null);
      setBookTitleSearch('');
      barcodeRef.current?.focus();
      loadCurrentlyIssued();   // NEW — niche wali list turant refresh
    } catch (err) {
      toast.error(err.response?.data?.error || 'Issue nahi ho paya');
    }
    setIssuing(false);
  }

  // ── Return flow ──
  async function handleReturnLookup() {
    if (!returnBarcode.trim()) return;
    try {
      const copy = await api.get('/library/copies/barcode/' + returnBarcode.trim());
      if (copy.data.status !== 'ISSUED') {
        toast.error('Ye copy currently issued nahi hai');
        setReturnPreview(null);
        return;
      }
      // Find the active issue for this copy via issues list
      const issuesRes = await api.get('/library/issues?status=ISSUED&per_page=100');
      const activeIssue = (issuesRes.data.data || []).find(i => i.barcode === returnBarcode.trim());
      if (!activeIssue) {
        toast.error('Active issue record nahi mila');
        return;
      }
      setReturnPreview({ ...activeIssue, book: copy.data.book });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Barcode not found');
      setReturnPreview(null);
    }
  }

  async function handleConfirmReturn() {
    if (!returnPreview) return;
    setReturning(true);
    try {
      const { data } = await api.post('/library/return', {
        issue_id: returnPreview.id,
        mark_lost: markLost,
        mark_damaged: markDamaged,
        collect_fine_now: collectNow,
      });
      if (data.fine) {
        toast.success(`Returned. Fine: ₹${data.fine.amount} (${data.fine.status})`);
      } else {
        toast.success('Book returned successfully — no fine');
      }
      // NEW
      setReturnPreview(null);
      setReturnBarcode('');
      setMarkLost(false);
      setMarkDamaged(false);
      returnBarcodeRef.current?.focus();
      loadCurrentlyIssued();   // NEW
    } catch (err) {
      toast.error(err.response?.data?.error || 'Return nahi ho paya');
    }
    setReturning(false);
  }

  const cardStyle = {
    background: darkMode ? '#1e293b' : '#fff',
    border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
    borderRadius: 12, padding: 20,
  };
  const inputStyle = {
    width: '100%', padding: '10px 12px', fontSize: 13,
    border: '1px solid #e2e8f0', borderRadius: 8, outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: darkMode ? '#0f172a' : '#f8fafc' }}>
      <Sidebar darkMode={darkMode} />
      <div style={{ marginLeft: 232, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Navbar title="Issue / Return Counter" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div style={{ padding: 24, maxWidth: 900 }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            {['ISSUE', 'RETURN'].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: '9px 22px', fontSize: 13, fontWeight: 700, borderRadius: 8,
                border: 'none', cursor: 'pointer',
                background: tab === t ? '#4f46e5' : (darkMode ? '#1e293b' : '#e2e8f0'),
                color: tab === t ? '#fff' : (darkMode ? '#94a3b8' : '#64748b'),
              }}>
                {t === 'ISSUE' ? '📤 Issue Book' : '📥 Return Book'}
              </button>
            ))}
          </div>

          {/* ── ISSUE TAB ── */}
          {tab === 'ISSUE' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

              {/* Member search */}
              <div style={cardStyle}>
                <h4 style={{ margin: '0 0 12px', fontSize: 14, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                  1. Select Member
                </h4>
                {selectedMember ? (
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 12,
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>{selectedMember.name}</div>
                      <div style={{ fontSize: 11, color: '#16a34a' }}>
                        {selectedMember.card_number} · {selectedMember.current_issues} issued
                      </div>
                    </div>
                    <button onClick={() => setSelectedMember(null)} style={{
                      background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                    }}>
                      Change
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      value={memberSearch}
                      onChange={e => setMemberSearch(e.target.value)}
                      placeholder="Search by name or card number..."
                      style={inputStyle}
                    />
                    {memberResults.length > 0 && (
                      <div style={{ marginTop: 8, maxHeight: 200, overflowY: 'auto' }}>
                        {memberResults.map(m => (
                          <div key={m.id} onClick={() => { setSelectedMember(m); setMemberSearch(''); setMemberResults([]); }}
                            style={{
                              padding: '8px 10px', cursor: 'pointer', borderRadius: 6,
                              fontSize: 13, borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}`,
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#273349' : '#f8fafc'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <strong>{m.name}</strong> — {m.card_number}
                            {m.status !== 'ACTIVE' && (
                              <span style={{ color: '#dc2626', marginLeft: 8, fontSize: 11 }}>({m.status})</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Find Book — Title search OR Barcode scan */}
              <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h4 style={{ margin: 0, fontSize: 14, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                    2. Find Book
                  </h4>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => { setSearchMode('TITLE'); setScannedCopy(null); setBarcodeInput(''); }} style={{
                      padding: '5px 12px', fontSize: 11, fontWeight: 700, borderRadius: 6, border: 'none', cursor: 'pointer',
                      background: searchMode === 'TITLE' ? '#4f46e5' : (darkMode ? '#334155' : '#e2e8f0'),
                      color: searchMode === 'TITLE' ? '#fff' : (darkMode ? '#94a3b8' : '#64748b'),
                    }}>
                      🔤 By Title
                    </button>
                    <button onClick={() => { setSearchMode('BARCODE'); setSelectedBookForIssue(null); setBookTitleSearch(''); }} style={{
                      padding: '5px 12px', fontSize: 11, fontWeight: 700, borderRadius: 6, border: 'none', cursor: 'pointer',
                      background: searchMode === 'BARCODE' ? '#4f46e5' : (darkMode ? '#334155' : '#e2e8f0'),
                      color: searchMode === 'BARCODE' ? '#fff' : (darkMode ? '#94a3b8' : '#64748b'),
                    }}>
                      📷 By Barcode
                    </button>
                  </div>
                </div>

                {searchMode === 'TITLE' ? (
                  <>
                    {selectedBookForIssue ? (
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 12,
                      }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#0176d3' }}>{selectedBookForIssue.title}</div>
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                            {selectedBookForIssue.author} · {selectedBookForIssue.available_copies} available
                          </div>
                        </div>
                        <button onClick={() => setSelectedBookForIssue(null)} style={{
                          background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                        }}>
                          Change
                        </button>
                      </div>
                    ) : (
                      <>
                        <input
                          value={bookTitleSearch}
                          onChange={e => setBookTitleSearch(e.target.value)}
                          placeholder="Search book by title, author, or subject..."
                          style={inputStyle}
                          autoFocus
                        />
                        {bookTitleResults.length > 0 && (
                          <div style={{ marginTop: 8, maxHeight: 220, overflowY: 'auto' }}>
                            {bookTitleResults.map(b => {
                              const unavailable = b.available_copies === 0;
                              return (
                                <div key={b.id}
                                  onClick={() => { if (!unavailable) { setSelectedBookForIssue(b); setBookTitleSearch(''); setBookTitleResults([]); } }}
                                  style={{
                                    padding: '8px 10px', borderRadius: 6, fontSize: 13,
                                    cursor: unavailable ? 'not-allowed' : 'pointer',
                                    opacity: unavailable ? 0.5 : 1,
                                    borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}`,
                                  }}
                                  onMouseEnter={e => !unavailable && (e.currentTarget.style.background = darkMode ? '#273349' : '#f8fafc')}
                                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                  <strong>{b.title}</strong> — {b.author}
                                  <span style={{
                                    marginLeft: 8, fontSize: 11, fontWeight: 700,
                                    color: unavailable ? '#dc2626' : '#16a34a',
                                  }}>
                                    {unavailable ? '(0 available — reserve instead)' : `(${b.available_copies} available)`}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        ref={barcodeRef}
                        value={barcodeInput}
                        onChange={e => setBarcodeInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleBarcodeLookup()}
                        placeholder="Scan barcode or type manually..."
                        style={inputStyle}
                        autoFocus
                      />
                      <button onClick={handleBarcodeLookup} style={{
                        background: '#0176d3', color: '#fff', border: 'none', borderRadius: 8,
                        padding: '0 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      }}>
                        Find
                      </button>
                    </div>

                    {scannedCopy && (
                      <div style={{
                        marginTop: 12, background: '#eff6ff', border: '1px solid #bfdbfe',
                        borderRadius: 8, padding: 12,
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0176d3' }}>
                          {scannedCopy.book?.title}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                          {scannedCopy.book?.author} · Copy: {scannedCopy.copy_accession_no} · Status: {scannedCopy.status}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Confirm issue */}
              <div style={{ ...cardStyle, gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={handleIssue}
                  disabled={issuing || !selectedMember || (!scannedCopy && !selectedBookForIssue)}
                  style={{
                    background: (!selectedMember || (!scannedCopy && !selectedBookForIssue)) ? '#cbd5e1' : '#16a34a',
                    color: '#fff', border: 'none', borderRadius: 8,
                    padding: '12px 30px', fontSize: 14, fontWeight: 700,
                    cursor: (!selectedMember || (!scannedCopy && !selectedBookForIssue)) ? 'not-allowed' : 'pointer',
                  }}>
                  {issuing ? 'Issuing...' : '✅ Confirm Issue'}
                </button>
              </div>
            </div>
          )}

          // NEW
          {/* ── RETURN TAB ── */}
          {tab === 'RETURN' && (
            <div style={cardStyle}>
              ... (poora return tab content jaisa ka waisa — koi change nahi) ...
            </div>
          )}

          {/* ── Currently Issued Books (hamesha visible, dono tabs ke niche) ── */}
          <div style={{ ...cardStyle, marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h4 style={{ margin: 0, fontSize: 14, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                📚 Currently Issued Books ({currentlyIssued.length})
              </h4>
              <button onClick={loadCurrentlyIssued} style={{
                background: 'none', border: 'none', color: '#4f46e5', cursor: 'pointer', fontSize: 12, fontWeight: 700,
              }}>
                ⟳ Refresh
              </button>
            </div>

            {loadingIssued ? (
              <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8', fontSize: 13 }}>Loading...</div>
            ) : currentlyIssued.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8', fontSize: 13 }}>Abhi koi book issue nahi hai</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, textAlign: 'left' }}>
                    <th style={{ padding: '6px', color: '#94a3b8', fontSize: 10 }}>STUDENT</th>
                    <th style={{ padding: '6px', color: '#94a3b8', fontSize: 10 }}>CLASS</th>
                    <th style={{ padding: '6px', color: '#94a3b8', fontSize: 10 }}>ROLL NO</th>
                    <th style={{ padding: '6px', color: '#94a3b8', fontSize: 10 }}>BOOK</th>
                    <th style={{ padding: '6px', color: '#94a3b8', fontSize: 10 }}>ISSUE DATE</th>
                    <th style={{ padding: '6px', color: '#94a3b8', fontSize: 10 }}>DUE DATE</th>
                    <th style={{ padding: '6px', color: '#94a3b8', fontSize: 10 }}>FINE</th>
                    <th style={{ padding: '6px', color: '#94a3b8', fontSize: 10 }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {currentlyIssued.map(i => (
                    <tr key={i.id} style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}` }}>
                      <td style={{ padding: '8px 6px', fontWeight: 600, color: darkMode ? '#f1f5f9' : '#0f172a' }}>{i.member_name}</td>
                      <td style={{ padding: '8px 6px', color: '#64748b' }}>{i.class_name || '—'}</td>
                      <td style={{ padding: '8px 6px', color: '#64748b' }}>{i.roll_number || '—'}</td>
                      <td style={{ padding: '8px 6px', color: '#64748b' }}>{i.book_title}</td>
                      <td style={{ padding: '8px 6px', color: '#64748b' }}>{i.issue_date}</td>
                      <td style={{ padding: '8px 6px', color: '#64748b' }}>{i.due_date}</td>
                      <td style={{ padding: '8px 6px' }}>
                        {i.estimated_fine > 0 ? (
                          <span style={{ color: '#dc2626', fontWeight: 700 }}>
                            ₹{i.estimated_fine} ({i.overdue_days}d)
                          </span>
                        ) : (
                          <span style={{ color: '#16a34a' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '8px 6px' }}>
                        <button
                          onClick={() => { setTab('RETURN'); setReturnBarcode(i.barcode); }}
                          style={{
                            background: '#eff6ff', color: '#0176d3', border: 'none', borderRadius: 6,
                            padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                          }}>
                          ↩ Return
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
