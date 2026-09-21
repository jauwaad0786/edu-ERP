import React from 'react';

export default function ScreenContainer({ children, padding = '16px', style = {} }) {
  return (
    <div
      className="scrollable fade-in"
      style={{
        flex: 1,
        width: '100%',
        padding,
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
