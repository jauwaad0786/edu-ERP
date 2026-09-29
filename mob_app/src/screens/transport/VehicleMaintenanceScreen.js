// mob_app/src/screens/transport/VehicleMaintenanceScreen.js
// Transport Fleet Maintenance & Service Log — 100% mirrors Web ERP VehicleMaintenance.jsx
// Handles bus breakdown reports, scheduled servicing, repair progress, cost tracking, and garage updates.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';

const STATUS_COLORS = {
  REPORTED:    { bg: '#fee2e2', text: '#dc2626', icon: 'alert-circle' },
  IN_PROGRESS: { bg: '#fef3c7', text: '#d97706', icon: 'construct' },
  COMPLETED:   { bg: '#dcfce7', text: '#16a34a', icon: 'checkmark-circle' },
};

const EMPTY_FORM = {
  vehicle_id: '',
  problem: '',
  reported_date: new Date().toISOString().slice(0, 10),
  expected_completion: '',
  cost: '',
  remarks: '',
};

export default function VehicleMaintenanceScreen({ navigation }) {
  const [records, setRecords] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Add Ticket Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Update Status Modal
  const [editRecord, setEditRecord] = useState(null);
  const [updateStatus, setUpdateStatus] = useState('IN_PROGRESS');
  const [updateCost, setUpdateCost] = useState('');
  const [updateRemarks, setUpdateRemarks] = useState('');
  const [updating, setUpdating] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (vehicleFilter) params.vehicle_id = vehicleFilter;
      if (statusFilter) params.status = statusFilter;

      const [recordsRes, vehiclesRes] = await Promise.all([
        client.get('/transport/maintenance', { params }).catch(() => ({ data: { data: [] } })),
        client.get('/transport/vehicles?per_page=100').catch(() => ({ data: { data: [] } })),
      ]);

      setRecords(recordsRes.data?.data || []);
      setVehicles(vehiclesRes.data?.data || []);
    } catch (err) {
      console.error('[VehicleMaintenanceScreen] Load failed:', err);
      Alert.alert('Error', 'Failed to load maintenance records.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [vehicleFilter, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Open Add
  const openAdd = () => {
    setForm({
      ...EMPTY_FORM,
      vehicle_id: vehicles[0]?.id ? String(vehicles[0].id) : '',
    });
    setShowAddModal(true);
  };

  // Save Add
  const handleSaveAdd = async () => {
    if (!form.vehicle_id || !form.problem.trim()) {
      Alert.alert('Required Fields', 'Please select a vehicle and describe the issue.');
      return;
    }

    setSaving(true);
    try {
      await client.post('/transport/maintenance', {
        vehicle_id: Number(form.vehicle_id),
        problem: form.problem.trim(),
        reported_date: form.reported_date,
        expected_completion: form.expected_completion.trim() || undefined,
        cost: form.cost ? Number(form.cost) : 0,
        remarks: form.remarks.trim() || undefined,
      });

      Alert.alert('Reported', 'Vehicle maintenance job logged.');
      setShowAddModal(false);
      loadData();
    } catch (err) {
      Alert.alert('Failed', err.response?.data?.error || 'Failed to submit maintenance report.');
    } finally {
      setSaving(false);
    }
  };

  // Open Update Modal
  const openUpdate = (rec) => {
    setEditRecord(rec);
    setUpdateStatus(rec.status === 'REPORTED' ? 'IN_PROGRESS' : rec.status === 'IN_PROGRESS' ? 'COMPLETED' : rec.status);
    setUpdateCost(rec.cost ? String(rec.cost) : '');
    setUpdateRemarks(rec.remarks || '');
  };

  // Save Update
  const handleSaveUpdate = async () => {
    setUpdating(true);
    try {
      await client.put(`/transport/maintenance/${editRecord.id}`, {
        status: updateStatus,
        cost: updateCost ? Number(updateCost) : editRecord.cost,
        remarks: updateRemarks.trim() || undefined,
      });

      Alert.alert('Updated', 'Maintenance record updated successfully.');
      setEditRecord(null);
      loadData();
    } catch (err) {
      Alert.alert('Update Failed', err.response?.data?.error || 'Failed to update job.');
    } finally {
      setUpdating(false);
    }
  };

  // Calculate totals
  const totalCost = records.reduce((acc, r) => acc + Number(r.cost || 0), 0);
  const reportedCount = records.filter(r => r.status === 'REPORTED').length;
  const inProgressCount = records.filter(r => r.status === 'IN_PROGRESS').length;
  const completedCount = records.filter(r => r.status === 'COMPLETED').length;

  const renderMaintenanceCard = ({ item }) => {
    const sc = STATUS_COLORS[item.status] || STATUS_COLORS.REPORTED;

    return (
      <View style={styles.card}>
        {/* Top Info */}
        <View style={styles.cardTop}>
          <View style={styles.busBadge}>
            <Ionicons name="bus" size={16} color="#0b57d0" />
            <Text style={styles.busBadgeText}>{item.vehicle_number || `Bus #${item.vehicle_id}`}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
            <Ionicons name={sc.icon} size={13} color={sc.text} style={{ marginRight: 4 }} />
            <Text style={[styles.statusBadgeText, { color: sc.text }]}>{item.status}</Text>
          </View>
        </View>

        {/* Problem Description */}
        <Text style={styles.problemText}>{item.problem}</Text>

        {/* Dates & Cost Grid */}
        <View style={styles.metaGrid}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Reported Date</Text>
            <Text style={styles.metaVal}>{item.reported_date ? String(item.reported_date).slice(0, 10) : 'N/A'}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Target Done</Text>
            <Text style={styles.metaVal}>{item.expected_completion ? String(item.expected_completion).slice(0, 10) : 'Immediate'}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Service Cost</Text>
            <Text style={styles.costVal}>₹{Number(item.cost || 0).toLocaleString('en-IN')}</Text>
          </View>
        </View>

        {item.remarks ? (
          <Text style={styles.remarksText}>Garage Note: {item.remarks}</Text>
        ) : null}

        {/* Actions Footer */}
        <View style={styles.cardFooter}>
          <Text style={styles.jobIdText}>Job #{item.id}</Text>
          <TouchableOpacity
            style={styles.updateBtn}
            onPress={() => openUpdate(item)}
            activeOpacity={0.75}
          >
            <Ionicons name="create-outline" size={15} color="#0b57d0" />
            <Text style={styles.updateBtnText}>Update Status</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.headerTitle}>Vehicle Maintenance</Text>
          <Text style={styles.headerSubtitle}>{records.length} Service jobs logged</Text>
        </View>
        <TouchableOpacity onPress={openAdd} style={styles.addBtn} activeOpacity={0.85}>
          <Ionicons name="add" size={18} color="#ffffff" />
          <Text style={styles.addBtnText}>Report Issue</Text>
        </TouchableOpacity>
      </View>

      {/* Transport Quick Service Navigation Ribbon */}
      <View style={styles.serviceNavStrip}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 12 }}>
          <TouchableOpacity style={styles.serviceNavTab} onPress={() => navigation.navigate('LiveTracking')}>
            <Ionicons name="navigate" size={14} color="#64748b" />
            <Text style={styles.serviceNavText}>Live GPS</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.serviceNavTab} onPress={() => navigation.navigate('Vehicles')}>
            <Ionicons name="bus" size={14} color="#64748b" />
            <Text style={styles.serviceNavText}>Vehicles</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.serviceNavTab} onPress={() => navigation.navigate('Routes')}>
            <Ionicons name="map" size={14} color="#64748b" />
            <Text style={styles.serviceNavText}>Routes & Stops</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.serviceNavTab} onPress={() => navigation.navigate('Drivers')}>
            <Ionicons name="person" size={14} color="#64748b" />
            <Text style={styles.serviceNavText}>Drivers</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.serviceNavTab} onPress={() => navigation.navigate('Conductors')}>
            <Ionicons name="people" size={14} color="#64748b" />
            <Text style={styles.serviceNavText}>Conductors</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.serviceNavTab} onPress={() => navigation.navigate('StudentTransport')}>
            <Ionicons name="person-add" size={14} color="#64748b" />
            <Text style={styles.serviceNavText}>Student Roster</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.serviceNavTab, styles.serviceNavTabActive]} onPress={() => {}}>
            <Ionicons name="construct" size={14} color="#7c3aed" />
            <Text style={[styles.serviceNavText, styles.serviceNavTextActive]}>Maintenance</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* KPI Overview Cards */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Total Cost</Text>
          <Text style={[styles.kpiVal, { color: '#0b57d0' }]}>₹{totalCost.toLocaleString('en-IN')}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>In Progress</Text>
          <Text style={[styles.kpiVal, { color: '#d97706' }]}>{inProgressCount}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Reported</Text>
          <Text style={[styles.kpiVal, { color: '#dc2626' }]}>{reportedCount}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Completed</Text>
          <Text style={[styles.kpiVal, { color: '#16a34a' }]}>{completedCount}</Text>
        </View>
      </View>

      {/* Status Filter Horizontal Tabs */}
      <View style={styles.filterScroll}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          <TouchableOpacity
            style={[styles.filterChip, !statusFilter && styles.filterChipActive]}
            onPress={() => setStatusFilter('')}
          >
            <Text style={[styles.filterChipText, !statusFilter && styles.filterChipTextActive]}>All Jobs</Text>
          </TouchableOpacity>
          {['REPORTED', 'IN_PROGRESS', 'COMPLETED'].map(st => (
            <TouchableOpacity
              key={st}
              style={[styles.filterChip, statusFilter === st && styles.filterChipActive]}
              onPress={() => setStatusFilter(st)}
            >
              <Text style={[styles.filterChipText, statusFilter === st && styles.filterChipTextActive]}>{st}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Record List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0b57d0" />
          <Text style={styles.loadingText}>Loading maintenance log...</Text>
        </View>
      ) : records.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="construct-outline" size={64} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>No Maintenance Records</Text>
          <Text style={styles.emptySubtitle}>All fleet vehicles are in operational condition.</Text>
        </View>
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderMaintenanceCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      )}

      {/* Report Maintenance Issue Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report Vehicle Problem</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color="#0f172a" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Select Vehicle */}
              <Text style={styles.fieldLabel}>Select Vehicle (Bus) *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsRow}>
                {vehicles.map(v => {
                  const isSel = String(v.id) === String(form.vehicle_id);
                  return (
                    <TouchableOpacity
                      key={v.id}
                      style={[styles.vehPill, isSel && styles.vehPillActive]}
                      onPress={() => setForm(f => ({ ...f, vehicle_id: String(v.id) }))}
                    >
                      <Ionicons name="bus" size={14} color={isSel ? '#ffffff' : '#0b57d0'} />
                      <Text style={[styles.vehPillText, isSel && styles.vehPillTextActive]}>
                        {v.vehicle_number || v.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Problem Description */}
              <Text style={styles.fieldLabel}>Problem / Defect Description *</Text>
              <TextInput
                style={[styles.textInput, { height: 72 }]}
                placeholder="e.g. Brake pad wear, Engine oil replacement, AC cooling low"
                placeholderTextColor="#94a3b8"
                multiline
                value={form.problem}
                onChangeText={(v) => setForm(f => ({ ...f, problem: v }))}
              />

              {/* Expected Completion Date */}
              <Text style={styles.fieldLabel}>Target Completion Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="2026-10-05"
                placeholderTextColor="#94a3b8"
                value={form.expected_completion}
                onChangeText={(v) => setForm(f => ({ ...f, expected_completion: v }))}
              />

              {/* Estimated Cost */}
              <Text style={styles.fieldLabel}>Estimated Cost (₹)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. 4500"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={form.cost}
                onChangeText={(v) => setForm(f => ({ ...f, cost: v }))}
              />

              {/* Garage Remarks */}
              <Text style={styles.fieldLabel}>Workshop / Garage Name & Remarks</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Authorized Tata Motors service center"
                placeholderTextColor="#94a3b8"
                value={form.remarks}
                onChangeText={(v) => setForm(f => ({ ...f, remarks: v }))}
              />

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleSaveAdd}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitBtnText}>Submit Maintenance Ticket</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Update Job Status Modal */}
      <Modal visible={!!editRecord} animationType="slide" transparent onRequestClose={() => setEditRecord(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Job #{editRecord?.id}</Text>
              <TouchableOpacity onPress={() => setEditRecord(null)}>
                <Ionicons name="close" size={24} color="#0f172a" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Job Status *</Text>
              <View style={styles.statusSelectRow}>
                {['REPORTED', 'IN_PROGRESS', 'COMPLETED'].map(st => {
                  const isSel = updateStatus === st;
                  const sc = STATUS_COLORS[st];
                  return (
                    <TouchableOpacity
                      key={st}
                      style={[styles.statusOptBtn, isSel && { backgroundColor: sc.bg, borderColor: sc.text }]}
                      onPress={() => setUpdateStatus(st)}
                    >
                      <Text style={[styles.statusOptText, isSel && { color: sc.text, fontWeight: '800' }]}>{st}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>Final Actual Cost (₹)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Final bill amount"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={updateCost}
                onChangeText={setUpdateCost}
              />

              <Text style={styles.fieldLabel}>Completion Remarks / Invoice Ref</Text>
              <TextInput
                style={[styles.textInput, { height: 60 }]}
                placeholder="e.g. Work verified by Transport Incharge, Bill #981"
                placeholderTextColor="#94a3b8"
                multiline
                value={updateRemarks}
                onChangeText={setUpdateRemarks}
              />

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleSaveUpdate}
                disabled={updating}
                activeOpacity={0.85}
              >
                {updating ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitBtnText}>Save Status Update</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
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
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc2626',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 4,
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '700',
  },
  kpiRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  kpiVal: {
    fontSize: 14.5,
    fontWeight: '900',
    marginTop: 2,
  },
  filterScroll: {
    backgroundColor: '#ffffff',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  filterChipActive: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  filterChipText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#2563eb',
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748b',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  busBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 6,
  },
  busBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0b57d0',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  problemText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 10,
    lineHeight: 20,
  },
  metaGrid: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 10.5,
    color: '#94a3b8',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  metaVal: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#334155',
    marginTop: 2,
  },
  costVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#16a34a',
    marginTop: 2,
  },
  remarksText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 8,
    fontStyle: 'italic',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  jobIdText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
  },
  updateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
  },
  updateBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0b57d0',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalBody: {
    paddingTop: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginTop: 12,
    marginBottom: 6,
  },
  pillsRow: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  vehPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 8,
    gap: 4,
  },
  vehPillActive: {
    backgroundColor: '#0b57d0',
  },
  vehPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  vehPillTextActive: {
    color: '#ffffff',
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  statusSelectRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 4,
  },
  statusOptBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  statusOptText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748b',
  },
  submitBtn: {
    backgroundColor: '#0b57d0',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 30,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  serviceNavStrip: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 8,
  },
  serviceNavTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  serviceNavTabActive: {
    backgroundColor: '#f5f3ff',
    borderColor: '#ddd6fe',
  },
  serviceNavText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  serviceNavTextActive: {
    color: '#7c3aed',
    fontWeight: '700',
  },
});
