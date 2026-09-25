import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Send,
  Paperclip,
  Mic,
  MicOff,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Plus,
  Trash2,
  FileText,
  Search,
  PanelLeftClose,
  PanelLeft,
  ExternalLink,
  ChevronRight,
  X,
  Database,
  DollarSign,
  Calendar,
  Users,
  Bus,
  BookOpen,
  Award,
  AlertCircle,
  FileCheck,
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { resolveTenantPath } from '../../utils/routeBuilder';
import {
  sendMessage,
  getUsage,
  getConversations,
  getConversation,
  deleteConversation,
  listDocuments,
  uploadDocument,
  deleteDocument,
} from '../services/aiApi';
import '../styles/ai.css';

// ── Role-Tailored Prompt Suggestions ──────────────────────────────────────────
const ROLE_SUGGESTIONS = {
  PRINCIPAL: [
    {
      category: 'FINANCE & DUES',
      icon: DollarSign,
      title: 'Monthly Fee Collection',
      prompt: 'How much fee was collected this month versus target?',
      desc: 'Analyze total incoming collections and pending student fees',
    },
    {
      category: 'OUTSTANDING DUES',
      icon: AlertCircle,
      title: 'Outstanding Fee Breakdown',
      prompt: 'What is the total outstanding fee amount across all classes?',
      desc: 'Identify defaulters and classes with highest unpaid balances',
    },
    {
      category: 'ATTENDANCE',
      icon: Calendar,
      title: 'Daily Attendance Summary',
      prompt: 'What is today’s student and staff attendance breakdown?',
      desc: 'Check live roll-call percentages and absent staff count',
    },
    {
      category: 'ACADEMICS',
      icon: Award,
      title: 'Top Academic Achievers',
      prompt: 'Who are the top 10 academic students based on recent exams?',
      desc: 'Rankings across classes with highest grade aggregates',
    },
    {
      category: 'TRANSPORT',
      icon: Bus,
      title: 'School Transport Overview',
      prompt: 'Show me the transport summary and bus route operational status',
      desc: 'Review vehicle tracking, active routes, and driver assignments',
    },
    {
      category: 'LIBRARY',
      icon: BookOpen,
      title: 'Library Circulation Status',
      prompt: 'How many library books are currently issued and overdue?',
      desc: 'Check inventory status and active student book loans',
    },
  ],
  TEACHER: [
    {
      category: 'LESSON PLAN',
      icon: BookOpen,
      title: 'Generate Lesson Plan',
      prompt: 'Create a structured lesson plan for Class 8 Mathematics on Linear Equations',
      desc: 'Includes 45-minute timeline, learning objectives, and examples',
    },
    {
      category: 'PRACTICE QUIZ',
      icon: FileCheck,
      title: 'Generate Practice Questions',
      prompt: 'Generate 5 conceptual and practice questions with solutions for Class 9 Physics',
      desc: 'Tailored for formative classroom assessments and homework',
    },
    {
      category: 'PERFORMANCE',
      icon: Award,
      title: 'Class Performance Insights',
      prompt: 'How is my assigned class performing academically in recent assessments?',
      desc: 'Identify students needing extra revision or intervention',
    },
    {
      category: 'ATTENDANCE',
      icon: Calendar,
      title: 'Class Attendance Check',
      prompt: 'Show the attendance summary and frequent absentees for my section this month',
      desc: 'Identify students at risk of falling below attendance thresholds',
    },
  ],
  SUPER_ADMIN: [
    {
      category: 'INSTITUTIONS',
      icon: Users,
      title: 'Enrolled Schools & Tenants',
      prompt: 'How many schools are actively onboarded and running on the platform?',
      desc: 'Institutional breakdown across branches and operational states',
    },
    {
      category: 'SUBSCRIPTIONS',
      icon: DollarSign,
      title: 'Active Paid Subscriptions',
      prompt: 'Which schools have active paid subscriptions and renewals approaching?',
      desc: 'Review billing cycles, tenant plans, and revenue metrics',
    },
    {
      category: 'USER BREAKDOWN',
      icon: Users,
      title: 'System Users by Role',
      prompt: 'Show platform active users grouped by role and institutions',
      desc: 'Principal, teacher, accountant, student, and parent user distribution',
    },
    {
      category: 'SYSTEM HEALTH',
      icon: Database,
      title: 'ERP Infrastructure Health',
      prompt: 'What is the system health, API response latency, and database status?',
      desc: 'Monitor cloud telemetry, error rates, and operational uptime',
    },
  ],
  STUDENT: [
    {
      category: 'MY ACADEMICS',
      icon: Award,
      title: 'My Attendance Percentage',
      prompt: 'What is my current attendance percentage and total classes attended?',
      desc: 'Verify if you meet the minimum 75% examination eligibility',
    },
    {
      category: 'EXAMINATIONS',
      icon: Calendar,
      title: 'Upcoming Exam Schedule',
      prompt: 'When are my upcoming exams and where can I view the syllabus?',
      desc: 'Check examination timetable, subjects, and hall ticket info',
    },
    {
      category: 'FEES',
      icon: DollarSign,
      title: 'My Fee Receipt & Dues',
      prompt: 'Do I have any pending fee dues for the current term?',
      desc: 'Review transaction ledger and downloadable fee receipts',
    },
    {
      category: 'LIBRARY',
      icon: BookOpen,
      title: 'Borrowed Library Books',
      prompt: 'Which books are currently issued under my student card?',
      desc: 'Check return due dates to prevent overdue library fines',
    },
  ],
};

// ── Smart ERP Action Keywords Mapping ─────────────────────────────────────────
const SMART_ERP_ACTIONS = [
  {
    keywords: ['fee', 'dues', 'collection', 'paid', 'unpaid', 'receipt', 'amount'],
    label: 'Open Fee Collection',
    path: '/fees',
    icon: DollarSign,
  },
  {
    keywords: ['fee', 'defaulter', 'outstanding', 'unpaid'],
    label: 'Outstanding Dues Ledger',
    path: '/fees/outstanding',
    icon: DollarSign,
  },
  {
    keywords: ['attendance', 'absent', 'present', 'leave', 'roll call'],
    label: 'Attendance Register',
    path: '/attendance',
    icon: Calendar,
  },
  {
    keywords: ['exam', 'mark', 'grade', 'result', 'score', 'topper', 'academic'],
    label: 'Examinations & Marks',
    path: '/examinations',
    icon: Award,
  },
  {
    keywords: ['class', 'section', 'student', 'admission'],
    label: 'Class Directory',
    path: '/classes',
    icon: Users,
  },
  {
    keywords: ['transport', 'bus', 'route', 'driver', 'vehicle'],
    label: 'Transport Tracking',
    path: '/transport/live',
    icon: Bus,
  },
  {
    keywords: ['book', 'library', 'borrow', 'return', 'fine'],
    label: 'Library Hub',
    path: '/library/books',
    icon: BookOpen,
  },
  {
    keywords: ['hostel', 'room', 'bed', 'occupancy', 'warden'],
    label: 'Hostel Management',
    path: '/hostel/rooms',
    icon: Users,
  },
];

export default function AIChat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const role = (user?.role?.value || user?.role || '').toUpperCase();

  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  useEffect(() => {
    localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [docDrawerOpen, setDocDrawerOpen] = useState(false);

  // Chat state
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [convId, setConvId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [usage, setUsage] = useState({ used: 0, limit: 50, remaining: 50 });

  // Document state
  const [documents, setDocuments] = useState([]);
  const [activeDocId, setActiveDocId] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const isTeacher = role === 'TEACHER';
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const promptCards = useMemo(() => {
    if (isSuperAdmin) return ROLE_SUGGESTIONS.SUPER_ADMIN;
    if (isTeacher) return ROLE_SUGGESTIONS.TEACHER;
    if (role === 'STUDENT' || role === 'PARENT') return ROLE_SUGGESTIONS.STUDENT;
    return ROLE_SUGGESTIONS.PRINCIPAL;
  }, [role, isTeacher, isSuperAdmin]);

  // Greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    let timeGreet = 'Good morning';
    if (hour >= 12 && hour < 17) timeGreet = 'Good afternoon';
    else if (hour >= 17) timeGreet = 'Good evening';

    const name = user?.first_name || user?.name || user?.username || 'there';
    return `${timeGreet}, ${name}`;
  }, [user]);

  // Initial data fetch
  useEffect(() => {
    fetchUsage();
    fetchConversations();
    fetchDocuments();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const fetchUsage = async () => {
    try {
      const u = await getUsage();
      if (u) setUsage(u);
    } catch (_) {}
  };

  const fetchConversations = async () => {
    try {
      const convs = await getConversations();
      setConversations(convs || []);
    } catch (_) {}
  };

  const fetchDocuments = async () => {
    try {
      const docs = await listDocuments();
      setDocuments(docs || []);
    } catch (_) {}
  };

  // Speech Recognition Setup
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
        setIsRecording(false);
      };

      recognition.onerror = () => {
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleVoiceRecording = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in your current browser.');
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (e) {
        setIsRecording(false);
      }
    }
  };

  // Send message
  const handleSend = useCallback(
    async (text = input) => {
      const msg = text.trim();
      if (!msg || loading) return;

      setInput('');
      setLoading(true);

      const userMsg = {
        id: Date.now(),
        role: 'user',
        content: msg,
        time: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);

      try {
        const result = await sendMessage({
          message: msg,
          conversation_id: convId,
          document_id: activeDocId,
        });

        const botMsg = {
          id: Date.now() + 1,
          role: 'assistant',
          content: result.answer || 'I could not generate an answer right now.',
          time: new Date(),
          intent: result.intent,
          cached: result.cached,
          source: result.source,
          followups: result.suggested_followups || [],
          latency: result.latency,
          promptUsed: msg,
        };

        setMessages((prev) => [...prev, botMsg]);

        if (result.conversation_id && !convId) {
          setConvId(result.conversation_id);
          fetchConversations();
        }

        if (result.usage) setUsage(result.usage);
      } catch (err) {
        const errMsg = {
          id: Date.now() + 1,
          role: 'assistant',
          content:
            err?.response?.data?.error ||
            'Unable to reach Copilot AI service. Please check your network or try again.',
          time: new Date(),
          isError: true,
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setLoading(false);
        textareaRef.current?.focus();
      }
    },
    [input, loading, convId, activeDocId]
  );

  const handleNewTopic = () => {
    setMessages([]);
    setConvId(null);
    setActiveDocId(null);
    fetchUsage();
    textareaRef.current?.focus();
  };

  const handleLoadConversation = async (id) => {
    try {
      const data = await getConversation(id);
      setConvId(id);
      const mapped = (data.messages || []).map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        time: new Date(m.created_at),
        intent: m.intent,
        cached: m.cached,
        source: m.source,
      }));
      setMessages(mapped);
    } catch (_) {}
  };

  const handleDeleteConv = async (e, id) => {
    e.stopPropagation();
    try {
      await deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (convId === id) {
        handleNewTopic();
      }
    } catch (_) {}
  };

  const handleDocUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingDoc(true);
    try {
      const result = await uploadDocument(file);
      await fetchDocuments();
      if (result.document?.id) {
        setActiveDocId(result.document.id);
      }
    } catch (err) {
      alert(err?.response?.data?.error || 'Document upload failed');
    } finally {
      setUploadingDoc(false);
      e.target.value = '';
    }
  };

  const handleDeleteDoc = async (e, id) => {
    e.stopPropagation();
    try {
      await deleteDocument(id);
      if (activeDocId === id) setActiveDocId(null);
      await fetchDocuments();
    } catch (_) {}
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaChange = (e) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
  };

  const usagePct = usage.limit > 0 ? (usage.used / usage.limit) * 100 : 0;
  const quotaExhausted = usage.remaining === 0;
  const activeDoc = documents.find((d) => d.id === activeDocId);

  const filteredConversations = useMemo(() => {
    if (!searchFilter.trim()) return conversations;
    const q = searchFilter.toLowerCase();
    return conversations.filter((c) => (c.title || '').toLowerCase().includes(q));
  }, [conversations, searchFilter]);

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div
        className="main-content"
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          background: darkMode ? '#0a0f1d' : '#f8fafc',
        }}
      >
        <Navbar
          title="1P360 Copilot — School AI Assistant"
          darkMode={darkMode}
          onToggleDark={() => setDarkMode((d) => !d)}
        />

        <div className="copilot-page">
          {/* ── Left Sidebar: Topics & Recents ─────────────────────────── */}
          <aside className={`copilot-sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
            <div className="copilot-sidebar-header">
              <div className="copilot-brand-row">
                <div className="copilot-brand-logo">
                  <div className="copilot-orb-icon">
                    <Sparkles size={18} />
                  </div>
                  <div className="copilot-brand-info">
                    <h3>
                      1P360 Copilot
                      <span className="copilot-badge-live">LIVE</span>
                    </h3>
                    <span>Enterprise Intelligence</span>
                  </div>
                </div>
              </div>

              <button className="copilot-new-topic-btn" onClick={handleNewTopic}>
                <Plus size={16} />
                <span>New Topic</span>
              </button>

              <div className="copilot-sidebar-search">
                <Search size={14} />
                <input
                  type="text"
                  placeholder="Search topics..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                />
              </div>
            </div>

            <div className="copilot-conv-list">
              <div className="copilot-conv-section-title">Recent Conversations</div>

              {filteredConversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`copilot-conv-item ${conv.id === convId ? 'active' : ''}`}
                  onClick={() => handleLoadConversation(conv.id)}
                  title={conv.title || 'Conversation'}
                >
                  <div className="copilot-conv-item-left">
                    <Sparkles size={14} />
                    <span className="copilot-conv-title">
                      {conv.title || 'School Analytics Query'}
                    </span>
                  </div>
                  <button
                    className="copilot-conv-del-btn"
                    onClick={(e) => handleDeleteConv(e, conv.id)}
                    title="Delete conversation"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}

              {filteredConversations.length === 0 && (
                <div
                  style={{
                    fontSize: 11.5,
                    color: 'var(--cp-text-muted)',
                    textAlign: 'center',
                    marginTop: 30,
                    padding: '0 16px',
                    lineHeight: 1.6,
                  }}
                >
                  No conversations found.
                  <br />
                  Ask Copilot anything about your school!
                </div>
              )}
            </div>

            {/* Sidebar Quota Box */}
            <div className="copilot-sidebar-footer">
              <div className="copilot-quota-box">
                <div className="copilot-quota-header">
                  <span className="copilot-quota-title">
                    <Database size={13} /> Daily AI Queries
                  </span>
                  <span className="copilot-quota-val">
                    {usage.used}/{usage.limit}
                  </span>
                </div>
                <div className="copilot-quota-progress-bg">
                  <div
                    className="copilot-quota-progress-fill"
                    style={{ width: `${Math.min(usagePct, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </aside>

          {/* ── Main Chat Area ─────────────────────────────────────────── */}
          <main className="copilot-main">
            {/* Top Bar */}
            <div className="copilot-top-bar">
              <div className="copilot-top-left">
                <button
                  className="copilot-sidebar-toggle-btn"
                  onClick={() => setSidebarOpen((s) => !s)}
                  title={sidebarOpen ? 'Hide topics sidebar' : 'Show topics sidebar'}
                >
                  {sidebarOpen ? <PanelLeftClose size={17} /> : <PanelLeft size={17} />}
                </button>

                <div className="copilot-top-info">
                  <h2>
                    1P360 Copilot
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: '#22c55e',
                        display: 'inline-block',
                      }}
                    />
                  </h2>
                  <span>
                    {isTeacher
                      ? 'Academic & Teaching Intelligence • Connected to ERP'
                      : isSuperAdmin
                      ? 'Platform Administration & Multi-Tenant Analytics'
                      : 'School Operations & Analytics Engine • Real-time Data'}
                  </span>
                </div>
              </div>

              <div className="copilot-top-right">
                {/* Document Drawer Toggle (Always useful for syllabus, policies, etc.) */}
                <button
                  className={`copilot-doc-indicator-btn ${docDrawerOpen ? 'active' : ''}`}
                  onClick={() => setDocDrawerOpen((d) => !d)}
                  title="Manage Attached Knowledge Documents"
                >
                  <FileText size={14} />
                  <span>
                    {activeDoc ? activeDoc.original_name.slice(0, 14) + '...' : 'Knowledge Docs'}
                  </span>
                  {documents.length > 0 && (
                    <span
                      style={{
                        fontSize: 10,
                        background: 'rgba(139, 92, 246, 0.2)',
                        padding: '1px 6px',
                        borderRadius: 10,
                        fontWeight: 600,
                      }}
                    >
                      {documents.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Document Drawer Slide-out Card */}
            {docDrawerOpen && (
              <div className="copilot-doc-drawer">
                <div className="copilot-doc-drawer-header">
                  <div className="copilot-doc-drawer-title">
                    <FileText size={15} /> School Documents & Notes
                  </div>
                  <button
                    onClick={() => setDocDrawerOpen(false)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--cp-text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    <X size={15} />
                  </button>
                </div>

                <button
                  className="copilot-doc-upload-box"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingDoc}
                >
                  <Paperclip size={14} />
                  <span>{uploadingDoc ? 'Uploading & Indexing...' : '+ Upload PDF / Word Document'}</span>
                </button>

                <div className="copilot-doc-list">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className={`copilot-doc-item ${doc.id === activeDocId ? 'active' : ''}`}
                      onClick={() => setActiveDocId(doc.id === activeDocId ? null : doc.id)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <FileText
                          size={15}
                          color={doc.id === activeDocId ? '#8b5cf6' : 'var(--cp-text-muted)'}
                        />
                        <span className="copilot-doc-item-title">{doc.original_name}</span>
                      </div>
                      <button
                        onClick={(e) => handleDeleteDoc(e, doc.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--cp-text-muted)',
                          cursor: 'pointer',
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}

                  {documents.length === 0 && (
                    <div
                      style={{
                        fontSize: 11.5,
                        color: 'var(--cp-text-muted)',
                        textAlign: 'center',
                        padding: '16px 0',
                      }}
                    >
                      No reference documents attached yet.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.doc,.txt"
              style={{ display: 'none' }}
              onChange={handleDocUpload}
            />

            {/* Messages Area */}
            <div className="copilot-messages-container">
              <div className="copilot-messages-inner">
                {/* Hero / Empty State */}
                {messages.length === 0 && (
                  <div className="copilot-hero">
                    <div className="copilot-hero-orb-wrap">
                      <div className="copilot-hero-orb">
                        <Sparkles size={34} />
                      </div>
                      <div className="copilot-hero-aura" />
                    </div>

                    <div className="copilot-hero-text">
                      <h1>
                        <span className="copilot-hero-greeting">{greeting}!</span>
                        <br />
                        How can Copilot assist you today?
                      </h1>
                      <p>
                        Real-time AI paired with your school's live ERP records. Query tuition fees,
                        attendance, student grades, fleet tracking, or draft structured teaching plans.
                      </p>
                    </div>

                    {/* Copilot Prompt Cards */}
                    <div className="copilot-cards-grid">
                      {promptCards.map((card, idx) => {
                        const Icon = card.icon || Sparkles;
                        return (
                          <div
                            key={idx}
                            className="copilot-prompt-card"
                            onClick={() => handleSend(card.prompt)}
                          >
                            <div className="copilot-card-top">
                              <span className="copilot-card-category">{card.category}</span>
                              <ChevronRight size={16} className="copilot-card-arrow" />
                            </div>
                            <div>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  marginBottom: 4,
                                }}
                              >
                                <Icon size={15} color="var(--copilot-blue)" />
                                <h4 className="copilot-card-title">{card.title}</h4>
                              </div>
                              <p className="copilot-card-desc">{card.prompt}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Messages Stream */}
                {messages.map((msg) => (
                  <CopilotMessageRow
                    key={msg.id}
                    msg={msg}
                    user={user}
                    navigate={navigate}
                    onFollowup={handleSend}
                  />
                ))}

                {/* Thinking / Analyzing Indicator */}
                {loading && (
                  <div className="copilot-message-row">
                    <div className="copilot-avatar copilot">
                      <Sparkles size={16} />
                    </div>
                    <div className="copilot-thinking-row">
                      <div className="copilot-thinking-orb">
                        <Sparkles size={12} />
                      </div>
                      <div className="copilot-thinking-text">
                        Copilot is analyzing school records
                        <div className="copilot-thinking-dots">
                          <div className="copilot-thinking-dot" />
                          <div className="copilot-thinking-dot" />
                          <div className="copilot-thinking-dot" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* ── Floating Bottom Dock ─────────────────────────────────── */}
            <div className="copilot-dock-container">
              {/* Quick suggestion chips above dock */}
              {messages.length > 0 && (
                <div className="copilot-dock-chips">
                  {promptCards.slice(0, 4).map((c, i) => (
                    <button
                      key={i}
                      className="copilot-dock-chip"
                      onClick={() => handleSend(c.prompt)}
                    >
                      ✦ {c.title}
                    </button>
                  ))}
                </div>
              )}

              {/* Input Dock Card */}
              <div className="copilot-dock-card">
                {/* Active doc tag inside dock */}
                {activeDoc && (
                  <div className="copilot-dock-doc-badge">
                    <FileText size={13} />
                    <span>Using: {activeDoc.original_name}</span>
                    <button onClick={() => setActiveDocId(null)} title="Detach document">
                      <X size={13} />
                    </button>
                  </div>
                )}

                <div className="copilot-dock-row">
                  <textarea
                    ref={textareaRef}
                    className="copilot-textarea"
                    rows={1}
                    placeholder={
                      quotaExhausted
                        ? 'Daily AI query quota reached. Please try again tomorrow.'
                        : 'Ask Copilot anything about your school... (Shift + Enter for new line)'
                    }
                    value={input}
                    onChange={handleTextareaChange}
                    onKeyDown={handleKeyDown}
                    disabled={loading || quotaExhausted}
                  />

                  <div className="copilot-dock-actions">
                    {/* Attachment Button */}
                    <button
                      className="copilot-dock-btn"
                      onClick={() => fileInputRef.current?.click()}
                      title="Attach syllabus or document"
                      disabled={uploadingDoc}
                    >
                      <Paperclip size={17} />
                    </button>

                    {/* Voice Mic Button */}
                    <button
                      className={`copilot-dock-btn ${isRecording ? 'recording' : ''}`}
                      onClick={toggleVoiceRecording}
                      title={isRecording ? 'Listening... click to stop' : 'Dictate with voice'}
                    >
                      {isRecording ? <MicOff size={17} /> : <Mic size={17} />}
                    </button>

                    {/* Send Button */}
                    <button
                      className="copilot-dock-send-btn"
                      onClick={() => handleSend()}
                      disabled={loading || !input.trim() || quotaExhausted}
                      title="Send prompt to Copilot"
                    >
                      {loading ? (
                        <div
                          style={{
                            width: 16,
                            height: 16,
                            border: '2px solid #ffffff',
                            borderTopColor: 'transparent',
                            borderRadius: '50%',
                            animation: 'copilot-spin 0.8s linear infinite',
                          }}
                        />
                      ) : (
                        <Send size={16} />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Micro-disclaimer */}
              <div className="copilot-dock-disclaimer">
                1P360 Copilot queries real-time ERP databases and AI. Verify important financial and
                grade figures.
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

// ─── Copilot Message Row Component ───────────────────────────────────────────
function CopilotMessageRow({ msg, user, navigate, onFollowup }) {
  const isUser = msg.role === 'user';
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState(null);

  const time = msg.time
    ? new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  const handleCopy = () => {
    if (!msg.content) return;
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Detect relevant ERP actions based on message text
  const relevantActions = useMemo(() => {
    if (isUser || !msg.content) return [];
    const text = `${msg.content} ${msg.promptUsed || ''}`.toLowerCase();
    const actions = [];
    const seenPaths = new Set();

    for (const act of SMART_ERP_ACTIONS) {
      const matches = act.keywords.some((kw) => text.includes(kw));
      if (matches && !seenPaths.has(act.path)) {
        seenPaths.add(act.path);
        actions.push(act);
      }
      if (actions.length >= 2) break;
    }
    return actions;
  }, [msg, isUser]);

  return (
    <div className={`copilot-message-row ${isUser ? 'user' : ''}`}>
      <div className={`copilot-avatar ${isUser ? 'user' : 'copilot'}`}>
        {isUser ? (user?.first_name ? user.first_name[0] : 'U') : <Sparkles size={16} />}
      </div>

      <div className="copilot-message-body">
        {isUser ? (
          <div className="copilot-bubble-user">{msg.content}</div>
        ) : (
          <div className={`copilot-bubble-bot ${msg.isError ? 'error' : ''}`}>
            <div className="copilot-bubble-header">
              <div className="copilot-bubble-badge-group">
                <span className="copilot-name-tag">
                  <Sparkles size={13} /> 1P360 Copilot
                </span>
                {msg.source === 'DOCUMENT' && (
                  <span className="copilot-source-tag doc">
                    <FileText size={11} /> Document Context
                  </span>
                )}
                {msg.source === 'ERP_DATA' && (
                  <span className="copilot-source-tag erp">
                    <Database size={11} /> ERP Live Data
                  </span>
                )}
                {msg.cached && (
                  <span className="copilot-source-tag cache">
                    ⚡ Instant Cache
                  </span>
                )}
              </div>
            </div>

            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.68 }}>{msg.content}</div>

            {/* Smart ERP Action Cards */}
            {relevantActions.length > 0 && (
              <div className="copilot-action-card-tray">
                {relevantActions.map((act, i) => {
                  const Icon = act.icon || ExternalLink;
                  return (
                    <button
                      key={i}
                      className="copilot-action-btn"
                      onClick={() => {
                        const targetPath = resolveTenantPath(act.path, user);
                        navigate(targetPath);
                      }}
                    >
                      <Icon size={13} />
                      <span>{act.label}</span>
                      <ExternalLink size={11} style={{ opacity: 0.7 }} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Follow-up suggestions */}
        {!isUser && msg.followups && msg.followups.length > 0 && (
          <div className="copilot-followups-tray">
            {msg.followups.slice(0, 3).map((f, i) => (
              <button
                key={i}
                className="copilot-followup-pill"
                onClick={() => onFollowup(f)}
              >
                ✦ {f}
              </button>
            ))}
          </div>
        )}

        {/* Message Footer & Tools */}
        <div className="copilot-msg-footer">
          <span className="copilot-msg-time">{time}</span>

          {!isUser && !msg.isError && (
            <div className="copilot-msg-tools">
              <button
                className="copilot-tool-btn"
                onClick={handleCopy}
                title={copied ? 'Copied to clipboard' : 'Copy response'}
              >
                {copied ? <Check size={13} color="#22c55e" /> : <Copy size={13} />}
              </button>

              <button
                className={`copilot-tool-btn ${liked === true ? 'active' : ''}`}
                onClick={() => setLiked((l) => (l === true ? null : true))}
                title="Good response"
              >
                <ThumbsUp size={13} />
              </button>

              <button
                className={`copilot-tool-btn ${liked === false ? 'active' : ''}`}
                onClick={() => setLiked((l) => (l === false ? null : false))}
                title="Poor response"
              >
                <ThumbsDown size={13} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
