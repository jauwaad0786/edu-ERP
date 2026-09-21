import React, { useState, useEffect } from 'react';
import { colors } from '../../theme/colors';
import { useAuth } from '../../auth/AuthContext';
import { teacherService } from '../../api/services/teacherService';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import PullToRefresh from '../../components/common/PullToRefresh';

export default function TeacherHomeScreen({ onNavigateTab }) {
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTeacherData = async () => {
    try {
      setError(null);
      const cls = await teacherService.getClasses();
      setClasses(Array.isArray(cls) ? cls : []);
    } catch (err) {
      setError(err.readableMessage || 'Failed to load assigned classes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTeacherData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchTeacherData();
  };

  if (loading) return <LoadingState message="Fetching teaching assignments..." />;
  if (error && classes.length === 0) return <ErrorState message={error} onRetry={fetchTeacherData} />;

  return (
    <PullToRefresh onRefresh={handleRefresh} refreshing={refreshing}>
      <div style={{ padding: '16px' }}>
        {/* Teacher Welcome Header */}
        <div style={{
          background: `linear-gradient(135deg, ${colors.primaryDark}, ${colors.primary})`,
          borderRadius: '20px',
          padding: '20px',
          color: '#ffffff',
          marginBottom: '16px',
        }}>
          <div style={{ fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.85 }}>
            Faculty &amp; Teaching Portal
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 900, margin: '4px 0 2px' }}>
            {user?.name || 'Teacher'}
          </h2>
          <div style={{ fontSize: '12.5px', opacity: 0.9 }}>
            {classes.length} Assigned Class{classes.length === 1 ? '' : 'es'}
          </div>
        </div>

        {/* Quick Operations Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <Card padding="14px" onClick={() => onNavigateTab('attendance')}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: colors.successBg, color: colors.success, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', marginBottom: '8px' }}>
              <i className="ti ti-clipboard-check" />
            </div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: colors.neutral10 }}>
              Mark Attendance
            </div>
            <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
              Daily student presence
            </div>
          </Card>

          <Card padding="14px" onClick={() => onNavigateTab('marks')}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: colors.primaryLight, color: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', marginBottom: '8px' }}>
              <i className="ti ti-award" />
            </div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: colors.neutral10 }}>
              Grade Assessments
            </div>
            <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
              Enter exam marks
            </div>
          </Card>
        </div>

        {/* Assigned Classes */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 800, color: colors.neutral10, margin: 0 }}>
            My Assigned Classes ({classes.length})
          </h3>
        </div>

        {classes.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {classes.map((c) => (
              <Card key={c.id} padding="14px">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h4 style={{ fontSize: '15px', fontWeight: 800, color: colors.neutral10, margin: '0 0 2px' }}>
                      {c.name || `Class ${c.id}`} {c.section ? `- ${c.section}` : ''}
                    </h4>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      Enrolled: {c.student_count || 0} Students
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    icon="ti-arrow-right"
                    onClick={() => onNavigateTab('attendance')}
                  >
                    Action
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '30px 16px', color: '#94a3b8', fontSize: '13px' }}>
            No class allocations found for your profile. Contact the Academic Coordinator.
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}
