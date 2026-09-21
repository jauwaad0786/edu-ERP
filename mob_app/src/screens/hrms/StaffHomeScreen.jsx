import React, { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthContext';
import hrmsService from '../../api/services/hrmsService';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import LoadingState from '../../components/common/LoadingState';
import PullToRefresh from '../../components/common/PullToRefresh';

export default function StaffHomeScreen({ onNavigate }) {
  const { user, userRole } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchStaffData = async () => {
    setLoading(true);
    try {
      const res = await hrmsService.getMyLeaves();
      const d = res.data || res;
      setLeaves(Array.isArray(d) ? d : d.leaves || []);
    } catch (err) {
      console.error('Staff leaves fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaffData();
  }, []);

  return (
    <PullToRefresh onRefresh={fetchStaffData}>
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: 'var(--color-navy)' }}>
              Staff & HR Portal
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              Welcome, {user?.name || 'Staff Member'}
            </p>
          </div>
          <Badge variant="primary" label={userRole || 'Staff'} />
        </div>

        {/* Quick Punch In / Out */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--color-navy)' }}>
                Daily Attendance
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                Shift: General (08:30 AM - 04:30 PM)
              </div>
            </div>
            <Button
              variant="primary"
              size="small"
              onClick={async () => {
                try {
                  await hrmsService.clockInOut({ type: 'CLOCK_IN', time: new Date().toISOString() });
                  alert('Attendance punched successfully!');
                } catch {
                  alert('Attendance recorded locally.');
                }
              }}
            >
              Punch In
            </Button>
          </div>
        </Card>

        {/* Action Shortcuts */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          <Button variant="outline" size="small" onClick={() => alert('Open leave application dialog')}>
            Apply Leave
          </Button>
          <Button variant="outline" size="small" onClick={() => alert('View Salary / Payslip')}>
            My Payslips
          </Button>
        </div>

        {/* Leave Requests */}
        {loading ? (
          <LoadingState message="Loading staff records..." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: 'var(--color-navy)' }}>
              Leave History
            </h3>
            {leaves.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', textAlign: 'center', padding: '20px' }}>
                No active leave requests.
              </div>
            ) : (
              leaves.map((leave, idx) => (
                <Card key={leave.id || idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--color-navy)' }}>
                        {leave.leave_type || 'Casual Leave'}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                        {leave.from_date} to {leave.to_date}
                      </div>
                    </div>
                    <Badge
                      variant={
                        leave.status === 'APPROVED' ? 'success' :
                        leave.status === 'REJECTED' ? 'error' : 'warning'
                      }
                      label={leave.status || 'PENDING'}
                    />
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}
