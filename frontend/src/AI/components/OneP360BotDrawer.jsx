import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { sendMessage, getUsage } from '../services/aiApi';
import '../styles/ai.css';

const PRINCIPAL_QUICK_CHIPS = [
  'How much fee was collected in February?',
  'What is the total outstanding fee amount?',
  'What is today’s attendance status?',
  'Who are the top 10 academic students?',
  'Show class-wise attendance breakdown',
  'Show school transport summary',
  'What is the current hostel occupancy?',
  'How many library books are currently issued?',
];

const DEVELOPER_QUICK_CHIPS = [
  'How many schools are enrolled?',
  'Which schools have active paid subscriptions?',
  'Show platform active users by role',
  'What is the system health status?',
];

const TEACHER_QUICK_CHIPS = [
  'Create today’s lesson plan',
  'Generate Class 8 Maths practice questions',
  'How is my class performing academically?',
];

export default function OneP360BotDrawer({ position = 'right' }) {

  const { user } = useAuth();
  const navigate = useNavigate();
  const role = user?.role?.value || user?.role || '';

  const [isOpen,    setIsOpen]    = useState(false);
  const [messages,  setMessages]  = useState([]);
  const [input,     setInput]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [usage,     setUsage]     = useState({ used: 0, limit: 50, remaining: 50 });
  const [minimized, setMinimized] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);

  const isSuperAdmin = role === 'SUPER_ADMIN';
  const isTeacher    = role === 'TEACHER';
  const quickChips   = isSuperAdmin ? DEVELOPER_QUICK_CHIPS : (isTeacher ? TEACHER_QUICK_CHIPS : PRINCIPAL_QUICK_CHIPS);

  useEffect(() => {
    if (isOpen) {
      fetchUsage();
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const fetchUsage = async () => {
    try {
      const u = await getUsage();
      if (u) setUsage(u);
    } catch (_) {}
  };

  const handleSend = async (textToSend = input) => {
    const text = (textToSend || '').trim();
    if (!text || loading) return;

    setInput('');
    setLoading(true);

    const userMsg = { id: Date.now(), role: 'user', content: text, time: new Date() };
    setMessages(prev => [...prev, userMsg]);

    try {
      const res = await sendMessage({ message: text });
      const botMsg = {
        id:        Date.now() + 1,
        role:      'assistant',
        content:   res.answer || 'Response generated.',
        time:      new Date(),
        cached:    res.cached,
        source:    res.source,
        followups: res.suggested_followups || [],
      };
      setMessages(prev => [...prev, botMsg]);
      if (res.usage) setUsage(res.usage);
    } catch (err) {
      const errMsg = {
        id:      Date.now() + 1,
        role:    'assistant',
        content: err?.response?.data?.error || 'AI service unavailable. Please check configuration.',
        time:    new Date(),
        isError: true,
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* ── Floating Launcher Button ──────────────────────────────────── */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          title="Open 1P360 BOT AI Assistant"
          style={{
            position: 'fixed',
            bottom: '24px',
            [position === 'left' ? 'left' : 'right']: '24px',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 18px',
            borderRadius: '99px',
            background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
            color: '#ffffff',
            border: '2px solid rgba(255,255,255,0.2)',
            boxShadow: '0 8px 24px rgba(37,99,235,0.45), 0 0 20px rgba(124,58,237,0.3)',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '13.5px',
            transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
            transform: 'translateY(0)',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px) scale(1.03)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0) scale(1)'}
        >
          <span style={{
            width: '26px', height: '26px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.25)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: '15px',
          }}>
            🤖
          </span>
          <span>1P360 BOT</span>
          <span style={{
            fontSize: '9px', fontWeight: 800, padding: '2px 7px', borderRadius: '99px',
            background: '#22c55e', color: '#ffffff', letterSpacing: '0.5px',
          }}>
            AI
          </span>
        </button>
      )}

      {/* ── Slide-Over Assistant Drawer ───────────────────────────────── */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: minimized ? '20px' : '20px',
          [position === 'left' ? 'left' : 'right']: '20px',
          width: '390px',
          maxWidth: 'calc(100vw - 40px)',
          height: minimized ? '60px' : '580px',
          maxHeight: 'calc(100vh - 80px)',
          zIndex: 1000,
          background: '#0f172a',
          borderRadius: '20px',
          border: '1px solid rgba(99,179,237,0.25)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6), 0 0 30px rgba(59,130,246,0.2)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          animation: 'ai-drawer-in 0.3s ease-out',
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 18px',
            background: 'linear-gradient(135deg, #1e293b, #0f172a)',
            borderBottom: '1px solid rgba(99,179,237,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '10px',
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '16px', color: '#fff',
              }}>
                🤖
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  1P360 BOT
                  <span style={{ fontSize: '9px', background: 'rgba(34,197,94,0.2)', color: '#4ade80', padding: '1px 6px', borderRadius: '99px' }}>
                    LIVE
                  </span>
                </div>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                  {isSuperAdmin ? 'Platform Analytics' : (isTeacher ? 'Teaching Assistant' : 'Real ERP Analytics')}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={() => navigate('/ai/chat')}
                title="Open Full Chat View"
                style={{
                  background: 'rgba(99,179,237,0.12)', border: 'none', color: '#93c5fd',
                  borderRadius: '6px', width: '28px', height: '28px', cursor: 'pointer',
                  fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                ⤢
              </button>
              <button
                onClick={() => setMinimized(m => !m)}
                title={minimized ? 'Expand' : 'Minimize'}
                style={{
                  background: 'rgba(99,179,237,0.12)', border: 'none', color: '#94a3b8',
                  borderRadius: '6px', width: '28px', height: '28px', cursor: 'pointer',
                  fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {minimized ? '▲' : '▼'}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Close"
                style={{
                  background: 'rgba(239,68,68,0.15)', border: 'none', color: '#f87171',
                  borderRadius: '6px', width: '28px', height: '28px', cursor: 'pointer',
                  fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Body */}
          {!minimized && (
            <>
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                background: 'linear-gradient(180deg, #0b132b 0%, #0f172a 100%)',
              }}>
                {/* Welcome Card if no messages */}
                {messages.length === 0 && (
                  <div>
                    <div style={{
                      padding: '16px', borderRadius: '14px',
                      background: 'linear-gradient(135deg, rgba(37,99,235,0.18), rgba(124,58,237,0.14))',
                      border: '1px solid rgba(99,179,237,0.22)',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                      marginBottom: '14px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <span style={{ fontSize: '20px' }}>👋</span>
                        <div>
                          <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#f8fafc', letterSpacing: '0.2px' }}>
                            How can I help you today?
                          </div>
                          <div style={{ fontSize: '10.5px', color: '#93c5fd' }}>
                            1P360 AI Assistant • Powered by School ERP Data
                          </div>
                        </div>
                      </div>
                      <p style={{ fontSize: '11.5px', color: '#cbd5e1', margin: '6px 0 0', lineHeight: '1.5' }}>
                        Ask any question about your school’s fees, attendance, academic records, transport, or operations.
                      </p>
                    </div>

                    <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' }}>
                      ⚡ Suggested Inquiries
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                      {quickChips.map((chip, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSend(chip)}
                          style={{
                            textAlign: 'left', padding: '10px 14px', borderRadius: '10px',
                            background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(99,179,237,0.14)',
                            color: '#e2e8f0', fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s ease',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = 'rgba(59,130,246,0.18)';
                            e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)';
                            e.currentTarget.style.color = '#93c5fd';
                            e.currentTarget.style.transform = 'translateX(3px)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'rgba(30,41,59,0.6)';
                            e.currentTarget.style.borderColor = 'rgba(99,179,237,0.14)';
                            e.currentTarget.style.color = '#e2e8f0';
                            e.currentTarget.style.transform = 'translateX(0)';
                          }}
                        >
                          <span>{chip}</span>
                          <span style={{ fontSize: '11px', opacity: 0.6 }}>→</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}


                {/* Messages */}
                {messages.map(m => (
                  <div key={m.id} style={{
                    display: 'flex', flexDirection: 'column',
                    alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
                  }}>
                    <div style={{
                      maxWidth: '85%', padding: '10px 14px', borderRadius: '14px',
                      fontSize: '12.5px', lineHeight: '1.55', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      background: m.role === 'user' ? 'linear-gradient(135deg, #2563eb, #4f46e5)' : 'rgba(30,41,59,0.85)',
                      color: m.isError ? '#fca5a5' : '#f1f5f9',
                      border: `1px solid ${m.isError ? 'rgba(239,68,68,0.3)' : (m.role === 'user' ? 'transparent' : 'rgba(99,179,237,0.12)')}`,
                      borderTopRightRadius: m.role === 'user' ? '3px' : '14px',
                      borderTopLeftRadius: m.role === 'user' ? '14px' : '3px',
                    }}>
                      {m.content}
                    </div>

                    <div style={{ display: 'flex', gap: '6px', fontSize: '9px', color: '#64748b', marginTop: '3px', padding: '0 4px' }}>
                      {m.cached && <span style={{ color: '#f59e0b' }}>⚡ Cached</span>}
                      {m.source && <span style={{ color: '#34d399' }}>🏫 {m.source}</span>}
                    </div>

                    {/* Followup Chips */}
                    {m.followups && m.followups.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                        {m.followups.slice(0, 2).map((f, fi) => (
                          <button
                            key={fi}
                            onClick={() => handleSend(f)}
                            style={{
                              fontSize: '10.5px', padding: '4px 8px', borderRadius: '99px',
                              background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)',
                              color: '#93c5fd', cursor: 'pointer',
                            }}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* Loading typing bubble */}
                {loading && (
                  <div style={{
                    padding: '10px 14px', borderRadius: '12px', width: 'fit-content',
                    background: 'rgba(30,41,59,0.85)', border: '1px solid rgba(99,179,237,0.12)',
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>1P360 BOT analyzing ERP data</span>
                    <span className="ai-typing-dot" style={{ width: '6px', height: '6px' }} />
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div style={{
                padding: '12px 14px',
                background: 'rgba(15,23,42,0.95)',
                borderTop: '1px solid rgba(99,179,237,0.15)',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: 'rgba(30,41,59,0.7)', borderRadius: '10px',
                  border: '1px solid rgba(99,179,237,0.2)', padding: '6px 10px',
                }}>
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Ask fees, attendance, students..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
                    disabled={loading}
                    style={{
                      flex: 1, background: 'transparent', border: 'none',
                      outline: 'none', color: '#f1f5f9', fontSize: '12.5px',
                    }}
                  />
                  <button
                    onClick={() => handleSend()}
                    disabled={loading || !input.trim()}
                    style={{
                      background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                      border: 'none', color: '#fff', borderRadius: '8px',
                      width: '28px', height: '28px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '13px', opacity: (loading || !input.trim()) ? 0.5 : 1,
                    }}
                  >
                    ➤
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '10px', color: '#64748b' }}>
                  <span>Press Enter to send</span>
                  <span>AI Quota: {usage.used}/{usage.limit} today</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
