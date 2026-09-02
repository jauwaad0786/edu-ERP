import { useState } from 'react';

const classData = [
  { cls: 'Class 1', students: 42, feesCollected: 210000, feesPending: 42000 },
  { cls: 'Class 2', students: 38, feesCollected: 190000, feesPending: 38000 },
  { cls: 'Class 3', students: 45, feesCollected: 225000, feesPending: 22500 },
  { cls: 'Class 4', students: 40, feesCollected: 200000, feesPending: 40000 },
  { cls: 'Class 5', students: 36, feesCollected: 180000, feesPending: 36000 },
];

export default function SchoolDashboard({ school }) {
  const [activeTab, setActiveTab] = useState('overview');

  const totalStudents = classData.reduce((a, c) => a + c.students, 0);
  const totalFeesCollected = classData.reduce((a, c) => a + c.feesCollected, 0);
  const totalFeesPending = classData.reduce((a, c) => a + c.feesPending, 0);

  const stats = [
    { label: 'Total Students', value: totalStudents, icon: <i className="ti ti-school" style={{ fontSize: 22 }} />, color: '#2563eb' },
    { label: 'Total Teachers', value: 28, icon: <i className="ti ti-users" style={{ fontSize: 22 }} />, color: '#7c3aed' },
    { label: 'Fees Collected', value: `₹${(totalFeesCollected/100000).toFixed(1)}L`, icon: <i className="ti ti-currency-rupee" style={{ fontSize: 22 }} />, color: '#059669' },
    { label: 'Fees Pending', value: `₹${(totalFeesPending/100000).toFixed(1)}L`, icon: <i className="ti ti-trending-down" style={{ fontSize: 22 }} />, color: '#dc2626' },
  ];

  return (
    <div style={{ padding: '28px', background: '#f8fafc', minHeight: '100vh' }}>
      
      {/* School Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a' }}>
          {school?.name || 'Delhi Public School'}
        </h1>
        <p style={{ color: '#64748b', fontSize: '13px', marginTop: 4 }}>
          Code: {school?.code || 'DPS001'} &nbsp;·&nbsp; Session: 2024-25 &nbsp;·&nbsp;
          <span style={{ color: '#059669', fontWeight: 600 }}>● Active</span>
        </p>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
        {stats.map((s) => (
          <div key={s.label} style={{
            background: 'white', borderRadius: '12px', padding: '20px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderTop: `3px solid ${s.color}`
          }}>
            <div style={{ color: s.color, marginBottom: '10px' }}>{s.icon}</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>{s.value}</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px',
        borderBottom: '1px solid #e2e8f0', paddingBottom: '0' }}>
        {['overview', 'fees'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: '13px', fontWeight: 600, color: activeTab === tab ? '#2563eb' : '#64748b',
              borderBottom: activeTab === tab ? '2px solid #2563eb' : '2px solid transparent',
              marginBottom: '-1px', textTransform: 'capitalize'
            }}>
            {tab === 'overview' ? '📊 Class-wise Students' : '💰 Fees Overview'}
          </button>
        ))}
      </div>

      {/* Class-wise Students Table */}
      {activeTab === 'overview' && (
        <div style={{ background: 'white', borderRadius: '12px', overflow: 'hidden',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                {['Class', 'Total Students', 'Boys', 'Girls', 'Class Teacher', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left',
                    fontSize: '11px', fontWeight: 700, color: '#64748b',
                    textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {classData.map((row, i) => (
                <tr key={row.cls} style={{ borderTop: '1px solid #f1f5f9',
                  backgroundColor: i % 2 === 0 ? 'white' : '#fafafa' }}>
                  <td style={{ padding: '14px 16px', fontWeight: 600, color: '#0f172a', fontSize: '14px' }}>
                    {row.cls}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ background: '#dbeafe', color: '#1d4ed8',
                      padding: '3px 10px', borderRadius: '20px', fontSize: '13px', fontWeight: 600 }}>
                      {row.students}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', color: '#475569', fontSize: '13px' }}>
                    {Math.floor(row.students * 0.52)}
                  </td>
                  <td style={{ padding: '14px 16px', color: '#475569', fontSize: '13px' }}>
                    {row.students - Math.floor(row.students * 0.52)}
                  </td>
                  <td style={{ padding: '14px 16px', color: '#475569', fontSize: '13px' }}>
                    Assign Teacher
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <button style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '6px',
                      border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', color: '#475569' }}>
                      View Students
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Fees Table */}
      {activeTab === 'fees' && (
        <div style={{ background: 'white', borderRadius: '12px', overflow: 'hidden',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                {['Class', 'Students', 'Total Fees', 'Collected', 'Pending', 'Collection %'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left',
                    fontSize: '11px', fontWeight: 700, color: '#64748b',
                    textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {classData.map((row, i) => {
                const total = row.feesCollected + row.feesPending;
                const pct = Math.round((row.feesCollected / total) * 100);
                return (
                  <tr key={row.cls} style={{ borderTop: '1px solid #f1f5f9',
                    backgroundColor: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={{ padding: '14px 16px', fontWeight: 600, color: '#0f172a', fontSize: '14px' }}>{row.cls}</td>
                    <td style={{ padding: '14px 16px', color: '#475569', fontSize: '13px' }}>{row.students}</td>
                    <td style={{ padding: '14px 16px', color: '#475569', fontSize: '13px' }}>
                      ₹{(total/1000).toFixed(0)}K
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px' }}>
                      <span style={{ color: '#059669', fontWeight: 600 }}>₹{(row.feesCollected/1000).toFixed(0)}K</span>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px' }}>
                      <span style={{ color: '#dc2626', fontWeight: 600 }}>₹{(row.feesPending/1000).toFixed(0)}K</span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, height: '6px', background: '#fee2e2', borderRadius: '99px' }}>
                          <div style={{ width: `${pct}%`, height: '100%',
                            background: pct > 80 ? '#059669' : '#f59e0b', borderRadius: '99px' }} />
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569', minWidth: 32 }}>{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
