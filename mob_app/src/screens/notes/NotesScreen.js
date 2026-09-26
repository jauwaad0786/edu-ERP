// mob_app/src/screens/notes/NotesScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, TextInput, Modal, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';

function fmtBytes(b) {
  if (!b) return '';
  if (b < 1048576) return (b / 1024).toFixed(0) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}

function getFileMeta(fileType, fileName) {
  const ext = (fileType || (fileName ? fileName.split('.').pop() : '') || '').toLowerCase().replace('.', '');
  if (ext === 'pdf') return { icon: 'document-text', color: '#dc2626', bg: '#fee2e2', label: 'PDF' };
  if (['doc', 'docx'].includes(ext)) return { icon: 'document', color: '#2563eb', bg: '#dbeafe', label: 'Word' };
  if (['ppt', 'pptx'].includes(ext)) return { icon: 'easel', color: '#d97706', bg: '#fef3c7', label: 'PPT' };
  if (['xls', 'xlsx', 'csv'].includes(ext)) return { icon: 'grid', color: '#16a34a', bg: '#dcfce7', label: 'Excel' };
  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return { icon: 'image', color: '#0891b2', bg: '#cffafe', label: 'Image' };
  if (ext === 'link') return { icon: 'link', color: '#7c3aed', bg: '#ede9fe', label: 'Web Link' };
  return { icon: 'document-outline', color: '#475569', bg: '#f1f5f9', label: 'Resource' };
}

export default function NotesScreen({ navigation }) {
  const { user } = useAuth();
  const role = user?.role || '';
  const isPrincipal = ['PRINCIPAL', 'SUPER_ADMIN', 'ADMIN', 'VICE_PRINCIPAL', 'DIRECTOR'].includes(role);
  const isTeacher = role === 'TEACHER';
  const canUpload = isPrincipal || isTeacher;

  const [notes, setNotes] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [search, setSearch] = useState('');

  // Upload Note Modal State
  const [uploadModal, setUploadModal] = useState(false);
  const [formClassId, setFormClassId] = useState('');
  const [formSubjectId, setFormSubjectId] = useState('');
  const [formSubjects, setFormSubjects] = useState([]);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formFileUrl, setFormFileUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  // Load Classes & Subjects for Filters
  useEffect(() => {
    client.get('/principal/classes')
      .then(res => setClasses(Array.isArray(res.data) ? res.data : []))
      .catch(() => setClasses([]));

    client.get('/principal/subjects')
      .then(res => setSubjects(Array.isArray(res.data) ? res.data : []))
      .catch(() => setSubjects([]));
  }, []);

  // Update subjects list when form class changes in Upload Modal
  useEffect(() => {
    if (formClassId) {
      client.get(`/principal/classes/${formClassId}/subjects`)
        .then(res => setFormSubjects(Array.isArray(res.data) ? res.data : []))
        .catch(() => setFormSubjects([]));
    } else {
      setFormSubjects([]);
    }
  }, [formClassId]);

  // Load Notes
  const loadNotes = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const params = {};
      if (selectedClassId) params.class_id = selectedClassId;
      if (selectedSubjectId) params.subject_id = selectedSubjectId;
      if (search.trim()) params.search = search.trim();

      const res = await client.get('/academic/notes', { params }).catch(() => ({ data: { notes: [] } }));
      const list = Array.isArray(res.data) ? res.data : (res.data?.notes || []);
      setNotes(list);
    } catch {
      setNotes([]);
    } finally {
      if (isRefresh) setRefreshing(false);
      setLoading(false);
    }
  }, [selectedClassId, selectedSubjectId, search]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  // Handle Note Upload
  const handleUploadNote = async () => {
    if (!formClassId || !formSubjectId || !formTitle.trim()) {
      Alert.alert('Required Fields', 'Please select Class, Subject, and enter a Resource Title.');
      return;
    }

    if (!formFileUrl.trim()) {
      Alert.alert('Resource URL', 'Please provide a valid document or drive link (PDF/PPT/Docs).');
      return;
    }

    setUploading(true);
    try {
      await client.post('/academic/notes', {
        class_id: formClassId,
        subject_id: formSubjectId,
        title: formTitle.trim(),
        description: formDesc.trim(),
        file_url: formFileUrl.trim(),
      });

      Alert.alert('Uploaded', 'Study material has been shared with students successfully.');
      setUploadModal(false);
      setFormTitle('');
      setFormDesc('');
      setFormFileUrl('');
      loadNotes();
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Upload failed';
      Alert.alert('Error', msg);
    } finally {
      setUploading(false);
    }
  };

  // Delete Note
  const handleDeleteNote = (note) => {
    Alert.alert(
      'Delete Study Material',
      `Are you sure you want to remove "${note.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await client.delete(`/academic/notes/${note.id}`);
              Alert.alert('Deleted', 'Note removed successfully.');
              loadNotes();
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error || 'Failed to delete note');
            }
          },
        },
      ]
    );
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
            <Text style={styles.headerTitle}>Study Notes & Materials</Text>
            <Text style={styles.headerSub}>Syllabus PDFs, Handouts & Lecture Docs</Text>
          </View>
          {canUpload && (
            <TouchableOpacity style={styles.uploadBtn} onPress={() => setUploadModal(true)}>
              <Ionicons name="cloud-upload-outline" size={16} color="#fff" />
              <Text style={styles.uploadBtnText}>Upload</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={16} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search notes, chapters, topics..."
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Class & Subject Filter Chips */}
      <View style={styles.filtersSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterChip, !selectedClassId && styles.filterChipActive]}
            onPress={() => setSelectedClassId('')}
          >
            <Text style={[styles.filterChipText, !selectedClassId && styles.filterChipTextActive]}>
              All Classes
            </Text>
          </TouchableOpacity>
          {classes.map((cls) => (
            <TouchableOpacity
              key={cls.id}
              style={[styles.filterChip, selectedClassId === cls.id && styles.filterChipActive]}
              onPress={() => setSelectedClassId(selectedClassId === cls.id ? '' : cls.id)}
            >
              <Text style={[styles.filterChipText, selectedClassId === cls.id && styles.filterChipTextActive]}>
                Class {cls.name || cls.class_name} {cls.section ? `(${cls.section})` : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Notes List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading study materials...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadNotes(true)} colors={[colors.primary]} />
          }
        >
          {notes.length > 0 ? (
            notes.map((note) => {
              const meta = getFileMeta(note.file_type, note.file_name);
              return (
                <View key={note.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={[styles.fileIconBox, { backgroundColor: meta.bg }]}>
                      <Ionicons name={meta.icon} size={22} color={meta.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.title}>{note.title}</Text>
                      <Text style={styles.subMeta}>
                        {note.subject_name || 'Subject'} · Class {note.class_name || 'All'}
                        {note.teacher_name ? ` · By ${note.teacher_name}` : ''}
                      </Text>
                    </View>
                    {canUpload && (
                      <TouchableOpacity onPress={() => handleDeleteNote(note)} style={{ padding: 4 }}>
                        <Ionicons name="trash-outline" size={16} color="#dc2626" />
                      </TouchableOpacity>
                    )}
                  </View>

                  {note.description ? (
                    <Text style={styles.desc} numberOfLines={3}>{note.description}</Text>
                  ) : null}

                  <View style={styles.cardFooter}>
                    <View style={styles.footerLeft}>
                      <View style={[styles.fileTypeBadge, { backgroundColor: meta.bg }]}>
                        <Text style={[styles.fileTypeText, { color: meta.color }]}>{meta.label}</Text>
                      </View>
                      {note.file_size ? (
                        <Text style={styles.fileSizeText}>{fmtBytes(note.file_size)}</Text>
                      ) : null}
                    </View>

                    {note.file_url ? (
                      <TouchableOpacity
                        style={styles.openBtn}
                        onPress={() => Linking.openURL(note.file_url).catch(() => {})}
                      >
                        <Ionicons name="download-outline" size={14} color="#fff" />
                        <Text style={styles.openBtnText}>Open Document</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="book-outline" size={54} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No Study Materials Found</Text>
              <Text style={styles.emptySubtitle}>
                {search
                  ? `No resources matching "${search}".`
                  : 'No study notes or lecture slides have been uploaded for this filter.'}
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* UPLOAD NOTE MODAL */}
      <Modal visible={uploadModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Share Study Material</Text>
                <Text style={styles.modalSub}>Upload notes, lecture slides or reference PDFs</Text>
              </View>
              <TouchableOpacity onPress={() => setUploadModal(false)}>
                <Ionicons name="close-circle-outline" size={26} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* Class Selector */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Class & Section *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {classes.map((cls) => (
                    <TouchableOpacity
                      key={cls.id}
                      style={[styles.pickerChip, formClassId === cls.id && styles.pickerChipActive]}
                      onPress={() => setFormClassId(cls.id)}
                    >
                      <Text style={[styles.pickerChipText, formClassId === cls.id && styles.pickerChipTextActive]}>
                        Class {cls.name || cls.class_name} {cls.section ? `(${cls.section})` : ''}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Subject Selector */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Subject *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {(formSubjects.length > 0 ? formSubjects : subjects).map((sub) => (
                    <TouchableOpacity
                      key={sub.id}
                      style={[styles.pickerChip, formSubjectId === sub.id && styles.pickerChipActive]}
                      onPress={() => setFormSubjectId(sub.id)}
                    >
                      <Text style={[styles.pickerChipText, formSubjectId === sub.id && styles.pickerChipTextActive]}>
                        {sub.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Title */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Resource Title *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Unit 3 Trigonometry Revision Notes"
                  value={formTitle}
                  onChangeText={setFormTitle}
                />
              </View>

              {/* Description */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Description / Notes Summary</Text>
                <TextInput
                  style={[styles.formInput, { height: 70, textAlignVertical: 'top' }]}
                  placeholder="Key topics covered, formulas included..."
                  multiline
                  value={formDesc}
                  onChangeText={setFormDesc}
                />
              </View>

              {/* Document / Drive Link */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Document / Drive Link (PDF/PPT/Docs) *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="https://drive.google.com/... or https://..."
                  value={formFileUrl}
                  onChangeText={setFormFileUrl}
                  autoCapitalize="none"
                />
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.submitBtn, uploading && { opacity: 0.6 }]}
                onPress={handleUploadNote}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Share Study Material</Text>
                )}
              </TouchableOpacity>
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
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    gap: 4,
  },
  uploadBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  searchInput: { flex: 1, paddingVertical: 8, paddingHorizontal: 6, fontSize: 13, color: colors.text },
  filtersSection: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingVertical: 8 },
  filterScroll: { paddingHorizontal: 16, gap: 8 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  filterChipActive: { backgroundColor: colors.primary },
  filterChipText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  filterChipTextActive: { color: '#fff' },
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
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  fileIconBox: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  subMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  desc: { fontSize: 13, color: '#475569', lineHeight: 18, marginBottom: 10 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
  },
  footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fileTypeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  fileTypeText: { fontSize: 10, fontWeight: '700' },
  fileSizeText: { fontSize: 11, color: colors.textMuted },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  openBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 50 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 12 },
  emptySubtitle: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 4, paddingHorizontal: 24 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  modalSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  formGroup: { marginBottom: 12 },
  formLabel: { fontSize: 12, fontWeight: '700', color: colors.text, marginBottom: 6 },
  formInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    backgroundColor: '#fff',
  },
  pickerChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pickerChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pickerChipText: { fontSize: 11, fontWeight: '600', color: colors.text },
  pickerChipTextActive: { color: '#fff' },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
