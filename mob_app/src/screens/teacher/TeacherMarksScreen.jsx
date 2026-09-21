import React, { useState, useEffect } from 'react';
import { colors } from '../../theme/colors';
import { teacherService } from '../../api/services/teacherService';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';

export default function TeacherMarksScreen() {
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [examType, setExamType] = useState('MID_TERM');
  const [students, setStudents] = useState([]);
  const [marksMap, setMarksMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingClass, setLoadingClass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    teacherService.getClasses()
      .then((cls) => {
        const list = Array.isArray(cls) ? cls : [];
        setClasses(list);
        if (list.length > 0) {
          setSelectedClass(String(list[0].id));
        }
      })
      .catch((err) => setError(err.readableMessage || 'Failed to load classes'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedClass) return;
    setLoadingClass(true);
    setError(null);
    setSuccessMsg(null);

    teacherService.getMarks(selectedClass, examType)
      .then((data) => {
        const stds = data?.students || (Array.isArray(data) ? data : []);
        setStudents(stds);
        const map = {};
        stds.forEach((s) => {
          map[s.id] = s.marks_obtained !== undefined ? String(s.marks_obtained) : '';
        });
        setMarksMap(map);
      })
      .catch((err) => setError(err.readableMessage || 'Failed to load student list'))
      .finally(() => setLoadingClass(false));
  }, [selectedClass, examType]);

  const handleScoreChange = (studentId, val) => {
    setMarksMap((prev) => ({
      ...prev,
      [studentId]: val,
    }));
  };

  const handleSave = async () => {
    if (!selectedClass) return;
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    const payloadList = Object.entries(marksMap).map(([studentId, score]) => ({
      student_id: Number(studentId),
      marks_obtained: score === '' ? 0 : Number(score),
    }));

    try {
      await teacherService.saveMarks(selectedClass, examType, null, payloadList);
      setSuccessMsg('Academic marks successfully submitted to gradebook!');
    } catch (err) {
      setError(err.readableMessage || 'Failed to save marks.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState message="Fetching assigned classes..." />;

  return (
    <div style={{ padding: '16px' }}>
      <Card padding="16px">
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px', marginBottom: '6px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>
              Class
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              style={{
                width: '100%',
                height: '42px',
                borderRadius: '10px',
                border: `1.5px solid ${colors.border}`,
                padding: '0 10px',
                fontSize: '13px',
                fontWeight: 700,
                color: colors.neutral10,
                background: '#fff',
              }}
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.section ? `(${c.section})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>
              Assessment
            </label>
            <select
              value={examType}
              onChange={(e) => setExamType(e.target.value)}
              style={{
                width: '100%',
                height: '42px',
                borderRadius: '10px',
                border: `1.5px solid ${colors.border}`,
                padding: '0 10px',
                fontSize: '13px',
                fontWeight: 700,
                color: colors.neutral10,
                background: '#fff',
              }}
            >
              <option value="MID_TERM">Mid Term</option>
              <option value="FINAL">Final Exam</option>
              <option value="UNIT_TEST">Unit Test</option>
              <option value="INTERNAL">Internal</option>
            </select>
          </div>
        </div>
      </Card>

      {successMsg && (
        <div style={{ padding: '10px 14px', background: colors.successBg, color: colors.success, borderRadius: '12px', fontSize: '12.5px', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <i className="ti ti-circle-check" /> {successMsg}
        </div>
      )}

      {error && <ErrorState message={error} />}

      <h3 style={{ fontSize: '15px', fontWeight: 800, color: colors.neutral10, margin: '14px 0 10px' }}>
        Grading Sheet ({students.length} students)
      </h3>

      {loadingClass ? (
        <LoadingState message="Loading grading sheet..." />
      ) : students.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '70px' }}>
          {students.map((s, idx) => (
            <Card key={s.id || idx} padding="12px 14px" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: colors.neutral10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.name || `Student #${s.id}`}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                    Roll #{s.roll_no || idx + 1}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Score"
                    value={marksMap[s.id] ?? ''}
                    onChange={(e) => handleScoreChange(s.id, e.target.value)}
                    style={{
                      width: '74px',
                      height: '38px',
                      borderRadius: '8px',
                      border: `1.5px solid ${colors.border}`,
                      textAlign: 'center',
                      fontSize: '14px',
                      fontWeight: 800,
                      color: colors.primary,
                      background: '#ffffff',
                    }}
                  />
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>/ 100</span>
                </div>
              </div>
            </Card>
          ))}

          <div style={{
            position: 'fixed',
            bottom: '68px',
            left: '16px',
            right: '16px',
            zIndex: 30,
          }}>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={saving}
              icon="ti-check"
              onClick={handleSave}
            >
              Submit Marks to Gradebook
            </Button>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '36px 16px', color: '#94a3b8', fontSize: '13px' }}>
          No enrolled students found for grading in this class.
        </div>
      )}
    </div>
  );
}
