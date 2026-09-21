import React from 'react';
import { colors } from '../../theme/colors';

export default function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon = null,
  fullWidth = false,
  style = {},
}) {
  const getBackground = () => {
    if (disabled || loading) return '#cbd5e1';
    switch (variant) {
      case 'primary': return colors.primary;
      case 'secondary': return colors.neutral1;
      case 'outline': return 'transparent';
      case 'danger': return colors.error;
      case 'success': return colors.success;
      default: return colors.primary;
    }
  };

  const getColor = () => {
    if (disabled || loading) return '#64748b';
    switch (variant) {
      case 'primary': return '#ffffff';
      case 'secondary': return colors.neutral9;
      case 'outline': return colors.primary;
      case 'danger': return '#ffffff';
      case 'success': return '#ffffff';
      default: return '#ffffff';
    }
  };

  const getBorder = () => {
    if (variant === 'outline') {
      return `1.5px solid ${disabled ? '#cbd5e1' : colors.primary}`;
    }
    if (variant === 'secondary') {
      return `1px solid ${colors.neutral2}`;
    }
    return 'none';
  };

  const getPadding = () => {
    switch (size) {
      case 'sm': return '7px 12px';
      case 'lg': return '14px 24px';
      default: return '11px 18px';
    }
  };

  const getFontSize = () => {
    switch (size) {
      case 'sm': return '12px';
      case 'lg': return '15px';
      default: return '13.5px';
    }
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: getPadding(),
        background: getBackground(),
        color: getColor(),
        border: getBorder(),
        borderRadius: '12px',
        fontSize: getFontSize(),
        fontWeight: 700,
        width: fullWidth ? '100%' : 'auto',
        minHeight: size === 'sm' ? '34px' : size === 'lg' ? '48px' : '42px',
        boxShadow: variant === 'primary' && !disabled && !loading ? '0 2px 8px rgba(1,118,211,0.25)' : 'none',
        transition: 'all 0.15s ease',
        ...style,
      }}
    >
      {loading ? (
        <i className="ti ti-loader-2 spin" style={{ fontSize: '18px' }} />
      ) : (
        icon && <i className={`ti ${icon}`} style={{ fontSize: '18px' }} />
      )}
      {children}
    </button>
  );
}
