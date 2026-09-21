// mob_app/src/screens/auth/LoginScreen.js
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';

let LinearGradient;
try {
  LinearGradient = require('expo-linear-gradient').LinearGradient;
} catch (e) {
  LinearGradient = null;
}

export default function LoginScreen() {
  const { login, studentLogin } = useAuth();

  // Mode: 'staff' | 'student'
  const [mode, setMode] = useState('staff');

  // Staff fields
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [schoolSlug, setSchoolSlug] = useState('');
  const [showSlug, setShowSlug] = useState(false);

  // Student fields
  const [studentPhone, setStudentPhone] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentFather, setStudentFather] = useState('');
  const [studentPass, setStudentPass] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleStaffLogin = async () => {
    if (!identifier.trim() || !password.trim()) {
      setError('Please enter your email/phone and password.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await login({
        identifier: identifier.trim(),
        password: password.trim(),
        school_slug: schoolSlug.trim() || undefined,
      });
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Login failed. Please check credentials.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleStudentLogin = async () => {
    if (!studentPhone.trim() || !studentName.trim() || !studentPass.trim()) {
      setError('Please enter registered mobile, student name, and password.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await studentLogin({
        phone: studentPhone.trim(),
        name: studentName.trim(),
        password: studentPass.trim(),
        father_name: studentFather.trim() || undefined,
      });
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Student login failed. Check name spelling and mobile.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const HeaderComponent = LinearGradient || View;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Header */}
        <HeaderComponent
          colors={colors.heroGradient}
          style={styles.header}
        >
          <View style={styles.logoBox}>
            <Ionicons name="school" size={32} color="#ffffff" />
          </View>
          <Text style={styles.brand}>EduERP</Text>
          <Text style={styles.tagline}>Intelligent School & College ERP</Text>
          <View style={styles.poweredBadge}>
            <Text style={styles.poweredText}>POWERED BY 1P360</Text>
          </View>
        </HeaderComponent>

        {/* Card Container */}
        <View style={styles.card}>
          {/* Mode Switcher */}
          <View style={styles.segmentContainer}>
            <TouchableOpacity
              style={[styles.segmentBtn, mode === 'staff' && styles.segmentBtnActive]}
              onPress={() => { setMode('staff'); setError(null); }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="briefcase-outline"
                size={16}
                color={mode === 'staff' ? '#ffffff' : colors.muted}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.segmentText, mode === 'staff' && styles.segmentTextActive]}>
                Staff & Admin
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.segmentBtn, mode === 'student' && styles.segmentBtnActive]}
              onPress={() => { setMode('student'); setError(null); }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="person-outline"
                size={16}
                color={mode === 'student' ? '#ffffff' : colors.muted}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.segmentText, mode === 'student' && styles.segmentTextActive]}>
                Student & Parent
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form Header */}
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>
              {mode === 'staff' ? 'Institution Sign In' : 'Student & Parent Portal'}
            </Text>
            <Text style={styles.formSub}>
              {mode === 'staff'
                ? 'Teachers, Principals, Accountants & Administrators'
                : 'Access attendance, marks, fees & academic report cards'}
            </Text>
          </View>

          {/* Error Banner */}
          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={colors.error} style={{ marginRight: 8 }} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Form Fields */}
          {mode === 'staff' ? (
            <View>
              <Input
                label="Email / Mobile / Username"
                placeholder="e.g. teacher@school.edu or 9876543210"
                icon="person-outline"
                value={identifier}
                onChangeText={setIdentifier}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Input
                label="Password"
                placeholder="Enter your password"
                icon="lock-closed-outline"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                onSubmitEditing={handleStaffLogin}
              />

              <TouchableOpacity
                onPress={() => setShowSlug(v => !v)}
                style={styles.slugToggle}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={showSlug ? 'chevron-down-circle' : 'chevron-forward-circle'}
                  size={15}
                  color={colors.primary}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.slugToggleText}>
                  {showSlug ? 'Hide' : 'Add'} School Code (Optional)
                </Text>
              </TouchableOpacity>

              {showSlug && (
                <View style={styles.slugBox}>
                  <Input
                    label="School / Institution Code"
                    placeholder="e.g. springdale-2024"
                    icon="business-outline"
                    value={schoolSlug}
                    onChangeText={setSchoolSlug}
                    autoCapitalize="none"
                    helperText="Required only for multi-branch organizations"
                  />
                </View>
              )}

              <Button
                title="Sign In to ERP"
                onPress={handleStaffLogin}
                loading={loading}
                icon="log-in-outline"
                fullWidth
                size="lg"
                style={{ marginTop: 8 }}
              />
            </View>
          ) : (
            <View>
              <Input
                label="Registered Parent Mobile No."
                placeholder="10-digit mobile number"
                icon="call-outline"
                value={studentPhone}
                onChangeText={setStudentPhone}
                keyboardType="phone-pad"
              />

              <Input
                label="Student Full Name"
                placeholder="As registered in school records"
                icon="school-outline"
                value={studentName}
                onChangeText={setStudentName}
                autoCapitalize="words"
              />

              <Input
                label="Father's Name (Optional)"
                placeholder="For multi-sibling disambiguation"
                icon="people-outline"
                value={studentFather}
                onChangeText={setStudentFather}
                autoCapitalize="words"
              />

              <Input
                label="Password / Date of Birth"
                placeholder="Password or DDMMYYYY"
                icon="lock-closed-outline"
                value={studentPass}
                onChangeText={setStudentPass}
                secureTextEntry
                onSubmitEditing={handleStudentLogin}
              />

              <Button
                title="Access Student Portal"
                onPress={handleStudentLogin}
                loading={loading}
                icon="shield-checkmark-outline"
                fullWidth
                size="lg"
                style={{ marginTop: 8 }}
              />
            </View>
          )}
        </View>

        {/* Footer info */}
        <View style={styles.footer}>
          <Ionicons name="shield-checkmark" size={14} color={colors.textSubtle} style={{ marginRight: 6 }} />
          <Text style={styles.footerText}>
            Secured with End-to-End Enterprise Encryption · EduERP v1.0
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  header: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 70 : 54,
    paddingBottom: 42,
    paddingHorizontal: 24,
    backgroundColor: colors.primaryDark,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  logoBox: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  brand: {
    fontSize: 28,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.5,
    marginBottom: 3,
  },
  tagline: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.82)',
    textAlign: 'center',
    fontWeight: '500',
  },
  poweredBadge: {
    marginTop: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 99,
  },
  poweredText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 1.5,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    marginHorizontal: 16,
    marginTop: -22,
    padding: 22,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 11,
  },
  segmentBtnActive: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  segmentText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.muted,
  },
  segmentTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  formHeader: {
    marginBottom: 18,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  formSub: {
    fontSize: 12.5,
    color: colors.muted,
    lineHeight: 17,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    color: colors.error,
    fontSize: 12.5,
    fontWeight: '600',
  },
  slugToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 2,
  },
  slugToggleText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  slugBox: {
    marginTop: 2,
    marginBottom: 6,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    paddingHorizontal: 24,
  },
  footerText: {
    textAlign: 'center',
    color: colors.textSubtle,
    fontSize: 11,
    fontWeight: '500',
  },
});
