import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  ARTICLE:    { icon: 'ti-article',      color: '#4f46e5', bg: '#eef2ff', label: 'Article'    },
  FAQ:        { icon: 'ti-help-circle',  color: '#0891b2', bg: '#ecfeff', label: 'FAQ'        },
  VIDEO:      { icon: 'ti-player-play',  color: '#7c3aed', bg: '#f5f3ff', label: 'Video'      },
  PDF_MANUAL: { icon: 'ti-file-text',    color: '#d97706', bg: '#fffbeb', label: 'PDF Manual' },
};

const TYPE_FILTER = [
  { value: '',           label: 'All Types'  },
  { value: 'ARTICLE',    label: '📄 Articles' },
  { value: 'FAQ',        label: '❓ FAQs'     },
  { value: 'VIDEO',      label: '🎥 Videos'   },
  { value: 'PDF_MANUAL', label: '📋 PDFs'     },
];

// ─── Article Card ─────────────────────────────────────────────────────────────

function ArticleCard({ article, darkMode, onClick }) {
  const cfg     = TYPE_CONFIG[article.article_type] || TYPE_CONFIG.ARTICLE;
  const border  = darkMode ? '#1e293b' : '#e2e8f0';
  const textPri = darkMode ? '#f1f5f9' : '#0f172a';
  const textSec = darkMode ? '#64748b' : '#94a3b8';
  const cardBg  = darkMode ? '#141b2d' : '#ffffff';
  const hoverBg = darkMode ? '#1a2236' : '#f8faff';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        background:   cardBg,
        border:       `1px solid ${border}`,
        borderRadius: 12,
        padding:      '14px 16px',
        cursor:       'pointer',
        transition:   'all 0.14s',
        display:      'flex',
        gap:          12,
        alignItems:   'flex-start',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = '#4f46e5';
        e.currentTarget.style.background  = hoverBg;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = border;
        e.currentTarget.style.background  = cardBg;
      }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        background: cfg.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <i className={`ti ${cfg.icon}`} style={{ fontSize: 18, color: cfg.color }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
            background: cfg.bg, color: cfg.color,
          }}>
            {cfg.label}
          </span>
          {article.module_name && (
            <span style={{
              fontSize: 10, color: textSec,
              background: darkMode ? '#1e293b' : '#f1f5f9',
              padding: '2px 7px', borderRadius: 20,
            }}>
              {article.module_name}
            </span>
          )}
        </div>

        <div style={{
          fontSize: 14, fontWeight: 700, color: textPri, marginBottom: 4,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {article.title}
        </div>

        <div style={{
          fontSize: 12, color: textSec,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {article.body?.replace(/<[^>]+>/g, '').slice(0, 90)}...
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
          <span style={{ fontSize: 11, color: textSec, display: 'flex', alignItems: 'center', gap: 3 }}>
            <i className="ti ti-eye" style={{ fontSize: 12 }} /> {article.views} views
          </span>
          {article.video_url && (
            <span style={{ fontSize: 11, color: '#7c3aed', display: 'flex', alignItems: 'center', gap: 3 }}>
              <i className="ti ti-player-play" style={{ fontSize: 11 }} /> Has video
            </span>
          )}
          {article.file_url && (
            <span style={{ fontSize: 11, color: '#d97706', display: 'flex', alignItems: 'center', gap: 3 }}>
              <i className="ti ti-download" style={{ fontSize: 11 }} /> PDF available
            </span>
          )}
        </div>
      </div>

      <i className="ti ti-chevron-right" style={{ fontSize: 15, color: textSec, marginTop: 4, flexShrink: 0 }} />
    </div>
  );
}

// ─── Article Detail Modal ─────────────────────────────────────────────────────

function ArticleModal({ article, darkMode, onClose }) {
  const cfg    = TYPE_CONFIG[article.article_type] || TYPE_CONFIG.ARTICLE;
  const bg     = darkMode ? '#141b2d' : '#ffffff';
  const border = darkMode ? '#1e293b' : '#e2e8f0';
  const textPri= darkMode ? '#f1f5f9' : '#0f172a';
  const textSec= darkMode ? '#64748b' : '#94a3b8';

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Close modal"
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 1000, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
    >
      <div style={{
        background:   bg,
        border:       `1px solid ${border}`,
        borderRadius: 16,
        width:        '100%',
        maxWidth:     640,
        maxHeight:    '85vh',
        overflow:     'hidden',
        display:      'flex',
        flexDirection:'column',
        boxShadow:    '0 24px 64px rgba(0,0,0,0.2)',
      }}>
        {/* Modal Header */}
        <div style={{
          padding:      '16px 20px',
          borderBottom: `1px solid ${border}`,
          display:      'flex',
          justifyContent:'space-between',
          alignItems:   'flex-start',
          gap:          12,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                background: cfg.bg, color: cfg.color,
              }}>
                <i className={`ti ${cfg.icon}`} style={{ fontSize: 11, marginRight: 3 }} />
                {cfg.label}
              </span>
              {article.module_name && (
                <span style={{
                  fontSize: 11, color: textSec,
                  background: darkMode ? '#1e293b' : '#f1f5f9',
                  padding: '2px 8px', borderRadius: 20,
                }}>
                  {article.module_name}
                </span>
              )}
            </div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: textPri }}>
              {article.title}
            </h2>
            <div style={{ fontSize: 11, color: textSec, marginTop: 4, display: 'flex', gap: 12 }}>
              <span><i className="ti ti-eye" style={{ fontSize: 11, marginRight: 3 }} />{article.views} views</span>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: textSec, fontSize: 20, lineHeight: 1, flexShrink: 0,
          }}>
            <i className="ti ti-x" style={{ fontSize: 18 }} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>
          {/* Video embed */}
          {article.video_url && (
            <div style={{ marginBottom: 20 }}>
              <a href={article.video_url} target="_blank" rel="noreferrer" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 18px', borderRadius: 10,
                background: '#f5f3ff', border: '1px solid #ddd6fe',
                color: '#7c3aed', textDecoration: 'none', fontSize: 13, fontWeight: 700,
              }}>
                <i className="ti ti-player-play" style={{ fontSize: 16 }} />
                Watch Video Tutorial
              </a>
            </div>
          )}

          {/* PDF download */}
          {article.file_url && (
            <div style={{ marginBottom: 20 }}>
              <a href={article.file_url} target="_blank" rel="noreferrer" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 18px', borderRadius: 10,
                background: '#fffbeb', border: '1px solid #fde68a',
                color: '#d97706', textDecoration: 'none', fontSize: 13, fontWeight: 700,
              }}>
                <i className="ti ti-download" style={{ fontSize: 16 }} />
                Download PDF Manual
              </a>
            </div>
          )}

          {/* Article body */}
          <div style={{
            fontSize: 14, lineHeight: 1.7,
            color: darkMode ? '#cbd5e1' : '#334155',
            whiteSpace: 'pre-wrap',
          }}>
            {article.body}
          </div>

          {/* Tags */}
          {article.tags && (
            <div style={{ marginTop: 20, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {article.tags.split(',').filter(Boolean).map(tag => (
                <span key={tag.trim()} style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 20,
                  background: darkMode ? '#1e293b' : '#f1f5f9',
                  color: textSec,
                }}>
                  #{tag.trim()}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: `1px solid ${border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 12, color: textSec }}>
            Was this helpful?
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{
              padding: '6px 14px', borderRadius: 8,
              border: `1px solid ${border}`, background: 'none',
              color: '#16a34a', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            }}>
              👍 Yes
            </button>
            <button style={{
              padding: '6px 14px', borderRadius: 8,
              border: `1px solid ${border}`, background: 'none',
              color: textSec, cursor: 'pointer', fontSize: 12, fontWeight: 600,
            }}>
              👎 No
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function KnowledgeBase() {
  const navigate   = useNavigate();
  const [darkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');

  const [searchInput, setSearchInput] = useState('');
  const [search,      setSearch]      = useState('');
  const [typeFilter,  setTypeFilter]  = useState('');
  const [moduleFilter,setModuleFilter]= useState('');

  const [articles,   setArticles]   = useState([]);
  const [popular,    setPopular]    = useState([]);
  const [byModule,   setByModule]   = useState([]);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(false);
  const [selected,   setSelected]   = useState(null); // article detail modal
  const [view,       setView]       = useState('home'); // 'home' | 'search' | 'module'

  const isAdmin = (localStorage.getItem('user_role') || '') === 'SUPER_ADMIN';

  // ── Fetch popular + by-module on home view ───────────────────────────────────
  useEffect(() => {
    if (view !== 'home') return;
    Promise.all([
      api.get('/support/kb/popular?limit=6'),
      api.get('/support/kb/by-module'),
    ]).then(([popRes, modRes]) => {
      setPopular(popRes.data || []);
      setByModule(modRes.data || []);
    }).catch(() => {});
  }, [view]);

  // ── Fetch search/filter results ──────────────────────────────────────────────
  const fetchArticles = useCallback(() => {
    if (view === 'home') return;
    setLoading(true);
    const params = new URLSearchParams();
    if (search)       params.set('search',      search);
    if (typeFilter)   params.set('article_type', typeFilter);
    if (moduleFilter) params.set('module_name',  moduleFilter);
    params.set('per_page', 20);

    api.get(`/support/kb?${params}`)
      .then(r => {
        setArticles(r.data?.data  || []);
        setTotal(r.data?.total    || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [view, search, typeFilter, moduleFilter]);

  useEffect(() => { fetchArticles(); }, [fetchArticles]);

  // ── Open article (increments view count) ────────────────────────────────────
  const openArticle = (article) => {
    api.get(`/support/kb/${article.id}`).then(r => setSelected(r.data)).catch(() => setSelected(article));
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    setSearch(searchInput.trim());
    setView('search');
  };

  // ── Theme ────────────────────────────────────────────────────────────────────
  const bg      = darkMode ? '#0b1220' : '#f4f6fa';
  const cardBg  = darkMode ? '#141b2d' : '#ffffff';
  const border  = darkMode ? '#1e293b' : '#e2e8f0';
  const textPri = darkMode ? '#f1f5f9' : '#0f172a';
  const textSec = darkMode ? '#64748b' : '#94a3b8';
  const inputBg = darkMode ? '#0f172a' : '#fff';

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Help Center" darkMode={darkMode} onToggleDark={() => {}} />

        <div className="page-body" style={{ background: bg }}>

          {/* ── Hero Search ── */}
          <div style={{
            background:   'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            borderRadius: 16,
            padding:      '32px 28px',
            marginBottom: 24,
            textAlign:    'center',
          }}>
            <i className="ti ti-book" style={{ fontSize: 36, color: 'rgba(255,255,255,0.85)', display: 'block', marginBottom: 10 }} />
            <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, color: '#fff' }}>
              How can we help you?
            </h1>
            <p style={{ margin: '0 0 20px', color: 'rgba(255,255,255,0.75)', fontSize: 14 }}>
              Browse articles, guides, and FAQs to find answers quickly
            </p>

            {/* Search bar */}
            <form
              onSubmit={handleSearch}
              style={{ display: 'flex', gap: 8, maxWidth: 480, margin: '0 auto' }}
            >
              <div style={{ position: 'relative', flex: 1 }}>
                <i className="ti ti-search" style={{
                  position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 16, color: '#94a3b8',
                }} />
                <input
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  placeholder="Search articles, FAQs, guides..."
                  style={{
                    width: '100%', padding: '12px 14px 12px 40px',
                    border: 'none', borderRadius: 10,
                    background: '#fff', color: '#0f172a',
                    fontSize: 14, outline: 'none', boxSizing: 'border-box',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                  }}
                />
              </div>
              <button type="submit" style={{
                padding: '12px 20px', borderRadius: 10,
                background: '#fff', color: '#4f46e5',
                border: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: 700,
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              }}>
                Search
              </button>
            </form>
          </div>

          {/* ── Breadcrumb / Back ── */}
          {view !== 'home' && (
            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => { setView('home'); setSearch(''); setSearchInput(''); setTypeFilter(''); setModuleFilter(''); }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#4f46e5', fontSize: 13, fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <i className="ti ti-arrow-left" style={{ fontSize: 13 }} />
                Back to Help Center
              </button>
              {search && (
                <span style={{ fontSize: 13, color: textSec }}>
                  › Results for "<strong style={{ color: textPri }}>{search}</strong>"
                  {total > 0 && ` — ${total} found`}
                </span>
              )}
              {view === 'module' && (
                <span style={{ fontSize: 13, color: textSec }}>
                  › <strong style={{ color: textPri }}>{moduleFilter}</strong>
                </span>
              )}
            </div>
          )}

          {/* ── Home View ── */}
          {view === 'home' && (
            <>
              {/* Popular articles */}
              {popular.length > 0 && (
                <div style={{ marginBottom: 28 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: textPri, display: 'flex', alignItems: 'center', gap: 7 }}>
                      <i className="ti ti-trending-up" style={{ fontSize: 16, color: '#4f46e5' }} />
                      Popular Articles
                    </h2>
                    <button
                      onClick={() => setView('search')}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 12, color: '#4f46e5', fontWeight: 600,
                      }}
                    >
                      View all
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {popular.map(a => (
                      <ArticleCard key={a.id} article={a} darkMode={darkMode} onClick={() => openArticle(a)} />
                    ))}
                  </div>
                </div>
              )}

              {/* Browse by module */}
              {byModule.length > 0 && (
                <div>
                  <h2 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 800, color: textPri, display: 'flex', alignItems: 'center', gap: 7 }}>
                    <i className="ti ti-layout-grid" style={{ fontSize: 16, color: '#7c3aed' }} />
                    Browse by Module
                  </h2>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                    gap: 10,
                  }}>
                    {byModule.map(m => (
                      <div
                        key={m.module_name}
                        role="button"
                        tabIndex={0}
                        onClick={() => { setModuleFilter(m.module_name); setView('module'); }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setModuleFilter(m.module_name);
                            setView('module');
                          }
                        }}
                        style={{
                          background:   cardBg,
                          border:       `1px solid ${border}`,
                          borderRadius: 12,
                          padding:      '14px 16px',
                          cursor:       'pointer',
                          transition:   'all 0.14s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = '#4f46e5';
                          e.currentTarget.style.transform   = 'translateY(-1px)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = border;
                          e.currentTarget.style.transform   = 'translateY(0)';
                        }}
                      >
                        <div style={{ fontSize: 22, marginBottom: 8 }}>📚</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: textPri, marginBottom: 4 }}>
                          {m.module_name || 'General'}
                        </div>
                        <div style={{ fontSize: 11, color: textSec }}>
                          {m.article_count} article{m.article_count !== 1 ? 's' : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No content yet */}
              {popular.length === 0 && byModule.length === 0 && (
                <div style={{
                  background: cardBg, border: `1px solid ${border}`,
                  borderRadius: 12, padding: 48, textAlign: 'center',
                }}>
                  <i className="ti ti-book-off" style={{ fontSize: 40, color: textSec, display: 'block', marginBottom: 12 }} />
                  <div style={{ fontSize: 15, fontWeight: 700, color: textPri, marginBottom: 6 }}>
                    Help Center is being set up
                  </div>
                  <div style={{ fontSize: 13, color: textSec }}>
                    Articles and guides will appear here soon
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Search / Module View ── */}
          {view !== 'home' && (
            <>
              {/* Type filter tabs */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                {TYPE_FILTER.map(f => (
                  <button
                    key={f.value}
                    onClick={() => setTypeFilter(f.value)}
                    style={{
                      padding:      '6px 14px',
                      borderRadius: 20,
                      border:       'none',
                      cursor:       'pointer',
                      fontSize:     12,
                      fontWeight:   typeFilter === f.value ? 700 : 500,
                      background:   typeFilter === f.value ? '#4f46e5' : (darkMode ? '#1e293b' : '#f1f5f9'),
                      color:        typeFilter === f.value ? '#fff' : textSec,
                      transition:   'all 0.13s',
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Admin: create button */}
              {isAdmin && (
                <div style={{ marginBottom: 14 }}>
                  <button
                    onClick={() => navigate('/support/kb/new')}
                    style={{
                      padding: '8px 18px', borderRadius: 9,
                      background: '#4f46e5', color: '#fff',
                      border: 'none', cursor: 'pointer',
                      fontSize: 13, fontWeight: 700,
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    <i className="ti ti-plus" style={{ fontSize: 14 }} />
                    New Article
                  </button>
                </div>
              )}

              {/* Articles list */}
              {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: textSec }}>
                  <i className="ti ti-loader-2" style={{ fontSize: 28, display: 'block', marginBottom: 8 }} />
                  <div style={{ fontSize: 13 }}>Searching...</div>
                </div>
              ) : articles.length === 0 ? (
                <div style={{
                  background: cardBg, border: `1px solid ${border}`,
                  borderRadius: 12, padding: 48, textAlign: 'center',
                }}>
                  <i className="ti ti-search-off" style={{ fontSize: 36, color: textSec, display: 'block', marginBottom: 10 }} />
                  <div style={{ fontSize: 15, fontWeight: 700, color: textPri, marginBottom: 6 }}>
                    No articles found
                  </div>
                  <div style={{ fontSize: 13, color: textSec, marginBottom: 20 }}>
                    Try different keywords or browse by module
                  </div>
                  <button
                    onClick={() => navigate('/support/tickets/new')}
                    style={{
                      padding: '9px 20px', borderRadius: 9,
                      background: '#4f46e5', color: '#fff',
                      border: 'none', cursor: 'pointer',
                      fontSize: 13, fontWeight: 700,
                    }}
                  >
                    Raise a Support Ticket Instead
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {articles.map(a => (
                    <ArticleCard key={a.id} article={a} darkMode={darkMode} onClick={() => openArticle(a)} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Quick help footer ── */}
          <div style={{
            background:   cardBg,
            border:       `1px solid ${border}`,
            borderRadius: 12,
            padding:      '20px 24px',
            marginTop:    24,
            display:      'flex',
            alignItems:   'center',
            justifyContent:'space-between',
            gap:          16,
            flexWrap:     'wrap',
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: textPri, marginBottom: 4 }}>
                Still need help?
              </div>
              <div style={{ fontSize: 12.5, color: textSec }}>
                Our support team is ready to assist you
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => navigate('/support/tickets/new')}
                style={{
                  padding: '9px 18px', borderRadius: 9,
                  background: '#4f46e5', color: '#fff',
                  border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 700,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <i className="ti ti-ticket" style={{ fontSize: 14 }} />
                Raise a Ticket
              </button>
              <button
                onClick={() => navigate('/support/meetings/new')}
                style={{
                  padding: '9px 18px', borderRadius: 9,
                  background: darkMode ? '#1e293b' : '#f1f5f9',
                  color: darkMode ? '#cbd5e1' : '#475569',
                  border: `1px solid ${border}`, cursor: 'pointer',
                  fontSize: 13, fontWeight: 700,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <i className="ti ti-calendar-plus" style={{ fontSize: 14 }} />
                Book a Meeting
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Article detail modal */}
      {selected && (
        <ArticleModal
          article={selected}
          darkMode={darkMode}
          onClose={() => setSelected(null)}
        />
      )}

      <style>{`
        .theme-dark { background: #0b1220; }
        .theme-dark .main-content { background: #0b1220; }
      `}</style>
    </div>
  );
}
