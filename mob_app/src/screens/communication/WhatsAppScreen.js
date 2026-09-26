// mob_app/src/screens/communication/WhatsAppScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';

const AUTOMATION_TRIGGERS = [
  {
    id: 'FEES',
    title: 'Fee Payment Receipts & Dues',
    desc: 'Instant PDF receipt dispatch upon collection & automated overdue fee reminders.',
    icon: 'cash-outline',
    color: '#16a34a',
    bg: '#dcfce7',
  },
  {
    id: 'ATTENDANCE',
    title: 'Daily Absentee Alerts',
    desc: 'Automated SMS/WhatsApp to parents when student is marked ABSENT during morning roll call.',
    icon: 'calendar-outline',
    color: '#0284c7',
    bg: '#e0f2fe',
  },
  {
    id: 'EXAM',
    title: 'Admit Cards & Exam RMS',
    desc: 'Datesheets, examination hall tickets, and published report cards sent directly to parents.',
    icon: 'ribbon-outline',
    color: '#7c3aed',
    bg: '#ede9fe',
  },
  {
    id: 'NOTICES',
    title: 'Urgent Circulars & Holidays',
    desc: 'High-priority administrative circulars, storm alerts, and holiday notifications broadcast.',
    icon: 'megaphone-outline',
    color: '#ea580c',
    bg: '#ffedd5',
  },
];

export default function WhatsAppScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const [settings, setSettings] = useState(null);

  // Form State
  const [businessName, setBusinessName] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [businessAccountId, setBusinessAccountId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [appId, setAppId] = useState('');
  const [apiVersion, setApiVersion] = useState('v21.0');

  // Load Settings
  const loadSettings = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await client.get('/principal/whatsapp/settings');
      const data = res.data || {};
      setSettings(data);

      setBusinessName(data.business_name || '');
      setBusinessPhone(data.business_phone || '');
      setPhoneNumberId(data.phone_number_id || '');
      setBusinessAccountId(data.business_account_id || '');
      setVerifyToken(data.verify_token || '');
      setAppId(data.app_id || '');
      setApiVersion(data.api_version || 'v21.0');
      setAccessToken('');
      setAppSecret('');
    } catch {
      setSettings(null);
    } finally {
      if (isRefresh) setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Save Settings
  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        business_name: businessName.trim(),
        business_phone: businessPhone.trim(),
        phone_number_id: phoneNumberId.trim(),
        business_account_id: businessAccountId.trim(),
        verify_token: verifyToken.trim(),
        app_id: appId.trim(),
        api_version: apiVersion.trim() || 'v21.0',
      };

      if (accessToken.trim()) payload.access_token = accessToken.trim();
      if (appSecret.trim()) payload.app_secret = appSecret.trim();

      const res = await client.post('/principal/whatsapp/settings', payload);
      setSettings(res.data);
      setAccessToken('');
      setAppSecret('');
      Alert.alert('Saved', 'WhatsApp configuration saved successfully!');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to save configuration.');
    } finally {
      setSaving(false);
    }
  };

  // Test & Verify Live Connection
  const handleVerify = async () => {
    setVerifying(true);
    try {
      const res = await client.post('/principal/whatsapp/settings/verify');
      Alert.alert('Connected!', res.data?.message || 'Meta Cloud API verified successfully.');
      loadSettings();
    } catch (err) {
      Alert.alert('Verification Failed', err.response?.data?.error || 'Could not verify WhatsApp connection.');
      loadSettings();
    } finally {
      setVerifying(false);
    }
  };

  // Disconnect Gateway
  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect WhatsApp?',
      'The saved access token will be removed and automatic message dispatch will pause.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            setDisconnecting(true);
            try {
              await client.delete('/principal/whatsapp/settings');
              Alert.alert('Disconnected', 'WhatsApp integration disconnected.');
              loadSettings();
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error || 'Failed to disconnect.');
            } finally {
              setDisconnecting(false);
            }
          },
        },
      ]
    );
  };

  const getStatusBadge = () => {
    const status = settings?.connection_status || 'DISCONNECTED';
    if (status === 'CONNECTED') {
      return {
        bg: '#dcfce7',
        text: '#15803d',
        border: '#86efac',
        icon: 'checkmark-circle',
        label: 'ACTIVE & CONNECTED',
      };
    }
    if (status === 'FAILED') {
      return {
        bg: '#fee2e2',
        text: '#b91c1c',
        border: '#fca5a5',
        icon: 'alert-circle',
        label: 'VERIFICATION FAILED',
      };
    }
    return {
      bg: '#f1f5f9',
      text: '#475569',
      border: '#cbd5e1',
      icon: 'radio-button-off',
      label: 'DISCONNECTED',
    };
  };

  const statusStyle = getStatusBadge();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
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
            <Text style={styles.headerTitle}>WhatsApp Gateway</Text>
            <Text style={styles.headerSubtitle}>Meta Cloud API & automated alerts</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => loadSettings(true)}
          disabled={loading}
        >
          <Ionicons name="refresh" size={18} color="#64748b" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadSettings(true)} colors={[colors.primary]} />}
      >
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading WhatsApp gateway...</Text>
          </View>
        ) : (
          <>
            {/* HERO STATUS CARD */}
            <View style={styles.heroCard}>
              <View style={styles.heroTop}>
                <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg, borderColor: statusStyle.border }]}>
                  <Ionicons name={statusStyle.icon} size={14} color={statusStyle.text} style={{ marginRight: 4 }} />
                  <Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>
                    {statusStyle.label}
                  </Text>
                </View>
                <Text style={styles.heroApiVer}>API {settings?.api_version || 'v21.0'}</Text>
              </View>

              <Text style={styles.heroBusinessName}>
                {settings?.business_name || 'WhatsApp Business Gateway'}
              </Text>
              <Text style={styles.heroPhone}>
                {settings?.business_phone ? `Phone: ${settings.business_phone}` : 'No phone number linked'}
              </Text>

              {Boolean(settings?.last_test_result) && (
                <View style={styles.testResultBox}>
                  <Text style={styles.testResultLabel}>Diagnostic Output:</Text>
                  <Text style={styles.testResultText}>{settings.last_test_result}</Text>
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.heroActionsRow}>
                <TouchableOpacity
                  style={[styles.verifyBtn, verifying && { opacity: 0.7 }]}
                  onPress={handleVerify}
                  disabled={verifying}
                >
                  {verifying ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="flash" size={15} color="#fff" />
                      <Text style={styles.verifyBtnText}>Verify Live Connection</Text>
                    </>
                  )}
                </TouchableOpacity>

                {settings?.connection_status === 'CONNECTED' && (
                  <TouchableOpacity
                    style={[styles.disconnectBtn, disconnecting && { opacity: 0.7 }]}
                    onPress={handleDisconnect}
                    disabled={disconnecting}
                  >
                    <Ionicons name="power-outline" size={15} color="#dc2626" />
                    <Text style={styles.disconnectBtnText}>Disconnect</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* AUTOMATED TRIGGERS OVERVIEW */}
            <Text style={styles.sectionHeader}>AUTOMATED NOTIFICATION TRIGGERS</Text>
            <View style={styles.triggersGrid}>
              {AUTOMATION_TRIGGERS.map(t => (
                <View key={t.id} style={styles.triggerCard}>
                  <View style={[styles.triggerIconBox, { backgroundColor: t.bg }]}>
                    <Ionicons name={t.icon} size={20} color={t.color} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.triggerTitle}>{t.title}</Text>
                    <Text style={styles.triggerDesc}>{t.desc}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* CREDENTIALS CONFIGURATION FORM */}
            <Text style={[styles.sectionHeader, { marginTop: 20 }]}>META CLOUD API CREDENTIALS</Text>
            <View style={styles.formCard}>
              <Text style={styles.formLabel}>Business Display Name</Text>
              <TextInput
                style={styles.formInput}
                value={businessName}
                onChangeText={setBusinessName}
                placeholder="e.g. St. Xavier International School"
              />

              <Text style={styles.formLabel}>Business Phone Number</Text>
              <TextInput
                style={styles.formInput}
                value={businessPhone}
                onChangeText={setBusinessPhone}
                placeholder="+91 98765 43210"
                keyboardType="phone-pad"
              />

              <Text style={styles.formLabel}>Phone Number ID</Text>
              <TextInput
                style={styles.formInput}
                value={phoneNumberId}
                onChangeText={setPhoneNumberId}
                placeholder="From Meta App Dashboard -> WhatsApp"
              />

              <Text style={styles.formLabel}>WhatsApp Business Account ID (WABA ID)</Text>
              <TextInput
                style={styles.formInput}
                value={businessAccountId}
                onChangeText={setBusinessAccountId}
                placeholder="15-16 digit WABA ID"
              />

              <Text style={styles.formLabel}>
                Permanent Access Token{' '}
                {settings?.has_access_token && (
                  <Text style={styles.savedTokenHint}>({settings.access_token_masked})</Text>
                )}
              </Text>
              <TextInput
                style={styles.formInput}
                value={accessToken}
                onChangeText={setAccessToken}
                placeholder={settings?.has_access_token ? 'Leave blank to keep existing token' : 'EAAG...'}
                secureTextEntry
              />

              <Text style={styles.formLabel}>
                App Secret (Optional){' '}
                {settings?.has_app_secret && (
                  <Text style={styles.savedTokenHint}>({settings.app_secret_masked})</Text>
                )}
              </Text>
              <TextInput
                style={styles.formInput}
                value={appSecret}
                onChangeText={setAppSecret}
                placeholder={settings?.has_app_secret ? 'Leave blank to keep existing secret' : 'Meta App Secret'}
                secureTextEntry
              />

              <Text style={styles.formLabel}>Meta App ID</Text>
              <TextInput
                style={styles.formInput}
                value={appId}
                onChangeText={setAppId}
                placeholder="App ID from Meta developers console"
              />

              <Text style={styles.formLabel}>Graph API Version</Text>
              <TextInput
                style={styles.formInput}
                value={apiVersion}
                onChangeText={setApiVersion}
                placeholder="v21.0"
              />

              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={17} color="#fff" />
                    <Text style={styles.saveBtnText}>Save WhatsApp Settings</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* WEBHOOK CALLBACK INSTRUCTIONS */}
            <Text style={[styles.sectionHeader, { marginTop: 20 }]}>WEBHOOK CALLBACK CONFIGURATION</Text>
            <View style={styles.webhookCard}>
              <Text style={styles.webhookDesc}>
                Set up this webhook in Meta App Dashboard to receive real-time message delivery receipts and parent replies:
              </Text>

              <Text style={styles.webhookLabel}>Webhook Callback URL</Text>
              <View style={styles.copyBox}>
                <TextInput
                  style={styles.copyInput}
                  value={settings?.webhook_url || 'https://.../api/webhooks/whatsapp'}
                  editable={false}
                  selectTextOnFocus
                />
                <TouchableOpacity
                  style={styles.copyBtn}
                  onPress={() => Alert.alert('Webhook Callback URL', settings?.webhook_url || '')}
                >
                  <Ionicons name="copy-outline" size={16} color={colors.primary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.webhookLabel}>Verify Token</Text>
              <TextInput
                style={styles.formInput}
                value={verifyToken}
                onChangeText={setVerifyToken}
                placeholder="Custom secret token string"
              />
            </View>
          </>
        )}
      </ScrollView>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    marginRight: 10,
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  refreshBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  centerContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 8,
  },
  heroCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  heroApiVer: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
  },
  heroBusinessName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 2,
  },
  heroPhone: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 10,
  },
  testResultBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  testResultLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  testResultText: {
    fontSize: 12,
    color: '#334155',
  },
  heroActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  verifyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16a34a',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  verifyBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  disconnectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fca5a5',
    backgroundColor: '#fee2e240',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 4,
  },
  disconnectBtnText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '600',
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  triggersGrid: {
    gap: 8,
  },
  triggerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  triggerIconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  triggerDesc: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    lineHeight: 15,
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
    marginTop: 8,
  },
  savedTokenHint: {
    color: '#16a34a',
    fontSize: 11,
    fontWeight: 'normal',
  },
  formInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0f172a',
    marginBottom: 4,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 14,
    gap: 6,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  webhookCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  webhookDesc: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 17,
    marginBottom: 12,
  },
  webhookLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
  },
  copyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  copyInput: {
    flex: 1,
    fontSize: 12,
    color: '#475569',
    paddingVertical: 8,
  },
  copyBtn: {
    padding: 6,
  },
});
