import React, { useState, useEffect } from 'react';
import { colors } from '../../theme/colors';
import { useAuth } from '../../auth/AuthContext';
import { superAdminService } from '../../api/services/superAdminService';
import Card from '../../components/common/Card';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import PullToRefresh from '../../components/common/PullToRefresh';

export default function SuperAdminHomeScreen({ onNavigateTab }) {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    try {
      setError(null);
      const data = await superAdminService.getStats();
      setStats(data);
    } catch (err) {
      setError(err.readableMessage || 'Failed to load platform stats');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchStats();
  };

  if (loading) return <LoadingState message="Connecting to Platform Multi-Tenant Core..." />;
  if (error && !stats) return <ErrorState message={error} onRetry={fetchStats} />;

  const totalSchools = stats?.total_schools || stats?.schools_count || 0;
  const activeSchools = stats?.active_schools || totalSchools;
  const totalUsers = stats?.total_users || 0;

  return (
    <PullToRefresh onRefresh={handleRefresh} refreshing={refreshing}>
      <div style={{ padding: '16px' }}>
        {/* Super Admin Banner */}
        <div style={{
          background: `linear-gradient(135deg, #0f172a, ${colors.primaryDark})`,
          borderRadius: '20px',
          padding: '20px',
          color: '#ffffff',
          marginBottom: '16px',
        }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#38bdf8', fontWeight: 800 }}>
            Root Platform Administration
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 900, margin: '4px 0 2px' }}>
            {user?.name || 'Super Admin'}
          </h2>
          <div style={{ fontSize: '12px', opacity: 0.85 }}>
            Enterprise Multi-Tenant Controller
          </div>
        </div>

        {/* Global Platform KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <Card padding="14px" onClick={() => onNavigateTab('schools')}>
            <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 700 }}>Total Schools</div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: colors.neutral10, marginTop: '2px' }}>
              {totalSchools}
            </div>
            <div style={{ fontSize: '11px', color: colors.primary, fontWeight: 700, marginTop: '4px' }}>
              Manage Campuses →
            </div>
          </Card>

          <Card padding="14px" onClick={() => onNavigateTab('schools')}>
            <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 700 }}>Active Campuses</div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: colors.success, marginTop: '2px' }}>
              {activeSchools}
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
              Subscribed
            </div>
          </Card>
        </div>

        {/* Quick Operations */}
        <h3 style={{ fontSize: '15px', fontWeight: 800, color: colors.neutral10, margin: '14px 0 10px' }}>
          Platform Management
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Card padding="14px" onClick={() => onNavigateTab('schools')}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: colors.primaryLight, color: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                  <i className="ti ti-building" />
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: colors.neutral10 }}>Schools &amp; Campuses</div>
                  <div style={{ fontSize: '11.5px', color: '#64748b' }}>Configure institutions and domains</div>
                </div>
              </div>
              <i className="ti ti-chevron-right" style={{ color: '#94a3b8' }} />
            </div>
          </Card>

          <Card padding="14px" onClick={() => onNavigateTab('onboard')}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: colors.successBg, color: colors.success, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                  <i className="ti ti-plus" />
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: colors.neutral10 }}>Onboard New School</div>
                  <div style={{ fontSize: '11.5px', color: '#64748b' }}>Initialize database tenant &amp; admin</div>
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
