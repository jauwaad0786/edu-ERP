import React, { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { appConfig } from '../../config/appConfig';
import { getBaseUrl, setCustomBaseUrl } from '../../api/config';

export default function SettingsScreen({ onNavigate }) {
  const { user, userRole, logout } = useAuth();
  const [serverUrl, setServerUrl] = useState(getBaseUrl());
  const [savedMsg, setSavedMsg] = useState('');

  const handleSaveUrl = () => {
    setCustomBaseUrl(serverUrl);
    setSavedMsg('Server endpoint updated! Changes take effect immediately.');
    setTimeout(() => setSavedMsg(''), 3000);
  };

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: 'var(--color-navy)' }}>
        Application Settings
      </h2>

      {/* Profile summary */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '24px',
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-navy))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontWeight: '700',
              fontSize: '18px',
            }}
          >
            {user?.name?.[0] || 'U'}
          </div>
          <div>
            <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--color-navy)' }}>
              {user?.name || 'Logged In User'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              {user?.email || user?.username || 'No email provided'}
            </div>
            <div style={{ marginTop: '4px' }}>
              <Badge variant="primary" label={userRole || 'USER'} />
            </div>
          </div>
        </div>
      </Card>

      {/* Account actions */}
      <Card>
        <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: '700', color: 'var(--color-navy)' }}>
          Security & Account
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Button
            variant="outline"
            fullWidth
            onClick={() => onNavigate('CHANGE_PASSWORD')}
          >
            Change Password
          </Button>
          <Button
            variant="outline"
            fullWidth
            onClick={() => onNavigate('ABOUT')}
          >
            About Edu ERP Mobile
          </Button>
        </div>
      </Card>

      {/* Server Endpoint Configuration (Configurable without rebuild) */}
      <Card>
        <h3 style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: '700', color: 'var(--color-navy)' }}>
          Backend Server Endpoint
        </h3>
        <p style={{ margin: '0 0 12px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
          Current API Base URL dynamically loaded at runtime:
        </p>
        <input
          type="text"
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: '6px',
            border: '1px solid var(--color-border)',
            fontSize: '13px',
            fontFamily: 'monospace',
            boxSizing: 'border-box',
            marginBottom: '10px',
          }}
        />
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="primary" size="small" onClick={handleSaveUrl}>
            Save Endpoint
          </Button>
          <Button
            variant="ghost"
            size="small"
            onClick={() => {
              setServerUrl(appConfig.api.productionUrl);
              setCustomBaseUrl(appConfig.api.productionUrl);
              setSavedMsg('Reset to default production endpoint.');
              setTimeout(() => setSavedMsg(''), 3000);
            }}
          >
            Reset Default
          </Button>
        </div>
        {savedMsg && (
          <div style={{ fontSize: '12px', color: 'var(--color-success)', marginTop: '8px', fontWeight: '600' }}>
            ✓ {savedMsg}
          </div>
        )}
      </Card>

      {/* Logout button */}
      <Button variant="danger" fullWidth onClick={logout}>
        Log Out of Account
      </Button>

      {/* App Version Info */}
      <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--color-text-secondary)', padding: '8px 0' }}>
        Edu ERP Mobile v{appConfig.version} (Build {appConfig.buildNumber})
      </div>
    </div>
  );
}
