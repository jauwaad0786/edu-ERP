import React, { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthContext';
import financeService from '../../api/services/financeService';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import LoadingState from '../../components/common/LoadingState';
import PullToRefresh from '../../components/common/PullToRefresh';

export default function AccountantHomeScreen({ onNavigate }) {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchFinanceData = async () => {
    setLoading(true);
    try {
      const [sumRes, transRes] = await Promise.allSettled([
        financeService.getFinanceSummary(),
        financeService.getFeePayments({ limit: 10 }),
      ]);

      if (sumRes.status === 'fulfilled') {
        setSummary(sumRes.value.data || sumRes.value);
      }
      if (transRes.status === 'fulfilled') {
        const d = transRes.value.data || transRes.value;
        setRecentTransactions(Array.isArray(d) ? d : d.items || d.payments || []);
      }
    } catch (err) {
      console.error('Accountant home fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinanceData();
  }, []);

  return (
    <PullToRefresh onRefresh={fetchFinanceData}>
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: 'var(--color-navy)' }}>
              Finance & Accounts
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              Welcome back, {user?.name || 'Accountant'}
            </p>
          </div>
          <Badge variant="primary" label="Accountant" />
        </div>

        {loading ? (
          <LoadingState message="Loading financial overview..." />
        ) : (
          <>
            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              <Card>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: '600' }}>
                  Total Collected
                </div>
                <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--color-success)', marginTop: '6px' }}>
                  ₹{(summary?.total_collected || summary?.total_paid || 0).toLocaleString()}
                </div>
              </Card>

              <Card>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: '600' }}>
                  Pending Dues
                </div>
                <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--color-error)', marginTop: '6px' }}>
                  ₹{(summary?.total_pending || summary?.total_due || 0).toLocaleString()}
                </div>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card>
              <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: '700', color: 'var(--color-navy)' }}>
                Quick Actions
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                <Button variant="outline" size="small" onClick={() => alert('Search student fee ledger')}>
                  Collect Fee
                </Button>
                <Button variant="outline" size="small" onClick={() => alert('Generate fee receipt')}>
                  Receipts
                </Button>
                <Button variant="outline" size="small" onClick={() => alert('Fee structures')}>
                  Fee Structures
                </Button>
                <Button variant="outline" size="small" onClick={() => alert('Export report')}>
                  Ledger Report
                </Button>
              </div>
            </Card>

            {/* Recent Payments */}
            <Card>
              <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: '700', color: 'var(--color-navy)' }}>
                Recent Collections
              </h3>
              {recentTransactions.length === 0 ? (
                <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', textAlign: 'center', padding: '16px 0' }}>
                  No recent payment records found.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {recentTransactions.map((tx, idx) => (
                    <div
                      key={tx.id || idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 0',
                        borderBottom: idx < recentTransactions.length - 1 ? '1px solid var(--color-border)' : 'none',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '13px', color: 'var(--color-navy)' }}>
                          {tx.student_name || tx.student_id || 'Student Collection'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                          {tx.date || tx.created_at || 'Today'} • {tx.payment_mode || 'Cash'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--color-success)' }}>
                          +₹{(tx.amount || 0).toLocaleString()}
                        </div>
                        <Badge
                          variant={tx.status === 'PAID' ? 'success' : 'warning'}
                          label={tx.status || 'PAID'}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </PullToRefresh>
  );
}
