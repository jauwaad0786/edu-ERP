// mob_app/src/screens/finance/VendorsScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  TouchableOpacity, ActivityIndicator, TextInput, Modal, Alert,
  ScrollView, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';

const VENDOR_CATEGORIES = [
  'ALL',
  'STATIONERY',
  'FURNITURE',
  'FOOD',
  'EQUIPMENT',
  'TRANSPORT',
  'IT',
  'MAINTENANCE',
  'OTHER',
];

const fmt = (n) => `₹ ${Number(n || 0).toLocaleString('en-IN')}`;

export default function VendorsScreen({ navigation }) {
  const { user } = useAuth();
  const role = user?.role ? String(user.role).toUpperCase() : 'STAFF';
  const canManage = ['PRINCIPAL', 'VICE_PRINCIPAL', 'ADMIN', 'SUPER_ADMIN', 'ACCOUNTANT'].includes(role);

  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Add / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVendorId, setEditingVendorId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    gst_number: '',
    pan_number: '',
    category: 'STATIONERY',
    payment_terms: 'Net 30',
    bank_name: '',
    bank_account_no: '',
    bank_ifsc: '',
    notes: '',
  });

  // History & Ledger Modal
  const [historyModal, setHistoryModal] = useState(false);
  const [historyVendor, setHistoryVendor] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyTab, setHistoryTab] = useState('BILLS'); // 'BILLS' | 'PAYMENTS' | 'ORDERS'

  const loadVendors = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (selectedCategory && selectedCategory !== 'ALL') params.category = selectedCategory;

      const res = await client.get('/finance/vendors', { params }).catch(() => ({ data: [] }));
      const list = Array.isArray(res.data) ? res.data : res.data?.vendors || [];
      setVendors(list);
    } catch {
      setVendors([]);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, [search, selectedCategory]);

  useEffect(() => {
    loadVendors();
  }, [loadVendors]);

  // Save (Create or Edit)
  const handleSaveVendor = async () => {
    if (!form.name.trim()) {
      Alert.alert('Validation Error', 'Vendor name is required.');
      return;
    }
    if (!form.phone.trim() && !form.email.trim()) {
      Alert.alert('Validation Error', 'Please provide either a contact phone or email.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingVendorId) {
        await client.put(`/finance/vendors/${editingVendorId}`, form);
        Alert.alert('Success', 'Vendor profile updated successfully.');
      } else {
        await client.post('/finance/vendors', form);
        Alert.alert('Success', 'Vendor profile registered successfully.');
      }
      setModalOpen(false);
      resetForm();
      loadVendors();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to save vendor details.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setEditingVendorId(null);
    setForm({
      name: '',
      contact_person: '',
      phone: '',
      email: '',
      address: '',
      gst_number: '',
      pan_number: '',
      category: 'STATIONERY',
      payment_terms: 'Net 30',
      bank_name: '',
      bank_account_no: '',
      bank_ifsc: '',
      notes: '',
    });
  };

  const handleEdit = (v) => {
    setEditingVendorId(v.id);
    setForm({
      name: v.name || '',
      contact_person: v.contact_person || '',
      phone: v.phone || '',
      email: v.email || '',
      address: v.address || '',
      gst_number: v.gst_number || '',
      pan_number: v.pan_number || '',
      category: v.category || 'STATIONERY',
      payment_terms: v.payment_terms || 'Net 30',
      bank_name: v.bank_name || '',
      bank_account_no: v.bank_account_no || '',
      bank_ifsc: v.bank_ifsc || '',
      notes: v.notes || '',
    });
    setModalOpen(true);
  };

  const handleDelete = (v) => {
    Alert.alert(
      'Deactivate Vendor',
      `Are you sure you want to deactivate vendor "${v.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            try {
              await client.delete(`/finance/vendors/${v.id}`);
              Alert.alert('Deactivated', `Vendor "${v.name}" deactivated.`);
              loadVendors();
            } catch (err) {
              Alert.alert('Error', err?.response?.data?.error || 'Failed to deactivate vendor.');
            }
          },
        },
      ]
    );
  };

  const openHistory = async (v) => {
    setHistoryVendor(v);
    setHistoryModal(true);
    setLoadingHistory(true);
    setHistoryTab('BILLS');
    try {
      const res = await client.get(`/finance/vendors/${v.id}/history`);
      setHistoryData(res.data);
    } catch {
      Alert.alert('Notice', 'Failed to load ledger history for this vendor.');
      setHistoryData(null);
    } finally {
      setLoadingHistory(false);
    }
  };

  const makeCall = (phone) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Error', 'Unable to initiate call on this device.');
    });
  };

  const sendEmail = (email) => {
    if (!email) return;
    Linking.openURL(`mailto:${email}`).catch(() => {
      Alert.alert('Error', 'Unable to open mail client.');
    });
  };

  // Metrics
  const totalPurchases = useMemo(() => {
    return vendors.reduce((acc, v) => acc + (Number(v.total_purchases) || 0), 0);
  }, [vendors]);

  const totalOutstanding = useMemo(() => {
    return vendors.reduce((acc, v) => acc + (Number(v.outstanding_balance) || 0), 0);
  }, [vendors]);

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
          <Text style={styles.headerTitle}>Vendors & Suppliers</Text>
          <Text style={styles.headerSub}>Procurement & Institutional Payables</Text>
        </View>
        {canManage && (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => {
              resetForm();
              setModalOpen(true);
            }}
          >
            <Ionicons name="add" size={20} color="#ffffff" />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Summary KPI Banner */}
      <View style={styles.kpiContainer}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiVal}>{vendors.length}</Text>
          <Text style={styles.kpiLbl}>Total Vendors</Text>
        </View>
        <View style={[styles.kpiCard, { borderColor: '#e0e7ff' }]}>
          <Text style={[styles.kpiVal, { color: '#4338ca' }]}>{fmt(totalPurchases)}</Text>
          <Text style={styles.kpiLbl}>Total Purchases</Text>
        </View>
        <View style={[styles.kpiCard, { borderColor: '#fee2e2' }]}>
          <Text style={[styles.kpiVal, { color: '#b91c1c' }]}>{fmt(totalOutstanding)}</Text>
          <Text style={styles.kpiLbl}>Outstanding Due</Text>
        </View>
      </View>

      {/* Search Input */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color="#64748b" style={{ marginLeft: 12 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by vendor name, contact, GSTIN..."
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

      {/* Category Filter Chips */}
      <View style={{ height: 44, marginBottom: 8 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {VENDOR_CATEGORIES.map(cat => {
            const isSel = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.filterChip, isSel && styles.filterChipActive]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={[styles.filterChipText, isSel && styles.filterChipTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Vendors List */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading suppliers directory...</Text>
        </View>
      ) : (
        <FlatList
          data={vendors}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadVendors(true)}
              colors={[colors.primary]}
            />
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="business-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No Vendors Found</Text>
              <Text style={styles.emptySub}>
                {search ? 'Try adjusting your search criteria.' : 'Tap "+ Add" to register a new vendor.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const outBal = Number(item.outstanding_balance || 0);
            return (
              <View style={styles.vendorCard}>
                <View style={styles.vendorHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.vendorName}>{item.name}</Text>
                    <View style={styles.badgeRow}>
                      <View style={styles.catBadge}>
                        <Text style={styles.catBadgeText}>{item.category || 'GENERAL'}</Text>
                      </View>
                      {item.gst_number ? (
                        <View style={[styles.catBadge, { backgroundColor: '#f0fdf4' }]}>
                          <Text style={[styles.catBadgeText, { color: '#16a34a' }]}>
                            GST: {item.gst_number}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.dueAmount, { color: outBal > 0 ? '#dc2626' : '#16a34a' }]}>
                      {fmt(outBal)}
                    </Text>
                    <Text style={styles.dueLabel}>{outBal > 0 ? 'Payable Due' : 'Cleared'}</Text>
                  </View>
                </View>

                {item.contact_person ? (
                  <View style={styles.detailRow}>
                    <Ionicons name="person-outline" size={14} color="#64748b" />
                    <Text style={styles.detailText}>{item.contact_person}</Text>
                  </View>
                ) : null}

                {item.address ? (
                  <View style={styles.detailRow}>
                    <Ionicons name="location-outline" size={14} color="#64748b" />
                    <Text style={styles.detailText} numberOfLines={1}>{item.address}</Text>
                  </View>
                ) : null}

                <View style={styles.cardDivider} />

                {/* Actions Row */}
                <View style={styles.actionsRow}>
                  <View style={styles.contactActions}>
                    {item.phone ? (
                      <TouchableOpacity
                        style={styles.iconBtn}
                        onPress={() => makeCall(item.phone)}
                      >
                        <Ionicons name="call-outline" size={16} color="#0284c7" />
                      </TouchableOpacity>
                    ) : null}
                    {item.email ? (
                      <TouchableOpacity
                        style={styles.iconBtn}
                        onPress={() => sendEmail(item.email)}
                      >
                        <Ionicons name="mail-outline" size={16} color="#7c3aed" />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <View style={styles.mgmtActions}>
                    <TouchableOpacity
                      style={styles.historyBtn}
                      onPress={() => openHistory(item)}
                    >
                      <Ionicons name="time-outline" size={14} color="#0f766e" />
                      <Text style={styles.historyBtnText}>Ledger</Text>
                    </TouchableOpacity>

                    {canManage && (
                      <TouchableOpacity
                        style={styles.editBtn}
                        onPress={() => handleEdit(item)}
                      >
                        <Ionicons name="create-outline" size={16} color="#475569" />
                      </TouchableOpacity>
                    )}

                    {canManage && (
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => handleDelete(item)}
                      >
                        <Ionicons name="trash-outline" size={16} color="#dc2626" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Add / Edit Vendor Modal */}
      <Modal
        visible={modalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingVendorId ? 'Edit Vendor Profile' : 'Register New Vendor'}
              </Text>
              <TouchableOpacity onPress={() => setModalOpen(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              <Text style={styles.inputLabel}>Vendor / Business Name *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Apex Stationery Ltd"
                value={form.name}
                onChangeText={(t) => setForm({ ...form, name: t })}
              />

              <Text style={styles.inputLabel}>Category</Text>
              <View style={styles.catChipsRow}>
                {VENDOR_CATEGORIES.filter(c => c !== 'ALL').map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.smallChip, form.category === c && styles.smallChipActive]}
                    onPress={() => setForm({ ...form, category: c })}
                  >
                    <Text style={[styles.smallChipText, form.category === c && styles.smallChipTextActive]}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.twoCol}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={styles.inputLabel}>Contact Person</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Representative Name"
                    value={form.contact_person}
                    onChangeText={(t) => setForm({ ...form, contact_person: t })}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Text style={styles.inputLabel}>Phone Number</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="10-digit Phone"
                    keyboardType="phone-pad"
                    value={form.phone}
                    onChangeText={(t) => setForm({ ...form, phone: t })}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Email Address</Text>
              <TextInput
                style={styles.formInput}
                placeholder="vendor@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                value={form.email}
                onChangeText={(t) => setForm({ ...form, email: t })}
              />

              <Text style={styles.inputLabel}>Full Business Address</Text>
              <TextInput
                style={[styles.formInput, { height: 60 }]}
                placeholder="Shop / Unit, Street, City, State, PIN"
                multiline
                value={form.address}
                onChangeText={(t) => setForm({ ...form, address: t })}
              />

              <View style={styles.twoCol}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={styles.inputLabel}>GSTIN</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="15-digit GSTIN"
                    autoCapitalize="characters"
                    value={form.gst_number}
                    onChangeText={(t) => setForm({ ...form, gst_number: t })}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Text style={styles.inputLabel}>PAN Number</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="10-digit PAN"
                    autoCapitalize="characters"
                    value={form.pan_number}
                    onChangeText={(t) => setForm({ ...form, pan_number: t })}
                  />
                </View>
              </View>

              <Text style={styles.sectionDividerText}>Banking Details & Terms</Text>

              <Text style={styles.inputLabel}>Bank Name</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. HDFC Bank, State Bank of India"
                value={form.bank_name}
                onChangeText={(t) => setForm({ ...form, bank_name: t })}
              />

              <View style={styles.twoCol}>
                <View style={{ flex: 1.3, marginRight: 6 }}>
                  <Text style={styles.inputLabel}>Account Number</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Account Number"
                    keyboardType="number-pad"
                    value={form.bank_account_no}
                    onChangeText={(t) => setForm({ ...form, bank_account_no: t })}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Text style={styles.inputLabel}>IFSC Code</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="IFSC Code"
                    autoCapitalize="characters"
                    value={form.bank_ifsc}
                    onChangeText={(t) => setForm({ ...form, bank_ifsc: t })}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Payment Terms</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Net 30, Advance, Cash On Delivery"
                value={form.payment_terms}
                onChangeText={(t) => setForm({ ...form, payment_terms: t })}
              />

              <Text style={styles.inputLabel}>Internal Notes</Text>
              <TextInput
                style={[styles.formInput, { height: 60 }]}
                placeholder="Special agreements, delivery contact notes..."
                multiline
                value={form.notes}
                onChangeText={(t) => setForm({ ...form, notes: t })}
              />

              <TouchableOpacity
                style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
                onPress={handleSaveVendor}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {editingVendorId ? 'Save Changes' : 'Register Vendor'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Vendor History / Ledger Modal */}
      <Modal
        visible={historyModal}
        animationType="slide"
        transparent
        onRequestClose={() => setHistoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {historyVendor?.name || 'Vendor Ledger'}
                </Text>
                <Text style={styles.modalSub}>Transaction History & Statements</Text>
              </View>
              <TouchableOpacity onPress={() => setHistoryModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            {loadingHistory ? (
              <View style={styles.centerBox}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Fetching transaction records...</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
                {/* Ledger Financial Summary */}
                <View style={styles.ledgerKpiRow}>
                  <View style={styles.ledgerKpiBox}>
                    <Text style={styles.ledgerKpiVal}>{fmt(historyData?.total_purchases)}</Text>
                    <Text style={styles.ledgerKpiLbl}>Purchases</Text>
                  </View>
                  <View style={styles.ledgerKpiBox}>
                    <Text style={[styles.ledgerKpiVal, { color: '#16a34a' }]}>
                      {fmt(historyData?.total_paid)}
                    </Text>
                    <Text style={styles.ledgerKpiLbl}>Total Paid</Text>
                  </View>
                  <View style={styles.ledgerKpiBox}>
                    <Text style={[styles.ledgerKpiVal, { color: '#dc2626' }]}>
                      {fmt(historyData?.outstanding_balance)}
                    </Text>
                    <Text style={styles.ledgerKpiLbl}>Outstanding</Text>
                  </View>
                </View>

                {/* Sub-Tabs */}
                <View style={styles.ledgerTabs}>
                  {['BILLS', 'PAYMENTS', 'ORDERS'].map(t => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.ledgerTabBtn, historyTab === t && styles.ledgerTabBtnActive]}
                      onPress={() => setHistoryTab(t)}
                    >
                      <Text style={[styles.ledgerTabTxt, historyTab === t && styles.ledgerTabTxtActive]}>
                        {t === 'BILLS' ? 'Bills / Invoices' : t === 'PAYMENTS' ? 'Payments Made' : 'Purchase Orders'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Sub-Tab Contents */}
                {historyTab === 'BILLS' && (
                  <View>
                    {(historyData?.bills && historyData.bills.length > 0) ? (
                      historyData.bills.map((b, i) => (
                        <View key={b.id || i} style={styles.historyCard}>
                          <View style={styles.historyHeader}>
                            <Text style={styles.historyRef}>Bill #{b.bill_number || b.id}</Text>
                            <Text style={[styles.statusText, { color: b.status === 'PAID' ? '#16a34a' : '#d97706' }]}>
                              {b.status || 'PENDING'}
                            </Text>
                          </View>
                          <View style={styles.historyRow}>
                            <Text style={styles.historyDate}>Date: {b.bill_date || '—'}</Text>
                            <Text style={styles.historyAmount}>{fmt(b.total_amount)}</Text>
                          </View>
                          <Text style={styles.historyNotes}>Paid: {fmt(b.paid_amount || 0)}</Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.emptyNotice}>No bills recorded for this vendor.</Text>
                    )}
                  </View>
                )}

                {historyTab === 'PAYMENTS' && (
                  <View>
                    {(historyData?.payments && historyData.payments.length > 0) ? (
                      historyData.payments.map((p, i) => (
                        <View key={p.id || i} style={styles.historyCard}>
                          <View style={styles.historyHeader}>
                            <Text style={styles.historyRef}>Payment Ref: {p.reference_no || p.id}</Text>
                            <Text style={[styles.statusText, { color: '#16a34a' }]}>
                              {p.payment_mode || 'BANK_TRANSFER'}
                            </Text>
                          </View>
                          <View style={styles.historyRow}>
                            <Text style={styles.historyDate}>Date: {p.payment_date || '—'}</Text>
                            <Text style={[styles.historyAmount, { color: '#16a34a' }]}>{fmt(p.amount)}</Text>
                          </View>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.emptyNotice}>No payments logged for this vendor yet.</Text>
                    )}
                  </View>
                )}

                {historyTab === 'ORDERS' && (
                  <View>
                    {(historyData?.purchase_orders && historyData.purchase_orders.length > 0) ? (
                      historyData.purchase_orders.map((po, i) => (
                        <View key={po.id || i} style={styles.historyCard}>
                          <View style={styles.historyHeader}>
                            <Text style={styles.historyRef}>PO #{po.po_number || po.id}</Text>
                            <Text style={[styles.statusText, { color: '#4338ca' }]}>
                              {po.status || 'DRAFT'}
                            </Text>
                          </View>
                          <View style={styles.historyRow}>
                            <Text style={styles.historyDate}>Order Date: {po.order_date || '—'}</Text>
                            <Text style={styles.historyAmount}>{fmt(po.total_amount)}</Text>
                          </View>
                          {po.notes ? <Text style={styles.historyNotes}>{po.notes}</Text> : null}
                        </View>
                      ))
                    ) : (
                      <Text style={styles.emptyNotice}>No purchase orders registered.</Text>
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
  vendorCard: {
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
  vendorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  vendorName: {
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
  dueAmount: {
    fontSize: 15,
    fontWeight: '800',
  },
  dueLabel: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '600',
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
    flex: 1,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contactActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mgmtActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fdfa',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ccfbf1',
  },
  historyBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f766e',
  },
  editBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
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
  catChipsRow: {
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
  sectionDividerText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0284c7',
    marginTop: 8,
    marginBottom: 8,
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
  ledgerKpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  ledgerKpiBox: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  ledgerKpiVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  ledgerKpiLbl: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
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
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  historyDate: {
    fontSize: 11,
    color: '#64748b',
  },
  historyAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  historyNotes: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
  },
  emptyNotice: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 20,
  },
});
