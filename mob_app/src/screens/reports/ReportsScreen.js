// mob_app/src/screens/reports/ReportsScreen.js
// Exact match to Screen 12 of mockup: Comprehensive ERP reports directory
import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

const REPORTS = [
  {
    id: 'student',
    title: 'Student Report',
    desc: 'View student statistics',
    icon: 'people',
    color: '#16a34a',
    bg: '#dcfce7',
    screen: 'StudentReport',
  },
  {
    id: 'attendance',
    title: 'Attendance Report',
    desc: 'Class-wise attendance',
    icon: 'calendar',
    color: '#0284c7',
    bg: '#e0f2fe',
    screen: 'AttendanceReport',
  },
  {
    id: 'fee',
    title: 'Fee Collection Report',
    desc: 'Payment status & dues',
    icon: 'card',
    color: '#dc2626',
    bg: '#fee2e2',
    screen: 'FeeReport',
  },
  {
    id: 'exam',
    title: 'Exam Report',
    desc: 'Performance analysis',
    icon: 'ribbon',
    color: '#7c3aed',
    bg: '#ede9fe',
    screen: 'ExamReport',
  },
  {
    id: 'teacher',
    title: 'Teacher Report',
    desc: 'Teacher workload & performance',
    icon: 'person',
    color: '#059669',
    bg: '#d1fae5',
    screen: 'TeacherReport',
  },
  {
    id: 'transport',
    title: 'Transport Report',
    desc: 'Transport utilization',
    icon: 'bus',
    color: '#ea580c',
    bg: '#ffedd5',
    screen: 'TransportReport',
  },
  {
    id: 'custom',
    title: 'Custom Report',
    desc: 'Generate your own report',
    icon: 'document-text',
    color: '#c026d3',
    bg: '#fae8ff',
    screen: 'CustomReport',
  },
];

export default function ReportsScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation?.goBack ? navigation.goBack() : null}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.headerBackBtn}
        >
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reports</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.cardList}>
          {REPORTS.map((r, i) => (
            <TouchableOpacity
              key={r.id}
              style={styles.reportRow}
              activeOpacity={0.7}
              onPress={() => {
                if (navigation?.navigate) {
                  navigation.navigate(r.screen);
                }
              }}
            >
              <View style={[styles.iconCircle, { backgroundColor: r.bg }]}>
                <Ionicons name={r.icon} size={22} color={r.color} />
              </View>

              <View style={styles.infoCol}>
                <Text style={styles.reportTitle}>{r.title}</Text>
                <Text style={styles.reportDesc}>{r.desc}</Text>
              </View>

              <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  header: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
  },
  cardList: {
    gap: 12,
  },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  infoCol: {
    flex: 1,
  },
  reportTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 3,
  },
  reportDesc: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
  },
});
