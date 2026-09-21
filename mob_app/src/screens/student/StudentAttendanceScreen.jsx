import React, { useState, useEffect } from 'react';
import { colors } from '../../theme/colors';
import { studentService } from '../../api/services/studentService';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import PullToRefresh from '../../components/common/PullToRefresh';

export default function StudentAttendanceScreen() {
  const [attendance, setAttendance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAttendance = async () => {
    try {
      setError(null);
      const data = await studentService.getAttendance();
      setAttendance(data);
    } catch (err) {
      setError(err.readableMessage || 'Failed to load attendance records');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAttendance();
  };

  if (loading) return <LoadingState message="Fetching attendance journal..." />;
  if (error && !attendance) return <ErrorState message={error} onRetry={fetchAttendance} />;

  const present = Number(attendance?.present ?? 0);
  const absent = Number(attendance?.absent ?? 0);
  const late = Number(attendance?.late ?? 0);
  const total = Number(attendance?.total_days ?? (present + absent + late));
  const rate = attendance?.percentage ?? (total > 0 ? Math.round((present / total) * 100) : 0);
  const records = attendance?.records || [];

  return (
    <PullToRefresh onRefresh={handleRefresh} refreshing={refreshing}>
      <div style={{ padding: '16px' }}>
        {/* Attendance Summary Banner */}
        <Card padding="20px">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Overall Attendance Rate</div>
              <div style={{ fontSize: '28px', fontWeight: 900, color: rate >= 75 ? colors.success : colors.error, marginTop: '2px' }}>
                {rate}%
              </div>
            </div>
            <Badge variant={rate >= 75 ? 'success' : 'error'} size="md">
              {rate >= 75 ? 'Eligible' : 'Below 75%'}
            </Badge>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', textAlign: 'center' }}>
            <div style={{ padding: '8px', background: colors.successBg, borderRadius: '10px' }}>
              <div style={{ fontSize: '11px', color: colors.success, fontWeight: 700 }}>Present</div>
              <div style={{ fontSize: '16px', fontWeight: 900, color: colors.success }}>{present}</div>
            </div>
            <div style={{ padding: '8px', background: colors.errorBg, borderRadius: '10px' }}>
              <div style={{ fontSize: '11px', color: colors.error, fontWeight: 700 }}>Absent</div>
              <div style={{ fontSize: '16px', fontWeight: 900, color: colors.error }}>{absent}</div>
            </div>
            <div style={{ padding: '8px', background: colors.warningBg, borderRadius: '10px' }}>
              <div style={{ fontSize: '11px', color: colors.warning, fontWeight: 700 }}>Late</div>
              <div style={{ fontSize: '16px', fontWeight: 900, color: colors.warning }}>{late}</div>
            </div>
          </div>
        </Card>

        {/* Daily Journal List */}
        <h3 style={{ fontSize: '15px', fontWeight: 800, color: colors.neutral10, margin: '16px 0 10px' }}>
          Daily Attendance Journal ({records.length} days)
        </h3>

        {records.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {records.map((r, i) => {
              const d = new Date(r.date);
              const isValid = !isNaN(d);
              const dateStr = isValid
                ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                : (r.date || '—');
              const dayStr = isValid ? d.toLocaleDateString('en-IN', { weekday: 'short' }) : '';

              const isPresent = r.status === 'PRESENT';
              const isLate = r.status === 'LATE';

              return (
                <Card key={r.id || i} padding="12px 16px" style={{ marginBottom: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: '13.5px', fontWeight: 700, color: colors.neutral10 }}>
                        {dateStr}
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                        {dayStr} {r.remarks ? `• ${r.remarks}` : ''}
                      </div>
                    </div>
                    <Badge variant={isPresent ? 'success' : isLate ? 'warning' : 'error'}>
                      {r.status}
                    </Badge>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '30px 16px', color: '#94a3b8', fontSize: '13px' }}>
            No attendance records marked yet for current session.
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}
