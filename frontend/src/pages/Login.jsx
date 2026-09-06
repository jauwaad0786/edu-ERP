import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

function ForgotPasswordModal({ onClose }) {
  const [step, setStep] = useState(1); // 1: Enter email/phone, 2: Enter OTP & New Password
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown(c => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError('Please enter your registered mobile number or email.');
      return;
    }
    setLoading(true);
    setError('');
    setMsg('');
    try {
      const res = await api.post('/auth/forgot-password', { identifier: identifier.trim() });
      setMsg(res.data?.message || 'If the account exists, a password reset code has been sent.');
      setCooldown(60);
      setStep(2);
    } catch (err) {
      const serverMsg = err.response?.data?.message || err.response?.data?.error;
      setError(serverMsg || 'Unable to send reset code. Please use your registered mobile number.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!otp.trim() || !newPassword.trim()) {
      setError('Please enter the verification OTP and new password.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/reset-password', {
        identifier: identifier.trim(),
        otp: otp.trim(),
        new_password: newPassword.trim(),
      });
      setMsg(res.data?.message || 'Password reset successfully! You can now log in.');
      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid or expired OTP. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fp-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="fp-card">
        <div className="fp-header">
          <h3>Reset Password</h3>
          <button className="fp-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}

        {msg && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
            {msg}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleSendOtp}>
            <p className="fp-text">
              Enter your registered mobile number or email address. We will send you an OTP code to reset your password.
            </p>
            <div style={{ marginBottom: 14 }}>
              <input
                type="text"
                className="input-field"
                placeholder="Mobile number (10 digits) or Email"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                required
                autoFocus
              />
            </div>
            <button type="submit" className="fp-ok" disabled={loading}>
              {loading ? 'Sending Code...' : 'Send Reset OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword}>
            <p className="fp-text" style={{ marginBottom: 8 }}>
              Enter the 6-digit OTP code sent to <strong>{identifier}</strong> and set your new password.
            </p>
            <div style={{ marginBottom: 10 }}>
              <input
                type="text"
                className="input-field"
                placeholder="6-Digit OTP"
                maxLength={6}
                value={otp}
                onChange={e => setOtp(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div style={{ marginBottom: 10 }}>
              <input
                type="password"
                className="input-field"
                placeholder="New Password (min 6 characters)"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <input
                type="password"
                className="input-field"
                placeholder="Confirm New Password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="fp-ok" disabled={loading}>
              {loading ? 'Resetting Password...' : 'Save New Password'}
            </button>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 12 }}>
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={cooldown > 0 || loading}
                style={{ background: 'none', border: 'none', color: cooldown > 0 ? '#94a3b8' : '#0176d3', cursor: cooldown > 0 ? 'default' : 'pointer', padding: 0 }}
              >
                {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend OTP'}
              </button>
              <button
                type="button"
                onClick={() => { setStep(1); setError(''); setMsg(''); }}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0 }}
              >
                Change identifier
              </button>
            </div>
          </form>
        )}

        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #f1f5f9', fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
          For school administrator assistance, contact your institutional administration office.
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login, otpLogin, widgetOtpLogin, studentLogin } = useAuth();

  // Role mode: 'staff' (Principal/Teacher/Admin) vs 'student' (Student/Parent)
  const [activeTab, setActiveTab] = useState('staff');
  const [showForgot, setShowForgot] = useState(false);

  // Auth method: 'password' | 'otp'
  const [authMethod, setAuthMethod] = useState('password');
  const [otpStep, setOtpStep] = useState(1); // 1: Send OTP, 2: Enter OTP
  const [otpValue, setOtpValue] = useState('');
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [otpSentMsg, setOtpSentMsg] = useState('');

  useEffect(() => {
    let timer;
    if (otpCooldown > 0) {
      timer = setTimeout(() => setOtpCooldown(c => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [otpCooldown]);

  // Staff credentials
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // Student credentials
  const [stuName, setStuName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [phone, setPhone] = useState('');
  const [stuPass, setStuPass] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const openMsg91Widget = (explicitIdentifier) => {
    const rawTarget = (explicitIdentifier !== undefined ? explicitIdentifier : identifier).trim();
    setError('');

    const configuration = {
      widgetId: "366966687177323837373439",
      tokenAuth: "567274TWJ7EfhCn6a9d222aP1",
      identifier: rawTarget || undefined,
      exposeMethods: false,
      success: async (data) => {
        let token = '';
        if (typeof data === 'string') {
          token = data.trim();
        } else if (data && typeof data === 'object') {
          token = (data['access-token'] || data.accessToken || data.token || data.jwtToken || data.message || '').trim();
        }

        if (!token) {
          setError('Could not extract access token from MSG91 OTP widget.');
          return;
        }

        setLoading(true);
        setError('');
        try {
          await widgetOtpLogin(token, rawTarget);
          navigate('/dashboard');
        } catch (err) {
          const serverMsg = err.response?.data?.error || err.response?.data?.message;
          setError(serverMsg || 'Widget verification token validation failed on server.');
        } finally {
          setLoading(false);
        }
      },
      failure: (error) => {
        const errMsg = typeof error === 'string' ? error : (error?.message || error?.error || 'OTP verification was closed or failed.');
        setError(errMsg);
      },
    };

    if (typeof window.initSendOTP === 'function') {
      window.initSendOTP(configuration);
    } else {
      setLoading(true);
      (function loadOtpScript(urls) {
        let i = 0;
        function attempt() {
          const s = document.createElement('script');
          s.src = urls[i];
          s.async = true;
          s.onload = () => {
            setLoading(false);
            if (typeof window.initSendOTP === 'function') {
              window.initSendOTP(configuration);
            }
          };
          s.onerror = () => {
            i++;
            if (i < urls.length) {
              attempt();
            } else {
              setLoading(false);
              setError('Failed to load MSG91 verification script. Please use SMS OTP.');
            }
          };
          document.head.appendChild(s);
        }
        attempt();
      })([
        'https://verify.msg91.com/otp-provider.js',
        'https://verify.phone91.com/otp-provider.js'
      ]);
    }
  };

  const handleStaffLogin = async e => {
    e.preventDefault();
    if (!identifier.trim() || !password.trim()) {
      setError('Please enter both username/email and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(identifier, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendLoginOtp = async e => {
    if (e) e.preventDefault();
    if (!identifier.trim()) {
      setError('Please enter your registered mobile number or email.');
      return;
    }
    setLoading(true);
    setError('');
    setOtpSentMsg('');
    try {
      const res = await api.post('/auth/send-login-otp', { identifier: identifier.trim() });
      setOtpSentMsg(res.data?.message || 'If the account exists, an OTP has been sent.');
      if (res.data?.dev_otp) {
        setOtpValue(String(res.data.dev_otp));
      }
      setOtpCooldown(60);
      setOtpStep(2);
    } catch (err) {
      const serverMsg = err.response?.data?.message || err.response?.data?.error;
      setError(serverMsg || 'Unable to send OTP at this time. Please try again or use password login.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyLoginOtp = async e => {
    e.preventDefault();
    if (!otpValue.trim()) {
      setError('Please enter the 6-digit OTP code.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await otpLogin(identifier.trim(), otpValue.trim());
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Verification failed. Please check the OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleStudentLogin = async e => {
    e.preventDefault();
    if (!stuName.trim() || !fatherName.trim() || !phone.trim() || !stuPass.trim()) {
      setError('Please fill in all student login fields.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await studentLogin(stuName, fatherName, phone, stuPass);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please verify student credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');

        * { box-sizing: border-box; }

        .login-wrapper {
          min-height: 100vh;
          display: flex;
          font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
          background: #f8fafc;
        }

        /* ── Left Blue Hero Sidebar ── */
        .login-sidebar {
          width: 45%;
          background: linear-gradient(145deg, #032d60 0%, #084c8d 60%, #0176d3 100%);
          color: #ffffff;
          padding: 40px 48px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
          overflow: hidden;
          box-shadow: 4px 0 24px rgba(0, 0, 0, 0.08);
        }

        .sidebar-decor-1 {
          position: absolute;
          width: 400px;
          height: 400px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 70%);
          top: -120px;
          right: -120px;
          pointer-events: none;
        }

        .sidebar-decor-2 {
          position: absolute;
          width: 320px;
          height: 320px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(56, 189, 248, 0.12) 0%, rgba(255,255,255,0) 70%);
          bottom: -100px;
          left: -80px;
          pointer-events: none;
        }

        .sidebar-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: relative;
          z-index: 2;
        }

        .brand-badge {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .brand-icon-box {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          backdrop-filter: blur(8px);
        }

        .brand-title-text {
          font-size: 16px;
          font-weight: 800;
          letter-spacing: -0.02em;
        }

        .brand-title-text span {
          color: #38bdf8;
        }

        .change-module-link {
          color: rgba(255, 255, 255, 0.85);
          font-size: 12px;
          font-weight: 700;
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.18);
          transition: all 0.2s;
        }

        .change-module-link:hover {
          background: rgba(255, 255, 255, 0.2);
          color: #ffffff;
        }

        .sidebar-center {
          margin: 32px 0;
          position: relative;
          z-index: 2;
        }

        .sidebar-suite-title {
          font-size: 2.1rem;
          font-weight: 900;
          line-height: 1.15;
          letter-spacing: -0.03em;
          margin-bottom: 6px;
        }

        .sidebar-suite-subtitle {
          font-size: 13.5px;
          color: #bae6fd;
          font-weight: 600;
          margin-bottom: 24px;
        }

        /* ── School Classroom Visual Box ── */
        .school-visual-card {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 14px;
          padding: 18px;
          backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 20px;
        }

        .school-visual-avatar {
          width: 56px;
          height: 56px;
          border-radius: 12px;
          background: linear-gradient(135deg, #38bdf8 0%, #0284c7 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 30px;
          flex-shrink: 0;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
        }

        .school-visual-heading {
          font-size: 14px;
          font-weight: 800;
          color: #ffffff;
          margin-bottom: 2px;
        }

        .school-visual-text {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.85);
          line-height: 1.45;
        }

        /* ── Thoughts & Quote Box ── */
        .thought-card {
          background: rgba(3, 45, 96, 0.4);
          border-left: 3.5px solid #38bdf8;
          border-radius: 8px;
          padding: 14px 18px;
          margin-bottom: 24px;
          backdrop-filter: blur(8px);
        }

        .thought-text {
          font-size: 13px;
          font-style: italic;
          line-height: 1.5;
          color: #f0f9ff;
          margin-bottom: 4px;
        }

        .thought-author {
          font-size: 11.5px;
          font-weight: 700;
          color: #7dd3fc;
          text-align: right;
        }

        /* Features checklist */
        .features-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .features-list li {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.95);
          font-weight: 500;
        }

        .feat-check {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          color: #38bdf8;
          flex-shrink: 0;
        }

        .sidebar-footer {
          position: relative;
          z-index: 2;
          border-top: 1px solid rgba(255, 255, 255, 0.15);
          padding-top: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.75);
        }

        .sidebar-footer strong {
          color: #ffffff;
          font-weight: 800;
        }

        /* ── Right Login Form Area ── */
        .login-main {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 32px;
          background: #ffffff;
        }

        .login-card {
          width: 100%;
          max-width: 440px;
        }

        .login-header-wrap {
          margin-bottom: 24px;
        }

        .login-main-title {
          font-size: 1.8rem;
          font-weight: 900;
          color: #032d60;
          letter-spacing: -0.02em;
          margin-bottom: 4px;
        }

        .login-main-desc {
          font-size: 13.5px;
          color: #64748b;
        }

        /* Role Switcher Tabs */
        .tab-switcher {
          display: flex;
          background: #f1f5f9;
          padding: 4px;
          border-radius: 10px;
          margin-bottom: 24px;
        }

        .tab-item {
          flex: 1;
          padding: 10px;
          text-align: center;
          font-size: 13px;
          font-weight: 700;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
          background: transparent;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .tab-item.active {
          background: #ffffff;
          color: #0176d3;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        }

        /* Form elements */
        .input-group {
          margin-bottom: 18px;
        }

        .input-label {
          display: block;
          font-size: 12.5px;
          font-weight: 700;
          color: #334155;
          margin-bottom: 6px;
        }

        .input-box-wrap {
          position: relative;
        }

        .input-box-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          font-size: 16px;
        }

        .input-field {
          width: 100%;
          padding: 12px 14px 12px 42px;
          border-radius: 10px;
          border: 1.5px solid #cbd5e1;
          font-size: 13.5px;
          color: #0f172a;
          outline: none;
          transition: all 0.2s;
          font-family: inherit;
        }

        .input-field:focus {
          border-color: #0176d3;
          box-shadow: 0 0 0 3px rgba(1, 118, 211, 0.12);
        }

        .error-alert {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #b91c1c;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 18px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .forgot-link {
          font-size: 12.5px;
          font-weight: 600;
          color: #0176d3;
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
        }

        .forgot-link:hover {
          text-decoration: underline;
        }

        .submit-btn {
          width: 100%;
          padding: 13px;
          border-radius: 10px;
          background: linear-gradient(135deg, #0176d3 0%, #032d60 100%);
          color: #ffffff;
          font-size: 14px;
          font-weight: 800;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 4px 14px rgba(1, 118, 211, 0.3);
          margin-top: 8px;
        }

        .submit-btn:hover {
          background: linear-gradient(135deg, #0284c7 0%, #014486 100%);
          box-shadow: 0 6px 18px rgba(1, 118, 211, 0.4);
          transform: translateY(-1px);
        }

        .submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        /* ── Forgot Password Modal ── */
        .fp-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          backdrop-filter: blur(4px);
        }

        .fp-card {
          background: #ffffff;
          border-radius: 14px;
          padding: 24px;
          max-width: 400px;
          width: 90%;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        }

        .fp-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 14px;
        }

        .fp-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 800;
          color: #032d60;
        }

        .fp-close {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: #64748b;
        }

        .fp-text {
          font-size: 13px;
          color: #475569;
          line-height: 1.5;
          margin-bottom: 12px;
        }

        .fp-ok {
          width: 100%;
          padding: 10px;
          border-radius: 8px;
          background: #0176d3;
          color: #ffffff;
          border: none;
          font-weight: 700;
          cursor: pointer;
          margin-top: 8px;
        }

        .or-divider {
          display: flex;
          align-items: center;
          margin: 18px 0 14px;
          text-align: center;
        }

        .or-divider::before,
        .or-divider::after {
          content: '';
          flex: 1;
          border-bottom: 1px solid #e2e8f0;
        }

        .or-divider span {
          padding: 0 10px;
          color: #94a3b8;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.5px;
        }

        .switch-auth-btn {
          width: 100%;
          padding: 11px 16px;
          border-radius: 9px;
          background: #ffffff;
          color: #032d60;
          border: 1.5px solid #cbd5e1;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.15s ease-in-out;
        }

        .switch-auth-btn:hover {
          background: #f8fafc;
          border-color: #0176d3;
          color: #0176d3;
        }

        @media (max-width: 900px) {
          .login-wrapper { flex-direction: column; }
          .login-sidebar { width: 100%; padding: 32px 24px; }
          .login-main { padding: 32px 20px; }
        }
      `}</style>

      {/* ── Left Sidebar (School Theme & Thoughts) ── */}
      <div className="login-sidebar">
        <div className="sidebar-decor-1" />
        <div className="sidebar-decor-2" />

        {/* Top brand & Back link */}
        <div className="sidebar-top">
          <div className="brand-badge">
            <div className="brand-icon-box">
              <i className="ti ti-layers-linked" />
            </div>
            <div className="brand-title-text">
              OnePlatform<span>360</span>
            </div>
          </div>

          <a href="/" className="change-module-link" onClick={(e) => { e.preventDefault(); navigate('/'); }}>
            <i className="ti ti-arrow-left" />
            Change Suite
          </a>
        </div>

        {/* Main Center Content */}
        <div className="sidebar-center">
          <h1 className="sidebar-suite-title">EduERP Portal</h1>
          <div className="sidebar-suite-subtitle">School &amp; Academic Management Suite</div>

          {/* School Classroom & Students Visual Card */}
          <div className="school-visual-card">
            <div className="school-visual-avatar">
              🎓
            </div>
            <div>
              <div className="school-visual-heading">Smart Academic Campus</div>
              <div className="school-visual-text">
                Empowering students, teachers &amp; principals with automated digital workflows.
              </div>
            </div>
          </div>

          {/* Thought Box */}
          <div className="thought-card">
            <div className="thought-text">
              "Education is the most powerful weapon which you can use to change the world."
            </div>
            <div className="thought-author">— Nelson Mandela</div>
          </div>

          {/* Features */}
          <ul className="features-list">
            <li>
              <span className="feat-check"><i className="ti ti-check" /></span>
              <span>Student Admissions, Roll Numbers &amp; ID Cards</span>
            </li>
            <li>
              <span className="feat-check"><i className="ti ti-check" /></span>
              <span>Daily Attendance, Timetable &amp; Leave Requests</span>
            </li>
            <li>
              <span className="feat-check"><i className="ti ti-check" /></span>
              <span>Automated Fee Receipts &amp; Structure Management</span>
            </li>
            <li>
              <span className="feat-check"><i className="ti ti-check" /></span>
              <span>Exam Timetables, Admit Cards &amp; Result Cards</span>
            </li>
          </ul>
        </div>

        {/* Bottom Footer */}
        <div className="sidebar-footer">
          <div>
            Powered by <strong>OnePlatform360</strong>
          </div>
          <div>v2.5 Enterprise Cloud</div>
        </div>
      </div>

      {/* ── Right Login Form Panel ── */}
      <div className="login-main">
        <div className="login-card">

          <div className="login-header-wrap">
            <h2 className="login-main-title">Sign In</h2>
            <p className="login-main-desc">
              Access your institutional dashboard and student records.
            </p>
          </div>

          {/* Role Tabs */}
          <div className="tab-switcher">
            <button
              className={`tab-item ${activeTab === 'staff' ? 'active' : ''}`}
              onClick={() => { setActiveTab('staff'); setError(''); }}
            >
              <i className="ti ti-user-shield" />
              Staff / Admin
            </button>
            <button
              className={`tab-item ${activeTab === 'driver' ? 'active' : ''}`}
              onClick={() => { setActiveTab('driver'); setError(''); }}
            >
              <i className="ti ti-steering-wheel" />
              Driver (Bus App)
            </button>
            <button
              className={`tab-item ${activeTab === 'student' ? 'active' : ''}`}
              onClick={() => { setActiveTab('student'); setError(''); }}
            >
              <i className="ti ti-school" />
              Student / Parent
            </button>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="error-alert">
              <i className="ti ti-alert-circle" />
              <span>{error}</span>
            </div>
          )}

          {/* Driver Login Form */}
          {activeTab === 'driver' ? (
            <form onSubmit={handleStaffLogin}>
              <div className="input-group">
                <label className="input-label">Driver Mobile Number or Username</label>
                <div className="input-box-wrap">
                  <i className="ti ti-phone input-box-icon" />
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. 9876543210 or driver_ramesh"
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="input-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label className="input-label" style={{ margin: 0 }}>Driver Password</label>
                  <button
                    type="button"
                    className="forgot-link"
                    onClick={() => setShowForgot(true)}
                  >
                    Need Help?
                  </button>
                </div>
                <div className="input-box-wrap">
                  <i className="ti ti-lock input-box-icon" />
                  <input
                    type="password"
                    className="input-field"
                    placeholder="Enter your driver account password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="submit-btn"
                style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', boxShadow: '0 4px 14px rgba(217, 119, 6, 0.35)' }}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <i className="ti ti-loader-2 ti-spin" />
                    <span>Opening Driver App...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Driver App 🚌</span>
                    <i className="ti ti-arrow-right" />
                  </>
                )}
              </button>
            </form>
          ) : activeTab === 'staff' ? (
            authMethod === 'password' ? (
              /* Staff Password Login */
              <form onSubmit={handleStaffLogin}>
                <div className="input-group">
                  <label className="input-label">Email, Mobile or Username</label>
                  <div className="input-box-wrap">
                    <i className="ti ti-user input-box-icon" />
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. principal@school.com, 9876543210, or user_01"
                      value={identifier}
                      onChange={e => setIdentifier(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <div className="input-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <label className="input-label" style={{ margin: 0 }}>Password</label>
                    <button
                      type="button"
                      className="forgot-link"
                      onClick={() => setShowForgot(true)}
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="input-box-wrap">
                    <i className="ti ti-lock input-box-icon" />
                    <input
                      type="password"
                      className="input-field"
                      placeholder="Enter your account password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="submit-btn"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <i className="ti ti-loader-2 ti-spin" />
                      <span>Signing In...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In to School ERP</span>
                      <i className="ti ti-arrow-right" />
                    </>
                  )}
                </button>

                <div className="or-divider">
                  <span>OR</span>
                </div>
                <button
                  type="button"
                  className="switch-auth-btn"
                  onClick={() => { setAuthMethod('otp'); setOtpStep(1); setError(''); }}
                >
                  <i className="ti ti-device-mobile-message" style={{ fontSize: 16 }} />
                  <span>Login with OTP (Mobile / Email)</span>
                </button>
              </form>
            ) : (
              /* Staff OTP Login */
              <div>
                {otpSentMsg && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 14 }}>
                    <i className="ti ti-circle-check" style={{ marginRight: 6 }} />
                    {otpSentMsg}
                  </div>
                )}

                <div className="input-group">
                  <label className="input-label">Registered Mobile Number or Email</label>
                  <div className="input-box-wrap">
                    <i className="ti ti-user-check input-box-icon" />
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. 9876543210 or principal@school.com"
                      value={identifier}
                      onChange={e => setIdentifier(e.target.value)}
                      required
                      disabled={otpStep === 2}
                      autoFocus={otpStep === 1}
                    />
                  </div>
                </div>

                {otpStep === 1 ? (
                  <div>
                    {/* Method 1: Official MSG91 Widget Modal */}
                    <button
                      type="button"
                      className="submit-btn"
                      style={{
                        background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                        boxShadow: '0 4px 14px rgba(5, 150, 105, 0.35)',
                        marginBottom: 10
                      }}
                      onClick={() => openMsg91Widget()}
                      disabled={loading}
                    >
                      <i className="ti ti-shield-check" />
                      <span>{loading ? 'Connecting MSG91...' : 'Open MSG91 OTP Widget'}</span>
                    </button>

                    <div className="or-divider">
                      <span>OR DIRECT SMS OTP</span>
                    </div>

                    {/* Method 2: Direct SMS Gateway Request */}
                    <button
                      type="button"
                      className="switch-auth-btn"
                      style={{ borderColor: '#0176d3', color: '#0176d3' }}
                      onClick={handleSendLoginOtp}
                      disabled={loading}
                    >
                      <i className="ti ti-send" style={{ fontSize: 16 }} />
                      <span>Send SMS OTP to Mobile</span>
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleVerifyLoginOtp}>
                    <div className="input-group">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <label className="input-label" style={{ margin: 0 }}>Enter 6-Digit OTP</label>
                        <button
                          type="button"
                          className="forgot-link"
                          onClick={() => { setOtpStep(1); setOtpValue(''); setError(''); }}
                        >
                          Change identifier
                        </button>
                      </div>
                      <div className="input-box-wrap">
                        <i className="ti ti-shield-check input-box-icon" />
                        <input
                          type="text"
                          className="input-field"
                          placeholder="e.g. 123456"
                          maxLength={6}
                          value={otpValue}
                          onChange={e => setOtpValue(e.target.value)}
                          required
                          autoFocus
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="submit-btn"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <i className="ti ti-loader-2 ti-spin" />
                          <span>Verifying OTP...</span>
                        </>
                      ) : (
                        <>
                          <span>Verify &amp; Sign In</span>
                          <i className="ti ti-arrow-right" />
                        </>
                      )}
                    </button>

                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12, gap: 16 }}>
                      <button
                        type="button"
                        onClick={handleSendLoginOtp}
                        disabled={otpCooldown > 0 || loading}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: otpCooldown > 0 ? '#94a3b8' : '#0176d3',
                          cursor: otpCooldown > 0 ? 'default' : 'pointer',
                          fontSize: 13,
                          fontWeight: 600
                        }}
                      >
                        {otpCooldown > 0 ? `Resend OTP in ${otpCooldown}s` : 'Resend OTP'}
                      </button>
                      <button
                        type="button"
                        onClick={() => openMsg91Widget()}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#059669',
                          cursor: 'pointer',
                          fontSize: 13,
                          fontWeight: 600
                        }}
                      >
                        Try MSG91 Widget
                      </button>
                    </div>
                  </form>
                )}

                <div className="or-divider">
                  <span>OR</span>
                </div>
                <button
                  type="button"
                  className="switch-auth-btn"
                  onClick={() => { setAuthMethod('password'); setError(''); }}
                >
                  <i className="ti ti-lock" style={{ fontSize: 16 }} />
                  <span>Sign In with Password</span>
                </button>
              </div>
            )
          ) : (
            /* Student / Parent Login Form */
            <form onSubmit={handleStudentLogin}>
              <div className="input-group">
                <label className="input-label">Student Full Name</label>
                <div className="input-box-wrap">
                  <i className="ti ti-user input-box-icon" />
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Student full name as per records"
                    value={stuName}
                    onChange={e => setStuName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Father's / Guardian's Name</label>
                <div className="input-box-wrap">
                  <i className="ti ti-user-check input-box-icon" />
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Father's full name"
                    value={fatherName}
                    onChange={e => setFatherName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Registered Phone Number</label>
                <div className="input-box-wrap">
                  <i className="ti ti-phone input-box-icon" />
                  <input
                    type="tel"
                    className="input-field"
                    placeholder="10-digit mobile number"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="input-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label className="input-label" style={{ margin: 0 }}>Password / PIN</label>
                  <button
                    type="button"
                    className="forgot-link"
                    onClick={() => setShowForgot(true)}
                  >
                    Forgot PIN?
                  </button>
                </div>
                <div className="input-box-wrap">
                  <i className="ti ti-lock input-box-icon" />
                  <input
                    type="password"
                    className="input-field"
                    placeholder="Student portal password"
                    value={stuPass}
                    onChange={e => setStuPass(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="submit-btn"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <i className="ti ti-loader-2 ti-spin" />
                    <span>Verifying Student Portal...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Student Portal</span>
                    <i className="ti ti-arrow-right" />
                  </>
                )}
              </button>
            </form>
          )}

        </div>
      </div>

      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
    </div>
  );
}
