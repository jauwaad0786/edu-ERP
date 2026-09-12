import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function StudentImportPage() {
  const navigate = useNavigate();

  const [sessions, setSessions] = useState([]);
  const [session, setSession] = useState('');
  const [file, setFile] = useState(null);
  const [validationData, setValidationData] = useState(null);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    api.get('/principal/students/sessions')
      .then(r => {
        const sess = r.data.sessions || [];
        setSessions(sess);
        if (sess.length > 0) setSession(sess[0]);
        else setSession('2024-25');
      })
      .catch(() => setSession('2024-25'));
  }, []);

  function downloadSampleCsv() {
    const headers = 'admission_no,name,class_name,section,roll_number,gender,dob,father_name,mother_name,parent_phone,parent_email,stream,house,address\n';
    const row1 = 'ADM2024001,John Doe,Class 6,A,01,Male,2012-05-14,Robert Doe,Sarah Doe,+91-9876543210,parent@example.com,General,Red Tigers,123 School Road\n';
    const row2 = 'ADM2024002,Jane Smith,Class 6,B,02,Female,2012-08-20,David Smith,Mary Smith,+91-9876543211,smith@example.com,General,Blue Whales,456 Oak Street\n';
    const blob = new Blob([headers + row1 + row2], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_students_import.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    toast.success('Sample CSV template downloaded!');
  }

  async function handleValidateFile() {
    if (!file) {
      toast.error('Please choose a CSV file to validate');
      return;
    }
    setValidating(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('session', session || '2024-25');

      const res = await api.post('/principal/students/import/validate', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setValidationData(res.data);
      toast.success('CSV validation complete');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Validation failed. Check CSV columns.');
    }
    setValidating(false);
  }

  async function handleConfirmImport() {
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('session', session || '2024-25');

      const res = await api.post('/principal/students/import/confirm', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(res.data.message || 'Students imported successfully!');
      setFile(null);
      setValidationData(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Import execution failed');
    }
    setImporting(false);
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Bulk Student Import (CSV)" />
        <div className="page-body">

          {/* Breadcrumb & Title */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#64748b', marginBottom: 4 }}>
                <span style={{ cursor: 'pointer', color: '#0176d3' }} onClick={() => navigate('/students')}>Student Management</span>
                <span>/</span>
                <span style={{ fontWeight: 600, color: '#1e293b' }}>Bulk Import CSV</span>
              </div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span>📥</span> Bulk Student Import via CSV
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                Quickly onboard batches of students with automated duplicate detection, parent account creation, and class-section assignment.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn-neutral"
                onClick={() => navigate('/students')}
                style={{ fontSize: 13 }}
              >
                ← Back to Students
              </button>
            </div>
          </div>

          {/* Configuration & File Upload Card */}
          <div style={{
            background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12,
            padding: 24, maxWidth: 920, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                  Target Academic Session *
                </label>
                <input
                  className="form-input"
                  value={session}
                  onChange={e => { setSession(e.target.value); setValidationData(null); }}
                  placeholder="e.g. 2024-25"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                  CSV Template
                </label>
                <button
                  type="button"
                  className="btn btn-neutral"
                  onClick={downloadSampleCsv}
                  style={{ width: '100%', fontWeight: 600, color: '#0176d3', borderColor: '#bae6fd', background: '#f0f9ff' }}
                >
                  📄 Download Standard Sample Template
                </button>
              </div>
            </div>

            {/* Drag & Drop File Zone */}
            <div style={{
              border: '2px dashed #cbd5e1', borderRadius: 10, padding: '32px 20px',
              textAlign: 'center', background: '#f8fafc', marginBottom: 18, cursor: 'pointer'
            }}>
              <input
                type="file"
                accept=".csv,text/csv"
                id="csvFileInput"
                style={{ display: 'none' }}
                onChange={e => {
                  if (e.target.files && e.target.files[0]) {
                    setFile(e.target.files[0]);
                    setValidationData(null);
                  }
                }}
              />
              <label htmlFor="csvFileInput" style={{ cursor: 'pointer' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>
                  {file ? `Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)` : 'Click to Browse or Drag CSV File Here'}
                </div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  Supported format: <code>.csv</code> with standard headers (Admission No, Name, Class, Section, etc.)
                </div>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!file || validating}
                onClick={handleValidateFile}
                style={{ minWidth: 180, fontWeight: 700 }}
              >
                {validating ? 'Validating CSV...' : '🔍 Parse & Validate File'}
              </button>
            </div>
          </div>

          {/* Validation Preview Card */}
          {validationData && (
            <div style={{
              background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12,
              padding: 24, maxWidth: 920, boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#1e293b' }}>
                    CSV Validation Report
                  </h3>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    Total Records: <strong>{validationData.total_rows ?? validationData.rows?.length ?? 0}</strong> |
                    New Students: <strong style={{ color: '#16a34a' }}>{validationData.new_count ?? 0}</strong> |
                    Existing Rollover: <strong style={{ color: '#0284c7' }}>{validationData.existing_count ?? 0}</strong> |
                    Errors: <strong style={{ color: '#dc2626' }}>{validationData.error_count ?? 0}</strong>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={importing || validationData.error_count > 0}
                  onClick={handleConfirmImport}
                  style={{ background: '#16a34a', borderColor: '#16a34a', fontWeight: 700, minWidth: 200 }}
                >
                  {importing ? 'Importing Students...' : '✓ Confirm & Import Students'}
                </button>
              </div>

              {/* Errors alert if any */}
              {validationData.errors && validationData.errors.length > 0 && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 12, marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#991b1b', marginBottom: 4 }}>
                    ⚠️ Fix the following issues in the CSV before importing:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: '#b91c1c' }}>
                    {validationData.errors.map((err, i) => (
                      <li key={i}>{typeof err === 'string' ? err : `${err.row ? `Row ${err.row}: ` : ''}${err.message || JSON.stringify(err)}`}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Sample preview rows */}
              {validationData.rows && validationData.rows.length > 0 && (
                <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                  <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                        <th style={{ padding: '8px 12px', fontSize: 12, textAlign: 'left' }}>Admission No</th>
                        <th style={{ padding: '8px 12px', fontSize: 12, textAlign: 'left' }}>Student Name</th>
                        <th style={{ padding: '8px 12px', fontSize: 12, textAlign: 'left' }}>Class & Section</th>
                        <th style={{ padding: '8px 12px', fontSize: 12, textAlign: 'center' }}>Gender</th>
                        <th style={{ padding: '8px 12px', fontSize: 12, textAlign: 'left' }}>Parent Name</th>
                        <th style={{ padding: '8px 12px', fontSize: 12, textAlign: 'center' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validationData.rows.slice(0, 15).map((r, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600 }}>{r.admission_no || r.admission_number || '—'}</td>
                          <td style={{ padding: '8px 12px', fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{r.name || `${r.first_name || ''} ${r.last_name || ''}`}</td>
                          <td style={{ padding: '8px 12px', fontSize: 12 }}>{r.class_name} {r.section}</td>
                          <td style={{ padding: '8px 12px', fontSize: 12, textAlign: 'center' }}>{r.gender || '—'}</td>
                          <td style={{ padding: '8px 12px', fontSize: 12 }}>{r.father_name || r.parent_name || '—'}</td>
                          <td style={{ padding: '8px 12px', fontSize: 12, textAlign: 'center' }}>
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                              background: r.is_existing ? '#eff6ff' : '#f0fdf4',
                              color: r.is_existing ? '#1d4ed8' : '#15803d'
                            }}>
                              {r.is_existing ? 'EXISTING' : 'NEW ADMISSION'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {validationData.rows.length > 15 && (
                    <div style={{ padding: '8px 14px', fontSize: 12, color: '#64748b', textAlign: 'center', background: '#f8fafc' }}>
                      Showing preview of first 15 records ({validationData.rows.length - 15} more records will be processed).
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
