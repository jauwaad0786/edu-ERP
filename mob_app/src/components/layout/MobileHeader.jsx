import React from 'react';
import { colors } from '../../theme/colors';
import { useAuth } from '../../auth/AuthContext';

export default function MobileHeader({
  title,
  showBack = false,
  onBack = null,
  onOpenDrawer = null,
  rightAction = null,
}) {
  const { user } = useAuth();
  const schoolName = user?.school_name || user?.school?.name || 'Edu ERP Cloud';

  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 16px',
      background: '#ffffff',
      borderBottom: `1px solid ${colors.border}`,
      minHeight: '56px',
      position: 'sticky',
      top: 0,
      zIndex: 40,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {showBack ? (
          <button
            type="button"
            onClick={onBack}
            style={{
              background: 'none',
              border: 'none',
              color: colors.neutral9,
              fontSize: '20px',
              padding: '6px',
              cursor: 'pointer',
              display: 'flex',
            }}
          >
            <i className="ti ti-arrow-left" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenDrawer}
            style={{
              background: 'none',
              border: 'none',
              color: colors.neutral9,
              fontSize: '22px',
              padding: '6px',
              cursor: 'pointer',
              display: 'flex',
            }}
          >
            <i className="ti ti-menu-2" />
          </button>
        )}

        <div>
          <h1 style={{ fontSize: '16px', fontWeight: 800, color: colors.neutral10, margin: 0, lineHeight: 1.2 }}>
            {title}
          </h1>
          <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>
            {schoolName}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {rightAction}
      </div>
    </header>
  );
}
