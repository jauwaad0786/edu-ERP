import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function FeeSetupPage() {
  const navigate = useNavigate();
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
  const [editingStruct, setEditingStruct] = useState(null);
  const [safeguardModal, setSafeguardModal] = useState(null);
  const [structForm, setStructForm] = useState({
    name: '', class_id: '', frequency: 'MONTHLY', due_date_day: 10,
    items: []
  });

  // Concession / Scholarship Modal
  const [concModal, setConcModal] = useState(false);
  const [concStudents, setConcStudents] = useState([]);
  const [concClassId, setConcClassId] = useState('');
  const [concForm, setConcForm] = useState({
    student_id: '',
    fee_head_id: '',
    concession_type: 'SCHOLARSHIP',
    discount_type: 'FIXED',
    discount_value: '',
    reason: '',
    session: '2026-27'
  });
  const [savingConc, setSavingConc] = useState(false);

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

  // Fetch students for concession modal when class changes
  useEffect(() => {
    if (concModal) {
      const params = concClassId ? `?class_id=${concClassId}` : '';
      api.get(`/fees-finance/students/search${params}`)
        .then((res) => {
          setConcStudents(res.data?.students || []);
        })
        .catch(() => setConcStudents([]));
    }
  }, [concClassId, concModal]);

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

  const handleDeleteHead = async (head) => {
    if (!window.confirm(`Are you sure you want to delete Fee Head "${head.name}"?`)) return;
    try {
      await api.delete(`/fees-finance/heads/${head.id}`);
      toast.success(`Fee Head "${head.name}" removed`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete fee head');
    }
  };

  const openAddStructure = () => {
    setEditingStruct(null);
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

  const openEditStructure = (struct) => {
    setEditingStruct(struct);
    const itemMap = {};
    (struct.items || []).forEach((it) => {
      itemMap[it.fee_head_id] = it.amount;
    });

    const structItems = heads.map((h) => ({
      fee_head_id: h.id,
      fee_head_name: h.name,
      amount: itemMap[h.id] !== undefined ? itemMap[h.id] : 0,
    }));

    setStructForm({
      name: struct.name,
      class_id: struct.class_id || '',
      frequency: struct.frequency || 'MONTHLY',
      due_date_day: 10,
      items: structItems,
    });
    setStructModal(true);
  };

  const handleDeleteStructure = async (struct) => {
    if (struct.is_used) {
      setSafeguardModal(struct);
      return;
    }
    if (!window.confirm(`Are you sure you want to delete Rate Card "${struct.name}"?`)) return;
    try {
      await api.delete(`/fees-finance/structures/${struct.id}`);
      toast.success(`Rate card "${struct.name}" deleted`);
      fetchData();
    } catch (err) {
      if (err.response?.status === 409) {
        setSafeguardModal(struct);
      } else {
        toast.error(err.response?.data?.error || 'Failed to delete rate card');
      }
    }
  };

  const handleArchiveStructure = async (struct) => {
    try {
      await api.patch(`/fees-finance/structures/${struct.id}/archive`);
      toast.success(`Rate card "${struct.name}" archived successfully`);
      setSafeguardModal(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to archive rate card');
    }
  };

  const handleDeleteConcession = async (conc) => {
    if (!window.confirm(`Are you sure you want to remove concession for student "${conc.student_name}"?`)) return;
    try {
      await api.delete(`/fees-finance/concessions/${conc.id}`);
      toast.success('Concession rule deleted');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete concession');
    }
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
      if (editingStruct) {
        await api.put(`/fees-finance/structures/${editingStruct.id}`, payload);
        toast.success('Fee Structure updated');
      } else {
        await api.post('/fees-finance/structures', payload);
        toast.success('Fee Structure created');
      }
      setStructModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save fee structure');
    }
  };

  const openAddConcession = () => {
    setConcForm({
      student_id: '',
      fee_head_id: heads[0]?.id || '',
      concession_type: 'SCHOLARSHIP',
      discount_type: 'FIXED',
      discount_value: '',
      reason: '',
      session: '2026-27'
    });
    setConcModal(true);
  };

  const handleConcessionSubmit = async (e) => {
    e.preventDefault();
    if (!concForm.student_id) {
      toast.error('Please select a student');
      return;
    }
    if (!concForm.discount_value || parseFloat(concForm.discount_value) <= 0) {
      toast.error('Enter valid discount value');
      return;
    }
    if (!concForm.reason.trim()) {
      toast.error('Please provide a reason / approval note');
      return;
    }

    try {
      setSavingConc(true);
      const payload = {
        student_id: parseInt(concForm.student_id),
        fee_head_id: concForm.fee_head_id ? parseInt(concForm.fee_head_id) : null,
        concession_type: concForm.concession_type,
        discount_type: concForm.discount_type,
        discount_value: parseFloat(concForm.discount_value),
        reason: concForm.reason.trim(),
        session: concForm.session,
      };
      await api.post('/fees-finance/concessions', payload);
      toast.success('Concession / Scholarship applied successfully!');
      setConcModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save concession');
    } finally {
      setSavingConc(false);
    }
  };

  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Fee Setup & Class Rate Cards" />
        <div className="page-body">

          {/* Page Header */}
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="badge badge-info">Service Configuration</span>
                <span className="text-xs text-muted">Department Heads, Rate Cards & Scholarships</span>
              </div>
              <h2 className="page-title">Fee Setup & Rate Cards</h2>
              <p className="page-subtitle">
                Configure departments, customizable fee heads, class rate structures, and student scholarship rules.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {activeTab === 'heads' && (
                <button onClick={openAddHead} className="btn btn-primary">
                  <i className="ti ti-plus"></i> Add Fee Head
                </button>
              )}
              {activeTab === 'structures' && (
                <button onClick={openAddStructure} className="btn btn-primary">
                  <i className="ti ti-plus"></i> Create Rate Card
                </button>
              )}
              {activeTab === 'concessions' && (
                <button onClick={openAddConcession} className="btn btn-primary">
                  <i className="ti ti-plus"></i> Add Concession / Scholarship
                </button>
              )}
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="card mb-6">
            <div className="card-header" style={{ padding: '8px 16px', background: '#fafaf9' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { id: 'heads', label: 'Fee Heads (Services)', icon: 'ti-tag', count: heads.length },
                  { id: 'structures', label: 'Class Rate Cards', icon: 'ti-layers-intersect', count: structures.length },
                  { id: 'concessions', label: 'Concessions & Scholarships', icon: 'ti-percentage', count: concessions.length },
                ].map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`btn ${active ? 'btn-primary' : 'btn-neutral'} btn-sm`}
                      style={{ borderRadius: 20 }}
                    >
                      <i className={`ti ${tab.icon}`}></i>
                      {tab.label} ({tab.count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tab 1: Fee Heads */}
            {activeTab === 'heads' && (
              <div className="table-container" style={{ border: 'none' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Fee Head Name</th>
                      <th>Department</th>
                      <th>Category</th>
                      <th>Frequency</th>
                      <th>Recurring</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'center', width: 140 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {heads.map((h) => (
                      <tr key={h.id}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--neutral-9)' }}>{h.code}</td>
                        <td style={{ fontWeight: 600 }}>{h.name}</td>
                        <td>
                          <span className="badge badge-neutral" style={{ fontSize: 10 }}>{h.department}</span>
                        </td>
                        <td>{h.category}</td>
                        <td>{h.default_frequency}</td>
                        <td>
                          {h.is_recurring ? (
                            <span style={{ color: '#2e844a', fontWeight: 700 }}>Yes</span>
                          ) : (
                            <span className="text-muted">One-time</span>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${h.is_active ? 'badge-success' : 'badge-neutral'}`}>
                            {h.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            <button
                              onClick={() => {
                                setEditingHead(h);
                                setHeadForm({ ...h });
                                setHeadModal(true);
                              }}
                              className="btn btn-neutral btn-sm"
                              title="Edit Fee Head"
                            >
                              <i className="ti ti-edit"></i> Edit
                            </button>
                            <button
                              onClick={() => handleDeleteHead(h)}
                              className="btn btn-neutral btn-sm"
                              style={{ color: '#ba0517' }}
                              title="Delete Fee Head"
                            >
                              <i className="ti ti-trash"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tab 2: Rate Cards */}
            {activeTab === 'structures' && (
              <div className="card-body" style={{ padding: 20 }}>
                {structures.length === 0 ? (
                  <div className="empty-state">
                    <p className="text-xs text-muted">No rate cards configured. Click 'Create Rate Card' to get started.</p>
                  </div>
                ) : (
                  <div className="grid-3">
                    {structures.map((s) => (
                      <div key={s.id} style={{ background: '#fafaf9', border: '1px solid var(--neutral-2)', borderRadius: 8, padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--neutral-9)' }}>{s.name}</span>
                              {s.is_used && (
                                <span className="badge badge-info" style={{ fontSize: 9.5, padding: '2px 6px' }}>
                                  In Use (Protected)
                                </span>
                              )}
                              {s.is_archived && (
                                <span className="badge badge-neutral" style={{ fontSize: 9.5, padding: '2px 6px' }}>
                                  Archived
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted" style={{ marginTop: 2 }}>{s.class_name} • {s.session}</div>
                          </div>
                          <span style={{ fontWeight: 800, color: '#0176d3', fontSize: 14 }}>{fmt(s.total_amount)}/mo</span>
                        </div>

                        <div style={{ borderTop: '1px solid var(--neutral-2)', paddingTop: 10, marginTop: 8 }}>
                          <div className="text-xs font-bold text-muted mb-2">ITEMIZED RATES:</div>
                          {s.items?.map((it, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0' }}>
                              <span>{it.fee_head_name}</span>
                              <span style={{ fontWeight: 700 }}>{fmt(it.amount)}</span>
                            </div>
                          ))}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12, paddingTop: 8, borderTop: '1px solid var(--neutral-2)' }}>
                          <button
                            onClick={() => openEditStructure(s)}
                            className="btn btn-neutral btn-sm"
                            title="Edit Rate Card"
                          >
                            <i className="ti ti-edit"></i> Edit
                          </button>
                          <button
                            onClick={() => handleDeleteStructure(s)}
                            className="btn btn-neutral btn-sm"
                            style={{ color: '#ba0517' }}
                            title="Delete Rate Card"
                          >
                            <i className="ti ti-trash"></i> Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Concessions & Scholarships */}
            {activeTab === 'concessions' && (
              <div className="card-body" style={{ padding: 20 }}>
                {concessions.length === 0 ? (
                  <div className="empty-state">
                    <i className="ti ti-percentage" style={{ fontSize: 36, color: 'var(--neutral-4)' }}></i>
                    <h4 style={{ marginTop: 8 }}>No Student Concessions Configured</h4>
                    <p className="text-xs text-muted mb-4">Click 'Add Concession / Scholarship' to assign fee waivers or merit discounts.</p>
                    <button onClick={openAddConcession} className="btn btn-primary">
                      <i className="ti ti-plus"></i> Add Concession
                    </button>
                  </div>
                ) : (
                  <div className="grid-2">
                    {concessions.map((c) => (
                      <div key={c.id} style={{ background: '#fafaf9', border: '1px solid var(--neutral-2)', borderRadius: 8, padding: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: 13 }}>{c.student_name} ({c.admission_no})</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className="badge badge-success">
                              {c.discount_type === 'PERCENTAGE' ? `${c.discount_value}% OFF` : `₹${c.discount_value} OFF`}
                            </span>
                            <button
                              onClick={() => handleDeleteConcession(c)}
                              className="btn btn-neutral btn-sm"
                              style={{ color: '#ba0517', padding: '2px 6px' }}
                              title="Delete Concession"
                            >
                              <i className="ti ti-trash"></i>
                            </button>
                          </div>
                        </div>
                        <div className="text-xs text-muted" style={{ marginBottom: 4 }}>
                          Type: <strong>{c.concession_type}</strong> • Head: <strong>{c.fee_head_name}</strong>
                        </div>
                        <div className="text-xs text-muted" style={{ fontStyle: 'italic' }}>
                          "{c.reason}"
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Fee Head Modal */}
          {headModal && (
            <div className="modal-backdrop">
              <div className="modal">
                <div className="modal-header">
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>
                    {editingHead ? 'Edit Fee Head' : 'Add Fee Head (Service)'}
                  </h3>
                  <button onClick={() => setHeadModal(false)} className="modal-close">✕</button>
                </div>

                <form onSubmit={handleHeadSubmit}>
                  <div className="modal-body">
                    <div className="form-group">
                      <label className="form-label">Fee Head Name</label>
                      <input
                        type="text"
                        value={headForm.name}
                        onChange={(e) => setHeadForm({ ...headForm, name: e.target.value })}
                        placeholder="e.g. Science Lab Fee"
                        required
                        className="form-input"
                      />
                    </div>

                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">Code (Identifier)</label>
                        <input
                          type="text"
                          value={headForm.code}
                          onChange={(e) => setHeadForm({ ...headForm, code: e.target.value.toUpperCase().replace(' ', '_') })}
                          placeholder="e.g. LAB_FEE"
                          required
                          className="form-input"
                          style={{ fontFamily: 'monospace', fontWeight: 700 }}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Service Domain / Department</label>
                        <select
                          value={headForm.department || 'ACCOUNTS'}
                          onChange={(e) => {
                            const dept = e.target.value;
                            setHeadForm({ ...headForm, department: dept });
                          }}
                          className="form-select"
                          style={{ fontWeight: 700 }}
                        >
                          <option value="ACCOUNTS">Academic / Tuition / Exam (General)</option>
                          <option value="HOSTEL">Hostel Management (Room &amp; Mess)</option>
                          <option value="TRANSPORT">Transport Fleet (Bus &amp; Routes)</option>
                          <option value="LIBRARY">Library Center (Fines &amp; Books)</option>
                          <option value="ADMISSION">Admission Counter (Registration)</option>
                        </select>
                      </div>
                    </div>

                    {/* Smart Redirect Alerts when Special Service Domain is chosen */}
                    {headForm.department === 'HOSTEL' && (
                      <div style={{ background: '#f5f3ff', border: '1.5px solid #8b5cf6', borderRadius: 10, padding: 14, marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6d28d9', fontWeight: 800, fontSize: 13 }}>
                          <i className="ti ti-building-community" style={{ fontSize: 18 }} />
                          Hostel Fee Setup Detected
                        </div>
                        <p style={{ margin: '6px 0 10px', fontSize: 12, color: '#4c1d95', lineHeight: 1.5 }}>
                          Hostel fee structures require building, room category, floor, and AC/Non-AC matrix configuration. Would you like to configure hostel rates in the dedicated Hostel Fee Management center?
                        </p>
                        <button
                          type="button"
                          onClick={() => { setHeadModal(false); navigate('/hostel/fee-structures'); }}
                          className="btn btn-sm"
                          style={{ background: '#7c3aed', color: '#fff', fontWeight: 700 }}
                        >
                          Open Hostel Fee Management ➔
                        </button>
                      </div>
                    )}

                    {headForm.department === 'TRANSPORT' && (
                      <div style={{ background: '#ecfeff', border: '1.5px solid #06b6d4', borderRadius: 10, padding: 14, marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#0e7490', fontWeight: 800, fontSize: 13 }}>
                          <i className="ti ti-bus" style={{ fontSize: 18 }} />
                          Transport Route Fee Setup
                        </div>
                        <p style={{ margin: '6px 0 10px', fontSize: 12, color: '#155e75', lineHeight: 1.5 }}>
                          Transport fee amounts are calculated per route stop and distance slab. You can configure transport slabs directly in Transport Management.
                        </p>
                        <button
                          type="button"
                          onClick={() => { setHeadModal(false); navigate('/transport/fees'); }}
                          className="btn btn-sm"
                          style={{ background: '#0891b2', color: '#fff', fontWeight: 700 }}
                        >
                          Open Transport Fee Slabs ➔
                        </button>
                      </div>
                    )}

                    {headForm.department === 'LIBRARY' && (
                      <div style={{ background: '#fffbeb', border: '1.5px solid #f59e0b', borderRadius: 10, padding: 14, marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#b45309', fontWeight: 800, fontSize: 13 }}>
                          <i className="ti ti-books" style={{ fontSize: 18 }} />
                          Library Rules &amp; Fines Setup
                        </div>
                        <p style={{ margin: '6px 0 10px', fontSize: 12, color: '#92400e', lineHeight: 1.5 }}>
                          Library late return fines are determined by membership lending policies and grace periods.
                        </p>
                        <button
                          type="button"
                          onClick={() => { setHeadModal(false); navigate('/library/fines'); }}
                          className="btn btn-sm"
                          style={{ background: '#d97706', color: '#fff', fontWeight: 700 }}
                        >
                          Open Library Fine Settings ➔
                        </button>
                      </div>
                    )}

                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">Billing Frequency</label>
                        <select
                          value={headForm.default_frequency || 'MONTHLY'}
                          onChange={(e) => setHeadForm({ ...headForm, default_frequency: e.target.value })}
                          className="form-select"
                          style={{ fontWeight: 700 }}
                        >
                          <option value="MONTHLY">Monthly (Every Month)</option>
                          <option value="YEARLY">Yearly / Annual (Once per Year)</option>
                          <option value="QUARTERLY">Quarterly / Term (Exam Months)</option>
                          <option value="ONE_TIME">One-Time (Admission / Caution)</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Applicability / Facility Type</label>
                        <select
                          value={headForm.is_recurring ? 'MANDATORY' : 'OPTIONAL'}
                          onChange={(e) => setHeadForm({ ...headForm, is_recurring: e.target.value === 'MANDATORY' })}
                          className="form-select"
                        >
                          <option value="MANDATORY">Mandatory (All Class Students - Tuition, Comp, Misc)</option>
                          <option value="OPTIONAL">Optional Facility (Only if Enrolled in Bus, Hostel, Library)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="modal-footer">
                    <button type="button" onClick={() => setHeadModal(false)} className="btn btn-neutral">
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      Save Fee Head
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Structure Modal */}
          {structModal && (
            <div className="modal-backdrop">
              <div className="modal">
                <div className="modal-header">
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>Create Class Rate Card</h3>
                  <button onClick={() => setStructModal(false)} className="modal-close">✕</button>
                </div>

                <form onSubmit={handleStructureSubmit}>
                  <div className="modal-body">
                    <div className="form-group">
                      <label className="form-label">Structure Name</label>
                      <input
                        type="text"
                        value={structForm.name}
                        onChange={(e) => setStructForm({ ...structForm, name: e.target.value })}
                        placeholder="e.g. Class 8 Standard Rate Card 2026-27"
                        required
                        className="form-input"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Applicable Class</label>
                      <select
                        value={structForm.class_id}
                        onChange={(e) => setStructForm({ ...structForm, class_id: e.target.value })}
                        className="form-select"
                      >
                        <option value="">All Classes (School-wide Default)</option>
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.section || ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Itemized Rates (₹)</label>
                      <div className="table-container" style={{ maxHeight: 200, overflowY: 'auto' }}>
                        <table className="table">
                          <tbody>
                            {structForm.items.map((it, idx) => (
                              <tr key={idx}>
                                <td style={{ fontWeight: 600 }}>{it.fee_head_name}</td>
                                <td style={{ textAlign: 'right' }}>
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
                                    className="form-input"
                                    style={{ width: 100, height: 30, textAlign: 'right', fontWeight: 700, marginLeft: 'auto' }}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  <div className="modal-footer">
                    <button type="button" onClick={() => setStructModal(false)} className="btn btn-neutral">
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      Save Rate Card
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Add Concession / Scholarship Modal */}
          {concModal && (
            <div className="modal-backdrop">
              <div className="modal">
                <div className="modal-header">
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>
                    Add Concession / Scholarship
                  </h3>
                  <button onClick={() => setConcModal(false)} className="modal-close">✕</button>
                </div>

                <form onSubmit={handleConcessionSubmit}>
                  <div className="modal-body">
                    {/* Class Selector for filtering students */}
                    <div className="form-group">
                      <label className="form-label">Select Student Class</label>
                      <select
                        value={concClassId}
                        onChange={(e) => setConcClassId(e.target.value)}
                        className="form-select"
                      >
                        <option value="">All Classes</option>
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.section || ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Student Selector */}
                    <div className="form-group">
                      <label className="form-label">Select Student</label>
                      <select
                        value={concForm.student_id}
                        onChange={(e) => setConcForm({ ...concForm, student_id: e.target.value })}
                        required
                        className="form-select"
                        style={{ fontWeight: 700 }}
                      >
                        <option value="">-- Choose Student --</option>
                        {concStudents.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.admission_no} • {s.class_name})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Fee Head & Concession Type */}
                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">Applicable Fee Head</label>
                        <select
                          value={concForm.fee_head_id}
                          onChange={(e) => setConcForm({ ...concForm, fee_head_id: e.target.value })}
                          className="form-select"
                        >
                          <option value="">All Fees (Entire Bill)</option>
                          {heads.map((h) => (
                            <option key={h.id} value={h.id}>
                              {h.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Concession Type</label>
                        <select
                          value={concForm.concession_type}
                          onChange={(e) => setConcForm({ ...concForm, concession_type: e.target.value })}
                          className="form-select"
                        >
                          <option value="SCHOLARSHIP">Merit Scholarship</option>
                          <option value="SIBLING">Sibling Discount</option>
                          <option value="STAFF_CHILD">Staff Child Concession</option>
                          <option value="PRINCIPAL_SPECIAL">Principal Special Concession</option>
                          <option value="WAIVER">Fee Waiver / Financial Aid</option>
                        </select>
                      </div>
                    </div>

                    {/* Discount Type & Value */}
                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">Discount Type</label>
                        <select
                          value={concForm.discount_type}
                          onChange={(e) => setConcForm({ ...concForm, discount_type: e.target.value })}
                          className="form-select"
                        >
                          <option value="FIXED">Fixed Amount (₹)</option>
                          <option value="PERCENTAGE">Percentage (%)</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Discount Value ({concForm.discount_type === 'PERCENTAGE' ? '%' : '₹'})</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={concForm.discount_value}
                          onChange={(e) => setConcForm({ ...concForm, discount_value: e.target.value })}
                          placeholder={concForm.discount_type === 'PERCENTAGE' ? 'e.g. 25' : 'e.g. 500'}
                          required
                          className="form-input"
                          style={{ fontWeight: 700 }}
                        />
                      </div>
                    </div>

                    {/* Reason */}
                    <div className="form-group">
                      <label className="form-label">Reason / Approval Justification</label>
                      <input
                        type="text"
                        value={concForm.reason}
                        onChange={(e) => setConcForm({ ...concForm, reason: e.target.value })}
                        placeholder="e.g. 95% in Board Exams Merit or 2nd child in school"
                        required
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div className="modal-footer">
                    <button
                      type="button"
                      onClick={() => setConcModal(false)}
                      className="btn btn-neutral"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingConc}
                      className="btn btn-primary"
                    >
                      {savingConc ? 'Saving...' : 'Apply Concession'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Safeguard Modal when Rate Card is in use */}
          {safeguardModal && (
            <div className="modal-backdrop">
              <div className="modal" style={{ maxWidth: 480 }}>
                <div className="modal-header" style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#b45309', fontWeight: 800, fontSize: 15 }}>
                    <i className="ti ti-shield-alert" style={{ fontSize: 20 }} />
                    Rate Card In Active Use — Protected 🛡️
                  </div>
                  <button onClick={() => setSafeguardModal(null)} className="modal-close">✕</button>
                </div>
                <div className="modal-body" style={{ padding: 20 }}>
                  <p style={{ fontSize: 13.5, color: '#1e293b', lineHeight: 1.6, margin: '0 0 12px' }}>
                    <strong>"{safeguardModal.name}"</strong> is currently assigned to active students or has issued bills in the central financial ledger.
                  </p>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, fontSize: 12, color: '#475569', marginBottom: 16, lineHeight: 1.5 }}>
                    Hard deletion is permanently disabled to maintain audit compliance and prevent orphaned student bills.
                    Instead, you can <strong>Archive / Deactivate</strong> this rate card so it cannot be used for any new student assignments.
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button onClick={() => setSafeguardModal(null)} className="btn btn-neutral">
                      Cancel
                    </button>
                    <button
                      onClick={() => handleArchiveStructure(safeguardModal)}
                      className="btn btn-primary"
                      style={{ background: '#d97706', borderColor: '#d97706', fontWeight: 700 }}
                    >
                      <i className="ti ti-archive" /> Archive Rate Card
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
