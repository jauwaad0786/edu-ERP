import React, { useState } from 'react';
import { colors } from '../../theme/colors';
import { useAuth } from '../../auth/AuthContext';
import { appConfig } from '../../config/appConfig';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';

export default function LoginScreen({ onSwitchToStudentLogin }) {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!identifier.trim() || !password.trim()) {
      setError('Please enter your identifier and password');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await login(identifier.trim(), password);
    } catch (err) {
      setError(err.readableMessage || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      height: '100%',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: '#ffffff',
      overflowY: 'auto',
    }}>
      {/* Top Banner with Brand Gradient */}
      <div style={{
        background: `linear-gradient(135deg, ${colors.primaryDark}, ${colors.primary})`,
        padding: '50px 24px 34px',
        color: '#ffffff',
        borderBottomLeftRadius: '28px',
        borderBottomRightRadius: '28px',
        textAlign: 'center',
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '18px',
          background: 'rgba(255, 255, 255, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 14px',
          fontSize: '32px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        }}>
          <i className="ti ti-school" />
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: 900, letterSpacing: '-0.5px', margin: 0 }}>
          {appConfig.appName}
        </h1>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', marginTop: '4px' }}>
          School &amp; College ERP Portal
        </p>
      </div>

      {/* Form Container */}
      <div style={{ flex: 1, padding: '28px 24px' }}>
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: colors.neutral10, margin: '0 0 4px' }}>
            Welcome Back
          </h2>
          <p style={{ fontSize: '13px', color: colors.neutral6 }}>
            Sign in with your registered email, mobile number, or employee/student ID
          </p>
        </div>

        {error && (
          <div style={{
            padding: '12px 14px',
            borderRadius: '12px',
            background: colors.errorBg,
            border: `1px solid #fecaca`,
            color: colors.error,
            fontSize: '12.5px',
            fontWeight: 600,
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <i className="ti ti-alert-circle" style={{ fontSize: '18px' }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <Input
            label="Email / Mobile / Username"
            placeholder="e.g. teacher@school.edu or 9876543210"
            icon="ti-user"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
          />

          <Input
            label="Password"
            type="password"
            placeholder="Enter your password"
            icon="ti-lock"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <div style={{ marginTop: '20px' }}>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
              icon="ti-login"
            >
              Sign In to ERP
            </Button>
          </div>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <button
            type="button"
            onClick={onSwitchToStudentLogin}
            style={{
              background: 'none',
              border: 'none',
              color: colors.primary,
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <i className="ti ti-id" /> Student? Sign in with Parent Mobile &amp; Name
          </button>
        </div>

        <div style={{ marginTop: '40px', textAlign: 'center', fontSize: '11.5px', color: '#94a3b8' }}>
          <div>{appConfig.company} • Version {appConfig.version} (Build {appConfig.buildNumber})</div>
          <div style={{ marginTop: '2px' }}>Connecting to Live Enterprise Cloud</div>
        </div>
      </div>
    </div>
  );
}
