import React, { useState, useEffect } from 'react';
import { colors } from '../../theme/colors';
import { studentService } from '../../api/services/studentService';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import PullToRefresh from '../../components/common/PullToRefresh';

export default function StudentHomeScreen({ onNavigateTab }) {
  const [data, setData] = useState({
    profile: null,
    attendance: null,
    marks: [],
    fees: null,
    notes: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = async () => {
    try {
      setError(null);
      const [profile, attendance, marks, fees, notes] = await Promise.all([
        studentService.getProfile().catch(() => null),
        studentService.getAttendance().catch(() => null),
        studentService.getMarks().catch(() => []),
        studentService.getFees().catch(() => null),
        studentService.getStudyNotes().catch(() => []),
      ]);

      setData({
        profile,
        attendance,
        marks: Array.isArray(marks) ? marks : [],
        fees,
        notes: Array.isArray(notes) ? notes : [],
      });
    } catch (err) {
      setError(err.readableMessage || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
  };

  if (loading) return <LoadingState message="Fetching live student dashboard..." />;
  if (error && !data.profile) return <ErrorState message={error} onRetry={fetchAll} />;

  const { profile, attendance, marks, fees, notes } = data;
  const attendancePct = attendance?.percentage ?? (attendance?.total_days > 0 ? Math.round((attendance.present / attendance.total_days) * 100) : 0);
  const balanceDue = Number(fees?.balance ?? fees?.outstanding ?? 0);
  const totalPaid = Number(fees?.total_paid ?? 0);

  return (
    <PullToRefresh onRefresh={handleRefresh} refreshing={refreshing}>
      <div style={{ padding: '16px' }}>
        {/* Student Welcome Banner */}
        <div style={{
          background: `linear-gradient(135deg, ${colors.primaryDark}, ${colors.primary})`,
          borderRadius: '20px',
          padding: '20px',
          color: '#ffffff',
          marginBottom: '16px',
          boxShadow: '0 4px 14px rgba(1,118,211,0.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.85 }}>
                Student Portal
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 900, margin: '4px 0 2px' }}>
                {profile?.name || 'Student'}
              </h2>
              <div style={{ fontSize: '12.5px', opacity: 0.9 }}>
                Class: {profile?.class_display || profile?.class_name || 'Enrolled'} • Roll #{profile?.roll_no || '—'}
              </div>
            </div>

            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '16px',
              background: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              fontWeight: 900,
            }}>
              {(profile?.name || 'S').charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        {/* Quick KPI Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <Card padding="14px" onClick={() => onNavigateTab('attendance')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <i className="ti ti-clipboard-check" style={{ color: colors.success, fontSize: '20px' }} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: colors.neutral6 }}>Attendance</span>
            </div>
            <div style={{ fontSize: '22px', fontWeight: 900, color: colors.neutral10 }}>
              {attendancePct}%
            </div>
            <div style={{ fontSize: '11px', color: attendancePct >= 75 ? colors.success : colors.error, fontWeight: 700, marginTop: '2px' }}>
              {attendancePct >= 75 ? 'Above Threshold' : 'Attention Needed'}
            </div>
          </Card>

          <Card padding="14px" onClick={() => onNavigateTab('fees')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <i className="ti ti-receipt-2" style={{ color: balanceDue > 0 ? colors.error : colors.success, fontSize: '20px' }} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: colors.neutral6 }}>Fee Due</span>
            </div>
            <div style={{ fontSize: '22px', fontWeight: 900, color: balanceDue > 0 ? colors.error : colors.success }}>
              ₹{balanceDue.toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, marginTop: '2px' }}>
              Paid: ₹{totalPaid.toLocaleString('en-IN')}
            </div>
          </Card>
        </div>

        {/* Academic Performance Preview */}
        <Card padding="16px">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="ti ti-award" style={{ color: colors.primary, fontSize: '20px' }} />
              <h3 style={{ fontSize: '14.5px', fontWeight: 800, color: colors.neutral10, margin: 0 }}>
                Academic Assessments
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('marks')}
              style={{ background: 'none', border: 'none', color: colors.primary, fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}
            >
              Report Card →
            </button>
          </div>

          {marks.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {marks.slice(0, 3).map((ex, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: colors.neutral1,
                  borderRadius: '12px',
                }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: colors.neutral10 }}>
                      {ex.exam_name || 'Term Exam'}
                    </div>
                    <div style={{ fontSize: '11px', color: colors.neutral6 }}>
                      Total: {ex.total_obtained ?? '—'} / {ex.total_max ?? '—'}
                    </div>
                  </div>
                  <Badge variant={ex.percentage >= 75 ? 'success' : 'info'}>
                    {ex.percentage}% {ex.grade ? `(${ex.grade})` : ''}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '16px 8px', color: '#94a3b8', fontSize: '12.5px' }}>
              No examination marks published yet
            </div>
          )}
        </Card>

        {/* Study Materials Preview */}
        <Card padding="16px">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="ti ti-file-text" style={{ color: colors.primary, fontSize: '20px' }} />
              <h3 style={{ fontSize: '14.5px', fontWeight: 800, color: colors.neutral10, margin: 0 }}>
                Recent Study Material
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('notes')}
              style={{ background: 'none', border: 'none', color: colors.primary, fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}
            >
              View All →
            </button>
          </div>

          {notes.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {notes.slice(0, 3).map((n) => (
                <div key={n.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  background: colors.neutral1,
                  borderRadius: '12px',
                }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: colors.errorBg,
                    color: colors.error,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    flexShrink: 0,
                  }}>
                    <i className="ti ti-file-text" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: colors.neutral10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {n.title}
                    </div>
                    <div style={{ fontSize: '11px', color: colors.neutral6 }}>
                      {n.file_name || 'Document'}
                    </div>
                  </div>
                  {n.file_url && (
                    <a
                      href={n.file_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        padding: '4px 10px',
                        background: colors.primary,
                        color: '#fff',
                        borderRadius: '8px',
                        fontSize: '11px',
                        fontWeight: 700,
                        textDecoration: 'none',
                      }}
                    >
                      Open
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '16px 8px', color: '#94a3b8', fontSize: '12.5px' }}>
              No study notes uploaded for your class yet
            </div>
          )}
        </Card>
      </div>
    </PullToRefresh>
  );
}
