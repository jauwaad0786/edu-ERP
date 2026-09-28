// mob_app/src/screens/students/AddStudentWizardScreen.js
// 100% Feature Parity with Web ERP NewAdmissionPage.jsx and /api/principal/students
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert, Modal, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';

const GENDERS = ['Male', 'Female', 'Other'];
const CATEGORIES = ['General', 'OBC', 'SC', 'ST', 'EWS'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const SECTIONS = ['A', 'B', 'C', 'D'];

export default function AddStudentWizardScreen({ navigation }) {
  const { user } = useAuth();

  // Mode: 'quick' (⚡ Fast-Track Express Admission) vs 'full' (📋 Comprehensive Dossier)
  const [mode, setMode] = useState('quick');
  const [classes, setClasses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [transportRoutes, setTransportRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [admittedStudent, setAdmittedStudent] = useState(null);

  // Core Mandatory Fields
  const [fullName, setFullName] = useState('');
  const [admissionNo, setAdmissionNo] = useState('');
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [selectedClassName, setSelectedClassName] = useState('');
  const [selectedSection, setSelectedSection] = useState('A');
  const [session, setSession] = useState('2026-27');
  const [fatherName, setFatherName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [dob, setDob] = useState('2012-05-15');
  const [gender, setGender] = useState('Male');
  const [password, setPassword] = useState('12345');
  const [status, setStatus] = useState('ACTIVE'); // 'ACTIVE' vs 'PROVISIONAL'

  // Full Dossier Fields
  const [category, setCategory] = useState('General');
  const [bloodGroup, setBloodGroup] = useState('B+');
  const [nationality, setNationality] = useState('Indian');
  const [religion, setReligion] = useState('Hinduism');
  const [aadharNo, setAadharNo] = useState('');
  const [motherName, setMotherName] = useState('');
  const [motherPhone, setMotherPhone] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('Uttar Pradesh');
  const [pincode, setPincode] = useState('');
  const [isFirstSchool, setIsFirstSchool] = useState(false);
  const [prevSchool, setPrevSchool] = useState('');
  const [prevClass, setPrevClass] = useState('');
  const [prevTcNo, setPrevTcNo] = useState('');

  // Services
  const [transportRequired, setTransportRequired] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [hostelRequired, setHostelRequired] = useState(false);

  // Real-time Duplicate Warning State
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  // Dropdown Pickers
  const [showClassPicker, setShowClassPicker] = useState(false);
  const [showSectionPicker, setShowSectionPicker] = useState(false);
  const [showSessionPicker, setShowSessionPicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showBloodGroupPicker, setShowBloodGroupPicker] = useState(false);
  const [showGenderPicker, setShowGenderPicker] = useState(false);

  // Auto-fetch sequential admission number
  const fetchNextAdmissionNo = useCallback(async (currSession) => {
    try {
      const res = await client.get(`/principal/students/next-admission-no?session=${currSession || '2026-27'}`);
      if (res.data?.next_admission_no) {
        setAdmissionNo(res.data.next_admission_no);
      }
    } catch (err) {
      console.warn('Could not auto-fetch next admission no:', err?.message);
    }
  }, []);

  useEffect(() => {
    // 1. Fetch Classes & Sessions
    Promise.all([
      client.get('/principal/classes').catch(() => ({ data: [] })),
      client.get('/principal/students/sessions').catch(() => ({ data: {} })),
      client.get('/transport/routes').catch(() => ({ data: [] })),
    ]).then(([clsRes, sessRes, transRes]) => {
      const clsList = Array.isArray(clsRes.data) ? clsRes.data : clsRes.data?.classes || [];
      setClasses(clsList);
      if (clsList.length > 0 && !selectedClassId) {
        setSelectedClassId(clsList[0].id);
        setSelectedClassName(clsList[0].name || 'Class');
      }

      const sList = sessRes.data?.sessions || [];
      setSessions(sList);
      if (sList.length > 0) {
        setSession(sList[0]);
      }

      const rList = Array.isArray(transRes.data) ? transRes.data : transRes.data?.data || [];
      setTransportRoutes(rList);
    }).catch(() => {});

    fetchNextAdmissionNo(session);
  }, [fetchNextAdmissionNo, session, selectedClassId]);

  // Real-time duplicate check with debounce
  useEffect(() => {
    if (!fullName.trim() || fullName.trim().length < 3) {
      setDuplicateWarning(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const cleanPhone = (parentPhone || '').replace(/\D/g, '');
        const res = await client.get('/principal/students/check-duplicate', {
          params: {
            name: fullName.trim(),
            parent_phone: cleanPhone || undefined,
            dob: dob || undefined,
          }
        });
        if (res.data?.duplicates && res.data.duplicates.length > 0) {
          const match = res.data.duplicates[0];
          setDuplicateWarning(`Potential duplicate detected: ${match.name} (Adm: ${match.admission_no || '—'}, Class: ${match.class_name || '—'})`);
        } else {
          setDuplicateWarning(null);
        }
      } catch {
        setDuplicateWarning(null);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [fullName, parentPhone, dob]);

  // Submit Admission
  const handleSubmitAdmission = async () => {
    if (!fullName.trim()) {
      Alert.alert('Required Field', 'Please enter student full name.');
      return;
    }
    if (!selectedClassId) {
      Alert.alert('Required Field', 'Please select an admission class.');
      return;
    }
    if (!admissionNo.trim()) {
      Alert.alert('Required Field', 'Admission number is mandatory for student identity.');
      return;
    }
    if (!fatherName.trim()) {
      Alert.alert('Required Field', "Father's Name is mandatory for student login and verification.");
      return;
    }
    const cleanPhone = (parentPhone || '').replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      Alert.alert('Invalid Contact', 'A valid 10-digit primary mobile number is mandatory.');
      return;
    }
    if (!password.trim()) {
      Alert.alert('Required Field', 'Student portal password is required.');
      return;
    }

    setLoading(true);
    try {
      const firstName = fullName.trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      const autoEmail = parentEmail.trim() || `${firstName || 'student'}@school.com`;

      const payload = {
        name: fullName.trim(),
        admission_no: admissionNo.trim(),
        manual_admission_no: admissionNo.trim(),
        class_id: selectedClassId,
        section: selectedSection || 'A',
        session: session || '2026-27',
        admission_date: new Date().toISOString().split('T')[0],
        father_name: fatherName.trim(),
        parent_name: fatherName.trim(),
        parent_phone: cleanPhone,
        parent_email: autoEmail,
        email: autoEmail,
        dob: dob || '2012-05-15',
        gender: gender || 'Male',
        password: password.trim() || '12345',
        category: category || 'General',
        blood_group: bloodGroup || 'B+',
        nationality: nationality || 'Indian',
        religion: religion || 'Hinduism',
        aadhar_no: aadharNo.trim() || undefined,
        mother_name: motherName.trim() || undefined,
        mother_phone: motherPhone.trim() || undefined,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        state: state || 'Uttar Pradesh',
        pincode: pincode.trim() || undefined,
        is_first_school: isFirstSchool,
        previous_school_name: prevSchool.trim() || undefined,
        previous_class: prevClass.trim() || undefined,
        previous_tc_no: prevTcNo.trim() || undefined,
        transport_required: transportRequired ? 'Yes' : 'No',
        transport_route_id: transportRequired && selectedRouteId ? Number(selectedRouteId) : undefined,
        hostel_required: hostelRequired ? 'Yes' : 'No',
        status: status || 'ACTIVE',
      };

      const res = await client.post('/principal/students', payload);
      const studentData = res.data?.student || res.data;

      setAdmittedStudent({
        id: studentData.id,
        name: studentData.name || fullName,
        admission_no: studentData.admission_no || admissionNo,
        class_name: selectedClassName,
        section: selectedSection,
        password: password.trim() || '12345',
        status: status || 'ACTIVE',
      });
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.response?.data?.error || 'Could not enroll student. Please check input details.';
      Alert.alert('Admission Error', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setAdmittedStudent(null);
    setFullName('');
    setFatherName('');
    setParentPhone('');
    setMotherName('');
    setAddress('');
    setDuplicateWarning(null);
    fetchNextAdmissionNo(session);
  };

  // If enrollment succeeded, display credentials confirmation card
  if (admittedStudent) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.successWrapper}>
          <View style={styles.successIconBadge}>
            <Ionicons name="checkmark-circle" size={60} color="#16a34a" />
          </View>
          <Text style={styles.successTitle}>
            {admittedStudent.status === 'PROVISIONAL' ? 'Provisional Admission Registered!' : 'Student Enrolled Successfully!'}
          </Text>
          <Text style={styles.successSubtitle}>
            {admittedStudent.status === 'PROVISIONAL'
              ? 'Student is held in the Provisional queue pending fee clearance.'
              : 'Permanent student master profile and active enrollment generated.'}
          </Text>

          <View style={styles.credentialsCard}>
            <View style={styles.credRow}>
              <Text style={styles.credLabel}>Student Name</Text>
              <Text style={styles.credValue}>{admittedStudent.name}</Text>
            </View>
            <View style={styles.credDivider} />
            <View style={styles.credRow}>
              <Text style={styles.credLabel}>Admission / ID</Text>
              <Text style={[styles.credValue, { color: colors.primary, fontWeight: '800' }]}>
                {admittedStudent.admission_no}
              </Text>
            </View>
            <View style={styles.credDivider} />
            <View style={styles.credRow}>
              <Text style={styles.credLabel}>Assigned Class</Text>
              <Text style={styles.credValue}>Class {admittedStudent.class_name} ({admittedStudent.section})</Text>
            </View>
            <View style={styles.credDivider} />
            <View style={styles.credRow}>
              <Text style={styles.credLabel}>Portal Password</Text>
              <Text style={[styles.credValue, { color: '#0b57d0', fontWeight: '800' }]}>
                {admittedStudent.password}
              </Text>
            </View>
          </View>

          <View style={styles.successActionButtons}>
            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => {
                const url = `${client.defaults.baseURL}/principal/admission-card/${admittedStudent.id}`;
                Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open admission card.'));
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="document-text-outline" size={16} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.doneBtnText}>Download Admission Card</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.doneBtn, { backgroundColor: '#16a34a', marginTop: 8 }]}
              onPress={() => {
                navigation.navigate('FeeCollect', { student: admittedStudent });
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="cash-outline" size={16} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.doneBtnText}>Collect Admission Fee</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.anotherBtn}
              onPress={resetForm}
              activeOpacity={0.8}
            >
              <Ionicons name="person-add-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.anotherBtnText}>Enroll Another Student</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Student Admission</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Mode Selector */}
      <View style={styles.modeContainer}>
        <TouchableOpacity
          style={[styles.modeTab, mode === 'quick' && styles.modeTabActive]}
          onPress={() => setMode('quick')}
          activeOpacity={0.8}
        >
          <Ionicons name="flash" size={15} color={mode === 'quick' ? colors.primary : '#64748b'} />
          <Text style={[styles.modeTabText, mode === 'quick' && styles.modeTabTextActive]}>
            ⚡ Express Admission
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeTab, mode === 'full' && styles.modeTabActive]}
          onPress={() => setMode('full')}
          activeOpacity={0.8}
        >
          <Ionicons name="document-text-outline" size={15} color={mode === 'full' ? colors.primary : '#64748b'} />
          <Text style={[styles.modeTabText, mode === 'full' && styles.modeTabTextActive]}>
            📋 Full Dossier
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
        {/* Duplicate alert if detected */}
        {duplicateWarning && (
          <View style={styles.warningBox}>
            <Ionicons name="alert-circle" size={18} color="#b45309" />
            <Text style={styles.warningText}>{duplicateWarning}</Text>
          </View>
        )}

        {/* Status Option: Active vs Provisional */}
        <View style={styles.statusSelectBox}>
          <Text style={styles.fieldLabel}>Admission Status Type</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={[styles.statusOption, status === 'ACTIVE' && styles.statusOptionActive]}
              onPress={() => setStatus('ACTIVE')}
            >
              <Ionicons name="checkmark-circle" size={16} color={status === 'ACTIVE' ? '#16a34a' : '#64748b'} />
              <Text style={[styles.statusOptionText, status === 'ACTIVE' && { color: '#16a34a', fontWeight: '800' }]}>
                Confirmed (Active)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statusOption, status === 'PROVISIONAL' && styles.statusOptionActive]}
              onPress={() => setStatus('PROVISIONAL')}
            >
              <Ionicons name="time" size={16} color={status === 'PROVISIONAL' ? '#d97706' : '#64748b'} />
              <Text style={[styles.statusOptionText, status === 'PROVISIONAL' && { color: '#d97706', fontWeight: '800' }]}>
                Unconfirmed (Provisional)
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Section 1: Academic Placement */}
        <Text style={styles.sectionHeader}>1. Academic Placement</Text>
        <View style={styles.card}>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Admission Class *</Text>
            <TouchableOpacity
              style={styles.pickerTrigger}
              onPress={() => setShowClassPicker(true)}
            >
              <Text style={styles.pickerTriggerText}>
                {selectedClassName ? `Class ${selectedClassName}` : 'Select Class'}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#64748b" />
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Section</Text>
              <TouchableOpacity
                style={styles.pickerTrigger}
                onPress={() => setShowSectionPicker(true)}
              >
                <Text style={styles.pickerTriggerText}>Section {selectedSection}</Text>
                <Ionicons name="chevron-down" size={16} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Academic Session</Text>
              <TouchableOpacity
                style={styles.pickerTrigger}
                onPress={() => setShowSessionPicker(true)}
              >
                <Text style={styles.pickerTriggerText}>{session}</Text>
                <Ionicons name="chevron-down" size={16} color="#64748b" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Admission / Roll No *</Text>
            <TextInput
              style={styles.input}
              value={admissionNo}
              placeholder="e.g. ADM2026-001"
              onChangeText={setAdmissionNo}
            />
          </View>
        </View>

        {/* Section 2: Student Identity */}
        <Text style={styles.sectionHeader}>2. Student Identity &amp; Portal Login</Text>
        <View style={styles.card}>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Full Legal Name *</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              placeholder="e.g. Aarav Sharma"
              onChangeText={setFullName}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Date of Birth</Text>
              <TextInput
                style={styles.input}
                value={dob}
                placeholder="YYYY-MM-DD"
                onChangeText={setDob}
              />
            </View>

            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Gender</Text>
              <TouchableOpacity
                style={styles.pickerTrigger}
                onPress={() => setShowGenderPicker(true)}
              >
                <Text style={styles.pickerTriggerText}>{gender}</Text>
                <Ionicons name="chevron-down" size={16} color="#64748b" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Default Student Portal Password *</Text>
            <TextInput
              style={styles.input}
              value={password}
              placeholder="12345"
              onChangeText={setPassword}
            />
          </View>
        </View>

        {/* Section 3: Parent Contact */}
        <Text style={styles.sectionHeader}>3. Parent &amp; Contact Details</Text>
        <View style={styles.card}>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Father's / Guardian's Full Name *</Text>
            <TextInput
              style={styles.input}
              value={fatherName}
              placeholder="e.g. Rajesh Sharma"
              onChangeText={setFatherName}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Primary Parent Mobile (10 Digits) *</Text>
            <TextInput
              style={styles.input}
              keyboardType="phone-pad"
              maxLength={10}
              value={parentPhone}
              placeholder="9876543210"
              onChangeText={setParentPhone}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Parent Email (Optional)</Text>
            <TextInput
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
              value={parentEmail}
              placeholder="parent@example.com"
              onChangeText={setParentEmail}
            />
          </View>
        </View>

        {/* Full Mode Additional Fields */}
        {mode === 'full' && (
          <>
            <Text style={styles.sectionHeader}>4. Demographic &amp; KYC</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Category</Text>
                  <TouchableOpacity
                    style={styles.pickerTrigger}
                    onPress={() => setShowCategoryPicker(true)}
                  >
                    <Text style={styles.pickerTriggerText}>{category}</Text>
                    <Ionicons name="chevron-down" size={16} color="#64748b" />
                  </TouchableOpacity>
                </View>

                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Blood Group</Text>
                  <TouchableOpacity
                    style={styles.pickerTrigger}
                    onPress={() => setShowBloodGroupPicker(true)}
                  >
                    <Text style={styles.pickerTriggerText}>{bloodGroup}</Text>
                    <Ionicons name="chevron-down" size={16} color="#64748b" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Student Aadhar Card No</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  maxLength={14}
                  value={aadharNo}
                  placeholder="12-digit Aadhar"
                  onChangeText={setAadharNo}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Mother's Name</Text>
                <TextInput
                  style={styles.input}
                  value={motherName}
                  placeholder="Mother's name"
                  onChangeText={setMotherName}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Residential Address</Text>
                <TextInput
                  style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                  multiline
                  value={address}
                  placeholder="Street, City, PIN Code"
                  onChangeText={setAddress}
                />
              </View>
            </View>

            <Text style={styles.sectionHeader}>5. Previous School History</Text>
            <View style={styles.card}>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}
                onPress={() => setIsFirstSchool(!isFirstSchool)}
              >
                <Ionicons name={isFirstSchool ? 'checkbox' : 'square-outline'} size={20} color={colors.primary} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#1e293b' }}>
                  Is this the student's first school? (Nursery/LKG)
                </Text>
              </TouchableOpacity>

              {!isFirstSchool && (
                <>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Previous School Name</Text>
                    <TextInput
                      style={styles.input}
                      value={prevSchool}
                      placeholder="e.g. Modern Public School"
                      onChangeText={setPrevSchool}
                    />
                  </View>

                  <View style={styles.row}>
                    <View style={[styles.fieldGroup, { flex: 1 }]}>
                      <Text style={styles.fieldLabel}>Class Passed</Text>
                      <TextInput
                        style={styles.input}
                        value={prevClass}
                        placeholder="e.g. 4th"
                        onChangeText={setPrevClass}
                      />
                    </View>
                    <View style={[styles.fieldGroup, { flex: 1 }]}>
                      <Text style={styles.fieldLabel}>TC Number</Text>
                      <TextInput
                        style={styles.input}
                        value={prevTcNo}
                        placeholder="TC-10492"
                        onChangeText={setPrevTcNo}
                      />
                    </View>
                  </View>
                </>
              )}
            </View>

            <Text style={styles.sectionHeader}>6. Optional Campus Services</Text>
            <View style={styles.card}>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: transportRequired ? 10 : 0 }}
                onPress={() => setTransportRequired(!transportRequired)}
              >
                <Ionicons name={transportRequired ? 'checkbox' : 'square-outline'} size={20} color={colors.primary} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#1e293b' }}>
                  Enroll in School Bus Transport Service
                </Text>
              </TouchableOpacity>

              {transportRequired && transportRoutes.length > 0 && (
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Select Bus Route</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    {transportRoutes.map(r => (
                      <TouchableOpacity
                        key={r.id}
                        style={[styles.routeChip, selectedRouteId === String(r.id) && styles.routeChipActive]}
                        onPress={() => setSelectedRouteId(String(r.id))}
                      >
                        <Text style={[styles.routeChipText, selectedRouteId === String(r.id) && styles.routeChipTextActive]}>
                          {r.name || r.route_name || `Route ${r.id}`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              <View style={styles.divider} />

              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                onPress={() => setHostelRequired(!hostelRequired)}
              >
                <Ionicons name={hostelRequired ? 'checkbox' : 'square-outline'} size={20} color={colors.primary} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#1e293b' }}>
                  Enroll in Student Hostel Boarding
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Submit Button */}
        <TouchableOpacity
          style={styles.submitBtn}
          onPress={handleSubmitAdmission}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={18} color="#ffffff" />
              <Text style={styles.submitBtnText}>
                {status === 'PROVISIONAL' ? 'Save as Provisional Admission' : 'Confirm & Complete Admission'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Class Picker Modal */}
      <Modal visible={showClassPicker} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowClassPicker(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Admission Class</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {classes.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.modalOption}
                  onPress={() => {
                    setSelectedClassId(c.id);
                    setSelectedClassName(c.name);
                    setSelectedSection(c.section || 'A');
                    setShowClassPicker(false);
                  }}
                >
                  <Text style={[styles.modalOptionText, selectedClassId === c.id && { color: colors.primary, fontWeight: '800' }]}>
                    {c.name} — Section {c.section}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Section Picker Modal */}
      <Modal visible={showSectionPicker} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowSectionPicker(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Section</Text>
            {SECTIONS.map(s => (
              <TouchableOpacity
                key={s}
                style={styles.modalOption}
                onPress={() => {
                  setSelectedSection(s);
                  setShowSectionPicker(false);
                }}
              >
                <Text style={[styles.modalOptionText, selectedSection === s && { color: colors.primary, fontWeight: '800' }]}>
                  Section {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Session Picker Modal */}
      <Modal visible={showSessionPicker} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowSessionPicker(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Academic Session</Text>
            {sessions.map(s => (
              <TouchableOpacity
                key={s}
                style={styles.modalOption}
                onPress={() => {
                  setSession(s);
                  setShowSessionPicker(false);
                }}
              >
                <Text style={[styles.modalOptionText, session === s && { color: colors.primary, fontWeight: '800' }]}>
                  Session {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Gender Picker Modal */}
      <Modal visible={showGenderPicker} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowGenderPicker(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Gender</Text>
            {GENDERS.map(g => (
              <TouchableOpacity
                key={g}
                style={styles.modalOption}
                onPress={() => {
                  setGender(g);
                  setShowGenderPicker(false);
                }}
              >
                <Text style={[styles.modalOptionText, gender === g && { color: colors.primary, fontWeight: '800' }]}>
                  {g}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Category Picker Modal */}
      <Modal visible={showCategoryPicker} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowCategoryPicker(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Category</Text>
            {CATEGORIES.map(c => (
              <TouchableOpacity
                key={c}
                style={styles.modalOption}
                onPress={() => {
                  setCategory(c);
                  setShowCategoryPicker(false);
                }}
              >
                <Text style={[styles.modalOptionText, category === c && { color: colors.primary, fontWeight: '800' }]}>
                  {c}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Blood Group Picker Modal */}
      <Modal visible={showBloodGroupPicker} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowBloodGroupPicker(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Blood Group</Text>
            {BLOOD_GROUPS.map(b => (
              <TouchableOpacity
                key={b}
                style={styles.modalOption}
                onPress={() => {
                  setBloodGroup(b);
                  setShowBloodGroupPicker(false);
                }}
              >
                <Text style={[styles.modalOptionText, bloodGroup === b && { color: colors.primary, fontWeight: '800' }]}>
                  {b}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
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
    backgroundColor: '#0b57d0',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: { color: '#ffffff', fontSize: 17, fontWeight: '800' },
  modeContainer: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 8,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    gap: 6,
  },
  modeTabActive: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  modeTabText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748b',
  },
  modeTabTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  scrollBody: {
    padding: 14,
    gap: 12,
    paddingBottom: 40,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    padding: 10,
    borderRadius: 8,
    gap: 8,
  },
  warningText: {
    fontSize: 12,
    color: '#92400e',
    fontWeight: '600',
    flex: 1,
  },
  statusSelectBox: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statusOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    gap: 6,
  },
  statusOptionActive: {
    borderColor: colors.primary,
    backgroundColor: '#f0f9ff',
  },
  statusOptionText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#334155',
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  fieldGroup: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155',
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13.5,
    color: '#0f172a',
  },
  pickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  pickerTriggerText: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 4,
  },
  routeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  routeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  routeChipText: {
    fontSize: 11.5,
    color: '#475569',
    fontWeight: '600',
  },
  routeChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 13,
    borderRadius: 10,
    gap: 6,
    marginTop: 8,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  successWrapper: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIconBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 12.5,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },
  credentialsCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginVertical: 20,
  },
  credRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  credLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  credValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  credDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
  },
  successActionButtons: {
    width: '100%',
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
  },
  doneBtnText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '700',
  },
  anotherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  anotherBtnText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalOption: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  modalOptionText: {
    fontSize: 13.5,
    color: '#334155',
  },
});
