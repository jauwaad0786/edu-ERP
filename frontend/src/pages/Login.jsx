import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const MODULE_CONFIGS = {
  school: {
    name: 'EduERP',
    type: 'School Management Suite',
    industry: 'Education & Schools',
    initial: 'E',
    tagline: 'Complete School Operating System',
    thought: '"Education is the most powerful weapon which you can use to change the world."',
    author: 'Nelson Mandela',
    bgGradient: 'linear-gradient(145deg, #032d60 0%, #0b5cab 55%, #0176d3 100%)',
    accentColor: '#38bdf8',
    illustration: (
      <div style={{
        background: 'rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: '20px',
        border: '1px solid rgba(255,255,255,0.15)',
        backdropFilter: 'blur(10px)',
        margin: '24px 0',
        display: 'flex',
        alignItems: 'center',
        gap: 16
      }}>
        <div style={{
          width: 54,
          height: 54,
          borderRadius: 14,
          background: 'linear-gradient(135deg, #38bdf8, #0284c7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 28,
          flexShrink: 0,
          boxShadow: '0 4px 14px rgba(2,132,199,0.4)'
        }}>
          🎓
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 14, color: '#ffffff' }}>Classroom &amp; Academic Hub</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
            Empowering students, teachers &amp; school administrators with automated learning workflows.
          </div>
        </div>
      </div>
    ),
    features: [
      'Role-based access control (Super Admin, Principal, Teacher)',
      'Automated Admit Cards & Result Card PDF Generation',
      'Fee Collection, Receipts & Structure Management',
      'Daily Attendance, Timetable & Student Profiles',
    ],
  },
  college: {
    name: 'Campus360',
    type: 'College & University ERP',
    industry: 'Higher Education',
    initial: 'C',
    tagline: 'Higher Education & Research Ecosystem',
    thought: '"The beautiful thing about learning is that no one can take it away from you."',
    author: 'B.B. King',
    bgGradient: 'linear-gradient(145deg, #1e1b4b 0%, #4338ca 55%, #6366f1 100%)',
    accentColor: '#c084fc',
    illustration: (
      <div style={{
        background: 'rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: '20px',
        border: '1px solid rgba(255,255,255,0.15)',
        backdropFilter: 'blur(10px)',
        margin: '24px 0',
        display: 'flex',
        alignItems: 'center',
        gap: 16
      }}>
        <div style={{
          width: 54,
          height: 54,
          borderRadius: 14,
          background: 'linear-gradient(135deg, #c084fc, #6366f1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 28,
          flexShrink: 0
        }}>
          🏛️
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 14, color: '#ffffff' }}>University Campus Portal</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
            Facilitating semester examinations, credits, departments, and research publications.
          </div>
        </div>
      </div>
    ),
    features: [
      'Semester & Credit Management',
      'Department Faculties & Research Hub',
      'Examination & CGPA Automation',
      'Campus Placement & Alumni Network',
    ],
  },
  hospital: {
    name: 'MediCare360',
    type: 'Hospital & Healthcare Suite',
    industry: 'Clinical Healthcare',
    initial: 'M',
    tagline: 'Clinical Precision & Patient Care',
    thought: '"Wherever the art of medicine is loved, there is also a love of humanity."',
    author: 'Hippocrates',
    bgGradient: 'linear-gradient(145deg, #064e3b 0%, #047857 55%, #059669 100%)',
    accentColor: '#34d399',
    illustration: (
      <div style={{
        background: 'rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: '20px',
        border: '1px solid rgba(255,255,255,0.15)',
        backdropFilter: 'blur(10px)',
        margin: '24px 0',
        display: 'flex',
        alignItems: 'center',
        gap: 16
      }}>
        <div style={{
          width: 54,
          height: 54,
          borderRadius: 14,
          background: 'linear-gradient(135deg, #34d399, #059669)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 28,
          flexShrink: 0
        }}>
          🏥
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 14, color: '#ffffff' }}>Smart Healthcare Systems</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
            Streamlined OPD/IPD patient workflows, electronic health records, and diagnostics.
          </div>
        </div>
      </div>
    ),
    features: [
      'OPD & IPD Electronic Health Records',
      'Digital Pharmacy & Lab Diagnostics',
      'Doctor Appointment & Roster Management',
      'Medical Billing & Insurance Desk',
    ],
  },
  industry: {
    name: 'Industry360',
    type: 'Enterprise Manufacturing ERP',
    industry: 'Manufacturing & Supply Chain',
    initial: 'I',
    tagline: 'Industrial Scale & Supply Chain',
    thought: '"Innovation distinguishes between a leader and a follower."',
    author: 'Steve Jobs',
    bgGradient: 'linear-gradient(145deg, #0f172a 0%, #78350f 55%, #d97706 100%)',
    accentColor: '#fbbf24',
    illustration: (
      <div style={{
        background: 'rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: '20px',
        border: '1px solid rgba(255,255,255,0.15)',
        backdropFilter: 'blur(10px)',
        margin: '24px 0',
        display: 'flex',
        alignItems: 'center',
        gap: 16
      }}>
        <div style={{
          width: 54,
          height: 54,
          borderRadius: 14,
          background: 'linear-gradient(135deg, #fbbf24, #d97706)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 28,
          flexShrink: 0
        }}>
          🏭
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 14, color: '#ffffff' }}>Enterprise Plant Logistics</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
            Real-time supply chain tracking, workforce attendance &amp; financial ledger.
          </div>
        </div>
      </div>
    ),
    features: [
      'Inventory, Warehouse & BOM Tracking',
      'Vendor Procurement & Purchase Orders',
      'Biometric Staff Attendance & Payroll',
      'Production Schedules & Analytics',
    ],
  },
  hospitality: {
    name: 'Hospitality360',
    type: 'Hotels, Resorts & Banquets',
    industry: 'Hospitality & Luxury Resorts',
    initial: 'H',
    tagline: 'Guest Delight & Resort Workflows',
    thought: '"Hospitality is simply an opportunity to show love and care."',
    author: 'Service Excellence',
    bgGradient: 'linear-gradient(145deg, #4c0519 0%, #9f1239 55%, #e11d48 100%)',
    accentColor: '#fda4af',
    illustration: (
      <div style={{
        background: 'rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: '20px',
        border: '1px solid rgba(255,255,255,0.15)',
        backdropFilter: 'blur(10px)',
        margin: '24px 0',
        display: 'flex',
        alignItems: 'center',
        gap: 16
      }}>
        <div style={{
          width: 54,
          height: 54,
          borderRadius: 14,
          background: 'linear-gradient(135deg, #fda4af, #e11d48)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 28,
          flexShrink: 0
        }}>
          🏨
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 14, color: '#ffffff' }}>Resort &amp; Guest Experience</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
            Room reservations, restaurant POS, banquet scheduling, and guest CRM.
          </div>
        </div>
      </div>
    ),
    features: [
      'Room Reservation & Check-in Desk',
      'Restaurant POS & Kitchen Orders',
      'Housekeeping Workflow Dispatcher',
      'Event & Banquet Hall Booking',
    ],
  },
  coaching: {
    name: 'Academy360',
    type: 'Coaching & Test Prep Hub',
    industry: 'Coaching & Test Prep',
    initial: 'A',
    tagline: 'Student Ranks & Test Analytics',
    thought: '"The secret of getting ahead is getting started."',
    author: 'Mark Twain',
    bgGradient: 'linear-gradient(145deg, #172554 0%, #1d4ed8 55%, #2563eb 100%)',
    accentColor: '#60a5fa',
    illustration: (
      <div style={{
        background: 'rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: '20px',
        border: '1px solid rgba(255,255,255,0.15)',
        backdropFilter: 'blur(10px)',
        margin: '24px 0',
        display: 'flex',
        alignItems: 'center',
        gap: 16
      }}>
        <div style={{
          width: 54,
          height: 54,
          borderRadius: 14,
          background: 'linear-gradient(135deg, #60a5fa, #2563eb)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 28,
          flexShrink: 0
        }}>
          📚
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 14, color: '#ffffff' }}>Competitive Test Hub</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
            Batch schedules, online test series, and rank improvement analytics.
          </div>
        </div>
      </div>
    ),
    features: [
      'Batch Scheduling & Faculty Attendance',
      'Mock Test Series & Auto Grading',
      'Fee Installments & Parent Notifications',
      'Rank Analytics & Performance AI',
    ],
  },
};

function ForgotPasswordModal({ onClose }) {
  return (
    <div className="fp-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="fp-card">
        <div className="fp-header">
          <h3>Reset Password</h3>
          <button className="fp-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <p className="fp-text">
          For institutional security, password resets are verified and managed by your organization administrator.
        </p>
        <p className="fp-text">
          Please contact your school/institution IT administration office with your registered details to receive temporary reset credentials.
        </p>
        <button className="fp-ok" onClick={onClose}>Understood</button>
      </div>
    </div>
  );
}

export default function Login() {
  const [searchParams] = useSearchParams();
  const rawMod = searchParams.get('module') || localStorage.getItem('oneplatform_selected_module') || 'school';
  const modKey = MODULE_CONFIGS[rawMod] ? rawMod : 'school';
  const currentConfig = MODULE_CONFIGS[modKey];

  const [mode, setMode] = useState(null); // null | 'staff' | 'student'
  const [showForgot, setShowForgot] = useState(false);

  // Staff fields
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // Student fields
  const [stuName, setStuName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [phone, setPhone] = useState('');
  const [stuPass, setStuPass] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login, studentLogin } = useAuth();
  const navigate = useNavigate();

  const handleStaffLogin = async e => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await login(identifier, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
    }
    setLoading(false);
  };

  const handleStudentLogin = async e => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await studentLogin(stuName, fatherName, phone, stuPass);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please verify student credentials.');
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <style>{`
        * { box-sizing: border-box; }

        .auth-page {
          min-height: 100vh;
          display: flex;
          background: #f8fafc;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }

        /* ── Left dynamic brand panel ── */
        .auth-hero {
          width: 46%;
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 48px 56px;
          color: #ffffff;
          overflow: hidden;
          box-shadow: 4px 0 24px rgba(0,0,0,0.15);
        }

        .auth-hero-glow-1 {
          position: absolute;
          width: 500px; height: 500px;
          border-radius: 50%;
          background: rgba(255,255,255,0.07);
          top: -150px; right: -150px;
          pointer-events: none;
        }
        .auth-hero-glow-2 {
          position: absolute;
          width: 380px; height: 380px;
          border-radius: 50%;
          background: rgba(255,255,255,0.05);
          bottom: -120px; left: -100px;
          pointer-events: none;
        }

        .hero-top-brand {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .brand-pill-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.15);
          border: 1px solid rgba(255, 255, 255, 0.25);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .switch-module-btn {
          background: rgba(255,255,255,0.15);
          border: 1px solid rgba(255,255,255,0.3);
          color: #ffffff;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .switch-module-btn:hover {
          background: rgba(255,255,255,0.25);
        }

        .hero-main-content {
          position: relative;
          z-index: 2;
          margin: 32px 0;
        }

        .hero-main-content h1 {
          font-size: 2.3rem;
          font-weight: 900;
          line-height: 1.15;
          letter-spacing: -0.03em;
          margin: 0 0 8px 0;
        }

        .hero-industry-tag {
          font-size: 13.5px;
          color: rgba(255, 255, 255, 0.85);
          font-weight: 600;
          margin-bottom: 20px;
        }

        /* Thought card */
        .hero-thought-box {
          background: rgba(0, 0, 0, 0.25);
          border-left: 3.5px solid ${currentConfig.accentColor};
          padding: 14px 18px;
          border-radius: 8px;
          margin: 18px 0;
          backdrop-filter: blur(8px);
        }

        .hero-thought-text {
          font-size: 13px;
          font-style: italic;
          line-height: 1.5;
          margin: 0 0 4px 0;
          color: #f8fafc;
        }

        .hero-thought-author {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.7);
          text-align: right;
          font-weight: 700;
        }

        .hero-features {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 24px;
        }

        .hero-feat-item {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.9);
        }

        .hero-feat-tick {
          width: 20px; height: 20px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          display: flex; align-items: center; justify-content: center;
          font-size: 10px; font-weight: 900;
          flex-shrink: 0;
        }

        .hero-bottom-footer {
          position: relative;
          z-index: 2;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11.5px;
          color: rgba(255, 255, 255, 0.7);
          border-top: 1px solid rgba(255, 255, 255, 0.15);
          padding-top: 16px;
        }

        .hero-bottom-footer strong {
          color: #ffffff;
          letter-spacing: 0.05em;
        }

        /* ── Right form panel ── */
        .auth-form-panel {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 32px;
          background: #ffffff;
        }

        .auth-form-wrap {
          width: 100%;
          max-width: 420px;
        }

        .auth-title {
          font-size: 1.7rem;
          font-weight: 900;
          color: #0f172a;
          margin: 0 0 6px 0;
          letter-spacing: -0.02em;
        }

        .auth-subtitle {
          color: #64748b;
          font-size: 13.5px;
          margin: 0 0 28px 0;
        }

        .role-card {
          width: 100%;
          text-align: left;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 18px 20px;
          border-radius: 12px;
          border: 1.5px solid #e2e8f0;
          background: #ffffff;
          transition: all 0.2s;
          margin-bottom: 12px;
        }
        .role-card:hover {
          border-color: ${currentConfig.theme?.primary || '#0176d3'};
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
          transform: translateY(-2px);
        }

        .role-icon {
          width: 44px; height: 44px;
          border-radius: 10px;
          background: #032d60;
          color: #ffffff;
          display: flex; align-items: center; justify-content: center;
          font-weight: 800; font-size: 16px;
          flex-shrink: 0;
        }
        .role-icon.student {
          background: #059669;
        }

        .role-name {
          font-weight: 800;
          font-size: 14.5px;
          color: #0f172a;
        }
        .role-desc {
          font-size: 12px;
          color: #64748b;
          margin-top: 2px;
        }

        .back-link {
          background: none; border: none; cursor: pointer; padding: 0 0 18px 0;
          color: #0284c7; font-size: 13px; font-weight: 700;
          display: flex; align-items: center; gap: 6px;
        }

        .auth-alert {
          background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c;
          border-radius: 8px; padding: 10px 14px; font-size: 12.5px; margin-bottom: 16px;
        }

        .auth-field { margin-bottom: 16px; }
        .auth-field label {
          display: block; font-size: 12.5px; font-weight: 700;
          color: #334155; margin-bottom: 6px;
        }
        .auth-field input {
          width: 100%; box-sizing: border-box; padding: 12px 14px;
          border-radius: 8px; border: 1.5px solid #cbd5e1; font-size: 14px;
          outline: none; transition: border-color .15s, box-shadow .15s;
        }
        .auth-field input:focus {
          border-color: #0284c7; box-shadow: 0 0 0 3px rgba(2,132,199,0.15);
        }

        .auth-row-between {
          display: flex; justify-content: flex-end; margin: -4px 0 18px 0;
        }
        .link-btn {
          background: none; border: none; cursor: pointer;
          font-size: 12.5px; font-weight: 700; color: #0284c7;
        }

        .auth-submit {
          width: 100%; padding: 13px; border-radius: 8px; border: none;
          font-size: 14.5px; font-weight: 800; color: #fff; cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: all .2s;
          box-shadow: 0 4px 12px rgba(0,0,0,0.12);
        }
        .auth-submit.staff { background: #0284c7; }
        .auth-submit.staff:hover:not(:disabled) { background: #0369a1; }
        .auth-submit.student { background: #059669; }
        .auth-submit.student:hover:not(:disabled) { background: #047857; }

        .auth-copyright { margin-top: 32px; font-size: 11.5px; color: #94a3b8; text-align: center; }

        /* Modal */
        .fp-overlay {
          position: fixed; inset: 0; background: rgba(15,23,42,0.65);
          z-index: 1000; display: flex; align-items: center; justify-content: center;
          padding: 16px; backdrop-filter: blur(4px);
        }
        .fp-card {
          background: #fff; border-radius: 16px; padding: 28px;
          width: 100%; max-width: 400px; box-shadow: 0 25px 50px rgba(0,0,0,0.25);
        }
        .fp-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .fp-header h3 { font-size: 17px; font-weight: 800; color: #0f172a; margin: 0; }
        .fp-close { background: none; border: none; font-size: 20px; color: #94a3b8; cursor: pointer; }
        .fp-text { font-size: 13px; color: #475569; line-height: 1.6; margin: 0 0 12px 0; }
        .fp-ok {
          width: 100%; margin-top: 8px; padding: 12px; border-radius: 8px; border: none;
          background: #0284c7; color: #fff; font-weight: 800; font-size: 13.5px; cursor: pointer;
        }

        /* Mobile */
        @media (max-width: 900px) {
          .auth-page { flex-direction: column; }
          .auth-hero { width: 100%; padding: 32px 24px; min-height: auto; }
          .auth-form-panel { padding: 36px 20px; }
        }
      `}</style>

      {/* ── Left Hero Dynamic Industry Panel ── */}
      <div className="auth-hero" style={{ background: currentConfig.bgGradient }}>
        <div className="auth-hero-glow-1" />
        <div className="auth-hero-glow-2" />

        {/* Brand header */}
        <div className="hero-top-brand">
          <div className="brand-pill-badge">
            <i className="ti ti-sparkles" /> OnePlatform360
          </div>
          <button className="switch-module-btn" onClick={() => navigate('/')}>
            <i className="ti ti-grid-dots" /> Switch Suite
          </button>
        </div>

        {/* Main Content */}
        <div className="hero-main-content">
          <h1>{currentConfig.name}</h1>
          <div className="hero-industry-tag">{currentConfig.type} — {currentConfig.tagline}</div>

          {/* Thought / Quote */}
          <div className="hero-thought-box">
            <p className="hero-thought-text">{currentConfig.thought}</p>
            <div className="hero-thought-author">— {currentConfig.author}</div>
          </div>

          {/* Industry artwork card */}
          {currentConfig.illustration}

          {/* Feature checklist */}
          <div className="hero-features">
            {currentConfig.features.map((feat, idx) => (
              <div key={idx} className="hero-feat-item">
                <div className="hero-feat-tick">✓</div>
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="hero-bottom-footer">
          <span>Enterprise Secure Login</span>
          <span>POWERED BY <strong>ONEPLATFORM360</strong></span>
        </div>
      </div>

      {/* ── Right Form Panel ── */}
      <div className="auth-form-panel">
        <div className="auth-form-wrap">

          {/* Role Selection Screen */}
          {!mode && (
            <>
              <h2 className="auth-title">Sign In</h2>
              <p className="auth-subtitle">Select your access portal to continue into {currentConfig.name}</p>

              <button className="role-card" onClick={() => { setMode('staff'); setError(''); }}>
                <div className="role-icon">
                  <i className="ti ti-user-shield" />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="role-name">Staff / Administration</div>
                  <div className="role-desc">Super Admin, Principal, Teachers, Wardens &amp; Officers</div>
                </div>
                <i className="ti ti-chevron-right" style={{ color: '#0284c7', fontSize: 18 }} />
              </button>

              <button className="role-card" onClick={() => { setMode('student'); setError(''); }}>
                <div className="role-icon student">
                  <i className="ti ti-user-graduate" />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="role-name">Student &amp; Parent Portal</div>
                  <div className="role-desc">Sign in with student name &amp; registered mobile number</div>
                </div>
                <i className="ti ti-chevron-right" style={{ color: '#059669', fontSize: 18 }} />
              </button>
            </>
          )}

          {/* Staff Login Form */}
          {mode === 'staff' && (
            <>
              <button className="back-link" onClick={() => { setMode(null); setError(''); }}>
                &larr; Back to Role Selection
              </button>
              <h2 className="auth-title">Staff &amp; Officer Login</h2>
              <p className="auth-subtitle">Enter your institutional email/username and password</p>

              {error && <div className="auth-alert">{error}</div>}

              <form onSubmit={handleStaffLogin}>
                <div className="auth-field">
                  <label>Email or Username</label>
                  <input
                    type="text"
                    placeholder="e.g. principal@school.edu or username"
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    required
                  />
                </div>
                <div className="auth-field">
                  <label>Password</label>
                  <input
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="auth-row-between">
                  <button type="button" className="link-btn" onClick={() => setShowForgot(true)}>
                    Forgot Password?
                  </button>
                </div>
                <button type="submit" className="auth-submit staff" disabled={loading}>
                  {loading ? 'Authenticating...' : 'Sign In to Workspace →'}
                </button>
              </form>
            </>
          )}

          {/* Student Login Form */}
          {mode === 'student' && (
            <>
              <button className="back-link" style={{ color: '#059669' }} onClick={() => { setMode(null); setError(''); }}>
                &larr; Back to Role Selection
              </button>
              <h2 className="auth-title">Student / Parent Portal</h2>
              <p className="auth-subtitle">Sign in to access your marks, admit cards &amp; attendance</p>

              {error && <div className="auth-alert">{error}</div>}

              <form onSubmit={handleStudentLogin}>
                <div className="auth-field">
                  <label>Student's Full Name *</label>
                  <input
                    placeholder="e.g. Rahul Sharma"
                    value={stuName}
                    onChange={e => setStuName(e.target.value)}
                    required
                  />
                </div>
                <div className="auth-field">
                  <label>Father's Name <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional tiebreaker)</span></label>
                  <input
                    placeholder="Needed only if name matches multiple records"
                    value={fatherName}
                    onChange={e => setFatherName(e.target.value)}
                  />
                </div>
                <div className="auth-field">
                  <label>Registered Mobile Number *</label>
                  <input
                    type="tel"
                    placeholder="10-digit mobile number"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    required
                    maxLength={10}
                  />
                </div>
                <div className="auth-field">
                  <label>Password *</label>
                  <input
                    type="password"
                    placeholder="Enter password"
                    value={stuPass}
                    onChange={e => setStuPass(e.target.value)}
                    required
                  />
                </div>
                <div className="auth-row-between">
                  <button type="button" className="link-btn" style={{ color: '#059669' }} onClick={() => setShowForgot(true)}>
                    Forgot Password?
                  </button>
                </div>
                <button type="submit" className="auth-submit student" disabled={loading}>
                  {loading ? 'Authenticating...' : 'Sign In as Student →'}
                </button>
              </form>
            </>
          )}

          <p className="auth-copyright">
            &copy; 2026 <strong>OnePlatform360</strong>. All rights reserved.
          </p>
        </div>
      </div>

      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
    </div>
  );
}
