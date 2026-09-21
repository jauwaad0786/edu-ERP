import React from 'react';
import { colors } from '../../theme/colors';
import Button from './Button';

export default function EmptyState({
  icon = 'ti-files-off',
  title = 'No records found',
  description = 'There are no active records in this module yet.',
  actionText = null,
  onAction = null,
}) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
      textAlign: 'center',
      background: '#ffffff',
      borderRadius: '16px',
      border: `1px solid ${colors.border}`,
      margin: '12px 0',
    }}>
      <div style={{
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        background: colors.neutral1,
        color: colors.neutral6,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '26px',
        marginBottom: '12px',
      }}>
        <i className={`ti ${icon}`} />
      </div>
      <h4 style={{ fontSize: '15px', fontWeight: 800, color: colors.neutral10, margin: '0 0 6px' }}>
        {title}
      </h4>
      <p style={{ fontSize: '12.5px', color: colors.neutral6, margin: '0 0 16px', maxWidth: '280px', lineHeight: 1.4 }}>
        {description}
      </p>
      {actionText && onAction && (
        <Button size="sm" onClick={onAction}>
          {actionText}
        </Button>
      )}
    </div>
  );
}
