// mob_app/src/screens/audit/AuditLogsScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, TextInput, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';

const MODULES = [
  'ALL', 'AUTH', 'ACADEMIC', 'ATTENDANCE', 'MARKS', 'FINANCE',
  'HRMS', 'HOSTEL', 'TRANSPORT', 'LIBRARY', 'SYSTEM',
];

const SEVERITIES = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'INFO'];

function formatTimestamp(isoStr) {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    return `${d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
  } catch {
    return isoStr;
  }
}

function timeAgo(isoStr) {
  if (!isoStr) return '';
  try {
    const seconds = Math.floor((new Date() - new Date(isoStr)) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return '';
  }
}

function getSeverityBadge(severity) {
  const sev = (severity || 'INFO').toUpperCase();
  switch (sev) {
    case 'CRITICAL':
      return { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' };
    case 'HIGH':
      return { bg: '#ffedd5', text: '#c2410c', border: '#fdba74' };
    case 'MEDIUM':
      return { bg: '#fef3c7', text: '#b45309', border: '#fde68a' };
    case 'LOW':
      return { bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd' };
    case 'INFO':
    default:
      return { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' };
  }
}

function getStatusBadge(status) {
  const s = (status || '').toUpperCase();
  if (s === 'FAILED' || s === 'FAILURE' || s === 'DENIED') {
    return { bg: '#fee2e2', text: '#dc2626', border: '#fca5a5', label: 'FAILED' };
  }
  return { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0', label: 'SUCCESS' };
}

export default function AuditLogsScreen({ navigation }) {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({
    total_events: 0,
    today_events: 0,
    critical_events: 0,
    failed_events: 0,
    delegated_events: 0,
    retention_days: 365,
  });

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Pagination & Filters
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedModule, setSelectedModule] = useState('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState('ALL');
  const [search, setSearch] = useState('');
  const [detailItem, setDetailItem] = useState(null);

  // Load Stats
  const loadStats = useCallback(async () => {
    try {
      const res = await client.get('/audit/school/logs/stats').catch(() => ({ data: {} }));
      if (res.data) {
        setStats(prev => ({ ...prev, ...res.data }));
      }
    } catch {
      // keep fallback
    }
  }, []);

  // Load Logs
  const loadLogs = useCallback(async (pageNum = 1, isRefresh = false) => {
    if (pageNum === 1) {
      if (isRefresh) setRefreshing(true); else setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const params = {
        page: pageNum,
        per_page: 20,
      };
      if (selectedModule !== 'ALL') params.module = selectedModule;
      if (selectedSeverity !== 'ALL') params.severity = selectedSeverity;
      if (search.trim()) params.q = search.trim();

      const res = await client.get('/audit/school/logs', { params }).catch(() => ({ data: { logs: [], total: 0 } }));
      const newLogs = Array.isArray(res.data?.logs) ? res.data.logs : [];
      const totalCount = res.data?.total || 0;

      if (pageNum === 1) {
        setLogs(newLogs);
      } else {
        setLogs(prev => [...prev, ...newLogs]);
      }
      setTotal(totalCount);
      setPage(pageNum);
    } catch {
      if (pageNum === 1) setLogs([]);
    } finally {
      if (pageNum === 1) {
        if (isRefresh) setRefreshing(false);
        setLoading(false);
      } else {
        setLoadingMore(false);
      }
    }
  }, [selectedModule, selectedSeverity, search]);

  useEffect(() => {
    loadStats();
    loadLogs(1);
  }, [loadStats, loadLogs]);

  const handleRefresh = () => {
    loadStats();
    loadLogs(1, true);
  };

  const handleLoadMore = () => {
    if (!loading && !loadingMore && logs.length < total) {
      loadLogs(page + 1);
    }
  };

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
            <Text style={styles.headerTitle}>Audit Trail & Security Logs</Text>
            <Text style={styles.headerSubtitle}>Forensic compliance & system history</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={handleRefresh}>
          <Ionicons name="refresh" size={18} color="#64748b" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />}
      >
        {/* Metric Cards */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metricsRow}>
          <View style={[styles.metricCard, { backgroundColor: '#4338ca10', borderColor: '#4338ca30' }]}>
            <Text style={[styles.metricVal, { color: '#4338ca' }]}>{stats.total_events}</Text>
            <Text style={styles.metricLabel}>Total Audits</Text>
          </View>
          <View style={[styles.metricCard, { backgroundColor: '#0284c710', borderColor: '#0284c730' }]}>
            <Text style={[styles.metricVal, { color: '#0284c7' }]}>{stats.today_events}</Text>
            <Text style={styles.metricLabel}>Today&apos;s Actions</Text>
          </View>
          <View style={[styles.metricCard, { backgroundColor: '#dc262610', borderColor: '#dc262630' }]}>
            <Text style={[styles.metricVal, { color: '#dc2626' }]}>{stats.critical_events}</Text>
            <Text style={styles.metricLabel}>Critical/High</Text>
          </View>
          <View style={[styles.metricCard, { backgroundColor: '#d9770610', borderColor: '#d9770630' }]}>
            <Text style={[styles.metricVal, { color: '#d97706' }]}>{stats.failed_events}</Text>
            <Text style={styles.metricLabel}>Denied/Failed</Text>
          </View>
          <View style={[styles.metricCard, { backgroundColor: '#7c3aed10', borderColor: '#7c3aed30' }]}>
            <Text style={[styles.metricVal, { color: '#7c3aed' }]}>{stats.delegated_events}</Text>
            <Text style={styles.metricLabel}>Substitute Ops</Text>
          </View>
        </ScrollView>

        {/* Module Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterTabsRow}>
          {MODULES.map(m => {
            const isActive = selectedModule === m;
            return (
              <TouchableOpacity
                key={m}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setSelectedModule(m)}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {m}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Severity Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.filterTabsRow, { marginBottom: 12 }]}>
          {SEVERITIES.map(s => {
            const isActive = selectedSeverity === s;
            return (
              <TouchableOpacity
                key={s}
                style={[styles.filterChip, isActive && [styles.filterChipActive, { backgroundColor: '#475569', borderColor: '#475569' }]]}
                onPress={() => setSelectedSeverity(s)}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {s === 'ALL' ? 'All Severities' : s}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Search Input */}
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#64748b" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search action, user, IP, or remarks..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => loadLogs(1)}
          />
          {Boolean(search) && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Loading Spinner */}
        {loading && (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Fetching audit logs...</Text>
          </View>
        )}

        {/* Empty State */}
        {!loading && logs.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="shield-checkmark-outline" size={56} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>No Audit Records Found</Text>
            <Text style={styles.emptySubtitle}>
              No security or operational actions match the selected filters.
            </Text>
          </View>
        )}

        {/* Audit Log Cards */}
        {!loading && logs.map(item => {
          const sevStyle = getSeverityBadge(item.severity);
          const statusStyle = getStatusBadge(item.status);

          return (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => setDetailItem(item)}
            >
              {/* Card Top: Badges & Time */}
              <View style={styles.cardHeader}>
                <View style={styles.badgesRow}>
                  <View style={[styles.badge, { backgroundColor: sevStyle.bg, borderColor: sevStyle.border }]}>
                    <Text style={[styles.badgeText, { color: sevStyle.text }]}>
                      {item.severity || 'INFO'}
                    </Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: statusStyle.bg, borderColor: statusStyle.border, marginLeft: 4 }]}>
                    <Text style={[styles.badgeText, { color: statusStyle.text }]}>
                      {statusStyle.label}
                    </Text>
                  </View>
                  <View style={[styles.moduleBadge, { marginLeft: 4 }]}>
                    <Text style={styles.moduleBadgeText}>{item.module}</Text>
                  </View>
                </View>
                <Text style={styles.timeAgoText}>{timeAgo(item.created_at)}</Text>
              </View>

              {/* Action Title */}
              <Text style={styles.actionTitle}>{item.action}</Text>

              {/* Actor & Entity Info */}
              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Ionicons name="person-outline" size={13} color="#64748b" style={{ marginRight: 4 }} />
                  <Text style={styles.metaText}>
                    {item.user_name || 'System Actor'} {item.role_snapshot ? `(${item.role_snapshot})` : ''}
                  </Text>
                </View>
                {Boolean(item.ip_address) && (
                  <View style={styles.metaItem}>
                    <Ionicons name="globe-outline" size={13} color="#94a3b8" style={{ marginRight: 4 }} />
                    <Text style={styles.metaText}>{item.ip_address}</Text>
                  </View>
                )}
              </View>

              {/* Delegation Tag if Substitute */}
              {item.is_delegated && (
                <View style={styles.delegatedRow}>
                  <Ionicons name="swap-horizontal" size={13} color="#7c3aed" style={{ marginRight: 4 }} />
                  <Text style={styles.delegatedText}>
                    Substitute Operation {item.delegation_info?.source_teacher_name ? `for ${item.delegation_info.source_teacher_name}` : ''}
                  </Text>
                </View>
              )}

              {/* Target Class/Student if exists */}
              {(item.student_name || item.class_name || item.subject_name) && (
                <View style={styles.targetRow}>
                  {Boolean(item.student_name) && (
                    <Text style={styles.targetChip}>Student: {item.student_name}</Text>
                  )}
                  {Boolean(item.class_name) && (
                    <Text style={styles.targetChip}>Class: {item.class_name}</Text>
                  )}
                  {Boolean(item.subject_name) && (
                    <Text style={styles.targetChip}>Subject: {item.subject_name}</Text>
                  )}
                </View>
              )}

              {/* Remarks */}
              {Boolean(item.remarks) && (
                <Text style={styles.remarksText} numberOfLines={2}>
                  {item.remarks}
                </Text>
              )}

              {/* Card Footer: Timestamp */}
              <View style={styles.cardFooter}>
                <Text style={styles.timestampText}>{formatTimestamp(item.created_at)}</Text>
                <View style={styles.viewDetailsRow}>
                  <Text style={styles.viewDetailsText}>Forensic Details</Text>
                  <Ionicons name="chevron-forward" size={13} color={colors.primary} />
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Load More Button */}
        {!loading && logs.length < total && (
          <TouchableOpacity
            style={styles.loadMoreBtn}
            onPress={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.loadMoreText}>
                Load More ({logs.length} of {total})
              </Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* DETAIL MODAL */}
      <Modal visible={Boolean(detailItem)} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Audit Event #{detailItem?.id}</Text>
                <Text style={styles.modalSubtitle}>{formatTimestamp(detailItem?.created_at)}</Text>
              </View>
              <TouchableOpacity onPress={() => setDetailItem(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            {detailItem && (
              <ScrollView style={{ maxHeight: 420 }}>
                {/* Action & Status */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Action & Severity</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Action Name:</Text>
                    <Text style={[styles.detailValue, { fontWeight: 'bold' }]}>{detailItem.action}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Module / Submodule:</Text>
                    <Text style={styles.detailValue}>
                      {detailItem.module} {detailItem.submodule ? `• ${detailItem.submodule}` : ''}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Severity Level:</Text>
                    <Text style={[styles.detailValue, { color: getSeverityBadge(detailItem.severity).text }]}>
                      {detailItem.severity || 'INFO'}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Execution Status:</Text>
                    <Text style={[styles.detailValue, { color: getStatusBadge(detailItem.status).text }]}>
                      {detailItem.status || 'SUCCESS'}
                    </Text>
                  </View>
                </View>

                {/* Actor Profile */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Actor Context</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Actor Name:</Text>
                    <Text style={styles.detailValue}>{detailItem.user_name || 'System Internal'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Role Snapshot:</Text>
                    <Text style={styles.detailValue}>{detailItem.role_snapshot || 'N/A'}</Text>
                  </View>
                  {Boolean(detailItem.employee_id) && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Employee ID:</Text>
                      <Text style={styles.detailValue}>{detailItem.employee_id}</Text>
                    </View>
                  )}
                  {Boolean(detailItem.department) && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Department:</Text>
                      <Text style={styles.detailValue}>{detailItem.department}</Text>
                    </View>
                  )}
                </View>

                {/* Network & Device */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Network & Client Context</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>IP Address:</Text>
                    <Text style={styles.detailValue}>{detailItem.ip_address || 'Internal'}</Text>
                  </View>
                  {Boolean(detailItem.browser || detailItem.os) && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Device / OS:</Text>
                      <Text style={styles.detailValue}>
                        {[detailItem.browser, detailItem.os].filter(Boolean).join(' • ')}
                      </Text>
                    </View>
                  )}
                  {Boolean(detailItem.api_endpoint) && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>API Endpoint:</Text>
                      <Text style={styles.detailValue}>
                        {detailItem.http_method} {detailItem.api_endpoint}
                      </Text>
                    </View>
                  )}
                  {Boolean(detailItem.status_code) && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>HTTP Status Code:</Text>
                      <Text style={styles.detailValue}>{detailItem.status_code}</Text>
                    </View>
                  )}
                </View>

                {/* Changed Fields / Forensics */}
                {detailItem.changed_fields && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Modified Fields (Before / After)</Text>
                    <View style={styles.codeBlock}>
                      <Text style={styles.codeText}>
                        {typeof detailItem.changed_fields === 'object'
                          ? JSON.stringify(detailItem.changed_fields, null, 2)
                          : String(detailItem.changed_fields)}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Remarks */}
                {Boolean(detailItem.remarks) && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Remarks / System Output</Text>
                    <Text style={styles.remarksDetailText}>{detailItem.remarks}</Text>
                  </View>
                )}
              </ScrollView>
            )}

            <TouchableOpacity style={styles.modalPrimaryBtn} onPress={() => setDetailItem(null)}>
              <Text style={styles.modalPrimaryBtnText}>Close Forensics</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    padding: 14,
    paddingBottom: 40,
  },
  metricsRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  metricCard: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 10,
    alignItems: 'center',
    minWidth: 84,
  },
  metricVal: {
    fontSize: 18,
    fontWeight: '800',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
  },
  filterTabsRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 6,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    padding: 0,
  },
  centerContainer: {
    padding: 30,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 36,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  moduleBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  moduleBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  timeAgoText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    color: '#64748b',
  },
  delegatedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f3ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 6,
  },
  delegatedText: {
    fontSize: 11,
    color: '#6d28d9',
    fontWeight: '600',
  },
  targetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 6,
  },
  targetChip: {
    fontSize: 11,
    color: '#0369a1',
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: '500',
  },
  remarksText: {
    fontSize: 12,
    color: '#334155',
    marginBottom: 8,
    lineHeight: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 6,
    marginTop: 2,
  },
  timestampText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  viewDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewDetailsText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  loadMoreBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  loadMoreText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  modalCloseBtn: {
    padding: 4,
  },
  detailSection: {
    marginBottom: 12,
  },
  detailSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
    textAlign: 'right',
    flex: 1,
    marginLeft: 8,
  },
  codeBlock: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 10,
  },
  codeText: {
    color: '#38bdf8',
    fontFamily: 'monospace',
    fontSize: 11,
  },
  remarksDetailText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
  },
  modalPrimaryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 14,
  },
  modalPrimaryBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
