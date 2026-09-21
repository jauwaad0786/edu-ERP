import React from 'react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { appConfig } from '../../config/appConfig';
import { getBaseUrl } from '../../api/config';

export default function AboutScreen({ onNavigate }) {
  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Button variant="ghost" size="small" onClick={() => onNavigate('SETTINGS')}>
          ← Back
        </Button>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--color-navy)' }}>
          About Edu ERP
        </h2>
      </div>

      <Card>
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-navy))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: '28px',
              fontWeight: '800',
              margin: '0 auto 12px',
              boxShadow: '0 8px 24px rgba(1, 118, 211, 0.3)',
            }}
          >
            E
          </div>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--color-navy)' }}>
            Edu ERP Mobile
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            Enterprise Campus Management System
          </p>
        </div>

        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>Version</span>
            <span style={{ fontWeight: '600', color: 'var(--color-navy)' }}>{appConfig.version}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>Build Number</span>
            <span style={{ fontWeight: '600', color: 'var(--color-navy)' }}>{appConfig.buildNumber}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>Application ID</span>
            <span style={{ fontWeight: '600', color: 'var(--color-navy)' }}>{appConfig.appId}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>API Architecture</span>
            <span style={{ fontWeight: '600', color: 'var(--color-navy)' }}>Runtime REST / Bearer</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>Current API Endpoint:</span>
            <span style={{ fontWeight: '600', color: 'var(--color-primary)', wordBreak: 'break-all', fontSize: '12px' }}>
              {getBaseUrl()}
            </span>
          </div>
        </div>
      </Card>

      <Card>
        <h4 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: '700', color: 'var(--color-navy)' }}>
          Supported User Roles
        </h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {appConfig.supportedRoles.map((role) => (
            <span
              key={role}
              style={{
                fontSize: '11px',
                padding: '3px 8px',
                background: 'var(--color-bg)',
                borderRadius: '4px',
                border: '1px solid var(--color-border)',
                fontWeight: '600',
                color: 'var(--color-navy)',
              }}
            >
              {role}
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}
