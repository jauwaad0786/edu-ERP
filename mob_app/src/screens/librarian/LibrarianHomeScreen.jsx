import React, { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthContext';
import libraryService from '../../api/services/libraryService';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import LoadingState from '../../components/common/LoadingState';
import PullToRefresh from '../../components/common/PullToRefresh';

export default function LibrarianHomeScreen({ onNavigate }) {
  const { user } = useAuth();
  const [books, setBooks] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchLibraryData = async () => {
    setLoading(true);
    try {
      const res = await libraryService.getBooks({ limit: 20 });
      const d = res.data || res;
      setBooks(Array.isArray(d) ? d : d.items || d.books || []);
    } catch (err) {
      console.error('Library fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLibraryData();
  }, []);

  const filteredBooks = books.filter(b => 
    (b.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.author || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.isbn || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <PullToRefresh onRefresh={fetchLibraryData}>
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: 'var(--color-navy)' }}>
              Library Management
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              Catalog & Circulation ({user?.name || 'Librarian'})
            </p>
          </div>
          <Badge variant="primary" label="Librarian" />
        </div>

        {/* Search */}
        <div>
          <input
            type="text"
            placeholder="Search books by title, author, ISBN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: '8px',
              border: '1px solid var(--color-border)',
              fontSize: '14px',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Action Shortcuts */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="primary" size="small" fullWidth onClick={() => alert('Issue Book barcode scanner')}>
            Issue Book
          </Button>
          <Button variant="outline" size="small" fullWidth onClick={() => alert('Return Book scanner')}>
            Return Book
          </Button>
        </div>

        {loading ? (
          <LoadingState message="Fetching book catalog..." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: 'var(--color-navy)' }}>
              Catalog ({filteredBooks.length} titles)
            </h3>
            {filteredBooks.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', textAlign: 'center', padding: '20px' }}>
                No books match your criteria.
              </div>
            ) : (
              filteredBooks.map((book, idx) => (
                <Card key={book.id || idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--color-navy)' }}>
                        {book.title || 'Untitled Book'}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                        By {book.author || 'Unknown'} • ISBN: {book.isbn || 'N/A'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                        Rack: {book.rack_number || 'Section A'} • Available: {book.available_copies ?? book.quantity ?? 1}
                      </div>
                    </div>
                    <Badge
                      variant={(book.available_copies ?? 1) > 0 ? 'success' : 'error'}
                      label={(book.available_copies ?? 1) > 0 ? 'Available' : 'Issued'}
                    />
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}
