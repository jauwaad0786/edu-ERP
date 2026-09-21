import React from 'react';
import { colors } from '../../theme/colors';

export default function Badge({
  children,
  variant = 'info',
  size = 'sm',
  style = {},
}) {
  const getStyles = () => {
    switch (variant) {
      case 'success':
        return { bg: colors.successBg, text: colors.success, border: '#bbf7d0' };
      case 'warning':
        return { bg: colors.warningBg, text: colors.warning, border: '#fed7aa' };
      case 'error':
      case 'danger':
        return { bg: colors.errorBg, text: colors.error, border: '#fecaca' };
      case 'neutral':
        return { bg: colors.neutral1, text: colors.neutral9, border: colors.neutral2 };
      case 'info':
      default:
        return { bg: colors.infoBg, text: colors.info, border: '#bfdbfe' };
    }
  };

  const current = getStyles();

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: size === 'sm' ? '2px 8px' : '4px 12px',
        borderRadius: '999px',
        background: current.bg,
        color: current.text,
        border: `1px solid ${current.border}`,
        fontSize: size === 'sm' ? '11px' : '12.5px',
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '0.3px',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </span>
  );
}
