import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar  from '../components/Navbar';
import api from '../api/axios';
import toast from 'react-hot-toast';

const ROLE_LABELS = {
  LIBRARIAN: 'Librarian', ACCOUNTANT: 'Accountant', RECEPTIONIST: 'Receptionist',
  HOSTEL: 'Hostel Staff', TRANSPORT: 'Transport Staff', HR: 'HR',
  VICE_PRINCIPAL: 'Vice Principal',
};

export default function StaffProfile() {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form,    setForm]    = useState({});
  const [saving,  setSaving]  = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetPw,   setResetPw]   = useState('');
  const [showReset, setShowReset] = useState(false);

  const load = () => {
    setLoading(true);
    api.get(`/principal/users/${id}/profile`)
      .then(r => { setUser(r.data); setForm(r.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [id]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      await api.patch(`/principal/users/${id}`, {
        name: form.name, phone: form.phone,
        department: form.department, designation: form.designation,
      });
      toast.success('Profile updated!');
      setEditing(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed');
    }
    setSaving(false);
  };

  const submitReset = async () => {
    const chosenPw = resetPw.trim() || 'EduErp@123';
    if (chosenPw.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setResetting(true);
    try {
      await api.put(`/principal/users/${id}/reset-password`, {
        password: chosenPw,
      });
      toast.success(`Password reset successfully! Temporary password: ${chosenPw}`, { duration: 6000 });
      setShowReset(false);
      setResetPw('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Reset failed');
    }
    setResetting(false);
  };

  const toggleActive = async () => {
    try {
      await api.put(`/principal/users/${id}/toggle`);
      toast.success(user.is_active ? 'Deactivated' : 'Activated');
      load();
    } catch {
      toast.error('Action failed');
    }
  };

  if (loading) return (
    <div className="app-shell"><Sidebar />
      <div className="main-content"><Navbar title="Staff Profile" />
        <div className="page-body" style={{ display:'flex', alignItems:'center', justifyContent:'center', height:300 }}>
          <span style={{ color:'var(--neutral-5)' }}>⏳ Loading...</span>
        </div>
      </div>
    </div>
  );

  if (!user) return (
    <div className="app-shell"><Sidebar />
      <div className="main-content"><Navbar title="Staff Profile" />
        <div className="page-body"><div className="empty-state"><p>Staff member nahi mila.</p></div></div>
      </div>
    </div>
  );

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Staff Profile" />
        <div className="page-body">

          <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:24 }}>
            <button onClick={() => navigate(-1)} style={{
              background:'none', border:'1px solid var(--neutral-3)',
              borderRadius:8, padding:'6px 14px', cursor:'pointer',
              fontSize:13, color:'var(--neutral-7)', fontWeight:600,
            }}>← Back</button>
            <div style={{
              width:56, height:56, borderRadius:'50%',
              background:'#f3f0ff', color:'#5867e8',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:24, fontWeight:800,
            }}>{user.name?.charAt(0).toUpperCase()}</div>
            <div style={{ flex:1 }}>
              <h2 style={{ margin:0, fontSize:20, fontWeight:800 }}>{user.name}</h2>
              <div style={{ fontSize:12, color:'var(--neutral-5)', marginTop:2 }}>
                {ROLE_LABELS[user.role] || user.role} &nbsp;·&nbsp; {user.department || 'N/A'}
              </div>
            </div>
            <span className={`badge ${user.is_active ? 'badge-success' : 'badge-neutral'}`}>
              {user.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>

            <div className="card" style={{ margin:0 }}>
              <div className="card-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <h4 style={{ margin:0 }}>👤 Personal Details</h4>
                <button onClick={() => setEditing(!editing)} style={{
                  background:'#eff6ff', color:'#0176d3', border:'none',
                  borderRadius:6, padding:'4px 12px', fontSize:11,
                  fontWeight:700, cursor:'pointer',
                }}>{editing ? 'Cancel' : '✏️ Edit'}</button>
              </div>
              <div className="card-body">
                {editing ? (
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    {[
                      ['Full Name',  'name'],
                      ['Phone',      'phone'],
                      ['Department', 'department'],
                      ['Designation','designation'],
                    ].map(([label, field]) => (
                      <div key={field} className="form-group" style={{ margin:0 }}>
                        <label className="form-label">{label}</label>
                        <input className="form-input"
                          value={form[field] || ''}
                          onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} />
                      </div>
                    ))}
                    <button onClick={saveProfile} disabled={saving} style={{
                      marginTop:6, padding:'8px', background:'#16a34a',
                      color:'#fff', border:'none', borderRadius:8,
                      cursor:'pointer', fontSize:12, fontWeight:700,
                    }}>{saving ? 'Saving...' : '✅ Save Changes'}</button>
                  </div>
                ) : (
                  [
                    ['Full Name',   user.name],
                    ['Username',    user.username   || '—'],
                    ['Role',        ROLE_LABELS[user.role] || user.role],
                    ['Email',       user.email       || '—'],
                    ['Phone',       user.phone       || '—'],
                    ['Department',  user.department  || '—'],
                    ['Designation', user.designation || '—'],
                    ['Joined',      user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'],
                  ].map(([label, value]) => (
                    <div key={label} style={{
                      display:'flex', justifyContent:'space-between',
                      padding:'8px 0', borderBottom:'1px solid var(--neutral-1)', fontSize:13,
                    }}>
                      <span style={{ color:'var(--neutral-6)', minWidth:130 }}>{label}</span>
                      <span style={{ fontWeight:600, color:'var(--neutral-9)', textAlign:'right' }}>{value}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="card" style={{ margin:0 }}>
              <div className="card-header"><h4 style={{ margin:0 }}>⚙️ Account Actions</h4></div>
              <div className="card-body" style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <button onClick={() => setShowReset(!showReset)} style={{
                  padding:'10px', background:'#eff6ff', color:'#0176d3',
                  border:'none', borderRadius:8, cursor:'pointer',
                  fontSize:13, fontWeight:700,
                }}>🔑 Reset Password</button>

                {showReset && (
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    <input className="form-input" type="text"
                      placeholder="Leave blank → EduErp@123"
                      value={resetPw} onChange={e => setResetPw(e.target.value)} />
                    <button onClick={submitReset} disabled={resetting} style={{
                      padding:'8px', background:'#16a34a', color:'#fff',
                      border:'none', borderRadius:8, cursor:'pointer',
                      fontSize:12, fontWeight:700,
                    }}>{resetting ? 'Resetting...' : 'Confirm Reset'}</button>
                  </div>
                )}

                <button onClick={toggleActive} style={{
                  padding:'10px',
                  background: user.is_active ? '#fef1ee' : '#f0fdf4',
                  color:      user.is_active ? 'var(--error)' : '#16a34a',
                  border:'none', borderRadius:8, cursor:'pointer',
                  fontSize:13, fontWeight:700,
                }}>{user.is_active ? '🚫 Deactivate' : '✅ Activate'}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
