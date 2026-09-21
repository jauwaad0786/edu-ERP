import React, { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthContext';
import transportService from '../../api/services/transportService';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import LoadingState from '../../components/common/LoadingState';
import PullToRefresh from '../../components/common/PullToRefresh';

export default function TransportHomeScreen({ onNavigate }) {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTransportData = async () => {
    setLoading(true);
    try {
      const [vRes, rRes] = await Promise.allSettled([
        transportService.getVehicles(),
        transportService.getRoutes(),
      ]);

      if (vRes.status === 'fulfilled') {
        const d = vRes.value.data || vRes.value;
        setVehicles(Array.isArray(d) ? d : d.vehicles || []);
      }
      if (rRes.status === 'fulfilled') {
        const d = rRes.value.data || rRes.value;
        setRoutes(Array.isArray(d) ? d : d.routes || []);
      }
    } catch (err) {
      console.error('Transport fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransportData();
  }, []);

  return (
    <PullToRefresh onRefresh={fetchTransportData}>
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: 'var(--color-navy)' }}>
              Fleet & Transport
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              Routes & Vehicles ({user?.name || 'Transport Mgr'})
            </p>
          </div>
          <Badge variant="primary" label="Transport" />
        </div>

        {/* Quick Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
          <Card>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: '600' }}>
              Active Vehicles
            </div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--color-navy)', marginTop: '4px' }}>
              {vehicles.length}
            </div>
          </Card>
          <Card>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: '600' }}>
              Designated Routes
            </div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--color-primary)', marginTop: '4px' }}>
              {routes.length}
            </div>
          </Card>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="primary" size="small" fullWidth onClick={() => alert('Start Trip / GPS Tracking')}>
            Start Trip (GPS)
          </Button>
          <Button variant="outline" size="small" fullWidth onClick={() => alert('Student Bus Pass Check')}>
            Check Bus Pass
          </Button>
        </div>

        {loading ? (
          <LoadingState message="Fetching fleet info..." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: 'var(--color-navy)' }}>
              Vehicle Fleet
            </h3>
            {vehicles.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', textAlign: 'center', padding: '20px' }}>
                No registered transport vehicles.
              </div>
            ) : (
              vehicles.map((v, idx) => (
                <Card key={v.id || idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--color-navy)' }}>
                        {v.vehicle_number || v.reg_no || `Bus #${idx + 1}`}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                        Driver: {v.driver_name || 'Assigned Driver'} • Cap: {v.capacity || 40} seats
                      </div>
                    </div>
                    <Badge variant="success" label="Active" />
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
