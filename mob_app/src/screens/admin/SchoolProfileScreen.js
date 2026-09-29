// mob_app/src/screens/admin/SchoolProfileScreen.js
// School Profile & Branch Settings — 100% mirrors Web ERP School Profile & Tenant Management
// Dynamic endpoints: GET /principal/school/settings, PATCH /principal/school/settings, GET /admin/schools

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, TextInput, Modal, Alert, Linking, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';

const BOARDS = ['CBSE', 'ICSE', 'STATE BOARD', 'IB', 'CAMBRIDGE'];

export default function SchoolProfileScreen({ navigation }) {
  const { user } = useAuth();
  const userRole = (user?.role || '').toUpperCase();
  const isSuperAdmin = userRole === 'SUPER_ADMIN';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [school, setSchool] = useState(null);
  const [allSchools, setAllSchools] = useState([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState(null);

  // Edit Profile Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [formName, setFormName] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formState, setFormState] = useState('');
  const [formPincode, setFormPincode] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formWebsite, setFormWebsite] = useState('');
  const [formBoard, setFormBoard] = useState('CBSE');
  const [formEstYear, setFormEstYear] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      if (isSuperAdmin) {
        const res = await client.get('/admin/schools').catch(() => ({ data: [] }));
        const list = Array.isArray(res.data) ? res.data : (res.data?.schools || []);
        setAllSchools(list);
        if (list.length > 0) {
          const currentId = selectedSchoolId || list[0].id;
          const sDetail = list.find(s => s.id === currentId) || list[0];
          setSchool(sDetail);
          setSelectedSchoolId(sDetail.id);
        }
      } else {
        const res = await client.get('/principal/school/settings').catch(() => ({ data: null }));
        if (res.data) {
          setSchool(res.data);
        } else if (user?.school) {
          setSchool(user.school);
        }
      }
    } catch {
      if (user?.school) setSchool(user.school);
    } finally {
      if (isRefresh) setRefreshing(false);
      setLoading(false);
    }
  }, [isSuperAdmin, selectedSchoolId, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Edit Modal
  const openEdit = () => {
    if (!school) return;
    setFormName(school.name || '');
    setFormAddress(school.address || '');
    setFormCity(school.city || '');
    setFormState(school.state || '');
    setFormPincode(school.pincode || '');
    setFormPhone(school.phone || '');
    setFormEmail(school.email || '');
    setFormWebsite(school.website || '');
    setFormBoard(school.affiliation_board || 'CBSE');
    setFormEstYear(school.established_year ? String(school.established_year) : '');
    setShowEditModal(true);
  };

  // Save School Settings
  const handleSaveProfile = async () => {
    if (!formName.trim()) {
      Alert.alert('Required Field', 'School/Institution Name is required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        address: formAddress.trim(),
        city: formCity.trim(),
        state: formState.trim(),
        pincode: formPincode.trim(),
        phone: formPhone.trim(),
        email: formEmail.trim(),
        website: formWebsite.trim(),
        affiliation_board: formBoard.trim(),
        established_year: formEstYear ? parseInt(formEstYear, 10) : undefined,
      };

      if (isSuperAdmin && school?.id) {
        await client.put(`/admin/schools/${school.id}`, payload);
      } else {
        await client.patch('/principal/school/settings', payload);
      }

      Alert.alert('Success', 'Institutional profile updated successfully.');
      setShowEditModal(false);
      loadData();
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to update school profile';
      Alert.alert('Update Failed', msg);
    } finally {
      setSaving(false);
    }
  };

  const getPlanBadge = (plan) => {
    const p = (plan || 'BASIC').toUpperCase();
    if (p === 'ENTERPRISE') return { bg: '#ede9fe', text: '#7c3aed', border: '#ddd6fe' };
    if (p === 'PROFESSIONAL') return { bg: '#e0f2fe', text: '#0284c7', border: '#bae6fd' };
    return { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' };
  };

  const planStyle = getPlanBadge(school?.plan);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header Bar */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation?.goBack?.()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>School Profile & Branches</Text>
            <Text style={styles.headerSubtitle}>Accreditation, branding & campus profile</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.editHeaderBtn} onPress={openEdit}>
          <Ionicons name="create-outline" size={16} color="#fff" />
          <Text style={styles.editHeaderBtnText}>Edit</Text>
        </TouchableOpacity>
      </View>

      {/* System Administration Navigation Ribbon */}
      <View style={styles.serviceNavStrip}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 12 }}>
          <TouchableOpacity style={styles.serviceNavTab} onPress={() => navigation.navigate('AuditLogs')}>
            <Ionicons name="shield-checkmark" size={14} color="#64748b" />
            <Text style={styles.serviceNavText}>Audit Logs</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.serviceNavTab} onPress={() => navigation.navigate('Roles')}>
            <Ionicons name="key" size={14} color="#64748b" />
            <Text style={styles.serviceNavText}>Roles & RBAC</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.serviceNavTab, styles.serviceNavTabActive]} onPress={() => {}}>
            <Ionicons name="business" size={14} color="#0b57d0" />
            <Text style={[styles.serviceNavText, styles.serviceNavTextActive]}>School & Branches</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.serviceNavTab} onPress={() => navigation.navigate('SessionManager')}>
            <Ionicons name="calendar" size={14} color="#64748b" />
            <Text style={styles.serviceNavText}>Sessions & Terms</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Super Admin Multi-Branch Switcher */}
      {isSuperAdmin && allSchools.length > 1 && (
        <View style={styles.branchSelectorStrip}>
          <Text style={styles.branchLabel}>Tenant Branches:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {allSchools.map(s => {
              const active = s.id === school?.id;
              return (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.branchPill, active && styles.branchPillActive]}
                  onPress={() => {
                    setSelectedSchoolId(s.id);
                    setSchool(s);
                  }}
                >
                  <Text style={[styles.branchPillText, active && styles.branchPillTextActive]}>
                    {s.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} colors={[colors.primary]} />}
      >
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading institutional profile...</Text>
          </View>
        ) : (
          <>
            {/* HERO PROFILE CARD */}
            <View style={styles.heroCard}>
              <View style={styles.heroTop}>
                {school?.logo_url ? (
                  <Image source={{ uri: school.logo_url }} style={styles.logoImage} />
                ) : (
                  <View style={styles.logoPlaceholder}>
                    <Ionicons name="school" size={32} color="#0b57d0" />
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={styles.schoolName}>{school?.name || 'Institutional Campus'}</Text>
                  <View style={styles.codeRow}>
                    <Text style={styles.schoolCode}>Code: {school?.code || 'SCH-001'}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: school?.is_active !== false ? '#dcfce7' : '#fee2e2' }]}>
                      <Text style={[styles.statusBadgeText, { color: school?.is_active !== false ? '#16a34a' : '#dc2626' }]}>
                        {school?.is_active !== false ? 'ACTIVE' : 'INACTIVE'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.heroDivider} />

              <View style={styles.heroStatsRow}>
                <View style={styles.heroStatItem}>
                  <Text style={styles.heroStatVal}>{school?.affiliation_board || 'CBSE'}</Text>
                  <Text style={styles.heroStatLbl}>Board / Affiliation</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStatItem}>
                  <Text style={styles.heroStatVal}>{school?.current_session || '2024-25'}</Text>
                  <Text style={styles.heroStatLbl}>Academic Session</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStatItem}>
                  <Text style={[styles.heroStatVal, { color: planStyle.text }]}>{school?.plan || 'BASIC'}</Text>
                  <Text style={styles.heroStatLbl}>SaaS Plan</Text>
                </View>
              </View>
            </View>

            {/* CONTACT & LOCATION CARD */}
            <View style={styles.infoCard}>
              <View style={styles.cardHeaderRow}>
                <Ionicons name="location-outline" size={18} color="#0b57d0" />
                <Text style={styles.cardTitle}>Campus Location & Communication</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Campus Address</Text>
                <Text style={styles.detailValue}>{school?.address || 'Main Campus'}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>City, State & PIN</Text>
                <Text style={styles.detailValue}>
                  {[school?.city, school?.state, school?.pincode].filter(Boolean).join(', ') || '—'}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Official Phone</Text>
                <TouchableOpacity onPress={() => school?.phone && Linking.openURL(`tel:${school.phone}`)}>
                  <Text style={[styles.detailValue, { color: '#0b57d0' }]}>{school?.phone || '—'}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Institutional Email</Text>
                <TouchableOpacity onPress={() => school?.email && Linking.openURL(`mailto:${school.email}`)}>
                  <Text style={[styles.detailValue, { color: '#0b57d0' }]}>{school?.email || '—'}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Official Portal</Text>
                <TouchableOpacity onPress={() => school?.website && Linking.openURL(school.website.startsWith('http') ? school.website : `https://${school.website}`)}>
                  <Text style={[styles.detailValue, { color: '#0b57d0' }]} numberOfLines={1}>{school?.website || '—'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* DIGITAL SIGNATURES & VERIFICATION CARD */}
            <View style={styles.infoCard}>
              <View style={styles.cardHeaderRow}>
                <Ionicons name="ribbon-outline" size={18} color="#7c3aed" />
                <Text style={styles.cardTitle}>Digital Signatures & Credentials</Text>
              </View>

              <View style={styles.sigRow}>
                <View style={styles.sigBox}>
                  <Text style={styles.sigLabel}>Principal Signature</Text>
                  {school?.principal_signature_url ? (
                    <View style={styles.sigBadgeUploaded}>
                      <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
                      <Text style={styles.sigBadgeUploadedText}>Verified Active</Text>
                    </View>
                  ) : (
                    <View style={styles.sigBadgePending}>
                      <Ionicons name="time-outline" size={14} color="#d97706" />
                      <Text style={styles.sigBadgePendingText}>Not Uploaded</Text>
                    </View>
                  )}
                  <Text style={styles.sigDesc}>Embedded on Admit Cards & RMS Marksheets</Text>
                </View>

                <View style={styles.sigBox}>
                  <Text style={styles.sigLabel}>Director / Trustee</Text>
                  {school?.director_signature_url ? (
                    <View style={styles.sigBadgeUploaded}>
                      <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
                      <Text style={styles.sigBadgeUploadedText}>Verified Active</Text>
                    </View>
                  ) : (
                    <View style={styles.sigBadgePending}>
                      <Ionicons name="time-outline" size={14} color="#d97706" />
                      <Text style={styles.sigBadgePendingText}>Not Uploaded</Text>
                    </View>
                  )}
                  <Text style={styles.sigDesc}>Embedded on Formal Certificates & TC</Text>
                </View>
              </View>
            </View>

            {/* QUICK ACTIONS ROW */}
            <View style={styles.quickActionsRow}>
              <TouchableOpacity
                style={styles.actionCardBtn}
                onPress={() => navigation?.navigate?.('SessionManager')}
              >
                <Ionicons name="calendar-outline" size={22} color="#0d9488" />
                <Text style={styles.actionCardTitle}>Academic Sessions</Text>
                <Text style={styles.actionCardDesc}>Terms & Year Switcher</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionCardBtn}
                onPress={() => navigation?.navigate?.('Roles')}
              >
                <Ionicons name="key-outline" size={22} color="#4338ca" />
                <Text style={styles.actionCardTitle}>RBAC Matrix</Text>
                <Text style={styles.actionCardDesc}>Manage Permissions</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      {/* EDIT PROFILE MODAL */}
      <Modal visible={showEditModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>Edit Institutional Profile</Text>
                <Text style={styles.modalSub}>Update address, contact & accreditation</Text>
              </View>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close-circle-outline" size={26} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              <Text style={styles.formLabel}>School / Campus Name *</Text>
              <TextInput style={styles.formInput} value={formName} onChangeText={setFormName} />

              <Text style={styles.formLabel}>Affiliation Board *</Text>
              <View style={styles.boardChipRow}>
                {BOARDS.map(b => (
                  <TouchableOpacity
                    key={b}
                    style={[styles.boardChip, formBoard === b && styles.boardChipActive]}
                    onPress={() => setFormBoard(b)}
                  >
                    <Text style={[styles.boardChipText, formBoard === b && styles.boardChipTextActive]}>{b}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>Campus Address</Text>
              <TextInput style={styles.formInput} value={formAddress} onChangeText={setFormAddress} />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>City</Text>
                  <TextInput style={styles.formInput} value={formCity} onChangeText={setFormCity} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>State</Text>
                  <TextInput style={styles.formInput} value={formState} onChangeText={setFormState} />
                </View>
                <View style={{ width: 80 }}>
                  <Text style={styles.formLabel}>PIN</Text>
                  <TextInput style={styles.formInput} value={formPincode} onChangeText={setFormPincode} keyboardType="numeric" />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Phone</Text>
                  <TextInput style={styles.formInput} value={formPhone} onChangeText={setFormPhone} keyboardType="phone-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Est. Year</Text>
                  <TextInput style={styles.formInput} value={formEstYear} onChangeText={setFormEstYear} keyboardType="numeric" placeholder="e.g. 1998" />
                </View>
              </View>

              <Text style={styles.formLabel}>Official Email</Text>
              <TextInput style={styles.formInput} value={formEmail} onChangeText={setFormEmail} keyboardType="email-address" autoCapitalize="none" />

              <Text style={styles.formLabel}>Website URL</Text>
              <TextInput style={styles.formInput} value={formWebsite} onChangeText={setFormWebsite} autoCapitalize="none" placeholder="https://..." />

              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSaveProfile}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Profile Changes</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { marginRight: 10, padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  headerSubtitle: { fontSize: 11, color: colors.textMuted },
  editHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0b57d0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editHeaderBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
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
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  serviceNavText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  serviceNavTextActive: {
    color: '#0b57d0',
    fontWeight: '700',
  },
  branchSelectorStrip: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  branchLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', marginBottom: 4 },
  branchPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  branchPillActive: {
    backgroundColor: '#0b57d0',
    borderColor: '#0b57d0',
  },
  branchPillText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  branchPillTextActive: { color: '#fff', fontWeight: '700' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  loadingText: { marginTop: 10, fontSize: 13, color: '#64748b' },
  heroCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
    elevation: 1,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center' },
  logoImage: { width: 56, height: 56, borderRadius: 12, resizeMode: 'cover' },
  logoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  schoolName: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  schoolCode: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  statusBadgeText: { fontSize: 10, fontWeight: '800' },
  heroDivider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 14 },
  heroStatsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  heroStatItem: { alignItems: 'center' },
  heroStatVal: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  heroStatLbl: { fontSize: 10.5, color: '#64748b', marginTop: 2 },
  heroStatDivider: { width: 1, height: 24, backgroundColor: '#e2e8f0' },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  cardTitle: { fontSize: 13.5, fontWeight: '700', color: '#0f172a' },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  detailLabel: { fontSize: 12, color: '#64748b' },
  detailValue: { fontSize: 12.5, fontWeight: '600', color: '#0f172a', textAlign: 'right', flex: 1, marginLeft: 16 },
  sigRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  sigBox: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sigLabel: { fontSize: 12, fontWeight: '700', color: '#0f172a', marginBottom: 6 },
  sigBadgeUploaded: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  sigBadgeUploadedText: { fontSize: 11, fontWeight: '700', color: '#16a34a' },
  sigBadgePending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  sigBadgePendingText: { fontSize: 11, fontWeight: '700', color: '#d97706' },
  sigDesc: { fontSize: 10.5, color: '#94a3b8', lineHeight: 14 },
  quickActionsRow: { flexDirection: 'row', gap: 10 },
  actionCardBtn: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  actionCardTitle: { fontSize: 13, fontWeight: '700', color: '#0f172a', marginTop: 8 },
  actionCardDesc: { fontSize: 11, color: '#64748b', marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  modalSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  formLabel: { fontSize: 12, fontWeight: '700', color: '#334155', marginTop: 10, marginBottom: 4 },
  formInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0f172a',
  },
  boardChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  boardChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  boardChipActive: { backgroundColor: '#0b57d0', borderColor: '#0b57d0' },
  boardChipText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  boardChipTextActive: { color: '#fff' },
  saveBtn: {
    backgroundColor: '#0b57d0',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
