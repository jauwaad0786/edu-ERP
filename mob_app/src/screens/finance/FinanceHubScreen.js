// mob_app/src/screens/finance/FinanceHubScreen.js
// Finance Hub — 4-tab unified financial command center.
// Tabs:
//   Dashboard   — /api/fees-finance/dashboard  (KPIs, monthly chart, class-wise collections)
//   Purchases   — /api/finance/purchases/orders + /api/finance/purchases/bills
//                 Create PO, receive GRN, pay bill
//   Vendors     — /api/finance/vendors + /api/finance/vendors/:id/history
//   Reports     — /api/fees-finance/reports (pending dues summary, surplus)

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

const TABS = ['Dashboard', 'Purchases', 'Vendors', 'Reports'];

const PO_STATUS_CFG = {
  DRAFT:     { color: '#64748b', bg: '#f8fafc' },
  PENDING:   { color: '#d97706', bg: '#fffbeb' },
  APPROVED:  { color: '#3b82f6', bg: '#eff6ff' },
  ORDERED:   { color: '#7c3aed', bg: '#f5f3ff' },
  RECEIVED:  { color: '#16a34a', bg: '#f0fdf4' },
  CANCELLED: { color: '#dc2626', bg: '#fef2f2' },
};

const VENDOR_CATS = ['STATIONERY', 'FURNITURE', 'FOOD', 'EQUIPMENT', 'TRANSPORT', 'IT', 'MAINTENANCE', 'OTHER'];
const PAY_MODES   = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'ONLINE', 'DD'];

const INR = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

function Badge({ label, color, bg }) {
  return (
    <View style={{ backgroundColor: bg || '#f1f5f9', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ fontSize: 10, fontWeight: '700', color: color || '#64748b' }}>{label}</Text>
    </View>
  );
}

function KpiCard({ label, value, color, icon, sub }) {
  return (
    <View style={s.kpiCard}>
      <View style={[s.kpiIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={[s.kpiVal, { color }]}>{value}</Text>
      <Text style={s.kpiLbl}>{label}</Text>
      {sub ? <Text style={s.kpiSub}>{sub}</Text> : null}
    </View>
  );
}

export default function FinanceHubScreen({ navigation }) {
  const [tab, setTab] = useState(0);

  // ── Dashboard ────────────────────────────────────────────────────────────
  const [session,     setSession]     = useState('2026-27');
  const [dash,        setDash]        = useState(null);
  const [loadDash,    setLoadDash]    = useState(true);
  const [refDash,     setRefDash]     = useState(false);

  // ── Purchases ────────────────────────────────────────────────────────────
  const [orders,       setOrders]      = useState([]);
  const [bills,        setBills]       = useState([]);
  const [vendors,      setVendors]     = useState([]);
  const [loadPO,       setLoadPO]      = useState(false);
  const [poTab,        setPoTab]       = useState('ORDERS');   // ORDERS | BILLS
  const [poStatus,     setPoStatus]    = useState('');

  // Create PO modal
  const [poModal,      setPoModal]     = useState(false);
  const [poForm,       setPoForm]      = useState({
    vendor_id: '', target_type: 'INVENTORY', expected_delivery_date: '', notes: '',
    items: [{ item_name: '', category: 'STATIONERY', unit: 'PIECES', ordered_qty: '1', unit_price: '0', tax_pct: '0' }],
  });
  const [subPO,        setSubPO]       = useState(false);

  // GRN modal
  const [grnModal,     setGrnModal]    = useState(false);
  const [selOrder,     setSelOrder]    = useState(null);
  const [grnForm,      setGrnForm]     = useState({ challan_no: '', notes: '', items: [] });
  const [subGRN,       setSubGRN]      = useState(false);

  // Pay Bill modal
  const [payModal,     setPayModal]    = useState(false);
  const [selBill,      setSelBill]     = useState(null);
  const [payForm,      setPayForm]     = useState({ amount: '', payment_mode: 'BANK_TRANSFER', reference_no: '', notes: '' });
  const [subPay,       setSubPay]      = useState(false);

  // ── Vendors ──────────────────────────────────────────────────────────────
  const [vList,        setVList]       = useState([]);
  const [loadV,        setLoadV]       = useState(false);
  const [vSearch,      setVSearch]     = useState('');
  const [vCat,         setVCat]        = useState('');
  const [vModal,       setVModal]      = useState(false);
  const [vForm,        setVForm]       = useState({
    name: '', contact_person: '', phone: '', email: '', address: '',
    gst_number: '', pan_number: '', category: 'STATIONERY', payment_terms: 'Net 30',
    bank_name: '', bank_account_no: '', bank_ifsc: '', notes: '',
  });
  const [subVendor,    setSubVendor]   = useState(false);

  // Vendor history
  const [vHist,        setVHist]       = useState(null);
  const [vHistData,    setVHistData]   = useState(null);
  const [loadVH,       setLoadVH]      = useState(false);

  // ── Reports ──────────────────────────────────────────────────────────────
  const [rptData,      setRptData]     = useState(null);
  const [loadRpt,      setLoadRpt]     = useState(false);

  // ──────────────────────────────────────────────────────────────────────────
  const fetchDash = useCallback(async (refresh = false) => {
    if (refresh) setRefDash(true); else setLoadDash(true);
    try {
      const res = await client.get('/fees-finance/dashboard', { params: { session } });
      setDash(res.data);
    } catch (_) {}
    finally { setLoadDash(false); setRefDash(false); }
  }, [session]);

  const fetchPO = useCallback(async () => {
    setLoadPO(true);
    try {
      const [vRes, oRes, bRes] = await Promise.allSettled([
        client.get('/finance/vendors'),
        client.get('/finance/purchases/orders', { params: { status: poStatus } }),
        client.get('/finance/purchases/bills'),
      ]);
      if (vRes.status === 'fulfilled') setVendors(vRes.value.data || []);
      if (oRes.status === 'fulfilled') setOrders(oRes.value.data || []);
      if (bRes.status === 'fulfilled') setBills(bRes.value.data || []);
    } catch (_) {}
    finally { setLoadPO(false); }
  }, [poStatus]);

  const fetchVendors = useCallback(async () => {
    setLoadV(true);
    try {
      const res = await client.get('/finance/vendors', { params: { search: vSearch, category: vCat } });
      setVList(res.data || []);
    } catch (_) {}
    finally { setLoadV(false); }
  }, [vSearch, vCat]);

  const fetchReports = useCallback(async () => {
    setLoadRpt(true);
    try {
      const res = await client.get('/fees-finance/reports', { params: { session } });
      setRptData(res.data);
    } catch (_) {}
    finally { setLoadRpt(false); }
  }, [session]);

  useEffect(() => {
    if (tab === 0) fetchDash();
    if (tab === 1) fetchPO();
    if (tab === 2) fetchVendors();
    if (tab === 3) fetchReports();
  }, [tab]);

  useEffect(() => { if (tab === 0) fetchDash(); }, [session]);
  useEffect(() => { if (tab === 1) fetchPO(); },  [poStatus]);
  useEffect(() => { if (tab === 2) fetchVendors(); }, [vSearch, vCat]);

  // ── Create PO ──────────────────────────────────────────────────────────────
  const submitPO = async () => {
    if (!poForm.vendor_id || !poForm.items[0].item_name) {
      Alert.alert('Required', 'Select a vendor and add at least one item');
      return;
    }
    setSubPO(true);
    try {
      const payload = {
        ...poForm,
        items: poForm.items.map(i => ({
          ...i,
          ordered_qty: Number(i.ordered_qty),
          unit_price: Number(i.unit_price),
          tax_pct: Number(i.tax_pct),
        })),
      };
      await client.post('/finance/purchases/orders', payload);
      Alert.alert('Created', 'Purchase order created successfully');
      setPoModal(false);
      fetchPO();
    } catch (e) {
      Alert.alert('Failed', e?.response?.data?.error || 'Could not create PO');
    } finally { setSubPO(false); }
  };

  // ── GRN ────────────────────────────────────────────────────────────────────
  const openGRN = (order) => {
    setSelOrder(order);
    setGrnForm({
      challan_no: '',
      notes: '',
      items: (order.items || []).map(i => ({
        po_item_id: i.id,
        item_name: i.item_name,
        received_qty: String(i.pending_qty || i.ordered_qty),
        unit_price: String(i.unit_price),
      })),
    });
    setGrnModal(true);
  };

  const submitGRN = async () => {
    if (!grnForm.challan_no.trim()) { Alert.alert('Required', 'Enter challan number'); return; }
    setSubGRN(true);
    try {
      await client.post('/finance/purchases/orders/' + selOrder.id + '/grn', {
        challan_no: grnForm.challan_no,
        notes: grnForm.notes,
        items: grnForm.items.map(i => ({
          po_item_id: i.po_item_id,
          received_qty: Number(i.received_qty),
          unit_price: Number(i.unit_price),
        })),
      });
      Alert.alert('GRN Recorded', 'Goods received note saved');
      setGrnModal(false);
      fetchPO();
    } catch (e) {
      Alert.alert('Failed', e?.response?.data?.error || 'GRN failed');
    } finally { setSubGRN(false); }
  };

  // ── Pay Bill ────────────────────────────────────────────────────────────────
  const openPay = (bill) => {
    setSelBill(bill);
    setPayForm({ amount: String(bill.balance_due || bill.total_amount || ''), payment_mode: 'BANK_TRANSFER', reference_no: '', notes: '' });
    setPayModal(true);
  };

  const submitPay = async () => {
    if (!payForm.amount || Number(payForm.amount) <= 0) { Alert.alert('Required', 'Enter a valid amount'); return; }
    setSubPay(true);
    try {
      await client.post('/finance/purchases/bills/' + selBill.id + '/pay', {
        amount: Number(payForm.amount),
        payment_mode: payForm.payment_mode,
        reference_no: payForm.reference_no || undefined,
        notes: payForm.notes || undefined,
      });
      Alert.alert('Payment Recorded', 'Bill payment saved');
      setPayModal(false);
      fetchPO();
    } catch (e) {
      Alert.alert('Failed', e?.response?.data?.error || 'Payment failed');
    } finally { setSubPay(false); }
  };

  // ── Save Vendor ────────────────────────────────────────────────────────────
  const saveVendor = async () => {
    if (!vForm.name.trim()) { Alert.alert('Required', 'Enter vendor name'); return; }
    setSubVendor(true);
    try {
      await client.post('/finance/vendors', vForm);
      Alert.alert('Saved', 'Vendor profile registered');
      setVModal(false);
      setVForm({ name: '', contact_person: '', phone: '', email: '', address: '', gst_number: '', pan_number: '', category: 'STATIONERY', payment_terms: 'Net 30', bank_name: '', bank_account_no: '', bank_ifsc: '', notes: '' });
      fetchVendors();
    } catch (e) {
      Alert.alert('Failed', e?.response?.data?.error || 'Could not save vendor');
    } finally { setSubVendor(false); }
  };

  // ── Vendor History ─────────────────────────────────────────────────────────
  const openVendorHistory = async (v) => {
    setVHist(v); setVHistData(null); setLoadVH(true);
    try {
      const res = await client.get('/finance/vendors/' + v.id + '/history');
      setVHistData(res.data);
    } catch (_) {}
    finally { setLoadVH(false); }
  };

  // ── Monthly chart bar helper ───────────────────────────────────────────────
  const chartMax = dash?.monthly_summary
    ? Math.max(...dash.monthly_summary.map(m => Math.max(m.billed || 0, m.collected || 0, m.expenses || 0)), 1)
    : 1;

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.hTitle}>Finance Hub</Text>
          <Text style={s.hSub}>Dashboard · Purchases · Vendors · Reports</Text>
        </View>
        <View style={s.sessionPill}>
          <Ionicons name="calendar" size={11} color="#0284c7" />
          <Text style={s.sessionTxt}> {session}</Text>
        </View>
      </View>

      {/* Tab Bar */}
      <View style={s.tabBar}>
        {TABS.map((t, i) => (
          <TouchableOpacity key={t} style={[s.tabItem, tab === i && s.tabOn]} onPress={() => setTab(i)}>
            <Text style={[s.tabTxt, tab === i && s.tabTxtOn]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ═══ TAB 0: DASHBOARD ═══════════════════════════════════════════════ */}
      {tab === 0 && (
        <ScrollView style={s.flex1} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refDash} onRefresh={() => fetchDash(true)} tintColor={colors.primary} />}>
          {loadDash && !refDash
            ? <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} />
            : <>
                {/* Session Selector */}
                <View style={s.sessPicker}>
                  {['2024-25', '2025-26', '2026-27'].map(yr => (
                    <TouchableOpacity key={yr} style={[s.sessBtn, session === yr && s.sessBtnOn]} onPress={() => setSession(yr)}>
                      <Text style={[s.sessBtnTxt, session === yr && s.sessBtnTxtOn]}>{yr}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* KPI Grid */}
                <Text style={s.secTitle}>Financial Overview</Text>
                <View style={s.kpiGrid}>
                  <KpiCard label="Total Billed" value={INR(dash?.total_billed)} color="#3b82f6" icon="receipt" />
                  <KpiCard label="Collected" value={INR(dash?.total_collected)} color="#16a34a" icon="checkmark-circle" />
                  <KpiCard label="Outstanding" value={INR(dash?.total_outstanding)} color="#dc2626" icon="alert-circle" />
                  <KpiCard label="Net Surplus" value={INR(dash?.net_surplus)} color="#7c3aed" icon="trending-up"
                    sub={dash?.total_expenses ? 'Exp: ' + INR(dash.total_expenses) : null} />
                </View>

                {/* Extra stats */}
                {dash && (
                  <View style={s.card}>
                    {[
                      { l: 'Collection Rate', v: (dash.collection_rate || 0) + '%', c: '#16a34a' },
                      { l: 'Total Expenses', v: INR(dash.total_expenses), c: '#dc2626' },
                      { l: 'Students Billed', v: String(dash.students_billed || 0), c: '#3b82f6' },
                      { l: 'Students Defaulting', v: String(dash.students_defaulting || 0), c: '#d97706' },
                    ].map(r => (
                      <View key={r.l} style={s.statRow}>
                        <Text style={s.statLbl}>{r.l}</Text>
                        <Text style={[s.statVal, { color: r.c }]}>{r.v}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Monthly Chart */}
                {dash?.monthly_summary && dash.monthly_summary.length > 0 && (
                  <>
                    <Text style={s.secTitle}>Monthly Cash Flow</Text>
                    <View style={s.card}>
                      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 12 }}>
                        {[{ c: '#3b82f6', l: 'Billed' }, { c: '#16a34a', l: 'Collected' }, { c: '#dc2626', l: 'Expenses' }].map(lg => (
                          <View key={lg.l} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: lg.c }} />
                            <Text style={{ fontSize: 11, color: colors.muted }}>{lg.l}</Text>
                          </View>
                        ))}
                      </View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingBottom: 4 }}>
                          {dash.monthly_summary.map((m, idx) => (
                            <View key={idx} style={{ alignItems: 'center', width: 44 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 80 }}>
                                {[
                                  { v: m.billed, c: '#3b82f6' },
                                  { v: m.collected, c: '#16a34a' },
                                  { v: m.expenses, c: '#dc2626' },
                                ].map((b, bi) => (
                                  <View key={bi} style={{
                                    width: 9, borderRadius: 3,
                                    height: Math.max(3, (b.v / chartMax) * 78),
                                    backgroundColor: b.c,
                                  }} />
                                ))}
                              </View>
                              <Text style={s.chartLbl}>{m.month}</Text>
                            </View>
                          ))}
                        </View>
                      </ScrollView>
                    </View>
                  </>
                )}

                {/* Class-wise breakdown */}
                {dash?.class_summary && dash.class_summary.length > 0 && (
                  <>
                    <Text style={s.secTitle}>Class-wise Collections</Text>
                    <View style={s.card}>
                      {dash.class_summary.slice(0, 8).map((cls, i) => (
                        <View key={i} style={s.classRow}>
                          <Text style={s.classLbl} numberOfLines={1}>{cls.class_name}</Text>
                          <View style={s.classBarBg}>
                            <View style={[s.classBarFill, {
                              width: ((cls.collected / (cls.billed || 1)) * 100) + '%',
                              backgroundColor: cls.collected >= cls.billed ? '#16a34a' : '#3b82f6',
                            }]} />
                          </View>
                          <Text style={s.classAmt}>{INR(cls.collected)}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}

                <View style={{ height: 30 }} />
              </>
          }
        </ScrollView>
      )}

      {/* ═══ TAB 1: PURCHASES ══════════════════════════════════════════════ */}
      {tab === 1 && (
        <View style={s.flex1}>
          {/* Sub-tab + Create PO */}
          <View style={s.subTabBar}>
            {['ORDERS', 'BILLS'].map(pt => (
              <TouchableOpacity key={pt} style={[s.subTabItem, poTab === pt && s.subTabOn]} onPress={() => setPoTab(pt)}>
                <Text style={[s.subTabTxt, poTab === pt && s.subTabTxtOn]}>{pt}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={s.createBtn} onPress={() => setPoModal(true)}>
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={s.createBtnTxt}>New PO</Text>
            </TouchableOpacity>
          </View>

          {/* Status filter chips (orders only) */}
          {poTab === 'ORDERS' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, paddingHorizontal: 16, paddingVertical: 8 }}
              style={s.chipRow}>
              {['', 'DRAFT', 'PENDING', 'APPROVED', 'RECEIVED', 'CANCELLED'].map(st => (
                <TouchableOpacity key={st || 'all'} style={[s.chip, poStatus === st && s.chipOn]} onPress={() => setPoStatus(st)}>
                  <Text style={[s.chipT, poStatus === st && s.chipTOn]}>{st || 'All'}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {loadPO
            ? <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
            : <FlatList
                data={poTab === 'ORDERS' ? orders : bills}
                keyExtractor={i => String(i.id)}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}
                ListEmptyComponent={
                  <View style={s.empty}><Ionicons name="document-outline" size={40} color="#e2e8f0" /><Text style={s.emptyT}>No {poTab === 'ORDERS' ? 'purchase orders' : 'bills'} found</Text></View>
                }
                renderItem={({ item }) => {
                  if (poTab === 'ORDERS') {
                    const cfg = PO_STATUS_CFG[item.status] || { color: '#64748b', bg: '#f8fafc' };
                    return (
                      <View style={s.poCard}>
                        <View style={s.poTop}>
                          <Text style={s.poId}>PO-{item.id}</Text>
                          <Badge label={item.status} color={cfg.color} bg={cfg.bg} />
                          <Badge label={item.target_type || 'INVENTORY'} color="#7c3aed" bg="#f5f3ff" />
                        </View>
                        <Text style={s.poVendor} numberOfLines={1}>{item.vendor_name || 'Unknown Vendor'}</Text>
                        <View style={s.poMeta}>
                          <Text style={s.poDate}>{item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}</Text>
                          <Text style={[s.poAmt, { color: '#3b82f6' }]}>{INR(item.total_amount)}</Text>
                        </View>
                        {(item.status === 'APPROVED' || item.status === 'ORDERED') && (
                          <TouchableOpacity style={s.grnBtn} onPress={() => openGRN(item)}>
                            <Ionicons name="cube" size={13} color="#fff" />
                            <Text style={s.grnBtnTxt}>Receive GRN</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  } else {
                    const isPaid = item.status === 'PAID';
                    return (
                      <View style={s.poCard}>
                        <View style={s.poTop}>
                          <Text style={s.poId}>BILL-{item.id}</Text>
                          <Badge label={item.status} color={isPaid ? '#16a34a' : '#d97706'} bg={isPaid ? '#f0fdf4' : '#fffbeb'} />
                        </View>
                        <Text style={s.poVendor} numberOfLines={1}>{item.vendor_name || 'Unknown Vendor'}</Text>
                        <View style={s.poMeta}>
                          <Text style={s.poDate}>{item.due_date ? 'Due: ' + new Date(item.due_date).toLocaleDateString() : ''}</Text>
                          <Text style={[s.poAmt, { color: isPaid ? '#16a34a' : '#dc2626' }]}>{INR(item.balance_due || item.total_amount)}</Text>
                        </View>
                        {!isPaid && (
                          <TouchableOpacity style={[s.grnBtn, { backgroundColor: '#16a34a' }]} onPress={() => openPay(item)}>
                            <Ionicons name="card" size={13} color="#fff" />
                            <Text style={s.grnBtnTxt}>Pay Bill</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  }
                }}
              />
          }
        </View>
      )}

      {/* ═══ TAB 2: VENDORS ═════════════════════════════════════════════════ */}
      {tab === 2 && (
        <View style={s.flex1}>
          {/* Search + Add */}
          <View style={s.vSearchRow}>
            <View style={[s.srchBox, { flex: 1, marginRight: 8 }]}>
              <Ionicons name="search" size={14} color={colors.muted} style={{ marginRight: 6 }} />
              <TextInput style={s.srchIn} placeholder="Search vendors..." placeholderTextColor={colors.muted}
                value={vSearch} onChangeText={setVSearch} />
            </View>
            <TouchableOpacity style={s.addVBtn} onPress={() => setVModal(true)}>
              <Ionicons name="add" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Category chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingHorizontal: 16, paddingBottom: 6 }}
            style={s.chipRow}>
            {['', ...VENDOR_CATS.slice(0, 6)].map(c => (
              <TouchableOpacity key={c || 'all'} style={[s.chip, vCat === c && s.chipOn]} onPress={() => setVCat(c)}>
                <Text style={[s.chipT, vCat === c && s.chipTOn]}>{c || 'All'}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {loadV
            ? <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
            : <FlatList
                data={vList}
                keyExtractor={i => String(i.id)}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}
                ListEmptyComponent={<View style={s.empty}><Ionicons name="business-outline" size={40} color="#e2e8f0" /><Text style={s.emptyT}>No vendors found</Text></View>}
                renderItem={({ item }) => (
                  <TouchableOpacity style={s.vCard} onPress={() => openVendorHistory(item)} activeOpacity={0.8}>
                    <View style={s.vTop}>
                      <View style={s.vAvatar}>
                        <Text style={s.vAvatarTxt}>{(item.name || 'V')[0].toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.vName} numberOfLines={1}>{item.name}</Text>
                        {item.contact_person && <Text style={s.vContact}>{item.contact_person}</Text>}
                      </View>
                      <Badge label={item.category || 'OTHER'} color="#7c3aed" bg="#f5f3ff" />
                    </View>
                    {item.phone && (
                      <View style={s.vMeta}>
                        <Ionicons name="call-outline" size={12} color={colors.muted} />
                        <Text style={s.vMetaTxt}>{item.phone}</Text>
                      </View>
                    )}
                    {item.outstanding_amount > 0 && (
                      <View style={s.vBalance}>
                        <Text style={s.vBalanceLbl}>Outstanding:</Text>
                        <Text style={s.vBalanceAmt}>{INR(item.outstanding_amount)}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
              />
          }
        </View>
      )}

      {/* ═══ TAB 3: REPORTS ═════════════════════════════════════════════════ */}
      {tab === 3 && (
        <ScrollView style={s.flex1} showsVerticalScrollIndicator={false}>
          {loadRpt
            ? <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} />
            : rptData
              ? <>
                  <Text style={s.secTitle}>Financial Reports — {session}</Text>

                  {/* Summary cards */}
                  <View style={s.kpiGrid}>
                    <KpiCard label="Total Pending" value={INR(rptData.total_pending_dues)} color="#dc2626" icon="alert-circle" />
                    <KpiCard label="Collected YTD" value={INR(rptData.collected_ytd)} color="#16a34a" icon="checkmark-circle" />
                  </View>

                  {/* Top defaulters */}
                  {rptData.top_defaulters && rptData.top_defaulters.length > 0 && (
                    <>
                      <Text style={s.secTitle}>Top Defaulters</Text>
                      <View style={s.card}>
                        {rptData.top_defaulters.map((d, i) => (
                          <View key={i} style={s.statRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }} numberOfLines={1}>{d.student_name}</Text>
                              <Text style={s.statLbl}>{d.class_name}</Text>
                            </View>
                            <Text style={[s.statVal, { color: '#dc2626' }]}>{INR(d.pending)}</Text>
                          </View>
                        ))}
                      </View>
                    </>
                  )}

                  {/* Class-wise dues */}
                  {rptData.class_dues && rptData.class_dues.length > 0 && (
                    <>
                      <Text style={s.secTitle}>Class-wise Pending Dues</Text>
                      <View style={s.card}>
                        {rptData.class_dues.map((c, i) => (
                          <View key={i} style={s.statRow}>
                            <Text style={s.statLbl}>{c.class_name}</Text>
                            <Text style={[s.statVal, { color: '#d97706' }]}>{INR(c.pending)}</Text>
                          </View>
                        ))}
                      </View>
                    </>
                  )}

                  {/* Expense breakdown */}
                  {rptData.expense_by_category && Object.keys(rptData.expense_by_category).length > 0 && (
                    <>
                      <Text style={s.secTitle}>Expense by Category</Text>
                      <View style={s.card}>
                        {Object.entries(rptData.expense_by_category).map(([cat, amt]) => (
                          <View key={cat} style={s.statRow}>
                            <Text style={s.statLbl}>{cat}</Text>
                            <Text style={[s.statVal, { color: '#dc2626' }]}>{INR(amt)}</Text>
                          </View>
                        ))}
                      </View>
                    </>
                  )}

                  <View style={{ height: 30 }} />
                </>
              : <View style={s.empty}>
                  <Ionicons name="bar-chart-outline" size={44} color="#e2e8f0" />
                  <Text style={s.emptyT}>Report data unavailable</Text>
                </View>
          }
        </ScrollView>
      )}

      {/* ═══ CREATE PO MODAL ═════════════════════════════════════════════════ */}
      <Modal visible={poModal} animationType="slide" transparent onRequestClose={() => setPoModal(false)}>
        <View style={s.ov}>
          <View style={[s.sh, { maxHeight: '92%' }]}>
            <View style={s.hndl} />
            <View style={s.mHead}>
              <Text style={s.mTitle}>New Purchase Order</Text>
              <TouchableOpacity onPress={() => setPoModal(false)}><Ionicons name="close" size={22} color={colors.text} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.fLbl}>Vendor *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}
                contentContainerStyle={{ gap: 6 }}>
                {vendors.map(v => (
                  <TouchableOpacity key={v.id} style={[s.chip, poForm.vendor_id === String(v.id) && s.chipOn]} onPress={() => setPoForm(f => ({ ...f, vendor_id: String(v.id) }))}>
                    <Text style={[s.chipT, poForm.vendor_id === String(v.id) && s.chipTOn]} numberOfLines={1}>{v.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={s.fLbl}>Type</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                {['INVENTORY', 'ASSET', 'SERVICE'].map(t => (
                  <TouchableOpacity key={t} style={[s.chip, poForm.target_type === t && s.chipOn]} onPress={() => setPoForm(f => ({ ...f, target_type: t }))}>
                    <Text style={[s.chipT, poForm.target_type === t && s.chipTOn]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.fLbl}>Expected Delivery</Text>
              <TextInput style={s.fIn} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted}
                value={poForm.expected_delivery_date} onChangeText={v => setPoForm(f => ({ ...f, expected_delivery_date: v }))} />

              <Text style={s.fLbl}>Notes</Text>
              <TextInput style={[s.fIn, { height: 64, textAlignVertical: 'top' }]} placeholder="Optional notes..."
                placeholderTextColor={colors.muted} value={poForm.notes} onChangeText={v => setPoForm(f => ({ ...f, notes: v }))} multiline />

              <Text style={[s.fLbl, { marginTop: 8 }]}>Line Items</Text>
              {poForm.items.map((item, idx) => (
                <View key={idx} style={s.poLineItem}>
                  <TextInput style={s.fIn} placeholder="Item name *" placeholderTextColor={colors.muted}
                    value={item.item_name} onChangeText={v => {
                      const items = [...poForm.items]; items[idx].item_name = v; setPoForm(f => ({ ...f, items }));
                    }} />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput style={[s.fIn, { flex: 1 }]} placeholder="Qty" placeholderTextColor={colors.muted}
                      keyboardType="numeric" value={item.ordered_qty} onChangeText={v => {
                        const items = [...poForm.items]; items[idx].ordered_qty = v; setPoForm(f => ({ ...f, items }));
                      }} />
                    <TextInput style={[s.fIn, { flex: 1 }]} placeholder="Unit Price" placeholderTextColor={colors.muted}
                      keyboardType="numeric" value={item.unit_price} onChangeText={v => {
                        const items = [...poForm.items]; items[idx].unit_price = v; setPoForm(f => ({ ...f, items }));
                      }} />
                    <TextInput style={[s.fIn, { flex: 1 }]} placeholder="Tax%" placeholderTextColor={colors.muted}
                      keyboardType="numeric" value={item.tax_pct} onChangeText={v => {
                        const items = [...poForm.items]; items[idx].tax_pct = v; setPoForm(f => ({ ...f, items }));
                      }} />
                  </View>
                </View>
              ))}
              <TouchableOpacity style={s.addLineBtn} onPress={() => setPoForm(f => ({ ...f, items: [...f.items, { item_name: '', category: 'STATIONERY', unit: 'PIECES', ordered_qty: '1', unit_price: '0', tax_pct: '0' }] }))}>
                <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
                <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '600', marginLeft: 4 }}>Add Line Item</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[s.subBtn, subPO && { opacity: 0.6 }]} onPress={submitPO} disabled={subPO}>
                {subPO ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.subTxt}>Create Purchase Order</Text>}
              </TouchableOpacity>
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═══ GRN MODAL ══════════════════════════════════════════════════════ */}
      <Modal visible={grnModal} animationType="slide" transparent onRequestClose={() => setGrnModal(false)}>
        <View style={s.ov}>
          <View style={[s.sh, { maxHeight: '88%' }]}>
            <View style={s.hndl} />
            <View style={s.mHead}>
              <Text style={s.mTitle}>Receive GRN — PO-{selOrder?.id}</Text>
              <TouchableOpacity onPress={() => setGrnModal(false)}><Ionicons name="close" size={22} color={colors.text} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.fLbl}>Challan / DC Number *</Text>
              <TextInput style={s.fIn} placeholder="Challan number" placeholderTextColor={colors.muted}
                value={grnForm.challan_no} onChangeText={v => setGrnForm(f => ({ ...f, challan_no: v }))} />
              <Text style={s.fLbl}>Notes</Text>
              <TextInput style={[s.fIn, { height: 64, textAlignVertical: 'top' }]} placeholder="Optional notes..." placeholderTextColor={colors.muted}
                value={grnForm.notes} onChangeText={v => setGrnForm(f => ({ ...f, notes: v }))} multiline />

              {grnForm.items.map((it, idx) => (
                <View key={idx} style={s.poLineItem}>
                  <Text style={s.fLbl}>{it.item_name}</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput style={[s.fIn, { flex: 1 }]} placeholder="Received Qty" placeholderTextColor={colors.muted}
                      keyboardType="numeric" value={it.received_qty} onChangeText={v => {
                        const items = [...grnForm.items]; items[idx].received_qty = v; setGrnForm(f => ({ ...f, items }));
                      }} />
                    <TextInput style={[s.fIn, { flex: 1 }]} placeholder="Unit Price" placeholderTextColor={colors.muted}
                      keyboardType="numeric" value={it.unit_price} onChangeText={v => {
                        const items = [...grnForm.items]; items[idx].unit_price = v; setGrnForm(f => ({ ...f, items }));
                      }} />
                  </View>
                </View>
              ))}

              <TouchableOpacity style={[s.subBtn, subGRN && { opacity: 0.6 }]} onPress={submitGRN} disabled={subGRN}>
                {subGRN ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.subTxt}>Record GRN</Text>}
              </TouchableOpacity>
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═══ PAY BILL MODAL ═════════════════════════════════════════════════ */}
      <Modal visible={payModal} animationType="slide" transparent onRequestClose={() => setPayModal(false)}>
        <View style={s.ov}>
          <View style={s.sh}>
            <View style={s.hndl} />
            <View style={s.mHead}>
              <Text style={s.mTitle}>Pay Bill — BILL-{selBill?.id}</Text>
              <TouchableOpacity onPress={() => setPayModal(false)}><Ionicons name="close" size={22} color={colors.text} /></TouchableOpacity>
            </View>
            <Text style={s.fLbl}>Amount *</Text>
            <TextInput style={s.fIn} placeholder="Amount (INR)" placeholderTextColor={colors.muted}
              keyboardType="numeric" value={payForm.amount} onChangeText={v => setPayForm(f => ({ ...f, amount: v }))} />

            <Text style={s.fLbl}>Payment Mode</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {PAY_MODES.map(m => (
                <TouchableOpacity key={m} style={[s.chip, payForm.payment_mode === m && s.chipOn]} onPress={() => setPayForm(f => ({ ...f, payment_mode: m }))}>
                  <Text style={[s.chipT, payForm.payment_mode === m && s.chipTOn]}>{m.replace('_', ' ')}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.fLbl}>Reference No.</Text>
            <TextInput style={s.fIn} placeholder="Cheque / UTR / Transaction ID" placeholderTextColor={colors.muted}
              value={payForm.reference_no} onChangeText={v => setPayForm(f => ({ ...f, reference_no: v }))} />

            <Text style={s.fLbl}>Notes</Text>
            <TextInput style={[s.fIn, { height: 64, textAlignVertical: 'top' }]} placeholder="Optional notes..." placeholderTextColor={colors.muted}
              value={payForm.notes} onChangeText={v => setPayForm(f => ({ ...f, notes: v }))} multiline />

            <TouchableOpacity style={[s.subBtn, { backgroundColor: '#16a34a' }, subPay && { opacity: 0.6 }]} onPress={submitPay} disabled={subPay}>
              {subPay ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.subTxt}>Record Payment</Text>}
            </TouchableOpacity>
            <View style={{ height: 20 }} />
          </View>
        </View>
      </Modal>

      {/* ═══ ADD VENDOR MODAL ════════════════════════════════════════════════ */}
      <Modal visible={vModal} animationType="slide" transparent onRequestClose={() => setVModal(false)}>
        <View style={s.ov}>
          <View style={[s.sh, { maxHeight: '92%' }]}>
            <View style={s.hndl} />
            <View style={s.mHead}>
              <Text style={s.mTitle}>Register Vendor</Text>
              <TouchableOpacity onPress={() => setVModal(false)}><Ionicons name="close" size={22} color={colors.text} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {[
                { label: 'Vendor Name *', key: 'name', placeholder: 'e.g. Sharma Stationery' },
                { label: 'Contact Person', key: 'contact_person', placeholder: 'Name of contact' },
                { label: 'Phone', key: 'phone', placeholder: 'Mobile / Landline', keyType: 'phone-pad' },
                { label: 'Email', key: 'email', placeholder: 'vendor@example.com', keyType: 'email-address' },
                { label: 'Address', key: 'address', placeholder: 'Street, City, PIN' },
                { label: 'GST Number', key: 'gst_number', placeholder: '15-digit GSTIN' },
                { label: 'PAN Number', key: 'pan_number', placeholder: '10-char PAN' },
                { label: 'Payment Terms', key: 'payment_terms', placeholder: 'e.g. Net 30' },
                { label: 'Bank Name', key: 'bank_name', placeholder: 'Bank name' },
                { label: 'Account No.', key: 'bank_account_no', placeholder: 'Account number' },
                { label: 'IFSC Code', key: 'bank_ifsc', placeholder: 'IFSC code' },
              ].map(f => (
                <View key={f.key}>
                  <Text style={s.fLbl}>{f.label}</Text>
                  <TextInput
                    style={s.fIn} placeholder={f.placeholder} placeholderTextColor={colors.muted}
                    keyboardType={f.keyType || 'default'}
                    value={vForm[f.key]} onChangeText={v => setVForm(prev => ({ ...prev, [f.key]: v }))} />
                </View>
              ))}

              <Text style={s.fLbl}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}
                contentContainerStyle={{ gap: 6 }}>
                {VENDOR_CATS.map(c => (
                  <TouchableOpacity key={c} style={[s.chip, vForm.category === c && s.chipOn]} onPress={() => setVForm(f => ({ ...f, category: c }))}>
                    <Text style={[s.chipT, vForm.category === c && s.chipTOn]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={s.fLbl}>Notes</Text>
              <TextInput style={[s.fIn, { height: 80, textAlignVertical: 'top' }]} placeholder="Additional notes..."
                placeholderTextColor={colors.muted} value={vForm.notes} onChangeText={v => setVForm(f => ({ ...f, notes: v }))} multiline />

              <TouchableOpacity style={[s.subBtn, subVendor && { opacity: 0.6 }]} onPress={saveVendor} disabled={subVendor}>
                {subVendor ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.subTxt}>Save Vendor</Text>}
              </TouchableOpacity>
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═══ VENDOR HISTORY MODAL ═══════════════════════════════════════════ */}
      <Modal visible={!!vHist} animationType="slide" transparent onRequestClose={() => setVHist(null)}>
        <View style={s.ov}>
          <View style={[s.sh, { maxHeight: '88%' }]}>
            <View style={s.hndl} />
            <View style={s.mHead}>
              <Text style={s.mTitle} numberOfLines={1}>{vHist?.name || 'Vendor'}</Text>
              <TouchableOpacity onPress={() => setVHist(null)}><Ionicons name="close" size={22} color={colors.text} /></TouchableOpacity>
            </View>
            {loadVH
              ? <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 30 }} />
              : <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Vendor summary */}
                  {vHistData && (
                    <>
                      <View style={s.card}>
                        {[
                          { l: 'Total Orders', v: String(vHistData.total_orders || 0) },
                          { l: 'Total Amount', v: INR(vHistData.total_amount) },
                          { l: 'Amount Paid', v: INR(vHistData.amount_paid) },
                          { l: 'Outstanding', v: INR(vHistData.outstanding), c: '#dc2626' },
                        ].map(r => (
                          <View key={r.l} style={s.statRow}>
                            <Text style={s.statLbl}>{r.l}</Text>
                            <Text style={[s.statVal, { color: r.c || colors.text }]}>{r.v}</Text>
                          </View>
                        ))}
                      </View>

                      {vHistData.orders && vHistData.orders.length > 0 && (
                        <>
                          <Text style={s.secTitle}>Order History</Text>
                          {vHistData.orders.map(o => {
                            const cfg = PO_STATUS_CFG[o.status] || { color: '#64748b', bg: '#f8fafc' };
                            return (
                              <View key={o.id} style={[s.poCard, { marginHorizontal: 0 }]}>
                                <View style={s.poTop}>
                                  <Text style={s.poId}>PO-{o.id}</Text>
                                  <Badge label={o.status} color={cfg.color} bg={cfg.bg} />
                                </View>
                                <View style={s.poMeta}>
                                  <Text style={s.poDate}>{o.created_at ? new Date(o.created_at).toLocaleDateString() : ''}</Text>
                                  <Text style={[s.poAmt, { color: '#3b82f6' }]}>{INR(o.total_amount)}</Text>
                                </View>
                              </View>
                            );
                          })}
                        </>
                      )}
                    </>
                  )}
                  <View style={{ height: 20 }} />
                </ScrollView>
            }
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#f8fafc' },
  flex1:  { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  back:   { width: 36, height: 36, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  hTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  hSub:   { fontSize: 10, color: colors.muted, marginTop: 1 },
  sessionPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  sessionTxt:  { fontSize: 11, fontWeight: '700', color: '#0284c7' },
  tabBar:  { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tabItem: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabOn:   { borderBottomColor: colors.primary },
  tabTxt:  { fontSize: 12, fontWeight: '600', color: colors.muted },
  tabTxtOn: { color: colors.primary },
  secTitle: { fontSize: 12, fontWeight: '700', color: colors.muted, paddingHorizontal: 16, marginTop: 16, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  sessPicker: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  sessBtn:    { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  sessBtnOn:  { backgroundColor: colors.primary, borderColor: colors.primary },
  sessBtnTxt:   { fontSize: 12, fontWeight: '600', color: colors.muted },
  sessBtnTxtOn: { color: '#fff' },
  kpiGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16, marginBottom: 16 },
  kpiCard:  { flex: 1, minWidth: '40%', backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  kpiIcon:  { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  kpiVal:   { fontSize: 18, fontWeight: '800', marginBottom: 2 },
  kpiLbl:   { fontSize: 11, color: colors.muted, textAlign: 'center' },
  kpiSub:   { fontSize: 10, color: colors.muted, marginTop: 2, textAlign: 'center' },
  card:     { backgroundColor: '#fff', borderRadius: 14, marginHorizontal: 16, marginBottom: 16, padding: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  statRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  statLbl:  { fontSize: 13, color: colors.muted },
  statVal:  { fontSize: 13, fontWeight: '800', color: colors.text },
  chartLbl: { fontSize: 9, color: colors.muted, marginTop: 3 },
  classRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  classLbl: { width: 80, fontSize: 11, color: colors.text },
  classBarBg:   { flex: 1, height: 7, backgroundColor: '#e2e8f0', borderRadius: 99, marginHorizontal: 8, overflow: 'hidden' },
  classBarFill: { height: '100%', borderRadius: 99 },
  classAmt: { width: 64, fontSize: 10, fontWeight: '700', color: colors.text, textAlign: 'right' },
  // Purchases
  subTabBar:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', gap: 8 },
  subTabItem:  { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  subTabOn:    { backgroundColor: colors.primary, borderColor: colors.primary },
  subTabTxt:   { fontSize: 12, fontWeight: '600', color: colors.muted },
  subTabTxtOn: { color: '#fff' },
  createBtn:   { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, marginLeft: 'auto' },
  createBtnTxt: { fontSize: 12, fontWeight: '700', color: '#fff', marginLeft: 2 },
  chipRow: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  chip:    { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  chipOn:  { backgroundColor: colors.primary, borderColor: colors.primary },
  chipT:   { fontSize: 12, fontWeight: '600', color: colors.muted },
  chipTOn: { color: '#fff' },
  poCard:  { backgroundColor: '#fff', borderRadius: 14, marginBottom: 10, padding: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  poTop:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  poId:    { fontSize: 11, fontWeight: '700', color: colors.muted },
  poVendor: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 4 },
  poMeta:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  poDate:  { fontSize: 11, color: colors.muted },
  poAmt:   { fontSize: 14, fontWeight: '800' },
  grnBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#3b82f6', borderRadius: 8, paddingVertical: 7, marginTop: 6 },
  grnBtnTxt: { fontSize: 12, fontWeight: '700', color: '#fff' },
  // Vendors
  vSearchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 },
  srchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  srchIn:  { flex: 1, fontSize: 13, color: colors.text },
  addVBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  vCard:   { backgroundColor: '#fff', borderRadius: 14, marginBottom: 10, padding: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  vTop:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  vAvatar: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  vAvatarTxt: { fontSize: 16, fontWeight: '800', color: '#3b82f6' },
  vName:   { fontSize: 14, fontWeight: '700', color: colors.text },
  vContact: { fontSize: 11, color: colors.muted, marginTop: 1 },
  vMeta:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  vMetaTxt: { fontSize: 11, color: colors.muted },
  vBalance: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, backgroundColor: '#fef2f2', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  vBalanceLbl: { fontSize: 11, color: '#dc2626' },
  vBalanceAmt: { fontSize: 12, fontWeight: '800', color: '#dc2626' },
  // Modals
  ov:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.52)', justifyContent: 'flex-end' },
  sh:    { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 12, maxHeight: '80%' },
  hndl:  { width: 40, height: 4, backgroundColor: '#e2e8f0', borderRadius: 99, alignSelf: 'center', marginBottom: 14 },
  mHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  mTitle: { fontSize: 17, fontWeight: '800', color: colors.text, flex: 1, marginRight: 12 },
  fLbl:  { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6 },
  fIn:   { backgroundColor: '#f8fafc', borderRadius: 10, padding: 11, fontSize: 13, color: colors.text, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 },
  subBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  subTxt: { fontSize: 15, fontWeight: '800', color: '#fff' },
  poLineItem: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  addLineBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, marginBottom: 16 },
  empty:  { alignItems: 'center', paddingVertical: 48 },
  emptyT: { fontSize: 14, color: colors.muted, marginTop: 10 },
});
