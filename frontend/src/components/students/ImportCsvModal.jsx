import React, { useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function ImportCsvModal({ isOpen, onClose, onSuccess, sessions = [] }) {
  const [file, setFile] = useState(null);
  const [session, setSession] = useState(sessions[0] || '2024-25');
  const [validationData, setValidationData] = useState(null);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);

  if (!isOpen) return null;

  async function handleValidateFile() {
    if (!file) {
      toast.error('Please select a CSV file to validate');
      return;
    }
    setValidating(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('session', session);

      const res = await api.post('/principal/students/import/validate', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setValidationData(res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Validation failed');
    }
    setValidating(false);
  }

  async function handleConfirmImport() {
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('session', session);

      const res = await api.post('/principal/students/import/confirm', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(res.data.message || 'Students imported successfully!');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Import failed');
    }
    setImporting(false);
  }

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
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && !importing && onClose()}>
      <div className="modal" style={{ maxWidth: 720, width: '95%' }}>
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>📥</span> Import Students via CSV
            </h3>
            <span style={{ fontSize: 12, color: 'var(--neutral-5)' }}>
              Intelligent importer that detects existing students by admission number and re-enrolls without duplicates
            </span>
          </div>
          <button className="modal-close" disabled={importing} onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Controls */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Academic Session *</label>
              <input
                className="form-input"
                value={session}
                onChange={e => { setSession(e.target.value); setValidationData(null); }}
                placeholder="2024-25"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Sample CSV Template</label>
              <button
                type="button"
                className="btn btn-neutral"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={downloadSampleCsv}
              >
                📄 Download Sample CSV
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Choose CSV File *</label>
            <input
              type="file"
              accept=".csv"
              className="form-input"
              onChange={e => { setFile(e.target.files?.[0] || null); setValidationData(null); }}
            />
          </div>

          {!validationData && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!file || validating}
                onClick={handleValidateFile}
              >
                {validating ? 'Validating CSV...' : 'Validate CSV File →'}
              </button>
            </div>
          )}

          {/* Validation Report */}
          {validationData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: '2px solid #e2e8f0', paddingTop: 14 }}>
              <h4 style={{ margin: 0, fontSize: 14 }}>📊 CSV Validation Report</h4>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                <div style={{ background: '#f8fafc', padding: 10, borderRadius: 8, textAlign: 'center', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{validationData.total_rows}</div>
                  <div style={{ fontSize: 11, color: 'var(--neutral-5)' }}>Total Rows</div>
                </div>
                <div style={{ background: '#dcfce7', padding: 10, borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#15803d' }}>{validationData.valid_rows}</div>
                  <div style={{ fontSize: 11, color: '#166534', fontWeight: 700 }}>Valid</div>
                </div>
                <div style={{ background: '#e0e7ff', padding: 10, borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#3730a3' }}>{validationData.existing_student_matches}</div>
                  <div style={{ fontSize: 11, color: '#4338ca', fontWeight: 700 }}>Existing Matches</div>
                </div>
                <div style={{ background: '#f3e8ff', padding: 10, borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#7c3aed' }}>{validationData.new_student_creations}</div>
                  <div style={{ fontSize: 11, color: '#6b21a8', fontWeight: 700 }}>New Admissions</div>
                </div>
              </div>

              {validationData.existing_student_matches > 0 && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#1e40af' }}>
                  ✨ <strong>{validationData.existing_student_matches} existing students matched:</strong> Permanent master profiles will be reused automatically. New enrollment records will be added for session <strong>{session}</strong>.
                </div>
              )}

              {validationData.errors && validationData.errors.length > 0 && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', marginBottom: 4 }}>
                    ⚠️ {validationData.errors.length} Rows with Issues:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#991b1b', maxHeight: 120, overflowY: 'auto' }}>
                    {validationData.errors.map((err, idx) => (
                      <li key={idx}>Row {err.row}: {err.reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="btn btn-neutral" disabled={importing} onClick={onClose}>
            Cancel
          </button>
          {validationData && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={importing || validationData.valid_rows === 0}
              onClick={handleConfirmImport}
              style={{ background: '#15803d', borderColor: '#15803d' }}
            >
              {importing ? 'Importing Students...' : `Confirm & Import ${validationData.valid_rows} Students`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
