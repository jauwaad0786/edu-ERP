import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';

const EMPTY_FORM = {
  title: '', subtitle: '', isbn: '', category_id: '', subject: '',
  author: '', publisher: '', edition: '', language: 'English',
  rack: '', shelf: '', vendor_name: '', purchase_date: '',
  purchase_price: '', mrp: '', description: '', keywords: '',
  total_copies: 1,
};

export default function LibraryBooks() {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(localStorage.getItem('ederp_theme') === 'dark');

  const [books, setBooks]           = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage]             = useState(1);
  const [pages, setPages]           = useState(1);

  const [showModal, setShowModal]   = useState(false);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [editingId, setEditingId]   = useState(null);

  const [addCopiesTarget, setAddCopiesTarget] = useState(null);
  const [addCopiesCount, setAddCopiesCount]   = useState(1);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (categoryFilter) params.set('category_id', categoryFilter);
    params.set('page', page);
    params.set('per_page', 24);

    api.get('/library/books?' + params.toString())
      .then(r => {
        setBooks(r.data.data || []);
        setPages(r.data.pages || 1);
      })
      .catch(() => toast.error('Books load nahi ho paye'))
      .finally(() => setLoading(false));
  }, [search, categoryFilter, page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get('/library/categories').then(r => setCategories(r.data || [])).catch(() => {});
  }, []);

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowModal(true);
  }

  function openEdit(book) {
    setForm({
      title: book.title, subtitle: book.subtitle, isbn: book.isbn,
      category_id: book.category_id || '', subject: book.subject,
      author: book.author, publisher: book.publisher, edition: book.edition,
      language: book.language, rack: book.rack, shelf: book.shelf,
      vendor_name: book.vendor_name, purchase_date: book.purchase_date || '',
      purchase_price: book.purchase_price, mrp: book.mrp,
      description: book.description, keywords: book.keywords,
      total_copies: 1,
    });
    setEditingId(book.id);
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.title.trim()) { toast.error('Title required hai'); return; }
    setSaving(true);
    try {
      if (editingId) {
        await api.patch(`/library/books/${editingId}`, form);
        toast.success('Book updated');
      } else {
        await api.post('/library/books', form);
        toast.success('Book added');
      }
      setShowModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save nahi ho paya');
    }
    setSaving(false);
  }

  async function handleAddCopies() {
    if (!addCopiesTarget) return;
    try {
      await api.post(`/library/books/${addCopiesTarget.id}/copies`, { count: addCopiesCount });
      toast.success(`${addCopiesCount} copies added`);
      setAddCopiesTarget(null);
      setAddCopiesCount(1);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Copies add nahi ho payi');
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: darkMode ? '#0f172a' : '#f8fafc' }}>
      <Sidebar darkMode={darkMode} />
      <div style={{ marginLeft: 232, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Navbar title="Book Master" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div style={{ padding: 24 }}>
          {/* Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 10, flex: 1 }}>
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search title, author, ISBN, rack..."
                style={{
                  flex: 1, maxWidth: 320, padding: '9px 12px', fontSize: 13,
                  border: '1px solid #e2e8f0', borderRadius: 8, outline: 'none',
                }}
              />
              <select
                value={categoryFilter}
                onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
                style={{ padding: '9px 12px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 8 }}
              >
                <option value="">All Categories</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <button onClick={openCreate} style={{
              background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8,
              padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              + Add Book
            </button>
          </div>

          {/* Grid */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Loading...</div>
          ) : books.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Koi book nahi mili</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
              {books.map(b => (
                <div key={b.id} style={{
                  background: darkMode ? '#1e293b' : '#fff',
                  border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                  borderRadius: 12, padding: 16,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                        {b.title}
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{b.author || '—'}</div>
                    </div>
                    {b.category_name && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: '#4f46e5',
                        background: '#eef2ff', padding: '3px 8px', borderRadius: 20, flexShrink: 0,
                      }}>
                        {b.category_name}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 12, fontSize: 11 }}>
                    <span style={{ background: '#f0fdf4', color: '#16a34a', padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>
                      {b.available_copies} Available
                    </span>
                    <span style={{ background: '#eff6ff', color: '#0176d3', padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>
                      {b.issued_copies} Issued
                    </span>
                    {b.lost_copies > 0 && (
                      <span style={{ background: '#fef2f2', color: '#dc2626', padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>
                        {b.lost_copies} Lost
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
                    Rack: {b.rack || '—'} · Shelf: {b.shelf || '—'}
                  </div>

                  <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                    <button onClick={() => openEdit(b)} style={{
                      flex: 1, background: '#f1f5f9', color: '#334155', border: 'none',
                      borderRadius: 6, padding: '6px 0', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    }}>
                      Edit
                    </button>
                    <button onClick={() => setAddCopiesTarget(b)} style={{
                      flex: 1, background: '#eef2ff', color: '#4f46e5', border: 'none',
                      borderRadius: 6, padding: '6px 0', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    }}>
                      + Copies
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                style={{ padding: '6px 14px', fontSize: 12, borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: page <= 1 ? 'not-allowed' : 'pointer' }}>
                Prev
              </button>
              <span style={{ fontSize: 12, color: '#64748b', padding: '6px 4px' }}>Page {page} / {pages}</span>
              <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}
                style={{ padding: '6px 14px', fontSize: 12, borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: page >= pages ? 'not-allowed' : 'pointer' }}>
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Add/Edit Book Modal ── */}
      {showModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 620 }}>
            <div className="modal-header">
              <h3>{editingId ? 'Edit Book' : 'Add New Book'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <input placeholder="Title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="form-input" style={{ gridColumn: 'span 2' }} />
              <input placeholder="Subtitle" value={form.subtitle} onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))} className="form-input" style={{ gridColumn: 'span 2' }} />
              <input placeholder="Author" value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} className="form-input" />
              <input placeholder="Publisher" value={form.publisher} onChange={e => setForm(f => ({ ...f, publisher: e.target.value }))} className="form-input" />
              <input placeholder="ISBN" value={form.isbn} onChange={e => setForm(f => ({ ...f, isbn: e.target.value }))} className="form-input" />
              <input placeholder="Edition" value={form.edition} onChange={e => setForm(f => ({ ...f, edition: e.target.value }))} className="form-input" />
              <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))} className="form-input">
                <option value="">Category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input placeholder="Subject" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} className="form-input" />
              <input placeholder="Language" value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))} className="form-input" />
              <input placeholder="Rack" value={form.rack} onChange={e => setForm(f => ({ ...f, rack: e.target.value }))} className="form-input" />
              <input placeholder="Shelf" value={form.shelf} onChange={e => setForm(f => ({ ...f, shelf: e.target.value }))} className="form-input" />
              <input placeholder="Vendor" value={form.vendor_name} onChange={e => setForm(f => ({ ...f, vendor_name: e.target.value }))} className="form-input" />
              <input type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} className="form-input" />
              <input type="number" placeholder="Purchase Price" value={form.purchase_price} onChange={e => setForm(f => ({ ...f, purchase_price: e.target.value }))} className="form-input" />
              <input type="number" placeholder="MRP" value={form.mrp} onChange={e => setForm(f => ({ ...f, mrp: e.target.value }))} className="form-input" />
              {!editingId && (
                <input type="number" min="1" placeholder="Total Copies" value={form.total_copies}
                  onChange={e => setForm(f => ({ ...f, total_copies: e.target.value }))} className="form-input" style={{ gridColumn: 'span 2' }} />
              )}
              <textarea placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="form-input" style={{ gridColumn: 'span 2', minHeight: 60 }} />
              <input placeholder="Keywords (comma-separated)" value={form.keywords} onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))} className="form-input" style={{ gridColumn: 'span 2' }} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-neutral" onClick={() => setShowModal(false)}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{
                background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 6,
                padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
              }}>
                {saving ? 'Saving...' : editingId ? 'Update Book' : 'Add Book'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Copies Modal ── */}
      {addCopiesTarget && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setAddCopiesTarget(null)}>
          <div className="modal" style={{ maxWidth: 360 }}>
            <div className="modal-header">
              <h3>Add Copies</h3>
              <button className="modal-close" onClick={() => setAddCopiesTarget(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
                <strong>{addCopiesTarget.title}</strong> mein kitni nayi copies add karni hain?
              </p>
              <input type="number" min="1" value={addCopiesCount}
                onChange={e => setAddCopiesCount(Number(e.target.value))} className="form-input" />
            </div>
            <div className="modal-footer">
              <button className="btn btn-neutral" onClick={() => setAddCopiesTarget(null)}>Cancel</button>
              <button onClick={handleAddCopies} style={{
                background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 6,
                padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}>
                Add Copies
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
