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

  const [barcodeInput, setBarcodeInput]   = useState('');
  const [scannedCopy, setScannedCopy]     = useState(null);
  const [issuing, setIssuing]             = useState(false);

  // ── Return state ──
  const [returnBarcode, setReturnBarcode] = useState('');
  const [returnPreview, setReturnPreview] = useState(null); // { issue, fine estimate }
  const [markLost, setMarkLost]           = useState(false);
  const [markDamaged, setMarkDamaged]     = useState(false);
  const [collectNow, setCollectNow]       = useState(true);
  const [returning, setReturning]         = useState(false);

  const barcodeRef = useRef(null);
  const returnBarcodeRef = useRef(null);

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
    if (!scannedCopy) { toast.error('Pehle book scan/search karo'); return; }

    setIssuing(true);
    try {
      const { data } = await api.post('/library/issue', {
        member_id: selectedMember.id,
        barcode: scannedCopy.barcode,
      });
      toast.success(`Issued: ${data.book_title} → ${data.member_name} (Due ${data.due_date})`);
      setScannedCopy(null);
      setBarcodeInput('');
      barcodeRef.current?.focus();
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
      setReturnPreview(null);
      setReturnBarcode('');
      setMarkLost(false);
      setMarkDamaged(false);
      returnBarcodeRef.current?.focus();
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

              {/* Barcode scan */}
              <div style={cardStyle}>
                <h4 style={{ margin: '0 0 12px', fontSize: 14, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                  2. Scan / Enter Barcode
                </h4>
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
              </div>

              {/* Confirm issue */}
              <div style={{ ...cardStyle, gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={handleIssue}
                  disabled={issuing || !selectedMember || !scannedCopy}
                  style={{
                    background: (!selectedMember || !scannedCopy) ? '#cbd5e1' : '#16a34a',
                    color: '#fff', border: 'none', borderRadius: 8,
                    padding: '12px 30px', fontSize: 14, fontWeight: 700,
                    cursor: (!selectedMember || !scannedCopy) ? 'not-allowed' : 'pointer',
                  }}>
                  {issuing ? 'Issuing...' : '✅ Confirm Issue'}
                </button>
              </div>
            </div>
          )}

          {/* ── RETURN TAB ── */}
          {tab === 'RETURN' && (
            <div style={cardStyle}>
              <h4 style={{ margin: '0 0 12px', fontSize: 14, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                Scan Book to Return
              </h4>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  ref={returnBarcodeRef}
                  value={returnBarcode}
                  onChange={e => setReturnBarcode(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleReturnLookup()}
                  placeholder="Scan barcode or type manually..."
                  style={inputStyle}
                  autoFocus
                />
                <button onClick={handleReturnLookup} style={{
                  background: '#0176d3', color: '#fff', border: 'none', borderRadius: 8,
                  padding: '0 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>
                  Find
                </button>
              </div>

              {returnPreview && (
                <div style={{ marginTop: 18 }}>
                  <div style={{
                    background: darkMode ? '#273349' : '#f8fafc', borderRadius: 8, padding: 14, marginBottom: 14,
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                      {returnPreview.book_title}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                      Issued to: <strong>{returnPreview.member_name}</strong> · Due: {returnPreview.due_date}
                    </div>
                    {returnPreview.overdue_days > 0 && (
                      <div style={{
                        marginTop: 8, display: 'inline-block', fontSize: 12, fontWeight: 700,
                        color: '#dc2626', background: '#fef2f2', padding: '4px 10px', borderRadius: 20,
                      }}>
                        {returnPreview.overdue_days} days overdue — fine will apply
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 20, marginBottom: 14, fontSize: 13 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input type="checkbox" checked={markLost} onChange={e => setMarkLost(e.target.checked)} />
                      Book Lost
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input type="checkbox" checked={markDamaged} onChange={e => setMarkDamaged(e.target.checked)}
                        disabled={markLost} />
                      Book Damaged
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input type="checkbox" checked={collectNow} onChange={e => setCollectNow(e.target.checked)} />
                      Collect Fine Now
                    </label>
                  </div>

                  <button
                    onClick={handleConfirmReturn}
                    disabled={returning}
                    style={{
                      background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8,
                      padding: '11px 26px', fontSize: 14, fontWeight: 700,
                      cursor: returning ? 'not-allowed' : 'pointer',
                    }}>
                    {returning ? 'Processing...' : '✅ Confirm Return'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
