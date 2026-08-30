import React, { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import {
  sendMessage, getUsage, getConversations, getConversation,
  deleteConversation, listDocuments, uploadDocument, deleteDocument,
} from '../services/aiApi';
import '../styles/ai.css';

// ─── Constants ────────────────────────────────────────────────────────────

const PRINCIPAL_SUGGESTIONS = [
  { icon: '💰', text: 'How much fee was collected in February?' },
  { icon: '📊', text: 'How much outstanding fee is there?' },
  { icon: '📅', text: 'How is today’s attendance?' },
  { icon: '🏆', text: 'Who are the top 10 students?' },
  { icon: '⚠️', text: 'Which students have the lowest attendance?' },
  { icon: '🚌', text: 'Show me the transport summary' },
  { icon: '🏠', text: 'What is the hostel occupancy?' },
  { icon: '📚', text: 'How many library books are currently issued?' },
];

const TEACHER_SUGGESTIONS = [
  { icon: '📖', text: 'What should I teach today? Create a lesson plan' },
  { icon: '❓', text: 'Create practice questions for Class 8 Maths' },
  { icon: '📈', text: 'How is my class performing?' },
  { icon: '✅', text: 'Show me the assignment completion status' },
];

const FILE_ICONS = {
  pdf: '📄',
  docx: '📝',
  doc: '📝',
  txt: '📃',
};

const SOURCE_LABELS = {
  ERP_DATA: { label: 'ERP Data', cls: 'erp' },
  DOCUMENT: { label: 'Document', cls: 'doc' },
  GENERAL: { label: 'AI', cls: 'erp' },
};

export default function AIChat() {

  const { user } = useAuth();
  const role = user?.role || '';
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  useEffect(() => { localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light'); }, [darkMode]);


  // Chat state
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [convId, setConvId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [usage, setUsage] = useState({ used: 0, limit: 50, remaining: 50 });

  // Document state (Teacher)
  const [documents, setDocuments] = useState([]);
  const [activeDocId, setActiveDocId] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const isTeacher = role === 'TEACHER';
  const suggestions = isTeacher ? TEACHER_SUGGESTIONS : PRINCIPAL_SUGGESTIONS;

  // ── Fetch initial data ───────────────────────────────────────────────────
  useEffect(() => {
    fetchUsage();
    fetchConversations();
    if (isTeacher) fetchDocuments();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const fetchUsage = async () => {
    try {
      const u = await getUsage();
      setUsage(u);
    } catch (_) { }
  };

  const fetchConversations = async () => {
    try {
      const convs = await getConversations();
      setConversations(convs || []);
    } catch (_) { }
  };

  const fetchDocuments = async () => {
    try {
      const docs = await listDocuments();
      setDocuments(docs || []);
    } catch (_) { }
  };

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSend = useCallback(async (text = input) => {
    const msg = text.trim();
    if (!msg || loading) return;

    setInput('');
    setLoading(true);

    // Optimistic user message
    const userMsg = {
      id: Date.now(),
      role: 'user',
      content: msg,
      time: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const result = await sendMessage({
        message: msg,
        conversation_id: convId,
        document_id: activeDocId,
      });

      const botMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: result.answer || 'Sorry, I could not generate a response.',
        time: new Date(),
        intent: result.intent,
        cached: result.cached,
        source: result.source,
        followups: result.suggested_followups || [],
        latency: result.latency,
      };

      setMessages(prev => [...prev, botMsg]);

      if (result.conversation_id && !convId) {
        setConvId(result.conversation_id);
        fetchConversations();
      }

      if (result.usage) setUsage(result.usage);

    } catch (err) {
      const errMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: err?.response?.data?.error
          || 'Connection error. Please try again.',
        time: new Date(),
        isError: true,
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }, [input, loading, convId, activeDocId]);

  // ── New conversation ──────────────────────────────────────────────────────
  const handleNewChat = () => {
    setMessages([]);
    setConvId(null);
    setActiveDocId(null);
    fetchUsage();
  };

  // ── Load conversation ─────────────────────────────────────────────────────
  const handleLoadConversation = async (id) => {
    try {
      const data = await getConversation(id);
      setConvId(id);
      const mapped = (data.messages || []).map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        time: new Date(m.created_at),
        intent: m.intent,
        cached: m.cached,
        source: m.source,
      }));
      setMessages(mapped);
    } catch (_) { }
  };

  // ── Document upload ────────────────────────────────────────────────────────
  const handleDocUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingDoc(true);
    try {
      const result = await uploadDocument(file);
      await fetchDocuments();
      setActiveDocId(result.document?.id);
    } catch (err) {
      alert(err?.response?.data?.error || 'Upload failed');
    } finally {
      setUploadingDoc(false);
      e.target.value = '';
    }
  };

  // ── Keyboard handling ─────────────────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaChange = (e) => {
    setInput(e.target.value);
    // Auto-resize
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
  };

  // ── Quota % ───────────────────────────────────────────────────────────────
  const usagePct = usage.limit > 0 ? (usage.used / usage.limit) * 100 : 0;
  const quotaExhausted = usage.remaining === 0;

  // ── Active doc name ───────────────────────────────────────────────────────
  const activeDoc = documents.find(d => d.id === activeDocId);

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: darkMode ? '#0b132b' : '#f8fafc' }}>
        <Navbar
          title="1P360 BOT — AI Assistant"
          darkMode={darkMode}
          onToggleDark={() => setDarkMode(d => !d)}
        />
        <div className="ai-chat-page" style={{ flex: 1, height: 'calc(100vh - 64px)' }}>


      {/* ── Sidebar: Conversations ─────────────────────────────────────── */}
      <div className="ai-sidebar">
        <div className="ai-sidebar-header">
          <div className="ai-bot-brand">
            <div className="ai-bot-avatar">🤖</div>
            <div className="ai-bot-brand-text">
              <h3>1P360 BOT</h3>
              <span>School AI Assistant</span>
            </div>
          </div>
          <button className="ai-new-chat-btn" onClick={handleNewChat}>
            <span>✏️</span> New Conversation
          </button>
        </div>

        <div className="ai-conv-list">
          {conversations.length > 0 && (
            <div className="ai-conv-section-label">Recent</div>
          )}
          {conversations.map(conv => (
            <div
              key={conv.id}
              className={`ai-conv-item ${conv.id === convId ? 'active' : ''}`}
              onClick={() => handleLoadConversation(conv.id)}
            >
              <span style={{ fontSize: 14 }}>💬</span>
              <span className="ai-conv-title">{conv.title || 'Conversation'}</span>
            </div>
          ))}
          {conversations.length === 0 && (
            <div style={{ fontSize: 11, color: '#334155', textAlign: 'center', marginTop: 20, lineHeight: 1.6 }}>
              No conversations yet.<br />Ask anything about your school!
            </div>
          )}
        </div>
      </div>

      {/* ── Main Chat ─────────────────────────────────────────────────── */}
      <div className="ai-chat-main">

        {/* Header */}
        <div className="ai-chat-header">
          <div className="ai-header-left">
            <div className="ai-online-dot" />
            <div>
              <div className="ai-header-title">1P360 BOT</div>
              <div className="ai-header-sub">
                {isTeacher ? 'Teaching Assistant' : 'School Analytics Assistant'}
              </div>
            </div>
          </div>

          <div className="ai-usage-pill">
            <span className="ai-usage-label">AI Queries</span>
            <div className="ai-usage-bar">
              <div className="ai-usage-fill" style={{ width: `${usagePct}%` }} />
            </div>
            <span className="ai-usage-count">
              {usage.used}/{usage.limit}
            </span>
          </div>
        </div>

        {/* Messages */}
        <div className="ai-messages-area">

          {/* Welcome state */}
          {messages.length === 0 && (
            <div className="ai-welcome">
              <div className="ai-welcome-logo">🤖</div>
              <div style={{ textAlign: 'center' }}>
                <h2>Welcome to 1P360 BOT</h2>
                <p>
                  {isTeacher
                    ? 'Your intelligent teaching assistant. Create lesson plans, generate questions, and get teaching help.'
                    : 'Your school analytics assistant. Ask about fees, attendance, academics, hostel, transport and more.'}
                </p>
              </div>
              <div className="ai-suggested-grid">
                {suggestions.map((s, i) => (
                  <div key={i} className="ai-suggest-card" onClick={() => handleSend(s.text)}>
                    <div className="ai-suggest-icon">{s.icon}</div>
                    <div className="ai-suggest-text">{s.text}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map(msg => (
            <MessageRow
              key={msg.id}
              msg={msg}
              onFollowup={handleSend}
              isTeacher={isTeacher}
            />
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="ai-message-row">
              <div className="ai-msg-avatar bot">🤖</div>
              <div className="ai-msg-content">
                <div className="ai-typing">
                  <div className="ai-typing-dot" />
                  <div className="ai-typing-dot" />
                  <div className="ai-typing-dot" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="ai-input-area">

          {/* Quota exhausted */}
          {quotaExhausted && (
            <div className="ai-quota-banner">
              ⚠️ Daily AI query limit reached ({usage.used}/{usage.limit}).
              Please try again tomorrow.
            </div>
          )}

          {/* Active document badge */}
          {activeDoc && (
            <div className="ai-doc-badge">
              <span>{FILE_ICONS[activeDoc.file_type] || '📄'}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeDoc.original_name}
              </span>
              <span
                className="ai-doc-badge-close"
                onClick={() => setActiveDocId(null)}
                title="Remove document context"
              >✕</span>
            </div>
          )}

          <div className={`ai-input-row ${quotaExhausted ? 'opacity-50' : ''}`}>
            <textarea
              ref={textareaRef}
              className="ai-textarea"
              rows={1}
              placeholder={
                quotaExhausted
                  ? 'Daily limit reached. Try again tomorrow.'
                  : isTeacher
                    ? 'Lesson plan, practice questions, teaching help...'
                    : 'Fees, attendance, students, hostel, transport...'
              }
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              disabled={loading || quotaExhausted}
            />

            <div className="ai-action-btns">
              {isTeacher && (
                <>
                  <button
                    className="ai-upload-btn"
                    onClick={() => fileInputRef.current?.click()}
                    title="Upload PDF/DOCX document"
                    disabled={uploadingDoc}
                  >
                    {uploadingDoc ? '⏳' : '📎'}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.doc,.txt"
                    style={{ display: 'none' }}
                    onChange={handleDocUpload}
                  />
                </>
              )}
              <button
                className="ai-send-btn"
                onClick={() => handleSend()}
                disabled={loading || !input.trim() || quotaExhausted}
                title="Send (Enter)"
              >
                {loading ? '⏳' : '➤'}
              </button>
            </div>
          </div>

          <div className="ai-input-hint">
            1P360 BOT uses real ERP data to answer school questions.
            Press Enter to send, Shift+Enter for new line.
          </div>
        </div>
      </div>

      {/* ── Document Panel (Teacher) ───────────────────────────────────── */}
      {isTeacher && (
        <div className="ai-doc-panel">
          <div className="ai-doc-panel-title">📂 My Documents</div>

          <button
            className="ai-doc-upload-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingDoc}
          >
            {uploadingDoc ? '⏳ Uploading...' : '+ Upload PDF/DOCX'}
          </button>

          {documents.map(doc => (
            <div
              key={doc.id}
              className={`ai-doc-item ${doc.id === activeDocId ? 'active' : ''}`}
              onClick={() => setActiveDocId(doc.id === activeDocId ? null : doc.id)}
            >
              <span className="ai-doc-icon">{FILE_ICONS[doc.file_type] || '📄'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="ai-doc-name">{doc.original_name}</div>
                <div className="ai-doc-status">{doc.status}</div>
              </div>
            </div>
          ))}

          {documents.length === 0 && (
            <div style={{ fontSize: 11, color: '#334155', textAlign: 'center', lineHeight: 1.7 }}>
              No documents yet.<br />Upload a PDF to use<br />in your chat.
            </div>
          )}
        </div>
      )}
        </div>
      </div>
    </div>
  );
}

// ─── Message Row ──────────────────────────────────────────────────────────

function MessageRow({ msg, onFollowup, isTeacher }) {
  const isUser = msg.role === 'user';
  const time = msg.time
    ? new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  const sourceInfo = msg.source ? SOURCE_LABELS[msg.source] : null;
  const showCached = msg.cached && msg.source !== 'DOCUMENT';

  return (
    <div className={`ai-message-row ${isUser ? 'user' : ''}`}>
      <div className={`ai-msg-avatar ${isUser ? 'user' : 'bot'}`}>
        {isUser ? '👤' : '🤖'}
      </div>

      <div className="ai-msg-content">
        <div className={`ai-msg-bubble ${isUser ? 'user' : 'bot'} ${msg.isError ? 'error' : ''}`}
          style={msg.isError ? { borderColor: 'rgba(239,68,68,0.3)', color: '#fca5a5' } : {}}>
          {msg.content}
        </div>

        <div className="ai-msg-meta">
          <span className="ai-msg-time">{time}</span>
          {showCached && (
            <span className="ai-msg-source cache">⚡ Cached</span>
          )}
          {sourceInfo && !isUser && (
            <span className={`ai-msg-source ${sourceInfo.cls}`}>
              {msg.source === 'DOCUMENT' ? '📄' : '🏫'} {sourceInfo.label}
            </span>
          )}
          {msg.latency?.total_ms && !isUser && (
            <span className="ai-msg-time">{msg.latency.total_ms}ms</span>
          )}
        </div>

        {/* Follow-up suggestions */}
        {!isUser && msg.followups && msg.followups.length > 0 && (
          <div className="ai-followups">
            {msg.followups.slice(0, 3).map((f, i) => (
              <button key={i} className="ai-followup-btn" onClick={() => onFollowup(f)}>
                {f}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
