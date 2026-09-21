// mob_app/src/screens/auth/LoginScreen.js
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';

let LinearGradient;
try {
  LinearGradient = require('expo-linear-gradient').LinearGradient;
} catch (e) {
  LinearGradient = null;
}

export default function LoginScreen({ navigation }) {
  const { login, studentLogin } = useAuth();

  // Exactly 3 roles as requested by user: 'Staff' | 'Student' | 'Parents'
  const [role, setRole] = useState('Staff');

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Auto-fill remembered identifier if present
  useEffect(() => {
    SecureStore.getItemAsync('remembered_identifier').then(saved => {
      if (saved) setIdentifier(saved);
    }).catch(() => {});
  }, []);

  const handleLogin = async () => {
    if (!identifier.trim() || !password.trim()) {
      setError('Please enter your email or phone and password.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      if (rememberMe) {
        await SecureStore.setItemAsync('remembered_identifier', identifier.trim());
      } else {
        await SecureStore.deleteItemAsync('remembered_identifier').catch(() => {});
      }

      if (role === 'Student') {
        // Direct Student Authentication
        await studentLogin({
          phone: identifier.trim(),
          name: identifier.trim(),
          password: password.trim(),
        });
      } else {
        // Staff & Parents Unified Authentication
        await login({
          identifier: identifier.trim(),
          password: password.trim(),
        });
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Login failed. Please check credentials.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const GradientButtonWrapper = LinearGradient || TouchableOpacity;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Top Logo Icon */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Ionicons name="school" size={40} color={colors.primary} />
          </View>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>
        </View>

        {/* 3-Pill Role Selector: Staff, Student, Parents */}
        <View style={styles.roleTabsWrapper}>
          {['Staff', 'Student', 'Parents'].map(r => {
            const isActive = role === r;
            return (
              <TouchableOpacity
                key={r}
                style={[styles.roleTab, isActive && styles.roleTabActive]}
                onPress={() => { setRole(r); setError(null); }}
                activeOpacity={0.8}
              >
                <Text style={[styles.roleTabText, isActive && styles.roleTabTextActive]}>
                  {r}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Error Alert */}
        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color={colors.error} style={{ marginRight: 8 }} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Email or Phone Input */}
        <View style={styles.inputGroup}>
          <View style={styles.inputContainer}>
            <Ionicons
              name={role === 'Student' ? 'call-outline' : 'mail-outline'}
              size={20}
              color={colors.muted}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder={role === 'Student' ? 'Registered Mobile Number' : 'Email or Phone'}
              placeholderTextColor={colors.textSubtle}
              value={identifier}
              onChangeText={setIdentifier}
              keyboardType={role === 'Student' ? 'phone-pad' : 'email-address'}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        {/* Password Input */}
        <View style={styles.inputGroup}>
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.muted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.textSubtle}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(p => !p)}
              style={styles.eyeBtn}
              activeOpacity={0.7}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.muted}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Remember Me & Forgot Password Row */}
        <View style={styles.rowBetween}>
          <TouchableOpacity
            style={styles.rememberRow}
            onPress={() => setRememberMe(r => !r)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
              {rememberMe && <Ionicons name="checkmark" size={13} color="#ffffff" />}
            </View>
            <Text style={styles.rememberText}>Remember me</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => Alert.alert('Forgot Password', 'Please contact your school administrator or enter your registered email to receive a password reset link.')}
            activeOpacity={0.7}
          >
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>
        </View>

        {/* Radiant Gradient Login Button */}
        <TouchableOpacity
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.85}
          style={styles.loginBtnShadow}
        >
          {LinearGradient ? (
            <LinearGradient
              colors={colors.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.loginBtn}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <View style={styles.btnContent}>
                  <Text style={styles.loginBtnText}>Login</Text>
                  <Ionicons name="arrow-forward" size={18} color="#ffffff" style={{ marginLeft: 8 }} />
                </View>
              )}
            </LinearGradient>
          ) : (
            <View style={[styles.loginBtn, { backgroundColor: colors.primary }]}>
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <View style={styles.btnContent}>
                  <Text style={styles.loginBtnText}>Login</Text>
                  <Ionicons name="arrow-forward" size={18} color="#ffffff" style={{ marginLeft: 8 }} />
                </View>
              )}
            </View>
          )}
        </TouchableOpacity>

        {/* Or Continue With */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>Or continue with</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Social SSO Buttons */}
        <View style={styles.socialRow}>
          <TouchableOpacity style={styles.socialBtn} activeOpacity={0.8}>
            <FontAwesome5 name="google" size={19} color="#ea4335" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.socialBtn} activeOpacity={0.8}>
            <FontAwesome5 name="microsoft" size={19} color="#00a4ef" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.socialBtn} activeOpacity={0.8}>
            <Ionicons name="logo-apple" size={22} color="#000000" />
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity activeOpacity={0.7} onPress={() => Alert.alert('Account Registration', 'Student & staff accounts are provisioned by your school administration.')}>
            <Text style={styles.contactAdminText}>Contact Admin</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 32,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    fontWeight: '500',
  },
  roleTabsWrapper: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 14,
    padding: 4,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleTab: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  roleTabActive: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 3,
  },
  roleTabText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.muted,
  },
  roleTabTextActive: {
    color: '#ffffff',
    fontWeight: '800',
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
    fontSize: 12.5,
    color: colors.error,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14.5,
    color: colors.text,
    fontWeight: '500',
  },
  eyeBtn: {
    padding: 6,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    marginTop: 2,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  rememberText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  forgotText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '700',
  },
  loginBtnShadow: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
    borderRadius: 14,
    marginBottom: 28,
  },
  loginBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderLight,
  },
  dividerText: {
    paddingHorizontal: 12,
    fontSize: 12,
    color: colors.textSubtle,
    fontWeight: '600',
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 32,
  },
  socialBtn: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    fontSize: 13,
    color: colors.muted,
  },
  contactAdminText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
});
