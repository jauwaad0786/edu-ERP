import React, { useState, useEffect } from 'react';
import { colors } from '../../theme/colors';
import { teacherService } from '../../api/services/teacherService';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';

export default function TeacherAttendanceScreen() {
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState([]);
  const [attendanceMap, setAttendanceMap] = useState({});
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

    teacherService.getAttendance(selectedClass, selectedDate)
      .then((data) => {
        const stds = data?.students || data || [];
        setStudents(Array.isArray(stds) ? stds : []);
        
        // Populate initial attendance state
        const initialMap = {};
        (Array.isArray(stds) ? stds : []).forEach((s) => {
          initialMap[s.id] = s.status || 'PRESENT';
        });
        setAttendanceMap(initialMap);
      })
      .catch((err) => setError(err.readableMessage || 'Failed to load student roster'))
      .finally(() => setLoadingClass(false));
  }, [selectedClass, selectedDate]);

  const toggleStatus = (studentId, status) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: status,
    }));
  };

  const handleSave = async () => {
    if (!selectedClass) return;
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    const payloadList = Object.entries(attendanceMap).map(([studentId, status]) => ({
      student_id: Number(studentId),
      status,
    }));

    try {
      await teacherService.saveAttendance(selectedClass, selectedDate, payloadList);
      setSuccessMsg('Attendance successfully saved to school records!');
    } catch (err) {
      setError(err.readableMessage || 'Failed to save attendance records.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState message="Fetching assigned classes..." />;

  return (
    <div style={{ padding: '16px' }}>
      {/* Controls Card */}
      <Card padding="16px">
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px', marginBottom: '8px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>
              Select Class
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
              Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
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
            />
          </div>
        </div>
      </Card>

      {successMsg && (
        <div style={{ padding: '10px 14px', background: colors.successBg, color: colors.success, borderRadius: '12px', fontSize: '12.5px', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <i className="ti ti-circle-check" /> {successMsg}
        </div>
      )}

      {error && <ErrorState message={error} />}

      {/* Student Roster */}
      <h3 style={{ fontSize: '15px', fontWeight: 800, color: colors.neutral10, margin: '14px 0 10px' }}>
        Student Roster ({students.length})
      </h3>

      {loadingClass ? (
        <LoadingState message="Loading class roster..." />
      ) : students.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '70px' }}>
          {students.map((s, idx) => {
            const currentStatus = attendanceMap[s.id] || 'PRESENT';

            return (
              <Card key={s.id || idx} padding="12px 14px" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: colors.neutral10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.name || `Student #${s.id}`}
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                      Roll #{s.roll_no || idx + 1}
                    </div>
                  </div>

                  {/* Attendance Toggle Buttons */}
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {['PRESENT', 'ABSENT', 'LATE'].map((st) => {
                      const isCurrent = currentStatus === st;
                      const getBg = () => {
                        if (!isCurrent) return colors.neutral1;
                        if (st === 'PRESENT') return colors.success;
                        if (st === 'ABSENT') return colors.error;
                        return colors.warning;
                      };

                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => toggleStatus(s.id, st)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '8px',
                            background: getBg(),
                            color: isCurrent ? '#fff' : colors.neutral9,
                            fontSize: '11px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {st.charAt(0)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </Card>
            );
          })}

          {/* Sticky Bottom Save Action */}
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
              icon="ti-device-floppy"
              onClick={handleSave}
            >
              Save Daily Attendance
            </Button>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '36px 16px', color: '#94a3b8', fontSize: '13px' }}>
          No students found enrolled in this class.
        </div>
      )}
    </div>
  );
}
