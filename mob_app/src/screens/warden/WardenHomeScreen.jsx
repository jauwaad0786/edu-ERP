import React, { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthContext';
import hostelService from '../../api/services/hostelService';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import LoadingState from '../../components/common/LoadingState';
import PullToRefresh from '../../components/common/PullToRefresh';

export default function WardenHomeScreen({ onNavigate }) {
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHostelData = async () => {
    setLoading(true);
    try {
      const [roomsRes, allocRes] = await Promise.allSettled([
        hostelService.getRooms(),
        hostelService.getAllocations(),
      ]);

      if (roomsRes.status === 'fulfilled') {
        const d = roomsRes.value.data || roomsRes.value;
        setRooms(Array.isArray(d) ? d : d.rooms || []);
      }
      if (allocRes.status === 'fulfilled') {
        const d = allocRes.value.data || allocRes.value;
        setAllocations(Array.isArray(d) ? d : d.allocations || []);
      }
    } catch (err) {
      console.error('Hostel fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHostelData();
  }, []);

  return (
    <PullToRefresh onRefresh={fetchHostelData}>
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: 'var(--color-navy)' }}>
              Hostel Administration
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              Warden Portal ({user?.name || 'Warden'})
            </p>
          </div>
          <Badge variant="primary" label="Hostel Warden" />
        </div>

        {/* Quick Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
          <Card>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: '600' }}>
              Total Rooms
            </div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--color-navy)', marginTop: '4px' }}>
              {rooms.length}
            </div>
          </Card>
          <Card>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: '600' }}>
              Allocated Students
            </div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--color-primary)', marginTop: '4px' }}>
              {allocations.length}
            </div>
          </Card>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="primary" size="small" fullWidth onClick={() => alert('New Room Allocation')}>
            Allocate Room
          </Button>
          <Button variant="outline" size="small" fullWidth onClick={() => alert('Night Attendance Routine')}>
            Night Roll Call
          </Button>
        </div>

        {loading ? (
          <LoadingState message="Loading hostel records..." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: 'var(--color-navy)' }}>
              Room Allocations & Status
            </h3>
            {rooms.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', textAlign: 'center', padding: '20px' }}>
                No hostel room records found.
              </div>
            ) : (
              rooms.map((room, idx) => (
                <Card key={room.id || idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--color-navy)' }}>
                        Room {room.room_number || room.name || `#${idx + 1}`}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                        Block {room.block || 'A'} • Capacity: {room.capacity || 2} beds
                      </div>
                    </div>
                    <Badge
                      variant={room.occupied_beds >= room.capacity ? 'error' : 'success'}
                      label={room.occupied_beds >= room.capacity ? 'Full' : 'Available'}
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
