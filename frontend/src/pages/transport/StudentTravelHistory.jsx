import React, { useState } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import StudentTravelHistoryWidget from '../../components/transport/StudentTravelHistoryWidget';

export default function StudentTravelHistory() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: darkMode ? '#0f172a' : '#f8fafc' }}>
      <Sidebar darkMode={darkMode} />
      <div style={{ marginLeft: 232, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Navbar
          title="Student Travel & Boarding History"
          darkMode={darkMode}
          onToggleDark={() => setDarkMode(d => !d)}
        />
        <div style={{ padding: '24px' }}>
          <StudentTravelHistoryWidget
            darkMode={darkMode}
            title="🚌 Student Travel & Daily Boarding History (Daily/Monthly)"
          />
        </div>
      </div>
    </div>
  );
}
