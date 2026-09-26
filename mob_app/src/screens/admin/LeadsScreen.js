// mob_app/src/screens/admin/LeadsScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, TextInput, Modal, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';

const STATUS_CONFIG = {
  NEW:       { label: 'New Inquiry', bg: '#fee2e2', text: '#dc2626', border: '#fecaca', icon: 'flash' },
  CONTACTED: { label: 'Contacted', bg: '#fef3c7', text: '#d97706', border: '#fde68a', icon: 'call' },
  CLOSED:    { label: 'Closed / Converted', bg: '#dcfce7', text: '#16a34a', border: '#bbf7d0', icon: 'checkmark-circle' },
};

const TYPE_CONFIG = {
  DEMO:    { label: 'Demo Request', color: '#0284c7', bg: '#e0f2fe', icon: 'laptop-outline' },
  CONTACT: { label: 'Contact Inquiry', color: '#7c3aed', bg: '#ede9fe', icon: 'mail-outline' },
};

function formatTime(dateStr) {
  if (!dateStr) return '';
  try {
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    const days = Math.floor(diff / 86400);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return dateStr;
  }
}

export default function LeadsScreen({ navigation }) {
  const [leads, setLeads] = useState([]);
  const [summary, setSummary] = useState({ total: 0, new: 0, demo_requests: 0, contact_messages: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL' | 'DEMO' | 'CONTACT'
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'NEW' | 'CONTACTED' | 'CLOSED'
  const [search, setSearch] = useState('');

  // Detail & Status Update Modal
  const [selectedLead, setSelectedLead] = useState(null);
  const [detailModal, setDetailModal] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Load Leads & Summary
  const loadLeads = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const params = {};
      if (typeFilter !== 'ALL') params.lead_type = typeFilter;
      if (statusFilter !== 'ALL') params.status = statusFilter;

      const [leadsRes, sumRes] = await Promise.all([
        client.get('/developer/leads', { params }).catch(() => ({ data: [] })),
        client.get('/developer/leads/summary').catch(() => ({ data: {} })),
      ]);

      const list = Array.isArray(leadsRes.data) ? leadsRes.data : [];
      setLeads(list);

      if (sumRes.data && typeof sumRes.data === 'object') {
        setSummary(sumRes.data);
      }
    } catch (err) {
      console.warn('Failed to load leads:', err?.message);
      setLeads([]);
    } finally {
      if (isRefresh) setRefreshing(false);
      setLoading(false);
    }
  }, [typeFilter, statusFilter]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  // Update Lead Status
  const handleUpdateStatus = async (leadId, newStatus) => {
    setUpdating(true);
    try {
      await client.patch(`/developer/leads/${leadId}/status`, { status: newStatus });
      Alert.alert('Status Updated', `Lead status changed to ${newStatus}.`);
      setDetailModal(false);
      setSelectedLead(null);
      loadLeads();
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to update status';
      Alert.alert('Error', msg);
    } finally {
      setUpdating(false);
    }
  };

  // Filtered Leads by search
  const filteredLeads = useMemo(() => {
    if (!search.trim()) return leads;
    const q = search.toLowerCase();
    return leads.filter(l =>
      (l.name && l.name.toLowerCase().includes(q)) ||
      (l.company && l.company.toLowerCase().includes(q)) ||
      (l.email && l.email.toLowerCase().includes(q)) ||
      (l.city && l.city.toLowerCase().includes(q)) ||
      (l.phone && l.phone.includes(q))
    );
  }, [leads, search]);

  const openLeadDetail = (lead) => {
    setSelectedLead(lead);
    setDetailModal(true);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          {navigation?.canGoBack?.() && (
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 10 }}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Inquiries & Leads</Text>
            <Text style={styles.headerSub}>Demo Requests & Inbound CRM Pipeline</Text>
          </View>
        </View>

        {/* Live Metrics Row */}
        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricVal}>{summary.total || leads.length}</Text>
            <Text style={styles.metricLbl}>Total</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={[styles.metricVal, { color: '#dc2626' }]}>{summary.new || 0}</Text>
            <Text style={styles.metricLbl}>New</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={[styles.metricVal, { color: '#0284c7' }]}>{summary.demo_requests || 0}</Text>
            <Text style={styles.metricLbl}>Demos</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={[styles.metricVal, { color: '#7c3aed' }]}>{summary.contact_messages || 0}</Text>
            <Text style={styles.metricLbl}>Messages</Text>
          </View>
        </View>
      </View>

      {/* Filter Section */}
      <View style={styles.filterSection}>
        {/* Search */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={16} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search leads by name, school, email, city..."
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Type & Status Filter Scroll */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {['ALL', 'DEMO', 'CONTACT'].map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.filterChip, typeFilter === t && styles.filterChipActive]}
              onPress={() => setTypeFilter(t)}
            >
              <Text style={[styles.filterChipText, typeFilter === t && styles.filterChipTextActive]}>
                {t === 'ALL' ? 'All Types' : t === 'DEMO' ? 'Demo Requests' : 'Messages'}
              </Text>
            </TouchableOpacity>
          ))}

          <View style={styles.filterDivider} />

          {['ALL', 'NEW', 'CONTACTED', 'CLOSED'].map((st) => (
            <TouchableOpacity
              key={st}
              style={[styles.filterChip, statusFilter === st && styles.filterChipActive]}
              onPress={() => setStatusFilter(st)}
            >
              <Text style={[styles.filterChipText, statusFilter === st && styles.filterChipTextActive]}>
                {st === 'ALL' ? 'All Statuses' : st}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Leads List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Fetching admission leads...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadLeads(true)} colors={[colors.primary]} />
          }
        >
          {filteredLeads.length > 0 ? (
            filteredLeads.map((lead) => {
              const typeConf = TYPE_CONFIG[lead.lead_type] || TYPE_CONFIG.DEMO;
              const statusConf = STATUS_CONFIG[lead.status] || STATUS_CONFIG.NEW;

              return (
                <TouchableOpacity
                  key={lead.id}
                  style={styles.card}
                  activeOpacity={0.85}
                  onPress={() => openLeadDetail(lead)}
                >
                  {/* Top Badges */}
                  <View style={styles.cardHeader}>
                    <View style={[styles.typeBadge, { backgroundColor: typeConf.bg }]}>
                      <Ionicons name={typeConf.icon} size={11} color={typeConf.color} />
                      <Text style={[styles.typeText, { color: typeConf.color }]}>{typeConf.label}</Text>
                    </View>

                    <View style={[styles.statusBadge, { backgroundColor: statusConf.bg, borderColor: statusConf.border }]}>
                      <Ionicons name={statusConf.icon} size={11} color={statusConf.text} />
                      <Text style={[styles.statusText, { color: statusConf.text }]}>{statusConf.label}</Text>
                    </View>
                  </View>

                  {/* Lead Name & School */}
                  <Text style={styles.leadName}>{lead.name}</Text>
                  {lead.company ? (
                    <Text style={styles.leadCompany}>
                      <Ionicons name="business-outline" size={12} color={colors.textMuted} /> {lead.company}
                    </Text>
                  ) : null}

                  {/* Contact Meta */}
                  <View style={styles.metaRow}>
                    {lead.email ? (
                      <View style={styles.metaItem}>
                        <Ionicons name="mail-outline" size={12} color={colors.textMuted} />
                        <Text style={styles.metaText} numberOfLines={1}>{lead.email}</Text>
                      </View>
                    ) : null}
                    {lead.phone ? (
                      <View style={styles.metaItem}>
                        <Ionicons name="call-outline" size={12} color={colors.textMuted} />
                        <Text style={styles.metaText}>{lead.phone}</Text>
                      </View>
                    ) : null}
                  </View>

                  {/* City & Service */}
                  {(lead.city || lead.service) && (
                    <View style={styles.tagRow}>
                      {lead.city ? (
                        <View style={styles.infoTag}>
                          <Ionicons name="location-outline" size={11} color="#64748b" />
                          <Text style={styles.infoTagText}>{lead.city}</Text>
                        </View>
                      ) : null}
                      {lead.service ? (
                        <View style={styles.infoTag}>
                          <Ionicons name="layers-outline" size={11} color="#64748b" />
                          <Text style={styles.infoTagText}>{lead.service}</Text>
                        </View>
                      ) : null}
                    </View>
                  )}

                  {/* Message Preview */}
                  {lead.message ? (
                    <Text style={styles.messagePreview} numberOfLines={2}>
                      "{lead.message}"
                    </Text>
                  ) : null}

                  {/* Footer: Date & Quick Actions */}
                  <View style={styles.cardFooter}>
                    <Text style={styles.timeText}>{formatTime(lead.created_at)}</Text>

                    <View style={styles.quickActions}>
                      {lead.phone ? (
                        <TouchableOpacity
                          style={styles.circleBtn}
                          onPress={() => Linking.openURL(`tel:${lead.phone}`).catch(() => {})}
                        >
                          <Ionicons name="call" size={13} color="#16a34a" />
                        </TouchableOpacity>
                      ) : null}

                      {lead.email ? (
                        <TouchableOpacity
                          style={styles.circleBtn}
                          onPress={() => Linking.openURL(`mailto:${lead.email}`).catch(() => {})}
                        >
                          <Ionicons name="mail" size={13} color={colors.primary} />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={54} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No Inquiries Found</Text>
              <Text style={styles.emptySubtitle}>
                {search
                  ? `No leads matching "${search}".`
                  : 'No demo requests or inquiry forms have been received for this filter.'}
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* LEAD DETAIL & CRM PIPELINE MODAL */}
      <Modal visible={detailModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{selectedLead?.name}</Text>
                <Text style={styles.modalSub}>
                  {selectedLead?.company || 'Prospective Institution'} · {formatTime(selectedLead?.created_at)}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setDetailModal(false)}>
                <Ionicons name="close-circle-outline" size={26} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              {/* Contact Information */}
              <View style={styles.sectionBox}>
                <Text style={styles.sectionTitle}>Contact Details</Text>
                {selectedLead?.email && (
                  <TouchableOpacity
                    style={styles.detailRow}
                    onPress={() => Linking.openURL(`mailto:${selectedLead.email}`).catch(() => {})}
                  >
                    <Ionicons name="mail" size={16} color={colors.primary} />
                    <Text style={styles.detailLinkText}>{selectedLead.email}</Text>
                  </TouchableOpacity>
                )}
                {selectedLead?.phone && (
                  <TouchableOpacity
                    style={styles.detailRow}
                    onPress={() => Linking.openURL(`tel:${selectedLead.phone}`).catch(() => {})}
                  >
                    <Ionicons name="call" size={16} color="#16a34a" />
                    <Text style={styles.detailLinkText}>{selectedLead.phone}</Text>
                  </TouchableOpacity>
                )}
                {selectedLead?.city && (
                  <View style={styles.detailRow}>
                    <Ionicons name="location" size={16} color="#64748b" />
                    <Text style={styles.detailText}>Location: {selectedLead.city}</Text>
                  </View>
                )}
                {selectedLead?.org_size && (
                  <View style={styles.detailRow}>
                    <Ionicons name="school" size={16} color="#64748b" />
                    <Text style={styles.detailText}>Campus Size: {selectedLead.org_size}</Text>
                  </View>
                )}
                {selectedLead?.service && (
                  <View style={styles.detailRow}>
                    <Ionicons name="layers" size={16} color="#64748b" />
                    <Text style={styles.detailText}>Service of Interest: {selectedLead.service}</Text>
                  </View>
                )}
              </View>

              {/* Inquiry Message */}
              {selectedLead?.message && (
                <View style={styles.sectionBox}>
                  <Text style={styles.sectionTitle}>Inquiry Message</Text>
                  <Text style={styles.inquiryBodyText}>{selectedLead.message}</Text>
                </View>
              )}

              {/* CRM Pipeline Status Update */}
              <View style={styles.sectionBox}>
                <Text style={styles.sectionTitle}>Update Pipeline Stage</Text>
                <View style={styles.statusButtonsRow}>
                  {['NEW', 'CONTACTED', 'CLOSED'].map((st) => {
                    const conf = STATUS_CONFIG[st];
                    const active = selectedLead?.status === st;
                    return (
                      <TouchableOpacity
                        key={st}
                        style={[
                          styles.statusChangeBtn,
                          {
                            borderColor: active ? conf.text : conf.border,
                            backgroundColor: active ? conf.bg : '#fff',
                          },
                        ]}
                        onPress={() => handleUpdateStatus(selectedLead.id, st)}
                        disabled={updating}
                      >
                        <Ionicons name={conf.icon} size={14} color={conf.text} />
                        <Text style={[styles.statusChangeBtnText, { color: conf.text, fontWeight: active ? '800' : '600' }]}>
                          {conf.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  metricsRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  metricItem: { flex: 1, alignItems: 'center' },
  metricVal: { fontSize: 16, fontWeight: '800', color: colors.text },
  metricLbl: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  metricDivider: { width: 1, height: 20, backgroundColor: '#e2e8f0' },
  filterSection: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingVertical: 8 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: { flex: 1, paddingVertical: 6, paddingHorizontal: 6, fontSize: 13, color: colors.text },
  filterScroll: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  filterChipActive: { backgroundColor: colors.primary },
  filterChipText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  filterChipTextActive: { color: '#fff' },
  filterDivider: { width: 1, height: 20, backgroundColor: '#cbd5e1', marginHorizontal: 4 },
  listContainer: { padding: 16, paddingBottom: 40 },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 10, fontSize: 13, color: colors.textMuted },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 3,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  typeText: { fontSize: 11, fontWeight: '700' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  statusText: { fontSize: 10, fontWeight: '700' },
  leadName: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 2 },
  leadCompany: { fontSize: 13, color: colors.textMuted, marginBottom: 8 },
  metaRow: { flexDirection: 'row', gap: 14, marginBottom: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  metaText: { fontSize: 12, color: colors.textMuted },
  tagRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  infoTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  infoTagText: { fontSize: 11, color: '#475569', fontWeight: '500' },
  messagePreview: { fontSize: 12, color: '#334155', fontStyle: 'italic', marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 8 },
  timeText: { fontSize: 11, color: colors.textMuted },
  quickActions: { flexDirection: 'row', gap: 8 },
  circleBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 50 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 12 },
  emptySubtitle: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 4, paddingHorizontal: 24 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  modalSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  sectionBox: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: colors.text, marginBottom: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  detailText: { fontSize: 13, color: colors.text },
  detailLinkText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  inquiryBodyText: { fontSize: 13, color: '#334155', lineHeight: 20 },
  statusButtonsRow: { flexDirection: 'row', gap: 8 },
  statusChangeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusChangeBtnText: { fontSize: 12 },
});
