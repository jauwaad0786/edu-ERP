import React from 'react';
import api from '../api/axios';

// React error boundaries only catch errors thrown during render/lifecycle
// of their child tree -- they do NOT catch errors inside event handlers,
// async code, or promise rejections (React docs, explicit limitation).
// That's why this file alone isn't enough -- main.jsx also registers
// window.onerror + window.onunhandledrejection for those other cases.
// This component only handles the render-crash case (e.g. the React
// error #31 seen earlier on the audit button, if it throws during render).

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Best-effort report -- deliberately fire-and-forget (no await, no
    // .catch() surfaced to the user) since we're already in a broken UI
    // state; a failed report call must never block the fallback UI or
    // throw a second error on top of the first.
    api.post('/developer/errors/report', {
      error_type: 'UNKNOWN',
      exception_type: error?.name || 'ReactRenderError',
      exception_message: error?.message,
      stack_trace: `${error?.stack || ''}\n\nComponent stack:${info?.componentStack || ''}`,
      module: 'frontend_render',
      page: window.location.pathname,
    }).catch(() => {});
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '100vh', padding: 24,
          textAlign: 'center', fontFamily: 'sans-serif',
        }}>
          <h2 style={{ marginBottom: 8 }}>Kuch galat ho gaya</h2>
          <p style={{ color: '#666', marginBottom: 16 }}>
            Ye error humare development team ko report ho chuka hai.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 20px', borderRadius: 6, border: 'none',
              background: '#3b82f6', color: '#fff', cursor: 'pointer',
            }}
          >
            Page Reload Karein
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
