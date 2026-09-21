import React from 'react';
import { colors } from '../../theme/colors';

export default function BottomNav({ activeTab, onTabChange, tabs = [] }) {
  if (!tabs || tabs.length === 0) return null;

  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-around',
      background: '#ffffff',
      borderTop: `1px solid ${colors.border}`,
      height: '58px',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      position: 'sticky',
      bottom: 0,
      zIndex: 40,
    }}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              color: isActive ? colors.primary : '#94a3b8',
              padding: '6px 0',
              cursor: 'pointer',
              transition: 'color 0.15s ease',
            }}
          >
            <i className={`ti ${tab.icon}`} style={{ fontSize: '20px', marginBottom: '2px' }} />
            <span style={{ fontSize: '11px', fontWeight: isActive ? 800 : 600 }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
