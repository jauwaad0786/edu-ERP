// mob_app/src/screens/transport/DriversScreen.js
// Transport Drivers Management — 100% mirrors Web ERP Drivers.jsx
// Handles driver directory, license verification, vehicle assignment, and credentials generation.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ActivityIndicator, Alert, Linking, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';

const EMPTY_FORM = {
  name: '',
  mobile_number: '',
  email: '',
  password: '12345',
  address: '',
  experience_years: '',
  has_license: true,
  license_number: '',
  license_expiry: '',
  emergency_contact: '',
  remarks: '',
  assign_vehicle_id: '',
};

export default function DriversScreen({ navigation }) {
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Form modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // New Driver Credentials modal
  const [createdCredentials, setCreatedCredentials] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;

      const [driversRes, vehiclesRes] = await Promise.all([
        client.get('/transport/drivers', { params }),
        client.get('/transport/vehicles?per_page=200').catch(() => ({ data: { data: [] } })),
      ]);

      setDrivers(driversRes.data?.data || []);
      setVehicles(vehiclesRes.data?.data || []);
    } catch (err) {
      console.error('[DriversScreen] Load failed:', err);
      Alert.alert('Error', 'Failed to load drivers list from server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setShowModal(true);
  };

  const openEdit = (d) => {
    setEditingId(d.id);
    setForm({
      name: d.name || '',
      mobile_number: d.mobile_number || '',
      email: d.email || '',
      password: '',
      address: d.address || '',
      experience_years: d.experience_years ? String(d.experience_years) : '',
      has_license: d.has_license ?? true,
      license_number: d.license_number || '',
      license_expiry: d.license_expiry || '',
      emergency_contact: d.emergency_contact || '',
      remarks: d.remarks || '',
      assign_vehicle_id: d.assigned_vehicle_id ? String(d.assigned_vehicle_id) : '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.mobile_number.trim()) {
      Alert.alert('Required Fields', 'Driver name and mobile phone are required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        mobile_number: form.mobile_number.trim(),
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        experience_years: form.experience_years ? Number(form.experience_years) : undefined,
        has_license: form.has_license,
        license_number: form.license_number.trim() || undefined,
        license_expiry: form.license_expiry.trim() || undefined,
        emergency_contact: form.emergency_contact.trim() || undefined,
        remarks: form.remarks.trim() || undefined,
        assigned_vehicle_id: form.assign_vehicle_id ? Number(form.assign_vehicle_id) : null,
      };

      if (!editingId && form.password.trim()) {
        payload.password = form.password.trim();
      }

      if (editingId) {
        await client.put(`/transport/drivers/${editingId}`, payload);
        Alert.alert('Success', 'Driver profile updated successfully.');
        setShowModal(false);
      } else {
        const res = await client.post('/transport/drivers', payload);
        setShowModal(false);
        if (res.data?.credentials) {
          setCreatedCredentials(res.data.credentials);
        } else {
          Alert.alert('Success', 'New driver registered successfully.');
        }
      }
      loadData();
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Failed to save driver.';
      Alert.alert('Save Failed', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (driver) => {
    Alert.alert(
      'Delete Driver',
      `Are you sure you want to remove driver ${driver.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await client.delete(`/transport/drivers/${driver.id}`);
              Alert.alert('Removed', 'Driver removed successfully.');
              loadData();
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error || 'Failed to delete driver.');
            }
          },
        },
      ]
    );
  };

  const callDriver = (phone) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`);
  };

  const messageDriver = (phone) => {
    if (!phone) return;
    const clean = phone.replace(/[^0-9]/g, '');
    Linking.openURL(`https://wa.me/91${clean}`);
  };

  const renderDriverCard = ({ item }) => {
    const isExpired = item.license_expiry && new Date(item.license_expiry) < new Date();
    const isAssigned = !!item.assigned_vehicle_number;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.avatarCircle}>
            <Ionicons name="steering-wheel" size={24} color="#0b57d0" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={styles.rowBetween}>
              <Text style={styles.driverName}>{item.name}</Text>
              <View style={[styles.statusBadge, { backgroundColor: item.is_active !== false ? '#dcfce7' : '#fee2e2' }]}>
                <Text style={[styles.statusBadgeText, { color: item.is_active !== false ? '#16a34a' : '#dc2626' }]}>
                  {item.is_active !== false ? 'ACTIVE' : 'INACTIVE'}
                </Text>
              </View>
            </View>
            <Text style={styles.driverPhone}>{item.mobile_number}</Text>
          </View>
        </View>

        {/* Info Grid */}
        <View style={styles.infoGrid}>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Assigned Bus</Text>
            <View style={styles.busPill}>
              <Ionicons name="bus-outline" size={14} color={isAssigned ? '#2563eb' : '#64748b'} />
              <Text style={[styles.busText, { color: isAssigned ? '#2563eb' : '#64748b' }]}>
                {item.assigned_vehicle_number || 'No Bus Assigned'}
              </Text>
            </View>
          </View>

          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>License No</Text>
            <Text style={styles.infoVal}>{item.license_number || 'N/A'}</Text>
            {item.license_expiry ? (
              <Text style={[styles.expiryText, { color: isExpired ? '#dc2626' : '#16a34a' }]}>
                Exp: {item.license_expiry} {isExpired ? '(EXPIRED)' : ''}
              </Text>
            ) : null}
          </View>
        </View>

        {item.experience_years ? (
          <Text style={styles.expText}>
            Experience: <Text style={{ fontWeight: '700', color: colors.text }}>{item.experience_years} Years</Text>
          </Text>
        ) : null}

        {/* Card Actions Footer */}
        <View style={styles.cardFooter}>
          <View style={styles.commActions}>
            <TouchableOpacity
              style={styles.commBtn}
              onPress={() => callDriver(item.mobile_number)}
              activeOpacity={0.7}
            >
              <Ionicons name="call" size={16} color="#2563eb" />
              <Text style={styles.commBtnText}>Call</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.commBtn, { backgroundColor: '#ecfdf5' }]}
              onPress={() => messageDriver(item.mobile_number)}
              activeOpacity={0.7}
            >
              <Ionicons name="logo-whatsapp" size={16} color="#16a34a" />
              <Text style={[styles.commBtnText, { color: '#16a34a' }]}>WhatsApp</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.mgmtActions}>
            <TouchableOpacity onPress={() => openEdit(item)} style={styles.iconActionBtn} activeOpacity={0.7}>
              <Ionicons name="create-outline" size={18} color="#0b57d0" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(item)} style={styles.iconActionBtn} activeOpacity={0.7}>
              <Ionicons name="trash-outline" size={18} color="#dc2626" />
            </TouchableOpacity>
          </View>
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
          <Text style={styles.headerTitle}>Transport Drivers</Text>
          <Text style={styles.headerSubtitle}>{drivers.length} Drivers registered</Text>
        </View>
        <TouchableOpacity onPress={openAdd} style={styles.addBtn} activeOpacity={0.85}>
          <Ionicons name="add" size={20} color="#ffffff" />
          <Text style={styles.addBtnText}>Add Driver</Text>
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
          <TouchableOpacity style={[styles.serviceNavTab, styles.serviceNavTabActive]} onPress={() => {}}>
            <Ionicons name="person" size={14} color="#ea580c" />
            <Text style={[styles.serviceNavText, styles.serviceNavTextActive]}>Drivers</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.serviceNavTab} onPress={() => navigation.navigate('Conductors')}>
            <Ionicons name="people" size={14} color="#64748b" />
            <Text style={styles.serviceNavText}>Conductors</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.serviceNavTab} onPress={() => navigation.navigate('StudentTransport')}>
            <Ionicons name="person-add" size={14} color="#64748b" />
            <Text style={styles.serviceNavText}>Student Roster</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.serviceNavTab} onPress={() => navigation.navigate('VehicleMaintenance')}>
            <Ionicons name="construct" size={14} color="#64748b" />
            <Text style={styles.serviceNavText}>Maintenance</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Search & Filter Bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search driver by name, phone, license..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#94a3b8" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Status Filter Toggle */}
        <TouchableOpacity
          style={[styles.filterChip, statusFilter === 'ACTIVE' && styles.filterChipActive]}
          onPress={() => setStatusFilter(f => f === 'ACTIVE' ? '' : 'ACTIVE')}
          activeOpacity={0.7}
        >
          <Text style={[styles.filterChipText, statusFilter === 'ACTIVE' && styles.filterChipTextActive]}>
            Active Only
          </Text>
        </TouchableOpacity>
      </View>

      {/* Driver List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0b57d0" />
          <Text style={styles.loadingText}>Loading driver directory...</Text>
        </View>
      ) : drivers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="steering-wheel-outline" size={64} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>No Drivers Found</Text>
          <Text style={styles.emptySubtitle}>Tap 'Add Driver' above to register commercial drivers.</Text>
        </View>
      ) : (
        <FlatList
          data={drivers}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderDriverCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      )}

      {/* Add / Edit Driver Modal */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingId ? 'Edit Driver' : 'Register New Driver'}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color="#0f172a" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Name */}
              <Text style={styles.fieldLabel}>Full Name *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Ramesh Kumar"
                placeholderTextColor="#94a3b8"
                value={form.name}
                onChangeText={(v) => setForm(f => ({ ...f, name: v }))}
              />

              {/* Mobile Phone */}
              <Text style={styles.fieldLabel}>Mobile Phone *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="10-digit mobile number"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
                value={form.mobile_number}
                onChangeText={(v) => setForm(f => ({ ...f, mobile_number: v }))}
              />

              {/* Email */}
              <Text style={styles.fieldLabel}>Email Address (Optional)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="driver@school.com"
                placeholderTextColor="#94a3b8"
                keyboardType="email-address"
                autoCapitalize="none"
                value={form.email}
                onChangeText={(v) => setForm(f => ({ ...f, email: v }))}
              />

              {/* License Details */}
              <Text style={styles.fieldLabel}>Commercial License Number</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. DL-0420110012345"
                placeholderTextColor="#94a3b8"
                autoCapitalize="characters"
                value={form.license_number}
                onChangeText={(v) => setForm(f => ({ ...f, license_number: v }))}
              />

              <Text style={styles.fieldLabel}>License Expiry Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="2028-12-31"
                placeholderTextColor="#94a3b8"
                value={form.license_expiry}
                onChangeText={(v) => setForm(f => ({ ...f, license_expiry: v }))}
              />

              {/* Experience */}
              <Text style={styles.fieldLabel}>Experience (Years)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. 5"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={form.experience_years}
                onChangeText={(v) => setForm(f => ({ ...f, experience_years: v }))}
              />

              {/* Assign Vehicle Dropdown */}
              <Text style={styles.fieldLabel}>Assign Vehicle (Bus)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.vehiclePillsRow}>
                <TouchableOpacity
                  style={[styles.vehPill, !form.assign_vehicle_id && styles.vehPillActive]}
                  onPress={() => setForm(f => ({ ...f, assign_vehicle_id: '' }))}
                >
                  <Text style={[styles.vehPillText, !form.assign_vehicle_id && styles.vehPillTextActive]}>
                    None
                  </Text>
                </TouchableOpacity>
                {vehicles.map(v => {
                  const isSel = String(v.id) === String(form.assign_vehicle_id);
                  return (
                    <TouchableOpacity
                      key={v.id}
                      style={[styles.vehPill, isSel && styles.vehPillActive]}
                      onPress={() => setForm(f => ({ ...f, assign_vehicle_id: String(v.id) }))}
                    >
                      <Ionicons name="bus" size={14} color={isSel ? '#ffffff' : '#2563eb'} />
                      <Text style={[styles.vehPillText, isSel && styles.vehPillTextActive]}>
                        {v.vehicle_number || v.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Emergency Contact */}
              <Text style={styles.fieldLabel}>Emergency Contact Number</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Family / Guardian contact"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
                value={form.emergency_contact}
                onChangeText={(v) => setForm(f => ({ ...f, emergency_contact: v }))}
              />

              {/* Remarks */}
              <Text style={styles.fieldLabel}>Remarks / Blood Group / Notes</Text>
              <TextInput
                style={[styles.textInput, { height: 68 }]}
                placeholder="e.g. Blood Group O+, verified police record"
                placeholderTextColor="#94a3b8"
                multiline
                value={form.remarks}
                onChangeText={(v) => setForm(f => ({ ...f, remarks: v }))}
              />

              {/* Save Button */}
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitBtnText}>{editingId ? 'Save Changes' : 'Enroll Driver'}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Credentials Created Modal */}
      <Modal visible={!!createdCredentials} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: 380, padding: 24, alignItems: 'center' }]}>
            <View style={styles.credCheckCircle}>
              <Ionicons name="checkmark" size={32} color="#ffffff" />
            </View>
            <Text style={styles.credTitle}>Driver Account Provisioned!</Text>
            <Text style={styles.credSub}>The driver can now log in to the Driver Mobile Console.</Text>

            <View style={styles.credBox}>
              <View style={styles.credRow}>
                <Text style={styles.credKey}>Username:</Text>
                <Text style={styles.credVal}>{createdCredentials?.username || createdCredentials?.email}</Text>
              </View>
              <View style={styles.credRow}>
                <Text style={styles.credKey}>Password:</Text>
                <Text style={styles.credVal}>{createdCredentials?.password || '12345'}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={() => setCreatedCredentials(null)}
              activeOpacity={0.85}
            >
              <Text style={styles.submitBtnText}>Done</Text>
            </TouchableOpacity>
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
    backgroundColor: '#0b57d0',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    gap: 4,
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 10,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterChipActive: {
    backgroundColor: '#eff6ff',
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  driverName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  driverPhone: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  statusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  infoGrid: {
    flexDirection: 'row',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 16,
  },
  infoCol: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  busPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  busText: {
    fontSize: 13,
    fontWeight: '700',
  },
  infoVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 4,
  },
  expiryText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  expText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  commActions: {
    flexDirection: 'row',
    gap: 8,
  },
  commBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  commBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
  },
  mgmtActions: {
    flexDirection: 'row',
    gap: 6,
  },
  iconActionBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
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
  vehiclePillsRow: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  vehPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 8,
    gap: 4,
  },
  vehPillActive: {
    backgroundColor: '#2563eb',
  },
  vehPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  vehPillTextActive: {
    color: '#ffffff',
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
  credCheckCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  credTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  credSub: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  credBox: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  credRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  credKey: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  credVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
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
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
  },
  serviceNavText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  serviceNavTextActive: {
    color: '#ea580c',
    fontWeight: '700',
  },
});
