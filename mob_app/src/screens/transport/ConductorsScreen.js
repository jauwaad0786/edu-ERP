// mob_app/src/screens/transport/ConductorsScreen.js
// Transport Conductors Management — 100% mirrors Web ERP Conductors.jsx

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
  address: '',
  experience_years: '',
  emergency_contact: '',
  remarks: '',
};

export default function ConductorsScreen({ navigation }) {
  const [conductors, setConductors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  // Form modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (search.trim()) params.search = search.trim();

      const res = await client.get('/transport/conductors', { params });
      setConductors(res.data?.data || []);
    } catch (err) {
      console.error('[ConductorsScreen] Load failed:', err);
      Alert.alert('Error', 'Failed to load conductors list.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search]);

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

  const openEdit = (c) => {
    setEditingId(c.id);
    setForm({
      name: c.name || '',
      mobile_number: c.mobile_number || '',
      address: c.address || '',
      experience_years: c.experience_years ? String(c.experience_years) : '',
      emergency_contact: c.emergency_contact || '',
      remarks: c.remarks || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.mobile_number.trim()) {
      Alert.alert('Required Fields', 'Conductor name and mobile phone are required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        mobile_number: form.mobile_number.trim(),
        address: form.address.trim() || undefined,
        experience_years: form.experience_years ? Number(form.experience_years) : undefined,
        emergency_contact: form.emergency_contact.trim() || undefined,
        remarks: form.remarks.trim() || undefined,
      };

      if (editingId) {
        await client.put(`/transport/conductors/${editingId}`, payload);
        Alert.alert('Success', 'Conductor updated successfully.');
      } else {
        await client.post('/transport/conductors', payload);
        Alert.alert('Success', 'New conductor enrolled successfully.');
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Failed to save conductor.';
      Alert.alert('Save Failed', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (conductor) => {
    Alert.alert(
      'Remove Conductor',
      `Are you sure you want to remove conductor ${conductor.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await client.delete(`/transport/conductors/${conductor.id}`);
              Alert.alert('Removed', 'Conductor removed.');
              loadData();
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error || 'Failed to delete conductor.');
            }
          },
        },
      ]
    );
  };

  const callConductor = (phone) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`);
  };

  const messageConductor = (phone) => {
    if (!phone) return;
    const clean = phone.replace(/[^0-9]/g, '');
    Linking.openURL(`https://wa.me/91${clean}`);
  };

  const renderConductorCard = ({ item }) => {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.avatarCircle}>
            <Ionicons name="person-circle" size={26} color="#059669" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.conductorName}>{item.name}</Text>
            <Text style={styles.conductorPhone}>{item.mobile_number}</Text>
          </View>
          <View style={styles.activePill}>
            <Text style={styles.activePillText}>ACTIVE</Text>
          </View>
        </View>

        {item.experience_years ? (
          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={14} color="#64748b" />
            <Text style={styles.detailText}>
              Experience: <Text style={{ fontWeight: '700', color: colors.text }}>{item.experience_years} Years</Text>
            </Text>
          </View>
        ) : null}

        {item.emergency_contact ? (
          <View style={styles.detailRow}>
            <Ionicons name="alert-circle-outline" size={14} color="#ea580c" />
            <Text style={styles.detailText}>
              Emergency: <Text style={{ fontWeight: '700', color: '#ea580c' }}>{item.emergency_contact}</Text>
            </Text>
          </View>
        ) : null}

        {item.remarks ? (
          <Text style={styles.remarksText}>
            Note: {item.remarks}
          </Text>
        ) : null}

        {/* Card Footer */}
        <View style={styles.cardFooter}>
          <View style={styles.commActions}>
            <TouchableOpacity
              style={styles.commBtn}
              onPress={() => callConductor(item.mobile_number)}
              activeOpacity={0.7}
            >
              <Ionicons name="call" size={15} color="#2563eb" />
              <Text style={styles.commBtnText}>Call</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.commBtn, { backgroundColor: '#ecfdf5' }]}
              onPress={() => messageConductor(item.mobile_number)}
              activeOpacity={0.7}
            >
              <Ionicons name="logo-whatsapp" size={15} color="#16a34a" />
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
          <Text style={styles.headerTitle}>Transport Conductors</Text>
          <Text style={styles.headerSubtitle}>{conductors.length} Conductors on staff</Text>
        </View>
        <TouchableOpacity onPress={openAdd} style={styles.addBtn} activeOpacity={0.85}>
          <Ionicons name="add" size={20} color="#ffffff" />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search conductor by name or phone..."
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
      </View>

      {/* Conductors List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0b57d0" />
          <Text style={styles.loadingText}>Loading conductors list...</Text>
        </View>
      ) : conductors.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={64} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>No Conductors Registered</Text>
          <Text style={styles.emptySubtitle}>Tap 'Add' to enroll bus assistants and conductors.</Text>
        </View>
      ) : (
        <FlatList
          data={conductors}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderConductorCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      )}

      {/* Add / Edit Conductor Modal */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingId ? 'Edit Conductor' : 'Enroll Conductor'}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color="#0f172a" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Full Name *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Suresh Yadav"
                placeholderTextColor="#94a3b8"
                value={form.name}
                onChangeText={(v) => setForm(f => ({ ...f, name: v }))}
              />

              <Text style={styles.fieldLabel}>Mobile Phone *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="10-digit mobile number"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
                value={form.mobile_number}
                onChangeText={(v) => setForm(f => ({ ...f, mobile_number: v }))}
              />

              <Text style={styles.fieldLabel}>Residential Address</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Local address"
                placeholderTextColor="#94a3b8"
                value={form.address}
                onChangeText={(v) => setForm(f => ({ ...f, address: v }))}
              />

              <Text style={styles.fieldLabel}>Experience (Years)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. 3"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={form.experience_years}
                onChangeText={(v) => setForm(f => ({ ...f, experience_years: v }))}
              />

              <Text style={styles.fieldLabel}>Emergency Contact Number</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Family / Alternate contact"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
                value={form.emergency_contact}
                onChangeText={(v) => setForm(f => ({ ...f, emergency_contact: v }))}
              />

              <Text style={styles.fieldLabel}>Remarks / Notes</Text>
              <TextInput
                style={[styles.textInput, { height: 68 }]}
                placeholder="e.g. Verified police verification"
                placeholderTextColor="#94a3b8"
                multiline
                value={form.remarks}
                onChangeText={(v) => setForm(f => ({ ...f, remarks: v }))}
              />

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitBtnText}>{editingId ? 'Save Changes' : 'Enroll Conductor'}</Text>
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  searchInputContainer: {
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  conductorName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  conductorPhone: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  activePill: {
    backgroundColor: '#dcfce7',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  activePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16a34a',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  detailText: {
    fontSize: 12.5,
    color: '#64748b',
  },
  remarksText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 6,
    fontStyle: 'italic',
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
    maxHeight: '85%',
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
});
