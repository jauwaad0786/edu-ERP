import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const INDUSTRY_MODULES = [
  {
    id: 'school',
    category: 'education',
    name: 'EduERP',
    subtitle: 'School Management Suite',
    industry: 'K-12 & Senior Secondary Schools',
    desc: 'Complete school operating system covering admissions, daily attendance, class timetable, automated fee collection, exams, admit cards, and progress report cards.',
    icon: 'ti-building-school',
    themeColor: '#0176d3',
    lightBg: '#e8f4fd',
    badge: 'ACTIVE & LIVE',
    isLive: true,
    highlights: [
      'Student Admissions & Digital ID Cards',
      'Admit Cards & Cumulative Result Cards',
      'Automated Fee Collection & Receipts',
      'Daily Attendance, Timetable & SMS',
    ],
    stats: '150+ Schools Active',
  },
  {
    id: 'college',
    category: 'education',
    name: 'Campus360',
    subtitle: 'College & University ERP',
    industry: 'Colleges, Universities & Higher Ed',
    desc: 'Semester credit system, department faculties, research papers, campus placement portal, and student examination CGPA automation.',
    icon: 'ti-school',
    themeColor: '#6366f1',
    lightBg: '#ede9fe',
    badge: 'COMING SOON',
    isLive: false,
    highlights: [
      'Semester & Credit System',
      'Faculty Research & Publications',
      'Exam & CGPA Analytics',
      'Campus Placement Hub',
    ],
    stats: 'Launching Q4 2026',
  },
  {
    id: 'hospital',
    category: 'healthcare',
    name: 'MediCare360',
    subtitle: 'Hospital & Healthcare Suite',
    industry: 'Multi-Speciality Hospitals & Clinics',
    desc: 'OPD/IPD patient registration, doctor scheduling, electronic health records (EHR), pharmacy billing, and diagnostic labs.',
    icon: 'ti-heart-rate-monitor',
    themeColor: '#059669',
    lightBg: '#d1fae5',
    badge: 'COMING SOON',
    isLive: false,
    highlights: [
      'OPD & IPD Electronic Records',
      'Digital Prescriptions & Pharmacy',
      'Lab Diagnostics & Radiology',
      'Doctor Roster & OPD Queues',
    ],
    stats: 'In Development',
  },
  {
    id: 'industry',
    category: 'corporate',
    name: 'Industry360',
    subtitle: 'Manufacturing & Enterprise ERP',
    industry: 'Factories, Production & Supply Chain',
    desc: 'Inventory control, supply chain logistics, staff payroll, vendor procurement, machine maintenance, and financial ledger.',
    icon: 'ti-building-factory-2',
    themeColor: '#d97706',
    lightBg: '#fef3c7',
    badge: 'COMING SOON',
    isLive: false,
    highlights: [
      'Inventory & Warehouse Tracking',
      'Procurement & Vendor Portal',
      'Biometric Attendance & Payroll',
      'Production Schedules & BOM',
    ],
    stats: 'In Development',
  },
  {
    id: 'hospitality',
    category: 'hospitality',
    name: 'Hospitality360',
    subtitle: 'Hotels, Resorts & Banquets',
    industry: 'Luxury Resorts, Hotels & Dining',
    desc: 'Room reservation engine, guest check-in/out, POS restaurant billing, housekeeping workflow, and event banquet management.',
    icon: 'ti-bed',
    themeColor: '#e11d48',
    lightBg: '#ffe4e6',
    badge: 'COMING SOON',
    isLive: false,
    highlights: [
      'Room Booking & Reservations',
      'Restaurant POS & KOT System',
      'Housekeeping Workflows',
      'Banquet & Event Booking',
    ],
    stats: 'In Development',
  },
  {
    id: 'coaching',
    category: 'education',
    name: 'Academy360',
    subtitle: 'Coaching & Test Prep Portal',
    industry: 'Competitive Coaching & EdTech',
    desc: 'Batch allotment, mock test series, online question bank, fee installments, and AI-powered student rank prediction.',
    icon: 'ti-book',
    themeColor: '#2563eb',
    lightBg: '#dbeafe',
    badge: 'COMING SOON',
    isLive: false,
    highlights: [
      'Batch & Faculty Scheduler',
      'Online Mock Test Series',
      'Rank Prediction Analytics',
      'Fee Installment Plans',
    ],
    stats: 'In Development',
  },
];

export default function Landing() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState('all');

  const filteredModules = INDUSTRY_MODULES.filter(m => {
    if (activeCategory === 'all') return true;
    return m.category === activeCategory;
  });

  const handleLaunch = (mod) => {
    if (!mod.isLive) {
      toast(`${mod.name} (${mod.subtitle}) is currently under active development. Coming soon!`, {
        icon: '⏳',
        style: {
          borderRadius: '10px',
          background: '#032d60',
          color: '#ffffff',
          fontSize: '13px',
          fontWeight: '600'
        }
      });
      return;
    }
    localStorage.setItem('oneplatform_selected_module', mod.id);
    navigate(`/login?module=${mod.id}`);
  };

  return (
    <div className="oneplatform-landing">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');

        * { box-sizing: border-box; }

        .oneplatform-landing {
          min-height: 100vh;
          font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
          background: linear-gradient(180deg, #f0f7ff 0%, #ffffff 40%, #f8fafc 100%);
          color: #0f172a;
          display: flex;
          flex-direction: column;
        }

        /* ── Top Navigation Bar ── */
        .landing-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 48px;
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid #e2e8f0;
          position: sticky;
          top: 0;
          z-index: 50;
          box-shadow: 0 2px 10px rgba(0, 70, 150, 0.04);
        }

        .brand-logo-wrap {
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
        }

        .brand-logo-icon {
          width: 42px;
          height: 42px;
          border-radius: 10px;
          background: linear-gradient(135deg, #032d60 0%, #0176d3 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          font-weight: 900;
          font-size: 20px;
          box-shadow: 0 4px 12px rgba(1, 118, 211, 0.3);
        }

        .brand-name {
          font-size: 20px;
          font-weight: 900;
          color: #032d60;
          letter-spacing: -0.02em;
          line-height: 1.1;
        }

        .brand-name span {
          color: #0176d3;
        }

        .brand-tagline {
          font-size: 10.5px;
          font-weight: 700;
          color: #64748b;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .nav-actions {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .nav-school-btn {
          background: linear-gradient(135deg, #0176d3 0%, #032d60 100%);
          border: none;
          color: #ffffff;
          padding: 9px 20px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 4px 12px rgba(1, 118, 211, 0.25);
        }

        .nav-school-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 18px rgba(1, 118, 211, 0.35);
        }

        /* ── Hero Section ── */
        .landing-hero {
          text-align: center;
          padding: 56px 24px 32px;
          max-width: 900px;
          margin: 0 auto;
        }

        .hero-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 16px;
          background: #e8f4fd;
          border: 1px solid #b9e2fe;
          border-radius: 24px;
          color: #0176d3;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.04em;
          margin-bottom: 20px;
        }

        .hero-title {
          font-size: 2.6rem;
          font-weight: 900;
          color: #032d60;
          line-height: 1.15;
          letter-spacing: -0.03em;
          margin-bottom: 14px;
        }

        .hero-title span {
          background: linear-gradient(135deg, #0176d3 0%, #2563eb 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .hero-desc {
          font-size: 15.5px;
          color: #475569;
          line-height: 1.6;
          max-width: 680px;
          margin: 0 auto 32px;
        }

        /* Category Filter Tabs */
        .category-tabs {
          display: flex;
          justify-content: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 40px;
        }

        .tab-btn {
          padding: 8px 18px;
          border-radius: 20px;
          border: 1.5px solid #e2e8f0;
          background: #ffffff;
          color: #475569;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }

        .tab-btn:hover {
          border-color: #0176d3;
          color: #0176d3;
        }

        .tab-btn.active {
          background: #0176d3;
          border-color: #0176d3;
          color: #ffffff;
          box-shadow: 0 4px 12px rgba(1, 118, 211, 0.25);
        }

        /* ── Module Cards Grid ── */
        .modules-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: 24px;
          max-width: 1200px;
          margin: 0 auto 60px;
          padding: 0 24px;
        }

        .module-card {
          background: #ffffff;
          border-radius: 16px;
          border: 1.5px solid #e2e8f0;
          padding: 28px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transition: all 0.25s ease;
          position: relative;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);
        }

        .module-card.live-card {
          border-color: #0176d3;
          box-shadow: 0 8px 30px rgba(1, 118, 211, 0.12);
          background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
        }

        .module-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 32px rgba(0, 70, 150, 0.1);
        }

        .card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .card-icon {
          width: 52px;
          height: 52px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }

        .badge-pill {
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.04em;
        }

        .badge-live {
          background: #ecfdf5;
          color: #059669;
          border: 1px solid #a7f3d0;
        }

        .badge-soon {
          background: #f1f5f9;
          color: #64748b;
          border: 1px solid #e2e8f0;
        }

        .card-title-wrap h3 {
          font-size: 19px;
          font-weight: 800;
          color: #032d60;
          margin: 0 0 2px 0;
        }

        .card-subtitle {
          font-size: 12.5px;
          font-weight: 700;
          color: #0176d3;
          margin-bottom: 10px;
        }

        .card-desc {
          font-size: 13px;
          color: #475569;
          line-height: 1.5;
          margin-bottom: 20px;
        }

        .card-highlights {
          list-style: none;
          padding: 0;
          margin: 0 0 24px 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .card-highlights li {
          font-size: 12.5px;
          color: #334155;
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 500;
        }

        .card-highlights li i {
          color: #0176d3;
          font-size: 14px;
          flex-shrink: 0;
        }

        .launch-btn {
          width: 100%;
          padding: 12px;
          border-radius: 10px;
          font-size: 13.5px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: none;
        }

        .launch-btn.active-btn {
          background: linear-gradient(135deg, #0176d3 0%, #032d60 100%);
          color: #ffffff;
          box-shadow: 0 4px 14px rgba(1, 118, 211, 0.3);
        }

        .launch-btn.active-btn:hover {
          background: linear-gradient(135deg, #0284c7 0%, #014486 100%);
          box-shadow: 0 6px 20px rgba(1, 118, 211, 0.4);
        }

        .launch-btn.disabled-btn {
          background: #f1f5f9;
          color: #94a3b8;
          border: 1px solid #e2e8f0;
          cursor: pointer;
        }

        .launch-btn.disabled-btn:hover {
          background: #e2e8f0;
          color: #475569;
        }

        /* ── Footer ── */
        .landing-footer {
          margin-top: auto;
          background: #ffffff;
          border-top: 1px solid #e2e8f0;
          padding: 28px 48px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
          font-size: 13px;
          color: #64748b;
        }

        .footer-brand {
          font-weight: 800;
          color: #032d60;
        }

        @media (max-width: 768px) {
          .landing-nav { padding: 16px 20px; }
          .landing-hero { padding: 36px 16px 24px; }
          .hero-title { font-size: 2rem; }
          .modules-grid { grid-template-columns: 1fr; padding: 0 16px; }
          .landing-footer { padding: 20px; text-align: center; justify-content: center; }
        }
      `}</style>

      {/* Top Navbar */}
      <header className="landing-nav">
        <div className="brand-logo-wrap" onClick={() => navigate('/')}>
          <div className="brand-logo-icon">
            <i className="ti ti-layers-linked" />
          </div>
          <div>
            <div className="brand-name">OnePlatform<span>360</span></div>
            <div className="brand-tagline">Multi-Industry ERP Cloud</div>
          </div>
        </div>

        <div className="nav-actions">
          <button className="nav-school-btn" onClick={() => handleLaunch(INDUSTRY_MODULES[0])}>
            <i className="ti ti-building-school" />
            Launch School ERP
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="hero-pill">
          <span>✨</span> ONEPLATFORM360 ENTERPRISE CLOUD SUITE
        </div>
        <h1 className="hero-title">
          Select Your <span>Industry ERP</span> Portal
        </h1>
        <p className="hero-desc">
          Unified enterprise automation for educational institutions, healthcare centers, hotels, and businesses. Built for scale, security, and effortless management.
        </p>

        {/* Filter Tabs */}
        <div className="category-tabs">
          {[
            { id: 'all', label: 'All Modules' },
            { id: 'education', label: '🎓 Education & Schools' },
            { id: 'healthcare', label: '🏥 Healthcare' },
            { id: 'corporate', label: '🏭 Manufacturing' },
            { id: 'hospitality', label: '🏨 Hospitality' },
          ].map(tab => (
            <button
              key={tab.id}
              className={`tab-btn ${activeCategory === tab.id ? 'active' : ''}`}
              onClick={() => setActiveCategory(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* Modules Grid */}
      <div className="modules-grid">
        {filteredModules.map(mod => (
          <div
            key={mod.id}
            className={`module-card ${mod.isLive ? 'live-card' : ''}`}
          >
            <div>
              <div className="card-header">
                <div
                  className="card-icon"
                  style={{
                    background: mod.lightBg,
                    color: mod.themeColor,
                  }}
                >
                  <i className={`ti ${mod.icon}`} />
                </div>
                <span className={`badge-pill ${mod.isLive ? 'badge-live' : 'badge-soon'}`}>
                  {mod.badge}
                </span>
              </div>

              <div className="card-title-wrap">
                <h3>{mod.name}</h3>
                <div className="card-subtitle">{mod.subtitle}</div>
              </div>

              <p className="card-desc">{mod.desc}</p>

              <ul className="card-highlights">
                {mod.highlights.map((h, i) => (
                  <li key={i}>
                    <i className="ti ti-circle-check-filled" style={{ color: mod.isLive ? '#0176d3' : '#94a3b8' }} />
                    {h}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <button
                className={`launch-btn ${mod.isLive ? 'active-btn' : 'disabled-btn'}`}
                onClick={() => handleLaunch(mod)}
              >
                {mod.isLive ? (
                  <>
                    <span>Enter School Portal</span>
                    <i className="ti ti-arrow-right" />
                  </>
                ) : (
                  <>
                    <i className="ti ti-clock" />
                    <span>Coming Soon</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <footer className="landing-footer">
        <div>
          <span className="footer-brand">OnePlatform360</span> — Unified Cloud ERP Suite
        </div>
        <div>
          © {new Date().getFullYear()} OnePlatform360 Systems. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
