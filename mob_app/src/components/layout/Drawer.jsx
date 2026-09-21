import React from 'react';
import { colors } from '../../theme/colors';
import { useAuth } from '../../auth/AuthContext';
import { appConfig } from '../../config/appConfig';

export default function Drawer({
  isOpen,
  onClose,
  onNavigate,
  menuItems = [],
  activeKey = '',
}) {
  const { user, role, logout } = useAuth();

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 100,
      display: 'flex',
    }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.5)',
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Drawer Container */}
      <div style={{
        position: 'relative',
        width: '280px',
        maxWidth: '82%',
        height: '100%',
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '4px 0 24px rgba(0, 0, 0, 0.15)',
        zIndex: 101,
      }}>
        {/* User Info Header */}
        <div style={{
          padding: '24px 20px 18px',
          background: `linear-gradient(135deg, ${colors.primaryDark}, ${colors.primary})`,
          color: '#ffffff',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
            <div style={{
              width: '50px',
              height: '50px',
              borderRadius: '14px',
              background: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              fontWeight: 900,
            }}>
              {(user?.name || user?.username || 'U').charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '15px', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.name || user?.username || 'ERP User'}
              </div>
              <div style={{ fontSize: '12px', opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.email || user?.phone || 'Authenticated User'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
            <span style={{
              padding: '2px 8px',
              borderRadius: '6px',
              background: 'rgba(255,255,255,0.25)',
              fontWeight: 800,
              letterSpacing: '0.3px',
            }}>
              {role}
            </span>
            <span style={{ opacity: 0.8 }}>
              {user?.current_session || appConfig.defaultSession}
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="scrollable" style={{ flex: 1, padding: '12px 10px' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', padding: '6px 12px', textTransform: 'uppercase' }}>
            ERP Modules
          </div>

          {menuItems.map((item) => {
            const isSelected = activeKey === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  onNavigate(item.key);
                  onClose();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '12px',
                  background: isSelected ? colors.primaryLight : 'transparent',
                  color: isSelected ? colors.primary : colors.neutral9,
                  fontSize: '13.5px',
                  fontWeight: isSelected ? 800 : 600,
                  marginBottom: '3px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <i className={`ti ${item.icon}`} style={{ fontSize: '19px', color: isSelected ? colors.primary : '#94a3b8' }} />
                <span style={{ flex: 1 }}>{item.label}</span>
              </button>
            );
          })}

          <div style={{ height: '1px', background: colors.divider, margin: '12px 0' }} />

          <button
            type="button"
            onClick={() => {
              onNavigate('settings');
              onClose();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '11px 14px',
              borderRadius: '12px',
              background: activeKey === 'settings' ? colors.primaryLight : 'transparent',
              color: activeKey === 'settings' ? colors.primary : colors.neutral9,
              fontSize: '13.5px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <i className="ti ti-settings" style={{ fontSize: '19px', color: '#94a3b8' }} />
            <span>Settings &amp; About</span>
          </button>
        </div>

        {/* Logout Footer */}
        <div style={{
          padding: '14px 16px',
          borderTop: `1px solid ${colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <button
            type="button"
            onClick={logout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'none',
              border: 'none',
              color: colors.error,
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            <i className="ti ti-logout" style={{ fontSize: '18px' }} />
            <span>Sign Out</span>
          </button>

          <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>
            v{appConfig.version}
          </span>
        </div>
      </div>
    </div>
  );
}
