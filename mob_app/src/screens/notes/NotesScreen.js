// mob_app/src/screens/notes/NotesScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';

const C = { primary: '#0176d3', green: '#16a34a', warning: '#d97706', error: '#dc2626', text: '#1e293b', muted: '#64748b', bg: '#f0f4f8', surface: '#fff', border: '#e2e8f0' };

export default function NotesScreen() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      // Correct endpoint: /api/teacher/notes (registered at /api/teacher/ prefix)
      const res = await client.get('/teacher/notes').catch(() => ({ data: [] }));
      const list = Array.isArray(res.data) ? res.data : res.data?.notes || [];
      setNotes(list);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
        <ActivityIndicator size="large" color={C.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Study Notes & Resources</Text>
        <Text style={styles.headerSub}>Curriculum Material & Lecture Notes</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[C.primary]} />}
      >
        {notes.length > 0 ? (
          notes.map((note, i) => (
            <View key={i} style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <View style={styles.iconBox}>
                  <Ionicons name="document-text-outline" size={20} color={C.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{note.title || 'Untitled Note'}</Text>
                  <Text style={styles.sub}>{note.subject_name || note.subject || 'General'} · Class {note.class_name || 'All'}</Text>
                </View>
              </View>
              {note.description && (
                <Text style={styles.desc} numberOfLines={2}>{note.description}</Text>
              )}
              {note.file_url && (
                <TouchableOpacity
                  style={styles.downloadBtn}
                  onPress={() => Linking.openURL(note.file_url).catch(() => {})}
                >
                  <Ionicons name="download-outline" size={14} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Download Attachment</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        ) : (
          <View style={{ alignItems: 'center', padding: 40 }}>
            <Ionicons name="book-outline" size={48} color={C.muted} style={{ opacity: 0.4 }} />
            <Text style={{ color: C.muted, marginTop: 12, fontSize: 14 }}>No notes uploaded yet</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: '#0176d3', padding: 20, paddingTop: 16 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  iconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#e0f2fe', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '700', color: C.text },
  sub: { fontSize: 12, color: C.muted, marginTop: 2 },
  desc: { fontSize: 12, color: '#475569', marginBottom: 10, marginTop: 4 },
  downloadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#0176d3', paddingVertical: 8, borderRadius: 8, marginTop: 6 },
});
