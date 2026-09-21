import React, { useState, useEffect } from 'react';
import { colors } from '../../theme/colors';
import { studentService } from '../../api/services/studentService';
import Card from '../../components/common/Card';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import PullToRefresh from '../../components/common/PullToRefresh';

export default function StudentNotesScreen() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotes = async () => {
    try {
      setError(null);
      const data = await studentService.getStudyNotes();
      setNotes(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.readableMessage || 'Failed to load study materials');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchNotes();
  };

  if (loading) return <LoadingState message="Fetching study notes..." />;
  if (error && notes.length === 0) return <ErrorState message={error} onRetry={fetchNotes} />;

  return (
    <PullToRefresh onRefresh={handleRefresh} refreshing={refreshing}>
      <div style={{ padding: '16px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 800, color: colors.neutral10, margin: '0 0 12px' }}>
          Study Material &amp; Notes ({notes.length})
        </h3>

        {notes.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {notes.map((n) => (
              <Card key={n.id} padding="14px">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    background: colors.errorBg,
                    color: colors.error,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px',
                    flexShrink: 0,
                  }}>
                    <i className="ti ti-file-text" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 800, color: colors.neutral10, margin: '0 0 2px' }}>
                      {n.title}
                    </h4>
                    {n.description && (
                      <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 6px', lineHeight: 1.3 }}>
                        {n.description}
                      </p>
                    )}
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                      {n.file_name || 'Document'}
                    </div>
                  </div>
                </div>

                {n.file_url && (
                  <div style={{ marginTop: '12px', borderTop: `1px solid ${colors.divider}`, paddingTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
                    <a
                      href={n.file_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 14px',
                        background: colors.primary,
                        color: '#ffffff',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 700,
                        textDecoration: 'none',
                      }}
                    >
                      <i className="ti ti-download" /> Download Document
                    </a>
                  </div>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '36px 16px', color: '#94a3b8', fontSize: '13px' }}>
            No study materials or revision notes uploaded for your class yet.
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}
