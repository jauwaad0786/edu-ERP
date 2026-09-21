import React, { useState, useEffect } from 'react';
import { colors } from '../../theme/colors';
import { studentService } from '../../api/services/studentService';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import PullToRefresh from '../../components/common/PullToRefresh';

export default function StudentProfileScreen() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProfile = async () => {
    try {
      setError(null);
      const data = await studentService.getProfile();
      setProfile(data);
    } catch (err) {
      setError(err.readableMessage || 'Failed to load profile details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchProfile();
  };

  if (loading) return <LoadingState message="Fetching student records..." />;
  if (error && !profile) return <ErrorState message={error} onRetry={fetchProfile} />;

  return (
    <PullToRefresh onRefresh={handleRefresh} refreshing={refreshing}>
      <div style={{ padding: '16px' }}>
        {/* Profile Card Header */}
        <Card padding="20px">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '14px' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '18px',
              background: `linear-gradient(135deg, ${colors.primary}, #38bdf8)`,
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '26px',
              fontWeight: 900,
            }}>
              {(profile?.name || 'S').charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: colors.neutral10, margin: '0 0 4px' }}>
                {profile?.name || 'Student Profile'}
              </h2>
              <Badge variant="success">Active Enrollment</Badge>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', borderTop: `1px solid ${colors.border}`, paddingTop: '12px', fontSize: '12px', color: '#64748b' }}>
            <span><strong>Roll No:</strong> {profile?.roll_no || '—'}</span>
            <span><strong>Admission No:</strong> {profile?.admission_no || profile?.reg_no || '—'}</span>
          </div>
        </Card>

        {/* Academic Details */}
        <Card padding="16px">
          <h3 style={{ fontSize: '14px', fontWeight: 800, color: colors.neutral10, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="ti ti-school" style={{ color: colors.primary }} /> Academic Information
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${colors.divider}`, paddingBottom: '6px' }}>
              <span style={{ color: colors.neutral6 }}>Class &amp; Section</span>
              <strong style={{ color: colors.neutral10 }}>{profile?.class_display || profile?.class_name || '—'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${colors.divider}`, paddingBottom: '6px' }}>
              <span style={{ color: colors.neutral6 }}>Academic Session</span>
              <strong style={{ color: colors.neutral10 }}>{profile?.session || '2025-2026'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: colors.neutral6 }}>Enrollment Status</span>
              <span style={{ color: colors.success, fontWeight: 700 }}>{profile?.status || 'ACTIVE'}</span>
            </div>
          </div>
        </Card>

        {/* Personal Details */}
        <Card padding="16px">
          <h3 style={{ fontSize: '14px', fontWeight: 800, color: colors.neutral10, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="ti ti-id" style={{ color: colors.primary }} /> Personal Information
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${colors.divider}`, paddingBottom: '6px' }}>
              <span style={{ color: colors.neutral6 }}>Date of Birth</span>
              <strong style={{ color: colors.neutral10 }}>{profile?.dob || '—'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${colors.divider}`, paddingBottom: '6px' }}>
              <span style={{ color: colors.neutral6 }}>Gender</span>
              <strong style={{ color: colors.neutral10 }}>{profile?.gender || '—'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${colors.divider}`, paddingBottom: '6px' }}>
              <span style={{ color: colors.neutral6 }}>Blood Group</span>
              <strong style={{ color: colors.neutral10 }}>{profile?.blood_group || '—'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: colors.neutral6 }}>Category</span>
              <strong style={{ color: colors.neutral10 }}>{profile?.category || 'General'}</strong>
            </div>
          </div>
        </Card>

        {/* Parent & Contact */}
        <Card padding="16px">
          <h3 style={{ fontSize: '14px', fontWeight: 800, color: colors.neutral10, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="ti ti-users" style={{ color: colors.primary }} /> Parent &amp; Contact Information
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${colors.divider}`, paddingBottom: '6px' }}>
              <span style={{ color: colors.neutral6 }}>Father / Guardian</span>
              <strong style={{ color: colors.neutral10 }}>{profile?.parent_name || profile?.father_name || '—'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${colors.divider}`, paddingBottom: '6px' }}>
              <span style={{ color: colors.neutral6 }}>Mother's Name</span>
              <strong style={{ color: colors.neutral10 }}>{profile?.mother_name || '—'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${colors.divider}`, paddingBottom: '6px' }}>
              <span style={{ color: colors.neutral6 }}>Contact Mobile</span>
              <strong style={{ color: colors.neutral10 }}>{profile?.parent_phone || profile?.phone || '—'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: colors.neutral6 }}>Residential Address</span>
              <span style={{ color: colors.neutral10, fontWeight: 600, textAlign: 'right', maxWidth: '180px' }}>
                {profile?.address || '—'}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </PullToRefresh>
  );
}
