import React, { useState, useEffect } from 'react';
import { colors } from '../../theme/colors';
import { principalService } from '../../api/services/principalService';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import PullToRefresh from '../../components/common/PullToRefresh';

export default function PrincipalAttendanceScreen() {
  const [attSummary, setAttSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAttendanceSummary = async () => {
    try {
      setError(null);
      const data = await principalService.getAttendanceSummary();
      setAttSummary(data);
    } catch (err) {
      setError(err.readableMessage || 'Failed to load school attendance stats');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAttendanceSummary();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAttendanceSummary();
  };

  if (loading) return <LoadingState message="Calculating daily presence..." />;
  if (error && !attSummary) return <ErrorState message={error} onRetry={fetchAttendanceSummary} />;

  const overallPct = attSummary?.attendance_percentage || attSummary?.overall_percentage || 0;
  const classes = attSummary?.classes || [];

  return (
    <PullToRefresh onRefresh={handleRefresh} refreshing={refreshing}>
      <div style={{ padding: '16px' }}>
        <Card padding="20px">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Daily Presence Rate</div>
              <div style={{ fontSize: '28px', fontWeight: 900, color: overallPct >= 75 ? colors.success : colors.error, marginTop: '2px' }}>
                {overallPct}%
              </div>
            </div>
            <Badge variant={overallPct >= 75 ? 'success' : 'warning'} size="md">
              {overallPct >= 75 ? 'Healthy' : 'Below Target'}
            </Badge>
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>
            Daily attendance status across all classes and sections
          </div>
        </Card>

        <h3 style={{ fontSize: '15px', fontWeight: 800, color: colors.neutral10, margin: '16px 0 10px' }}>
          Class-wise Breakdown
        </h3>

        {classes.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {classes.map((c, i) => (
              <Card key={i} padding="12px 14px">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: colors.neutral10 }}>
                      {c.class_name || `Class ${i + 1}`}
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                      Present: {c.present_count || 0} / Total: {c.total_count || 0}
                    </div>
                  </div>
                  <Badge variant={c.percentage >= 75 ? 'success' : 'error'}>
                    {c.percentage || 0}%
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '30px 16px', color: '#94a3b8', fontSize: '13px' }}>
            No class-wise records marked today yet.
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}
