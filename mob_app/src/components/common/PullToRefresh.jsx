import React, { useState, useRef } from 'react';
import { colors } from '../../theme/colors';

export default function PullToRefresh({ onRefresh, children, refreshing = false }) {
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const isPulling = useRef(false);

  const handleTouchStart = (e) => {
    const el = e.currentTarget;
    if (el.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  };

  const handleTouchMove = (e) => {
    if (!isPulling.current) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;
    if (diff > 0 && diff < 120) {
      setPullDistance(diff);
    }
  };

  const handleTouchEnd = async () => {
    if (!isPulling.current) return;
    isPulling.current = false;
    if (pullDistance > 60 && onRefresh) {
      setPullDistance(50);
      try {
        await onRefresh();
      } finally {
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  };

  return (
    <div
      className="scrollable"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
        position: 'relative',
      }}
    >
      {(pullDistance > 0 || refreshing) && (
        <div style={{
          height: `${Math.max(pullDistance, refreshing ? 45 : 0)}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          transition: isPulling.current ? 'none' : 'height 0.2s ease',
        }}>
          <i
            className={`ti ti-refresh ${refreshing || pullDistance > 60 ? 'spin' : ''}`}
            style={{ fontSize: '20px', color: colors.primary }}
          />
        </div>
      )}
      {children}
    </div>
  );
}
