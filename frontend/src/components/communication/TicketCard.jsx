// frontend/src/components/communication/TicketCard.jsx

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { StatusBadge, PriorityBadge } from './StatusBadge';
export const CATEGORY_LABEL = {
  COMPLAINT: "Complaint",
  SUGGESTION: "Suggestion",
  FEEDBACK: "Feedback",
  TECHNICAL: "Technical",
  ACADEMIC: "Academic",
  FEE: "Fee Related",
  TEACHER: "Teacher Related",
  STUDENT: "Student Related",
  PARENT_QUERY: "Parent Query",
  WEBSITE_BUG: "Website Bug",
  ERP_BUG: "ERP Bug",
  FEATURE_REQUEST: "Feature Request",
  GENERAL: "General",
  EMERGENCY: "Emergency",
};
export const PRODUCT_LABEL = {
  ERP: "School ERP",
  WEBSITE: "Website",
  MOBILE_APP: "Mobile App",
  LMS: "Learning Management",
  HRMS: "HRMS",
  INVENTORY: "Inventory",
  FEES: "Fee Management",
  ATTENDANCE: "Attendance",
  EXAM: "Examination",
  TRANSPORT: "Transport",
  LIBRARY: "Library",
  HOSTEL: "Hostel",
  GENERAL: "General",
};
export default function TicketCard({
  ticket,
  darkMode = false,
  showSchool = false,
}) {
  const navigate = useNavigate();

  const border = darkMode ? '#1e293b' : '#e2e8f0';
  const bg = darkMode ? '#141b2d' : '#ffffff';
  const hover = darkMode ? '#1b2538' : '#f8fafc';
  const text = darkMode ? '#f1f5f9' : '#0f172a';
  const sub = darkMode ? '#94a3b8' : '#64748b';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/support/tickets/${ticket.id}`)}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && navigate(`/support/tickets/${ticket.id}`)}
      style={{
        padding: 16,
        borderBottom: `1px solid ${border}`,
        background: bg,
        cursor: 'pointer',
        transition: '0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = hover)}
      onMouseLeave={e => (e.currentTarget.style.background = bg)}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div style={{ flex: 1 }}>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                fontWeight: 700,
                color: text,
                fontSize: 15,
              }}
            >
              {ticket.subject}
            </span>

            <StatusBadge status={ticket.status} />

            <PriorityBadge priority={ticket.priority} />
          </div>

          <div
            style={{
              marginTop: 6,
              fontSize: 13,
              color: sub,
            }}
          >
            #{ticket.ticket_no}
          </div>

          {ticket.description && (
            <div
              style={{
                marginTop: 10,
                color: sub,
                fontSize: 13,
                lineHeight: 1.5,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {ticket.description}
            </div>
          )}

          <div
            style={{
              marginTop: 12,
              display: 'flex',
              gap: 14,
              flexWrap: 'wrap',
              fontSize: 12,
              color: sub,
            }}
          >
            {ticket.category && (
              <span>📂 {ticket.category}</span>
            )}

            {ticket.module_name && (
              <span>🧩 {ticket.module_name}</span>
            )}

            {showSchool && ticket.school_name && (
              <span>🏫 {ticket.school_name}</span>
            )}

            {ticket.created_at && (
              <span>
                🕒 {new Date(ticket.created_at).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            color: '#6366f1',
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          View →
        </div>
      </div>
    </div>
  );
}
