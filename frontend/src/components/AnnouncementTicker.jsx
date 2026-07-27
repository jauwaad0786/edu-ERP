import React, { useState, useEffect } from 'react';
import api from '../api/axios';

// Developer/Super Admin ke platform-wide announcements (maintenance, service
// alerts, product updates) ko school/teacher/student dashboards ke top pe
// ek scrolling news-ticker ki tarah dikhata hai — normal announcement card
// ki jagah, taaki maintenance jaisi cheezein turant nazar aayein.
// Kahin bhi drop karo: <AnnouncementTicker />

const PRIORITY_STYLE = {
  CRITICAL: { bg: '#dc2626', fg: '#fff' },
  HIGH:     { bg: '#ea580c', fg: '#fff' },
  MEDIUM:   { bg: '#4f46e5', fg: '#fff' },
  LOW:      { bg: '#475569', fg: '#fff' },
};

export default function AnnouncementTicker() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    api.get('/support/announcements/latest')
      .then(r => setItems((r.data || []).filter(a => a.is_platform)))
      .catch(() => setItems([]));
  }, []);

  if (items.length === 0) return null;

  const topPriority = items.reduce((a, b) => (
    ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].indexOf(a.priority) 
    ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].indexOf(b.priority) ? a : b
  ));
  const style = PRIORITY_STYLE[topPriority.priority] || PRIORITY_STYLE.MEDIUM;
  const text = items.map(a => `📢 ${a.title} — ${a.body}`).join('   •   ');

  return (
    <div style={{
      background: style.bg, color: style.fg, borderRadius: 10,
      padding: '9px 0', marginBottom: 18, overflow: 'hidden', position: 'relative',
      display: 'flex', alignItems: 'center',
    }}>
      <span style={{
        flexShrink: 0, fontSize: 10.5, fontWeight: 700, letterSpacing: '.04em',
        padding: '3px 12px', margin: '0 10px 0 12px', borderRadius: 20,
        background: 'rgba(255,255,255,.22)', textTransform: 'uppercase',
      }}>OnePlatform360</span>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div className="ann-ticker-track">
          <span className="ann-ticker-seg">{text}</span>
          <span className="ann-ticker-seg">{text}</span>
        </div>
      </div>
      <style>{`
        .ann-ticker-track {
          display: flex;
          width: max-content;
          animation: ann-ticker-scroll 28s linear infinite;
        }
        .ann-ticker-track:hover { animation-play-state: paused; }
        .ann-ticker-seg {
          white-space: nowrap;
          font-size: 13px;
          font-weight: 500;
          padding-right: 60px;
        }
        @keyframes ann-ticker-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ann-ticker-track { animation: none; }
        }
      `}</style>
    </div>
  );
}
