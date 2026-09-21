import React, { useState } from 'react';
import authService from '../../api/services/authService';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';

export default function ChangePasswordScreen({ onNavigate }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ text: '', isError: false });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      setStatusMsg({ text: 'Please fill in all fields.', isError: true });
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatusMsg({ text: 'New passwords do not match.', isError: true });
      return;
    }
    if (newPassword.length < 6) {
      setStatusMsg({ text: 'Password must be at least 6 characters long.', isError: true });
      return;
    }

    setLoading(true);
    setStatusMsg({ text: '', isError: false });

    try {
      await authService.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setStatusMsg({ text: 'Password changed successfully!', isError: false });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Failed to update password.';
      setStatusMsg({ text: msg, isError: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Button variant="ghost" size="small" onClick={() => onNavigate('SETTINGS')}>
          ← Back
        </Button>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--color-navy)' }}>
          Change Password
        </h2>
      </div>

      <Card>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Input
            label="Current Password"
            type="password"
            placeholder="Enter current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />

          <Input
            label="New Password"
            type="password"
            placeholder="Enter at least 6 characters"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />

          <Input
            label="Confirm New Password"
            type="password"
            placeholder="Repeat new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          {statusMsg.text && (
            <div
              style={{
                fontSize: '13px',
                color: statusMsg.isError ? 'var(--color-error)' : 'var(--color-success)',
                fontWeight: '600',
              }}
            >
              {statusMsg.isError ? '✗ ' : '✓ '}
              {statusMsg.text}
            </div>
          )}

          <Button type="submit" variant="primary" loading={loading} fullWidth>
            Update Password
          </Button>
        </form>
      </Card>
    </div>
  );
}
