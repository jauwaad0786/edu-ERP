// mob_app/src/screens/fees/FeeSetupScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, TextInput, Modal, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';

const FREQUENCIES = ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'ANNUALLY', 'ONE_TIME'];
const HEAD_CATEGORIES = ['ACADEMIC', 'TRANSPORT', 'HOSTEL', 'EXAM', 'FACILITY', 'MISC'];

const fmt = v => {
  if (v == null || isNaN(v)) return '₹ 0';
  return `₹ ${Number(v).toLocaleString('en-IN')}`;
};

export default function FeeSetupScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('structures'); // 'structures' | 'heads' | 'plans' | 'concessions'
  const [session, setSession] = useState('2026-27');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data
  const [structures, setStructures] = useState([]);
  const [heads, setHeads] = useState([]);
  const [classes, setClasses] = useState([]);
  const [plans, setPlans] = useState([]);
  const [concessions, setConcessions] = useState([]);

  // Filter
  const [selectedClassId, setSelectedClassId] = useState('ALL');
  const [searchHead, setSearchHead] = useState('');

  // Modals
  const [headModalVisible, setHeadModalVisible] = useState(false);
  const [creatingHead, setCreatingHead] = useState(false);
  const [headForm, setHeadForm] = useState({
    name: '',
    code: '',
    category: 'ACADEMIC',
    default_frequency: 'MONTHLY',
    is_recurring: true,
  });

  const [structModalVisible, setStructModalVisible] = useState(false);
  const [creatingStruct, setCreatingStruct] = useState(false);
  const [structForm, setStructForm] = useState({
    name: '',
    class_id: '',
    frequency: 'MONTHLY',
    due_date_day: '10',
    publish_status: 'PUBLISHED',
    items: [],
  });

  // Clone Structure Modal State
  const [cloneModalVisible, setCloneModalVisible] = useState(false);
  const [cloneSourceStruct, setCloneSourceStruct] = useState(null);
  const [cloneTargetClassIds, setCloneTargetClassIds] = useState([]);
  const [cloning, setCloning] = useState(false);

  const loadAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [strRes, headRes, clsRes, planRes, concRes] = await Promise.all([
        client.get('/fees-finance/structures', { params: { session } }).catch(() => ({ data: [] })),
        client.get('/fees-finance/heads').catch(() => ({ data: [] })),
        client.get('/principal/classes').catch(() => ({ data: [] })),
        client.get('/fees-finance/payment-plans', { params: { session } }).catch(() => ({ data: [] })),
        client.get('/fees-finance/concessions', { params: { session } }).catch(() => ({ data: [] })),
      ]);

      const sList = Array.isArray(strRes.data) ? strRes.data : strRes.data?.structures || [];
      const hList = Array.isArray(headRes.data) ? headRes.data : headRes.data?.heads || [];
      const cList = Array.isArray(clsRes.data) ? clsRes.data : clsRes.data?.classes || [];
      const pList = Array.isArray(planRes.data) ? planRes.data : planRes.data?.plans || [];
      const concList = Array.isArray(concRes.data) ? concRes.data : concRes.data?.concessions || [];

      setStructures(sList);
      setHeads(hList);
      setClasses(cList);
      setPlans(pList);
      setConcessions(concList);
    } catch (err) {
      console.warn('Failed to load fee setup data:', err?.message);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Create Fee Head Handler
  const handleSaveHead = async () => {
    if (!headForm.name.trim() || !headForm.code.trim()) {
      Alert.alert('Validation Error', 'Please enter both Fee Head Name and unique Code.');
      return;
    }
    setCreatingHead(true);
    try {
      const res = await client.post('/fees-finance/heads', {
        name: headForm.name.trim(),
        code: headForm.code.trim().toUpperCase().replace(/\s+/g, '_'),
        category: headForm.category,
        default_frequency: headForm.default_frequency,
        is_recurring: headForm.is_recurring,
        department: 'ACCOUNTS',
        income_account: 'General School Income',
      });
      if (res.data) {
        Alert.alert('Success', `Fee Head "${headForm.name}" created successfully.`);
        setHeadModalVisible(false);
        setHeadForm({ name: '', code: '', category: 'ACADEMIC', default_frequency: 'MONTHLY', is_recurring: true });
        loadAll(true);
      }
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to create fee head.');
    } finally {
      setCreatingHead(false);
    }
  };

  // Open Add Structure Modal
  const openAddStructureModal = () => {
    const defaultItems = heads.slice(0, 4).map(h => ({
      fee_head_id: h.id,
      head_name: h.name,
      amount: h.code === 'TUITION' ? '2500' : '500',
    }));
    setStructForm({
      name: '',
      class_id: classes[0]?.id ? String(classes[0].id) : '',
      frequency: 'MONTHLY',
      due_date_day: '10',
      publish_status: 'PUBLISHED',
      items: defaultItems,
    });
    setStructModalVisible(true);
  };

  // Save Structure Handler
  const handleSaveStructure = async () => {
    if (!structForm.name.trim()) {
      Alert.alert('Validation Error', 'Please enter a Structure Name (e.g. Standard Monthly Plan).');
      return;
    }
    if (!structForm.class_id) {
      Alert.alert('Validation Error', 'Please select a Class for this structure.');
      return;
    }

    const validItems = structForm.items
      .filter(it => it.fee_head_id && Number(it.amount) > 0)
      .map(it => ({
        fee_head_id: Number(it.fee_head_id),
        amount: parseFloat(it.amount),
      }));

    if (validItems.length === 0) {
      Alert.alert('Validation Error', 'Please assign at least one fee head with an amount greater than 0.');
      return;
    }

    setCreatingStruct(true);
    try {
      const payload = {
        name: structForm.name.trim(),
        class_id: parseInt(structForm.class_id, 10),
        session,
        frequency: structForm.frequency,
        due_date_day: parseInt(structForm.due_date_day || '10', 10),
        publish_status: structForm.publish_status,
        items: validItems,
      };

      const res = await client.post('/fees-finance/structures', payload);
      if (res.data) {
        Alert.alert('Success', `Fee Structure "${structForm.name}" created successfully.`);
        setStructModalVisible(false);
        loadAll(true);
      }
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to create fee structure.');
    } finally {
      setCreatingStruct(false);
    }
  };

  // Toggle Structure Publish Status
  const handleTogglePublish = async (s) => {
    const newStatus = s.publish_status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    try {
      await client.patch(`/fees-finance/structures/${s.id}/publish`, { publish_status: newStatus });
      setStructures(prev => prev.map(item => item.id === s.id ? { ...item, publish_status: newStatus } : item));
    } catch {
      Alert.alert('Error', 'Failed to update structure status.');
    }
  };

  // Open Clone Modal (1:1 with Web ERP)
  const openCloneModal = (struct) => {
    setCloneSourceStruct(struct);
    setCloneTargetClassIds([]);
    setCloneModalVisible(true);
  };

  // Execute Clone Structure
  const handleCloneStructure = async () => {
    if (cloneTargetClassIds.length === 0) {
      Alert.alert('Selection Error', 'Select at least one destination class.');
      return;
    }

    setCloning(true);
    try {
      await client.post(`/fees-finance/structures/${cloneSourceStruct.id}/clone`, {
        target_class_ids: cloneTargetClassIds.map(Number),
        publish_now: true,
      });
      Alert.alert('Success', `Cloned to ${cloneTargetClassIds.length} classes successfully!`);
      setCloneModalVisible(false);
      loadAll(true);
    } catch (err) {
      Alert.alert('Cloning Failed', err.response?.data?.error || 'Could not clone structure.');
    } finally {
      setCloning(false);
    }
  };

  // Delete Structure
  const handleDeleteStructure = (structId) => {
    Alert.alert(
      'Delete Structure',
      'Are you sure you want to delete this fee structure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await client.delete(`/fees-finance/structures/${structId}`);
              Alert.alert('Deleted', 'Fee structure deleted successfully.');
              loadAll(true);
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error || 'Failed to delete fee structure.');
            }
          },
        },
      ]
    );
  };

  // Delete Concession
  const handleDeleteConcession = (concId) => {
    Alert.alert(
      'Remove Concession',
      'Revoke this scholarship / fee waiver record?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            try {
              await client.delete(`/fees-finance/concessions/${concId}`);
              Alert.alert('Revoked', 'Concession record removed.');
              loadAll(true);
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error || 'Failed to remove concession.');
            }
          },
        },
      ]
    );
  };

  // Filtered structures
  const filteredStructures = useMemo(() => {
    return structures.filter(s => {
      if (selectedClassId !== 'ALL' && String(s.class_id) !== String(selectedClassId)) {
        return false;
      }
      return true;
    });
  }, [structures, selectedClassId]);

  // Filtered heads
  const filteredHeads = useMemo(() => {
    if (!searchHead.trim()) return heads;
    const q = searchHead.toLowerCase();
    return heads.filter(h =>
      (h.name && h.name.toLowerCase().includes(q)) ||
      (h.code && h.code.toLowerCase().includes(q)) ||
      (h.category && h.category.toLowerCase().includes(q))
    );
  }, [heads, searchHead]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation?.goBack?.()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Fee Setup & Plans</Text>
          <Text style={styles.headerSubtitle}>Session: {session}</Text>
        </View>
        <TouchableOpacity
          style={styles.headerAddBtn}
          onPress={activeTab === 'heads' ? () => setHeadModalVisible(true) : openAddStructureModal}
        >
          <Ionicons name="add" size={18} color="#ffffff" />
          <Text style={styles.headerAddText}>{activeTab === 'heads' ? 'Head' : '+ Plan'}</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs Bar (4 Tabs: Structures, Heads, Plans, Concessions) */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'structures' && styles.tabBtnActive]}
          onPress={() => setActiveTab('structures')}
        >
          <Text style={[styles.tabBtnText, activeTab === 'structures' && styles.tabBtnTextActive]}>
            Structures ({structures.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'heads' && styles.tabBtnActive]}
          onPress={() => setActiveTab('heads')}
        >
          <Text style={[styles.tabBtnText, activeTab === 'heads' && styles.tabBtnTextActive]}>
            Heads ({heads.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'plans' && styles.tabBtnActive]}
          onPress={() => setActiveTab('plans')}
        >
          <Text style={[styles.tabBtnText, activeTab === 'plans' && styles.tabBtnTextActive]}>
            Plans ({plans.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'concessions' && styles.tabBtnActive]}
          onPress={() => setActiveTab('concessions')}
        >
          <Text style={[styles.tabBtnText, activeTab === 'concessions' && styles.tabBtnTextActive]}>
            Waivers ({concessions.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading fee configurations...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadAll(true)}
              colors={[colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* TAB 1: STRUCTURES */}
          {activeTab === 'structures' && (
            <>
              {/* Class Filter Horizontal Scroll */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.classChipsRow}
              >
                <TouchableOpacity
                  style={[styles.classChip, selectedClassId === 'ALL' && styles.classChipActive]}
                  onPress={() => setSelectedClassId('ALL')}
                >
                  <Text style={[styles.classChipText, selectedClassId === 'ALL' && styles.classChipTextActive]}>
                    All Classes
                  </Text>
                </TouchableOpacity>
                {classes.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.classChip, String(selectedClassId) === String(c.id) && styles.classChipActive]}
                    onPress={() => setSelectedClassId(c.id)}
                  >
                    <Text style={[styles.classChipText, String(selectedClassId) === String(c.id) && styles.classChipTextActive]}>
                      {c.name || `Class ${c.grade_level || c.id}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {filteredStructures.length > 0 ? (
                filteredStructures.map(s => {
                  const items = s.items || s.structure_items || [];
                  const totalAmt = items.reduce((acc, it) => acc + Number(it.amount || 0), 0);
                  const isPublished = s.publish_status === 'PUBLISHED';
                  const clsName = s.class_name || (classes.find(c => c.id === s.class_id)?.name) || 'All Classes';

                  return (
                    <View key={s.id} style={styles.structureCard}>
                      <View style={styles.structHeaderRow}>
                        <View style={{ flex: 1 }}>
                          <View style={styles.titleBadgeRow}>
                            <Text style={styles.structTitle}>{s.name}</Text>
                            <TouchableOpacity
                              onPress={() => handleTogglePublish(s)}
                              style={[styles.statusBadge, { backgroundColor: isPublished ? '#dcfce7' : '#fef3c7' }]}
                            >
                              <Text style={[styles.statusBadgeText, { color: isPublished ? '#15803d' : '#b45309' }]}>
                                {isPublished ? '● PUBLISHED' : '○ DRAFT'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                          <Text style={styles.structSub}>
                            Class: <Text style={{ fontWeight: '700', color: '#1e293b' }}>{clsName}</Text> · {s.frequency || 'MONTHLY'} · Due: Day {s.due_date_day || 10}
                          </Text>
                        </View>
                        <View style={styles.structTotalBox}>
                          <Text style={styles.structTotalLabel}>Total</Text>
                          <Text style={styles.structTotalAmt}>{fmt(totalAmt)}</Text>
                        </View>
                      </View>

                      {/* Items Breakdown */}
                      <View style={styles.structItemsBox}>
                        <Text style={styles.itemsHeading}>FEE HEAD BREAKDOWN</Text>
                        {items.length > 0 ? (
                          items.map((it, idx) => (
                            <View key={it.id || idx} style={styles.itemRow}>
                              <Text style={styles.itemName}>
                                {it.fee_head_name || it.head_name || `Head #${it.fee_head_id}`}
                              </Text>
                              <Text style={styles.itemAmt}>{fmt(it.amount)}</Text>
                            </View>
                          ))
                        ) : (
                          <Text style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
                            No fee items assigned.
                          </Text>
                        )}
                      </View>

                      {/* Structure Action Buttons (Clone & Delete) */}
                      <View style={styles.structActionsRow}>
                        <TouchableOpacity style={styles.cloneBtn} onPress={() => openCloneModal(s)}>
                          <Ionicons name="copy-outline" size={14} color="#0b57d0" />
                          <Text style={styles.cloneBtnText}>Clone to Classes</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.deleteStructBtn} onPress={() => handleDeleteStructure(s.id)}>
                          <Ionicons name="trash-outline" size={14} color="#dc2626" />
                          <Text style={styles.deleteStructBtnText}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={styles.emptyCard}>
                  <Ionicons name="folder-open-outline" size={42} color="#94a3b8" />
                  <Text style={styles.emptyTitle}>No Fee Structures</Text>
                  <Text style={styles.emptySub}>No fee structures found for this filter. Create one to begin monthly billing.</Text>
                  <TouchableOpacity style={styles.emptyActionBtn} onPress={openAddStructureModal}>
                    <Ionicons name="add-circle-outline" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                    <Text style={styles.emptyActionText}>Add Structure</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          {/* TAB 2: FEE HEADS */}
          {activeTab === 'heads' && (
            <>
              <View style={styles.searchBar}>
                <Ionicons name="search-outline" size={18} color="#94a3b8" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search fee head by name, code or category..."
                  placeholderTextColor="#94a3b8"
                  value={searchHead}
                  onChangeText={setSearchHead}
                />
                {searchHead ? (
                  <TouchableOpacity onPress={() => setSearchHead('')}>
                    <Ionicons name="close-circle" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                ) : null}
              </View>

              {filteredHeads.length > 0 ? (
                filteredHeads.map(h => (
                  <View key={h.id} style={styles.headCard}>
                    <View style={styles.headLeftBox}>
                      <View style={[styles.headIconBox, { backgroundColor: h.category === 'TRANSPORT' ? '#ffedd5' : h.category === 'HOSTEL' ? '#ede9fe' : '#e0f2fe' }]}>
                        <Ionicons
                          name={h.category === 'TRANSPORT' ? 'bus-outline' : h.category === 'HOSTEL' ? 'bed-outline' : 'school-outline'}
                          size={20}
                          color={h.category === 'TRANSPORT' ? '#c2410c' : h.category === 'HOSTEL' ? '#6d28d9' : '#0284c7'}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.headName}>{h.name}</Text>
                        <Text style={styles.headCode}>CODE: {h.code} · {h.category}</Text>
                      </View>
                    </View>

                    <View style={styles.headRightBox}>
                      <View style={[styles.pill, { backgroundColor: h.is_recurring ? '#ecfdf5' : '#f1f5f9' }]}>
                        <Text style={[styles.pillText, { color: h.is_recurring ? '#059669' : '#64748b' }]}>
                          {h.is_recurring ? (h.default_frequency || 'RECURRING') : 'ONE-TIME'}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emptyCard}>
                  <Ionicons name="pricetag-outline" size={42} color="#94a3b8" />
                  <Text style={styles.emptyTitle}>No Fee Heads Found</Text>
                  <Text style={styles.emptySub}>Define institutional heads like Tuition, Lab, Library, or Annual charges.</Text>
                </View>
              )}
            </>
          )}

          {/* TAB 3: PAYMENT PLANS */}
          {activeTab === 'plans' && (
            <>
              {plans.length > 0 ? (
                plans.map(p => (
                  <View key={p.id} style={styles.planCard}>
                    <View style={styles.planHeaderRow}>
                      <Text style={styles.planTitle}>{p.name}</Text>
                      <View style={[styles.pill, { backgroundColor: '#eff6ff' }]}>
                        <Text style={[styles.pillText, { color: '#1d4ed8' }]}>
                          {p.discount_value > 0 ? `${p.discount_value}% DISCOUNT` : 'STANDARD'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.planDesc}>
                      {p.description || `Applicable for ${p.months_count || 1} month(s) advance payment.`}
                    </Text>
                    <View style={styles.planFooterRow}>
                      <Text style={styles.planFootMeta}>Duration: {p.months_count || 1} Month(s)</Text>
                      <Text style={styles.planFootStatus}>{p.is_active ? 'Active' : 'Inactive'}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emptyCard}>
                  <Ionicons name="calendar-outline" size={42} color="#94a3b8" />
                  <Text style={styles.emptyTitle}>Standard Monthly Billing</Text>
                  <Text style={styles.emptySub}>Monthly standard invoicing is active by default.</Text>
                </View>
              )}
            </>
          )}

          {/* TAB 4: CONCESSIONS & WAIVERS (PARITY WITH WEB ERP) */}
          {activeTab === 'concessions' && (
            <>
              {concessions.length > 0 ? (
                concessions.map(conc => (
                  <View key={conc.id} style={styles.structureCard}>
                    <View style={styles.structHeaderRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.structTitle}>{conc.student_name || `Student #${conc.student_id}`}</Text>
                        <Text style={styles.structSub}>
                          Type: <Text style={{ fontWeight: '700', color: '#b45309' }}>{conc.concession_type}</Text> · {conc.reason || 'Concession approved'}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.structTotalAmt, { color: '#15803d' }]}>
                          -₹{Number(conc.discount_value || 0).toLocaleString()}
                        </Text>
                        <TouchableOpacity
                          style={{ marginTop: 6, padding: 4 }}
                          onPress={() => handleDeleteConcession(conc.id)}
                        >
                          <Ionicons name="trash-outline" size={16} color="#dc2626" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emptyCard}>
                  <Ionicons name="gift-outline" size={42} color="#94a3b8" />
                  <Text style={styles.emptyTitle}>No Active Scholarships / Waivers</Text>
                  <Text style={styles.emptySub}>Use Collect Payment POS screen to grant instant fee waivers (Maafi) to students.</Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* MODAL 1: CREATE FEE HEAD                        */}
      {/* ═══════════════════════════════════════════════ */}
      <Modal visible={headModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Fee Head</Text>
              <TouchableOpacity onPress={() => setHeadModalVisible(false)}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Fee Head Name *</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="e.g. Science Laboratory Fee"
                placeholderTextColor="#94a3b8"
                value={headForm.name}
                onChangeText={t => setHeadForm(f => ({ ...f, name: t, code: f.code || t.toUpperCase().replace(/\s+/g, '_') }))}
              />

              <Text style={styles.fieldLabel}>Code (Unique Identifier) *</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="e.g. LAB_FEE"
                placeholderTextColor="#94a3b8"
                value={headForm.code}
                onChangeText={t => setHeadForm(f => ({ ...f, code: t.toUpperCase() }))}
                autoCapitalize="characters"
              />

              <Text style={styles.fieldLabel}>Category</Text>
              <View style={styles.chipsSelectorRow}>
                {HEAD_CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.smallChip, headForm.category === cat && styles.smallChipActive]}
                    onPress={() => setHeadForm(f => ({ ...f, category: cat }))}
                  >
                    <Text style={[styles.smallChipText, headForm.category === cat && styles.smallChipTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Default Frequency</Text>
              <View style={styles.chipsSelectorRow}>
                {FREQUENCIES.map(freq => (
                  <TouchableOpacity
                    key={freq}
                    style={[styles.smallChip, headForm.default_frequency === freq && styles.smallChipActive]}
                    onPress={() => setHeadForm(f => ({ ...f, default_frequency: freq }))}
                  >
                    <Text style={[styles.smallChipText, headForm.default_frequency === freq && styles.smallChipTextActive]}>
                      {freq}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={styles.saveSubmitBtn}
                onPress={handleSaveHead}
                disabled={creatingHead}
              >
                {creatingHead ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.saveSubmitBtnText}>Create Fee Head</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════ */}
      {/* MODAL 2: CREATE STRUCTURE                       */}
      {/* ═══════════════════════════════════════════════ */}
      <Modal visible={structModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Fee Structure</Text>
              <TouchableOpacity onPress={() => setStructModalVisible(false)}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Structure Name *</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="e.g. Standard Monthly Structure"
                placeholderTextColor="#94a3b8"
                value={structForm.name}
                onChangeText={t => setStructForm(f => ({ ...f, name: t }))}
              />

              <Text style={styles.fieldLabel}>Class Target *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {classes.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.smallChip, String(structForm.class_id) === String(c.id) && styles.smallChipActive]}
                    onPress={() => setStructForm(f => ({ ...f, class_id: String(c.id) }))}
                  >
                    <Text style={[styles.smallChipText, String(structForm.class_id) === String(c.id) && styles.smallChipTextActive]}>
                      {c.name || `Class ${c.grade_level || c.id}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>Frequency</Text>
              <View style={styles.chipsSelectorRow}>
                {FREQUENCIES.map(freq => (
                  <TouchableOpacity
                    key={freq}
                    style={[styles.smallChip, structForm.frequency === freq && styles.smallChipActive]}
                    onPress={() => setStructForm(f => ({ ...f, frequency: freq }))}
                  >
                    <Text style={[styles.smallChipText, structForm.frequency === freq && styles.smallChipTextActive]}>
                      {freq}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Due Date of Month (e.g. 10)</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="10"
                placeholderTextColor="#94a3b8"
                value={structForm.due_date_day}
                onChangeText={t => setStructForm(f => ({ ...f, due_date_day: t }))}
                keyboardType="numeric"
              />

              <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Fee Head Amounts (₹)</Text>
              {heads.map(h => {
                const currentItem = structForm.items.find(it => it.fee_head_id === h.id);
                const currentAmt = currentItem?.amount || '';

                return (
                  <View key={h.id} style={styles.itemFormRow}>
                    <Text style={styles.itemFormLabel} numberOfLines={1}>{h.name}</Text>
                    <TextInput
                      style={styles.itemFormInput}
                      placeholder="0"
                      placeholderTextColor="#94a3b8"
                      value={currentAmt}
                      onChangeText={val => {
                        setStructForm(f => {
                          const existingIndex = f.items.findIndex(it => it.fee_head_id === h.id);
                          const updated = [...f.items];
                          if (existingIndex >= 0) {
                            if (!val || val === '0') {
                              updated.splice(existingIndex, 1);
                            } else {
                              updated[existingIndex] = { ...updated[existingIndex], amount: val };
                            }
                          } else if (val && val !== '0') {
                            updated.push({ fee_head_id: h.id, head_name: h.name, amount: val });
                          }
                          return { ...f, items: updated };
                        });
                      }}
                      keyboardType="numeric"
                    />
                  </View>
                );
              })}

              <TouchableOpacity
                style={styles.saveSubmitBtn}
                onPress={handleSaveStructure}
                disabled={creatingStruct}
              >
                {creatingStruct ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.saveSubmitBtnText}>Save & Publish Structure</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════ */}
      {/* MODAL 3: CLONE STRUCTURE (1:1 with Web ERP)     */}
      {/* ═══════════════════════════════════════════════ */}
      <Modal visible={cloneModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Clone Structure</Text>
                <Text style={styles.modalSub}>{cloneSourceStruct?.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setCloneModalVisible(false)}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Select Destination Classes *</Text>
              <View style={{ gap: 6, marginBottom: 16 }}>
                {classes.map(c => {
                  const isChecked = cloneTargetClassIds.includes(String(c.id));
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.cloneClassRow, isChecked && styles.cloneClassRowActive]}
                      onPress={() => {
                        const sid = String(c.id);
                        if (isChecked) {
                          setCloneTargetClassIds(prev => prev.filter(x => x !== sid));
                        } else {
                          setCloneTargetClassIds(prev => [...prev, sid]);
                        }
                      }}
                    >
                      <Ionicons
                        name={isChecked ? 'checkbox' : 'square-outline'}
                        size={20}
                        color={isChecked ? colors.primary : '#94a3b8'}
                      />
                      <Text style={[styles.cloneClassText, isChecked && { color: colors.primary, fontWeight: '700' }]}>
                        {c.name} {c.section ? `(${c.section})` : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[styles.saveSubmitBtn, cloning && { opacity: 0.6 }]}
                disabled={cloning}
                onPress={handleCloneStructure}
              >
                {cloning ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.saveSubmitBtnText}>Clone to Selected Classes</Text>
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
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#ffffff' },
  headerSubtitle: { fontSize: 11.5, color: 'rgba(255,255,255,0.8)', marginTop: 1 },
  headerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 18,
    gap: 4,
  },
  headerAddText: { color: '#ffffff', fontSize: 12.5, fontWeight: '700' },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 6,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  tabBtnActive: { backgroundColor: colors.primary },
  tabBtnText: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  tabBtnTextActive: { color: '#ffffff' },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  loadingText: { marginTop: 12, fontSize: 13, color: '#64748b' },
  scrollContent: { padding: 14, paddingBottom: 60 },
  classChipsRow: { gap: 8, paddingBottom: 10 },
  classChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  classChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  classChipText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  classChipTextActive: { color: '#ffffff', fontWeight: '700' },
  structureCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  structHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  titleBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  structTitle: { fontSize: 14.5, fontWeight: '700', color: '#0f172a' },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  statusBadgeText: { fontSize: 10, fontWeight: '800' },
  structSub: { fontSize: 11.5, color: '#64748b', marginTop: 3 },
  structTotalBox: { alignItems: 'flex-end' },
  structTotalLabel: { fontSize: 10, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' },
  structTotalAmt: { fontSize: 15, fontWeight: '800', color: colors.primary, marginTop: 1 },
  structItemsBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  itemsHeading: { fontSize: 10, fontWeight: '800', color: '#94a3b8', marginBottom: 6, letterSpacing: 0.3 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  itemName: { fontSize: 12, color: '#475569' },
  itemAmt: { fontSize: 12, fontWeight: '700', color: '#1e293b' },
  structActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
  },
  cloneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#eff6ff',
  },
  cloneBtnText: { fontSize: 11, fontWeight: '700', color: '#0b57d0' },
  deleteStructBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#fee2e2',
  },
  deleteStructBtnText: { fontSize: 11, fontWeight: '700', color: '#dc2626' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 13, color: '#0f172a' },
  headCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  headLeftBox: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  headIconBox: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  headName: { fontSize: 13.5, fontWeight: '700', color: '#0f172a' },
  headCode: { fontSize: 11, color: '#64748b', marginTop: 1 },
  headRightBox: { alignItems: 'flex-end' },
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  pillText: { fontSize: 10, fontWeight: '800' },
  planCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  planHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  planDesc: { fontSize: 12, color: '#64748b', marginVertical: 8 },
  planFooterRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 8 },
  planFootMeta: { fontSize: 11, color: '#94a3b8' },
  planFootStatus: { fontSize: 11, fontWeight: '700', color: '#16a34a' },
  emptyCard: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginTop: 10 },
  emptySub: { fontSize: 12, color: '#64748b', marginTop: 4, textAlign: 'center', paddingHorizontal: 20 },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    marginTop: 14,
  },
  emptyActionText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#ffffff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  modalSub: { fontSize: 11.5, color: '#64748b', marginTop: 2 },
  fieldLabel: { fontSize: 11, fontWeight: '800', color: '#64748b', marginBottom: 5, textTransform: 'uppercase' },
  fieldInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0f172a',
    marginBottom: 10,
  },
  chipsSelectorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  smallChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  smallChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  smallChipText: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  smallChipTextActive: { color: '#ffffff' },
  itemFormRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  itemFormLabel: { fontSize: 12.5, color: '#334155', flex: 1 },
  itemFormInput: { width: 90, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, fontSize: 13, fontWeight: '700', textAlign: 'right', color: '#0f172a' },
  saveSubmitBtn: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 14, marginBottom: 20 },
  saveSubmitBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  cloneClassRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  cloneClassRowActive: { borderColor: colors.primary, backgroundColor: '#eff6ff' },
  cloneClassText: { fontSize: 13, color: '#334155' },
});
