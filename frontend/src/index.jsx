import React from 'react';
import ReactDOM from 'react-dom/client';
import toast from 'react-hot-toast';
import './index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import api from './api/axios';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

// Catches what ErrorBoundary structurally cannot: errors thrown inside
// event handlers / setTimeout / non-React code (window.onerror), and
// rejected promises nobody awaited with a .catch (onunhandledrejection).
// Same fire-and-forget reasoning as ErrorBoundary.componentDidCatch --
// this runs at the moment something is already broken, so the report
// call itself must never throw or block anything.
window.onerror = function (message, source, lineno, colno, error) {
  api.post('/developer/errors/report', {
    error_type: 'UNKNOWN',
    exception_type: error?.name || 'WindowError',
    exception_message: typeof message === 'string' ? message : String(message),
    stack_trace: error?.stack || `${source}:${lineno}:${colno}`,
    module: 'frontend_runtime',
    page: window.location.pathname,
  }).catch(() => {});
};

window.onunhandledrejection = function (event) {
  const reason = event?.reason;
  api.post('/developer/errors/report', {
    error_type: 'UNKNOWN',
    exception_type: reason?.name || 'UnhandledPromiseRejection',
    exception_message: reason?.message || String(reason),
    stack_trace: reason?.stack || null,
    module: 'frontend_promise',
    page: window.location.pathname,
  }).catch(() => {});
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// ── PWA: register service worker, prompt on new version ────────────────
serviceWorkerRegistration.register({
  onUpdate: (registration) => {
    const toastId = 'op360-update-toast';
    toast.custom(
      (t) => (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 16px',
            background: '#0a1b3d',
            color: '#fff',
            borderRadius: 12,
            boxShadow: '0 8px 24px rgba(10, 27, 61, 0.25)',
            opacity: t.visible ? 1 : 0,
          }}
        >
          <span style={{ fontSize: 13.5 }}>A new version of OP360 EduERP is available.</span>
          <button
            type="button"
            onClick={() => {
              toast.dismiss(toastId);
              serviceWorkerRegistration.applyUpdate(registration);
            }}
            style={{
              padding: '6px 12px',
              fontSize: 13,
              fontWeight: 700,
              color: '#0a1b3d',
              background: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Update Now
          </button>
          <button
            type="button"
            onClick={() => toast.dismiss(toastId)}
            style={{
              padding: '6px 10px',
              fontSize: 13,
              color: 'rgba(255,255,255,0.7)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Later
          </button>
        </div>
      ),
      { id: toastId, duration: Infinity, position: 'bottom-center' }
    );
  },
});
