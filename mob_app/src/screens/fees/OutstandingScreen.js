// mob_app/src/screens/fees/OutstandingScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TextInput, TouchableOpacity, Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';

const fmt = v => {
  if (v == null || isNaN(v)) return '₹ 0';
  return `₹ ${Number(v).toLocaleString('en-IN')}`;
};

export default function OutstandingScreen({ navigation }) {
  const [records, setRecords] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [outRes, clsRes] = await Promise.all([
        client.get('/fees-finance/outstanding').catch(() =>
          client.get('/principal/fees/records', { params: { status: 'UNPAID' } }).catch(() => ({ data: [] }))
        ),
        client.get('/principal/classes').catch(() => ({ data: [] })),
      ]);

      const oList = Array.isArray(outRes.data)
        ? outRes.data
        : outRes.data?.records || outRes.data?.defaulters || outRes.data?.data || [];
      setRecords(oList);

      const cList = Array.isArray(clsRes.data) ? clsRes.data : clsRes.data?.classes || [];
      setClasses(cList);
    } catch (err) {
      console.warn('Failed to load outstanding dues:', err?.message);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered defaulter list
  const filtered = useMemo(() => {
    return records.filter(r => {
      // Class filter
      if (selectedClassId !== 'ALL') {
        const matchesClass = String(r.class_id) === String(selectedClassId) ||
          (r.class_name && r.class_name.toLowerCase().includes(String(selectedClassId).toLowerCase()));
        if (!matchesClass) return false;
      }

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const sName = (r.student_name || r.name || '').toLowerCase();
        const adm = (r.admission_no || r.roll_no || '').toLowerCase();
        const cName = (r.class_name || '').toLowerCase();
        return sName.includes(q) || adm.includes(q) || cName.includes(q);
      }

      return true;
    });
  }, [records, selectedClassId, search]);

  const totalOutstanding = filtered.reduce((sum, r) => {
    const due = Number(r.balance ?? (Number(r.amount_due || 0) - Number(r.amount_paid || 0)));
    return sum + (due > 0 ? due : 0);
  }, 0);

  // Send WhatsApp Reminder to single parent
  const handleSendSingleWhatsApp = (r) => {
    const sName = r.student_name || r.name || 'Student';
    const due = Number(r.balance ?? (Number(r.amount_due || 0) - Number(r.amount_paid || 0)));
    const phone = r.parent_phone || r.phone;

    const msg = `Dear Parent, this is a reminder from the School Accounts Office regarding pending institutional fees of ${fmt(due)} for ${sName} (Class ${r.class_name || '—'}). Kindly clear the dues at your earliest convenience.`;

    const url = phone
      ? `whatsapp://send?phone=${phone.replace(/\D/g, '')}&text=${encodeURIComponent(msg)}`
      : `whatsapp://send?text=${encodeURIComponent(msg)}`;

    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://wa.me/?text=${encodeURIComponent(msg)}`).catch(() => {
        Alert.alert('Notice', 'Could not open WhatsApp on this device.');
      });
    });
  };

  // Call Parent Phone
  const handleCallParent = (phone) => {
    if (!phone) {
      Alert.alert('No Contact', 'No parent phone number on file for this student.');
      return;
    }
    Linking.openURL(`tel:${phone.replace(/\D/g, '')}`).catch(() => {
      Alert.alert('Error', 'Unable to initiate phone call.');
    });
  };

  // Quick Collect Payment
  const handleQuickCollect = (r) => {
    const studentObj = {
      id: r.student_id || r.id,
      name: r.student_name || r.name,
      student_name: r.student_name || r.name,
      admission_no: r.admission_no,
      class_name: r.class_name,
    };
    navigation.navigate('FeeCollect', { student: studentObj });
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
          <Text style={styles.headerTitle}>Outstanding Defaulters</Text>
          <Text style={styles.headerSubtitle}>
            {filtered.length} Defaulters · Total {fmt(totalOutstanding)}
          </Text>
        </View>
      </View>

      {/* Search Input Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Filter by student name, roll or class..."
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

      {/* Class Selector Filter Chips */}
      <View style={{ backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
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
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#d97706" />
          <Text style={styles.loadingText}>Fetching defaulter accounts...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadData(true)}
              colors={['#d97706']}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {filtered.length > 0 ? (
            filtered.map((r, i) => {
              const due = Number(r.balance ?? (Number(r.amount_due || 0) - Number(r.amount_paid || 0)));
              const parentPhone = r.parent_phone || r.phone;

              return (
                <View key={r.id || i} style={styles.card}>
                  <View style={styles.cardTopRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.studentName}>{r.student_name || r.name || 'Student'}</Text>
                      <Text style={styles.studentMeta}>
                        Adm #{r.admission_no || '—'} · Class {r.class_name || '—'}
                      </Text>
                      <Text style={styles.feeHeadMeta}>
                        Billing Month: {r.month || r.session || 'Current Academic Session'}
                      </Text>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.dueAmount}>{fmt(due)}</Text>
                      <View style={styles.overdueBadge}>
                        <Text style={styles.overdueBadgeText}>OVERDUE</Text>
                      </View>
                    </View>
                  </View>

                  {/* Action Buttons Row */}
                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={styles.actionBtnCollect}
                      onPress={() => handleQuickCollect(r)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="card-outline" size={15} color="#ffffff" />
                      <Text style={styles.actionBtnCollectText}>Collect</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionBtnWhatsApp}
                      onPress={() => handleSendSingleWhatsApp(r)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="logo-whatsapp" size={15} color="#16a34a" />
                      <Text style={styles.actionBtnWhatsAppText}>Reminder</Text>
                    </TouchableOpacity>

                    {parentPhone ? (
                      <TouchableOpacity
                        style={styles.actionBtnCall}
                        onPress={() => handleCallParent(parentPhone)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="call-outline" size={15} color="#0284c7" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="checkmark-circle-outline" size={48} color="#16a34a" />
              <Text style={styles.emptyTitle}>Zero Outstanding Defaulters</Text>
              <Text style={styles.emptySub}>
                All student dues for this class filter are completely cleared.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#d97706',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1e293b',
  },
  classChipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  classChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  classChipActive: {
    backgroundColor: '#d97706',
    borderColor: '#d97706',
  },
  classChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  classChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  studentName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#1e293b',
  },
  studentMeta: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  feeHeadMeta: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  dueAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#dc2626',
  },
  overdueBadge: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  overdueBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#b91c1c',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  actionBtnCollect: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  actionBtnCollectText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtnWhatsApp: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  actionBtnWhatsAppText: {
    color: '#16a34a',
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtnCall: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e0f2fe',
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 36,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12.5,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
  },
});
