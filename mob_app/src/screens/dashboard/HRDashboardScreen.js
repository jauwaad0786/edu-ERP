// mob_app/src/screens/dashboard/HRDashboardScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
const C = { primary: '#be123c', text: '#1e293b', muted: '#64748b', bg: '#f0f4f8', error: '#dc2626', green: '#16a34a', warning: '#d97706' };
export default function HRDashboardScreen() {
  const { user, logout } = useAuth();
  const [employees, setEmployees] = useState([]); const [leaveReqs, setLeaveReqs] = useState([]); const [attSummary, setAttSummary] = useState(null); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [e, lr, att] = await Promise.all([
        client.get('/hrms/employees', { params: { per_page: 20 } }).catch(() => ({ data: { employees: [] } })),
        client.get('/hrms/leaves/requests', { params: { status: 'PENDING', per_page: 5 } }).catch(() => ({ data: [] })),
        client.get('/staff-attendance/dashboard').catch(() => ({ data: null })),
      ]);
      setEmployees(e.data?.employees || e.data?.staff || []); setLeaveReqs(Array.isArray(lr.data) ? lr.data : []); setAttSummary(att.data);
    } finally { if (isRefresh) setRefreshing(false); else setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  if (loading) return <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}><ActivityIndicator size="large" color={C.primary} /></SafeAreaView>;
  const attPct = attSummary?.present != null && employees.length > 0 ? Math.round((attSummary.present / employees.length) * 100) : null;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[C.primary]} />}>
        <View style={{ backgroundColor: '#9f1239', borderRadius: 18, padding: 22, marginBottom: 16 }}>
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '700', letterSpacing: 1.5 }}>HUMAN RESOURCES</Text>
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 4 }}>HR Operations Center</Text>
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 }}>{employees.length} employees · {leaveReqs.length} pending leaves</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          {[
            { l: 'Total Staff', v: employees.length, c: C.primary },
            { l: 'Present Today', v: attSummary?.present ?? '—', c: C.green },
            { l: 'Attendance', v: attPct != null ? `${attPct}%` : '—', c: attPct >= 90 ? C.green : C.warning },
            { l: 'Pending Leaves', v: leaveReqs.length, c: leaveReqs.length > 0 ? C.warning : C.green },
          ].map((k, i) => (
            <View key={i} style={{ width: '47%', backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', borderLeftWidth: 3, borderLeftColor: k.c, alignItems: 'center' }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#1e293b', marginBottom: 2 }}>{k.v ?? '—'}</Text>
              <Text style={{ fontSize: 10, color: C.muted, fontWeight: '600', textAlign: 'center' }}>{k.l}</Text>
            </View>
          ))}
        </View>
        {leaveReqs.length > 0 && (
          <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#e2e8f0' }}>
            <Text style={{ fontWeight: '700', fontSize: 14, color: C.text, marginBottom: 10 }}>Pending Leave Requests</Text>
            {leaveReqs.map(req => (
              <View key={req.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                <Text style={{ fontWeight: '600', fontSize: 13, color: C.text }}>{req.employee_name || 'Employee'}</Text>
                <Text style={{ fontSize: 11, color: C.muted }}>{req.leave_type} · {req.from_date} → {req.to_date}</Text>
              </View>
            ))}
          </View>
        )}
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#fecaca', backgroundColor: '#fef2f2' }}
          onPress={() => Alert.alert('Logout', 'Sure?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Logout', style: 'destructive', onPress: logout }])}>
          <Ionicons name="log-out-outline" size={16} color={C.error} /><Text style={{ color: C.error, fontWeight: '700', fontSize: 14 }}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
