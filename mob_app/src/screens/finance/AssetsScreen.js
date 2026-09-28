// mob_app/src/screens/finance/AssetsScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  TouchableOpacity, ActivityIndicator, TextInput, Modal, Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';

const ASSET_CATEGORIES = [
  'ALL',
  'FURNITURE',
  'LAPTOPS',
  'DESKTOPS',
  'PROJECTORS',
  'VEHICLES',
  'LAB_EQUIPMENT',
  'SPORTS_EQUIPMENT',
  'AUDIO_VISUAL',
  'OTHER',
];

const ASSET_STATUSES = [
  { key: '', label: 'All Status' },
  { key: 'IN_USE', label: 'In Use' },
  { key: 'IN_STORE', label: 'In Store' },
  { key: 'MAINTENANCE', label: 'In Repair' },
  { key: 'DISPOSED', label: 'Disposed' },
];

const CONDITIONS = ['EXCELLENT', 'GOOD', 'FAIR', 'DAMAGED'];
const DISPOSAL_METHODS = ['RETIRED', 'SCRAPPED', 'SOLD', 'DONATED'];

const fmt = (n) => `₹ ${Number(n || 0).toLocaleString('en-IN')}`;

export default function AssetsScreen({ navigation }) {
  const { user } = useAuth();
  const role = user?.role ? String(user.role).toUpperCase() : 'STAFF';
  const canManage = ['PRINCIPAL', 'VICE_PRINCIPAL', 'ADMIN', 'SUPER_ADMIN', 'ACCOUNTANT'].includes(role);

  const [assets, setAssets] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Selected Asset for Actions
  const [selectedAsset, setSelectedAsset] = useState(null);

  // Modals
  const [createModal, setCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    category: 'LAPTOPS',
    serial_number: '',
    model_number: '',
    brand: '',
    purchase_cost: '',
    purchase_date: new Date().toISOString().split('T')[0],
    location: 'Store / Unassigned',
    department: 'ADMIN',
    warranty_start: '',
    warranty_end: '',
    notes: '',
  });

  const [transferModal, setTransferModal] = useState(false);
  const [transferForm, setTransferForm] = useState({
    to_user_name: '',
    to_location: '',
    to_department: 'ADMIN',
    reason: '',
  });

  const [conditionModal, setConditionModal] = useState(false);
  const [condForm, setCondForm] = useState({
    condition: 'GOOD',
    notes: '',
  });

  const [maintModal, setMaintModal] = useState(false);
  const [maintForm, setMaintForm] = useState({
    title: '',
    description: '',
    cost: '',
    vendor_name: '',
    performed_by: '',
  });

  const [disposeModal, setDisposeModal] = useState(false);
  const [disposeForm, setDisposeForm] = useState({
    disposal_method: 'RETIRED',
    disposal_amount: '0',
    reason: '',
  });

  const [detailModal, setDetailModal] = useState(false);
  const [assetDetail, setAssetDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailTab, setDetailTab] = useState('CUSTODY'); // 'CUSTODY' | 'CONDITION' | 'MAINTENANCE'

  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (selectedCategory && selectedCategory !== 'ALL') params.category = selectedCategory;
      if (selectedStatus) params.status = selectedStatus;

      const [aRes, sRes] = await Promise.all([
        client.get('/finance/assets', { params }).catch(() => ({ data: [] })),
        client.get('/finance/assets/summary').catch(() => ({ data: null })),
      ]);

      const list = Array.isArray(aRes.data) ? aRes.data : aRes.data?.assets || [];
      setAssets(list);
      setSummary(sRes.data);
    } catch {
      setAssets([]);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, [search, selectedCategory, selectedStatus]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Create Asset
  const handleCreateAsset = async () => {
    if (!createForm.name.trim()) {
      Alert.alert('Validation Error', 'Asset name is required.');
      return;
    }
    setSubmitting(true);
    try {
      await client.post('/finance/assets', {
        ...createForm,
        purchase_cost: parseFloat(createForm.purchase_cost) || 0,
      });
      Alert.alert('Success', 'Asset registered successfully.');
      setCreateModal(false);
      setCreateForm({
        name: '',
        category: 'LAPTOPS',
        serial_number: '',
        model_number: '',
        brand: '',
        purchase_cost: '',
        purchase_date: new Date().toISOString().split('T')[0],
        location: 'Store / Unassigned',
        department: 'ADMIN',
        warranty_start: '',
        warranty_end: '',
        notes: '',
      });
      loadData();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to register asset.');
    } finally {
      setSubmitting(false);
    }
  };

  // Transfer Asset
  const handleTransfer = async () => {
    if (!transferForm.to_user_name.trim() && !transferForm.to_location.trim()) {
      Alert.alert('Validation Error', 'Specify either an assignee name or room/location.');
      return;
    }
    setSubmitting(true);
    try {
      await client.post(`/finance/assets/${selectedAsset.id}/transfer`, transferForm);
      Alert.alert('Success', 'Asset custody transferred successfully.');
      setTransferModal(false);
      loadData();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to transfer asset.');
    } finally {
      setSubmitting(false);
    }
  };

  // Record Condition
  const handleRecordCondition = async () => {
    setSubmitting(true);
    try {
      await client.post(`/finance/assets/${selectedAsset.id}/condition`, condForm);
      Alert.alert('Success', 'Condition inspection recorded.');
      setConditionModal(false);
      loadData();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to record condition.');
    } finally {
      setSubmitting(false);
    }
  };

  // Record Maintenance
  const handleRecordMaintenance = async () => {
    if (!maintForm.title.trim()) {
      Alert.alert('Validation Error', 'Maintenance title / issue description is required.');
      return;
    }
    setSubmitting(true);
    try {
      await client.post(`/finance/assets/${selectedAsset.id}/maintenance`, {
        ...maintForm,
        cost: parseFloat(maintForm.cost) || 0,
      });
      Alert.alert('Success', 'Maintenance record created and synced with operating expenses.');
      setMaintModal(false);
      loadData();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to record maintenance.');
    } finally {
      setSubmitting(false);
    }
  };

  // Dispose Asset
  const handleDispose = async () => {
    if (!disposeForm.reason.trim()) {
      Alert.alert('Validation Error', 'Reason is required for asset disposal.');
      return;
    }
    setSubmitting(true);
    try {
      await client.post(`/finance/assets/${selectedAsset.id}/dispose`, {
        ...disposeForm,
        disposal_amount: parseFloat(disposeForm.disposal_amount) || 0,
      });
      Alert.alert('Success', 'Asset retired / disposed.');
      setDisposeModal(false);
      loadData();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to dispose asset.');
    } finally {
      setSubmitting(false);
    }
  };

  // View Full Asset Detail & Audit History
  const openDetail = async (asset) => {
    setSelectedAsset(asset);
    setDetailModal(true);
    setLoadingDetail(true);
    setDetailTab('CUSTODY');
    try {
      const res = await client.get(`/finance/assets/${asset.id}`);
      setAssetDetail(res.data);
    } catch {
      setAssetDetail(null);
      Alert.alert('Notice', 'Failed to load comprehensive asset audit trail.');
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation?.goBack?.()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Fixed Assets & Equipment</Text>
          <Text style={styles.headerSub}>Capital Assets, Custody & Maintenance</Text>
        </View>
        {canManage && (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setCreateModal(true)}
          >
            <Ionicons name="add" size={20} color="#ffffff" />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* KPI Overview Banner */}
      <View style={styles.kpiContainer}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiVal}>{summary?.total_assets || assets.length}</Text>
          <Text style={styles.kpiLbl}>Total Assets</Text>
        </View>
        <View style={[styles.kpiCard, { borderColor: '#e0e7ff' }]}>
          <Text style={[styles.kpiVal, { color: '#4338ca' }]}>
            {fmt(summary?.total_valuation || 0)}
          </Text>
          <Text style={styles.kpiLbl}>Asset Valuation</Text>
        </View>
        <View style={[styles.kpiCard, { borderColor: '#dcfce7' }]}>
          <Text style={[styles.kpiVal, { color: '#16a34a' }]}>
            {summary?.in_use_count ?? assets.filter(a => a.status === 'IN_USE').length}
          </Text>
          <Text style={styles.kpiLbl}>Active In-Use</Text>
        </View>
      </View>

      {/* Search Input */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color="#64748b" style={{ marginLeft: 12 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by asset tag, serial, brand, custodian..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')} style={{ padding: 8 }}>
            <Ionicons name="close-circle" size={18} color="#94a3b8" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Category Chips */}
      <View style={{ height: 44, marginBottom: 4 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {ASSET_CATEGORIES.map(cat => {
            const isSel = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.filterChip, isSel && styles.filterChipActive]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={[styles.filterChipText, isSel && styles.filterChipTextActive]}>
                  {cat.replace(/_/g, ' ')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Status Chips */}
      <View style={{ height: 38, marginBottom: 8 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {ASSET_STATUSES.map(st => {
            const isSel = selectedStatus === st.key;
            return (
              <TouchableOpacity
                key={st.key}
                style={[styles.statusChip, isSel && styles.statusChipActive]}
                onPress={() => setSelectedStatus(st.key)}
              >
                <Text style={[styles.statusChipText, isSel && styles.statusChipTextActive]}>
                  {st.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Assets FlatList */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading capital assets register...</Text>
        </View>
      ) : (
        <FlatList
          data={assets}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadData(true)}
              colors={[colors.primary]}
            />
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="hardware-chip-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No Capital Assets Found</Text>
              <Text style={styles.emptySub}>
                {search ? 'Try adjusting your search criteria.' : 'Tap "+ Add" to register a new school asset.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isDamaged = item.condition === 'DAMAGED';
            const isInUse = item.status === 'IN_USE';

            return (
              <View style={styles.assetCard}>
                <View style={styles.assetHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.assetName}>{item.name}</Text>
                    <View style={styles.badgeRow}>
                      <View style={styles.catBadge}>
                        <Text style={styles.catBadgeText}>{item.category || 'ASSET'}</Text>
                      </View>
                      {item.asset_tag ? (
                        <View style={[styles.catBadge, { backgroundColor: '#f1f5f9' }]}>
                          <Text style={[styles.catBadgeText, { color: '#475569' }]}>
                            {item.asset_tag}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.costText}>{fmt(item.purchase_cost)}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: isInUse ? '#dcfce7' : '#f1f5f9' }]}>
                      <Text style={[styles.statusBadgeText, { color: isInUse ? '#15803d' : '#475569' }]}>
                        {item.status || 'IN_STORE'}
                      </Text>
                    </View>
                  </View>
                </View>

                {item.assigned_to_name ? (
                  <View style={styles.detailRow}>
                    <Ionicons name="person-outline" size={14} color="#64748b" />
                    <Text style={styles.detailText}>Custodian: {item.assigned_to_name}</Text>
                  </View>
                ) : null}

                {item.location ? (
                  <View style={styles.detailRow}>
                    <Ionicons name="location-outline" size={14} color="#64748b" />
                    <Text style={styles.detailText}>Location: {item.location}</Text>
                  </View>
                ) : null}

                <View style={styles.metaRow}>
                  <Text style={styles.metaItem}>Condition: </Text>
                  <Text style={[styles.metaCondition, { color: isDamaged ? '#dc2626' : '#16a34a' }]}>
                    {item.condition || 'GOOD'}
                  </Text>
                  {item.serial_number ? (
                    <>
                      <Text style={styles.metaDivider}>•</Text>
                      <Text style={styles.metaItem}>SN: {item.serial_number}</Text>
                    </>
                  ) : null}
                </View>

                <View style={styles.cardDivider} />

                {/* Actions Grid */}
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.actionBtnOutline}
                    onPress={() => openDetail(item)}
                  >
                    <Ionicons name="time-outline" size={14} color="#0284c7" />
                    <Text style={[styles.actionBtnOutlineText, { color: '#0284c7' }]}>Audit Trail</Text>
                  </TouchableOpacity>

                  {canManage && (
                    <TouchableOpacity
                      style={styles.actionBtnOutline}
                      onPress={() => {
                        setSelectedAsset(item);
                        setCondForm({ condition: item.condition || 'GOOD', notes: '' });
                        setConditionModal(true);
                      }}
                    >
                      <Ionicons name="shield-checkmark-outline" size={14} color="#059669" />
                      <Text style={[styles.actionBtnOutlineText, { color: '#059669' }]}>Inspect</Text>
                    </TouchableOpacity>
                  )}

                  {canManage && (
                    <TouchableOpacity
                      style={styles.actionBtnOutline}
                      onPress={() => {
                        setSelectedAsset(item);
                        setTransferForm({
                          to_user_name: '',
                          to_location: item.location || '',
                          to_department: item.department || 'ADMIN',
                          reason: '',
                        });
                        setTransferModal(true);
                      }}
                    >
                      <Ionicons name="swap-horizontal-outline" size={14} color="#7c3aed" />
                      <Text style={[styles.actionBtnOutlineText, { color: '#7c3aed' }]}>Transfer</Text>
                    </TouchableOpacity>
                  )}

                  {canManage && (
                    <TouchableOpacity
                      style={styles.actionBtnPrimary}
                      onPress={() => {
                        setSelectedAsset(item);
                        setMaintForm({
                          title: '',
                          description: '',
                          cost: '',
                          vendor_name: '',
                          performed_by: '',
                        });
                        setMaintModal(true);
                      }}
                    >
                      <Ionicons name="construct-outline" size={14} color="#ffffff" />
                      <Text style={styles.actionBtnPrimaryText}>Service</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Add Asset Modal */}
      <Modal
        visible={createModal}
        animationType="slide"
        transparent
        onRequestClose={() => setCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Register Capital Asset</Text>
              <TouchableOpacity onPress={() => setCreateModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              <Text style={styles.inputLabel}>Asset Name *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Dell Latitude 5420 Laptop, Physics Lab Microscope"
                value={createForm.name}
                onChangeText={(t) => setCreateForm({ ...createForm, name: t })}
              />

              <Text style={styles.inputLabel}>Category</Text>
              <View style={styles.chipsRow}>
                {ASSET_CATEGORIES.filter(c => c !== 'ALL').map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.smallChip, createForm.category === c && styles.smallChipActive]}
                    onPress={() => setCreateForm({ ...createForm, category: c })}
                  >
                    <Text style={[styles.smallChipText, createForm.category === c && styles.smallChipTextActive]}>
                      {c.replace(/_/g, ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.twoCol}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={styles.inputLabel}>Serial Number</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="S/N or Service Tag"
                    value={createForm.serial_number}
                    onChangeText={(t) => setCreateForm({ ...createForm, serial_number: t })}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Text style={styles.inputLabel}>Model Number</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Model No."
                    value={createForm.model_number}
                    onChangeText={(t) => setCreateForm({ ...createForm, model_number: t })}
                  />
                </View>
              </View>

              <View style={styles.twoCol}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={styles.inputLabel}>Purchase Cost (₹)</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="0.00"
                    keyboardType="numeric"
                    value={createForm.purchase_cost}
                    onChangeText={(t) => setCreateForm({ ...createForm, purchase_cost: t })}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Text style={styles.inputLabel}>Purchase Date</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="YYYY-MM-DD"
                    value={createForm.purchase_date}
                    onChangeText={(t) => setCreateForm({ ...createForm, purchase_date: t })}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Physical Location / Room</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Science Lab 2, Principal Office, Server Room"
                value={createForm.location}
                onChangeText={(t) => setCreateForm({ ...createForm, location: t })}
              />

              <Text style={styles.inputLabel}>Department</Text>
              <View style={styles.chipsRow}>
                {['ADMIN', 'ACADEMIC', 'IT', 'LAB', 'SPORTS', 'TRANSPORT'].map(d => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.smallChip, createForm.department === d && styles.smallChipActive]}
                    onPress={() => setCreateForm({ ...createForm, department: d })}
                  >
                    <Text style={[styles.smallChipText, createForm.department === d && styles.smallChipTextActive]}>
                      {d}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Asset Notes / Specs</Text>
              <TextInput
                style={[styles.formInput, { height: 60 }]}
                placeholder="Supplier, invoice reference, warranty details..."
                multiline
                value={createForm.notes}
                onChangeText={(t) => setCreateForm({ ...createForm, notes: t })}
              />

              <TouchableOpacity
                style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
                onPress={handleCreateAsset}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitBtnText}>Register Asset</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Transfer Asset Modal */}
      <Modal
        visible={transferModal}
        animationType="slide"
        transparent
        onRequestClose={() => setTransferModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Reassign / Transfer Custody</Text>
                <Text style={styles.modalSub}>{selectedAsset?.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setTransferModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              <Text style={styles.inputLabel}>New Custodian (Staff Name) *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Name of teacher / staff member"
                value={transferForm.to_user_name}
                onChangeText={(t) => setTransferForm({ ...transferForm, to_user_name: t })}
              />

              <Text style={styles.inputLabel}>New Room / Physical Location *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Physics Lab, Staff Room 104"
                value={transferForm.to_location}
                onChangeText={(t) => setTransferForm({ ...transferForm, to_location: t })}
              />

              <Text style={styles.inputLabel}>Department</Text>
              <View style={styles.chipsRow}>
                {['ADMIN', 'ACADEMIC', 'IT', 'LAB', 'SPORTS', 'TRANSPORT'].map(d => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.smallChip, transferForm.to_department === d && styles.smallChipActive]}
                    onPress={() => setTransferForm({ ...transferForm, to_department: d })}
                  >
                    <Text style={[styles.smallChipText, transferForm.to_department === d && styles.smallChipTextActive]}>
                      {d}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Transfer Reason</Text>
              <TextInput
                style={[styles.formInput, { height: 60 }]}
                placeholder="Classroom relocation, new teacher assignment..."
                multiline
                value={transferForm.reason}
                onChangeText={(t) => setTransferForm({ ...transferForm, reason: t })}
              />

              <TouchableOpacity
                style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
                onPress={handleTransfer}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitBtnText}>Confirm Transfer</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Condition Inspection Modal */}
      <Modal
        visible={conditionModal}
        animationType="slide"
        transparent
        onRequestClose={() => setConditionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Condition Inspection</Text>
                <Text style={styles.modalSub}>{selectedAsset?.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setConditionModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              <Text style={styles.inputLabel}>Current Condition State</Text>
              <View style={styles.chipsRow}>
                {CONDITIONS.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.smallChip, condForm.condition === c && styles.smallChipActive]}
                    onPress={() => setCondForm({ ...condForm, condition: c })}
                  >
                    <Text style={[styles.smallChipText, condForm.condition === c && styles.smallChipTextActive]}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Inspection Notes</Text>
              <TextInput
                style={[styles.formInput, { height: 70 }]}
                placeholder="Physical inspection details, wear and tear, screen scratch..."
                multiline
                value={condForm.notes}
                onChangeText={(t) => setCondForm({ ...condForm, notes: t })}
              />

              <TouchableOpacity
                style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
                onPress={handleRecordCondition}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitBtnText}>Save Inspection Record</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Maintenance Record Modal */}
      <Modal
        visible={maintModal}
        animationType="slide"
        transparent
        onRequestClose={() => setMaintModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Log Maintenance / Service</Text>
                <Text style={styles.modalSub}>{selectedAsset?.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setMaintModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              <Text style={styles.inputLabel}>Service / Issue Title *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Lens replacement, Battery change, RAM upgrade"
                value={maintForm.title}
                onChangeText={(t) => setMaintForm({ ...maintForm, title: t })}
              />

              <View style={styles.twoCol}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={styles.inputLabel}>Repair Cost (₹)</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="0.00"
                    keyboardType="numeric"
                    value={maintForm.cost}
                    onChangeText={(t) => setMaintForm({ ...maintForm, cost: t })}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Text style={styles.inputLabel}>Service Vendor</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Repair Agency"
                    value={maintForm.vendor_name}
                    onChangeText={(t) => setMaintForm({ ...maintForm, vendor_name: t })}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Performed By / Technician</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Technician name or agency staff"
                value={maintForm.performed_by}
                onChangeText={(t) => setMaintForm({ ...maintForm, performed_by: t })}
              />

              <Text style={styles.inputLabel}>Work Description</Text>
              <TextInput
                style={[styles.formInput, { height: 70 }]}
                placeholder="Detailed breakdown of work performed, parts replaced..."
                multiline
                value={maintForm.description}
                onChangeText={(t) => setMaintForm({ ...maintForm, description: t })}
              />

              <TouchableOpacity
                style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
                onPress={handleRecordMaintenance}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitBtnText}>Log Service & Sync Expense</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Asset Audit History Modal */}
      <Modal
        visible={detailModal}
        animationType="slide"
        transparent
        onRequestClose={() => setDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {selectedAsset?.name || 'Asset Audit'}
                </Text>
                <Text style={styles.modalSub}>Tag: {selectedAsset?.asset_tag || '—'}</Text>
              </View>
              <TouchableOpacity onPress={() => setDetailModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            {loadingDetail ? (
              <View style={styles.centerBox}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Fetching audit logs...</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
                {/* Tabs */}
                <View style={styles.ledgerTabs}>
                  {['CUSTODY', 'CONDITION', 'MAINTENANCE'].map(t => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.ledgerTabBtn, detailTab === t && styles.ledgerTabBtnActive]}
                      onPress={() => setDetailTab(t)}
                    >
                      <Text style={[styles.ledgerTabTxt, detailTab === t && styles.ledgerTabTxtActive]}>
                        {t === 'CUSTODY' ? 'Custody History' : t === 'CONDITION' ? 'Inspections' : 'Repairs'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {detailTab === 'CUSTODY' && (
                  <View>
                    {(assetDetail?.assignments && assetDetail.assignments.length > 0) ? (
                      assetDetail.assignments.map((a, i) => (
                        <View key={a.id || i} style={styles.historyCard}>
                          <View style={styles.historyHeader}>
                            <Text style={styles.historyRef}>Custodian: {a.to_user_name || 'Unassigned'}</Text>
                            <Text style={styles.statusText}>{a.to_department || '—'}</Text>
                          </View>
                          <Text style={styles.historyDate}>Location: {a.to_location || '—'}</Text>
                          <Text style={styles.historyDate}>Date: {a.transfer_date || '—'}</Text>
                          {a.reason ? <Text style={styles.historyNotes}>Reason: {a.reason}</Text> : null}
                        </View>
                      ))
                    ) : (
                      <Text style={styles.emptyNotice}>No custody transfer logs found.</Text>
                    )}
                  </View>
                )}

                {detailTab === 'CONDITION' && (
                  <View>
                    {(assetDetail?.condition_logs && assetDetail.condition_logs.length > 0) ? (
                      assetDetail.condition_logs.map((c, i) => (
                        <View key={c.id || i} style={styles.historyCard}>
                          <View style={styles.historyHeader}>
                            <Text style={[styles.historyRef, { color: c.condition === 'DAMAGED' ? '#dc2626' : '#16a34a' }]}>
                              {c.condition}
                            </Text>
                            <Text style={styles.historyDate}>{c.inspected_date || '—'}</Text>
                          </View>
                          {c.notes ? <Text style={styles.historyNotes}>{c.notes}</Text> : null}
                        </View>
                      ))
                    ) : (
                      <Text style={styles.emptyNotice}>No condition logs found.</Text>
                    )}
                  </View>
                )}

                {detailTab === 'MAINTENANCE' && (
                  <View>
                    {(assetDetail?.maintenance_records && assetDetail.maintenance_records.length > 0) ? (
                      assetDetail.maintenance_records.map((m, i) => (
                        <View key={m.id || i} style={styles.historyCard}>
                          <View style={styles.historyHeader}>
                            <Text style={styles.historyRef}>{m.title}</Text>
                            <Text style={[styles.historyRef, { color: '#0284c7' }]}>{fmt(m.cost)}</Text>
                          </View>
                          <Text style={styles.historyDate}>Date: {m.maintenance_date || '—'}</Text>
                          {m.vendor_name ? <Text style={styles.historyDate}>Vendor: {m.vendor_name}</Text> : null}
                          {m.description ? <Text style={styles.historyNotes}>{m.description}</Text> : null}
                        </View>
                      ))
                    ) : (
                      <Text style={styles.emptyNotice}>No repair/maintenance records recorded.</Text>
                    )}
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  headerSub: {
    fontSize: 12,
    color: '#cbd5e1',
    marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  addBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  kpiContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  kpiVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  kpiLbl: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 13,
    color: '#0f172a',
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
  },
  statusChipActive: {
    backgroundColor: '#0f172a',
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  statusChipTextActive: {
    color: '#ffffff',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748b',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginTop: 10,
  },
  emptySub: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
  },
  assetCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  assetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  assetName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  catBadge: {
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  catBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  costText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  detailText: {
    fontSize: 12,
    color: '#475569',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    flexWrap: 'wrap',
  },
  metaItem: {
    fontSize: 12,
    color: '#64748b',
  },
  metaCondition: {
    fontSize: 12,
    fontWeight: '700',
  },
  metaDivider: {
    fontSize: 12,
    color: '#cbd5e1',
    marginHorizontal: 6,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 10,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  actionBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  actionBtnOutlineText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  actionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  actionBtnPrimaryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 16,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  formInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0f172a',
    marginBottom: 10,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  smallChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  smallChipActive: {
    backgroundColor: colors.primary,
  },
  smallChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  smallChipTextActive: {
    color: '#ffffff',
  },
  twoCol: {
    flexDirection: 'row',
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  ledgerTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  ledgerTabBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  ledgerTabBtnActive: {
    backgroundColor: colors.primary,
  },
  ledgerTabTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  ledgerTabTxtActive: {
    color: '#ffffff',
  },
  historyCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  historyRef: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  historyDate: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  historyNotes: {
    fontSize: 11,
    color: '#475569',
    marginTop: 4,
  },
  emptyNotice: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 20,
  },
});
