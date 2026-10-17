import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { resolveTenantPath } from '../../utils/routeBuilder';

export default function FamilyGroupsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [familyGroups, setFamilyGroups] = useState([]);
  const [totalGroups, setTotalGroups] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');

  // Auto-Detect State
  const [autoDetectModal, setAutoDetectModal] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detectedClusters, setDetectedClusters] = useState([]);
  const [linkingCluster, setLinkingCluster] = useState(null);

  // Create / Edit Modal State
  const [groupModal, setGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [savingGroup, setSavingGroup] = useState(false);
  const [groupForm, setGroupForm] = useState({
    family_name: '',
    father_name: '',
    mother_name: '',
    primary_phone: '',
    secondary_phone: '',
    email: '',
    aadhar_no: '',
    address: '',
    notes: '',
    first_child_discount_pct: 0,
    second_child_discount_pct: 25,
    third_child_discount_pct: 50,
    student_ids: []
  });

  // Student Search inside Create Modal
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [searchedStudents, setSearchedStudents] = useState([]);
  const [searchingStudents, setSearchingStudents] = useState(false);
  const [selectedStudentsList, setSelectedStudentsList] = useState([]);

  // Manage Siblings Modal
  const [manageSiblingsModal, setManageSiblingsModal] = useState(false);
  const [activeGroup, setActiveGroup] = useState(null);
  const [activeGroupLoading, setActiveGroupLoading] = useState(false);
  const [addSiblingQuery, setAddSiblingQuery] = useState('');
  const [addSiblingResults, setAddSiblingResults] = useState([]);
  const [addingSibling, setAddingSibling] = useState(false);

  // Sibling discount live inspection modal
  const [inspectModal, setInspectModal] = useState(false);
  const [inspectData, setInspectData] = useState(null);
  const [inspectLoading, setInspectLoading] = useState(false);

  // Fetch Family Groups
  const fetchFamilyGroups = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page,
        per_page: perPage,
      });
      if (search.trim()) params.append('search', search.trim());

      const res = await api.get(`/fees-finance/family-groups?${params.toString()}`);
      if (res.data?.success) {
        setFamilyGroups(res.data.family_groups || []);
        setTotalGroups(res.data.total || 0);
        setTotalPages(res.data.pages || 1);
      }
    } catch (err) {
      toast.error('Failed to load family groups');
    } finally {
      setLoading(false);
    }
  }, [page, perPage, search]);

  useEffect(() => {
    fetchFamilyGroups();
  }, [fetchFamilyGroups]);

  // Open Auto-Detect Modal
  const openAutoDetect = async () => {
    setAutoDetectModal(true);
    setDetecting(true);
    try {
      const res = await api.get('/fees-finance/family-groups/auto-detect');
      if (res.data?.success) {
        setDetectedClusters(res.data.clusters || []);
      }
    } catch (err) {
      toast.error('Failed to run sibling auto-detection');
    } finally {
      setDetecting(false);
    }
  };

  // 1-Click Link Detected Cluster
  const handleLinkCluster = async (cluster) => {
    try {
      setLinkingCluster(cluster.phone);
      const payload = {
        family_name: cluster.sample_father_name ? `${cluster.sample_father_name} Family` : `Family (${cluster.phone})`,
        father_name: cluster.sample_father_name || '',
        mother_name: cluster.sample_mother_name || '',
        primary_phone: cluster.phone,
        first_child_discount_pct: 0,
        second_child_discount_pct: 25,
        third_child_discount_pct: 50,
        student_ids: cluster.students.map(s => s.id)
      };

      const res = await api.post('/fees-finance/family-groups', payload);
      if (res.data?.success) {
        toast.success(`Created ${res.data.family_group?.family_code || 'Family Group'} with ${cluster.students.length} siblings!`);
        // Remove cluster from local list
        setDetectedClusters(prev => prev.filter(c => c.phone !== cluster.phone));
        fetchFamilyGroups();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to link sibling cluster');
    } finally {
      setLinkingCluster(null);
    }
  };

  // Search Students for linking
  const searchStudents = async (query, setter) => {
    if (!query || query.trim().length < 2) {
      setter([]);
      return;
    }
    try {
      setSearchingStudents(true);
      const res = await api.get(`/fees-finance/students/search?search=${encodeURIComponent(query.trim())}&only_pending=false`);
      setter(res.data?.students || res.data || []);
    } catch (e) {
      setter([]);
    } finally {
      setSearchingStudents(false);
    }
  };

  // Open Create Modal
  const openCreateModal = () => {
    setEditingGroup(null);
    setGroupForm({
      family_name: '',
      father_name: '',
      mother_name: '',
      primary_phone: '',
      secondary_phone: '',
      email: '',
      aadhar_no: '',
      address: '',
      notes: '',
      first_child_discount_pct: 0,
      second_child_discount_pct: 25,
      third_child_discount_pct: 50,
      student_ids: []
    });
    setSelectedStudentsList([]);
    setStudentSearchQuery('');
    setSearchedStudents([]);
    setGroupModal(true);
  };

  // Open Edit Modal
  const openEditModal = (group) => {
    setEditingGroup(group);
    setGroupForm({
      family_name: group.family_name || '',
      father_name: group.father_name || '',
      mother_name: group.mother_name || '',
      primary_phone: group.primary_phone || '',
      secondary_phone: group.secondary_phone || '',
      email: group.email || '',
      aadhar_no: group.aadhar_no || '',
      address: group.address || '',
      notes: group.notes || '',
      first_child_discount_pct: group.first_child_discount_pct ?? 0,
      second_child_discount_pct: group.second_child_discount_pct ?? 25,
      third_child_discount_pct: group.third_child_discount_pct ?? 50,
      student_ids: (group.students || []).map(s => s.id)
    });
    setSelectedStudentsList(group.students || []);
    setStudentSearchQuery('');
    setSearchedStudents([]);
    setGroupModal(true);
  };

  // Submit Create / Edit Group
  const handleSaveGroup = async (e) => {
    e.preventDefault();
    if (!groupForm.primary_phone?.trim()) {
      toast.error('Primary Guardian Phone is required');
      return;
    }
    try {
      setSavingGroup(true);
      const payload = {
        ...groupForm,
        first_child_discount_pct: parseFloat(groupForm.first_child_discount_pct || 0),
        second_child_discount_pct: parseFloat(groupForm.second_child_discount_pct || 0),
        third_child_discount_pct: parseFloat(groupForm.third_child_discount_pct || 0),
        student_ids: selectedStudentsList.map(s => s.id)
      };

      if (editingGroup) {
        const res = await api.patch(`/fees-finance/family-groups/${editingGroup.id}`, payload);
        if (res.data?.success) {
          toast.success('Family Group updated successfully');
          setGroupModal(false);
          fetchFamilyGroups();
        }
      } else {
        const res = await api.post('/fees-finance/family-groups', payload);
        if (res.data?.success) {
          toast.success(`Family Group ${res.data.family_group?.family_code} created!`);
          setGroupModal(false);
          fetchFamilyGroups();
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save family group');
    } finally {
      setSavingGroup(false);
    }
  };

  // Open Manage Siblings Modal
  const openManageSiblings = async (group) => {
    setActiveGroup(group);
    setManageSiblingsModal(true);
    setAddSiblingQuery('');
    setAddSiblingResults([]);
    try {
      setActiveGroupLoading(true);
      const res = await api.get(`/fees-finance/family-groups/${group.id}`);
      if (res.data?.success) {
        setActiveGroup(res.data.family_group);
      }
    } catch (err) {
      toast.error('Failed to load group details');
    } finally {
      setActiveGroupLoading(false);
    }
  };

  // Add Sibling to existing group
  const handleAddSibling = async (student) => {
    if (!activeGroup) return;
    try {
      setAddingSibling(true);
      const res = await api.post(`/fees-finance/family-groups/${activeGroup.id}/students`, {
        student_id: student.id
      });
      if (res.data?.success) {
        toast.success(`Added ${student.full_name || student.name} to family group`);
        setActiveGroup(res.data.family_group);
        setAddSiblingQuery('');
        setAddSiblingResults([]);
        fetchFamilyGroups();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add student');
    } finally {
      setAddingSibling(false);
    }
  };

  // Remove Sibling from group
  const handleRemoveSibling = async (studentId) => {
    if (!activeGroup) return;
    if (!window.confirm('Are you sure you want to unlink this student from this family group? Sibling discount will be recalculated.')) {
      return;
    }
    try {
      const res = await api.delete(`/fees-finance/family-groups/${activeGroup.id}/students/${studentId}`);
      if (res.data?.success) {
        toast.success('Student unlinked from family group');
        setActiveGroup(res.data.family_group);
        fetchFamilyGroups();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to unlink student');
    }
  };

  // Delete entire family group
  const handleDeleteGroup = async (group) => {
    if (!window.confirm(`Delete family group ${group.family_code} (${group.family_name || group.primary_phone})? Linked students will be unlinked and sibling discounts removed.`)) {
      return;
    }
    try {
      const res = await api.delete(`/fees-finance/family-groups/${group.id}`);
      if (res.data?.success) {
        toast.success('Family Group deleted successfully');
        fetchFamilyGroups();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete family group');
    }
  };

  // Inspect live sibling discount
  const inspectSiblingDiscount = async (studentId) => {
    try {
      setInspectLoading(true);
      setInspectModal(true);
      const res = await api.get(`/fees-finance/students/${studentId}/sibling-discount`);
      if (res.data?.success) {
        setInspectData(res.data);
      }
    } catch (err) {
      toast.error('Failed to evaluate sibling discount');
      setInspectModal(false);
    } finally {
      setInspectLoading(false);
    }
  };

  // Total siblings calculation
  const totalSiblingsCount = familyGroups.reduce((acc, g) => acc + (g.students?.length || 0), 0);

  return (
    <div className="d-flex">
      <Sidebar />
      <div className="main-content flex-grow-1" style={{ minHeight: '100vh', background: '#f8fafc' }}>
        <Navbar />

        <div className="container-fluid p-4" style={{ maxWidth: 1400 }}>
          {/* Top Breadcrumb & Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#64748b', marginBottom: 4 }}>
                <span onClick={() => navigate(resolveTenantPath(user, '/finance/dashboard'))} style={{ cursor: 'pointer', color: '#0B3B7B', fontWeight: 600 }}>
                  Finance & Fees
                </span>
                <i className="ti ti-chevron-right" style={{ fontSize: 11 }} />
                <span>Family Groups & Sibling Discounts</span>
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0B3B7B', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                <i className="ti ti-users-group" style={{ color: '#2563eb' }} />
                Family Group Entity & Auto Sibling Discount Engine
              </h2>
              <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13.5 }}>
                Section 23 Architecture: Automates progressive multi-child tuition discounts (1st child: 0%, 2nd child: 25%, 3rd+ child: 50%) applied dynamically to class rate cards.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                onClick={openAutoDetect}
                className="btn btn-neutral"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 16px',
                  fontWeight: 700,
                  fontSize: 13,
                  background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                  color: '#15803d',
                  border: '1px solid #bbf7d0'
                }}
              >
                <i className="ti ti-wand" style={{ fontSize: 16 }} />
                Auto-Detect Siblings
              </button>

              <button
                onClick={openCreateModal}
                className="btn btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 18px',
                  fontWeight: 700,
                  fontSize: 13
                }}
              >
                <i className="ti ti-plus" />
                Create Family Group
              </button>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 20 }}>
            <div className="card" style={{ padding: '16px 20px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Registered Families
                </span>
                <span style={{ background: '#eff6ff', color: '#2563eb', padding: '6px 10px', borderRadius: 8 }}>
                  <i className="ti ti-home-heart" style={{ fontSize: 18 }} />
                </span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#0B3B7B', marginTop: 8 }}>
                {totalGroups}
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                Active household accounts
              </div>
            </div>

            <div className="card" style={{ padding: '16px 20px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Linked Siblings
                </span>
                <span style={{ background: '#f0fdf4', color: '#16a34a', padding: '6px 10px', borderRadius: 8 }}>
                  <i className="ti ti-friends" style={{ fontSize: 18 }} />
                </span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#15803d', marginTop: 8 }}>
                {totalSiblingsCount}
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                Students under family benefits
              </div>
            </div>

            <div className="card" style={{ padding: '16px 20px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Progressive Discount Rule
                </span>
                <span style={{ background: '#fef3c7', color: '#d97706', padding: '6px 10px', borderRadius: 8 }}>
                  <i className="ti ti-percentage" style={{ fontSize: 18 }} />
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                <span className="badge" style={{ background: '#f1f5f9', color: '#475569', fontWeight: 700, fontSize: 11.5, padding: '4px 8px' }}>
                  1st: 0%
                </span>
                <span className="badge" style={{ background: '#dbeafe', color: '#1d4ed8', fontWeight: 700, fontSize: 11.5, padding: '4px 8px' }}>
                  2nd: 25% Off
                </span>
                <span className="badge" style={{ background: '#dcfce7', color: '#15803d', fontWeight: 700, fontSize: 11.5, padding: '4px 8px' }}>
                  3rd+: 50% Off
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 6 }}>
                Ordered by chronological admission date
              </div>
            </div>

            <div className="card" style={{ padding: '16px 20px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Rate Card Integration
                </span>
                <span style={{ background: '#f3e8ff', color: '#9333ea', padding: '6px 10px', borderRadius: 8 }}>
                  <i className="ti ti-bolt" style={{ fontSize: 18 }} />
                </span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#6b21a8', marginTop: 8 }}>
                Automatic Ledger Application
              </div>
              <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4 }}>
                Applied during monthly fee generation and payment counter without manual concessions.
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="card mb-4" style={{ padding: '14px 18px', borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ flex: 1, minWidth: 260, position: 'relative' }}>
                <i className="ti ti-search" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search by Family Code, Parent Name, Mobile Number, or Child Name..."
                  className="form-control"
                  style={{ paddingLeft: 38, borderRadius: 8, height: 40, fontSize: 13.5 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => {
                    setSearch('');
                    setPage(1);
                    fetchFamilyGroups();
                  }}
                  className="btn btn-neutral btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
                >
                  <i className="ti ti-refresh" /> Refresh
                </button>
              </div>
            </div>
          </div>

          {/* Main Family Groups Table */}
          <div className="card" style={{ borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div className="table-responsive">
              <table className="table" style={{ margin: 0, verticalAlign: 'middle' }}>
                <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <tr>
                    <th style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', padding: '14px 18px' }}>Family Entity</th>
                    <th style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', padding: '14px 18px' }}>Parents & Guardian</th>
                    <th style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', padding: '14px 18px' }}>Linked Siblings & Discount Tier</th>
                    <th style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', padding: '14px 18px' }}>Discount Matrix</th>
                    <th style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', padding: '14px 18px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                        <i className="ti ti-loader ti-spin" style={{ fontSize: 24, display: 'block', marginBottom: 8 }} />
                        Loading family groups...
                      </td>
                    </tr>
                  ) : familyGroups.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '50px 20px', color: '#64748b' }}>
                        <div style={{ maxWidth: 420, margin: '0 auto' }}>
                          <i className="ti ti-users-group" style={{ fontSize: 44, color: '#cbd5e1', display: 'block', marginBottom: 12 }} />
                          <h4 style={{ fontSize: 16, fontWeight: 700, color: '#334155' }}>No Family Groups Found</h4>
                          <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                            {search ? 'No families match your search keyword.' : 'Get started by running Auto-Detect Siblings or manually creating a family group to enable automatic progressive discounts.'}
                          </p>
                          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16 }}>
                            <button onClick={openAutoDetect} className="btn btn-neutral btn-sm" style={{ fontWeight: 700 }}>
                              <i className="ti ti-wand" style={{ marginRight: 6 }} /> Run Auto-Detect
                            </button>
                            <button onClick={openCreateModal} className="btn btn-primary btn-sm" style={{ fontWeight: 700 }}>
                              <i className="ti ti-plus" style={{ marginRight: 6 }} /> Create Family Group
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    familyGroups.map((group) => (
                      <tr key={group.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '16px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb', fontWeight: 800 }}>
                              <i className="ti ti-home" style={{ fontSize: 20 }} />
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>
                                {group.family_name || 'Family Account'}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                <span className="badge" style={{ background: '#f1f5f9', color: '#3b82f6', fontWeight: 700, fontSize: 11 }}>
                                  {group.family_code}
                                </span>
                                {group.is_active ? (
                                  <span style={{ fontSize: 11, color: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a' }}></span> Active
                                  </span>
                                ) : (
                                  <span style={{ fontSize: 11, color: '#94a3b8' }}>Inactive</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: '16px 18px' }}>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#1e293b' }}>
                            {group.father_name && group.mother_name ? `${group.father_name} & ${group.mother_name}` : (group.father_name || group.mother_name || 'Guardian')}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, fontSize: 12, color: '#64748b' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <i className="ti ti-phone" style={{ fontSize: 13, color: '#94a3b8' }} /> {group.primary_phone || '—'}
                            </span>
                            {group.email && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <i className="ti ti-mail" style={{ fontSize: 13, color: '#94a3b8' }} /> {group.email}
                              </span>
                            )}
                          </div>
                        </td>

                        <td style={{ padding: '16px 18px' }}>
                          {(!group.students || group.students.length === 0) ? (
                            <span style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
                              No siblings linked yet
                            </span>
                          ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {group.students.map((student, idx) => {
                                const isFirst = idx === 0;
                                const isSecond = idx === 1;
                                const isThirdPlus = idx >= 2;
                                const discountPct = isFirst ? group.first_child_discount_pct : (isSecond ? group.second_child_discount_pct : group.third_child_discount_pct);

                                return (
                                  <div
                                    key={student.id}
                                    onClick={() => inspectSiblingDiscount(student.id)}
                                    title="Click to inspect live rate calculation"
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 6,
                                      padding: '4px 10px',
                                      borderRadius: 8,
                                      background: isFirst ? '#f8fafc' : (isSecond ? '#eff6ff' : '#f0fdf4'),
                                      border: `1px solid ${isFirst ? '#e2e8f0' : (isSecond ? '#bfdbfe' : '#bbf7d0')}`,
                                      cursor: 'pointer',
                                      fontSize: 12
                                    }}
                                  >
                                    <span style={{ fontWeight: 700, color: '#1e293b' }}>
                                      {student.name}
                                    </span>
                                    <span style={{ fontSize: 11, color: '#64748b' }}>
                                      ({student.class_name || 'Class'}{student.section_name ? `-${student.section_name}` : ''})
                                    </span>
                                    <span
                                      className="badge"
                                      style={{
                                        fontSize: 10,
                                        fontWeight: 800,
                                        background: isFirst ? '#e2e8f0' : (isSecond ? '#2563eb' : '#16a34a'),
                                        color: isFirst ? '#475569' : '#fff'
                                      }}
                                    >
                                      {discountPct > 0 ? `${discountPct}% OFF` : 'BASE (0%)'}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '16px 18px' }}>
                          <div style={{ fontSize: 12, color: '#475569', display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span>1st Child: <strong>{group.first_child_discount_pct}%</strong></span>
                            <span>2nd Child: <strong style={{ color: '#2563eb' }}>{group.second_child_discount_pct}%</strong></span>
                            <span>3rd+ Child: <strong style={{ color: '#16a34a' }}>{group.third_child_discount_pct}%</strong></span>
                          </div>
                        </td>

                        <td style={{ padding: '16px 18px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            <button
                              onClick={() => openManageSiblings(group)}
                              className="btn btn-neutral btn-sm"
                              title="Manage Siblings"
                              style={{ fontWeight: 600, fontSize: 12 }}
                            >
                              <i className="ti ti-users" style={{ marginRight: 4 }} /> Siblings ({group.students?.length || 0})
                            </button>

                            <button
                              onClick={() => openEditModal(group)}
                              className="btn btn-neutral btn-sm"
                              title="Edit Family"
                              style={{ padding: '6px 10px' }}
                            >
                              <i className="ti ti-edit" />
                            </button>

                            <button
                              onClick={() => handleDeleteGroup(group)}
                              className="btn btn-neutral btn-sm"
                              title="Delete Family"
                              style={{ padding: '6px 10px', color: '#ef4444' }}
                            >
                              <i className="ti ti-trash" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 13, color: '#64748b' }}>
                  Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalGroups} families)
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                    className="btn btn-neutral btn-sm"
                  >
                    Previous
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                    className="btn btn-neutral btn-sm"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── MODAL 1: AUTO-DETECT SIBLINGS (SMART HEURISTIC CLUSTERING) ─────────── */}
      {autoDetectModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 1050, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 780, maxHeight: '90vh', overflowY: 'auto', borderRadius: 14, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0B3B7B', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <i className="ti ti-wand" style={{ color: '#16a34a' }} />
                  Auto-Detect Student Sibling Clusters
                </h4>
                <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#64748b' }}>
                  Scans active students sharing identical normalized guardian phone numbers to detect unlinked siblings.
                </p>
              </div>
              <button onClick={() => setAutoDetectModal(false)} className="btn btn-neutral btn-sm" style={{ border: 'none' }}>
                <i className="ti ti-x" style={{ fontSize: 18 }} />
              </button>
            </div>

            <div style={{ padding: 22 }}>
              {detecting ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                  <i className="ti ti-loader ti-spin" style={{ fontSize: 28, display: 'block', marginBottom: 12, color: '#2563eb' }} />
                  Analyzing student admission records and guardian contacts...
                </div>
              ) : detectedClusters.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 0', color: '#64748b' }}>
                  <i className="ti ti-circle-check" style={{ fontSize: 40, color: '#16a34a', display: 'block', marginBottom: 8 }} />
                  <h5 style={{ fontWeight: 700, color: '#1e293b' }}>No Unlinked Sibling Clusters Detected</h5>
                  <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                    All students sharing identical contact information are already organized in family groups!
                  </p>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                      Found <span style={{ color: '#2563eb' }}>{detectedClusters.length} candidate family clusters</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {detectedClusters.map((cluster) => (
                      <div
                        key={cluster.phone}
                        style={{
                          border: '1px solid #e2e8f0',
                          borderRadius: 10,
                          padding: 16,
                          background: '#fff',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 12
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>
                              {cluster.sample_father_name ? `${cluster.sample_father_name} Household` : `Family Group`}
                            </div>
                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, display: 'flex', gap: 12 }}>
                              <span><i className="ti ti-phone" /> {cluster.phone}</span>
                              {cluster.sample_father_name && <span>Father: {cluster.sample_father_name}</span>}
                              {cluster.sample_mother_name && <span>Mother: {cluster.sample_mother_name}</span>}
                            </div>
                          </div>

                          <button
                            disabled={linkingCluster === cluster.phone}
                            onClick={() => handleLinkCluster(cluster)}
                            className="btn btn-primary btn-sm"
                            style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                          >
                            {linkingCluster === cluster.phone ? (
                              <>
                                <i className="ti ti-loader ti-spin" /> Linking...
                              </>
                            ) : (
                              <>
                                <i className="ti ti-link" /> Link as Family Group ({cluster.students.length} Siblings)
                              </>
                            )}
                          </button>
                        </div>

                        {/* List of siblings in cluster */}
                        <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px' }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>
                            Candidate Sibling Students (Sorted Chronologically)
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                            {cluster.students.map((st, idx) => (
                              <div
                                key={st.id}
                                style={{
                                  background: '#fff',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: 6,
                                  padding: '8px 10px',
                                  fontSize: 12
                                }}
                              >
                                <div style={{ fontWeight: 700, color: '#1e293b', display: 'flex', justifyContent: 'space-between' }}>
                                  <span>{st.name}</span>
                                  <span style={{ fontSize: 10.5, color: '#2563eb', fontWeight: 800 }}>
                                    {idx === 0 ? '1st (0%)' : (idx === 1 ? '2nd (25%)' : '3rd+ (50%)')}
                                  </span>
                                </div>
                                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                                  Adm: {st.admission_no} • {st.class_name || 'Class'}{st.section_name ? `-${st.section_name}` : ''}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: '14px 22px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setAutoDetectModal(false)} className="btn btn-neutral btn-sm" style={{ fontWeight: 600 }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: CREATE / EDIT FAMILY GROUP ─────────────────────────────── */}
      {groupModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 1050, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto', borderRadius: 14 }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0B3B7B' }}>
                  {editingGroup ? `Edit Family Group (${editingGroup.family_code})` : 'Create New Family Group'}
                </h4>
                <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#64748b' }}>
                  Define household contact information and progressive sibling discount policy.
                </p>
              </div>
              <button onClick={() => setGroupModal(false)} className="btn btn-neutral btn-sm" style={{ border: 'none' }}>
                <i className="ti ti-x" style={{ fontSize: 18 }} />
              </button>
            </div>

            <form onSubmit={handleSaveGroup} style={{ padding: 22 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Family / Household Name
                  </label>
                  <input
                    type="text"
                    value={groupForm.family_name}
                    onChange={(e) => setGroupForm({ ...groupForm, family_name: e.target.value })}
                    placeholder="e.g. Verma Family"
                    className="form-control"
                    style={{ borderRadius: 8 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Primary Guardian Phone <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={groupForm.primary_phone}
                    onChange={(e) => setGroupForm({ ...groupForm, primary_phone: e.target.value })}
                    placeholder="e.g. 9876543210"
                    className="form-control"
                    style={{ borderRadius: 8 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Father Name
                  </label>
                  <input
                    type="text"
                    value={groupForm.father_name}
                    onChange={(e) => setGroupForm({ ...groupForm, father_name: e.target.value })}
                    placeholder="Father's full name"
                    className="form-control"
                    style={{ borderRadius: 8 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Mother Name
                  </label>
                  <input
                    type="text"
                    value={groupForm.mother_name}
                    onChange={(e) => setGroupForm({ ...groupForm, mother_name: e.target.value })}
                    placeholder="Mother's full name"
                    className="form-control"
                    style={{ borderRadius: 8 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Guardian Email
                  </label>
                  <input
                    type="email"
                    value={groupForm.email}
                    onChange={(e) => setGroupForm({ ...groupForm, email: e.target.value })}
                    placeholder="guardian@example.com"
                    className="form-control"
                    style={{ borderRadius: 8 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Aadhar / National ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={groupForm.aadhar_no}
                    onChange={(e) => setGroupForm({ ...groupForm, aadhar_no: e.target.value })}
                    placeholder="XXXX-XXXX-XXXX"
                    className="form-control"
                    style={{ borderRadius: 8 }}
                  />
                </div>
              </div>

              {/* Progressive Sibling Discount Config */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0B3B7B', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className="ti ti-percentage" /> Progressive Tuition Discount Tier Rules (%)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>
                      1st Child Discount (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={groupForm.first_child_discount_pct}
                      onChange={(e) => setGroupForm({ ...groupForm, first_child_discount_pct: e.target.value })}
                      className="form-control"
                      style={{ borderRadius: 8 }}
                    />
                    <span style={{ fontSize: 10.5, color: '#94a3b8' }}>Baseline (Default: 0%)</span>
                  </div>

                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 600, color: '#1d4ed8', display: 'block', marginBottom: 4 }}>
                      2nd Child Discount (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={groupForm.second_child_discount_pct}
                      onChange={(e) => setGroupForm({ ...groupForm, second_child_discount_pct: e.target.value })}
                      className="form-control"
                      style={{ borderRadius: 8, borderColor: '#bfdbfe' }}
                    />
                    <span style={{ fontSize: 10.5, color: '#2563eb' }}>Default: 25%</span>
                  </div>

                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 600, color: '#15803d', display: 'block', marginBottom: 4 }}>
                      3rd+ Child Discount (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={groupForm.third_child_discount_pct}
                      onChange={(e) => setGroupForm({ ...groupForm, third_child_discount_pct: e.target.value })}
                      className="form-control"
                      style={{ borderRadius: 8, borderColor: '#bbf7d0' }}
                    />
                    <span style={{ fontSize: 10.5, color: '#16a34a' }}>Default: 50%</span>
                  </div>
                </div>
              </div>

              {/* Student Linking Section */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 }}>
                  Link Children / Siblings
                </label>

                {/* Selected Students Chips */}
                {selectedStudentsList.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    {selectedStudentsList.map((st, i) => (
                      <span
                        key={st.id}
                        style={{
                          background: '#eff6ff',
                          border: '1px solid #bfdbfe',
                          color: '#1e40af',
                          padding: '4px 10px',
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6
                        }}
                      >
                        #{i + 1} {st.name || st.full_name} ({st.class_name || 'Class'})
                        <i
                          className="ti ti-x"
                          onClick={() => setSelectedStudentsList(prev => prev.filter(x => x.id !== st.id))}
                          style={{ cursor: 'pointer', fontSize: 12 }}
                        />
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={studentSearchQuery}
                    onChange={(e) => {
                      setStudentSearchQuery(e.target.value);
                      searchStudents(e.target.value, setSearchedStudents);
                    }}
                    placeholder="Search student by name or admission number to link..."
                    className="form-control"
                    style={{ borderRadius: 8 }}
                  />
                  {searchingStudents && (
                    <span style={{ position: 'absolute', right: 12, top: 10, fontSize: 12, color: '#94a3b8' }}>
                      <i className="ti ti-loader ti-spin" />
                    </span>
                  )}
                </div>

                {/* Search Results Dropdown */}
                {searchedStudents.length > 0 && (
                  <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, marginTop: 4, background: '#fff' }}>
                    {searchedStudents.map((st) => {
                      const isAlready = selectedStudentsList.some(x => x.id === st.id);
                      return (
                        <div
                          key={st.id}
                          onClick={() => {
                            if (!isAlready) {
                              setSelectedStudentsList(prev => [...prev, st]);
                            }
                            setStudentSearchQuery('');
                            setSearchedStudents([]);
                          }}
                          style={{
                            padding: '8px 12px',
                            borderBottom: '1px solid #f1f5f9',
                            cursor: isAlready ? 'default' : 'pointer',
                            background: isAlready ? '#f8fafc' : '#fff',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: 12.5
                          }}
                        >
                          <div>
                            <strong>{st.name || st.full_name}</strong> • Adm: {st.admission_no} • {st.class_name || 'Class'}
                          </div>
                          {isAlready ? (
                            <span style={{ color: '#16a34a', fontWeight: 700, fontSize: 11 }}>Linked</span>
                          ) : (
                            <span style={{ color: '#2563eb', fontWeight: 700, fontSize: 11 }}>+ Select</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                  Residential Address & Notes
                </label>
                <textarea
                  rows={2}
                  value={groupForm.address}
                  onChange={(e) => setGroupForm({ ...groupForm, address: e.target.value })}
                  placeholder="Permanent / Correspondence Address"
                  className="form-control"
                  style={{ borderRadius: 8, fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  onClick={() => setGroupModal(false)}
                  className="btn btn-neutral"
                  style={{ fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingGroup}
                  className="btn btn-primary"
                  style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  {savingGroup ? <i className="ti ti-loader ti-spin" /> : <i className="ti ti-check" />}
                  {editingGroup ? 'Save Changes' : 'Create Family Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: MANAGE SIBLINGS & LIVE DISCOUNT TESTER ──────────────────── */}
      {manageSiblingsModal && activeGroup && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 1050, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 720, maxHeight: '90vh', overflowY: 'auto', borderRadius: 14 }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0B3B7B' }}>
                  Manage Siblings — {activeGroup.family_name || 'Family'} ({activeGroup.family_code})
                </h4>
                <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#64748b' }}>
                  Chronological ranking determines auto-discount tiers (1st: {activeGroup.first_child_discount_pct}%, 2nd: {activeGroup.second_child_discount_pct}%, 3rd+: {activeGroup.third_child_discount_pct}%).
                </p>
              </div>
              <button onClick={() => setManageSiblingsModal(false)} className="btn btn-neutral btn-sm" style={{ border: 'none' }}>
                <i className="ti ti-x" style={{ fontSize: 18 }} />
              </button>
            </div>

            <div style={{ padding: 22 }}>
              {/* Add Sibling Box */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, marginBottom: 18 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  Link Another Student to this Family
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={addSiblingQuery}
                    onChange={(e) => {
                      setAddSiblingQuery(e.target.value);
                      searchStudents(e.target.value, setAddSiblingResults);
                    }}
                    placeholder="Type student name or admission number to add..."
                    className="form-control"
                    style={{ borderRadius: 8, height: 38 }}
                  />
                </div>

                {addSiblingResults.length > 0 && (
                  <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, marginTop: 4, background: '#fff' }}>
                    {addSiblingResults.map((st) => {
                      const isAlready = (activeGroup.students || []).some(x => x.id === st.id);
                      return (
                        <div
                          key={st.id}
                          style={{
                            padding: '8px 12px',
                            borderBottom: '1px solid #f1f5f9',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: 12.5
                          }}
                        >
                          <div>
                            <strong>{st.name || st.full_name}</strong> • Adm: {st.admission_no} • {st.class_name || 'Class'}
                          </div>
                          {isAlready ? (
                            <span style={{ color: '#16a34a', fontWeight: 700, fontSize: 11 }}>Already Linked</span>
                          ) : (
                            <button
                              disabled={addingSibling}
                              onClick={() => handleAddSibling(st)}
                              className="btn btn-primary btn-sm"
                              style={{ padding: '3px 10px', fontSize: 11, fontWeight: 700 }}
                            >
                              + Add Sibling
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Linked Siblings List */}
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>
                Currently Linked Children (Ordered Chronologically)
              </div>

              {activeGroupLoading ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: '#64748b' }}>
                  <i className="ti ti-loader ti-spin" /> Loading siblings...
                </div>
              ) : (!activeGroup.students || activeGroup.students.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontStyle: 'italic' }}>
                  No students currently linked. Search above to link students.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {activeGroup.students.map((st, idx) => {
                    const isFirst = idx === 0;
                    const isSecond = idx === 1;
                    const discountPct = isFirst ? activeGroup.first_child_discount_pct : (isSecond ? activeGroup.second_child_discount_pct : activeGroup.third_child_discount_pct);

                    return (
                      <div
                        key={st.id}
                        style={{
                          border: '1px solid #e2e8f0',
                          borderRadius: 10,
                          padding: '12px 16px',
                          background: isFirst ? '#f8fafc' : (isSecond ? '#eff6ff' : '#f0fdf4'),
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 8,
                              background: isFirst ? '#cbd5e1' : (isSecond ? '#2563eb' : '#16a34a'),
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: 13
                            }}
                          >
                            #{idx + 1}
                          </span>

                          <div>
                            <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 14 }}>
                              {st.name || st.full_name}
                            </div>
                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                              Adm No: <strong>{st.admission_no}</strong> • {st.class_name || 'Class'}{st.section_name ? `-${st.section_name}` : ''} • Adm Date: {st.admission_date || 'N/A'}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span
                            className="badge"
                            style={{
                              padding: '6px 12px',
                              fontSize: 12,
                              fontWeight: 800,
                              background: isFirst ? '#e2e8f0' : (isSecond ? '#dbeafe' : '#dcfce7'),
                              color: isFirst ? '#475569' : (isSecond ? '#1d4ed8' : '#15803d'),
                              borderRadius: 8
                            }}
                          >
                            {discountPct > 0 ? `${discountPct}% AUTO DISCOUNT` : 'BASELINE (0%)'}
                          </span>

                          <button
                            onClick={() => inspectSiblingDiscount(st.id)}
                            className="btn btn-neutral btn-sm"
                            title="Inspect live rate & ledger"
                            style={{ padding: '6px 10px', fontSize: 11.5, fontWeight: 600 }}
                          >
                            <i className="ti ti-calculator" style={{ marginRight: 4 }} /> Test Rate
                          </button>

                          <button
                            onClick={() => handleRemoveSibling(st.id)}
                            className="btn btn-neutral btn-sm"
                            title="Unlink student"
                            style={{ padding: '6px 10px', color: '#ef4444' }}
                          >
                            <i className="ti ti-unlink" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ padding: '14px 22px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setManageSiblingsModal(false)} className="btn btn-neutral btn-sm" style={{ fontWeight: 600 }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 4: LIVE SIBLING DISCOUNT INSPECTOR ────────────────────────── */}
      {inspectModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 1060, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 540, borderRadius: 14 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <h5 style={{ margin: 0, fontWeight: 800, color: '#0B3B7B', display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="ti ti-calculator" style={{ color: '#2563eb' }} />
                Live Sibling Discount Evaluation
              </h5>
              <button onClick={() => setInspectModal(false)} className="btn btn-neutral btn-sm" style={{ border: 'none' }}>
                <i className="ti ti-x" />
              </button>
            </div>

            <div style={{ padding: 20 }}>
              {inspectLoading ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: '#64748b' }}>
                  <i className="ti ti-loader ti-spin" style={{ fontSize: 24, display: 'block', marginBottom: 8 }} />
                  Evaluating student tier with ledger engine...
                </div>
              ) : inspectData ? (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
                    <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
                      <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Sibling Index</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                        Child #{inspectData.sibling_index} of {inspectData.total_siblings}
                      </div>
                    </div>

                    <div style={{ background: inspectData.discount_pct > 0 ? '#f0fdf4' : '#f8fafc', padding: 12, borderRadius: 8 }}>
                      <div style={{ fontSize: 11, color: inspectData.discount_pct > 0 ? '#166534' : '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                        Eligible Sibling Discount
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: inspectData.discount_pct > 0 ? '#15803d' : '#64748b', marginTop: 2 }}>
                        {inspectData.discount_pct}% OFF
                      </div>
                    </div>
                  </div>

                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 12, fontSize: 12.5, color: '#1e40af', lineHeight: 1.5 }}>
                    <strong>Ledger Engine Evaluation:</strong> {inspectData.reason}
                  </div>

                  <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button
                      onClick={() => {
                        setInspectModal(false);
                        navigate(resolveTenantPath(user, `/finance/students/${inspectData.student_id}/ledger`));
                      }}
                      className="btn btn-neutral btn-sm"
                      style={{ fontWeight: 600 }}
                    >
                      <i className="ti ti-file-analytics" style={{ marginRight: 4 }} /> View Student Ledger
                    </button>
                    <button onClick={() => setInspectModal(false)} className="btn btn-primary btn-sm" style={{ fontWeight: 600 }}>
                      Close
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
