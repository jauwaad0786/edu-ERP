import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function DeletedItemsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = (searchParams.get('tab') || '').toUpperCase();
  const initialTab = ['STUDENT', 'TEACHER', 'STAFF'].includes(urlTab) ? urlTab : 'STUDENT';

  const [activeTab, setActiveTab] = useState(initialTab); // 'STUDENT' | 'TEACHER' | 'STAFF'
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({ students: 0, teachers: 0, staff: 0, total: 0 });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Recovery modal state
  const [recoverTarget, setRecoverTarget] = useState(null);

  // Force delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [confirmationInput, setConfirmationInput] = useState('');

  useEffect(() => {
    if (urlTab && ['STUDENT', 'TEACHER', 'STAFF'].includes(urlTab)) {
      setActiveTab(urlTab);
    }
  }, [urlTab]);

  const switchTab = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab: tab.toLowerCase() });
  };

  // Fetch deleted items
  const fetchDeletedItems = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/principal/deleted-items?type=${activeTab}&search=${encodeURIComponent(search)}`);
      setItems(res.data.data || []);
      if (res.data.counts) {
        setCounts(res.data.counts);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load deleted items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeletedItems();
  }, [activeTab, search]);

  // Handle Recover
  const handleRecover = async () => {
    if (!recoverTarget) return;
    setActionLoading(true);
    try {
      const res = await api.post(`/principal/deleted-items/${recoverTarget.id}/recover`);
      toast.success(res.data.message || 'Restored successfully');
      if (res.data.warning) {
        toast((t) => (
          <div style={{ fontSize: 13 }}>
            <strong style={{ color: '#d97706', display: 'block', marginBottom: 2 }}>⚠️ Notice</strong>
            <span>{res.data.warning}</span>
          </div>
        ), { duration: 6000 });
      }
      setRecoverTarget(null);
      fetchDeletedItems();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Recovery failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Permanent Delete (Force Delete Now)
  const handlePermanentDelete = async () => {
    if (!deleteTarget) return;
    if (confirmationInput.trim().toLowerCase() !== deleteTarget.name.trim().toLowerCase()) {
      toast.error(`Please type "${deleteTarget.name}" exactly to confirm.`);
      return;
    }

    setActionLoading(true);
    try {
      const res = await api.delete(`/principal/deleted-items/${deleteTarget.id}/permanent`, {
        data: { confirmation_name: confirmationInput.trim() }
      });
      toast.success(res.data.message || 'Permanently deleted');
      setDeleteTarget(null);
      setConfirmationInput('');
      fetchDeletedItems();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Permanent deletion failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Auto-Cleanup Trigger
  const handleRunCleanup = async () => {
    setActionLoading(true);
    try {
      const res = await api.post('/principal/deleted-items/cleanup');
      toast.success(res.data.message || '1-Year cleanup completed');
      fetchDeletedItems();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Cleanup job failed');
    } finally {
      setActionLoading(false);
    }
  };

  const isDeleteConfirmed = deleteTarget && confirmationInput.trim().toLowerCase() === deleteTarget.name.trim().toLowerCase();

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Deleted Items Archive & Recovery" />

        <div className="page-body">

          {/* Page Header */}
          <div className="page-header flex justify-between items-center" style={{ marginBottom: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="badge badge-warning" style={{ fontSize: 11, padding: '3px 9px' }}>
                  ⏳ 1-Year Retention Archive
                </span>
              </div>
              <h2 className="page-title">Deleted Items Archive</h2>
              <p className="page-subtitle">
                Deleted records stay recoverable for <strong>365 days</strong>. Historical financial ledgers and receipts are permanently preserved.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                onClick={handleRunCleanup}
                disabled={actionLoading}
                className="btn btn-neutral btn-sm"
                title="Execute 1-year auto-cleanup job now"
              >
                <i className={`ti ti-refresh ${actionLoading ? 'ti-spin' : ''}`}></i>
                {actionLoading ? 'Cleaning up...' : 'Run Auto-Cleanup'}
              </button>
            </div>
          </div>

          {/* Stat Cards Row */}
          <div className="grid-4 mb-6">
            <div
              className="stat-card"
              style={{
                cursor: 'pointer',
                borderColor: activeTab === 'STUDENT' ? 'var(--blue-60)' : 'var(--neutral-2)',
                background: activeTab === 'STUDENT' ? 'var(--blue-10)' : '#fff',
              }}
              onClick={() => switchTab('STUDENT')}
            >
              <div className="stat-icon" style={{ background: '#e0f2fe', color: '#0284c7' }}>
                <i className="ti ti-school"></i>
              </div>
              <div className="stat-label">Deleted Students</div>
              <div className="stat-value">{counts.students}</div>
              <div className="stat-sub">Recoverable in archive</div>
            </div>

            <div
              className="stat-card"
              style={{
                cursor: 'pointer',
                borderColor: activeTab === 'TEACHER' ? 'var(--blue-60)' : 'var(--neutral-2)',
                background: activeTab === 'TEACHER' ? 'var(--blue-10)' : '#fff',
              }}
              onClick={() => switchTab('TEACHER')}
            >
              <div className="stat-icon" style={{ background: '#dcfce7', color: '#16a34a' }}>
                <i className="ti ti-chalkboard"></i>
              </div>
              <div className="stat-label">Deleted Teachers</div>
              <div className="stat-value">{counts.teachers}</div>
              <div className="stat-sub">Recoverable in archive</div>
            </div>

            <div
              className="stat-card"
              style={{
                cursor: 'pointer',
                borderColor: activeTab === 'STAFF' ? 'var(--blue-60)' : 'var(--neutral-2)',
                background: activeTab === 'STAFF' ? 'var(--blue-10)' : '#fff',
              }}
              onClick={() => switchTab('STAFF')}
            >
              <div className="stat-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
                <i className="ti ti-briefcase"></i>
              </div>
              <div className="stat-label">Deleted Staff</div>
              <div className="stat-value">{counts.staff}</div>
              <div className="stat-sub">Recoverable in archive</div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#f3e8ff', color: '#9333ea' }}>
                <i className="ti ti-archive"></i>
              </div>
              <div className="stat-label">Total In Archive</div>
              <div className="stat-value">{counts.total}</div>
              <div className="stat-sub">Auto-purged after 365 days</div>
            </div>
          </div>

          {/* Main Card with Tabs, Search, and Table */}
          <div className="card">
            {/* Header Tabs */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 16px',
              borderBottom: '1px solid var(--neutral-2)',
              background: '#fff',
              flexWrap: 'wrap',
              gap: 12,
            }}>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  type="button"
                  onClick={() => switchTab('STUDENT')}
                  style={{
                    padding: '12px 18px',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: 'none',
                    background: 'none',
                    color: activeTab === 'STUDENT' ? 'var(--blue-60)' : 'var(--neutral-6)',
                    borderBottom: activeTab === 'STUDENT' ? '2px solid var(--blue-60)' : '2px solid transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <i className="ti ti-school"></i>
                  Students ({counts.students})
                </button>

                <button
                  type="button"
                  onClick={() => switchTab('TEACHER')}
                  style={{
                    padding: '12px 18px',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: 'none',
                    background: 'none',
                    color: activeTab === 'TEACHER' ? 'var(--blue-60)' : 'var(--neutral-6)',
                    borderBottom: activeTab === 'TEACHER' ? '2px solid var(--blue-60)' : '2px solid transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <i className="ti ti-chalkboard"></i>
                  Teachers ({counts.teachers})
                </button>

                <button
                  type="button"
                  onClick={() => switchTab('STAFF')}
                  style={{
                    padding: '12px 18px',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: 'none',
                    background: 'none',
                    color: activeTab === 'STAFF' ? 'var(--blue-60)' : 'var(--neutral-6)',
                    borderBottom: activeTab === 'STAFF' ? '2px solid var(--blue-60)' : '2px solid transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <i className="ti ti-briefcase"></i>
                  Staff ({counts.staff})
                </button>
              </div>

              {/* Search Toolbar */}
              <div style={{ padding: '8px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="text"
                  className="form-input"
                  style={{ width: 280, height: 34, fontSize: 13 }}
                  placeholder={`Search deleted ${activeTab.toLowerCase()}s...`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button
                    type="button"
                    className="btn btn-neutral btn-sm"
                    onClick={() => setSearch('')}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Table or Empty State */}
            {loading ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--neutral-6)' }}>
                <i className="ti ti-loader-2" style={{ fontSize: 28, animation: 'spin 1s linear infinite', color: 'var(--blue-60)', display: 'block', margin: '0 auto 10px' }}></i>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Loading deleted {activeTab.toLowerCase()}s...</span>
              </div>
            ) : items.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                <div style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'var(--neutral-1)',
                  color: 'var(--neutral-6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                  margin: '0 auto 12px',
                }}>
                  <i className="ti ti-archive-off"></i>
                </div>
                <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--neutral-9)', marginBottom: 4 }}>
                  No Deleted {activeTab}s Found
                </h4>
                <p style={{ fontSize: 13, color: 'var(--neutral-6)', maxWidth: 360, margin: '0 auto' }}>
                  {search ? 'Try adjusting your search criteria.' : `There are currently no deleted ${activeTab.toLowerCase()}s in the 1-year archive.`}
                </p>
              </div>
            ) : (
              <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Person / Name</th>
                      <th>Identifier</th>
                      <th>{activeTab === 'STUDENT' ? 'Class & Section' : 'Department & Role'}</th>
                      <th>Deleted Date &amp; By</th>
                      <th>Auto-Delete / Retention</th>
                      <th>Reason</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div className="avatar avatar-md">
                              {item.name ? item.name.charAt(0).toUpperCase() : '?'}
                            </div>
                            <div>
                              <strong style={{ display: 'block', color: 'var(--neutral-9)', fontSize: 13 }}>
                                {item.name}
                              </strong>
                              <span style={{ fontSize: 11, color: 'var(--neutral-6)' }}>
                                ID #{item.original_id}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td>
                          {item.identifier ? (
                            <span className="badge badge-info" style={{ fontFamily: 'monospace' }}>
                              {item.identifier}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--neutral-4)' }}>—</span>
                          )}
                        </td>

                        <td>
                          {activeTab === 'STUDENT' ? (
                            <span style={{ fontWeight: 600, color: 'var(--neutral-9)' }}>
                              {item.class_name || 'No Class Assigned'}
                            </span>
                          ) : (
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--neutral-9)' }}>
                                {item.designation || item.role}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--neutral-6)' }}>
                                {item.department || 'General'}
                              </div>
                            </div>
                          )}
                        </td>

                        <td>
                          <div style={{ color: 'var(--neutral-9)', fontWeight: 600, fontSize: 12 }}>
                            {item.deleted_date}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--neutral-6)' }}>
                            by {item.deleted_by_name}
                          </div>
                        </td>

                        <td>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--neutral-9)', marginBottom: 2 }}>
                            {item.auto_delete_date}
                          </div>
                          <span className="badge badge-warning" style={{ fontSize: 10, padding: '2px 7px' }}>
                            {item.days_remaining} days left
                          </span>
                        </td>

                        <td style={{ fontSize: 12, color: 'var(--neutral-6)', maxWidth: 220 }}>
                          {item.delete_reason || '—'}
                        </td>

                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => setRecoverTarget(item)}
                              className="btn btn-neutral btn-sm"
                              style={{ color: 'var(--success)', borderColor: 'var(--success)' }}
                              title="Restore back to active roster"
                            >
                              <i className="ti ti-arrow-back-up"></i>
                              Recover
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setDeleteTarget(item);
                                setConfirmationInput('');
                              }}
                              className="btn btn-destructive btn-sm"
                              title="Permanently remove now"
                            >
                              <i className="ti ti-trash"></i>
                              Permanent Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── RECOVER CONFIRMATION MODAL ── */}
      {recoverTarget && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && !actionLoading && setRecoverTarget(null)}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--success)' }}>
                <i className="ti ti-arrow-back-up"></i>
                Recover {recoverTarget.name}?
              </h3>
              <button
                type="button"
                className="modal-close"
                disabled={actionLoading}
                onClick={() => setRecoverTarget(null)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div style={{
                background: 'var(--success-bg)',
                border: '1px solid #bbf7d0',
                borderRadius: 'var(--radius-md)',
                padding: '14px 16px',
                fontSize: 13,
                color: 'var(--success)',
                marginBottom: 12,
              }}>
                ✅ This will restore <strong>{recoverTarget.name}</strong> back to active status in the school ERP.
                {recoverTarget.item_type === 'STUDENT' && (
                  <span style={{ display: 'block', marginTop: 4 }}>
                    The student will be restored into <strong>{recoverTarget.class_name || 'their original class'}</strong>.
                  </span>
                )}
              </div>
              <p style={{ fontSize: 12, color: 'var(--neutral-6)' }}>
                Their login access will be reactivated, and they will reappear in active class lists and dashboards.
              </p>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-neutral"
                disabled={actionLoading}
                onClick={() => setRecoverTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: 'var(--success)', borderColor: 'var(--success)' }}
                disabled={actionLoading}
                onClick={handleRecover}
              >
                {actionLoading ? 'Restoring...' : '✅ Confirm Recover'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FORCE DELETE / PERMANENT DELETE MODAL (Requires typing person's name) ── */}
      {deleteTarget && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && !actionLoading && setDeleteTarget(null)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--error)' }}>
                <i className="ti ti-alert-triangle"></i>
                Permanently Delete {deleteTarget.name}?
              </h3>
              <button
                type="button"
                className="modal-close"
                disabled={actionLoading}
                onClick={() => setDeleteTarget(null)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div style={{
                background: 'var(--error-bg)',
                border: '1px solid #fecaca',
                borderRadius: 'var(--radius-md)',
                padding: '14px 16px',
                fontSize: 13,
                color: 'var(--error)',
                marginBottom: 14,
              }}>
                <strong>⚠️ Warning: Permanent deletion cannot be undone!</strong>
                <ul style={{ paddingLeft: 18, marginTop: 6, fontSize: 12, lineHeight: 1.6 }}>
                  <li>Personal details, login credentials, and profile records will be permanently removed.</li>
                  <li><strong>Financial Safety:</strong> Any past fee receipts and payment ledgers will be anonymized to maintain audit and accounting integrity.</li>
                </ul>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 12, marginBottom: 6 }}>
                  To confirm permanent deletion, type the person's exact name:
                  <span style={{
                    marginLeft: 6,
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    background: 'var(--neutral-1)',
                    padding: '2px 8px',
                    borderRadius: 4,
                    border: '1px solid var(--neutral-2)',
                    color: 'var(--neutral-9)',
                  }}>
                    {deleteTarget.name}
                  </span>
                </label>

                <input
                  type="text"
                  className="form-input"
                  value={confirmationInput}
                  onChange={(e) => setConfirmationInput(e.target.value)}
                  placeholder={`Type "${deleteTarget.name}" to unlock`}
                  autoFocus
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-neutral"
                disabled={actionLoading}
                onClick={() => {
                  setDeleteTarget(null);
                  setConfirmationInput('');
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn btn-destructive"
                style={{
                  background: isDeleteConfirmed ? 'var(--error)' : 'var(--neutral-2)',
                  color: isDeleteConfirmed ? '#fff' : 'var(--neutral-6)',
                  borderColor: isDeleteConfirmed ? 'var(--error)' : 'var(--neutral-2)',
                  cursor: isDeleteConfirmed ? 'pointer' : 'not-allowed',
                }}
                disabled={!isDeleteConfirmed || actionLoading}
                onClick={handlePermanentDelete}
              >
                {actionLoading ? 'Deleting...' : '🗑️ PERMANENTLY DELETE NOW'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
