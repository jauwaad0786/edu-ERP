import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import {
  Layers, Plus, Edit2, CheckCircle2, AlertCircle,
  Percent, ShieldCheck, Tag, DollarSign, RefreshCw
} from 'lucide-react';

export default function FeeSetupPage() {
  const [activeTab, setActiveTab] = useState('heads'); // heads | structures | concessions
  const [heads, setHeads] = useState([]);
  const [structures, setStructures] = useState([]);
  const [classes, setClasses] = useState([]);
  const [concessions, setConcessions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fee Head Modal
  const [headModal, setHeadModal] = useState(false);
  const [editingHead, setEditingHead] = useState(null);
  const [headForm, setHeadForm] = useState({
    name: '', code: '', category: 'ACADEMIC', department: 'ACCOUNTS',
    income_account: 'General School Income', is_recurring: true,
    default_frequency: 'MONTHLY', is_refundable: false, description: ''
  });

  // Structure Modal
  const [structModal, setStructModal] = useState(false);
  const [structForm, setStructForm] = useState({
    name: '', class_id: '', frequency: 'MONTHLY', due_date_day: 10,
    items: []
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [headsRes, structRes, classRes, concRes] = await Promise.all([
        api.get('/fees-finance/heads'),
        api.get('/fees-finance/structures'),
        api.get('/principal/classes').catch(() => ({ data: [] })),
        api.get('/fees-finance/concessions').catch(() => ({ data: [] })),
      ]);
      setHeads(headsRes.data || []);
      setStructures(structRes.data || []);
      setClasses(classRes.data || []);
      setConcessions(concRes.data || []);
    } catch (err) {
      toast.error('Failed to load fee configuration');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAddHead = () => {
    setEditingHead(null);
    setHeadForm({
      name: '', code: '', category: 'ACADEMIC', department: 'ACCOUNTS',
      income_account: 'General School Income', is_recurring: true,
      default_frequency: 'MONTHLY', is_refundable: false, description: ''
    });
    setHeadModal(true);
  };

  const handleHeadSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingHead) {
        await api.patch(`/fees-finance/heads/${editingHead.id}`, headForm);
        toast.success('Fee Head updated');
      } else {
        await api.post('/fees-finance/heads', headForm);
        toast.success('Fee Head created');
      }
      setHeadModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save fee head');
    }
  };

  const openAddStructure = () => {
    // Populate structure items with default heads
    const initialItems = heads.map((h) => ({
      fee_head_id: h.id,
      fee_head_name: h.name,
      amount: h.code === 'TUITION' ? 3000 : 0,
    }));
    setStructForm({
      name: '', class_id: '', frequency: 'MONTHLY', due_date_day: 10,
      items: initialItems,
    });
    setStructModal(true);
  };

  const handleStructureSubmit = async (e) => {
    e.preventDefault();
    if (!structForm.name) {
      toast.error('Structure name is required');
      return;
    }
    try {
      const payload = {
        name: structForm.name,
        class_id: structForm.class_id ? parseInt(structForm.class_id) : null,
        frequency: structForm.frequency,
        due_date_day: parseInt(structForm.due_date_day),
        items: structForm.items.filter((it) => it.amount > 0),
      };
      await api.post('/fees-finance/structures', payload);
      toast.success('Fee Structure created');
      setStructModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save fee structure');
    }
  };

  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-y-auto">
        <Navbar />

        <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">
                  Configuration
                </span>
                <span className="text-xs text-slate-500">Service Master & Rate Cards</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mt-1">Fee Setup & Rate Cards</h1>
              <p className="text-xs text-slate-500">
                Configure departments, customizable fee heads, and class rate structures.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {activeTab === 'heads' && (
                <button
                  onClick={openAddHead}
                  className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add Fee Head
                </button>
              )}
              {activeTab === 'structures' && (
                <button
                  onClick={openAddStructure}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Create Rate Card
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200">
            {[
              { id: 'heads', label: 'Fee Heads (Services)', icon: Tag, count: heads.length },
              { id: 'structures', label: 'Class Rate Cards', icon: Layers, count: structures.length },
              { id: 'concessions', label: 'Concessions & Scholarships', icon: Percent, count: concessions.length },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all ${
                    active ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${active ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-600'}`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Tab 1: Fee Heads */}
          {activeTab === 'heads' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 uppercase bg-slate-50/50">
                      <th className="py-3 px-4">Code</th>
                      <th className="py-3 px-4">Fee Head Name</th>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Frequency</th>
                      <th className="py-3 px-4">Recurring</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-center">Edit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {heads.map((h) => (
                      <tr key={h.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-4 font-mono font-bold text-slate-800">{h.code}</td>
                        <td className="py-3 px-4 font-semibold text-slate-900">{h.name}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                            {h.department}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{h.category}</td>
                        <td className="py-3 px-4 text-slate-600">{h.default_frequency}</td>
                        <td className="py-3 px-4">
                          {h.is_recurring ? (
                            <span className="text-emerald-600 font-bold">Yes</span>
                          ) : (
                            <span className="text-slate-400">One-time</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {h.is_active ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                              Active
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => {
                              setEditingHead(h);
                              setHeadForm({ ...h });
                              setHeadModal(true);
                            }}
                            className="p-1 text-slate-600 hover:text-purple-700 hover:bg-purple-50 rounded"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 2: Rate Cards */}
          {activeTab === 'structures' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {structures.map((s) => (
                <div key={s.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{s.name}</h3>
                      <p className="text-xs text-slate-500">{s.class_name} • {s.session}</p>
                    </div>
                    <span className="text-sm font-bold text-blue-700">{fmt(s.total_amount)}/mo</span>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Itemized Rates:</span>
                    {s.items?.map((it, idx) => (
                      <div key={idx} className="flex justify-between text-slate-700">
                        <span>{it.fee_head_name}</span>
                        <span className="font-semibold">{fmt(it.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tab 3: Concessions */}
          {activeTab === 'concessions' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6">
              <h3 className="text-base font-bold text-slate-900 mb-3">All Active Concessions & Scholarships</h3>
              {concessions.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">No concessions on record.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {concessions.map((c) => (
                    <div key={c.id} className="p-4 bg-purple-50/40 rounded-xl border border-purple-100 space-y-1.5 text-xs">
                      <div className="flex justify-between font-bold">
                        <span className="text-slate-900">{c.student_name} ({c.admission_no})</span>
                        <span className="text-purple-700">
                          {c.discount_type === 'PERCENTAGE' ? `${c.discount_value}% OFF` : `₹${c.discount_value} OFF`}
                        </span>
                      </div>
                      <div className="text-slate-600">Type: <span className="font-semibold">{c.concession_type.replace('_', ' ')}</span> • Head: {c.fee_head_name}</div>
                      <div className="text-slate-500 italic">"{c.reason}"</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Fee Head Modal */}
      {headModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingHead ? 'Edit Fee Head' : 'Add Fee Head (Service)'}
              </h3>
              <button onClick={() => setHeadModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                ✕
              </button>
            </div>

            <form onSubmit={handleHeadSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Fee Head Name</label>
                <input
                  type="text"
                  value={headForm.name}
                  onChange={(e) => setHeadForm({ ...headForm, name: e.target.value })}
                  placeholder="e.g. Science Lab Fee"
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-none focus:bg-white focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Code (Identifier)</label>
                <input
                  type="text"
                  value={headForm.code}
                  onChange={(e) => setHeadForm({ ...headForm, code: e.target.value.toUpperCase().replace(' ', '_') })}
                  placeholder="e.g. LAB_FEE"
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase font-bold outline-none focus:bg-white focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Department</label>
                  <select
                    value={headForm.department}
                    onChange={(e) => setHeadForm({ ...headForm, department: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-none"
                  >
                    <option value="ACCOUNTS">ACCOUNTS</option>
                    <option value="TRANSPORT">TRANSPORT</option>
                    <option value="HOSTEL">HOSTEL</option>
                    <option value="LIBRARY">LIBRARY</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={headForm.category}
                    onChange={(e) => setHeadForm({ ...headForm, category: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-none"
                  >
                    <option value="ACADEMIC">ACADEMIC</option>
                    <option value="TRANSPORT">TRANSPORT</option>
                    <option value="HOSTEL">HOSTEL</option>
                    <option value="LIBRARY">LIBRARY</option>
                    <option value="EXAM">EXAM</option>
                    <option value="ACTIVITY">ACTIVITY</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setHeadModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-md"
                >
                  Save Fee Head
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Structure Modal */}
      {structModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Create Class Rate Card</h3>
              <button onClick={() => setStructModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                ✕
              </button>
            </div>

            <form onSubmit={handleStructureSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Structure Name</label>
                <input
                  type="text"
                  value={structForm.name}
                  onChange={(e) => setStructForm({ ...structForm, name: e.target.value })}
                  placeholder="e.g. Class 8 Standard Rate Card 2026-27"
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Applicable Class</label>
                <select
                  value={structForm.class_id}
                  onChange={(e) => setStructForm({ ...structForm, class_id: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Classes (School-wide Default)</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.section || ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="font-bold text-slate-700 block">Itemized Rates (₹):</span>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl p-2 max-h-48 overflow-y-auto">
                  {structForm.items.map((it, idx) => (
                    <div key={idx} className="py-2 flex items-center justify-between gap-3">
                      <span className="font-medium text-slate-800">{it.fee_head_name}</span>
                      <div className="flex items-center gap-1">
                        <span>₹</span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={it.amount}
                          onChange={(e) => {
                            const next = [...structForm.items];
                            next[idx].amount = parseFloat(e.target.value) || 0;
                            setStructForm({ ...structForm, items: next });
                          }}
                          className="w-24 p-1.5 text-right font-bold text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStructModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md"
                >
                  Save Rate Card
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
