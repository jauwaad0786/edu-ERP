// mob_app/src/screens/rbac/RolesScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, TextInput, Modal, Alert, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';

const MODULE_ICONS = {
  academics: 'school-outline',
  academic: 'school-outline',
  attendance: 'clipboard-outline',
  finance: 'card-outline',
  fees: 'cash-outline',
  examinations: 'ribbon-outline',
  marks: 'pencil-outline',
  hrms: 'briefcase-outline',
  staff: 'people-outline',
  hostel: 'bed-outline',
  transport: 'bus-outline',
  library: 'library-outline',
  admin: 'shield-outline',
  system: 'settings-outline',
  reports: 'bar-chart-outline',
};

export default function RolesScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('ROLES'); // 'ROLES' | 'MATRIX'
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data states
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [rolePermissions, setRolePermissions] = useState({}); // { [role_id]: { [permission_id]: boolean } }

  // Matrix Role Selection
  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const [permissionSearch, setPermissionSearch] = useState('');
  const [togglingMap, setTogglingMap] = useState({});

  // Role Creation Modal
  const [createModal, setCreateModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleKey, setNewRoleKey] = useState('');
  const [newRoleLevel, setNewRoleLevel] = useState('6');
  const [creating, setCreating] = useState(false);

  // Load RBAC Data
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [rolesRes, permsRes, matrixRes] = await Promise.all([
        client.get('/rbac/roles').catch(() => ({ data: [] })),
        client.get('/rbac/permissions').catch(() => ({ data: [] })),
        client.get('/rbac/role-permissions').catch(() => ({ data: {} })),
      ]);

      const rList = Array.isArray(rolesRes.data) ? rolesRes.data : [];
      const pList = Array.isArray(permsRes.data) ? permsRes.data : [];
      const mDict = matrixRes.data || {};

      setRoles(rList);
      setPermissions(pList);
      setRolePermissions(mDict);

      // Default select first non-super role or first role for Matrix
      if (!selectedRoleId && rList.length > 0) {
        const defaultRole = rList.find(r => !r.is_super) || rList[0];
        setSelectedRoleId(defaultRole.id);
      }
    } catch {
      // ignore
    } finally {
      if (isRefresh) setRefreshing(false);
      setLoading(false);
    }
  }, [selectedRoleId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Selected Role Object
  const selectedRole = useMemo(() => {
    return roles.find(r => r.id === selectedRoleId) || null;
  }, [roles, selectedRoleId]);

  // Group Permissions by Module
  const groupedPermissions = useMemo(() => {
    const q = permissionSearch.trim().toLowerCase();
    const groups = {};

    permissions.forEach(p => {
      if (q) {
        const matchesKey = (p.key || '').toLowerCase().includes(q);
        const matchesLabel = (p.label || '').toLowerCase().includes(q);
        const matchesModule = (p.module || '').toLowerCase().includes(q);
        if (!matchesKey && !matchesLabel && !matchesModule) return;
      }

      const mod = (p.module || 'General').toUpperCase();
      if (!groups[mod]) groups[mod] = [];
      groups[mod].push(p);
    });

    return groups;
  }, [permissions, permissionSearch]);

  // Toggle Role Permission
  const handleToggle = async (permId, currentValue) => {
    if (!selectedRoleId) return;
    if (selectedRole?.is_super) {
      Alert.alert('Super Role', 'This role has administrative superuser access. All permissions are permanently granted.');
      return;
    }

    const nextValue = !currentValue;
    const toggleKey = `${selectedRoleId}_${permId}`;
    setTogglingMap(prev => ({ ...prev, [toggleKey]: true }));

    // Optimistic UI update
    setRolePermissions(prev => ({
      ...prev,
      [selectedRoleId]: {
        ...(prev[selectedRoleId] || {}),
        [permId]: nextValue,
      },
    }));

    try {
      await client.post(`/rbac/roles/${selectedRoleId}/permissions/${permId}`, {
        is_enabled: nextValue,
      });
    } catch (err) {
      // Revert optimistic update on failure
      setRolePermissions(prev => ({
        ...prev,
        [selectedRoleId]: {
          ...(prev[selectedRoleId] || {}),
          [permId]: currentValue,
        },
      }));
      Alert.alert('Error', err.response?.data?.error || 'Failed to update permission toggle.');
    } finally {
      setTogglingMap(prev => {
        const copy = { ...prev };
        delete copy[toggleKey];
        return copy;
      });
    }
  };

  // Create Role
  const handleCreateRole = async () => {
    if (!newRoleName.trim()) {
      Alert.alert('Missing Name', 'Please enter a display name for the role.');
      return;
    }
    const cleanKey = (newRoleKey.trim() || newRoleName.trim()).toUpperCase().replace(/[^A-Z0-9]/g, '_');

    setCreating(true);
    try {
      const res = await client.post('/rbac/roles', {
        name: newRoleName.trim(),
        key: cleanKey,
        hierarchy_level: parseInt(newRoleLevel, 10) || 6,
        scope: 'TENANT',
      });

      Alert.alert('Role Created', `Custom role "${res.data?.name}" created successfully!`);
      setCreateModal(false);
      setNewRoleName('');
      setNewRoleKey('');
      loadData();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to create custom role.');
    } finally {
      setCreating(false);
    }
  };

  // Delete Role
  const handleDeleteRole = (role) => {
    if (role.is_protected) {
      Alert.alert('Protected Role', 'System roles cannot be deleted.');
      return;
    }

    Alert.alert(
      'Delete Role?',
      `Are you sure you want to delete "${role.name}"? Users assigned to this role must be reassigned first.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await client.delete(`/rbac/roles/${role.id}`);
              Alert.alert('Deleted', `Role "${role.name}" removed.`);
              loadData();
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error || 'Failed to delete role.');
            }
          },
        },
      ]
    );
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
            <Text style={styles.headerTitle}>Roles & Permissions</Text>
            <Text style={styles.headerSubtitle}>Role-based access control (RBAC)</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => setCreateModal(true)}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.createBtnText}>New Role</Text>
        </TouchableOpacity>
      </View>

      {/* Main Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'ROLES' && styles.tabBtnActive]}
          onPress={() => setActiveTab('ROLES')}
        >
          <Ionicons
            name="people-outline"
            size={16}
            color={activeTab === 'ROLES' ? colors.primary : '#64748b'}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.tabBtnText, activeTab === 'ROLES' && styles.tabBtnTextActive]}>
            Roles Directory ({roles.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'MATRIX' && styles.tabBtnActive]}
          onPress={() => setActiveTab('MATRIX')}
        >
          <Ionicons
            name="grid-outline"
            size={16}
            color={activeTab === 'MATRIX' ? colors.primary : '#64748b'}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.tabBtnText, activeTab === 'MATRIX' && styles.tabBtnTextActive]}>
            Permission Matrix
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} colors={[colors.primary]} />}
      >
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading role catalog & permissions...</Text>
          </View>
        ) : activeTab === 'ROLES' ? (
          /* TAB 1: ROLES DIRECTORY */
          <>
            <View style={styles.summaryBanner}>
              <Ionicons name="shield-checkmark" size={24} color="#4338ca" style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryTitle}>Enterprise RBAC Hierarchy</Text>
                <Text style={styles.summarySub}>
                  School tenant staff roles with granular privilege isolation and privilege ceilings.
                </Text>
              </View>
            </View>

            {roles.map(r => (
              <View key={r.id} style={styles.roleCard}>
                <View style={styles.roleCardHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.roleTitleRow}>
                      <Text style={styles.roleName}>{r.name}</Text>
                      {r.is_super && (
                        <View style={styles.superBadge}>
                          <Ionicons name="star" size={11} color="#b45309" style={{ marginRight: 3 }} />
                          <Text style={styles.superBadgeText}>SUPER</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.roleKey}>Key: {r.key}</Text>
                  </View>

                  <View style={styles.levelBadge}>
                    <Text style={styles.levelText}>Level {r.hierarchy_level}</Text>
                  </View>
                </View>

                <View style={styles.roleMetaRow}>
                  <View style={styles.metaChip}>
                    <Text style={styles.metaChipText}>{r.scope || 'TENANT'}</Text>
                  </View>
                  <View style={[styles.metaChip, r.is_protected ? { backgroundColor: '#f1f5f9' } : { backgroundColor: '#e0f2fe' }]}>
                    <Text style={[styles.metaChipText, r.is_protected ? { color: '#64748b' } : { color: '#0369a1' }]}>
                      {r.is_protected ? 'SYSTEM ROLE' : 'CUSTOM ROLE'}
                    </Text>
                  </View>
                </View>

                {/* Card Actions */}
                <View style={styles.roleActionsRow}>
                  <TouchableOpacity
                    style={styles.configPermsBtn}
                    onPress={() => {
                      setSelectedRoleId(r.id);
                      setActiveTab('MATRIX');
                    }}
                  >
                    <Ionicons name="key-outline" size={14} color="#4338ca" />
                    <Text style={styles.configPermsText}>Configure Permissions</Text>
                  </TouchableOpacity>

                  {!r.is_protected && (
                    <TouchableOpacity
                      style={styles.deleteRoleBtn}
                      onPress={() => handleDeleteRole(r)}
                    >
                      <Ionicons name="trash-outline" size={15} color="#dc2626" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </>
        ) : (
          /* TAB 2: PERMISSION MATRIX */
          <>
            {/* Horizontal Role Selector */}
            <Text style={styles.sectionHeader}>SELECT TARGET ROLE TO CONFIGURE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.roleSelectorScroll}>
              {roles.map(r => {
                const isSelected = r.id === selectedRoleId;
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.roleSelectChip, isSelected && styles.roleSelectChipActive]}
                    onPress={() => setSelectedRoleId(r.id)}
                  >
                    <Text style={[styles.roleSelectChipText, isSelected && styles.roleSelectChipTextActive]}>
                      {r.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Selected Role Info Banner */}
            {selectedRole && (
              <View style={[styles.targetRoleBanner, selectedRole.is_super && { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}>
                <Ionicons
                  name={selectedRole.is_super ? 'shield-checkmark' : 'options-outline'}
                  size={20}
                  color={selectedRole.is_super ? '#b45309' : '#4338ca'}
                  style={{ marginRight: 8 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.targetRoleName, selectedRole.is_super && { color: '#92400e' }]}>
                    Configuring: {selectedRole.name} ({selectedRole.key})
                  </Text>
                  <Text style={[styles.targetRoleDesc, selectedRole.is_super && { color: '#b45309' }]}>
                    {selectedRole.is_super
                      ? 'Administrative super-role: All permissions are implicitly enabled and enforced.'
                      : 'Toggle specific privileges below. Changes apply immediately to all users holding this role.'}
                  </Text>
                </View>
              </View>
            )}

            {/* Search Filter */}
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color="#64748b" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Filter permissions by name or module..."
                placeholderTextColor="#94a3b8"
                value={permissionSearch}
                onChangeText={setPermissionSearch}
              />
              {Boolean(permissionSearch) && (
                <TouchableOpacity onPress={() => setPermissionSearch('')}>
                  <Ionicons name="close-circle" size={18} color="#94a3b8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Grouped Permissions by Module */}
            {Object.keys(groupedPermissions).map(modName => {
              const items = groupedPermissions[modName];
              const iconName = MODULE_ICONS[modName.toLowerCase()] || 'apps-outline';

              return (
                <View key={modName} style={styles.moduleBlock}>
                  <View style={styles.moduleHeaderRow}>
                    <Ionicons name={iconName} size={18} color="#4338ca" style={{ marginRight: 6 }} />
                    <Text style={styles.moduleBlockTitle}>{modName} ({items.length})</Text>
                  </View>

                  {items.map(p => {
                    const isEnabled = selectedRole?.is_super
                      ? true
                      : Boolean(rolePermissions[selectedRoleId]?.[p.id]);

                    const toggleKey = `${selectedRoleId}_${p.id}`;
                    const isToggling = Boolean(togglingMap[toggleKey]);

                    return (
                      <View key={p.id} style={styles.permRow}>
                        <View style={{ flex: 1, marginRight: 10 }}>
                          <Text style={styles.permLabel}>{p.label || p.key}</Text>
                          <Text style={styles.permKey}>{p.key}</Text>
                        </View>

                        {isToggling ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <Switch
                            value={isEnabled}
                            onValueChange={() => handleToggle(p.id, isEnabled)}
                            disabled={selectedRole?.is_super}
                            trackColor={{ false: '#cbd5e1', true: '#818cf8' }}
                            thumbColor={isEnabled ? '#4338ca' : '#f8fafc'}
                          />
                        )}
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>

      {/* CREATE ROLE MODAL */}
      <Modal visible={createModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Create Custom Role</Text>
                <Text style={styles.modalSubtitle}>Add specialized staff role for school</Text>
              </View>
              <TouchableOpacity onPress={() => setCreateModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Role Display Name</Text>
            <TextInput
              style={styles.textInput}
              value={newRoleName}
              onChangeText={(text) => {
                setNewRoleName(text);
                if (!newRoleKey || newRoleKey === newRoleName.toUpperCase().replace(/[^A-Z0-9]/g, '_')) {
                  setNewRoleKey(text.toUpperCase().replace(/[^A-Z0-9]/g, '_'));
                }
              }}
              placeholder="e.g. Sports Coordinator"
            />

            <Text style={styles.inputLabel}>System Key (Uppercase identifier)</Text>
            <TextInput
              style={styles.textInput}
              value={newRoleKey}
              onChangeText={setNewRoleKey}
              placeholder="SPORTS_COORDINATOR"
              autoCapitalize="characters"
            />

            <Text style={styles.inputLabel}>Hierarchy Level (1 - 10)</Text>
            <TextInput
              style={styles.textInput}
              value={newRoleLevel}
              onChangeText={setNewRoleLevel}
              placeholder="6"
              keyboardType="numeric"
            />
            <Text style={styles.inputHint}>Level 1: Director/Super, Level 4: Principal, Level 6: Staff/Teacher</Text>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setCreateModal(false)}
                disabled={creating}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, creating && { opacity: 0.7 }]}
                onPress={handleCreateRole}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Create Role</Text>
                )}
              </TouchableOpacity>
            </View>
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
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  createBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 16,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginRight: 20,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: colors.primary,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  tabBtnTextActive: {
    color: colors.primary,
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
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#312e81',
  },
  summarySub: {
    fontSize: 12,
    color: '#4338ca',
    marginTop: 2,
  },
  roleCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 1,
  },
  roleCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  roleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roleName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  superBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  superBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#b45309',
  },
  roleKey: {
    fontSize: 11,
    color: '#64748b',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  levelBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  levelText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  roleMetaRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  metaChip: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  metaChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  roleActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
  },
  configPermsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  configPermsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4338ca',
  },
  deleteRoleBtn: {
    padding: 4,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  roleSelectorScroll: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  roleSelectChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
  },
  roleSelectChipActive: {
    backgroundColor: '#4338ca',
    borderColor: '#4338ca',
  },
  roleSelectChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  roleSelectChipTextActive: {
    color: '#fff',
  },
  targetRoleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  targetRoleName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#312e81',
  },
  targetRoleDesc: {
    fontSize: 11,
    color: '#4338ca',
    marginTop: 1,
    lineHeight: 15,
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
  moduleBlock: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  moduleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 8,
    marginBottom: 8,
  },
  moduleBlockTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  permRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  permLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  permKey: {
    fontSize: 11,
    color: '#64748b',
    fontFamily: 'monospace',
    marginTop: 1,
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
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
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
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
    marginTop: 6,
  },
  textInput: {
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
  inputHint: {
    fontSize: 10,
    color: '#94a3b8',
    marginBottom: 12,
  },
  modalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  modalSubmitBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
  },
  modalSubmitBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
});
