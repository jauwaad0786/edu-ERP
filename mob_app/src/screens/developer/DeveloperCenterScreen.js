// mob_app/src/screens/developer/DeveloperCenterScreen.js
// Developer Center & Error Dashboard -- company-side only.
// Live APIs: GET /api/developer/errors/summary, /api/developer/health,
//            GET/POST/PATCH /api/developer/errors/:id (assign, status, resolve)
//            GET /api/developer/issues

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, Modal, TextInput,
  Alert, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';

const ASSIGNMENT_TEAMS = ['BACKEND', 'FRONTEND', 'QA', 'DEVOPS'];
const PRIORITY_LEVELS  = ['P0_CRITICAL', 'P1_HIGH', 'P2_MEDIUM', 'P3_LOW'];
const ERROR_STATUSES   = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'TESTING', 'RESOLVED', 'CLOSED', 'REOPENED'];
const KANBAN_COLS      = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'TESTING', 'RESOLVED'];
const TABS             = ['Overview', 'Error Log', 'Issue Board'];
const PER_PAGE         = 20;

const SEVERITY_CFG = {
  CRITICAL: { color: '#dc2626', bg: '#fef2f2', label: 'Critical' },
  HIGH:     { color: '#d97706', bg: '#fffbeb', label: 'High' },
  MEDIUM:   { color: '#f59e0b', bg: '#fefce8', label: 'Medium' },
  LOW:      { color: '#3b82f6', bg: '#eff6ff', label: 'Low' },
};

const STATUS_CFG = {
  NEW:         { color: '#dc2626', bg: '#fef2f2', icon: 'alert-circle' },
  ASSIGNED:    { color: '#d97706', bg: '#fffbeb', icon: 'person' },
  IN_PROGRESS: { color: '#3b82f6', bg: '#eff6ff', icon: 'git-branch' },
  TESTING:     { color: '#8b5cf6', bg: '#f5f3ff', icon: 'flask' },
  RESOLVED:    { color: '#16a34a', bg: '#f0fdf4', icon: 'checkmark-circle' },
  CLOSED:      { color: '#64748b', bg: '#f8fafc', icon: 'archive' },
  REOPENED:    { color: '#ef4444', bg: '#fef2f2', icon: 'refresh-circle' },
};

function SeverityBadge({ severity }) {
  const cfg = SEVERITY_CFG[severity] || { color: '#64748b', bg: '#f8fafc', label: severity || 'Unknown' };
  return (
    <View style={[s.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[s.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || { color: '#64748b', bg: '#f8fafc', icon: 'help-circle' };
  return (
    <View style={[s.badge, { backgroundColor: cfg.bg, flexDirection: 'row', alignItems: 'center' }]}>
      <Ionicons name={cfg.icon} size={10} color={cfg.color} style={{ marginRight: 3 }} />
      <Text style={[s.badgeText, { color: cfg.color }]}>{String(status || '').replace(/_/g, ' ')}</Text>
    </View>
  );
}

function StatCard({ label, value, color, icon }) {
  return (
    <View style={s.statCard}>
      <View style={[s.statIcon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={[s.statVal, { color }]}>{value != null ? value : '--'}</Text>
      <Text style={s.statLbl}>{label}</Text>
    </View>
  );
}

export default function DeveloperCenterScreen({ navigation }) {
  const [tab,          setTab]          = useState(0);
  const [denied,       setDenied]       = useState(false);
  // Overview
  const [summary,      setSummary]      = useState(null);
  const [health,       setHealth]       = useState(null);
  const [loadOv,       setLoadOv]       = useState(true);
  const [refOv,        setRefOv]        = useState(false);
  // Error Log
  const [errors,       setErrors]       = useState([]);
  const [errTotal,     setErrTotal]     = useState(0);
  const [errPage,      setErrPage]      = useState(1);
  const [loadErr,      setLoadErr]      = useState(false);
  const [refErr,       setRefErr]       = useState(false);
  const [fStatus,      setFStatus]      = useState('');
  const [fSev,         setFSev]         = useState('');
  const [fSearch,      setFSearch]      = useState('');
  // Issues
  const [issues,       setIssues]       = useState([]);
  const [loadIss,      setLoadIss]      = useState(false);
  // Detail
  const [dtVis,        setDtVis]        = useState(false);
  const [selErr,       setSelErr]       = useState(null);
  const [loadDt,       setLoadDt]       = useState(false);
  const [dtData,       setDtData]       = useState(null);
  // Assign
  const [asgVis,       setAsgVis]       = useState(false);
  const [asgTeam,      setAsgTeam]      = useState('BACKEND');
  const [asgPri,       setAsgPri]       = useState('P2_MEDIUM');
  const [subAsg,       setSubAsg]       = useState(false);
  // Status
  const [stVis,        setStVis]        = useState(false);
  const [pendSt,       setPendSt]       = useState('');
  // Resolve
  const [resVis,       setResVis]       = useState(false);
  const [resNote,      setResNote]      = useState('');
  const [subRes,       setSubRes]       = useState(false);

  const fetchOv = useCallback(async (refresh = false) => {
    if (refresh) setRefOv(true); else setLoadOv(true);
    try {
      const [sr, hr] = await Promise.allSettled([
        client.get('/developer/errors/summary'),
        client.get('/developer/health'),
      ]);
      if (sr.status === 'fulfilled') setSummary(sr.value.data);
      if (hr.status === 'fulfilled') setHealth(hr.value.data);
      if (sr.status === 'rejected' && sr.reason?.response?.status === 403) setDenied(true);
    } catch (_) {}
    finally { setLoadOv(false); setRefOv(false); }
  }, []);

  const fetchErr = useCallback(async (page = 1, append = false) => {
    setLoadErr(true);
    try {
      const params = { page, per_page: PER_PAGE };
      if (fStatus) params.status   = fStatus;
      if (fSev)    params.severity = fSev;
      if (fSearch) params.q        = fSearch;
      const res = await client.get('/developer/errors', { params });
      const rows = res.data.errors || [];
      setErrTotal(res.data.total || 0);
      setErrors(prev => append ? [...prev, ...rows] : rows);
    } catch (e) {
      if (e?.response?.status === 403) setDenied(true);
    } finally { setLoadErr(false); setRefErr(false); }
  }, [fStatus, fSev, fSearch]);

  const fetchIss = useCallback(async () => {
    setLoadIss(true);
    try {
      const res = await client.get('/developer/issues');
      setIssues(Array.isArray(res.data) ? res.data : []);
    } catch (_) {}
    finally { setLoadIss(false); }
  }, []);

  const openDetail = useCallback(async (row) => {
    setSelErr(row); setDtVis(true); setDtData(null); setLoadDt(true);
    try {
      const res = await client.get('/developer/errors/' + row.id);
      setDtData(res.data);
    } catch (_) { setDtData(row); }
    finally { setLoadDt(false); }
  }, []);

  const doAssign = async () => {
    if (!selErr) return;
    setSubAsg(true);
    try {
      await client.post('/developer/errors/' + selErr.id + '/assign', { assigned_team: asgTeam, priority: asgPri });
      Alert.alert('Assigned', 'Error #' + selErr.id + ' assigned to ' + asgTeam);
      setAsgVis(false); openDetail(selErr); fetchErr(1);
    } catch (e) { Alert.alert('Failed', e?.response?.data?.error || 'Could not assign'); }
    finally { setSubAsg(false); }
  };

  const doStatus = async () => {
    if (!selErr || !pendSt) return;
    try {
      await client.patch('/developer/errors/' + selErr.id + '/status', { status: pendSt });
      Alert.alert('Updated', 'Status -> ' + pendSt);
      setStVis(false); openDetail(selErr); fetchErr(1);
    } catch (e) { Alert.alert('Failed', e?.response?.data?.error || 'Failed'); }
  };

  const doResolve = async () => {
    if (!resNote.trim()) { Alert.alert('Required', 'Enter a resolution note'); return; }
    setSubRes(true);
    try {
      await client.post('/developer/errors/' + selErr.id + '/resolve', { resolution_note: resNote.trim() });
      Alert.alert('Resolved', 'Error #' + selErr.id + ' resolved');
      setResVis(false); setDtVis(false); setResNote(''); fetchErr(1); fetchOv();
    } catch (e) { Alert.alert('Failed', e?.response?.data?.error || 'Failed'); }
    finally { setSubRes(false); }
  };

  useEffect(() => {
    if (tab === 0) fetchOv();
    if (tab === 1) { setErrPage(1); fetchErr(1); }
    if (tab === 2) fetchIss();
  }, [tab]);

  useEffect(() => {
    if (tab === 1) { setErrPage(1); fetchErr(1); }
  }, [fStatus, fSev, fSearch]);

  if (denied) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={s.hTitle}>Developer Center</Text>
        </View>
        <View style={s.denied}>
          <Ionicons name="shield-checkmark" size={60} color="#e2e8f0" />
          <Text style={s.deniedT}>Company Access Only</Text>
          <Text style={s.deniedS}>Developer Error Center is restricted to internal company-side team members. School accounts cannot access this module.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const issMap = KANBAN_COLS.reduce((acc, c) => { acc[c] = issues.filter(i => i.status === c); return acc; }, {});

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.hTitle}>Developer Center</Text>
          <Text style={s.hSub}>Error Triage & System Health</Text>
        </View>
        <View style={s.intBadge}>
          <Ionicons name="code-slash" size={12} color="#7c3aed" />
          <Text style={s.intBadgeTxt}> INTERNAL</Text>
        </View>
      </View>

      <View style={s.tabBar}>
        {TABS.map((t, i) => (
          <TouchableOpacity key={t} style={[s.tabItem, tab === i && s.tabOn]} onPress={() => setTab(i)}>
            <Text style={[s.tabTxt, tab === i && s.tabTxtOn]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* OVERVIEW */}
      {tab === 0 && (
        <ScrollView style={s.flex1} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refOv} onRefresh={() => fetchOv(true)} tintColor={colors.primary} />}>
          {loadOv && !refOv
            ? <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} />
            : <>
                <Text style={s.secTitle}>Error Summary</Text>
                <View style={s.grid}>
                  <StatCard label="Open"          value={summary?.open_count}     color="#dc2626" icon="alert-circle" />
                  <StatCard label="Critical"      value={summary?.critical_open}  color="#b91c1c" icon="flame" />
                  <StatCard label="New Today"     value={summary?.new_today}      color="#d97706" icon="time" />
                  <StatCard label="Resolved Today" value={summary?.resolved_today} color="#16a34a" icon="checkmark-circle" />
                </View>

                {summary?.assigned_to_me != null && (
                  <View style={s.qBanner}>
                    <Ionicons name="person-circle" size={20} color="#4f46e5" />
                    <Text style={s.qTxt}><Text style={{ fontWeight: '800', color: '#4f46e5' }}>{summary.assigned_to_me}</Text> error(s) assigned to you</Text>
                  </View>
                )}

                {summary?.by_severity && Object.keys(summary.by_severity).length > 0 && (
                  <>
                    <Text style={s.secTitle}>Open by Severity</Text>
                    <View style={s.card}>
                      {Object.entries(summary.by_severity).map(([sv, cnt]) => {
                        const c = (SEVERITY_CFG[sv] || {}).color || '#64748b';
                        return (
                          <View key={sv} style={s.bRow}>
                            <View style={[s.dot, { backgroundColor: c }]} />
                            <Text style={s.bLbl}>{sv}</Text>
                            <Text style={[s.bCnt, { color: c }]}>{cnt}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </>
                )}

                <Text style={s.secTitle}>System Health</Text>
                {health ? (
                  <View style={s.card}>
                    {[
                      { label: 'Status', val: (health.overall_status || '').toUpperCase(), color: health.overall_status === 'healthy' ? '#16a34a' : health.overall_status === 'degraded' ? '#d97706' : '#dc2626', icon: 'pulse' },
                      { label: 'API Response', val: health.api_response_time + 'ms', color: health.api_response_time < 200 ? '#16a34a' : '#d97706', icon: 'flash' },
                      { label: 'Schools Online', val: String(health.schools_online), color: '#7c3aed', icon: 'school' },
                    ].map(r => (
                      <View key={r.label} style={s.hRow}>
                        <Ionicons name={r.icon} size={14} color={r.color} style={{ marginRight: 8 }} />
                        <Text style={s.hLbl}>{r.label}</Text>
                        <Text style={[s.hVal, { color: r.color }]}>{r.val}</Text>
                      </View>
                    ))}

                    {health.system && health.system.cpu_usage != null && (
                      <>
                        <View style={s.div} />
                        {[{ label: 'CPU', pct: health.system.cpu_usage }, { label: 'Memory', pct: health.system.memory_usage }].map(r => (
                          <View key={r.label} style={s.rRow}>
                            <Text style={s.rLbl}>{r.label}</Text>
                            <View style={s.pBar}>
                              <View style={[s.pFill, { width: r.pct + '%', backgroundColor: r.pct > 80 ? '#dc2626' : r.pct > 60 ? '#d97706' : '#16a34a' }]} />
                            </View>
                            <Text style={s.rVal}>{r.pct}%</Text>
                          </View>
                        ))}
                        {health.system.total_memory && <Text style={s.rInfo}>RAM: {health.system.total_memory}</Text>}
                      </>
                    )}

                    {health.services && (
                      <>
                        <View style={s.div} />
                        {Object.entries(health.services).map(([svc, st]) => (
                          <View key={svc} style={s.hRow}>
                            <View style={[s.dot, { backgroundColor: (st === 'up' || st === 'healthy') ? '#16a34a' : '#dc2626' }]} />
                            <Text style={s.hLbl}>{svc.replace(/_/g, ' ').toUpperCase()}</Text>
                            <Text style={[s.hVal, { color: (st === 'up' || st === 'healthy') ? '#16a34a' : '#dc2626' }]}>{st.toUpperCase()}</Text>
                          </View>
                        ))}
                      </>
                    )}
                    <Text style={s.lastUpd}>{'Updated: ' + (health.last_updated ? new Date(health.last_updated).toLocaleTimeString() : '--')}</Text>
                  </View>
                ) : <View style={s.empty}><Text style={s.emptyT}>Health data unavailable</Text></View>}

                <View style={{ height: 30 }} />
              </>
          }
        </ScrollView>
      )}

      {/* ERROR LOG */}
      {tab === 1 && (
        <View style={s.flex1}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow}
            contentContainerStyle={{ gap: 6, paddingHorizontal: 16, paddingVertical: 8 }}>
            {['', 'NEW', 'ASSIGNED', 'IN_PROGRESS', 'TESTING', 'RESOLVED'].map(st => (
              <TouchableOpacity key={st || 'all-st'} style={[s.chip, fStatus === st && s.chipOn]} onPress={() => setFStatus(st)}>
                <Text style={[s.chipT, fStatus === st && s.chipTOn]}>{st || 'All Status'}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow}
            contentContainerStyle={{ gap: 6, paddingHorizontal: 16, paddingBottom: 6 }}>
            {['', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(sv => (
              <TouchableOpacity key={sv || 'all-sv'} style={[s.chip, fSev === sv && s.chipOn]} onPress={() => setFSev(sv)}>
                <Text style={[s.chipT, fSev === sv && s.chipTOn]}>{sv || 'All Severity'}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={s.srchBox}>
            <Ionicons name="search" size={15} color={colors.muted} style={{ marginRight: 7 }} />
            <TextInput
              style={s.srchIn} placeholder="Search errors, endpoints..." placeholderTextColor={colors.muted}
              value={fSearch} onChangeText={setFSearch} returnKeyType="search" onSubmitEditing={() => fetchErr(1)} />
            {fSearch.length > 0 && <TouchableOpacity onPress={() => setFSearch('')}><Ionicons name="close-circle" size={15} color={colors.muted} /></TouchableOpacity>}
          </View>
          <Text style={s.cntTxt}>{errTotal} error{errTotal !== 1 ? 's' : ''}</Text>

          {loadErr && errors.length === 0
            ? <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
            : <FlatList
                data={errors} keyExtractor={i => String(i.id)} showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}
                refreshControl={<RefreshControl refreshing={refErr} onRefresh={() => { setRefErr(true); setErrPage(1); fetchErr(1); }} tintColor={colors.primary} />}
                onEndReached={() => { if (!loadErr && errors.length < errTotal) { const nx = errPage + 1; setErrPage(nx); fetchErr(nx, true); } }}
                onEndReachedThreshold={0.4}
                ListFooterComponent={loadErr && errors.length > 0 ? <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 12 }} /> : null}
                ListEmptyComponent={<View style={s.empty}><Ionicons name="checkmark-done-circle-outline" size={44} color="#e2e8f0" /><Text style={s.emptyT}>No errors match filters</Text></View>}
                renderItem={({ item }) => (
                  <TouchableOpacity style={s.eCard} onPress={() => openDetail(item)} activeOpacity={0.8}>
                    <View style={s.eTop}>
                      <Text style={s.eId}>#{item.id}</Text>
                      <SeverityBadge severity={item.severity} />
                      <StatusBadge status={item.status} />
                    </View>
                    <Text style={s.eType} numberOfLines={1}>{item.exception_type || item.error_type || 'Unknown Error'}</Text>
                    <Text style={s.eMsg} numberOfLines={2}>{item.exception_message || '(no message)'}</Text>
                    <View style={s.eMeta}>
                      {item.api_endpoint ? <Text style={s.eEp} numberOfLines={1}>{item.api_endpoint}</Text> : <View />}
                      <Text style={s.eTime}>{item.last_seen_at ? new Date(item.last_seen_at).toLocaleDateString() : ''}</Text>
                    </View>
                    {item.occurrence_count > 1 && <View style={s.occPill}><Text style={s.occTxt}>{item.occurrence_count}x occurrences</Text></View>}
                  </TouchableOpacity>
                )}
              />
          }
        </View>
      )}

      {/* KANBAN */}
      {tab === 2 && (
        <View style={s.flex1}>
          {loadIss
            ? <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} />
            : <ScrollView horizontal showsHorizontalScrollIndicator style={s.flex1}>
                {KANBAN_COLS.map(col => {
                  const cfg = STATUS_CFG[col] || { color: '#64748b', icon: 'list' };
                  const colIts = issMap[col] || [];
                  return (
                    <View key={col} style={s.kCol}>
                      <View style={[s.kHead, { backgroundColor: cfg.color + '20' }]}>
                        <Ionicons name={cfg.icon} size={13} color={cfg.color} />
                        <Text style={[s.kTitle, { color: cfg.color }]}>{col.replace(/_/g, ' ')}</Text>
                        <View style={[s.kBadge, { backgroundColor: cfg.color }]}><Text style={s.kBadgeTxt}>{colIts.length}</Text></View>
                      </View>
                      <ScrollView showsVerticalScrollIndicator={false}>
                        {colIts.length === 0 && <Text style={s.kEmpty}>No issues</Text>}
                        {colIts.map(iss => (
                          <TouchableOpacity key={iss.id} style={s.kCard} onPress={() => openDetail(iss)} activeOpacity={0.8}>
                            <Text style={s.kId}>#{iss.id}</Text>
                            <SeverityBadge severity={iss.severity} />
                            <Text style={s.kType} numberOfLines={1}>{iss.exception_type || iss.error_type || 'Error'}</Text>
                            <Text style={s.kMsg} numberOfLines={2}>{iss.exception_message || ''}</Text>
                            {iss.assigned_to && <Text style={s.kAsgn}>Team: {iss.assigned_to}</Text>}
                            {iss.assigned_to_user_name && <Text style={s.kAsgn}>{iss.assigned_to_user_name}</Text>}
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  );
                })}
              </ScrollView>
          }
        </View>
      )}

      {/* DETAIL MODAL */}
      <Modal visible={dtVis} animationType="slide" transparent onRequestClose={() => setDtVis(false)}>
        <View style={s.ov}>
          <View style={[s.sh, { maxHeight: '92%' }]}>
            <View style={s.hndl} />
            <View style={s.mHead}>
              <Text style={s.mTitle}>{loadDt ? 'Loading...' : 'Error #' + (selErr?.id || '')}</Text>
              <TouchableOpacity onPress={() => setDtVis(false)}><Ionicons name="close" size={22} color={colors.text} /></TouchableOpacity>
            </View>
            {loadDt
              ? <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 40 }} />
              : <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    {dtData?.severity && <SeverityBadge severity={dtData.severity} />}
                    {dtData?.status && <StatusBadge status={dtData.status} />}
                  </View>
                  <Text style={s.dtSec}>Exception</Text>
                  <Text style={s.dtBold}>{dtData?.exception_type || '--'}</Text>
                  <Text style={s.dtTxt}>{dtData?.exception_message || '--'}</Text>
                  {(dtData?.api_endpoint || dtData?.module) && (
                    <>
                      <Text style={s.dtSec}>Endpoint / Module</Text>
                      <Text style={s.dtMono}>{(dtData?.api_endpoint || '') + (dtData?.module ? '  [' + dtData.module + ']' : '')}</Text>
                    </>
                  )}
                  {dtData?.stack_trace && (
                    <>
                      <Text style={s.dtSec}>Stack Trace</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator style={s.stkBox}>
                        <Text style={s.stkTxt}>{dtData.stack_trace}</Text>
                      </ScrollView>
                    </>
                  )}
                  <Text style={s.dtSec}>Timestamps</Text>
                  <Text style={s.dtTxt}>{'First: ' + (dtData?.first_seen_at ? new Date(dtData.first_seen_at).toLocaleString() : '--')}</Text>
                  <Text style={s.dtTxt}>{'Last:  ' + (dtData?.last_seen_at  ? new Date(dtData.last_seen_at).toLocaleString()  : '--')}</Text>
                  {dtData?.occurrence_count > 1 && <Text style={s.dtTxt}>{'Occurrences: ' + dtData.occurrence_count}</Text>}
                  {dtData?.assignment && (
                    <>
                      <Text style={s.dtSec}>Assignment</Text>
                      <Text style={s.dtTxt}>{'Team: '     + (dtData.assignment.assigned_team || '--')}</Text>
                      <Text style={s.dtTxt}>{'Priority: ' + (dtData.assignment.priority      || '--')}</Text>
                      {dtData.assignment.resolution_note && <Text style={s.dtTxt}>{'Resolution: ' + dtData.assignment.resolution_note}</Text>}
                    </>
                  )}
                  <View style={s.actRow}>
                    <TouchableOpacity style={[s.actBtn, { backgroundColor: '#4f46e5' }]} onPress={() => { setAsgTeam('BACKEND'); setAsgPri('P2_MEDIUM'); setAsgVis(true); }}>
                      <Ionicons name="person-add" size={14} color="#fff" /><Text style={s.actTxt}>Assign</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.actBtn, { backgroundColor: '#0284c7' }]} onPress={() => { setPendSt(dtData?.status || ''); setStVis(true); }}>
                      <Ionicons name="swap-horizontal" size={14} color="#fff" /><Text style={s.actTxt}>Status</Text>
                    </TouchableOpacity>
                    {dtData?.status !== 'RESOLVED' && dtData?.status !== 'CLOSED' && (
                      <TouchableOpacity style={[s.actBtn, { backgroundColor: '#16a34a' }]} onPress={() => { setResNote(''); setResVis(true); }}>
                        <Ionicons name="checkmark-done" size={14} color="#fff" /><Text style={s.actTxt}>Resolve</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={{ height: 20 }} />
                </ScrollView>
            }
          </View>
        </View>
      </Modal>

      {/* ASSIGN MODAL */}
      <Modal visible={asgVis} animationType="slide" transparent onRequestClose={() => setAsgVis(false)}>
        <View style={s.ov}>
          <View style={s.sh}>
            <View style={s.hndl} />
            <View style={s.mHead}>
              <Text style={s.mTitle}>{'Assign Error #' + (selErr?.id || '')}</Text>
              <TouchableOpacity onPress={() => setAsgVis(false)}><Ionicons name="close" size={22} color={colors.text} /></TouchableOpacity>
            </View>
            <Text style={s.fLbl}>Team</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {ASSIGNMENT_TEAMS.map(t => (
                <TouchableOpacity key={t} style={[s.chip, asgTeam === t && s.chipOn]} onPress={() => setAsgTeam(t)}>
                  <Text style={[s.chipT, asgTeam === t && s.chipTOn]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.fLbl}>Priority</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {PRIORITY_LEVELS.map(p => (
                <TouchableOpacity key={p} style={[s.chip, asgPri === p && s.chipOn]} onPress={() => setAsgPri(p)}>
                  <Text style={[s.chipT, asgPri === p && s.chipTOn]}>{p.replace(/_/g, ' ')}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[s.subBtn, subAsg && { opacity: 0.6 }]} onPress={doAssign} disabled={subAsg}>
              {subAsg ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.subTxt}>Confirm Assignment</Text>}
            </TouchableOpacity>
            <View style={{ height: 20 }} />
          </View>
        </View>
      </Modal>

      {/* STATUS MODAL */}
      <Modal visible={stVis} animationType="slide" transparent onRequestClose={() => setStVis(false)}>
        <View style={s.ov}>
          <View style={s.sh}>
            <View style={s.hndl} />
            <View style={s.mHead}>
              <Text style={s.mTitle}>Change Status</Text>
              <TouchableOpacity onPress={() => setStVis(false)}><Ionicons name="close" size={22} color={colors.text} /></TouchableOpacity>
            </View>
            <Text style={s.fLbl}>{'Current: ' + (dtData?.status || '--')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {ERROR_STATUSES.map(st => {
                const c = (STATUS_CFG[st] || {}).color || colors.primary;
                return (
                  <TouchableOpacity key={st} style={[s.chip, pendSt === st && { backgroundColor: c, borderColor: c }]} onPress={() => setPendSt(st)}>
                    <Text style={[s.chipT, pendSt === st && { color: '#fff' }]}>{st.replace(/_/g, ' ')}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity style={s.subBtn} onPress={doStatus}>
              <Text style={s.subTxt}>Update Status</Text>
            </TouchableOpacity>
            <View style={{ height: 20 }} />
          </View>
        </View>
      </Modal>

      {/* RESOLVE MODAL */}
      <Modal visible={resVis} animationType="slide" transparent onRequestClose={() => setResVis(false)}>
        <View style={s.ov}>
          <View style={s.sh}>
            <View style={s.hndl} />
            <View style={s.mHead}>
              <Text style={s.mTitle}>{'Resolve Error #' + (selErr?.id || '')}</Text>
              <TouchableOpacity onPress={() => setResVis(false)}><Ionicons name="close" size={22} color={colors.text} /></TouchableOpacity>
            </View>
            <Text style={s.fLbl}>Resolution Note *</Text>
            <TextInput
              style={[s.fIn, { height: 100, textAlignVertical: 'top' }]}
              placeholder="Describe how this error was fixed..."
              placeholderTextColor={colors.muted}
              value={resNote} onChangeText={setResNote} multiline />
            <TouchableOpacity style={[s.subBtn, { backgroundColor: '#16a34a' }, subRes && { opacity: 0.6 }]} onPress={doResolve} disabled={subRes}>
              {subRes ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.subTxt}>Mark Resolved</Text>}
            </TouchableOpacity>
            <View style={{ height: 20 }} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: '#f8fafc' },
  flex1: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  back:   { width: 36, height: 36, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  hTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  hSub:   { fontSize: 11, color: colors.muted, marginTop: 1 },
  intBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f3ff', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  intBadgeTxt: { fontSize: 10, fontWeight: '700', color: '#7c3aed' },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tabItem: { flex: 1, paddingVertical: 11, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabOn:  { borderBottomColor: colors.primary },
  tabTxt: { fontSize: 13, fontWeight: '600', color: colors.muted },
  tabTxtOn: { color: colors.primary },
  secTitle: { fontSize: 12, fontWeight: '700', color: colors.muted, paddingHorizontal: 16, marginTop: 16, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16, marginBottom: 16 },
  statCard: { flex: 1, minWidth: '40%', backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  statIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statVal:  { fontSize: 24, fontWeight: '800', marginBottom: 2 },
  statLbl:  { fontSize: 11, color: colors.muted, textAlign: 'center' },
  qBanner:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f5f3ff', borderRadius: 12, marginHorizontal: 16, marginBottom: 6, padding: 12 },
  qTxt:     { fontSize: 13, color: colors.text },
  card:   { backgroundColor: '#fff', borderRadius: 14, marginHorizontal: 16, marginBottom: 16, padding: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  bRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  bLbl:   { flex: 1, fontSize: 13, color: colors.text },
  bCnt:   { fontSize: 14, fontWeight: '800' },
  dot:    { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  hRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  hLbl:   { flex: 1, fontSize: 13, color: colors.text },
  hVal:   { fontSize: 13, fontWeight: '700', color: colors.text },
  div:    { height: 1, backgroundColor: '#e2e8f0', marginVertical: 10 },
  rRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  rLbl:   { width: 65, fontSize: 12, color: colors.muted },
  pBar:   { flex: 1, height: 7, backgroundColor: '#e2e8f0', borderRadius: 99, marginHorizontal: 10, overflow: 'hidden' },
  pFill:  { height: '100%', borderRadius: 99 },
  rVal:   { width: 36, fontSize: 12, fontWeight: '700', color: colors.text, textAlign: 'right' },
  rInfo:  { fontSize: 11, color: colors.muted, marginTop: 4 },
  lastUpd: { fontSize: 10, color: colors.muted, textAlign: 'right', marginTop: 8 },
  chipRow: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  chip:   { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipT:  { fontSize: 12, fontWeight: '600', color: colors.muted },
  chipTOn: { color: '#fff' },
  srchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, marginHorizontal: 16, marginVertical: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  srchIn:  { flex: 1, fontSize: 13, color: colors.text },
  cntTxt:  { fontSize: 11, color: colors.muted, paddingHorizontal: 16, marginBottom: 6 },
  eCard:  { backgroundColor: '#fff', borderRadius: 14, marginBottom: 10, padding: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  eTop:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  eId:    { fontSize: 11, fontWeight: '700', color: colors.muted },
  eType:  { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 3 },
  eMsg:   { fontSize: 12, color: colors.muted, lineHeight: 17, marginBottom: 6 },
  eMeta:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eEp:    { fontSize: 11, color: '#0284c7', flex: 1, marginRight: 8 },
  eTime:  { fontSize: 10, color: colors.muted },
  occPill: { alignSelf: 'flex-start', marginTop: 6, backgroundColor: '#fef3c7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  occTxt:  { fontSize: 10, fontWeight: '700', color: '#d97706' },
  kCol:   { width: 210, marginLeft: 12, backgroundColor: '#f8fafc', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', marginVertical: 10, overflow: 'hidden' },
  kHead:  { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10 },
  kTitle: { flex: 1, fontSize: 12, fontWeight: '700' },
  kBadge: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  kBadgeTxt: { fontSize: 10, fontWeight: '800', color: '#fff' },
  kEmpty: { fontSize: 12, color: '#94a3b8', textAlign: 'center', paddingVertical: 20 },
  kCard:  { backgroundColor: '#fff', borderRadius: 10, margin: 8, padding: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  kId:    { fontSize: 10, color: colors.muted, marginBottom: 4 },
  kType:  { fontSize: 12, fontWeight: '700', color: colors.text, marginTop: 4, marginBottom: 3 },
  kMsg:   { fontSize: 11, color: colors.muted, lineHeight: 15 },
  kAsgn:  { fontSize: 10, color: '#4f46e5', fontWeight: '600', marginTop: 4 },
  ov:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.52)', justifyContent: 'flex-end' },
  sh:     { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 12, maxHeight: '80%' },
  hndl:   { width: 40, height: 4, backgroundColor: '#e2e8f0', borderRadius: 99, alignSelf: 'center', marginBottom: 14 },
  mHead:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  mTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  dtSec:  { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 14, marginBottom: 5 },
  dtBold: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 2 },
  dtTxt:  { fontSize: 13, color: colors.text, lineHeight: 18, marginBottom: 2 },
  dtMono: { fontSize: 12, color: '#0284c7', marginBottom: 4 },
  stkBox: { backgroundColor: '#0f172a', borderRadius: 10, padding: 12, marginBottom: 8, maxHeight: 130 },
  stkTxt: { fontSize: 11, color: '#94a3b8', lineHeight: 16 },
  actRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  actBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: 10 },
  actTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },
  fLbl:   { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 8 },
  fIn:    { backgroundColor: '#f8fafc', borderRadius: 10, padding: 12, fontSize: 14, color: colors.text, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 14 },
  subBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  subTxt: { fontSize: 15, fontWeight: '800', color: '#fff' },
  empty:  { alignItems: 'center', paddingVertical: 48 },
  emptyT: { fontSize: 14, color: colors.muted, marginTop: 10 },
  denied: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  deniedT: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 16, marginBottom: 10 },
  deniedS: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 22 },
  badge:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: '700' },
});
