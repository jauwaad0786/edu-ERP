import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import api from './api/axios';

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
