// mob_app/src/screens/auth/LoginScreen.js
// Login screen — connects to same /api/auth/login backend endpoint.

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../../context/AuthContext';

export default function LoginScreen() {
  const { login } = useAuth();
  const [identifier,  setIdentifier]  = useState('');
  const [password,    setPassword]    = useState('');
  const [schoolSlug,  setSchoolSlug]  = useState('');
  const [showSlug,    setShowSlug]    = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [showPass,    setShowPass]    = useState(false);

  const handleLogin = async () => {
    if (!identifier.trim() || !password.trim()) {
      Alert.alert('Required', 'Please enter your email/phone and password.');
      return;
    }
    setLoading(true);
    try {
      await login({
        identifier: identifier.trim(),
        password: password.trim(),
        school_slug: schoolSlug.trim() || undefined,
      });
      // Navigation is handled automatically by AppNavigator when user is set
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Login failed. Please try again.';
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>ERP</Text>
          </View>
          <Text style={styles.brand}>EduERP</Text>
          <Text style={styles.tagline}>School & College Management Platform</Text>
          <View style={styles.poweredBadge}>
            <Text style={styles.poweredText}>POWERED BY 1P360</Text>
          </View>
        </View>

        {/* Form */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome Back</Text>
          <Text style={styles.cardSub}>Sign in to your institution portal</Text>

          <Text style={styles.label}>Email / Phone / Employee ID</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your identifier"
            placeholderTextColor="#94a3b8"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="next"
          />

          <Text style={styles.label}>Password</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Enter your password"
              placeholderTextColor="#94a3b8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPass}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity onPress={() => setShowPass(p => !p)} style={styles.eyeBtn}>
              <Text style={{ fontSize: 18 }}>{showPass ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => setShowSlug(v => !v)}
            style={styles.slugToggle}
          >
            <Text style={styles.slugToggleText}>
              {showSlug ? '▼ Hide' : '▶ Add'} School Code (optional)
            </Text>
          </TouchableOpacity>

          {showSlug && (
            <>
              <Text style={styles.label}>School / Institution Code</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. springdale-2024"
                placeholderTextColor="#94a3b8"
                value={schoolSlug}
                onChangeText={setSchoolSlug}
                autoCapitalize="none"
              />
              <Text style={styles.hint}>
                Required only for multi-school instances. Ask your administrator.
              </Text>
            </>
          )}

          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginBtnText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          By signing in you agree to your institution's terms of use.{'\n'}
          EduERP v1.0 · Secured with AES-256 encryption
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#0176d3' },
  scroll: { flexGrow: 1, paddingBottom: 32 },

  header: { alignItems: 'center', paddingTop: 70, paddingBottom: 40, paddingHorizontal: 24 },
  logoBox: {
    width: 80, height: 80, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
  },
  logoText: { fontSize: 28, fontWeight: '800', color: '#fff' },
  brand: { fontSize: 30, fontWeight: '800', color: '#fff', letterSpacing: -0.5, marginBottom: 4 },
  tagline: { fontSize: 13, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },
  poweredBadge: { marginTop: 10, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 99 },
  poweredText: { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 1.5 },

  card: {
    backgroundColor: '#fff', borderRadius: 20, marginHorizontal: 16,
    padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12, shadowRadius: 20, elevation: 10,
  },
  cardTitle: { fontSize: 22, fontWeight: '800', color: '#1e293b', marginBottom: 4 },
  cardSub:   { fontSize: 13, color: '#64748b', marginBottom: 22 },

  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: '#1e293b', marginBottom: 14,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  eyeBtn: { paddingLeft: 10, paddingRight: 4 },

  slugToggle: { marginBottom: 10 },
  slugToggleText: { color: '#0176d3', fontWeight: '600', fontSize: 13 },
  hint: { fontSize: 11, color: '#94a3b8', marginBottom: 10, marginTop: -8 },

  loginBtn: {
    backgroundColor: '#0176d3', borderRadius: 12, paddingVertical: 15,
    alignItems: 'center', marginTop: 8,
    shadowColor: '#0176d3', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  loginBtnDisabled: { opacity: 0.7 },
  loginBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  footer: { textAlign: 'center', color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 24, paddingHorizontal: 32, lineHeight: 18 },
});
