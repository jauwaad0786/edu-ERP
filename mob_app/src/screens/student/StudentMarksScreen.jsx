import React, { useState, useEffect } from 'react';
import { colors } from '../../theme/colors';
import { studentService } from '../../api/services/studentService';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import PullToRefresh from '../../components/common/PullToRefresh';

export default function StudentMarksScreen() {
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState(null);
  const [reportCard, setReportCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOverview = async () => {
    try {
      setError(null);
      const data = await studentService.getMarks();
      const list = Array.isArray(data) ? data : [];
      setExams(list);
      if (list.length > 0) {
        const firstId = list[0].exam_id;
        setSelectedExamId(firstId);
        await fetchExamReport(firstId);
      }
    } catch (err) {
      setError(err.readableMessage || 'Failed to load examination scores');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchExamReport = async (examId) => {
    setLoadingDetails(true);
    try {
      const data = await studentService.getMarks(examId);
      setReportCard(data);
    } catch (e) {
      // keep existing
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const handleSelectExam = (examId) => {
    setSelectedExamId(examId);
    fetchExamReport(examId);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchOverview();
  };

  if (loading) return <LoadingState message="Fetching academic scores..." />;
  if (error && exams.length === 0) return <ErrorState message={error} onRetry={fetchOverview} />;

  const subjects = reportCard?.subjects || [];
  const totalObtained = reportCard?.total_obtained ?? '—';
  const totalMax = reportCard?.total_max ?? '—';
  const percentage = reportCard?.percentage ?? 0;
  const grade = reportCard?.grade || '—';
  const result = reportCard?.result || (percentage >= 33 ? 'PASS' : 'FAIL');

  return (
    <PullToRefresh onRefresh={handleRefresh} refreshing={refreshing}>
      <div style={{ padding: '16px' }}>
        {/* Exam Selector Pill Bar */}
        {exams.length > 0 && (
          <div style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '12px',
            marginBottom: '10px',
            scrollbarWidth: 'none',
          }}>
            {exams.map((ex) => {
              const isSelected = selectedExamId === ex.exam_id;
              return (
                <button
                  key={ex.exam_id}
                  type="button"
                  onClick={() => handleSelectExam(ex.exam_id)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '20px',
                    background: isSelected ? colors.primary : '#ffffff',
                    color: isSelected ? '#ffffff' : colors.neutral9,
                    border: `1px solid ${isSelected ? colors.primary : colors.border}`,
                    fontSize: '12px',
                    fontWeight: 800,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    boxShadow: isSelected ? '0 2px 6px rgba(1,118,211,0.25)' : 'none',
                  }}
                >
                  {ex.exam_name} ({ex.percentage}%)
                </button>
              );
            })}
          </div>
        )}

        {/* Selected Exam KPI Summary */}
        {reportCard && (
          <Card padding="18px">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: colors.neutral10, margin: 0 }}>
                  {reportCard?.exam?.name || 'Assessment Report'}
                </h3>
                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                  Official Evaluated Scorecard
                </div>
              </div>
              <Badge variant={result.toUpperCase() === 'PASS' ? 'success' : 'error'} size="md">
                {result}
              </Badge>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', textAlign: 'center' }}>
              <div style={{ padding: '10px 6px', background: colors.neutral1, borderRadius: '12px' }}>
                <div style={{ fontSize: '11px', color: colors.neutral6, fontWeight: 700 }}>Total Marks</div>
                <div style={{ fontSize: '16px', fontWeight: 900, color: colors.neutral10, marginTop: '2px' }}>
                  {totalObtained} / {totalMax}
                </div>
              </div>

              <div style={{ padding: '10px 6px', background: colors.primaryLight, borderRadius: '12px' }}>
                <div style={{ fontSize: '11px', color: colors.primaryDark, fontWeight: 700 }}>Percentage</div>
                <div style={{ fontSize: '16px', fontWeight: 900, color: colors.primary, marginTop: '2px' }}>
                  {percentage}%
                </div>
              </div>

              <div style={{ padding: '10px 6px', background: colors.successBg, borderRadius: '12px' }}>
                <div style={{ fontSize: '11px', color: colors.success, fontWeight: 700 }}>Final Grade</div>
                <div style={{ fontSize: '16px', fontWeight: 900, color: colors.success, marginTop: '2px' }}>
                  {grade}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Subjects List */}
        <h3 style={{ fontSize: '15px', fontWeight: 800, color: colors.neutral10, margin: '14px 0 10px' }}>
          Subject Breakdown
        </h3>

        {loadingDetails ? (
          <LoadingState message="Loading subject marks..." />
        ) : subjects.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {subjects.map((s, idx) => {
              const pct = s.max_marks > 0 ? Math.round((s.marks_obtained / s.max_marks) * 100) : 0;
              const isPassed = !s.is_absent && pct >= 33;

              return (
                <Card key={s.subject_id || idx} padding="14px">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div>
                      <strong style={{ fontSize: '14px', color: colors.neutral10 }}>
                        {s.subject_name || `Subject ${s.subject_id}`}
                      </strong>
                      <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '1px' }}>
                        {s.is_absent ? (
                          <span style={{ color: colors.error, fontWeight: 700 }}>Marked Absent</span>
                        ) : (
                          `${s.marks_obtained} out of ${s.max_marks} marks`
                        )}
                      </div>
                    </div>
                    <Badge variant={isPassed ? 'success' : 'error'}>
                      {s.grade || (isPassed ? 'PASS' : 'FAIL')}
                    </Badge>
                  </div>

                  <div style={{ height: '6px', borderRadius: '3px', background: colors.neutral2, overflow: 'hidden' }}>
                    <div style={{
                      width: `${s.is_absent ? 0 : pct}%`,
                      height: '100%',
                      background: pct >= 80 ? colors.success : pct >= 50 ? colors.primary : colors.error,
                      borderRadius: '3px',
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '30px 16px', color: '#94a3b8', fontSize: '13px' }}>
            No subject marks published for this exam.
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}
