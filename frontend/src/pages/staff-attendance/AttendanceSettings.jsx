// FULL FILE — src/pages/staff-attendance/AttendanceSettings.jsx
import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';

const RADIUS_OPTIONS = [50, 100, 150, 200, 300];
const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function AttendanceSettings() {
  const [darkMode, setDarkMode] = useState(localStorage.getItem('ederp_theme') === 'dark');
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/staff-attendance/settings')
      .then((r) => setSettings(r.data))
      .catch(() => toast.error('Settings load nahi hue'))
      .finally(() => setLoading(false));
  }, []);

  const set = (field, value) => setSettings((s) => ({ ...s, [field]: value }));

  const toggleWorkingDay = (day) => {
    setSettings((s) => {
      const has = s.working_days.includes(day);
      return {
        ...s,
        working_days: has ? s.working_days.filter((d) => d !== day) : [...s.working_days, day],
      };
    });
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by this browser');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set('latitude', pos.coords.latitude);
        set('longitude', pos.coords.longitude);
        toast.success('Current location capture ho gayi');
      },
      () => toast.error('Location fetch nahi ho payi')
    );
  };

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.put('/staff-attendance/settings', settings);
      setSettings(data);
      toast.success('Settings saved');
    } catch {
      toast.error('Save fail ho gaya');
    } finally {
      setSaving(false);
    }
  };

  // ── styles ──
  const bg     = darkMode ? '#0f172a' : '#f8fafc';
  const cardBg = darkMode ? '#1e293b' : '#fff';
  const border = darkMode ? '#334155' : '#e2e8f0';
  const text   = darkMode ? '#e2e8f0' : '#0f172a';
  const muted  = darkMode ? '#94a3b8' : '#64748b';

  const card = { background: cardBg, border: `1px solid ${border}`, borderRadius: 14, padding: 20, marginBottom: 20 };
  const label = { display: 'block', fontSize: 12, color: muted, marginBottom: 6, fontWeight: 600 };
  const input = { width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${border}`, background: darkMode ? '#0f172a' : '#fff', color: text, fontSize: 13 };
  const row = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 4 };
  const sectionTitle = { fontSize: 15, fontWeight: 700, color: text, marginBottom: 14 };

  const Toggle = ({ checked, onChange, labelText }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${border}` }}>
      <span style={{ fontSize: 13, color: text }}>{labelText}</span>
      <label style={{ position: 'relative', display: 'inline-block', width: 40, height: 22 }}>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
        <span style={{
          position: 'absolute', cursor: 'pointer', inset: 0,
          background: checked ? '#16a34a' : (darkMode ? '#334155' : '#cbd5e1'),
          borderRadius: 22, transition: '0.2s',
        }}>
          <span style={{
            position: 'absolute', height: 16, width: 16, left: checked ? 21 : 3, top: 3,
            background: '#fff', borderRadius: '50%', transition: '0.2s',
          }} />
        </span>
      </label>
    </div>
  );

  if (loading || !settings) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: bg }}>
        <Sidebar darkMode={darkMode} />
        <div style={{ marginLeft: 232, flex: 1, padding: 60, textAlign: 'center', color: muted }}>Loading…</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: bg }}>
      <Sidebar darkMode={darkMode} />
      <div style={{ marginLeft: 232, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Navbar title="Attendance Settings" darkMode={darkMode} onToggleDark={() => setDarkMode((d) => !d)} />

        <div style={{ padding: 24, maxWidth: 900 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ color: text, margin: 0 }}>Attendance Settings</h2>
            <button onClick={save} disabled={saving} style={{
              background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8,
              padding: '10px 20px', fontWeight: 600, cursor: 'pointer',
            }}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>

          {/* LOCATION */}
          <div style={card}>
            <div style={sectionTitle}>📍 School Location</div>
            <div style={{ marginBottom: 14 }}>
              <label style={label}>School Address</label>
              <input style={input} value={settings.school_address || ''} onChange={(e) => set('school_address', e.target.value)} />
            </div>
            <div style={row}>
              <div>
                <label style={label}>Latitude</label>
                <input style={input} type="number" step="any" value={settings.latitude ?? ''} onChange={(e) => set('latitude', parseFloat(e.target.value))} />
              </div>
              <div>
                <label style={label}>Longitude</label>
                <input style={input} type="number" step="any" value={settings.longitude ?? ''} onChange={(e) => set('longitude', parseFloat(e.target.value))} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button onClick={useCurrentLocation} style={{
                  background: darkMode ? '#334155' : '#e2e8f0', color: text, border: 'none',
                  borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13, width: '100%',
                }}>📌 Use Current Location</button>
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <label style={label}>Attendance Radius (meters)</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {RADIUS_OPTIONS.map((r) => (
                  <button key={r} onClick={() => set('radius_meters', r)} style={{
                    padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
                    border: `1px solid ${settings.radius_meters === r ? '#4f46e5' : border}`,
                    background: settings.radius_meters === r ? '#4f46e5' : 'transparent',
                    color: settings.radius_meters === r ? '#fff' : text,
                  }}>{r}m</button>
                ))}
              </div>
            </div>
          </div>

          {/* TIMING RULES */}
          <div style={card}>
            <div style={sectionTitle}>⏰ Timing Rules</div>
            <div style={row}>
              <div>
                <label style={label}>School Start Time</label>
                <input style={input} type="time" value={settings.school_start_time} onChange={(e) => set('school_start_time', e.target.value)} />
              </div>
              <div>
                <label style={label}>School End Time</label>
                <input style={input} type="time" value={settings.school_end_time} onChange={(e) => set('school_end_time', e.target.value)} />
              </div>
              <div>
                <label style={label}>Auto Checkout Time</label>
                <input style={input} type="time" value={settings.auto_checkout_time} onChange={(e) => set('auto_checkout_time', e.target.value)} />
              </div>
            </div>
            <div style={{ ...row, marginTop: 14 }}>
              <div>
                <label style={label}>Grace Time (minutes)</label>
                <input style={input} type="number" value={settings.grace_minutes} onChange={(e) => set('grace_minutes', parseInt(e.target.value) || 0)} />
              </div>
              <div>
                <label style={label}>Late Rule (minutes after grace)</label>
                <input style={input} type="number" value={settings.late_after_minutes} onChange={(e) => set('late_after_minutes', parseInt(e.target.value) || 0)} />
              </div>
              <div>
                <label style={label}>Half Day Rule (min minutes worked)</label>
                <input style={input} type="number" value={settings.half_day_after_minutes} onChange={(e) => set('half_day_after_minutes', parseInt(e.target.value) || 0)} />
              </div>
              <div>
                <label style={label}>Overtime Rule (after minutes)</label>
                <input style={input} type="number" value={settings.overtime_after_minutes} onChange={(e) => set('overtime_after_minutes', parseInt(e.target.value) || 0)} />
              </div>
            </div>
          </div>

          {/* WORKING DAYS */}
          <div style={card}>
            <div style={sectionTitle}>📅 Working Days</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {WEEK_DAYS.map((d) => (
                <button key={d} onClick={() => toggleWorkingDay(d)} style={{
                  padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
                  border: `1px solid ${settings.working_days.includes(d) ? '#4f46e5' : border}`,
                  background: settings.working_days.includes(d) ? '#4f46e5' : 'transparent',
                  color: settings.working_days.includes(d) ? '#fff' : text,
                }}>{d}</button>
              ))}
            </div>
          </div>

          {/* TOGGLES */}
          <div style={card}>
            <div style={sectionTitle}>🔒 Rules & Security</div>
            <Toggle checked={settings.approval_required} onChange={(v) => set('approval_required', v)} labelText="Approval Required for Check-In" />
            <Toggle checked={settings.mock_location_detection} onChange={(v) => set('mock_location_detection', v)} labelText="Mock Location Detection" />
            <Toggle checked={settings.device_restriction} onChange={(v) => set('device_restriction', v)} labelText="Device Restriction" />
          </div>

          {/* PAYROLL */}
          <div style={card}>
            <div style={sectionTitle}>💰 Payroll Sync</div>
            <Toggle checked={settings.payroll_sync_enabled} onChange={(v) => set('payroll_sync_enabled', v)} labelText="Auto Sync Attendance to Payroll" />
            <div style={{ marginTop: 14 }}>
              <label style={label}>Attendance Cutoff Day (day of month)</label>
              <input style={{ ...input, maxWidth: 150 }} type="number" min={1} max={31} value={settings.attendance_cutoff_day} onChange={(e) => set('attendance_cutoff_day', parseInt(e.target.value) || 25)} />
            </div>
            <div style={{ marginTop: 14 }}>
              <label style={label}>Attendance Lock Date (records before this date can't be edited)</label>
              <input style={{ ...input, maxWidth: 220 }} type="date" value={settings.attendance_lock_date || ''} onChange={(e) => set('attendance_lock_date', e.target.value)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
