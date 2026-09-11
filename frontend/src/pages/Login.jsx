import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  // Unified login credentials
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [copiedSupport, setCopiedSupport] = useState(false);

  const handleUnifiedLogin = async e => {
    e.preventDefault();
    const cleanId = identifier.trim();
    if (!cleanId || !password.trim()) {
      setError('Please enter your email, mobile number, or username, and your password.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      await login(cleanId, password);
      navigate('/dashboard');
    } catch (err) {
      setError(
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Invalid credentials. Please verify your email/mobile and password.'
      );
    } finally {
      setLoading(false);
    }
  };

  const copySupportEmail = () => {
    navigator.clipboard.writeText('support@oneplatform360.com');
    setCopiedSupport(true);
    setTimeout(() => setCopiedSupport(false), 2500);
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

        /* ── Left Hero Sidebar ── */
        .login-sidebar {
          width: 46%;
          background: linear-gradient(145deg, #032d60 0%, #084c8d 60%, #0176d3 100%);
          color: #ffffff;
          padding: 44px 50px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
          overflow: hidden;
          box-shadow: 4px 0 28px rgba(0, 0, 0, 0.09);
        }

        .sidebar-decor-1 {
          position: absolute;
          width: 440px;
          height: 440px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0) 70%);
          top: -140px;
          right: -140px;
          pointer-events: none;
        }

        .sidebar-decor-2 {
          position: absolute;
          width: 360px;
          height: 360px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, rgba(255,255,255,0) 70%);
          bottom: -110px;
          left: -90px;
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
          gap: 12px;
        }

        .brand-icon-box {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.22);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          backdrop-filter: blur(8px);
        }

        .brand-title-text {
          font-size: 17px;
          font-weight: 800;
          letter-spacing: -0.02em;
        }

        .brand-title-text span {
          color: #38bdf8;
        }

        .change-module-link {
          color: rgba(255, 255, 255, 0.9);
          font-size: 12px;
          font-weight: 700;
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.2);
          transition: all 0.2s;
        }

        .change-module-link:hover {
          background: rgba(255, 255, 255, 0.22);
          color: #ffffff;
        }

        .sidebar-center {
          margin: 36px 0;
          position: relative;
          z-index: 2;
        }

        .sidebar-suite-title {
          font-size: 2.3rem;
          font-weight: 900;
          line-height: 1.15;
          letter-spacing: -0.03em;
          margin-bottom: 6px;
        }

        .sidebar-suite-subtitle {
          font-size: 14px;
          color: #bae6fd;
          font-weight: 600;
          margin-bottom: 26px;
        }

        .school-visual-card {
          background: rgba(255, 255, 255, 0.11);
          border: 1px solid rgba(255, 255, 255, 0.22);
          border-radius: 14px;
          padding: 18px 20px;
          backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 22px;
        }

        .school-visual-avatar {
          width: 54px;
          height: 54px;
          border-radius: 12px;
          background: linear-gradient(135deg, #38bdf8 0%, #0284c7 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          flex-shrink: 0;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
        }

        .school-visual-heading {
          font-size: 14.5px;
          font-weight: 800;
          color: #ffffff;
          margin-bottom: 3px;
        }

        .school-visual-text {
          font-size: 12.5px;
          color: rgba(255, 255, 255, 0.88);
          line-height: 1.45;
        }

        .thought-card {
          background: rgba(3, 45, 96, 0.45);
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

        .features-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 11px;
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
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          color: #38bdf8;
          flex-shrink: 0;
        }

        .sidebar-footer {
          position: relative;
          z-index: 2;
          border-top: 1px solid rgba(255, 255, 255, 0.15);
          padding-top: 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.78);
        }

        .sidebar-footer strong {
          color: #ffffff;
          font-weight: 800;
        }

        /* ── Right Login Area ── */
        .login-main {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 44px 36px;
          background: #ffffff;
        }

        .login-card {
          width: 100%;
          max-width: 440px;
        }

        .login-header-wrap {
          margin-bottom: 28px;
        }

        .login-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 6px;
          background: #e0f2fe;
          color: #0284c7;
          font-size: 11.5px;
          font-weight: 800;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          margin-bottom: 12px;
        }

        .login-main-title {
          font-size: 1.95rem;
          font-weight: 900;
          color: #032d60;
          letter-spacing: -0.025em;
          margin: 0 0 6px 0;
        }

        .login-main-desc {
          font-size: 13.5px;
          color: #64748b;
          margin: 0;
          line-height: 1.5;
        }

        .error-alert {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
          padding: 11px 14px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-label-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 7px;
        }

        .form-label {
          font-size: 13px;
          font-weight: 700;
          color: #334155;
          margin: 0;
        }

        .forgot-link-btn {
          font-size: 12.5px;
          font-weight: 700;
          color: #0176d3;
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          transition: color 0.15s;
        }

        .forgot-link-btn:hover {
          color: #084c8d;
          text-decoration: underline;
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
          font-size: 17px;
          pointer-events: none;
        }

        .input-field {
          width: 100%;
          padding: 13px 42px 13px 44px;
          border-radius: 10px;
          border: 1.5px solid #cbd5e1;
          font-size: 14px;
          color: #0f172a;
          outline: none;
          transition: all 0.2s;
          font-family: inherit;
          background: #fdfdfd;
        }

        .input-field:focus {
          background: #ffffff;
          border-color: #0176d3;
          box-shadow: 0 0 0 3px rgba(1, 118, 211, 0.14);
        }

        .toggle-pw-btn {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 4px;
          font-size: 17px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .toggle-pw-btn:hover {
          color: #475569;
        }

        .submit-btn {
          width: 100%;
          padding: 14px;
          border-radius: 10px;
          background: linear-gradient(135deg, #0176d3 0%, #032d60 100%);
          color: #ffffff;
          font-size: 14.5px;
          font-weight: 800;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 4px 16px rgba(1, 118, 211, 0.32);
          margin-top: 24px;
        }

        .submit-btn:hover {
          background: linear-gradient(135deg, #0284c7 0%, #014486 100%);
          box-shadow: 0 6px 20px rgba(1, 118, 211, 0.42);
          transform: translateY(-1px);
        }

        .submit-btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
          transform: none;
        }

        .security-badge-footer {
          margin-top: 28px;
          padding-top: 20px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 12px;
          color: #64748b;
          text-align: center;
        }

        /* ── Professional Forgot Password Modal ── */
        .modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(15, 23, 42, 0.65);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999;
          backdrop-filter: blur(6px);
          padding: 20px;
        }

        .modal-dialog {
          background: #ffffff;
          border-radius: 16px;
          max-width: 520px;
          width: 100%;
          box-shadow: 0 20px 45px rgba(0, 0, 0, 0.25);
          overflow: hidden;
          animation: modalAppear 0.2s ease-out;
        }

        @keyframes modalAppear {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }

        .modal-header {
          padding: 20px 24px;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .modal-title-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .modal-title-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: #e0f2fe;
          color: #0284c7;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
        }

        .modal-title {
          margin: 0;
          font-size: 16px;
          font-weight: 800;
          color: #0f172a;
        }

        .modal-close-btn {
          background: none;
          border: none;
          font-size: 20px;
          color: #94a3b8;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
        }

        .modal-close-btn:hover {
          background: #e2e8f0;
          color: #334155;
        }

        .modal-body {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .notice-card {
          border-radius: 12px;
          padding: 16px 18px;
          display: flex;
          gap: 14px;
          align-items: flex-start;
        }

        .notice-card.school-users {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
        }

        .notice-card.principal-users {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
        }

        .notice-icon-box {
          font-size: 24px;
          line-height: 1;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .notice-heading {
          font-size: 14px;
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 4px;
        }

        .notice-text {
          font-size: 12.5px;
          line-height: 1.5;
          color: #334155;
          margin: 0;
        }

        .support-action-box {
          margin-top: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .support-email-badge {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          padding: 5px 10px;
          border-radius: 6px;
          font-family: monospace;
          font-size: 12px;
          font-weight: 700;
          color: #032d60;
        }

        .copy-email-btn {
          background: #0176d3;
          color: #ffffff;
          border: none;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          transition: background 0.15s;
        }

        .copy-email-btn:hover {
          background: #0284c7;
        }

        .modal-footer {
          padding: 14px 24px;
          background: #f8fafc;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: flex-end;
        }

        .modal-ok-btn {
          padding: 10px 22px;
          border-radius: 8px;
          background: #032d60;
          color: #ffffff;
          border: none;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.15s;
        }

        .modal-ok-btn:hover {
          background: #0176d3;
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

        {/* Top brand */}
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
              <div className="school-visual-heading">Unified Academic Gateway</div>
              <div className="school-visual-text">
                One secure sign-in experience for Principals, Teachers, Staff, Drivers, Students and Parents.
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
              <span>Student Admissions, Roll Numbers &amp; Digital ID Cards</span>
            </li>
            <li>
              <span className="feat-check"><i className="ti ti-check" /></span>
              <span>Daily Attendance, Timetable &amp; Leave Tracking</span>
            </li>
            <li>
              <span className="feat-check"><i className="ti ti-check" /></span>
              <span>Automated Fee Receipts &amp; Real-Time Financial Ledger</span>
            </li>
            <li>
              <span className="feat-check"><i className="ti ti-check" /></span>
              <span>Bus Fleet Telemetry &amp; Driver Safety Tracking</span>
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
            <div className="login-badge">
              <i className="ti ti-shield-check" /> Unified Authentication
            </div>
            <h2 className="login-main-title">Sign In</h2>
            <p className="login-main-desc">
              Enter your registered email address or mobile number to access your institutional dashboard.
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="error-alert" role="alert">
              <i className="ti ti-alert-circle" style={{ fontSize: 18 }} />
              <span>{error}</span>
            </div>
          )}

          {/* 
            Semantic HTML form fully compatible with Browser Password Managers
            (Chrome/Google Password Manager, Safari Keychain, Edge, Firefox).
          */}
          <form
            onSubmit={handleUnifiedLogin}
            autoComplete="on"
            method="POST"
            action="#"
            id="unified-login-form"
          >
            {/* Identifier: Email, Mobile or Username */}
            <div className="form-group">
              <div className="form-label-row">
                <label htmlFor="login-identifier" className="form-label">
                  Email or Mobile Number
                </label>
              </div>
              <div className="input-box-wrap">
                <i className="ti ti-user input-box-icon" />
                <input
                  id="login-identifier"
                  name="username"
                  type="text"
                  autoComplete="username"
                  className="input-field"
                  placeholder="e.g. principal@school.com or 9876543210"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            </div>

            {/* Password */}
            <div className="form-group">
              <div className="form-label-row">
                <label htmlFor="login-password" className="form-label">
                  Password
                </label>
                <button
                  type="button"
                  className="forgot-link-btn"
                  onClick={() => setShowForgotModal(true)}
                >
                  Forgot Password?
                </button>
              </div>
              <div className="input-box-wrap">
                <i className="ti ti-lock input-box-icon" />
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="input-field"
                  placeholder="Enter your account password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="toggle-pw-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  <i className={showPassword ? 'ti ti-eye-off' : 'ti ti-eye'} />
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              id="login-submit-btn"
              className="submit-btn"
              disabled={loading}
            >
              {loading ? (
                <>
                  <i className="ti ti-loader-2 ti-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In to School ERP</span>
                  <i className="ti ti-arrow-right" />
                </>
              )}
            </button>
          </form>

          <div className="security-badge-footer">
            <i className="ti ti-lock" style={{ color: '#059669' }} />
            <span>Encrypted Authentication • Password Manager Compatible</span>
          </div>

        </div>
      </div>

      {/* ── Forgot Password Security Directive Modal ── */}
      {showForgotModal && (
        <div className="modal-overlay" onClick={() => setShowForgotModal(false)}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-row">
                <div className="modal-title-icon">
                  <i className="ti ti-key" />
                </div>
                <h3 className="modal-title">Password Reset &amp; Account Recovery</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowForgotModal(false)}
                title="Close"
              >
                <i className="ti ti-x" />
              </button>
            </div>

            <div className="modal-body">
              {/* For School Users (Students, Parents, Teachers, Staff, Drivers) */}
              <div className="notice-card school-users">
                <div className="notice-icon-box">🏫</div>
                <div>
                  <div className="notice-heading">Students, Teachers, Staff &amp; Drivers</div>
                  <p className="notice-text">
                    Password reset is managed by your school administrator. Please contact your <strong>Principal or School Administrator</strong> to reset your password. Once updated, your administrator will securely provide your new temporary credentials.
                  </p>
                </div>
              </div>

              {/* For Principals & Institutional Administrators */}
              <div className="notice-card principal-users">
                <div className="notice-icon-box">🛡️</div>
                <div>
                  <div className="notice-heading">Principal &amp; Institutional Administrator Accounts</div>
                  <p className="notice-text">
                    To maintain institution-wide data protection, public self-service password reset is restricted for Principal accounts. Please contact <strong>OnePlatform360 Authorized Support</strong> for identity verification and secure account recovery:
                  </p>
                  <div className="support-action-box">
                    <span className="support-email-badge">support@oneplatform360.com</span>
                    <button
                      type="button"
                      className="copy-email-btn"
                      onClick={copySupportEmail}
                    >
                      <i className={copiedSupport ? 'ti ti-check' : 'ti ti-copy'} />
                      {copiedSupport ? 'Copied!' : 'Copy Support Email'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="modal-ok-btn"
                onClick={() => setShowForgotModal(false)}
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
