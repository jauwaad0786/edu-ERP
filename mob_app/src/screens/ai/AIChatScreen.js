// mob_app/src/screens/ai/AIChatScreen.js
// Microsoft Copilot-inspired Mobile ERP Assistant
// Fully integrated with backend /api/ai/chat and existing ERP role context

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, KeyboardAvoidingView,
  Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';

export default function AIChatScreen({ navigation, route }) {
  const { user } = useAuth();
  const role = user?.role ? String(user.role).toUpperCase() : 'PRINCIPAL';
  const schoolName = user?.school?.name || user?.school_name || 'EduERP Institution';
  const academicSession = user?.school?.current_session || '2024-25';

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [statusText, setStatusText] = useState('');
  const scrollViewRef = useRef(null);

  // Role-aware prompt suggestions (Copilot-style empty state)
  const getSuggestionsByRole = useCallback(() => {
    switch (role) {
      case 'PRINCIPAL':
      case 'DIRECTOR':
        return [
          { icon: 'pie-chart-outline', label: "Show today's attendance summary", text: "Show today's attendance summary for all classes." },
          { icon: 'alert-circle-outline', label: 'Students with pending fees', text: 'Which classes and students have the highest pending fees?' },
          { icon: 'card-outline', label: "Show today's fee collection", text: "What is today's total fee collection across the school?" },
          { icon: 'people-outline', label: 'Show teacher staff summary', text: 'Show me the active teachers and staff attendance today.' },
          { icon: 'calendar-outline', label: 'Upcoming examination schedule', text: 'What exams and terms are scheduled this month?' },
        ];
      case 'TEACHER':
        return [
          { icon: 'school-outline', label: 'Show my assigned classes', text: 'Which classes and subjects are assigned to me?' },
          { icon: 'clipboard-outline', label: "Mark today's attendance", text: 'Help me check student attendance for my classes.' },
          { icon: 'trending-down-outline', label: 'Students with low attendance', text: 'List students with attendance below 75% in my classes.' },
          { icon: 'document-text-outline', label: 'View uploaded study notes', text: 'Show the study notes and syllabus modules I uploaded.' },
        ];
      case 'STUDENT':
        return [
          { icon: 'checkmark-circle-outline', label: 'Show my attendance', text: 'What is my current attendance percentage and present days?' },
          { icon: 'school-outline', label: 'Show my latest results', text: 'Show my report card and examination marks.' },
          { icon: 'receipt-outline', label: 'Check my fee balance', text: 'Do I have any pending fee dues or receipts?' },
          { icon: 'book-outline', label: 'Show study notes for my class', text: 'What study notes and materials are available for my class?' },
        ];
      case 'PARENT':
        return [
          { icon: 'clipboard-outline', label: "Show my child's attendance", text: "What is my child's attendance record and present days?" },
          { icon: 'card-outline', label: 'Check pending fees', text: 'Are there any outstanding school fees due for my child?' },
          { icon: 'ribbon-outline', label: 'Show recent exam report card', text: "Show my child's recent exam results and grades." },
          { icon: 'bus-outline', label: 'Track school bus route', text: 'What is the current status of the school transport bus?' },
        ];
      case 'SUPER_ADMIN':
        return [
          { icon: 'business-outline', label: 'Schools platform summary', text: 'Give me an overview of all active tenant schools.' },
          { icon: 'people-outline', label: 'Total user counts', text: 'How many active students, teachers, and admins are registered?' },
          { icon: 'heart-outline', label: 'System health status', text: 'Check the health and latency of backend database services.' },
        ];
      default:
        return [
          { icon: 'help-circle-outline', label: 'School ERP Overview', text: 'Provide an overview of my role and available features.' },
          { icon: 'calendar-outline', label: "Today's calendar & events", text: "What holidays or events are scheduled this month?" },
        ];
    }
  }, [role]);

  // Contextual initial message if passed from another screen
  useEffect(() => {
    if (route?.params?.initialQuery) {
      handleSend(route.params.initialQuery);
    }
  }, [route?.params?.initialQuery]);

  const handleSend = async (customText = null) => {
    const textToSend = (customText || inputText).trim();
    if (!textToSend || loading) return;

    const userMsg = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setLoading(true);
    setStatusText('Analyzing school data with ERP...');

    // Auto-scroll to bottom
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      // Connect to real Flask backend: POST /api/ai/chat
      const res = await client.post('/ai/chat', {
        message: textToSend,
        conversation_id: conversationId,
      });

      const data = res.data;
      if (data.conversation_id && !conversationId) {
        setConversationId(data.conversation_id);
      }

      // Detect contextual ERP action cards from response and prompt
      const actionCards = detectActionCards(textToSend, data.answer || '');

      const aiMsg = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: data.answer || 'I could not process that request. Please try again.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        cached: data.cached || false,
        source: data.source || 'ERP System',
        actionCards,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      const errMsg = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        isError: true,
        text:
          err.response?.data?.error ||
          err.response?.data?.message ||
          'Unable to reach AI assistant service. Please verify your connection or quota.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        failedQuery: textToSend,
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
      setStatusText('');
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 150);
    }
  };

  // Helper to generate Copilot actionable ERP navigation chips
  const detectActionCards = (query, answer) => {
    const combined = `${query} ${answer}`.toLowerCase();
    const actions = [];

    if (combined.includes('fee') || combined.includes('dues') || combined.includes('paid') || combined.includes('collect')) {
      actions.push({ label: 'Open Fees Hub', icon: 'card-outline', screen: 'Fees' });
      actions.push({ label: 'Outstanding Dues', icon: 'receipt-outline', screen: 'FeeRecords' });
    }
    if (combined.includes('attendance') || combined.includes('present') || combined.includes('absent')) {
      actions.push({ label: 'View Attendance', icon: 'clipboard-outline', screen: 'Attendance' });
    }
    if (combined.includes('student') || combined.includes('admission') || combined.includes('enrolled')) {
      actions.push({ label: 'Students Roster', icon: 'people-outline', screen: 'Students' });
    }
    if (combined.includes('class') || combined.includes('section')) {
      actions.push({ label: 'Classes Directory', icon: 'school-outline', screen: 'Classes' });
    }
    if (combined.includes('exam') || combined.includes('test') || combined.includes('result') || combined.includes('marks')) {
      actions.push({ label: 'Examinations', icon: 'document-text-outline', screen: 'Examinations' });
      actions.push({ label: 'Results & Report', icon: 'ribbon-outline', screen: 'Result' });
    }
    if (combined.includes('note') || combined.includes('study') || combined.includes('material')) {
      actions.push({ label: 'Study Notes', icon: 'book-outline', screen: 'Notes' });
    }
    if (combined.includes('bus') || combined.includes('transport') || combined.includes('vehicle')) {
      actions.push({ label: 'Transport Tracking', icon: 'bus-outline', screen: 'Transport' });
    }

    // Deduplicate by screen name
    const seen = new Set();
    return actions.filter(a => {
      if (seen.has(a.screen)) return false;
      seen.add(a.screen);
      return true;
    }).slice(0, 3);
  };

  const handleNewChat = () => {
    setMessages([]);
    setConversationId(null);
    setStatusText('');
  };

  const handleActionNavigate = (screen) => {
    if (screen && navigation?.navigate) {
      navigation.navigate(screen);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Microsoft Copilot-Inspired Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerBackBtn}
            onPress={() => navigation?.goBack ? navigation.goBack() : null}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={22} color="#ffffff" />
          </TouchableOpacity>

          <View style={styles.headerTitleBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="sparkles" size={17} color="#60a5fa" style={{ marginRight: 6 }} />
              <Text style={styles.headerTitle}>ERP Copilot</Text>
            </View>
            <View style={styles.headerSubtitleRow}>
              <Text style={styles.headerRolePill}>{role}</Text>
              <Text style={styles.headerDot}>•</Text>
              <Text style={styles.headerSchoolText} numberOfLines={1}>{schoolName}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.newChatBtn}
            onPress={handleNewChat}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={16} color="#ffffff" />
            <Text style={styles.newChatBtnText}>New</Text>
          </TouchableOpacity>
        </View>

        {/* Conversation Area */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={[
            styles.messagesContent,
            messages.length === 0 && { justifyContent: 'center', flexGrow: 1 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            /* Copilot Empty State with Role Suggestions */
            <View style={styles.emptyStateContainer}>
              <View style={styles.copilotOrb}>
                <Ionicons name="sparkles" size={36} color="#2563eb" />
              </View>
              <Text style={styles.emptyGreeting}>How can I help you today?</Text>
              <Text style={styles.emptySubtext}>
                Ask questions about attendance, student fees, marks, or schedule in {schoolName}.
              </Text>

              <View style={styles.suggestionsWrapper}>
                <Text style={styles.suggestionsHeading}>Suggested Actions for {role}:</Text>
                {getSuggestionsByRole().map((sug, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.suggestionCard}
                    activeOpacity={0.75}
                    onPress={() => handleSend(sug.text)}
                  >
                    <View style={styles.sugIconCircle}>
                      <Ionicons name={sug.icon} size={18} color="#2563eb" />
                    </View>
                    <Text style={styles.suggestionText}>{sug.label}</Text>
                    <Ionicons name="arrow-forward" size={15} color="#94a3b8" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            messages.map((msg) => (
              <View
                key={msg.id}
                style={[
                  styles.messageBubbleWrapper,
                  msg.sender === 'user' ? styles.userBubbleWrapper : styles.aiBubbleWrapper,
                ]}
              >
                {msg.sender === 'ai' && (
                  <View style={styles.aiAvatar}>
                    <Ionicons name="sparkles" size={16} color="#2563eb" />
                  </View>
                )}

                <View
                  style={[
                    styles.messageBubble,
                    msg.sender === 'user' ? styles.userBubble : styles.aiBubble,
                    msg.isError && styles.errorBubble,
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      msg.sender === 'user' ? styles.userMessageText : styles.aiMessageText,
                      msg.isError && styles.errorMessageText,
                    ]}
                  >
                    {msg.text}
                  </Text>

                  {/* Inline Action Cards */}
                  {msg.actionCards && msg.actionCards.length > 0 && (
                    <View style={styles.actionCardsRow}>
                      {msg.actionCards.map((act, i) => (
                        <TouchableOpacity
                          key={i}
                          style={styles.actionChip}
                          onPress={() => handleActionNavigate(act.screen)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name={act.icon} size={14} color="#0b57d0" style={{ marginRight: 4 }} />
                          <Text style={styles.actionChipText}>{act.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {/* Error Retry Option */}
                  {msg.isError && msg.failedQuery && (
                    <TouchableOpacity
                      style={styles.retryButton}
                      onPress={() => handleSend(msg.failedQuery)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="reload" size={14} color="#dc2626" style={{ marginRight: 4 }} />
                      <Text style={styles.retryButtonText}>Retry Request</Text>
                    </TouchableOpacity>
                  )}

                  <View style={styles.metaRow}>
                    <Text style={styles.messageTime}>{msg.time}</Text>
                    {msg.cached && <Text style={styles.cachedTag}>• Fast Cached</Text>}
                  </View>
                </View>
              </View>
            ))
          )}

          {/* Thinking / Loading State */}
          {loading && (
            <View style={[styles.messageBubbleWrapper, styles.aiBubbleWrapper]}>
              <View style={styles.aiAvatar}>
                <Ionicons name="sparkles" size={16} color="#2563eb" />
              </View>
              <View style={[styles.messageBubble, styles.aiBubble, styles.thinkingBubble]}>
                <ActivityIndicator size="small" color="#2563eb" style={{ marginRight: 8 }} />
                <Text style={styles.thinkingText}>{statusText || 'Thinking...'}</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Bottom Chat Input Bar */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder={`Ask Copilot anything about ${role.toLowerCase()} tasks...`}
            placeholderTextColor="#94a3b8"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={600}
            editable={!loading}
          />

          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!inputText.trim() || loading) && styles.sendBtnDisabled,
            ]}
            onPress={() => handleSend()}
            disabled={!inputText.trim() || loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons name="arrow-up" size={20} color="#ffffff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  headerTitleBox: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  headerSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  headerRolePill: {
    fontSize: 10,
    fontWeight: '700',
    color: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  headerDot: {
    color: '#64748b',
    marginHorizontal: 5,
    fontSize: 10,
  },
  headerSchoolText: {
    fontSize: 11,
    color: '#94a3b8',
    flex: 1,
  },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  newChatBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  emptyStateContainer: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  copilotOrb: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#bfdbfe',
    marginBottom: 16,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  emptyGreeting: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  suggestionsWrapper: {
    width: '100%',
  },
  suggestionsHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  sugIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  suggestionText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
  },
  messageBubbleWrapper: {
    flexDirection: 'row',
    marginBottom: 14,
    width: '100%',
  },
  userBubbleWrapper: {
    justifyContent: 'flex-end',
  },
  aiBubbleWrapper: {
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  aiAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginTop: 2,
  },
  messageBubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  userBubble: {
    backgroundColor: '#0b57d0',
    borderTopRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  errorBubble: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  thinkingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userMessageText: {
    color: '#ffffff',
  },
  aiMessageText: {
    color: '#1e293b',
  },
  errorMessageText: {
    color: '#dc2626',
    fontWeight: '500',
  },
  thinkingText: {
    fontSize: 13,
    color: '#64748b',
    fontStyle: 'italic',
  },
  actionCardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  actionChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0b57d0',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 4,
  },
  retryButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#dc2626',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 10,
    color: '#94a3b8',
  },
  cachedTag: {
    fontSize: 10,
    color: '#16a34a',
    marginLeft: 4,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0f172a',
    marginRight: 8,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0b57d0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#94a3b8',
    opacity: 0.6,
  },
});
