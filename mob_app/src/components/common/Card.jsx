import React from 'react';
import { colors } from '../../theme/colors';

export default function Card({
  children,
  style = {},
  onClick = null,
  padding = '16px',
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: '#ffffff',
        borderRadius: '16px',
        border: `1px solid ${colors.border}`,
        padding,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
        marginBottom: '14px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.1s ease, box-shadow 0.1s ease',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
