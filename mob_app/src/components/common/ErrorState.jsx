import React from 'react';
import { colors } from '../../theme/colors';
import Button from './Button';

export default function ErrorState({
  message = 'Unable to connect to school server',
  onRetry = null,
}) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '30px 20px',
      textAlign: 'center',
      background: '#fff',
      borderRadius: '16px',
      border: `1px solid #fecaca`,
      margin: '12px 0',
    }}>
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        background: colors.errorBg,
        color: colors.error,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '22px',
        marginBottom: '10px',
      }}>
        <i className="ti ti-alert-triangle" />
      </div>
      <h4 style={{ fontSize: '14.5px', fontWeight: 800, color: colors.neutral10, margin: '0 0 6px' }}>
        Failed to load data
      </h4>
      <p style={{ fontSize: '12.5px', color: colors.error, margin: '0 0 14px', maxWidth: '300px' }}>
        {message}
      </p>
      {onRetry && (
        <Button size="sm" variant="secondary" icon="ti-refresh" onClick={onRetry}>
          Try Again
        </Button>
      )}
    </div>
  );
}
