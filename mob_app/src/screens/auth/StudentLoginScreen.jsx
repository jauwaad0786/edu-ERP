import React, { useState } from 'react';
import { colors } from '../../theme/colors';
import { useAuth } from '../../auth/AuthContext';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';

export default function StudentLoginScreen({ onBackToUnifiedLogin }) {
  const { studentLogin } = useAuth();
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!phone.trim() || !name.trim() || !password.trim()) {
      setError('Please provide parent mobile, student name, and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await studentLogin(phone.trim(), name.trim(), password, fatherName.trim());
    } catch (err) {
      setError(err.readableMessage || 'Login failed. Check student name spelling and mobile.');
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
      {/* Top Header */}
      <div style={{
        padding: '24px 20px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        borderBottom: `1px solid ${colors.border}`,
      }}>
        <button
          type="button"
          onClick={onBackToUnifiedLogin}
          style={{
            background: colors.neutral1,
            border: 'none',
            borderRadius: '10px',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            color: colors.neutral9,
            cursor: 'pointer',
          }}
        >
          <i className="ti ti-arrow-left" />
        </button>
        <div>
          <h2 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: colors.neutral10 }}>
            Student Direct Portal
          </h2>
          <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>
            Multi-sibling safe authentication
          </div>
        </div>
      </div>

      <div style={{ flex: 1, padding: '24px 20px' }}>
        <div style={{
          padding: '12px 14px',
          background: colors.primaryLight,
          borderRadius: '12px',
          marginBottom: '20px',
          fontSize: '12px',
          color: colors.primaryDark,
          lineHeight: 1.4,
          display: 'flex',
          gap: '8px',
        }}>
          <i className="ti ti-info-circle" style={{ fontSize: '18px', flexShrink: 0, color: colors.primary }} />
          <span>If multiple siblings share the same registered mobile number, enter father's name as a tiebreaker.</span>
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
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <Input
            label="Parent / Guardian Mobile Number"
            placeholder="10-digit mobile number"
            icon="ti-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />

          <Input
            label="Student Full Name"
            placeholder="As registered in school records"
            icon="ti-user"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Input
            label="Father's Name (Optional tiebreaker)"
            placeholder="Required only if siblings share name"
            icon="ti-users"
            value={fatherName}
            onChange={(e) => setFatherName(e.target.value)}
          />

          <Input
            label="Student Password"
            type="password"
            placeholder="Enter student password"
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
              Sign In as Student
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
