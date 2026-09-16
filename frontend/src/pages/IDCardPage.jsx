import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { resolveTenantPath } from '../utils/routeBuilder';

// ── ID Card Live Preview ──────────────────────────────────────────────────────
function IDCardPreview({ student, school, type = 'student' }) {
  if (!student) return null;
  const s = student || {};
  const sname = school || {};

  if (type === 'employee') {
    return (
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
        {/* EMPLOYEE FRONT */}
        <div style={{ width: 200 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textAlign: 'center', marginBottom: 6, letterSpacing: 1 }}>FRONT SIDE</div>
          <div style={{
            width: 200, borderRadius: 10,
            boxShadow: '0 8px 24px rgba(3,45,96,0.18)',
            overflow: 'hidden', border: '1.5px solid #bae6fd',
            fontFamily: 'Arial, sans-serif', background: '#fff',
          }}>
            <div style={{ background: 'linear-gradient(135deg,#032d60,#0176d3)', padding: '10px 10px 0', display: 'flex', alignItems: 'center', gap: 7 }}>
              {sname.logo_url
                ? <img src={sname.logo_url} alt="logo" style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'contain', background: '#fff', padding: 2 }} />
                : <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#fff', flexShrink: 0 }}>EDU</div>
              }
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: 8.5, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textTransform: 'uppercase' }}>{sname.name || 'School Name'}</div>
                <div style={{ fontSize: 6.5, color: '#93c5fd', marginTop: 1 }}>{sname.city || ''}</div>
              </div>
              <div style={{ fontSize: 5.5, fontWeight: 800, color: '#fbbf24', textAlign: 'right', lineHeight: 1.2 }}>EMPLOYEE<br/>ID CARD</div>
            </div>
            <div style={{ height: 3, background: 'linear-gradient(90deg,#f0a500,#fbbf24)' }} />
            <div style={{ padding: '10px 10px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#e8f4fd', border: '2.5px solid #0176d3', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                {s.photo_url
                  ? <img src={s.photo_url} alt="photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: 20, color: '#0176d3' }}>👤</span>
                }
              </div>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#032d60', textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'center' }}>{s.name || 'Employee Name'}</div>
              <div style={{ fontSize: 7, color: '#0176d3', fontWeight: 700, marginTop: 2 }}>{s.designation || 'Designation'}</div>
            </div>
            <div style={{ height: 1, background: '#e0e9ff', margin: '0 10px' }} />
            <div style={{ padding: '7px 10px 8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 4px' }}>
              {[
                ['Emp. ID',    s.employee_id  || '—'],
                ['Dept.',      (s.department  || '—').slice(0,12)],
                ['Joining',    (s.joining_date|| '—').slice(0,10)],
                ['Mobile',     s.phone        || '—'],
              ].map(function([label, val]) {
                return (
                  <div key={label}>
                    <div style={{ fontSize: 5.5, color: '#94a3b8', fontWeight: 600 }}>{label}</div>
                    <div style={{ fontSize: 6.5, color: '#0f172a', fontWeight: 700, lineHeight: 1.2 }}>{val}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ background: '#032d60', padding: '4px 8px', fontSize: 5.5, color: '#93c5fd', textAlign: 'center' }}>
              {sname.name || ''} &nbsp;|&nbsp; {sname.phone || ''}
            </div>
          </div>
        </div>
        {/* EMPLOYEE BACK — same QR layout */}
        <div style={{ width: 200 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textAlign: 'center', marginBottom: 6, letterSpacing: 1 }}>BACK SIDE</div>
          <div style={{ width: 200, borderRadius: 10, boxShadow: '0 8px 24px rgba(3,45,96,0.18)', overflow: 'hidden', border: '1.5px solid #bae6fd', fontFamily: 'Arial, sans-serif', background: '#fff' }}>
            <div style={{ background: 'linear-gradient(135deg,#032d60,#0176d3)', padding: '8px 10px' }}>
              <div style={{ fontSize: 8, fontWeight: 800, color: '#fff', textAlign: 'center' }}>EMPLOYEE IDENTITY CARD</div>
              <div style={{ fontSize: 6, color: '#93c5fd', textAlign: 'center', marginTop: 1 }}>{sname.name || ''}</div>
            </div>
            <div style={{ height: 2, background: 'linear-gradient(90deg,#f0a500,#fbbf24)' }} />
            <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
              <div style={{ width: 55, height: 55, background: '#f1f5f9', border: '1.5px solid #bae6fd', borderRadius: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                <div style={{ fontSize: 18 }}>⬛</div>
                <div style={{ fontSize: 5.5, color: '#64748b', fontWeight: 600 }}>QR CODE</div>
              </div>
            </div>
            <div style={{ fontSize: 6, fontWeight: 700, color: '#0176d3', textAlign: 'center', marginBottom: 6 }}>SCAN TO VERIFY</div>
            <div style={{ margin: '0 8px 6px', background: '#f1f5f9', borderRadius: 4, padding: '5px 7px', fontSize: 5.5, color: '#475569' }}>
              <div style={{ fontWeight: 700, color: '#032d60', fontSize: 6 }}>{sname.name || ''}</div>
              <div>Ph: {sname.phone || ''}</div>
            </div>
            <div style={{ margin: '0 8px 6px' }}>
              <div style={{ fontSize: 5.5, fontWeight: 800, color: '#0176d3', marginBottom: 3 }}>TERMS &amp; CONDITIONS</div>
              {['Card must be carried at all times.','Lost card must be reported immediately.','This card is property of the school.'].map((t, i) => (
                <div key={i} style={{ fontSize: 5, color: '#475569', marginBottom: 1.5 }}>• {t}</div>
              ))}
            </div>
            <div style={{ background: '#032d60', padding: '4px 8px', fontSize: 5.5, color: '#fbbf24', textAlign: 'center', fontWeight: 700 }}>
              Valid: {s.session || new Date().getFullYear()}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── STUDENT CARD ──
  return (
    <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
      {/* FRONT */}
      <div style={{ width: 200 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textAlign: 'center', marginBottom: 6, letterSpacing: 1 }}>FRONT SIDE</div>
        <div style={{
          width: 200, borderRadius: 10,
          boxShadow: '0 8px 24px rgba(1,118,211,0.18)',
          overflow: 'hidden', border: '1.5px solid #bae6fd',
          fontFamily: 'Arial, sans-serif', background: '#fff',
        }}>
          <div style={{ background: 'linear-gradient(135deg,#032d60,#0176d3)', padding: '10px 10px 0', display: 'flex', alignItems: 'center', gap: 7 }}>
            {sname.logo_url
              ? <img src={sname.logo_url} alt="logo" style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'contain', background: '#fff', padding: 2 }} />
              : <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#fff', flexShrink: 0 }}>EDU</div>
            }
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: 8.5, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textTransform: 'uppercase' }}>{sname.name || 'School Name'}</div>
              <div style={{ fontSize: 6.5, color: '#93c5fd', marginTop: 1 }}>{sname.city || ''}</div>
            </div>
            <div style={{ fontSize: 5.5, fontWeight: 800, color: '#fbbf24', textAlign: 'right', lineHeight: 1.2 }}>STUDENT<br/>ID CARD</div>
          </div>
          <div style={{ height: 3, background: 'linear-gradient(90deg,#f0a500,#fbbf24)' }} />
          <div style={{ padding: '10px 10px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#e8f4fd', border: '2.5px solid #0176d3', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
              {s.photo_url
                ? <img src={s.photo_url} alt="photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 20, color: '#0176d3' }}>👤</span>
              }
            </div>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#032d60', textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'center', lineHeight: 1.2, maxWidth: 170, wordBreak: 'break-word' }}>
              {s.name || 'Student Name'}
            </div>
          </div>
          <div style={{ height: 1, background: '#e0e9ff', margin: '0 10px' }} />
          {/* Info Grid — NO Adm. No., neat 2-col layout */}
          <div style={{ padding: '7px 10px 8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 6px' }}>
            {[
              ['Roll No.',  s.roll_number  || '—'],
              ['Blood Gr.', s.blood_group  || '—'],
              ['Father',    (s.father_name || '—').slice(0,14)],
              ['Class',     (s.class_name  || '—').slice(0,12)],
              ['Mobile',    s.parent_phone || '—'],
              ['Session',   s.session      || '—'],
              ['DOB',       (s.dob         || '—').slice(0,10)],
              ['Gender',    s.gender       || '—'],
            ].map(function([label, val]) {
              return (
                <div key={label} style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 5.5, color: '#94a3b8', fontWeight: 600, lineHeight: 1.2 }}>{label}</div>
                  <div style={{ fontSize: 6.5, color: '#0f172a', fontWeight: 700, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val}</div>
                </div>
              );
            })}
          </div>
          <div style={{ background: '#032d60', padding: '4px 8px', fontSize: 5.5, color: '#93c5fd', textAlign: 'center' }}>
            If found, return to school &nbsp;|&nbsp; {sname.phone || ''}
          </div>
        </div>
      </div>

      {/* BACK */}
      <div style={{ width: 200 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textAlign: 'center', marginBottom: 6, letterSpacing: 1 }}>BACK SIDE</div>
        <div style={{ width: 200, borderRadius: 10, boxShadow: '0 8px 24px rgba(1,118,211,0.18)', overflow: 'hidden', border: '1.5px solid #bae6fd', fontFamily: 'Arial, sans-serif', background: '#fff' }}>
          <div style={{ background: 'linear-gradient(135deg,#032d60,#0176d3)', padding: '8px 10px' }}>
            <div style={{ fontSize: 8, fontWeight: 800, color: '#fff', textAlign: 'center' }}>STUDENT IDENTITY CARD</div>
            <div style={{ fontSize: 6, color: '#93c5fd', textAlign: 'center', marginTop: 1 }}>{sname.name || ''}</div>
          </div>
          <div style={{ height: 2, background: 'linear-gradient(90deg,#f0a500,#fbbf24)' }} />
          <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
            <div style={{ width: 55, height: 55, background: '#f1f5f9', border: '1.5px solid #bae6fd', borderRadius: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              <div style={{ fontSize: 18 }}>⬛</div>
              <div style={{ fontSize: 5.5, color: '#64748b', fontWeight: 600 }}>QR CODE</div>
            </div>
          </div>
          <div style={{ fontSize: 6, fontWeight: 700, color: '#0176d3', textAlign: 'center', marginBottom: 6 }}>SCAN TO VERIFY</div>
          <div style={{ margin: '0 8px 6px', background: '#f1f5f9', borderRadius: 4, padding: '5px 7px', fontSize: 5.5, color: '#475569' }}>
            <div style={{ fontWeight: 700, color: '#032d60', fontSize: 6 }}>{sname.name || ''}</div>
            <div>{sname.address || sname.city || ''}</div>
            <div>Ph: {sname.phone || ''}</div>
          </div>
          <div style={{ margin: '0 8px 6px' }}>
            <div style={{ fontSize: 5.5, fontWeight: 800, color: '#0176d3', marginBottom: 3 }}>TERMS &amp; CONDITIONS</div>
            {['Card must be carried at all times.','Lost card must be reported immediately.','This card is property of the school.','Misuse will lead to disciplinary action.'].map((t, i) => (
              <div key={i} style={{ fontSize: 5, color: '#475569', marginBottom: 1.5 }}>• {t}</div>
            ))}
          </div>
          <div style={{ margin: '0 8px', borderTop: '0.5px solid #cbd5e1', paddingTop: 4, paddingBottom: 4 }}>
            <div style={{ width: 50, borderBottom: '0.5px solid #94a3b8', marginBottom: 2 }} />
            <div style={{ fontSize: 5.5, fontWeight: 700, color: '#032d60' }}>Principal Signature</div>
          </div>
          <div style={{ background: '#032d60', padding: '4px 8px', fontSize: 5.5, color: '#fbbf24', textAlign: 'center', fontWeight: 700 }}>
            Valid For Session: {s.session || '2024-25'}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Edit Modal ────────────────────────────────────────────────────────────────
function EditStudentModal({ student, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:         student.name         || '',
    roll_number:  student.roll_number  || '',
    father_name:  student.father_name  || '',
    parent_phone: student.parent_phone || '',
    blood_group:  student.blood_group  || '',
    gender:       student.gender       || '',
    dob:          student.dob          || '',
    session:      student.session      || '',
  });
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(student.photo_url || null);

  async function save() {
    setSaving(true);
    try {
      await api.patch('/principal/students/' + student.id, form);
      toast.success('Student updated!');
      onSaved();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Save nahi hua');
    }
    setSaving(false);
  }

  async function uploadPhoto(file) {
    setPhotoUploading(true);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const res = await api.post('/principal/students/' + student.id + '/photo', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setPhotoUrl(res.data.photo_url);
      toast.success('Photo upload ho gayi!');
    } catch { toast.error('Photo upload nahi hui'); }
    setPhotoUploading(false);
  }

  async function deletePhoto() {
    try {
      await api.delete('/principal/students/' + student.id + '/photo');
      setPhotoUrl(null);
      toast.success('Photo delete ho gayi');
    } catch { toast.error('Photo delete nahi hui'); }
  }

  function f(field, val) { setForm(p => ({ ...p, [field]: val })); }

  return (
    <div
      role="button"
      tabIndex={0}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={e => e.key === 'Escape' && onClose()}
      aria-label="Close edit student modal"
    >
      <div style={{ background: '#fff', borderRadius: 16, padding: '28px 28px', width: 480, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>✏️ Edit Student</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#94a3b8' }}>✕</button>
        </div>

        {/* Photo Section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, padding: '12px 14px', background: '#f8faff', borderRadius: 10 }}>
          <div style={{ width: 64, height: 72, borderRadius: 8, overflow: 'hidden', background: '#e8f4fd', border: '2px solid #0176d3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {photoUrl
              ? <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 28, color: '#0176d3' }}>👤</span>
            }
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#032d60', marginBottom: 8 }}>Student Photo</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, background: '#e8f4fd', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#0176d3' }}>
                📷 {photoUrl ? 'Change' : 'Upload'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files[0] && uploadPhoto(e.target.files[0])} />
              </label>
              {photoUrl && (
                <button onClick={deletePhoto} style={{ background: '#fef1ee', border: 'none', color: '#dc2626', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>🗑 Delete</button>
              )}
              {photoUploading && <span style={{ fontSize: 11, color: '#94a3b8', alignSelf: 'center' }}>Uploading...</span>}
            </div>
          </div>
        </div>

        {/* Form Fields */}
        {[
          { label: 'Full Name', key: 'name' },
          { label: 'Roll Number', key: 'roll_number' },
          { label: 'Father Name', key: 'father_name' },
          { label: 'Mobile (Parent)', key: 'parent_phone' },
          { label: 'Blood Group', key: 'blood_group' },
          { label: 'Gender', key: 'gender' },
          { label: 'Date of Birth', key: 'dob', type: 'date' },
          { label: 'Session', key: 'session' },
        ].map(({ label, key, type }) => (
          <div key={key} style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>{label}</label>
            <input
              type={type || 'text'}
              value={form[key]}
              onChange={e => f(key, e.target.value)}
              style={{ width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 8, boxSizing: 'border-box', outline: 'none' }}
              onFocus={e => e.target.style.borderColor = '#0176d3'}
              onBlur={e => e.target.style.borderColor = '#e2e8f0'}
            />
          </div>
        ))}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#475569' }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#0176d3', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            {saving ? '⏳ Saving...' : '✅ Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Employee Edit Modal ───────────────────────────────────────────────────────
function EditEmployeeModal({ employee, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:        employee.name        || '',
    employee_id: employee.employee_id || '',
    department:  employee.department  || '',
    designation: employee.designation || '',
    phone:       employee.phone       || '',
    joining_date:employee.joining_date|| '',
  });
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(employee.photo_url || null);

  async function save() {
    setSaving(true);
    try {
      await api.patch('/principal/teachers/' + employee.id, form);
      toast.success('Employee updated!');
      onSaved();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Save nahi hua');
    }
    setSaving(false);
  }

  async function uploadPhoto(file) {
    setPhotoUploading(true);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const res = await api.post('/principal/teachers/' + employee.id + '/photo', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setPhotoUrl(res.data.photo_url);
      toast.success('Photo upload ho gayi!');
    } catch { toast.error('Photo upload nahi hui'); }
    setPhotoUploading(false);
  }

  async function deletePhoto() {
    try {
      await api.delete('/principal/teachers/' + employee.id + '/photo');
      setPhotoUrl(null);
      toast.success('Photo delete ho gayi');
    } catch { toast.error('Photo delete nahi hui'); }
  }

  function f(field, val) { setForm(p => ({ ...p, [field]: val })); }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '28px 28px', width: 480, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>✏️ Edit Employee</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#94a3b8' }}>✕</button>
        </div>
        {/* Photo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, padding: '12px 14px', background: '#f8faff', borderRadius: 10 }}>
          <div style={{ width: 64, height: 72, borderRadius: 8, overflow: 'hidden', background: '#e8f4fd', border: '2px solid #0176d3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {photoUrl
              ? <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 28, color: '#0176d3' }}>👤</span>
            }
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#032d60', marginBottom: 8 }}>Employee Photo</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, background: '#e8f4fd', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#0176d3' }}>
                📷 {photoUrl ? 'Change' : 'Upload'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files[0] && uploadPhoto(e.target.files[0])} />
              </label>
              {photoUrl && (
                <button onClick={deletePhoto} style={{ background: '#fef1ee', border: 'none', color: '#dc2626', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>🗑 Delete</button>
              )}
              {photoUploading && <span style={{ fontSize: 11, color: '#94a3b8', alignSelf: 'center' }}>Uploading...</span>}
            </div>
          </div>
        </div>
        {[
          { label: 'Full Name', key: 'name' },
          { label: 'Employee ID', key: 'employee_id' },
          { label: 'Department', key: 'department' },
          { label: 'Designation', key: 'designation' },
          { label: 'Mobile', key: 'phone' },
          { label: 'Joining Date', key: 'joining_date', type: 'date' },
        ].map(({ label, key, type }) => (
          <div key={key} style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>{label}</label>
            <input
              type={type || 'text'}
              value={form[key]}
              onChange={e => f(key, e.target.value)}
              style={{ width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 8, boxSizing: 'border-box', outline: 'none' }}
              onFocus={e => e.target.style.borderColor = '#0176d3'}
              onBlur={e => e.target.style.borderColor = '#e2e8f0'}
            />
          </div>
        ))}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#475569' }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#0176d3', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            {saving ? '⏳ Saving...' : '✅ Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function IDCardPage() {
  const { type = 'students' } = useParams();      // 'students' | 'employees'
  const navigate = useNavigate();
  const isEmployee = type === 'employees';
  const isStaff    = type === 'staff';

  const [classes,     setClasses]     = useState([]);
  const [items,       setItems]       = useState([]);   // students or employees
  const [selClass,    setSelClass]    = useState('');
  const [selId,       setSelId]       = useState('');
  const [preview,     setPreview]     = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [search,      setSearch]      = useState('');
  const [editTarget,  setEditTarget]  = useState(null);  // student/employee object for edit modal
  const [deleteConfirm, setDeleteConfirm] = useState(null); // id to delete

  // Load classes
  useEffect(function() {
    api.get('/principal/classes').then(function(r) {
      var raw = r.data;
      var clsList = Array.isArray(raw) ? raw : (raw.data || []);
      setClasses(clsList);
      if (clsList.length > 0 && !selClass && !isEmployee && !isStaff) {
        setSelClass(clsList[0].id);
      }
    }).catch(function() {});
  }, [isEmployee, isStaff]);

  // Load items (students or employees)
  // Load items (students or employees or staff)
  useEffect(function() {
    if (isStaff) {
      setLoading(true);
      api.get('/principal/staff-list').then(function(r) {
        setItems(Array.isArray(r.data) ? r.data : []);
        setSelId('');
        setPreview(null);
      }).catch(function() {
        toast.error('Staff load nahi hue');
      }).finally(function() { setLoading(false); });
      return;
    }
    if (isEmployee) {
      setLoading(true);
      api.get('/principal/teachers').then(function(r) {
        var raw = r.data;
        var list = Array.isArray(raw) ? raw : (raw.data || []);
        setItems(list);
        setSelId('');
        setPreview(null);
      }).catch(function() {
        toast.error('Employees load nahi hue');
      }).finally(function() { setLoading(false); });
    } else {
      if (!selClass) { setItems([]); setSelId(''); setPreview(null); return; }
      setLoading(true);
      api.get('/principal/students?class_id=' + selClass + '&per_page=100')
        .then(function(r) {
          var raw = r.data;
          var list = Array.isArray(raw) ? raw : (Array.isArray(raw.data) ? raw.data : []);
          setItems(list);
          setSelId('');
          setPreview(null);
        }).catch(function() { toast.error('Students load nahi hue'); })
        .finally(function() { setLoading(false); });
    }
  }, [selClass, isEmployee, isStaff]);

  // Load preview
  var loadPreview = useCallback(function(id, itemType) {
    if (!id) { setPreview(null); return; }
    if (itemType === 'staff') {
      Promise.all([
        api.get('/principal/staff-list'),
        api.get('/principal/school/settings'),
      ]).then(function(results) {
        var u = (results[0].data || []).find(function(x) { return String(x.id) === String(id); });
        setPreview({ student: { ...u, session: new Date().getFullYear() + '-' + (new Date().getFullYear()+1) }, school: results[1].data || {}, isEmployee: true });
      }).catch(function() { toast.error('Preview load nahi hua'); });
      return;
    }
    if (itemType === 'employee') {
      Promise.all([
        api.get('/principal/teachers/' + id + '/profile'),
        api.get('/principal/school/settings'),
      ]).then(function(results) {
        var info   = results[0].data.info || {};
        var school = results[1].data || {};
        setPreview({
          student: {
            id:           info.id,
            name:         info.name,
            employee_id:  info.employee_id,
            designation:  info.designation,
            department:   info.department,
            phone:        info.phone,
            joining_date: info.joining_date,
            photo_url:    info.photo_url,
            session:      new Date().getFullYear() + '-' + (new Date().getFullYear()+1),
          },
          school: school,
          isEmployee: true,
        });
      }).catch(function() { toast.error('Preview load nahi hua'); });
    } else {
      api.get('/principal/id-cards/preview/' + id).then(function(r) {
        setPreview({ ...r.data, isEmployee: false });
      }).catch(function() { toast.error('Preview load nahi hua'); });
    }
  }, []);

  // Download single
  function downloadSingle(id, name) {
    toast.loading('PDF ban raha hai...', { id: 'dl' });
    var endpoint = isEmployee
      ? '/principal/teachers/' + id + '/id-card'
      : '/principal/students/' + id + '/id-card';
    api.get(endpoint, { responseType: 'blob' }).then(function(r) {
      var url = window.URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      var link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'IDCard_' + (name || 'card').replace(/ /g, '_') + '.pdf');
      document.body.appendChild(link); link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('ID Card download ho gayi!', { id: 'dl' });
    }).catch(function() { toast.error('Download failed', { id: 'dl' }); });
  }

  // Bulk download
  function downloadBulk() {
    if (!isEmployee && !selClass) { toast.error('Pehle class select karo'); return; }
    setBulkLoading(true);
    toast.loading('ZIP ban raha hai...', { id: 'bulk' });
    var endpoint = isEmployee
      ? '/principal/id-cards/bulk?type=employee'
      : '/principal/id-cards/bulk?class_id=' + selClass;
    api.get(endpoint, { responseType: 'blob' }).then(function(r) {
      var url = window.URL.createObjectURL(new Blob([r.data], { type: 'application/zip' }));
      var link = document.createElement('a');
      link.href = url;
      var label = isEmployee ? 'Employees' : ('Class' + selClass);
      link.setAttribute('download', 'IDCards_' + label + '.zip');
      document.body.appendChild(link); link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('ZIP download ho gaya!', { id: 'bulk' });
    }).catch(function() { toast.error('Bulk download failed', { id: 'bulk' }); })
    .finally(function() { setBulkLoading(false); });
  }

  // Delete
  async function doDelete(id) {
    try {
      if (isEmployee) {
        await api.delete('/principal/teachers/' + id);
      } else {
        await api.delete('/principal/students/' + id);
      }
      toast.success('Deleted!');
      setItems(prev => prev.filter(x => x.id !== id));
      if (String(selId) === String(id)) { setSelId(''); setPreview(null); }
    } catch (e) {
      toast.error(e.response?.data?.error || 'Delete nahi hua');
    }
    setDeleteConfirm(null);
  }

  var filtered = items.filter(function(s) {
    if (!search) return true;
    var q = search.toLowerCase();
    var nm = (s.name || (s.user && s.user.name) || '').toLowerCase();
    return nm.includes(q)
      || (s.roll_number  || '').toLowerCase().includes(q)
      || (s.employee_id  || '').toLowerCase().includes(q);
  });

  var selCls = classes.find(function(c) { return String(c.id) === String(selClass); });
  var pageTitle = isEmployee ? '👔 Employee ID Card Management' : '🪪 Student ID Card Management';

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="ID Card Management" />
        <div className="page-body">

          {/* Header */}
          <div className="page-header">
            <div>
              <h2 className="page-title">{pageTitle}</h2>
              <p className="page-subtitle">
                {isEmployee ? 'Employee ID cards generate karo' : 'Student ID cards generate, preview aur download karo'}
              </p>
            </div>
          </div>

          {/* Tab Toggle */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {[
              { label: '🎒 Student ID Cards', path: '/id-cards/students' },
              { label: '👔 Employee ID Cards', path: '/id-cards/employees' },
            ].map(function(tab) {
              var active = ('/' + type === tab.path.replace('/id-cards','')) || tab.path === '/id-cards/' + type;
              // simpler check:
              var isActive = isEmployee ? tab.path.includes('employees') : tab.path.includes('students');
              return (
                <button key={tab.path}
                  onClick={function() { navigate(resolveTenantPath(tab.path)); }}
                  style={{
                    padding: '9px 18px', borderRadius: 8, border: '2px solid',
                    borderColor: isActive ? '#0176d3' : '#e2e8f0',
                    background: isActive ? '#e8f4fd' : '#fff',
                    color: isActive ? '#0176d3' : '#64748b',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                  }}>
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Controls */}
          <div className="card mb-6">
            <div className="card-body" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>

                {/* Class Select — only for students */}
                {!isEmployee && (
                  <div className="form-group" style={{ flex: 1, minWidth: 180, marginBottom: 0 }}>
                    <label className="form-label">📚 Class Select Karo</label>
                    <select className="form-select" value={selClass} onChange={function(e) { setSelClass(e.target.value); }}>
                      <option value="">— Class Choose Karo —</option>
                      {classes.map(function(c) {
                        return <option key={c.id} value={c.id}>{c.name} — {c.section}</option>;
                      })}
                    </select>
                  </div>
                )}

                {/* Search */}
                <div className="form-group" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
                  <label className="form-label">🔍 Search</label>
                  <input className="form-input"
                    placeholder={isEmployee ? 'Name / Employee ID...' : 'Name / Roll No...'}
                    value={search}
                    onChange={function(e) { setSearch(e.target.value); }} />
                </div>

                {/* Bulk Download */}
                {items.length > 0 && (
                  <button className="btn btn-primary" onClick={downloadBulk} disabled={bulkLoading}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-end' }}>
                    {bulkLoading ? '⏳ Generating...' : '📦 Download All as ZIP'}
                  </button>
                )}
              </div>

              {selCls && !isEmployee && (
                <div style={{ marginTop: 12, padding: '8px 12px', background: '#e8f4fd', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#0176d3', fontWeight: 600 }}>
                  <span>📋 {selCls.name} — Section {selCls.section}</span>
                  <span style={{ color: '#94a3b8' }}>|</span>
                  <span>{items.length} students</span>
                </div>
              )}
            </div>
          </div>

          {/* Main Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 440px', gap: 16, alignItems: 'start' }}>

            {/* Table */}
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4>{isEmployee ? 'Employees' : 'Students'} ({filtered.length})</h4>
              </div>
              <div className="table-container">
                {loading ? (
                  <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading...</div>
                ) : !isEmployee && !selClass ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">📚</div>
                    <p>Pehle upar se class select karo</p>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">{isEmployee ? '👔' : '🎒'}</div>
                    <p>Koi {isEmployee ? 'employee' : 'student'} nahi mila</p>
                  </div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>{isEmployee ? 'Employee' : 'Student'}</th>
                        <th>{isEmployee ? 'Emp. ID' : 'Roll No.'}</th>
                        <th>{isEmployee ? 'Designation' : 'Father'}</th>
                        <th>{isEmployee ? 'Dept.' : 'Blood Gr.'}</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(function(s, i) {
                        var isSelected = String(selId) === String(s.id);
                        var displayName  = s.name || (s.user && s.user.name) || '—';
                        var displayId    = isEmployee ? (s.employee_id || '—') : (s.roll_number || '—');
                        var displayCol3  = isEmployee ? (s.designation || '—') : (s.father_name || s.parent_name || '—');
                        var displayCol4  = isEmployee ? (s.department || '—') : (s.blood_group || '—');
                        var photoUrl     = s.photo_url || null;

                        return (
                          <tr key={s.id}
                            role="button"
                            tabIndex={0}
                            style={{ background: isSelected ? '#eff6ff' : 'transparent', cursor: 'pointer' }}
                            onClick={function() {
                              setSelId(s.id);
                              loadPreview(s.id, isEmployee ? 'employee' : 'student');
                            }}
                            onKeyDown={function(e) {
                              if (e.key === 'Enter' || e.key === ' ') {
                                setSelId(s.id);
                                loadPreview(s.id, isEmployee ? 'employee' : 'student');
                              }
                            }}>
                            <td style={{ color: '#94a3b8', fontSize: 12 }}>{i + 1}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#e8f4fd', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {photoUrl
                                    ? <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    : <span style={{ fontSize: 14 }}>👤</span>
                                  }
                                </div>
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 600 }}>{displayName}</div>
                                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{s.gender || ''}</div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span style={{ background: '#eff6ff', color: '#0176d3', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{displayId}</span>
                            </td>
                            <td style={{ fontSize: 12 }}>{displayCol3}</td>
                            <td>
                              {displayCol4 !== '—'
                                ? <span style={{ background: '#fef1ee', color: '#ba0517', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{displayCol4}</span>
                                : <span style={{ color: '#cbd5e1' }}>—</span>
                              }
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }} onClick={function(e) { e.stopPropagation(); }}>
                                {/* Edit */}
                                <button onClick={function() { setEditTarget(s); }}
                                  style={{ background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 4, padding: '4px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                  ✏️ Edit
                                </button>
                                {/* Preview */}
                                <button onClick={function() {
                                    setSelId(s.id);
                                    loadPreview(s.id, isEmployee ? 'employee' : 'student');
                                  }}
                                  style={{ background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 4, padding: '4px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                  👁 Preview
                                </button>
                                {/* Download */}
                                <button onClick={function() { downloadSingle(s.id, displayName); }}
                                  style={{ background: '#e8f4fd', color: '#0176d3', border: 'none', borderRadius: 4, padding: '4px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                                  📄 Download
                                </button>
                                {/* Delete */}
                                <button onClick={function() { setDeleteConfirm(s.id); }}
                                  style={{ background: '#fef1ee', color: '#dc2626', border: 'none', borderRadius: 4, padding: '4px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                                  🗑
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Preview Panel */}
            <div style={{ position: 'sticky', top: 80 }}>
              <div className="card">
                <div className="card-header"><h4>🪪 Live Preview</h4></div>
                <div className="card-body" style={{ padding: '20px 16px' }}>
                  {!preview ? (
                    <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8' }}>
                      <div style={{ fontSize: 36, marginBottom: 10 }}>🪪</div>
                      <div style={{ fontWeight: 600, color: '#475569', fontSize: 13 }}>
                        {isEmployee ? 'Employee' : 'Student'} select karo
                      </div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>Table mein kisi bhi row pe click karo</div>
                    </div>
                  ) : (
                    <>
                      <IDCardPreview
                        student={preview.student}
                        school={preview.school}
                        type={preview.isEmployee ? 'employee' : 'student'}
                      />
                      <div style={{ marginTop: 20, display: 'flex', gap: 8, justifyContent: 'center' }}>
                        <button className="btn btn-primary"
                          onClick={function() { downloadSingle(preview.student.id, preview.student.name); }}
                          style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          📥 Download PDF
                        </button>
                        <button onClick={function() { setEditTarget(preview.student); }}
                          style={{ background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                          ✏️ Edit
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div
          role="button"
          tabIndex={0}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setDeleteConfirm(null); }}
          onKeyDown={e => e.key === 'Escape' && setDeleteConfirm(null)}
          aria-label="Close delete confirm modal"
        >
          <div style={{ background: '#fff', borderRadius: 16, padding: '28px 28px', width: 380, boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>🗑 Delete Confirm</div>
            <p style={{ fontSize: 13, color: '#475569', marginBottom: 20 }}>
              Kya aap sure hain? Yeh action undo nahi ho sakta.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={function() { setDeleteConfirm(null); }}
                style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#475569' }}>
                Cancel
              </button>
              <button onClick={function() { doDelete(deleteConfirm); }}
                style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                Haan, Delete Karo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editTarget && !isEmployee && (
        <EditStudentModal
          student={editTarget}
          onClose={function() { setEditTarget(null); }}
          onSaved={function() {
            setEditTarget(null);
            // Reload list
            if (selClass) {
              api.get('/principal/students?class_id=' + selClass + '&per_page=100').then(function(r) {
                var raw = r.data;
                setItems(Array.isArray(raw) ? raw : (raw.data || []));
              }).catch(function(){});
            }
            if (selId) loadPreview(selId, 'student');
          }}
        />
      )}
      {editTarget && isEmployee && (
        <EditEmployeeModal
          employee={editTarget}
          onClose={function() { setEditTarget(null); }}
          onSaved={function() {
            setEditTarget(null);
            api.get('/principal/teachers').then(function(r) {
              setItems(Array.isArray(r.data) ? r.data : (r.data.data || []));
            }).catch(function(){});
            if (selId) loadPreview(selId, 'employee');
          }}
        />
      )}
    </div>
  );
}
