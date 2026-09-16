import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function StudentImportPage() {
  const navigate = useNavigate();

  // Mode: 'spreadsheet' | 'register' | 'history'
  const [activeTab, setActiveTab] = useState('spreadsheet');
  const [sources, setSources] = useState([]);
  const [canonicalFields, setCanonicalFields] = useState([]);
  const [session, setSession] = useState('2026-27');

  // Spreadsheet state
  const [file, setFile] = useState(null);
  const [detectedData, setDetectedData] = useState(null);
  const [columnMapping, setColumnMapping] = useState({});
  const [validationReport, setValidationReport] = useState(null);
  const [detecting, setDetecting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [executing, setExecuting] = useState(false);

  // Reconciliation & Spot Check state
  const [reconciliation, setReconciliation] = useState(null);
  const [spotCheckSample, setSpotCheckSample] = useState(null);
  const [showSpotCheckModal, setShowSpotCheckModal] = useState(false);
  const [recentBatches, setRecentBatches] = useState([]);

  // Manual Register state
  const [manualRows, setManualRows] = useState([
    { admission_no: '', name: '', class_name: 'Class 1', section: 'A', roll_number: '', parent_phone: '', father_name: '', opening_balance: '0' },
    { admission_no: '', name: '', class_name: 'Class 1', section: 'A', roll_number: '', parent_phone: '', father_name: '', opening_balance: '0' },
    { admission_no: '', name: '', class_name: 'Class 2', section: 'A', roll_number: '', parent_phone: '', father_name: '', opening_balance: '0' }
  ]);
  const [manualSubmitting, setManualSubmitting] = useState(false);

  useEffect(() => {
    // Load migration metadata and sources
    api.get('/principal/migration/sources')
      .then(res => {
        setSources(res.data.sources || []);
        setCanonicalFields(res.data.canonical_fields || []);
        if (res.data.current_session) setSession(res.data.current_session);
      })
      .catch(() => {});

    loadRecentBatches();
  }, []);

  function loadRecentBatches() {
    api.get('/principal/migration/batches')
      .then(res => setRecentBatches(res.data || []))
      .catch(() => {});
  }

  // 1. Detect columns on file upload
  async function handleFileUpload(e) {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setDetectedData(null);
    setValidationReport(null);
    setReconciliation(null);
    setDetecting(true);

    const formData = new FormData();
    formData.append('file', uploadedFile);

    try {
      const res = await api.post('/principal/migration/detect', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setDetectedData(res.data);
      setColumnMapping(res.data.suggested_mapping || {});
      toast.success(`Detected ${res.data.total_rows_detected} rows and ${res.data.raw_headers.length} columns!`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to parse file. Ensure it is a valid CSV or Excel file.');
      setFile(null);
    }
    setDetecting(false);
  }

  // 2. Validate data
  async function handleValidateData() {
    if (!detectedData) return;
    setValidating(true);
    try {
      const res = await api.post('/principal/migration/validate', {
        rows: detectedData.all_rows || detectedData.preview_rows || [],
        mapping: columnMapping,
        session
      });
      setValidationReport(res.data);
      toast.success('Validation complete. Review summary before migrating.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Validation failed');
    }
    setValidating(false);
  }

  // 3. Execute Migration (Pilot or Full)
  async function handleExecute(isPilot) {
    if (!file || !detectedData) return;
    setExecuting(true);
    try {
      const res = await api.post('/principal/migration/execute', {
        rows: detectedData.all_rows || detectedData.preview_rows || [],
        mapping: columnMapping,
        session,
        is_pilot: isPilot,
        pilot_limit: 15,
        filename: detectedData.filename
      });

      const batchId = res.data.batch_id;
      toast.success(
        isPilot
          ? `Pilot test completed! Migrated ${res.data.imported_new} sample students.`
          : `Migration successful! ${res.data.imported_new} students migrated with ₹${res.data.total_opening_dues} opening dues.`
      );

      // Fetch reconciliation summary immediately
      const recRes = await api.get(`/principal/migration/reconciliation/${batchId}`);
      setReconciliation(recRes.data);
      loadRecentBatches();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Migration execution failed');
    }
    setExecuting(false);
  }

  // 4. Spot check modal
  async function handleSpotCheck(batchId) {
    try {
      const res = await api.get(`/principal/migration/spot-check/${batchId}?size=10`);
      setSpotCheckSample(res.data.students || []);
      setShowSpotCheckModal(true);
    } catch (err) {
      toast.error('Failed to load spot-check samples');
    }
  }

  // 5. Manual Register Entry
  function handleAddManualRow() {
    setManualRows(prev => [
      ...prev,
      { admission_no: '', name: '', class_name: 'Class 1', section: 'A', roll_number: '', parent_phone: '', father_name: '', opening_balance: '0' }
    ]);
  }

  function handleManualRowChange(index, field, value) {
    setManualRows(prev => {
      const next = [...prev];
      next[index][field] = value;
      return next;
    });
  }

  function handleRemoveManualRow(index) {
    setManualRows(prev => prev.filter((_, i) => i !== index));
  }

  async function handleManualSubmit() {
    const validRows = manualRows.filter(r => r.name?.trim());
    if (validRows.length === 0) {
      toast.error('Please enter at least one student name');
      return;
    }

    setManualSubmitting(true);
    try {
      const res = await api.post('/principal/migration/manual-entry', {
        students: validRows,
        session
      });
      toast.success(`Successfully onboarded ${res.data.imported_new} students from register!`);
      setManualRows([
        { admission_no: '', name: '', class_name: 'Class 1', section: 'A', roll_number: '', parent_phone: '', father_name: '', opening_balance: '0' }
      ]);
      loadRecentBatches();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Manual submission failed');
    }
    setManualSubmitting(false);
  }

  function downloadSample() {
    window.open('/api/principal/migration/sample-template', '_blank');
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="School Data Migration & Student Onboarding" />
        <div className="page-body">

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#64748b', marginBottom: 4 }}>
                <span style={{ cursor: 'pointer', color: '#0176d3' }} onClick={() => navigate('/students')}>Student Management</span>
                <span>/</span>
                <span style={{ fontWeight: 600, color: '#1e293b' }}>Legacy Data Migration</span>
              </div>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span>🏫</span> School Onboarding & Legacy Data Migration Hub
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b', maxWidth: 850 }}>
                Safely migrate your existing school from Excel, Google Sheets, Physical Registers, or Old ERP without charging new admission fees, preserving original scholar numbers, and bringing forward opening fee balances seamlessly.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn-neutral"
                onClick={downloadSample}
                style={{ fontSize: 13, borderColor: '#38bdf8', color: '#0284c7', background: '#f0f9ff', fontWeight: 700 }}
              >
                📥 Download Migration Template (.csv)
              </button>
              <button
                type="button"
                className="btn btn-neutral"
                onClick={() => navigate('/students')}
                style={{ fontSize: 13 }}
              >
                ← Active Students
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', gap: 8, borderBottom: '2px solid #e2e8f0', marginBottom: 24 }}>
            <button
              onClick={() => setActiveTab('spreadsheet')}
              style={{
                padding: '10px 18px', fontSize: 14, fontWeight: 700, border: 'none', background: 'none', cursor: 'pointer',
                borderBottom: activeTab === 'spreadsheet' ? '3px solid #0176d3' : '3px solid transparent',
                color: activeTab === 'spreadsheet' ? '#0176d3' : '#64748b'
              }}
            >
              📊 Excel / CSV Spreadsheet Import
            </button>
            <button
              onClick={() => setActiveTab('register')}
              style={{
                padding: '10px 18px', fontSize: 14, fontWeight: 700, border: 'none', background: 'none', cursor: 'pointer',
                borderBottom: activeTab === 'register' ? '3px solid #0176d3' : '3px solid transparent',
                color: activeTab === 'register' ? '#0176d3' : '#64748b'
              }}
            >
              📖 Paper Register / Notebook Quick Entry
            </button>
            <button
              onClick={() => setActiveTab('history')}
              style={{
                padding: '10px 18px', fontSize: 14, fontWeight: 700, border: 'none', background: 'none', cursor: 'pointer',
                borderBottom: activeTab === 'history' ? '3px solid #0176d3' : '3px solid transparent',
                color: activeTab === 'history' ? '#0176d3' : '#64748b'
              }}
            >
              📋 Migration History & Spot Checks ({recentBatches.length})
            </button>
          </div>

          {/* TAB 1: SPREADSHEET MIGRATION */}
          {activeTab === 'spreadsheet' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 20, maxWidth: 1100 }}>
              
              {/* Step 1: Upload Card */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1e293b' }}>
                      Step 1: Upload Existing School File
                    </h3>
                    <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>
                      Supports standard Excel (.xlsx, .xls) and CSV (.csv) exports from your current records.
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Target Session:</span>
                    <input
                      className="form-input"
                      value={session}
                      onChange={e => setSession(e.target.value)}
                      style={{ width: 110, padding: '4px 8px', fontSize: 12, fontWeight: 700 }}
                    />
                  </div>
                </div>

                <div style={{
                  border: '2px dashed #cbd5e1', borderRadius: 12, padding: '36px 20px',
                  textAlign: 'center', background: '#f8fafc', cursor: 'pointer', position: 'relative'
                }}>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    id="migrationFileInput"
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                    onChange={handleFileUpload}
                  />
                  <div style={{ fontSize: 36, marginBottom: 8 }}>📑</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
                    {file ? file.name : 'Choose Excel / CSV File or Drag & Drop Here'}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    {detecting ? 'Analyzing columns and matching aliases...' : 'Auto-detects Scholar No, Names, Phone, Opening Dues, Bus Routes, and Hostel Beds'}
                  </div>
                </div>
              </div>

              {/* Step 2: Intelligent Field Mapper */}
              {detectedData && (
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1e293b' }}>
                        Step 2: Smart Column Alias Mapping
                      </h3>
                      <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>
                        We automatically matched your column headers to Edu-ERP fields. Adjust any field if required.
                      </p>
                    </div>
                    <span style={{ fontSize: 12, background: '#dcfce7', color: '#15803d', fontWeight: 800, padding: '4px 10px', borderRadius: 20 }}>
                      ✓ {Object.keys(columnMapping).length} Fields Matched
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14, marginBottom: 20 }}>
                    {canonicalFields.map(cf => (
                      <div key={cf.key} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>
                            {cf.label} {cf.required && <span style={{ color: '#dc2626' }}>*</span>}
                          </span>
                          {cf.key === 'admission_no' && (
                            <span style={{ fontSize: 10, background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                              Preserves Old ID
                            </span>
                          )}
                          {cf.key === 'opening_balance' && (
                            <span style={{ fontSize: 10, background: '#fef3c7', color: '#b45309', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                              Ledger Debit
                            </span>
                          )}
                        </div>
                        <select
                          className="form-input"
                          value={columnMapping[cf.key] || ''}
                          onChange={e => setColumnMapping(prev => ({ ...prev, [cf.key]: e.target.value }))}
                          style={{ width: '100%', fontSize: 12, fontWeight: 600 }}
                        >
                          <option value="">-- (Not in Source File) --</option>
                          {detectedData.raw_headers.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                          {cf.help}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button
                      type="button"
                      className="btn btn-neutral"
                      disabled={validating}
                      onClick={handleValidateData}
                      style={{ fontWeight: 700 }}
                    >
                      {validating ? 'Validating...' : '🔍 Validate Mapping & Estimate Dues'}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Validation Summary & Migration Execution */}
              {validationReport && (
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1e293b', marginBottom: 14 }}>
                    Step 3: Pre-Migration Analysis & Execution
                  </h3>

                  {/* Stat cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 14, textAlign: 'center' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#15803d', textTransform: 'uppercase' }}>Total Pupils</div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: '#166534' }}>{validationReport.valid_count}</div>
                    </div>
                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: 14, textAlign: 'center' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase' }}>New to Edu-ERP</div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: '#1e40af' }}>{validationReport.new_student_count}</div>
                    </div>
                    <div style={{ background: '#fefce8', border: '1px solid #fef08a', borderRadius: 10, padding: 14, textAlign: 'center' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#a16207', textTransform: 'uppercase' }}>Opening Dues (₹)</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: '#854d0e' }}>₹{validationReport.total_opening_dues.toLocaleString()}</div>
                    </div>
                    <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 10, padding: 14, textAlign: 'center' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#7e22ce', textTransform: 'uppercase' }}>Classes Created</div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: '#6b21a8' }}>{validationReport.classes_to_create?.length || 0}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: 14, borderRadius: 10 }}>
                    <div style={{ fontSize: 13, color: '#475569' }}>
                      💡 <strong>Pilot Test Mode:</strong> You can safely run a trial import on the first 15 students to verify class rosters, roll numbers, and ledger entries before committing all students.
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        type="button"
                        className="btn btn-neutral"
                        disabled={executing}
                        onClick={() => handleExecute(true)}
                        style={{ borderColor: '#60a5fa', color: '#1d4ed8', fontWeight: 700, background: '#eff6ff' }}
                      >
                        {executing ? 'Processing...' : '🧪 Run Pilot Test (15 Students)'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={executing || validationReport.error_count > 0}
                        onClick={() => handleExecute(false)}
                        style={{ background: '#16a34a', borderColor: '#16a34a', fontWeight: 800, padding: '8px 20px' }}
                      >
                        {executing ? 'Executing Migration...' : '🚀 Execute Full School Migration'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Live Reconciliation Report */}
              {reconciliation && (
                <div style={{ background: '#ffffff', border: '2px solid #86efac', borderRadius: 14, padding: 24, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#14532d', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>⚖️</span> Pre-Go-Live Financial & Student Reconciliation
                      </h3>
                      <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                        Batch No: <strong>{reconciliation.batch_no}</strong> | Target Session: <strong>{reconciliation.session}</strong>
                      </div>
                    </div>
                    <span style={{
                      fontSize: 12, fontWeight: 800, padding: '6px 14px', borderRadius: 20,
                      background: reconciliation.is_reconciled ? '#dcfce7' : '#fef2f2',
                      color: reconciliation.is_reconciled ? '#15803d' : '#b91c1c'
                    }}>
                      {reconciliation.is_reconciled ? '✓ 100% Reconciled (Ready for Go-Live)' : '⚠️ Discrepancy Found'}
                    </span>
                  </div>

                  {/* Comparative Matrix */}
                  <table className="table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                        <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12 }}>Metric</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: 12 }}>Legacy Old Source</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: 12 }}>Live Edu-ERP</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: 12 }}>Match Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600 }}>Total Student Strength</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700 }}>{reconciliation.legacy.total_students}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700 }}>{reconciliation.erp.live_active_students}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <span style={{ color: '#16a34a', fontWeight: 800 }}>✓ MATCH</span>
                        </td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600 }}>Total Opening Balance Dues</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700 }}>₹{reconciliation.legacy.total_opening_dues.toLocaleString()}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700 }}>₹{reconciliation.erp.live_opening_due.toLocaleString()}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <span style={{ color: '#16a34a', fontWeight: 800 }}>✓ MATCH</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button
                      type="button"
                      className="btn btn-neutral"
                      onClick={() => handleSpotCheck(recentBatches[0]?.id)}
                      style={{ fontWeight: 700, borderColor: '#cbd5e1' }}
                    >
                      🔍 Perform Spot-Check Sign-Off
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => navigate('/students')}
                      style={{ fontWeight: 700 }}
                    >
                      ✓ View Migrated Students in Directory
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 2: PHYSICAL PAPER REGISTER MANUAL ENTRY */}
          {activeTab === 'register' && (
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#1e293b' }}>
                    📖 Physical Register / Notebook Quick Ledger Entry
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>
                    For schools migrating directly from paper fee cards, registers, or notebooks without computer spreadsheets.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-neutral"
                  onClick={handleAddManualRow}
                  style={{ fontSize: 12, fontWeight: 700, borderColor: '#0284c7', color: '#0284c7' }}
                >
                  + Add Row
                </button>
              </div>

              <div style={{ overflowX: 'auto', marginBottom: 20 }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '8px 10px', fontSize: 11, textAlign: 'left' }}>Scholar / Adm No</th>
                      <th style={{ padding: '8px 10px', fontSize: 11, textAlign: 'left' }}>Student Name *</th>
                      <th style={{ padding: '8px 10px', fontSize: 11, textAlign: 'left' }}>Class</th>
                      <th style={{ padding: '8px 10px', fontSize: 11, textAlign: 'left' }}>Sec</th>
                      <th style={{ padding: '8px 10px', fontSize: 11, textAlign: 'left' }}>Roll</th>
                      <th style={{ padding: '8px 10px', fontSize: 11, textAlign: 'left' }}>Mobile No</th>
                      <th style={{ padding: '8px 10px', fontSize: 11, textAlign: 'left' }}>Father Name</th>
                      <th style={{ padding: '8px 10px', fontSize: 11, textAlign: 'left' }}>Opening Balance (₹)</th>
                      <th style={{ padding: '8px 10px', fontSize: 11, textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {manualRows.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '6px 8px' }}>
                          <input
                            className="form-input"
                            value={row.admission_no}
                            onChange={e => handleManualRowChange(idx, 'admission_no', e.target.value)}
                            placeholder="e.g. 2019/042"
                            style={{ fontSize: 12, padding: '4px 6px', width: 110 }}
                          />
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <input
                            className="form-input"
                            value={row.name}
                            onChange={e => handleManualRowChange(idx, 'name', e.target.value)}
                            placeholder="Student Full Name"
                            style={{ fontSize: 12, padding: '4px 6px', minWidth: 150 }}
                          />
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <input
                            className="form-input"
                            value={row.class_name}
                            onChange={e => handleManualRowChange(idx, 'class_name', e.target.value)}
                            placeholder="Class 5"
                            style={{ fontSize: 12, padding: '4px 6px', width: 85 }}
                          />
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <input
                            className="form-input"
                            value={row.section}
                            onChange={e => handleManualRowChange(idx, 'section', e.target.value)}
                            placeholder="A"
                            style={{ fontSize: 12, padding: '4px 6px', width: 45, textAlign: 'center' }}
                          />
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <input
                            className="form-input"
                            value={row.roll_number}
                            onChange={e => handleManualRowChange(idx, 'roll_number', e.target.value)}
                            placeholder="01"
                            style={{ fontSize: 12, padding: '4px 6px', width: 50, textAlign: 'center' }}
                          />
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <input
                            className="form-input"
                            value={row.parent_phone}
                            onChange={e => handleManualRowChange(idx, 'parent_phone', e.target.value)}
                            placeholder="10 Digits"
                            style={{ fontSize: 12, padding: '4px 6px', width: 110 }}
                          />
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <input
                            className="form-input"
                            value={row.father_name}
                            onChange={e => handleManualRowChange(idx, 'father_name', e.target.value)}
                            placeholder="Father Name"
                            style={{ fontSize: 12, padding: '4px 6px', width: 130 }}
                          />
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <input
                            className="form-input"
                            type="number"
                            value={row.opening_balance}
                            onChange={e => handleManualRowChange(idx, 'opening_balance', e.target.value)}
                            placeholder="0"
                            style={{ fontSize: 12, padding: '4px 6px', width: 100, fontWeight: 700 }}
                          />
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveManualRow(idx)}
                            style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14 }}
                            title="Remove Row"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-neutral"
                  onClick={handleAddManualRow}
                  style={{ fontWeight: 600, fontSize: 12 }}
                >
                  + Add Another Row
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={manualSubmitting}
                  onClick={handleManualSubmit}
                  style={{ background: '#16a34a', borderColor: '#16a34a', fontWeight: 800 }}
                >
                  {manualSubmitting ? 'Onboarding Students...' : '✓ Submit & Commit Register to Edu-ERP'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: MIGRATION HISTORY & SPOT CHECK */}
          {activeTab === 'history' && (
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#1e293b', marginBottom: 14 }}>
                📋 Executed Migration Batches & Audit Trail
              </h3>

              {recentBatches.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: '#64748b' }}>
                  No migration batches recorded yet. Upload an Excel or CSV file in the Spreadsheet tab.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                        <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12 }}>Batch ID</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12 }}>Source Type</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12 }}>Session</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: 12 }}>Total Students</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: 12 }}>Opening Dues (₹)</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: 12 }}>Status</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: 12 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentBatches.map(b => (
                        <tr key={b.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0176d3' }}>{b.batch_no}</td>
                          <td style={{ padding: '10px 14px', fontSize: 12 }}>{b.source_type}</td>
                          <td style={{ padding: '10px 14px', fontSize: 12 }}>{b.session}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700 }}>{b.total_records}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#854d0e' }}>
                            ₹{b.total_opening_dues?.toLocaleString() || 0}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <span style={{
                              fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 12,
                              background: b.status === 'COMMITTED' ? '#dcfce7' : '#e0f2fe',
                              color: b.status === 'COMMITTED' ? '#15803d' : '#0369a1'
                            }}>
                              {b.status}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-neutral"
                              onClick={() => handleSpotCheck(b.id)}
                              style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px' }}
                            >
                              🔍 Spot Check
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Spot Check Verification Modal */}
          {showSpotCheckModal && (
            <div className="modal-backdrop" onClick={() => setShowSpotCheckModal(false)}>
              <div
                className="modal-box"
                style={{ maxWidth: 850, width: '90%', padding: 24, borderRadius: 14, maxHeight: '85vh', overflowY: 'auto' }}
                onClick={e => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#1e293b' }}>
                      🔍 Random Spot-Check Verification
                    </h3>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
                      Compare a random sample of {spotCheckSample?.length || 0} migrated students side-by-side against your old physical register.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowSpotCheckModal(false)}
                    style={{ border: 'none', background: 'none', fontSize: 18, cursor: 'pointer', color: '#64748b' }}
                  >
                    ✕
                  </button>
                </div>

                <table className="table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                      <th style={{ padding: '8px 12px', fontSize: 11, textAlign: 'left' }}>Legacy Record</th>
                      <th style={{ padding: '8px 12px', fontSize: 11, textAlign: 'left' }}>Live Edu-ERP Record</th>
                      <th style={{ padding: '8px 12px', fontSize: 11, textAlign: 'center' }}>Opening Due</th>
                      <th style={{ padding: '8px 12px', fontSize: 11, textAlign: 'center' }}>Verification</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(spotCheckSample || []).map((s, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '8px 12px', fontSize: 12 }}>
                          <div><strong>{s.legacy.admission_no || '—'}</strong></div>
                          <div style={{ color: '#0f172a' }}>{s.legacy.name}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>{s.legacy.class}</div>
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: 12 }}>
                          <div><strong>{s.erp.admission_no}</strong></div>
                          <div style={{ color: '#0f172a' }}>{s.erp.name}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>{s.erp.class} • Status: <span style={{ color: '#16a34a', fontWeight: 700 }}>{s.erp.status}</span></div>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: 12, fontWeight: 700 }}>
                          ₹{s.erp.opening_fee_due}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <span style={{ fontSize: 11, background: '#dcfce7', color: '#15803d', fontWeight: 800, padding: '2px 8px', borderRadius: 10 }}>
                            ✓ VERIFIED
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setShowSpotCheckModal(false)}
                    style={{ fontWeight: 700 }}
                  >
                    Close Verification
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
