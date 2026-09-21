import React, { useState, useEffect } from 'react';
import { colors } from '../../theme/colors';
import { principalService } from '../../api/services/principalService';
import Card from '../../components/common/Card';
import Input from '../../components/common/Input';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import PullToRefresh from '../../components/common/PullToRefresh';

export default function PrincipalStudentsScreen() {
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStudents = async () => {
    try {
      setError(null);
      const res = await principalService.getStudents(1, search);
      const list = res?.students || (Array.isArray(res) ? res : []);
      setStudents(list);
    } catch (err) {
      setError(err.readableMessage || 'Failed to load students directory');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const delaySearch = setTimeout(() => {
      fetchStudents();
    }, 300);
    return () => clearTimeout(delaySearch);
  }, [search]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchStudents();
  };

  return (
    <PullToRefresh onRefresh={handleRefresh} refreshing={refreshing}>
      <div style={{ padding: '16px' }}>
        <Input
          placeholder="Search by student name or admission no..."
          icon="ti-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {loading ? (
          <LoadingState message="Searching student directory..." />
        ) : error && students.length === 0 ? (
          <ErrorState message={error} onRetry={fetchStudents} />
        ) : students.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {students.map((s) => (
              <Card key={s.id} padding="12px 14px">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '12px',
                      background: colors.primaryLight,
                      color: colors.primary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '16px',
                      fontWeight: 900,
                    }}>
                      {(s.name || 'S').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: colors.neutral10 }}>
                        {s.name}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                        Class: {s.class_name || s.class_display || '—'} • Roll #{s.roll_no || '—'}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      fontSize: '10.5px',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '6px',
                      background: s.status === 'ACTIVE' ? colors.successBg : colors.neutral1,
                      color: s.status === 'ACTIVE' ? colors.success : colors.neutral6,
                    }}>
                      {s.status || 'ACTIVE'}
                    </span>
                    <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '3px' }}>
                      Adm: #{s.admission_no || s.reg_no || s.id}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '36px 16px', color: '#94a3b8', fontSize: '13px' }}>
            No students found matching "{search}".
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}
