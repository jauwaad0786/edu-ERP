import React, { useState, useEffect } from 'react';
import { colors } from '../../theme/colors';
import { useAuth } from '../../auth/AuthContext';
import { principalService } from '../../api/services/principalService';
import Card from '../../components/common/Card';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import PullToRefresh from '../../components/common/PullToRefresh';

export default function PrincipalHomeScreen({ onNavigateTab }) {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [feeStats, setFeeStats] = useState(null);
  const [attSummary, setAttSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPrincipalData = async () => {
    try {
      setError(null);
      const [dash, fees, att] = await Promise.all([
        principalService.getDashboard().catch(() => null),
        principalService.getFeeStats().catch(() => null),
        principalService.getAttendanceSummary().catch(() => null),
      ]);
      setDashboard(dash);
      setFeeStats(fees);
      setAttSummary(att);
    } catch (err) {
      setError(err.readableMessage || 'Failed to load institutional overview');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPrincipalData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchPrincipalData();
  };

  if (loading) return <LoadingState message="Loading institutional KPIs..." />;
  if (error && !dashboard) return <ErrorState message={error} onRetry={fetchPrincipalData} />;

  const studentCount = dashboard?.students_count || dashboard?.total_students || 0;
  const teacherCount = dashboard?.teachers_count || dashboard?.total_teachers || 0;
  const totalCollected = Number(feeStats?.total_collected || dashboard?.fees_collected || 0);
  const totalOutstanding = Number(feeStats?.total_outstanding || dashboard?.fees_pending || 0);
  const dailyAttendancePct = attSummary?.attendance_percentage || attSummary?.overall_percentage || 0;

  return (
    <PullToRefresh onRefresh={handleRefresh} refreshing={refreshing}>
      <div style={{ padding: '16px' }}>
        {/* Principal Leadership Header */}
        <div style={{
          background: `linear-gradient(135deg, ${colors.primaryDark}, #1e3a8a)`,
          borderRadius: '20px',
          padding: '20px',
          color: '#ffffff',
          marginBottom: '16px',
        }}>
          <div style={{ fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.85 }}>
            Executive Campus Management
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 900, margin: '4px 0 2px' }}>
            {user?.name || 'Principal'}
          </h2>
          <div style={{ fontSize: '12.5px', opacity: 0.9 }}>
            {user?.school_name || 'Institution Head'} • Session {user?.current_session || '2025-2026'}
          </div>
        </div>

        {/* High-Level Institutional KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <Card padding="14px" onClick={() => onNavigateTab('students')}>
            <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 700 }}>Total Students</div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: colors.neutral10, marginTop: '2px' }}>
              {studentCount}
            </div>
            <div style={{ fontSize: '11px', color: colors.primary, fontWeight: 700, marginTop: '4px' }}>
              View Roster →
            </div>
          </Card>

          <Card padding="14px" onClick={() => onNavigateTab('teachers')}>
            <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 700 }}>Faculty Members</div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: colors.neutral10, marginTop: '2px' }}>
              {teacherCount}
            </div>
            <div style={{ fontSize: '11px', color: colors.primary, fontWeight: 700, marginTop: '4px' }}>
              Faculty List →
            </div>
          </Card>

          <Card padding="14px" onClick={() => onNavigateTab('fees')}>
            <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 700 }}>Fee Collected</div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: colors.success, marginTop: '2px' }}>
              ₹{totalCollected.toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
              Due: ₹{totalOutstanding.toLocaleString('en-IN')}
            </div>
          </Card>

          <Card padding="14px" onClick={() => onNavigateTab('attendance')}>
            <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 700 }}>Today's Presence</div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: dailyAttendancePct >= 75 ? colors.success : colors.warning, marginTop: '2px' }}>
              {dailyAttendancePct}%
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
              School Daily Average
            </div>
          </Card>
        </div>

        {/* Quick Operations List */}
        <h3 style={{ fontSize: '15px', fontWeight: 800, color: colors.neutral10, margin: '14px 0 10px' }}>
          Executive Modules
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Card padding="14px" onClick={() => onNavigateTab('students')}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: colors.primaryLight, color: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                  <i className="ti ti-users" />
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: colors.neutral10 }}>Students Directory</div>
                  <div style={{ fontSize: '11.5px', color: '#64748b' }}>Search admissions, sections, profiles</div>
                </div>
              </div>
              <i className="ti ti-chevron-right" style={{ color: '#94a3b8' }} />
            </div>
          </Card>

          <Card padding="14px" onClick={() => onNavigateTab('teachers')}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: colors.successBg, color: colors.success, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                  <i className="ti ti-school" />
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: colors.neutral10 }}>Faculty Directory</div>
                  <div style={{ fontSize: '11.5px', color: '#64748b' }}>Assigned classes &amp; subject allocation</div>
                </div>
              </div>
              <i className="ti ti-chevron-right" style={{ color: '#94a3b8' }} />
            </div>
          </Card>

          <Card padding="14px" onClick={() => onNavigateTab('fees')}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: colors.warningBg, color: colors.warning, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                  <i className="ti ti-receipt" />
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: colors.neutral10 }}>Finance &amp; Fees Analytics</div>
                  <div style={{ fontSize: '11.5px', color: '#64748b' }}>School collections and pending dues</div>
                </div>
              </div>
              <i className="ti ti-chevron-right" style={{ color: '#94a3b8' }} />
            </div>
          </Card>
        </div>
      </div>
    </PullToRefresh>
  );
}
