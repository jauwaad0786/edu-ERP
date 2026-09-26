// mob_app/src/screens/students/AddStudentWizardScreen.js
// 100% Parity with Web ERP NewAdmissionPage.jsx and Flask /api/principal/students
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import client from '../../api/client';
import { colors } from '../../theme/colors';

const GENDERS = ['Male', 'Female', 'Other'];
const SESSIONS = ['2026-27', '2025-26', '2027-28'];
const CATEGORIES = ['General', 'OBC', 'SC', 'ST', 'EWS'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const SECTIONS = ['A', 'B', 'C', 'D'];

export default function AddStudentWizardScreen({ navigation }) {
  // Mode: 'quick' (⚡ Fast-Track 1-Scroll, Default) vs 'full' (📋 Comprehensive Dossier)
  const [mode, setMode] = useState('quick');
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [admittedStudent, setAdmittedStudent] = useState(null);

  // Core Mandatory Fields (Exact Web Parity)
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

  // Full Dossier Fields (Optional/Secondary)
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

  // Dropdown Pickers
  const [showClassPicker, setShowClassPicker] = useState(false);
  const [showSectionPicker, setShowSectionPicker] = useState(false);
  const [showSessionPicker, setShowSessionPicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showBloodGroupPicker, setShowBloodGroupPicker] = useState(false);

  // Auto-fetch sequential candidate admission number matching Web session
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
    // 1. Fetch Classes
    client.get('/principal/classes')
      .then(res => {
        const clsList = Array.isArray(res.data) ? res.data : res.data?.classes || [];
        setClasses(clsList);
        if (clsList.length > 0 && !selectedClassId) {
          const first = clsList[0];
          setSelectedClassId(first.id);
          setSelectedClassName(first.name || first.class_name || 'Class');
        }
      })
      .catch(() => {});

    // 2. Fetch Next Admission No
    fetchNextAdmissionNo(session);
  }, [fetchNextAdmissionNo, session]);

  // Submission handler strictly matching Web ERP NewAdmissionPage.jsx payload contract
  const handleSubmitAdmission = async () => {
    // Validation matching Web
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
      Alert.alert('Required Field', 'Student portal password is required (default: 12345).');
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
        transport_required: 'No',
        hostel_required: 'No',
        library_required: 'No',
        status: 'ACTIVE',
      };

      const res = await client.post('/principal/students', payload);
      const studentData = res.data;

      setAdmittedStudent({
        id: studentData.id,
        name: studentData.name || fullName,
        admission_no: studentData.admission_no || admissionNo,
        class_name: selectedClassName,
        section: selectedSection,
        password: password.trim() || '12345',
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
    fetchNextAdmissionNo(session);
  };

  // If enrollment succeeded, display credentials confirmation card
  if (admittedStudent) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.successWrapper}>
          <View style={styles.successIconBadge}>
            <Ionicons name="checkmark-circle" size={64} color="#16a34a" />
          </View>
          <Text style={styles.successTitle}>Student Enrolled Successfully!</Text>
          <Text style={styles.successSubtitle}>
            Student record created and credentials generated for student portal.
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
              onPress={() => navigation.goBack()}
              activeOpacity={0.8}
            >
              <Text style={styles.doneBtnText}>View in Students Directory</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.anotherBtn}
              onPress={resetForm}
              activeOpacity={0.8}
            >
              <Ionicons name="person-add-outline" size={18} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.anotherBtnText}>Enroll Another Student</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top Header */}
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

      {/* Mode Selector Segment (Quick vs Full Dossier) */}
      <View style={styles.modeContainer}>
        <TouchableOpacity
          style={[styles.modeTab, mode === 'quick' && styles.modeTabActive]}
          onPress={() => setMode('quick')}
          activeOpacity={0.8}
        >
          <Ionicons name="flash" size={15} color={mode === 'quick' ? colors.primary : '#64748b'} />
          <Text style={[styles.modeTabText, mode === 'quick' && styles.modeTabTextActive]}>
            Quick Admission
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeTab, mode === 'full' && styles.modeTabActive]}
          onPress={() => setMode('full')}
          activeOpacity={0.8}
        >
          <Ionicons name="document-text-outline" size={15} color={mode === 'full' ? colors.primary : '#64748b'} />
          <Text style={[styles.modeTabText, mode === 'full' && styles.modeTabTextActive]}>
            Full Dossier
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
        {/* Banner */}
        <View style={styles.bannerBox}>
          <Text style={styles.bannerTitle}>
            {mode === 'quick' ? '⚡ Express Admission' : '📋 Comprehensive Enrollment'}
          </Text>
          <Text style={styles.bannerDesc}>
            {mode === 'quick'
              ? 'Captures mandatory identity, class assignment, and portal credentials.'
              : 'Detailed demographic, KYC, previous school, and residential records.'}
          </Text>
        </View>

        {/* Section 1: Academic Placement */}
        <Text style={styles.sectionHeader}>1. Academic Placement</Text>
        <View style={styles.card}>
          {/* Admission Number (Auto-Generated / Editable) */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Admission / Reg No. <Text style={styles.req}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. ADM-2026-0042"
              placeholderTextColor="#94a3b8"
              value={admissionNo}
              onChangeText={setAdmissionNo}
            />
          </View>

          {/* Academic Session & Class Selector */}
          <View style={styles.twoColRow}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.label}>Academic Session <Text style={styles.req}>*</Text></Text>
              <TouchableOpacity
                style={styles.dropdownInput}
                onPress={() => setShowSessionPicker(true)}
              >
                <Text style={styles.dropdownText}>{session}</Text>
                <Ionicons name="chevron-down" size={16} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.label}>Admission Class <Text style={styles.req}>*</Text></Text>
              <TouchableOpacity
                style={styles.dropdownInput}
                onPress={() => setShowClassPicker(true)}
              >
                <Text style={styles.dropdownText}>
                  {selectedClassName ? `Class ${selectedClassName}` : 'Select class'}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#64748b" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Section Picker */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Section</Text>
            <TouchableOpacity
              style={styles.dropdownInput}
              onPress={() => setShowSectionPicker(true)}
            >
              <Text style={styles.dropdownText}>Section {selectedSection}</Text>
              <Ionicons name="chevron-down" size={16} color="#64748b" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Section 2: Student Identity */}
        <Text style={styles.sectionHeader}>2. Student Identity</Text>
        <View style={styles.card}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Student Full Name <Text style={styles.req}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Aarav Sharma"
              placeholderTextColor="#94a3b8"
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

          {/* Date of Birth & Gender */}
          <View style={styles.twoColRow}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.label}>Date of Birth (YYYY-MM-DD)</Text>
              <View style={styles.iconInputWrapper}>
                <TextInput
                  style={styles.iconInput}
                  placeholder="2012-05-15"
                  placeholderTextColor="#94a3b8"
                  value={dob}
                  onChangeText={setDob}
                />
                <Ionicons name="calendar-outline" size={18} color="#64748b" />
              </View>
            </View>

            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.label}>Gender <Text style={styles.req}>*</Text></Text>
              <View style={styles.genderRow}>
                {GENDERS.map(g => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.genderChip, gender === g && styles.genderChipActive]}
                    onPress={() => setGender(g)}
                  >
                    <Text style={[styles.genderChipText, gender === g && styles.genderChipTextActive]}>
                      {g}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Portal Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Student Portal Password <Text style={styles.req}>*</Text></Text>
            <View style={styles.iconInputWrapper}>
              <TextInput
                style={styles.iconInput}
                placeholder="default: 12345"
                placeholderTextColor="#94a3b8"
                value={password}
                onChangeText={setPassword}
              />
              <Ionicons name="key-outline" size={18} color="#64748b" />
            </View>
            <Text style={styles.helpText}>Student will use Admission No & Password to log into mobile/web.</Text>
          </View>
        </View>

        {/* Section 3: Parent & Contact (Mandatory in Web) */}
        <Text style={styles.sectionHeader}>3. Parent & Communication</Text>
        <View style={styles.card}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Father's Name <Text style={styles.req}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Rajesh Sharma"
              placeholderTextColor="#94a3b8"
              value={fatherName}
              onChangeText={setFatherName}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Primary Contact Number <Text style={styles.req}>*</Text></Text>
            <View style={styles.iconInputWrapper}>
              <TextInput
                style={styles.iconInput}
                placeholder="10-digit mobile (e.g. 9876543210)"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
                maxLength={10}
                value={parentPhone}
                onChangeText={setParentPhone}
              />
              <Ionicons name="call-outline" size={18} color="#64748b" />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Parent Email (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="parent@example.com"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              value={parentEmail}
              onChangeText={setParentEmail}
            />
          </View>
        </View>

        {/* Full Dossier Mode Additional Fields */}
        {mode === 'full' && (
          <>
            <Text style={styles.sectionHeader}>4. Demographic & Medical Dossier</Text>
            <View style={styles.card}>
              <View style={styles.twoColRow}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Category</Text>
                  <TouchableOpacity
                    style={styles.dropdownInput}
                    onPress={() => setShowCategoryPicker(true)}
                  >
                    <Text style={styles.dropdownText}>{category}</Text>
                    <Ionicons name="chevron-down" size={16} color="#64748b" />
                  </TouchableOpacity>
                </View>

                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Blood Group</Text>
                  <TouchableOpacity
                    style={styles.dropdownInput}
                    onPress={() => setShowBloodGroupPicker(true)}
                  >
                    <Text style={styles.dropdownText}>{bloodGroup}</Text>
                    <Ionicons name="chevron-down" size={16} color="#64748b" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.twoColRow}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Nationality</Text>
                  <TextInput
                    style={styles.input}
                    value={nationality}
                    onChangeText={setNationality}
                  />
                </View>

                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Religion</Text>
                  <TextInput
                    style={styles.input}
                    value={religion}
                    onChangeText={setReligion}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Student Aadhaar No. (12 digits)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="1234 5678 9012"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  maxLength={12}
                  value={aadharNo}
                  onChangeText={setAadharNo}
                />
              </View>
            </View>

            <Text style={styles.sectionHeader}>5. Secondary Guardian & Address</Text>
            <View style={styles.card}>
              <View style={styles.twoColRow}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Mother's Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Sunita Sharma"
                    placeholderTextColor="#94a3b8"
                    value={motherName}
                    onChangeText={setMotherName}
                  />
                </View>

                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Mother's Phone</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Mobile number"
                    placeholderTextColor="#94a3b8"
                    keyboardType="phone-pad"
                    value={motherPhone}
                    onChangeText={setMotherPhone}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Residential Address</Text>
                <TextInput
                  style={[styles.input, { height: 64, textAlignVertical: 'top' }]}
                  placeholder="House No., Street, Locality"
                  placeholderTextColor="#94a3b8"
                  multiline
                  value={address}
                  onChangeText={setAddress}
                />
              </View>

              <View style={styles.twoColRow}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.label}>City</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="City"
                    placeholderTextColor="#94a3b8"
                    value={city}
                    onChangeText={setCity}
                  />
                </View>

                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Pincode</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="6-digit pincode"
                    placeholderTextColor="#94a3b8"
                    keyboardType="numeric"
                    maxLength={6}
                    value={pincode}
                    onChangeText={setPincode}
                  />
                </View>
              </View>
            </View>

            <Text style={styles.sectionHeader}>6. Previous School Details</Text>
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setIsFirstSchool(!isFirstSchool)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={isFirstSchool ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={isFirstSchool ? colors.primary : '#94a3b8'}
                />
                <Text style={styles.checkboxLabel}>First time school admission (No prior school)</Text>
              </TouchableOpacity>

              {!isFirstSchool && (
                <>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Previous School Name</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Name of previous institution"
                      placeholderTextColor="#94a3b8"
                      value={prevSchool}
                      onChangeText={setPrevSchool}
                    />
                  </View>

                  <View style={styles.twoColRow}>
                    <View style={[styles.fieldGroup, { flex: 1 }]}>
                      <Text style={styles.label}>Last Class Passed</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. 9th"
                        placeholderTextColor="#94a3b8"
                        value={prevClass}
                        onChangeText={setPrevClass}
                      />
                    </View>

                    <View style={[styles.fieldGroup, { flex: 1 }]}>
                      <Text style={styles.label}>TC / Transfer No.</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Transfer cert no."
                        placeholderTextColor="#94a3b8"
                        value={prevTcNo}
                        onChangeText={setPrevTcNo}
                      />
                    </View>
                  </View>
                </>
              )}
            </View>
          </>
        )}

        {/* Submit Action Button */}
        <TouchableOpacity
          onPress={handleSubmitAdmission}
          activeOpacity={0.85}
          disabled={loading}
          style={{ marginTop: 24, marginBottom: 40 }}
        >
          <LinearGradient
            colors={['#0b57d0', '#083ca8']}
            style={styles.submitGradientBtn}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.submitBtnText}>Complete Admission</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>

      {/* Class Selector Modal */}
      <Modal visible={showClassPicker} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowClassPicker(false)}
        >
          <View style={styles.pickerBox}>
            <Text style={styles.pickerTitle}>Select Admission Class</Text>
            {classes.map((c, idx) => {
              const cName = c.name || c.class_name || `Class ${idx + 1}`;
              const isSelected = selectedClassId === c.id;
              return (
                <TouchableOpacity
                  key={c.id || idx}
                  style={[styles.pickerItem, isSelected && styles.pickerItemActive]}
                  onPress={() => {
                    setSelectedClassId(c.id);
                    setSelectedClassName(cName);
                    setShowClassPicker(false);
                  }}
                >
                  <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextActive]}>
                    Class {cName} {c.section ? `(${c.section})` : ''}
                  </Text>
                  {isSelected && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Section Selector Modal */}
      <Modal visible={showSectionPicker} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowSectionPicker(false)}
        >
          <View style={styles.pickerBox}>
            <Text style={styles.pickerTitle}>Select Section</Text>
            {SECTIONS.map(s => (
              <TouchableOpacity
                key={s}
                style={[styles.pickerItem, selectedSection === s && styles.pickerItemActive]}
                onPress={() => {
                  setSelectedSection(s);
                  setShowSectionPicker(false);
                }}
              >
                <Text style={[styles.pickerItemText, selectedSection === s && styles.pickerItemTextActive]}>
                  Section {s}
                </Text>
                {selectedSection === s && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Session Selector Modal */}
      <Modal visible={showSessionPicker} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowSessionPicker(false)}
        >
          <View style={styles.pickerBox}>
            <Text style={styles.pickerTitle}>Select Academic Session</Text>
            {SESSIONS.map(sess => (
              <TouchableOpacity
                key={sess}
                style={[styles.pickerItem, session === sess && styles.pickerItemActive]}
                onPress={() => {
                  setSession(sess);
                  fetchNextAdmissionNo(sess);
                  setShowSessionPicker(false);
                }}
              >
                <Text style={[styles.pickerItemText, session === sess && styles.pickerItemTextActive]}>
                  Session {sess}
                </Text>
                {session === sess && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Category Selector Modal */}
      <Modal visible={showCategoryPicker} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowCategoryPicker(false)}
        >
          <View style={styles.pickerBox}>
            <Text style={styles.pickerTitle}>Select Category</Text>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.pickerItem, category === cat && styles.pickerItemActive]}
                onPress={() => {
                  setCategory(cat);
                  setShowCategoryPicker(false);
                }}
              >
                <Text style={[styles.pickerItemText, category === cat && styles.pickerItemTextActive]}>
                  {cat}
                </Text>
                {category === cat && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Blood Group Selector Modal */}
      <Modal visible={showBloodGroupPicker} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowBloodGroupPicker(false)}
        >
          <View style={styles.pickerBox}>
            <Text style={styles.pickerTitle}>Select Blood Group</Text>
            {BLOOD_GROUPS.map(bg => (
              <TouchableOpacity
                key={bg}
                style={[styles.pickerItem, bloodGroup === bg && styles.pickerItemActive]}
                onPress={() => {
                  setBloodGroup(bg);
                  setShowBloodGroupPicker(false);
                }}
              >
                <Text style={[styles.pickerItemText, bloodGroup === bg && styles.pickerItemTextActive]}>
                  {bg}
                </Text>
                {bloodGroup === bg && <Ionicons name="checkmark" size={18} color={colors.primary} />}
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
    backgroundColor: '#0b57d0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  modeContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 10,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    gap: 6,
  },
  modeTabActive: {
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
    borderColor: '#3b82f6',
  },
  modeTabText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  modeTabTextActive: { color: '#0b57d0', fontWeight: '800' },
  scrollBody: { padding: 16 },
  bannerBox: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#0b57d0',
  },
  bannerTitle: { fontSize: 14, fontWeight: '800', color: '#0b57d0' },
  bannerDesc: { fontSize: 12, color: '#475569', marginTop: 2, lineHeight: 16 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0b57d0',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 10,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  fieldGroup: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 },
  req: { color: '#dc2626' },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1e293b',
    backgroundColor: '#f8fafc',
  },
  twoColRow: { flexDirection: 'row', gap: 10 },
  dropdownInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
  },
  dropdownText: { fontSize: 14, color: '#1e293b', fontWeight: '600' },
  iconInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
  },
  iconInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: '#1e293b' },
  genderRow: { flexDirection: 'row', gap: 6 },
  genderChip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderChipActive: { backgroundColor: '#0b57d0' },
  genderChipText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  genderChipTextActive: { color: '#ffffff', fontWeight: '700' },
  helpText: { fontSize: 11, color: '#64748b', marginTop: 4 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  checkboxLabel: { fontSize: 13, color: '#334155', fontWeight: '600' },
  submitGradientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#0b57d0',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  submitBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  pickerBox: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    maxHeight: 400,
  },
  pickerTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b', marginBottom: 12 },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  pickerItemActive: { backgroundColor: '#eff6ff', borderRadius: 8, paddingHorizontal: 8 },
  pickerItemText: { fontSize: 14, color: '#334155', fontWeight: '600' },
  pickerItemTextActive: { color: colors.primary, fontWeight: '800' },
  successWrapper: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
  successIconBadge: { marginBottom: 16 },
  successTitle: { fontSize: 20, fontWeight: '800', color: '#1e293b', textAlign: 'center' },
  successSubtitle: { fontSize: 13, color: '#64748b', textAlign: 'center', marginTop: 6, marginBottom: 20 },
  credentialsCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 24,
  },
  credRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  credLabel: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  credValue: { fontSize: 14, color: '#1e293b', fontWeight: '700' },
  credDivider: { height: 1, backgroundColor: '#f1f5f9' },
  successActionButtons: { width: '100%', gap: 12 },
  doneBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  anotherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  anotherBtnText: { color: colors.primary, fontSize: 14, fontWeight: '700' },
});
