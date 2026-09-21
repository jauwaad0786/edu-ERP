import React, { useState, useEffect } from 'react';
import { colors } from '../../theme/colors';
import { principalService } from '../../api/services/principalService';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import PullToRefresh from '../../components/common/PullToRefresh';

export default function PrincipalFeesScreen() {
  const [feeStats, setFeeStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFeeStats = async () => {
    try {
      setError(null);
      const data = await principalService.getFeeStats();
      setFeeStats(data);
    } catch (err) {
      setError(err.readableMessage || 'Failed to load school fee analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFeeStats();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchFeeStats();
  };

  if (loading) return <LoadingState message="Calculating fee totals..." />;
  if (error && !feeStats) return <ErrorState message={error} onRetry={fetchFeeStats} />;

  const totalCollected = Number(feeStats?.total_collected || 0);
  const totalOutstanding = Number(feeStats?.total_outstanding || 0);
  const totalGross = totalCollected + totalOutstanding;
  const collectionRate = totalGross > 0 ? Math.round((totalCollected / totalGross) * 100) : 0;

  return (
    <PullToRefresh onRefresh={handleRefresh} refreshing={refreshing}>
      <div style={{ padding: '16px' }}>
        <Card padding="20px">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Total Collected Revenue</div>
              <div style={{ fontSize: '28px', fontWeight: 900, color: colors.success, marginTop: '2px' }}>
                ₹{totalCollected.toLocaleString('en-IN')}
              </div>
            </div>
            <Badge variant="success" size="md">
              {collectionRate}% Collected
            </Badge>
          </div>

          <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: '12px', display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Total Outstanding Dues</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: colors.error }}>
                ₹{totalOutstanding.toLocaleString('en-IN')}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Total Billed</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: colors.neutral10 }}>
                ₹{totalGross.toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        </Card>

        <Card padding="16px">
          <h4 style={{ fontSize: '14px', fontWeight: 800, color: colors.neutral10, marginBottom: '12px' }}>
            Collection Progress
          </h4>
          <div style={{ height: '8px', borderRadius: '4px', background: colors.neutral2, overflow: 'hidden', marginBottom: '8px' }}>
            <div style={{ width: `${collectionRate}%`, height: '100%', background: colors.success, borderRadius: '4px' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b' }}>
            <span>Target: 100%</span>
            <span>Current: {collectionRate}%</span>
          </div>
        </Card>
      </div>
    </PullToRefresh>
  );
}
