import React from 'react';
import { colors } from '../../theme/colors';

export default function LoadingState({ message = 'Loading live data...' }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      gap: '12px',
    }}>
      <i className="ti ti-loader-2 spin" style={{ fontSize: '32px', color: colors.primary }} />
      <span style={{ fontSize: '13px', fontWeight: 600, color: colors.neutral6 }}>
        {message}
      </span>
    </div>
  );
}
