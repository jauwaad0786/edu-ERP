import React, { useState, useEffect } from 'react';
import { colors } from '../../theme/colors';
import { principalService } from '../../api/services/principalService';
import Card from '../../components/common/Card';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import PullToRefresh from '../../components/common/PullToRefresh';

export default function PrincipalTeachersScreen() {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTeachers = async () => {
    try {
      setError(null);
      const res = await principalService.getTeachers();
      const list = Array.isArray(res) ? res : (res?.teachers || []);
      setTeachers(list);
    } catch (err) {
      setError(err.readableMessage || 'Failed to load faculty directory');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchTeachers();
  };

  if (loading) return <LoadingState message="Fetching faculty members..." />;
  if (error && teachers.length === 0) return <ErrorState message={error} onRetry={fetchTeachers} />;

  return (
    <PullToRefresh onRefresh={handleRefresh} refreshing={refreshing}>
      <div style={{ padding: '16px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 800, color: colors.neutral10, margin: '0 0 12px' }}>
          Faculty Directory ({teachers.length})
        </h3>

        {teachers.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {teachers.map((t) => (
              <Card key={t.id} padding="14px">
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '14px',
                    background: colors.successBg,
                    color: colors.success,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    fontWeight: 900,
                  }}>
                    {(t.name || 'T').charAt(0).toUpperCase()}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14.5px', fontWeight: 800, color: colors.neutral10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {t.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      {t.designation || 'Teacher'} • {t.department || 'Academics'}
                    </div>
                    {t.phone && (
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                        📱 {t.phone}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '36px 16px', color: '#94a3b8', fontSize: '13px' }}>
            No faculty members registered in this school yet.
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}
