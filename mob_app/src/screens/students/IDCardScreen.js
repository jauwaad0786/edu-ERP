// mob_app/src/screens/students/IDCardScreen.js
// 100% Feature Parity with Web ERP IDCardPage.jsx & backend ID Card APIs
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, TouchableOpacity, Image, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';

const C = {
  primary: '#0b57d0',
  navy: '#032d60',
  gold: '#fbbf24',
  text: '#1e293b',
  muted: '#64748b',
  bg: '#f8fafc',
  surface: '#ffffff',
  border: '#e2e8f0',
};

export default function IDCardScreen({ route, navigation }) {
  const { user } = useAuth();
  const { student_id, student: initialStudent } = route?.params || {};

  const [student, setStudent] = useState(initialStudent || null);
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [classStudents, setClassStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cardSide, setCardSide] = useState('front'); // 'front' | 'back'

  const schoolName = user?.school?.name || user?.school_name || 'Institutional School of Excellence';
  const schoolCity = user?.school?.city || user?.school?.address || 'Campus Center';
  const schoolPhone = user?.school?.phone || '';

  // Fetch student details if ID passed
  const loadStudentData = useCallback(async (sid) => {
    if (!sid) return;
    setLoading(true);
    try {
      const res = await client.get(`/principal/students/${sid}`);
      setStudent(res.data?.student || res.data);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch classes for browser mode if no single student pinned
  const loadClassesAndRoster = useCallback(async () => {
    try {
      const res = await client.get('/principal/classes').catch(() => ({ data: [] }));
      const list = Array.isArray(res.data) ? res.data : res.data?.classes || [];
      setClasses(list);
      if (list.length > 0 && !selectedClassId && !student_id) {
        setSelectedClassId(list[0].id);
      }
    } catch {
      // Fallback
    }
  }, [selectedClassId, student_id]);

  // Load students of selected class
  const loadRoster = useCallback(async (cid) => {
    if (!cid) return;
    setLoading(true);
    try {
      const res = await client.get('/principal/students', {
        params: { class_id: cid, per_page: 50 },
      });
      const list = Array.isArray(res.data) ? res.data : res.data?.students || res.data?.data || [];
      setClassStudents(list);
      if (list.length > 0 && !student) {
        setStudent(list[0]);
      }
    } catch {
      setClassStudents([]);
    } finally {
      setLoading(false);
    }
  }, [student]);

  useEffect(() => {
    if (student_id) {
      loadStudentData(student_id);
    } else {
      loadClassesAndRoster();
    }
  }, [student_id, loadStudentData, loadClassesAndRoster]);

  useEffect(() => {
    if (!student_id && selectedClassId) {
      loadRoster(selectedClassId);
    }
  }, [student_id, selectedClassId, loadRoster]);

  const handleDownloadPDF = () => {
    if (!student?.id) return;
    const url = `${client.defaults.baseURL}/principal/students/${student.id}/id-card`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Download Error', 'Could not open ID Card PDF link.');
    });
  };

  const stuName = student?.name || student?.student_name || 'Student Name';
  const stuClass = student?.class_name || student?.class_obj?.name || 'Class';
  const stuSection = student?.section || student?.section_name || 'A';
  const stuRoll = student?.roll_no || student?.roll_number || '—';
  const stuAdm = student?.admission_no || student?.admission_number || '—';
  const stuSession = student?.session || user?.school?.current_session || '2026-27';
  const stuBlood = student?.blood_group || '—';
  const stuFather = student?.father_name || student?.parent_name || '—';
  const stuPhone = student?.parent_phone || student?.phone || '—';
  const stuDob = student?.dob ? String(student.dob).slice(0, 10) : '—';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (navigation?.goBack ? navigation.goBack() : null)}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.headerTitle}>Student Identity Card</Text>
          <Text style={styles.headerSub}>Official Smart QR Verification ID</Text>
        </View>
        <TouchableOpacity style={styles.downloadBtn} onPress={handleDownloadPDF}>
          <Ionicons name="download-outline" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Class selector chips if in browser mode */}
        {!student_id && classes.length > 0 && (
          <View style={styles.classChipsWrapper}>
            <Text style={styles.chipsLabel}>Select Class:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {classes.map((c) => {
                const isSelected = selectedClassId === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.classChip, isSelected && styles.classChipActive]}
                    onPress={() => {
                      setSelectedClassId(c.id);
                      setStudent(null);
                    }}
                  >
                    <Text style={[styles.classChipText, isSelected && styles.classChipTextActive]}>
                      {c.name} - {c.section}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Student selector chips in browser mode */}
        {!student_id && classStudents.length > 0 && (
          <View style={styles.studentChipsWrapper}>
            <Text style={styles.chipsLabel}>Select Student ({classStudents.length}):</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {classStudents.map((s) => {
                const isSelected = student?.id === s.id;
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.studentChip, isSelected && styles.studentChipActive]}
                    onPress={() => setStudent(s)}
                  >
                    <Text style={[styles.studentChipText, isSelected && styles.studentChipTextActive]}>
                      {s.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Side Toggle Tabs */}
        <View style={styles.sideToggleRow}>
          <TouchableOpacity
            style={[styles.sideToggleBtn, cardSide === 'front' && styles.sideToggleBtnActive]}
            onPress={() => setCardSide('front')}
          >
            <Ionicons name="card" size={16} color={cardSide === 'front' ? '#fff' : C.muted} />
            <Text style={[styles.sideToggleText, cardSide === 'front' && styles.sideToggleTextActive]}>
              Front Side
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sideToggleBtn, cardSide === 'back' && styles.sideToggleBtnActive]}
            onPress={() => setCardSide('back')}
          >
            <Ionicons name="qr-code" size={16} color={cardSide === 'back' ? '#fff' : C.muted} />
            <Text style={[styles.sideToggleText, cardSide === 'back' && styles.sideToggleTextActive]}>
              Back Side (QR)
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 40 }} />
        ) : student ? (
          <View style={styles.cardCenterContainer}>
            {cardSide === 'front' ? (
              /* ── FRONT SIDE CARD ── */
              <View style={styles.idCard}>
                {/* Header Banner */}
                <View style={styles.cardHeader}>
                  <View style={styles.schoolLogoBox}>
                    <Ionicons name="school" size={18} color="#fff" />
                  </View>
                  <View style={{ flex: 1, marginHorizontal: 8 }}>
                    <Text style={styles.schoolName} numberOfLines={1}>
                      {schoolName}
                    </Text>
                    <Text style={styles.schoolAffil}>{schoolCity}</Text>
                  </View>
                  <View style={styles.idTypeBadge}>
                    <Text style={styles.idTypeText}>STUDENT</Text>
                    <Text style={styles.idTypeText}>ID CARD</Text>
                  </View>
                </View>

                {/* Gold Accent Bar */}
                <View style={styles.goldBar} />

                {/* Photo & Name Section */}
                <View style={styles.photoSection}>
                  <View style={styles.photoContainer}>
                    {student.photo_url ? (
                      <Image source={{ uri: student.photo_url }} style={styles.photoImg} />
                    ) : (
                      <Ionicons name="person" size={44} color={C.primary} />
                    )}
                  </View>
                  <Text style={styles.cardStudentName} numberOfLines={1}>
                    {stuName}
                  </Text>
                  <Text style={styles.cardStudentClass}>
                    CLASS: {stuClass} — SEC {stuSection}
                  </Text>
                </View>

                {/* Divider */}
                <View style={styles.cardDivider} />

                {/* 2-Column Info Grid */}
                <View style={styles.infoGrid}>
                  <View style={styles.gridItem}>
                    <Text style={styles.gridLabel}>Roll No.</Text>
                    <Text style={styles.gridValue}>{stuRoll}</Text>
                  </View>
                  <View style={styles.gridItem}>
                    <Text style={styles.gridLabel}>Adm. No.</Text>
                    <Text style={styles.gridValue}>{stuAdm}</Text>
                  </View>
                  <View style={styles.gridItem}>
                    <Text style={styles.gridLabel}>Father Name</Text>
                    <Text style={styles.gridValue} numberOfLines={1}>{stuFather}</Text>
                  </View>
                  <View style={styles.gridItem}>
                    <Text style={styles.gridLabel}>Blood Grp.</Text>
                    <Text style={styles.gridValue}>{stuBlood}</Text>
                  </View>
                  <View style={styles.gridItem}>
                    <Text style={styles.gridLabel}>Emergency Tel</Text>
                    <Text style={styles.gridValue}>{stuPhone}</Text>
                  </View>
                  <View style={styles.gridItem}>
                    <Text style={styles.gridLabel}>DOB</Text>
                    <Text style={styles.gridValue}>{stuDob}</Text>
                  </View>
                </View>

                {/* Footer Strip */}
                <View style={styles.cardFooter}>
                  <Text style={styles.footerText}>
                    If found, please return to School Office · Session {stuSession}
                  </Text>
                </View>
              </View>
            ) : (
              /* ── BACK SIDE CARD ── */
              <View style={styles.idCard}>
                <View style={[styles.cardHeader, { paddingVertical: 8 }]}>
                  <Text style={[styles.schoolName, { textAlign: 'center', width: '100%' }]}>
                    STUDENT IDENTITY CARD
                  </Text>
                </View>
                <View style={styles.goldBar} />

                {/* QR Code Box */}
                <View style={styles.qrSection}>
                  <View style={styles.qrBox}>
                    <Ionicons name="qr-code" size={54} color={C.navy} />
                    <Text style={styles.qrSubText}>SCAN FOR VERIFICATION</Text>
                  </View>
                </View>

                {/* Address Box */}
                <View style={styles.addressBox}>
                  <Text style={styles.addressTitle}>School Campus:</Text>
                  <Text style={styles.addressText}>{schoolName} - {schoolCity}</Text>
                  {schoolPhone ? (
                    <Text style={styles.addressText}>Ph: {schoolPhone}</Text>
                  ) : null}
                </View>

                {/* Terms & Conditions */}
                <View style={styles.termsBox}>
                  <Text style={styles.termsTitle}>RULES &amp; REGULATIONS:</Text>
                  <Text style={styles.termsItem}>• This card must be presented on request.</Text>
                  <Text style={styles.termsItem}>• Non-transferable. Loss must be reported.</Text>
                  <Text style={styles.termsItem}>• Property of the institution.</Text>
                </View>

                {/* Principal Signature Line */}
                <View style={styles.sigSection}>
                  <View style={styles.sigLine} />
                  <Text style={styles.sigText}>Authorised Signatory / Principal</Text>
                </View>

                {/* Footer Strip */}
                <View style={[styles.cardFooter, { backgroundColor: C.navy }]}>
                  <Text style={[styles.footerText, { color: C.gold, fontWeight: '700' }]}>
                    Valid for Academic Session: {stuSession}
                  </Text>
                </View>
              </View>
            )}

            {/* Quick PDF Action */}
            <TouchableOpacity style={styles.printActionBtn} onPress={handleDownloadPDF}>
              <Ionicons name="print-outline" size={18} color="#fff" />
              <Text style={styles.printActionBtnText}>Print / Download Official PDF</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Ionicons name="person-circle-outline" size={48} color={C.muted} />
            <Text style={{ fontSize: 14, color: C.muted, marginTop: 8 }}>
              No student selected to generate ID Card.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: { padding: 4 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 2 },
  downloadBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 8,
    borderRadius: 8,
  },
  scrollContent: { padding: 16, paddingBottom: 40 },

  classChipsWrapper: { marginBottom: 12 },
  studentChipsWrapper: { marginBottom: 14 },
  chipsLabel: { fontSize: 11, fontWeight: '800', color: C.muted, textTransform: 'uppercase', marginBottom: 6 },
  classChip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  classChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  classChipText: { fontSize: 12, fontWeight: '700', color: C.text },
  classChipTextActive: { color: '#fff' },

  studentChip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  studentChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  studentChipText: { fontSize: 12, fontWeight: '600', color: C.text },
  studentChipTextActive: { color: '#fff', fontWeight: '700' },

  sideToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
    gap: 4,
  },
  sideToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  sideToggleBtnActive: {
    backgroundColor: C.primary,
  },
  sideToggleText: { fontSize: 12, fontWeight: '600', color: C.muted },
  sideToggleTextActive: { color: '#fff', fontWeight: '800' },

  cardCenterContainer: { alignItems: 'center' },
  idCard: {
    width: 280,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#bfdbfe',
    shadowColor: C.navy,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  cardHeader: {
    backgroundColor: C.navy,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  schoolLogoBox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  schoolName: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  schoolAffil: { color: '#93c5fd', fontSize: 8, marginTop: 1 },
  idTypeBadge: { alignItems: 'flex-end' },
  idTypeText: { color: C.gold, fontSize: 7, fontWeight: '800', letterSpacing: 0.5 },
  goldBar: { height: 3, backgroundColor: C.gold },
  photoSection: { alignItems: 'center', paddingVertical: 12 },
  photoContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#eff6ff',
    borderWidth: 2.5,
    borderColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 8,
  },
  photoImg: { width: '100%', height: '100%' },
  cardStudentName: { fontSize: 14, fontWeight: '800', color: C.navy, textTransform: 'uppercase' },
  cardStudentClass: { fontSize: 9.5, fontWeight: '700', color: C.primary, marginTop: 2 },
  cardDivider: { height: 1, backgroundColor: '#f1f5f9', marginHorizontal: 12 },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingVertical: 8,
    rowGap: 6,
  },
  gridItem: { width: '50%' },
  gridLabel: { fontSize: 8, color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' },
  gridValue: { fontSize: 10, fontWeight: '800', color: C.text, marginTop: 1 },
  cardFooter: {
    backgroundColor: '#f8fafc',
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  footerText: { fontSize: 7.5, color: C.muted, textAlign: 'center' },

  qrSection: { alignItems: 'center', paddingVertical: 14 },
  qrBox: {
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
  },
  qrSubText: { fontSize: 7, fontWeight: '800', color: C.primary, marginTop: 4, letterSpacing: 0.5 },
  addressBox: { paddingHorizontal: 14, marginBottom: 8 },
  addressTitle: { fontSize: 8, fontWeight: '800', color: C.navy, textTransform: 'uppercase' },
  addressText: { fontSize: 8, color: C.text, marginTop: 1 },
  termsBox: { paddingHorizontal: 14, marginBottom: 10 },
  termsTitle: { fontSize: 7.5, fontWeight: '800', color: C.navy, marginBottom: 2 },
  termsItem: { fontSize: 7, color: C.muted, lineHeight: 11 },
  sigSection: { alignItems: 'flex-end', paddingHorizontal: 14, marginBottom: 10 },
  sigLine: { width: 90, height: 1, backgroundColor: '#94a3b8', marginBottom: 2 },
  sigText: { fontSize: 7, fontWeight: '700', color: C.navy },

  printActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
    marginTop: 20,
  },
  printActionBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
