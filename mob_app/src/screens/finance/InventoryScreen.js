// mob_app/src/screens/finance/InventoryScreen.js
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

const INVENTORY_CATEGORIES = [
  'ALL',
  'STATIONERY',
  'UNIFORM',
  'BOOKS',
  'SPORTS',
  'LAB',
  'IT',
  'MAINTENANCE',
  'OTHER',
];

const UNITS = ['PIECES', 'BOXES', 'PACKS', 'SETS', 'KILOGRAMS', 'LITERS', 'METERS'];

const fmt = (n) => `₹ ${Number(n || 0).toLocaleString('en-IN')}`;

export default function InventoryScreen({ navigation }) {
  const { user } = useAuth();
  const role = user?.role ? String(user.role).toUpperCase() : 'STAFF';
  const canManage = ['PRINCIPAL', 'VICE_PRINCIPAL', 'ADMIN', 'SUPER_ADMIN', 'ACCOUNTANT', 'TEACHER'].includes(role);

  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Modals
  const [addModal, setAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    category: 'STATIONERY',
    subcategory: '',
    unit: 'PIECES',
    brand: '',
    quantity: '0',
    unit_price: '0',
    selling_price: '0',
    min_stock: '5',
    reorder_level: '10',
    storage_location: 'Store Room',
    remarks: '',
  });

  const [issueModal, setIssueModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [issueForm, setIssueForm] = useState({
    quantity: '1',
    issued_to_name: '',
    department: 'ACADEMIC',
    class_name: '',
    reason: '',
  });

  const [adjustModal, setAdjustModal] = useState(false);
  const [adjustForm, setAdjustForm] = useState({
    adjustment_qty: '',
    reason: '',
  });

  const [movementModal, setMovementModal] = useState(false);
  const [movements, setMovements] = useState([]);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (selectedCategory && selectedCategory !== 'ALL') params.category = selectedCategory;
      if (lowStockOnly) params.low_stock = 'true';

      const [iRes, sRes] = await Promise.all([
        client.get('/finance/inventory', { params }).catch(() => ({ data: [] })),
        client.get('/finance/inventory/summary').catch(() => ({ data: null })),
      ]);

      const list = Array.isArray(iRes.data) ? iRes.data : iRes.data?.items || [];
      setItems(list);
      setSummary(sRes.data);
    } catch {
      setItems([]);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, [search, selectedCategory, lowStockOnly]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Add Item
  const handleAddItem = async () => {
    if (!addForm.name.trim()) {
      Alert.alert('Validation Error', 'Item name is required.');
      return;
    }
    setSubmitting(true);
    try {
      await client.post('/finance/inventory', {
        ...addForm,
        quantity: parseInt(addForm.quantity, 10) || 0,
        unit_price: parseFloat(addForm.unit_price) || 0,
        selling_price: parseFloat(addForm.selling_price) || 0,
        min_stock: parseInt(addForm.min_stock, 10) || 5,
        reorder_level: parseInt(addForm.reorder_level, 10) || 10,
      });
      Alert.alert('Success', 'Inventory item registered successfully.');
      setAddModal(false);
      setAddForm({
        name: '',
        category: 'STATIONERY',
        subcategory: '',
        unit: 'PIECES',
        brand: '',
        quantity: '0',
        unit_price: '0',
        selling_price: '0',
        min_stock: '5',
        reorder_level: '10',
        storage_location: 'Store Room',
        remarks: '',
      });
      loadData();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to add inventory item.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Issue Stock
  const handleIssueStock = async () => {
    const qty = parseInt(issueForm.quantity, 10);
    if (!qty || qty <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid quantity to issue.');
      return;
    }
    if (qty > (selectedItem?.quantity || 0)) {
      Alert.alert('Insufficient Stock', `Available quantity is only ${selectedItem?.quantity || 0}.`);
      return;
    }
    if (!issueForm.issued_to_name.trim()) {
      Alert.alert('Missing Field', 'Please specify who this item is being issued to.');
      return;
    }

    setSubmitting(true);
    try {
      await client.post('/finance/inventory/issue', {
        item_id: selectedItem.id,
        quantity: qty,
        issued_to_name: issueForm.issued_to_name.trim(),
        department: issueForm.department,
        class_name: issueForm.class_name.trim(),
        reason: issueForm.reason.trim(),
      });
      Alert.alert('Success', `Issued ${qty} units of ${selectedItem.name}.`);
      setIssueModal(false);
      loadData();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to issue item stock.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Adjust Stock
  const handleAdjustStock = async () => {
    const adj = parseInt(adjustForm.adjustment_qty, 10);
    if (isNaN(adj) || adj === 0) {
      Alert.alert('Invalid Adjustment', 'Please enter a non-zero adjustment (+ or -).');
      return;
    }
    if (!adjustForm.reason.trim()) {
      Alert.alert('Missing Reason', 'A reason is required for stock adjustment audits.');
      return;
    }

    setSubmitting(true);
    try {
      await client.post('/finance/inventory/adjust', {
        item_id: selectedItem.id,
        adjustment_qty: adj,
        reason: adjustForm.reason.trim(),
      });
      Alert.alert('Success', 'Inventory stock adjusted successfully.');
      setAdjustModal(false);
      loadData();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to adjust stock.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Movement History
  const openMovements = async (item) => {
    setSelectedItem(item);
    setMovementModal(true);
    setLoadingMovements(true);
    try {
      const res = await client.get(`/finance/inventory/${item.id}/movements`);
      setMovements(Array.isArray(res.data) ? res.data : []);
    } catch {
      setMovements([]);
    } finally {
      setLoadingMovements(false);
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
          <Text style={styles.headerTitle}>Inventory & Stock</Text>
          <Text style={styles.headerSub}>Store Supplies, Issuances & Audits</Text>
        </View>
        {canManage && (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setAddModal(true)}
          >
            <Ionicons name="add" size={20} color="#ffffff" />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* KPI Overview Banner */}
      <View style={styles.kpiContainer}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiVal}>{summary?.total_items || items.length}</Text>
          <Text style={styles.kpiLbl}>Total Items</Text>
        </View>
        <View style={[styles.kpiCard, { borderColor: '#e0e7ff' }]}>
          <Text style={[styles.kpiVal, { color: '#4338ca' }]}>
            {fmt(summary?.total_value || summary?.total_stock_value || 0)}
          </Text>
          <Text style={styles.kpiLbl}>Stock Valuation</Text>
        </View>
        <TouchableOpacity
          style={[styles.kpiCard, lowStockOnly && styles.kpiCardSelected, { borderColor: '#fef3c7' }]}
          onPress={() => setLowStockOnly(!lowStockOnly)}
        >
          <Text style={[styles.kpiVal, { color: '#d97706' }]}>
            {summary?.low_stock_count ?? (items.filter(i => (i.quantity || 0) <= (i.min_stock || 0)).length)}
          </Text>
          <Text style={styles.kpiLbl}>Low Stock Alerts</Text>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color="#64748b" style={{ marginLeft: 12 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by item name, SKU, brand..."
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
      <View style={{ height: 44, marginBottom: 8 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {INVENTORY_CATEGORIES.map(cat => {
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

      {/* Inventory Items List */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading warehouse inventory...</Text>
        </View>
      ) : (
        <FlatList
          data={items}
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
              <Ionicons name="cube-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No Stock Items Found</Text>
              <Text style={styles.emptySub}>
                {search ? 'Try changing your search filters.' : 'Tap "+ Add" to register new stock inventory.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isLow = (item.quantity || 0) <= (item.min_stock || 0);
            const isOut = (item.quantity || 0) === 0;

            return (
              <View style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <View style={styles.badgeRow}>
                      <View style={styles.catBadge}>
                        <Text style={styles.catBadgeText}>{item.category || 'GENERAL'}</Text>
                      </View>
                      {item.item_code ? (
                        <View style={[styles.catBadge, { backgroundColor: '#f1f5f9' }]}>
                          <Text style={[styles.catBadgeText, { color: '#64748b' }]}>
                            {item.item_code}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.qtyText, { color: isOut ? '#dc2626' : isLow ? '#d97706' : '#16a34a' }]}>
                      {item.quantity} {item.unit || 'units'}
                    </Text>
                    <Text style={[styles.stockStatusText, { color: isOut ? '#dc2626' : isLow ? '#d97706' : '#64748b' }]}>
                      {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                    </Text>
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <Text style={styles.metaItem}>Unit Price: {fmt(item.unit_price)}</Text>
                  <Text style={styles.metaDivider}>•</Text>
                  <Text style={styles.metaItem}>Min Alert: {item.min_stock || 5}</Text>
                  {item.storage_location ? (
                    <>
                      <Text style={styles.metaDivider}>•</Text>
                      <Text style={styles.metaItem}>{item.storage_location}</Text>
                    </>
                  ) : null}
                </View>

                <View style={styles.cardDivider} />

                {/* Action Buttons */}
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.actionBtnOutline}
                    onPress={() => openMovements(item)}
                  >
                    <Ionicons name="time-outline" size={14} color="#0284c7" />
                    <Text style={[styles.actionBtnOutlineText, { color: '#0284c7' }]}>Audit Ledger</Text>
                  </TouchableOpacity>

                  {canManage && (
                    <TouchableOpacity
                      style={styles.actionBtnOutline}
                      onPress={() => {
                        setSelectedItem(item);
                        setAdjustForm({ adjustment_qty: '', reason: '' });
                        setAdjustModal(true);
                      }}
                    >
                      <Ionicons name="options-outline" size={14} color="#475569" />
                      <Text style={styles.actionBtnOutlineText}>Adjust</Text>
                    </TouchableOpacity>
                  )}

                  {canManage && (
                    <TouchableOpacity
                      style={styles.actionBtnPrimary}
                      onPress={() => {
                        setSelectedItem(item);
                        setIssueForm({
                          quantity: '1',
                          issued_to_name: '',
                          department: 'ACADEMIC',
                          class_name: '',
                          reason: '',
                        });
                        setIssueModal(true);
                      }}
                    >
                      <Ionicons name="arrow-redo-outline" size={14} color="#ffffff" />
                      <Text style={styles.actionBtnPrimaryText}>Issue Stock</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Add Item Modal */}
      <Modal
        visible={addModal}
        animationType="slide"
        transparent
        onRequestClose={() => setAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Register Inventory Stock</Text>
              <TouchableOpacity onPress={() => setAddModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              <Text style={styles.inputLabel}>Item Name *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. A4 Copy Paper, Whiteboard Markers"
                value={addForm.name}
                onChangeText={(t) => setAddForm({ ...addForm, name: t })}
              />

              <Text style={styles.inputLabel}>Category</Text>
              <View style={styles.chipsRow}>
                {INVENTORY_CATEGORIES.filter(c => c !== 'ALL').map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.smallChip, addForm.category === c && styles.smallChipActive]}
                    onPress={() => setAddForm({ ...addForm, category: c })}
                  >
                    <Text style={[styles.smallChipText, addForm.category === c && styles.smallChipTextActive]}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Unit of Measurement</Text>
              <View style={styles.chipsRow}>
                {UNITS.map(u => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.smallChip, addForm.unit === u && styles.smallChipActive]}
                    onPress={() => setAddForm({ ...addForm, unit: u })}
                  >
                    <Text style={[styles.smallChipText, addForm.unit === u && styles.smallChipTextActive]}>
                      {u}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.twoCol}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={styles.inputLabel}>Initial Quantity *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="0"
                    keyboardType="number-pad"
                    value={addForm.quantity}
                    onChangeText={(t) => setAddForm({ ...addForm, quantity: t })}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Text style={styles.inputLabel}>Unit Cost Price (₹)</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="0.00"
                    keyboardType="numeric"
                    value={addForm.unit_price}
                    onChangeText={(t) => setAddForm({ ...addForm, unit_price: t })}
                  />
                </View>
              </View>

              <View style={styles.twoCol}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={styles.inputLabel}>Min Alert Threshold</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="5"
                    keyboardType="number-pad"
                    value={addForm.min_stock}
                    onChangeText={(t) => setAddForm({ ...addForm, min_stock: t })}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Text style={styles.inputLabel}>Reorder Level</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="10"
                    keyboardType="number-pad"
                    value={addForm.reorder_level}
                    onChangeText={(t) => setAddForm({ ...addForm, reorder_level: t })}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Storage Location / Shelf</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Main Store Room - Rack 3B"
                value={addForm.storage_location}
                onChangeText={(t) => setAddForm({ ...addForm, storage_location: t })}
              />

              <Text style={styles.inputLabel}>Remarks / Specs</Text>
              <TextInput
                style={[styles.formInput, { height: 60 }]}
                placeholder="Brand, size specifications, vendor details..."
                multiline
                value={addForm.remarks}
                onChangeText={(t) => setAddForm({ ...addForm, remarks: t })}
              />

              <TouchableOpacity
                style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
                onPress={handleAddItem}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitBtnText}>Save to Inventory</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Issue Stock Modal */}
      <Modal
        visible={issueModal}
        animationType="slide"
        transparent
        onRequestClose={() => setIssueModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Issue Stock</Text>
                <Text style={styles.modalSub}>
                  {selectedItem?.name} (Available: {selectedItem?.quantity} {selectedItem?.unit})
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIssueModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              <Text style={styles.inputLabel}>Quantity to Issue *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="1"
                keyboardType="number-pad"
                value={issueForm.quantity}
                onChangeText={(t) => setIssueForm({ ...issueForm, quantity: t })}
              />

              <Text style={styles.inputLabel}>Issued To (Name) *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Staff, Faculty or Student Name"
                value={issueForm.issued_to_name}
                onChangeText={(t) => setIssueForm({ ...issueForm, issued_to_name: t })}
              />

              <Text style={styles.inputLabel}>Department</Text>
              <View style={styles.chipsRow}>
                {['ACADEMIC', 'ADMIN', 'SPORTS', 'LAB', 'TRANSPORT', 'HOSTEL'].map(d => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.smallChip, issueForm.department === d && styles.smallChipActive]}
                    onPress={() => setIssueForm({ ...issueForm, department: d })}
                  >
                    <Text style={[styles.smallChipText, issueForm.department === d && styles.smallChipTextActive]}>
                      {d}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Target Class / Section (Optional)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Class 10-A"
                value={issueForm.class_name}
                onChangeText={(t) => setIssueForm({ ...issueForm, class_name: t })}
              />

              <Text style={styles.inputLabel}>Purpose / Reason</Text>
              <TextInput
                style={[styles.formInput, { height: 60 }]}
                placeholder="Classroom teaching, exam supplies, annual sports meet..."
                multiline
                value={issueForm.reason}
                onChangeText={(t) => setIssueForm({ ...issueForm, reason: t })}
              />

              <TouchableOpacity
                style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
                onPress={handleIssueStock}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitBtnText}>Confirm Issuance</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Adjust Stock Modal */}
      <Modal
        visible={adjustModal}
        animationType="slide"
        transparent
        onRequestClose={() => setAdjustModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Stock Adjustment</Text>
                <Text style={styles.modalSub}>
                  {selectedItem?.name} (Current Stock: {selectedItem?.quantity})
                </Text>
              </View>
              <TouchableOpacity onPress={() => setAdjustModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              <Text style={styles.inputLabel}>Adjustment Quantity (+ or -) *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. +10 (restock) or -2 (damaged)"
                keyboardType="numeric"
                value={adjustForm.adjustment_qty}
                onChangeText={(t) => setAdjustForm({ ...adjustForm, adjustment_qty: t })}
              />

              <Text style={styles.inputLabel}>Reason for Adjustment *</Text>
              <TextInput
                style={[styles.formInput, { height: 70 }]}
                placeholder="Physical stock count discrepancy, damaged goods, supplier return..."
                multiline
                value={adjustForm.reason}
                onChangeText={(t) => setAdjustForm({ ...adjustForm, reason: t })}
              />

              <TouchableOpacity
                style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
                onPress={handleAdjustStock}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitBtnText}>Save Stock Adjustment</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Movements Audit Modal */}
      <Modal
        visible={movementModal}
        animationType="slide"
        transparent
        onRequestClose={() => setMovementModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Stock Movement Ledger</Text>
                <Text style={styles.modalSub}>{selectedItem?.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setMovementModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            {loadingMovements ? (
              <View style={styles.centerBox}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Fetching stock audit trail...</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
                {movements.length > 0 ? (
                  movements.map((m, i) => {
                    const isPositive = m.movement_type === 'STOCK_IN' || (m.quantity > 0 && m.movement_type === 'STOCK_ADJUST');
                    return (
                      <View key={m.id || i} style={styles.historyCard}>
                        <View style={styles.historyHeader}>
                          <Text style={styles.historyRef}>
                            {m.movement_type?.replace(/_/g, ' ') || 'MOVEMENT'}
                          </Text>
                          <Text style={[styles.movementQty, { color: isPositive ? '#16a34a' : '#dc2626' }]}>
                            {isPositive ? `+${m.quantity}` : `-${Math.abs(m.quantity)}`}
                          </Text>
                        </View>
                        <View style={styles.historyRow}>
                          <Text style={styles.historyDate}>Date: {m.movement_date || m.created_at || '—'}</Text>
                          <Text style={styles.historyBalance}>
                            Bal: {m.new_stock != null ? m.new_stock : '—'}
                          </Text>
                        </View>
                        {m.reason ? <Text style={styles.historyNotes}>Reason: {m.reason}</Text> : null}
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.emptyNotice}>No stock movement logs found for this item.</Text>
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
  kpiCardSelected: {
    borderColor: '#d97706',
    backgroundColor: '#fffbeb',
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
  itemCard: {
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
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  itemName: {
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
  qtyText: {
    fontSize: 15,
    fontWeight: '800',
  },
  stockStatusText: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
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
    gap: 8,
  },
  actionBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  actionBtnOutlineText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  actionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  actionBtnPrimaryText: {
    fontSize: 12,
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
  movementQty: {
    fontSize: 13,
    fontWeight: '800',
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  historyDate: {
    fontSize: 11,
    color: '#64748b',
  },
  historyBalance: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
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
