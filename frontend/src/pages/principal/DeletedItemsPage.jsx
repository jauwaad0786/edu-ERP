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

  useEffect(() => {
    if (urlTab && ['STUDENT', 'TEACHER', 'STAFF'].includes(urlTab)) {
      setActiveTab(urlTab);
    }
  }, [urlTab]);

  const switchTab = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab: tab.toLowerCase() });
  };

  // Recovery modal state
  const [recoverTarget, setRecoverTarget] = useState(null);

  // Force delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [confirmationInput, setConfirmationInput] = useState('');

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
          <div className="text-xs">
            <p className="font-bold text-amber-600">⚠️ Notice</p>
            <p>{res.data.warning}</p>
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
    <div className="app-shell flex bg-slate-50 min-h-screen">
      <Sidebar />
      <div className="main-content flex-1 flex flex-col min-w-0">
        <Navbar title="Deleted Items Archive & Recovery" />

        <div className="page-body p-6 space-y-6 max-w-7xl mx-auto w-full">

          {/* Top Banner & Summary Cards */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border border-slate-800">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="p-2 bg-indigo-500/20 text-indigo-300 rounded-lg text-lg border border-indigo-500/30">
                  <i className="ti ti-trash"></i>
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300 bg-indigo-900/50 px-2.5 py-0.5 rounded-full border border-indigo-400/20">
                  1-Year Retention System
                </span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Centralized Deleted Items</h1>
              <p className="text-slate-400 text-sm mt-1 max-w-2xl">
                Deleted students, teachers, and staff remain safely recoverable here for <strong>365 days</strong>.
                After 1 year, records are automatically purged. Financial history and receipts are permanently preserved and anonymized.
              </p>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <button
                onClick={handleRunCleanup}
                disabled={actionLoading}
                className="w-full md:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 border border-slate-700 shadow-sm"
                title="Execute 1-year auto-cleanup job now"
              >
                <i className={`ti ti-refresh ${actionLoading ? 'animate-spin' : ''}`}></i>
                Run Auto-Cleanup
              </button>
            </div>
          </div>

          {/* Metric Summary Counters */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div
              onClick={() => switchTab('STUDENT')}
              className={`cursor-pointer p-4 rounded-xl border transition duration-150 ${
                activeTab === 'STUDENT'
                  ? 'bg-blue-50/80 border-blue-400 shadow-sm ring-2 ring-blue-400/20'
                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Deleted Students</span>
                <span className="p-1.5 rounded-lg bg-blue-100 text-blue-600 text-base">
                  <i className="ti ti-school"></i>
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900">{counts.students}</span>
                <span className="text-xs text-blue-600 font-medium">In Trash</span>
              </div>
            </div>

            <div
              onClick={() => switchTab('TEACHER')}
              className={`cursor-pointer p-4 rounded-xl border transition duration-150 ${
                activeTab === 'TEACHER'
                  ? 'bg-emerald-50/80 border-emerald-400 shadow-sm ring-2 ring-emerald-400/20'
                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Deleted Teachers</span>
                <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-600 text-base">
                  <i className="ti ti-chalkboard"></i>
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900">{counts.teachers}</span>
                <span className="text-xs text-emerald-600 font-medium">In Trash</span>
              </div>
            </div>

            <div
              onClick={() => switchTab('STAFF')}
              className={`cursor-pointer p-4 rounded-xl border transition duration-150 ${
                activeTab === 'STAFF'
                  ? 'bg-amber-50/80 border-amber-400 shadow-sm ring-2 ring-amber-400/20'
                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Deleted Staff</span>
                <span className="p-1.5 rounded-lg bg-amber-100 text-amber-600 text-base">
                  <i className="ti ti-briefcase"></i>
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900">{counts.staff}</span>
                <span className="text-xs text-amber-600 font-medium">In Trash</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total In Archive</span>
                <span className="p-1.5 rounded-lg bg-purple-100 text-purple-600 text-base">
                  <i className="ti ti-archive"></i>
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900">{counts.total}</span>
                <span className="text-xs text-slate-400 font-medium">All Types</span>
              </div>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
            {/* Tabs */}
            <div className="flex items-center p-1 bg-slate-100 rounded-xl w-full md:w-auto">
              <button
                onClick={() => switchTab('STUDENT')}
                className={`flex-1 md:flex-none px-5 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 ${
                  activeTab === 'STUDENT'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <i className="ti ti-school"></i>
                Students ({counts.students})
              </button>

              <button
                onClick={() => switchTab('TEACHER')}
                className={`flex-1 md:flex-none px-5 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 ${
                  activeTab === 'TEACHER'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <i className="ti ti-chalkboard"></i>
                Teachers ({counts.teachers})
              </button>

              <button
                onClick={() => switchTab('STAFF')}
                className={`flex-1 md:flex-none px-5 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 ${
                  activeTab === 'STAFF'
                    ? 'bg-white text-amber-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <i className="ti ti-briefcase"></i>
                Staff ({counts.staff})
              </button>
            </div>

            {/* Search Box */}
            <div className="relative w-full md:w-80">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <i className="ti ti-search text-base"></i>
              </span>
              <input
                type="text"
                placeholder={`Search deleted ${activeTab.toLowerCase()}s...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  <i className="ti ti-x text-sm"></i>
                </button>
              )}
            </div>
          </div>

          {/* Main Content Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-16 text-center text-slate-400">
                <i className="ti ti-loader-2 text-3xl animate-spin mx-auto mb-3 text-indigo-500"></i>
                <p className="text-sm font-medium">Loading deleted records...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="p-16 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400 text-2xl mb-3">
                  <i className="ti ti-archive-off"></i>
                </div>
                <h3 className="text-base font-semibold text-slate-800">No Deleted {activeTab}s Found</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {search ? 'Try adjusting your search criteria.' : `There are currently no deleted ${activeTab.toLowerCase()}s in the 1-year archive.`}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="px-5 py-3.5">Person / Name</th>
                      <th className="px-5 py-3.5">Identifier</th>
                      <th className="px-5 py-3.5">
                        {activeTab === 'STUDENT' ? 'Class & Section' : 'Department & Role'}
                      </th>
                      <th className="px-5 py-3.5">Deleted Date & By</th>
                      <th className="px-5 py-3.5">Auto-Delete / Retention</th>
                      <th className="px-5 py-3.5">Reason</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-sm">
                              {item.name ? item.name.charAt(0).toUpperCase() : '?'}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900">{item.name}</div>
                              <div className="text-xs text-slate-400">ID #{item.original_id}</div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 font-mono text-xs">
                          {item.identifier ? (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md border border-slate-200">
                              {item.identifier}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          {activeTab === 'STUDENT' ? (
                            <span className="font-medium text-slate-700">
                              {item.class_name || 'No Class Assigned'}
                            </span>
                          ) : (
                            <div>
                              <div className="font-medium text-slate-800">{item.designation || item.role}</div>
                              <div className="text-xs text-slate-400">{item.department || 'General'}</div>
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <div className="text-slate-800 font-medium">{item.deleted_date}</div>
                          <div className="text-xs text-slate-400">by {item.deleted_by_name}</div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="text-slate-800 text-xs font-semibold">{item.auto_delete_date}</div>
                          <div className="mt-1">
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                              <i className="ti ti-clock-hour-4 text-xs"></i>
                              {item.days_remaining} days remaining
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-xs text-slate-600 max-w-xs truncate" title={item.delete_reason}>
                          {item.delete_reason || '—'}
                        </td>

                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setRecoverTarget(item)}
                              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold transition border border-emerald-200 flex items-center gap-1.5"
                              title="Restore back to active roster"
                            >
                              <i className="ti ti-arrow-back-up text-sm"></i>
                              Recover
                            </button>

                            <button
                              onClick={() => {
                                setDeleteTarget(item);
                                setConfirmationInput('');
                              }}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold transition border border-rose-200 flex items-center gap-1.5"
                              title="Permanently remove now"
                            >
                              <i className="ti ti-trash text-sm"></i>
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4 text-2xl">
              <i className="ti ti-arrow-back-up"></i>
            </div>

            <h3 className="text-lg font-bold text-slate-900 text-center">
              Recover {recoverTarget.name}?
            </h3>

            <p className="text-xs text-slate-500 text-center mt-2 leading-relaxed">
              This will restore <strong>{recoverTarget.name}</strong> back to active status in the school ERP.
              {recoverTarget.item_type === 'STUDENT' && (
                <> The student will be restored into <strong>{recoverTarget.class_name || 'their original class'}</strong> if the class is still active.</>
              )}
            </p>

            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setRecoverTarget(null)}
                disabled={actionLoading}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRecover}
                disabled={actionLoading}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2"
              >
                {actionLoading ? <i className="ti ti-loader-2 animate-spin"></i> : <i className="ti ti-check"></i>}
                Restore Person
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FORCE DELETE / PERMANENT DELETE MODAL (Requires typing person's name) ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-rose-200">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4 text-2xl border border-rose-200">
              <i className="ti ti-alert-triangle"></i>
            </div>

            <h3 className="text-lg font-bold text-slate-900 text-center">
              Permanently Delete {deleteTarget.name}?
            </h3>

            <div className="mt-3 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-2">
              <p className="font-semibold flex items-center gap-1.5 text-rose-900">
                <i className="ti ti-shield-alert text-sm"></i>
                Critical Action — Permanent Deletion cannot be undone!
              </p>
              <ul className="list-disc pl-4 space-y-1 text-rose-700">
                <li>Personal information, login credentials, and uploaded documents will be permanently purged.</li>
                <li>Operational enrollments (Hostel beds, Transport routes, Library) will be unlinked.</li>
                <li><strong>Financial Security:</strong> Any past fee receipts, payments, and ledger balances will be safely anonymized to preserve school accounting integrity.</li>
              </ul>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                To confirm permanent deletion, type the person's exact name:
                <span className="ml-1 font-bold text-slate-900 select-all font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                  {deleteTarget.name}
                </span>
              </label>

              <input
                type="text"
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value)}
                placeholder={`Type "${deleteTarget.name}" to unlock`}
                autoFocus
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition"
              />
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(null);
                  setConfirmationInput('');
                }}
                disabled={actionLoading}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handlePermanentDelete}
                disabled={!isDeleteConfirmed || actionLoading}
                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 ${
                  isDeleteConfirmed && !actionLoading
                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-500/20'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {actionLoading ? <i className="ti ti-loader-2 animate-spin"></i> : <i className="ti ti-trash"></i>}
                PERMANENTLY DELETE NOW
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
