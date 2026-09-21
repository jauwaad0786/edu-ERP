import React, { useState, useEffect } from 'react';
import { colors } from '../../theme/colors';
import { superAdminService } from '../../api/services/superAdminService';
import Card from '../../components/common/Card';
import Input from '../../components/common/Input';
import Badge from '../../components/common/Badge';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import PullToRefresh from '../../components/common/PullToRefresh';

export default function SchoolsDirectoryScreen() {
  const [schools, setSchools] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSchools = async () => {
    try {
      setError(null);
      const res = await superAdminService.getSchools(1, search);
      const list = res?.schools || (Array.isArray(res) ? res : []);
      setSchools(list);
    } catch (err) {
      setError(err.readableMessage || 'Failed to load schools directory');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const delaySearch = setTimeout(() => {
      fetchSchools();
    }, 300);
    return () => clearTimeout(delaySearch);
  }, [search]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchSchools();
  };

  return (
    <PullToRefresh onRefresh={handleRefresh} refreshing={refreshing}>
      <div style={{ padding: '16px' }}>
        <Input
          placeholder="Search school by name, code, or city..."
          icon="ti-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {loading ? (
          <LoadingState message="Searching enterprise schools..." />
        ) : error && schools.length === 0 ? (
          <ErrorState message={error} onRetry={fetchSchools} />
        ) : schools.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {schools.map((s) => (
              <Card key={s.id} padding="14px">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                  <div>
                    <h4 style={{ fontSize: '15px', fontWeight: 800, color: colors.neutral10, margin: '0 0 2px' }}>
                      {s.name}
                    </h4>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      Code: {s.code || '—'} • {s.city || 'Campus'}
                    </div>
                    {s.contact_email && (
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                        📧 {s.contact_email}
                      </div>
                    )}
                  </div>
                  <Badge variant={s.is_active ? 'success' : 'neutral'}>
                    {s.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '36px 16px', color: '#94a3b8', fontSize: '13px' }}>
            No registered schools found.
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}
