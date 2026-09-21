import React, { useState, useEffect } from 'react';
import { colors } from '../../theme/colors';
import { studentService } from '../../api/services/studentService';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import PullToRefresh from '../../components/common/PullToRefresh';

export default function ParentHomeScreen({ onNavigateTab }) {
  const [data, setData] = useState({
    profile: null,
    attendance: null,
    marks: [],
    fees: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWardData = async () => {
    try {
      setError(null);
      const [profile, attendance, marks, fees] = await Promise.all([
        studentService.getProfile().catch(() => null),
        studentService.getAttendance().catch(() => null),
        studentService.getMarks().catch(() => []),
        studentService.getFees().catch(() => null),
      ]);
      setData({
        profile,
        attendance,
        marks: Array.isArray(marks) ? marks : [],
        fees,
      });
    } catch (err) {
      setError(err.readableMessage || 'Failed to load student ward records');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchWardData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchWardData();
  };

  if (loading) return <LoadingState message="Fetching ward's progress..." />;
  if (error && !data.profile) return <ErrorState message={error} onRetry={fetchWardData} />;

  const { profile, attendance, fees } = data;
  const attendancePct = attendance?.percentage ?? (attendance?.total_days > 0 ? Math.round((attendance.present / attendance.total_days) * 100) : 0);
  const balanceDue = Number(fees?.balance ?? fees?.outstanding ?? 0);

  return (
    <PullToRefresh onRefresh={handleRefresh} refreshing={refreshing}>
      <div style={{ padding: '16px' }}>
        <div style={{
          background: `linear-gradient(135deg, ${colors.primaryDark}, #4338ca)`,
          borderRadius: '20px',
          padding: '20px',
          color: '#ffffff',
          marginBottom: '16px',
        }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.85 }}>
            Parent &amp; Guardian Dashboard
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 900, margin: '4px 0 2px' }}>
            {profile?.name || 'Child Profile'}
          </h2>
          <div style={{ fontSize: '12.5px', opacity: 0.9 }}>
            Class: {profile?.class_display || profile?.class_name || 'Enrolled'} • Roll #{profile?.roll_no || '—'}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <Card padding="14px" onClick={() => onNavigateTab('attendance')}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: colors.neutral6 }}>Attendance</div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: colors.neutral10, marginTop: '2px' }}>
              {attendancePct}%
            </div>
            <Badge variant={attendancePct >= 75 ? 'success' : 'warning'} style={{ marginTop: '4px' }}>
              {attendancePct >= 75 ? 'Regular' : 'Low Presence'}
            </Badge>
          </Card>

          <Card padding="14px" onClick={() => onNavigateTab('fees')}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: colors.neutral6 }}>Fee Balance</div>
            <div style={{ fontSize: '22px', fontWeight: 900, color: balanceDue > 0 ? colors.error : colors.success, marginTop: '2px' }}>
              ₹{balanceDue.toLocaleString('en-IN')}
            </div>
            <Badge variant={balanceDue > 0 ? 'error' : 'success'} style={{ marginTop: '4px' }}>
              {balanceDue > 0 ? 'Due' : 'Cleared'}
            </Badge>
          </Card>
        </div>

        <Card padding="16px" onClick={() => onNavigateTab('marks')}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: colors.primaryLight, color: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                <i className="ti ti-award" />
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: colors.neutral10 }}>Academic Scorecard</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>View term grades &amp; exam evaluation</div>
              </div>
            </div>
            <i className="ti ti-chevron-right" style={{ color: '#94a3b8' }} />
          </div>
        </Card>
      </div>
    </PullToRefresh>
  );
}
