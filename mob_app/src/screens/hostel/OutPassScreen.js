// mob_app/src/screens/hostel/OutPassScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';
import GradientHero from '../../components/common/GradientHero';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';

export default function OutPassScreen() {
  const [passes, setPasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await client.get('/hostel/out-passes').catch(() => ({ data: [] }));
      const list = Array.isArray(res.data) ? res.data : res.data?.out_passes || [];
      setPasses(list);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUpdateStatus = async (passId, status) => {
    setProcessingId(passId);
    try {
      await client.patch(`/hostel/out-passes/${passId}/status`, { status });
      Alert.alert('Status Updated', `Out pass successfully ${status.toLowerCase()}ed.`);
      load(true);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to update pass');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4338ca" />
        <Text style={styles.loadingText}>Fetching Gate Permits...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            colors={['#4338ca']}
            tintColor="#4338ca"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <GradientHero
          tagline="HOSTEL RESIDENCE"
          title="Gate Out-Passes"
          subtitle="Verification, parent consent, and gate security approval"
          avatarText="G"
          gradientColors={['#1e1b4b', '#312e81', '#4338ca']}
        />

        {passes.length > 0 ? (
          passes.map((p, i) => {
            const isApproved = String(p.status).toUpperCase() === 'APPROVED';
            const isRejected = String(p.status).toUpperCase() === 'REJECTED';
            const isPending = !isApproved && !isRejected;

            return (
              <Card
                key={p.id || i}
                padding={16}
                leftAccentColor={isApproved ? colors.success : isRejected ? colors.error : colors.warning}
              >
                <View style={styles.passHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.studentName}>{p.student_name || 'Hostel Student'}</Text>
                    <Text style={styles.roomSub}>
                      Room #{p.room_number || '—'} · Bed #{p.bed_number || '1'}
                    </Text>
                  </View>
                  <Badge
                    label={p.status || 'Pending'}
                    variant={isApproved ? 'success' : isRejected ? 'error' : 'warning'}
                    showDot
                  />
                </View>

                <View style={styles.reasonBox}>
                  <Text style={styles.reasonLabel}>Purpose & Destination:</Text>
                  <Text style={styles.reasonText}>{p.reason || p.purpose || 'Personal / Weekend Leave'}</Text>
                  {p.destination ? (
                    <Text style={styles.destinationText}>📍 {p.destination}</Text>
                  ) : null}
                </View>

                <View style={styles.timeGrid}>
                  <View style={styles.timeItem}>
                    <Text style={styles.timeItemLabel}>Expected Out</Text>
                    <Text style={styles.timeItemVal}>
                      {p.out_time ? new Date(p.out_time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Today'}
                    </Text>
                  </View>
                  <View style={styles.timeItem}>
                    <Text style={styles.timeItemLabel}>Expected Return</Text>
                    <Text style={styles.timeItemVal}>
                      {p.return_time ? new Date(p.return_time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Tomorrow'}
                    </Text>
                  </View>
                </View>

                {isPending && (
                  <View style={styles.btnRow}>
                    <Button
                      title="Approve"
                      variant="success"
                      size="sm"
                      icon="checkmark-outline"
                      loading={processingId === p.id}
                      onPress={() => handleUpdateStatus(p.id, 'APPROVED')}
                      style={{ flex: 1, marginRight: 8 }}
                    />
                    <Button
                      title="Reject"
                      variant="danger"
                      size="sm"
                      icon="close-outline"
                      loading={processingId === p.id}
                      onPress={() => handleUpdateStatus(p.id, 'REJECTED')}
                      style={{ flex: 1 }}
                    />
                  </View>
                )}
              </Card>
            );
          })
        ) : (
          <EmptyState
            icon="key-outline"
            title="No Active Out Passes"
            description="All student gate passes and leave requests are currently processed."
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: colors.muted,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  passHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  roomSub: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 1,
  },
  reasonBox: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  reasonLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  reasonText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  destinationText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    fontWeight: '600',
  },
  timeGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    marginBottom: 8,
  },
  timeItem: {
    flex: 1,
  },
  timeItemLabel: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '600',
  },
  timeItemVal: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginTop: 1,
  },
  btnRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
});
