import React, { useState } from 'react';
import { colors } from '../../theme/colors';
import { superAdminService } from '../../api/services/superAdminService';
import Card from '../../components/common/Card';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import ErrorState from '../../components/common/ErrorState';

export default function OnboardSchoolScreen({ onSuccess }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [city, setCity] = useState('');
  const [principalEmail, setPrincipalEmail] = useState('');
  const [principalPassword, setPrincipalPassword] = useState('School@123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!name.trim() || !code.trim() || !principalEmail.trim()) {
      setError('Please provide school name, code, and principal email.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await superAdminService.onboardSchool({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        city: city.trim(),
        principal_email: principalEmail.trim(),
        principal_password: principalPassword,
      });
      setSuccess(true);
    } catch (err) {
      setError(err.readableMessage || 'Failed to onboard school.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{ padding: '24px 16px', textAlign: 'center' }}>
        <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: colors.successBg, color: colors.success, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '30px', margin: '0 auto 16px' }}>
          <i className="ti ti-check" />
        </div>
        <h3 style={{ fontSize: '18px', fontWeight: 800, color: colors.neutral10, margin: '0 0 6px' }}>
          School Onboarded Successfully!
        </h3>
        <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>
          The new school tenant and principal credentials have been generated and committed.
        </p>
        <Button variant="primary" onClick={onSuccess}>
          Back to Schools
        </Button>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px' }}>
      <Card padding="18px">
        <h3 style={{ fontSize: '16px', fontWeight: 800, color: colors.neutral10, marginBottom: '14px' }}>
          Onboard New School Campus
        </h3>

        {error && <ErrorState message={error} />}

        <form onSubmit={handleSubmit}>
          <Input
            label="School Name"
            placeholder="e.g. Cambridge International Academy"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Input
            label="School Code (Short ID)"
            placeholder="e.g. CIA01"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />

          <Input
            label="City / Location"
            placeholder="e.g. Mumbai, New Delhi"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />

          <Input
            label="Principal Admin Email"
            type="email"
            placeholder="principal@school.edu"
            value={principalEmail}
            onChange={(e) => setPrincipalEmail(e.target.value)}
            required
          />

          <Input
            label="Initial Password"
            type="password"
            placeholder="Default password"
            value={principalPassword}
            onChange={(e) => setPrincipalPassword(e.target.value)}
            required
          />

          <div style={{ marginTop: '16px' }}>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
              icon="ti-building-plus"
            >
              Provision School Tenant
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
