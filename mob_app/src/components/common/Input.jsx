import React, { useState } from 'react';
import { colors } from '../../theme/colors';

export default function Input({
  label,
  value,
  onChange,
  type = 'text',
  placeholder = '',
  icon = null,
  error = null,
  disabled = false,
  required = false,
  style = {},
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const actualType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px', width: '100%' }}>
      {label && (
        <label style={{ fontSize: '12.5px', fontWeight: 700, color: colors.neutral9 }}>
          {label} {required && <span style={{ color: colors.error }}>*</span>}
        </label>
      )}

      <div style={{
        display: 'flex',
        alignItems: 'center',
        background: '#ffffff',
        border: `1.5px solid ${error ? colors.error : colors.border}`,
        borderRadius: '12px',
        padding: '0 14px',
        height: '46px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        transition: 'border-color 0.15s ease',
        ...style,
      }}>
        {icon && (
          <i className={`ti ${icon}`} style={{ fontSize: '18px', color: '#94a3b8', marginRight: '10px' }} />
        )}

        <input
          type={actualType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          style={{
            flex: 1,
            border: 'none',
            background: 'transparent',
            fontSize: '14px',
            fontWeight: 600,
            color: colors.neutral10,
            width: '100%',
          }}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              background: 'none',
              border: 'none',
              padding: '4px',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <i className={`ti ${showPassword ? 'ti-eye-off' : 'ti-eye'}`} style={{ fontSize: '18px' }} />
          </button>
        )}
      </div>

      {error && (
        <span style={{ fontSize: '11px', color: colors.error, fontWeight: 600, marginTop: '2px' }}>
          {error}
        </span>
      )}
    </div>
  );
}
