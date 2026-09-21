import React, { useState, useEffect } from 'react';
import { colors } from '../../theme/colors';
import { studentService } from '../../api/services/studentService';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import PullToRefresh from '../../components/common/PullToRefresh';

export default function StudentFeesScreen() {
  const [fees, setFees] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFees = async () => {
    try {
      setError(null);
      const data = await studentService.getFees();
      setFees(data);
    } catch (err) {
      setError(err.readableMessage || 'Failed to load fee ledger');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFees();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchFees();
  };

  if (loading) return <LoadingState message="Fetching live fee ledger..." />;
  if (error && !fees) return <ErrorState message={error} onRetry={fetchFees} />;

  const totalPaid = Number(fees?.total_paid ?? 0);
  const balanceDue = Number(fees?.balance ?? fees?.outstanding ?? 0);
  const totalBilled = Number(fees?.gross_due || fees?.total_due || (totalPaid + balanceDue));
  const records = fees?.records || [];

  return (
    <PullToRefresh onRefresh={handleRefresh} refreshing={refreshing}>
      <div style={{ padding: '16px' }}>
        {/* Outstanding Balance Banner */}
        <Card padding="20px">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Balance Outstanding</div>
              <div style={{ fontSize: '28px', fontWeight: 900, color: balanceDue > 0 ? colors.error : colors.success, marginTop: '2px' }}>
                ₹{balanceDue.toLocaleString('en-IN')}
              </div>
            </div>
            <Badge variant={balanceDue > 0 ? 'error' : 'success'} size="md">
              {balanceDue > 0 ? 'Payment Due' : 'All Dues Clear'}
            </Badge>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', borderTop: `1px solid ${colors.border}`, paddingTop: '12px' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Total Billed</div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: colors.neutral10 }}>
                ₹{totalBilled.toLocaleString('en-IN')}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Total Paid</div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: colors.success }}>
                ₹{totalPaid.toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        </Card>

        {/* Invoices List */}
        <h3 style={{ fontSize: '15px', fontWeight: 800, color: colors.neutral10, margin: '16px 0 10px' }}>
          Fee Transactions &amp; Invoices
        </h3>

        {records.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {records.map((r) => {
              const recBalance = r.balance !== undefined ? r.balance : Math.max(0, (r.amount_due || 0) - (r.amount_paid || 0));
              const isPaid = r.status === 'PAID';
              const isPartial = r.status === 'PARTIAL';

              return (
                <Card key={r.id} padding="14px">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <strong style={{ fontSize: '14px', color: colors.neutral10 }}>
                        {r.fee_type || 'Tuition Fee'}
                      </strong>
                      <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '1px' }}>
                        Period: {r.month || r.coverage_label || 'Current Session'}
                      </div>
                    </div>
                    <Badge variant={isPaid ? 'success' : isPartial ? 'warning' : 'error'}>
                      {r.status}
                    </Badge>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', background: colors.neutral1, padding: '8px 12px', borderRadius: '10px' }}>
                    <span>Due: <strong>₹{r.amount_due?.toLocaleString('en-IN')}</strong></span>
                    <span>Paid: <strong style={{ color: colors.success }}>₹{r.amount_paid?.toLocaleString('en-IN')}</strong></span>
                    <span>Bal: <strong style={{ color: recBalance > 0 ? colors.error : colors.success }}>₹{recBalance?.toLocaleString('en-IN')}</strong></span>
                  </div>

                  {r.receipt_no && (
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px', fontFamily: 'monospace' }}>
                      Receipt #{r.receipt_no} • {r.payment_mode || 'Cash/Online'}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '30px 16px', color: '#94a3b8', fontSize: '13px' }}>
            No fee invoices found for your profile.
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}
