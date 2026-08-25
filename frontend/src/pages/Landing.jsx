import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const INDUSTRY_MODULES = [
  {
    id: 'school',
    category: 'education',
    name: 'EduERP',
    subtitle: 'School Management Suite',
    industry: 'K-12 & Senior Secondary Schools',
    desc: 'Automate admissions, daily attendance, class timetable, fee collection, examinations, admit cards, and progress report cards.',
    icon: 'ti-building-school',
    theme: {
      primary: '#0176d3',
      dark: '#032d60',
      gradient: 'linear-gradient(135deg, #032d60 0%, #0b5cab 50%, #0176d3 100%)',
      accent: '#38bdf8',
      pillBg: '#e0f2fe',
      pillText: '#0369a1',
    },
    thought: '"Education is the most powerful weapon which you can use to change the world."',
    author: 'Nelson Mandela',
    badge: 'LIVE & ACTIVE',
    ready: true,
    highlights: ['Student Admissions & IDs', 'Admit Cards & Result Cards', 'Automated Fee Management', 'Hostel & Transport GPS'],
    stats: '150+ Schools Active',
  },
  {
    id: 'college',
    category: 'education',
    name: 'Campus360',
    subtitle: 'College & University ERP',
    industry: 'Colleges, Universities & Higher Ed',
    desc: 'Semester credit system, department faculties, research papers, campus placement portal, and student examinations.',
    icon: 'ti-school',
    theme: {
      primary: '#6366f1',
      dark: '#1e1b4b',
      gradient: 'linear-gradient(135deg, #1e1b4b 0%, #4338ca 50%, #6366f1 100%)',
      accent: '#c084fc',
      pillBg: '#ede9fe',
      pillText: '#5b21b6',
    },
    thought: '"The beautiful thing about learning is that no one can take it away from you."',
    author: 'B.B. King',
    badge: 'LIVE & ACTIVE',
    ready: true,
    highlights: ['Semester & Credit System', 'Faculty Research Portal', 'Exam & CGPA Analytics', 'Campus Placement Hub'],
    stats: '40+ Universities',
  },
  {
    id: 'hospital',
    category: 'healthcare',
    name: 'MediCare360',
    subtitle: 'Hospital & Healthcare Suite',
    industry: 'Multi-Speciality Hospitals & Clinics',
    desc: 'OPD/IPD patient registration, doctor scheduling, electronic health records (EHR), pharmacy billing, and diagnostic labs.',
    icon: 'ti-heart-rate-monitor',
    theme: {
      primary: '#059669',
      dark: '#064e3b',
      gradient: 'linear-gradient(135deg, #064e3b 0%, #047857 50%, #059669 100%)',
      accent: '#34d399',
      pillBg: '#d1fae5',
      pillText: '#065f46',
    },
    thought: '"Wherever the art of medicine is loved, there is also a love of humanity."',
    author: 'Hippocrates',
    badge: 'ENTERPRISE READY',
    ready: true,
    highlights: ['OPD & IPD Management', 'Digital Prescriptions', 'Pharmacy & Lab Billing', 'Doctor Roster Scheduling'],
    stats: '25+ Medical Centers',
  },
  {
    id: 'industry',
    category: 'corporate',
    name: 'Industry360',
    subtitle: 'Manufacturing & Enterprise ERP',
    industry: 'Factories, Production & Supply Chain',
    desc: 'Inventory control, supply chain logistics, staff payroll, vendor procurement, machine maintenance, and financial ledger.',
    icon: 'ti-building-factory-2',
    theme: {
      primary: '#d97706',
      dark: '#0f172a',
      gradient: 'linear-gradient(135deg, #0f172a 0%, #78350f 50%, #d97706 100%)',
      accent: '#fbbf24',
      pillBg: '#fef3c7',
      pillText: '#92400e',
    },
    thought: '"Innovation distinguishes between a leader and a follower."',
    author: 'Steve Jobs',
    badge: 'ENTERPRISE READY',
    ready: true,
    highlights: ['Inventory & Warehouse', 'Procurement & Vendors', 'Staff Payroll & Biometric', 'Production Scheduling'],
    stats: '60+ Plants Powered',
  },
  {
    id: 'hospitality',
    category: 'hospitality',
    name: 'Hospitality360',
    subtitle: 'Hotels, Resorts & Banquets',
    industry: 'Luxury Resorts, Hotels & Dining',
    desc: 'Room reservation engine, guest check-in/out, POS restaurant billing, housekeeping workflow, and event banquet management.',
    icon: 'ti-bed',
    theme: {
      primary: '#e11d48',
      dark: '#4c0519',
      gradient: 'linear-gradient(135deg, #4c0519 0%, #9f1239 50%, #e11d48 100%)',
      accent: '#fda4af',
      pillBg: '#ffe4e6',
      pillText: '#9f1239',
    },
    thought: '"Hospitality is simply an opportunity to show love and care."',
    author: 'Guest Excellence',
    badge: 'CLOUD SUITE',
    ready: true,
    highlights: ['Room Booking Engine', 'Restaurant POS & KOT', 'Housekeeping Workflows', 'Banquet & Events'],
    stats: '30+ Resorts',
  },
  {
    id: 'coaching',
    category: 'education',
    name: 'Academy360',
    subtitle: 'Coaching & Test Prep Portal',
    industry: 'Competitive Coaching & EdTech',
    desc: 'Batch allotment, mock test series, online question bank, fee installments, and AI-powered student rank prediction.',
    icon: 'ti-book',
    theme: {
      primary: '#2563eb',
      dark: '#172554',
      gradient: 'linear-gradient(135deg, #172554 0%, #1d4ed8 50%, #2563eb 100%)',
      accent: '#60a5fa',
      pillBg: '#dbeafe',
      pillText: '#1e40af',
    },
    thought: '"The secret of getting ahead is getting started."',
    author: 'Mark Twain',
    badge: 'ACTIVE SUITE',
    ready: true,
    highlights: ['Batch & Faculty Scheduler', 'Online Mock Test Series', 'Rank Prediction Analytics', 'Fee Installment Plans'],
    stats: '85+ Coaching Hubs',
  },
];

export default function Landing() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedModule, setSelectedModule] = useState(INDUSTRY_MODULES[0]);

  const filteredModules = INDUSTRY_MODULES.filter(m => {
    if (activeCategory === 'all') return true;
    return m.category === activeCategory;
  });

  const handleLaunch = (mod) => {
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
          font-family: 'Plus Jakarta Sans', sans-serif;
          background: #080e1a;
          color: #ffffff;
          display: flex;
          flex-direction: column;
          position: relative;
          overflow-x: hidden;
        }

        /* Top Brand Navigation Bar */
        .landing-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 48px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(8, 14, 26, 0.85);
          backdrop-filter: blur(12px);
          position: sticky;
          top: 0;
          z-index: 50;
        }

        .brand-logo-wrap {
          display: flex;
          align-items: center;
          gap: 14px;
          cursor: pointer;
        }

        .brand-logo-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: linear-gradient(135deg, #0284c7 0%, #4f46e5 50%, #9333ea 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 20px;
          box-shadow: 0 4px 16px rgba(79, 70, 229, 0.4);
          border: 1.5px solid rgba(255, 255, 255, 0.25);
        }

        .brand-text-wrap {
          display: flex;
          flex-direction: column;
        }

        .brand-name {
          font-size: 20px;
          font-weight: 900;
          letter-spacing: -0.03em;
          background: linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .brand-tagline {
          font-size: 10px;
          font-weight: 700;
          color: #38bdf8;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .nav-actions {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .nav-direct-login-btn {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #ffffff;
          padding: 8px 18px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }
        .nav-direct-login-btn:hover {
          background: rgba(255, 255, 255, 0.2);
          border-color: #38bdf8;
        }

        /* Main Container */
        .landing-body {
          flex: 1;
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          gap: 36px;
          max-width: 1440px;
          width: 100%;
          margin: 0 auto;
          padding: 40px 48px;
        }

        /* Left Section: Header & Module Grid */
        .left-suite-section {
          display: flex;
          flex-direction: column;
        }

        .hero-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          border-radius: 30px;
          background: rgba(56, 189, 248, 0.12);
          border: 1px solid rgba(56, 189, 248, 0.3);
          color: #38bdf8;
          font-size: 11.5px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          margin-bottom: 16px;
          width: fit-content;
        }

        .hero-headline {
          font-size: 2.5rem;
          font-weight: 900;
          line-height: 1.15;
          letter-spacing: -0.03em;
          margin: 0 0 14px 0;
        }

        .hero-headline span {
          background: linear-gradient(135deg, #38bdf8 0%, #818cf8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .hero-subtext {
          font-size: 14px;
          color: #94a3b8;
          line-height: 1.6;
          margin: 0 0 28px 0;
          max-width: 580px;
        }

        /* Category Filter Tabs */
        .category-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }

        .category-btn {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #94a3b8;
          padding: 7px 16px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }

        .category-btn.active {
          background: #0284c7;
          border-color: #38bdf8;
          color: #ffffff;
          box-shadow: 0 2px 10px rgba(2, 132, 199, 0.35);
        }

        /* Modules Grid */
        .modules-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .module-card {
          background: rgba(15, 23, 42, 0.65);
          border: 1.5px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          padding: 20px;
          cursor: pointer;
          transition: all 0.25s ease;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
          backdrop-filter: blur(10px);
        }

        .module-card:hover {
          transform: translateY(-3px);
          border-color: rgba(56, 189, 248, 0.5);
          box-shadow: 0 10px 24px -5px rgba(0, 0, 0, 0.5);
          background: rgba(30, 41, 59, 0.7);
        }

        .module-card.selected {
          border-color: #38bdf8;
          background: rgba(14, 165, 233, 0.12);
          box-shadow: 0 0 0 1px #38bdf8, 0 8px 24px rgba(2, 132, 199, 0.25);
        }

        .card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }

        .card-icon-box {
          width: 42px;
          height: 42px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          color: #ffffff;
        }

        .card-badge {
          font-size: 9.5px;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 12px;
          letter-spacing: 0.05em;
        }

        .card-title {
          font-size: 16px;
          font-weight: 800;
          color: #ffffff;
          margin: 0 0 3px 0;
        }

        .card-industry {
          font-size: 11px;
          font-weight: 700;
          color: #38bdf8;
          margin-bottom: 8px;
        }

        .card-desc {
          font-size: 11.5px;
          color: #94a3b8;
          line-height: 1.45;
          margin-bottom: 14px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .card-footer {
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          padding-top: 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 11px;
          color: #64748b;
          font-weight: 600;
        }

        /* Right Section: Interactive Live Preview Hub */
        .right-preview-hub {
          background: rgba(15, 23, 42, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 20px;
          padding: 32px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          backdrop-filter: blur(16px);
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
          position: sticky;
          top: 100px;
          height: fit-content;
        }

        .preview-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 20px;
        }

        .preview-icon-huge {
          width: 58px;
          height: 58px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 26px;
          color: #ffffff;
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
        }

        .preview-title-box h2 {
          margin: 0;
          font-size: 22px;
          font-weight: 900;
          color: #ffffff;
        }

        .preview-title-box p {
          margin: 3px 0 0;
          font-size: 12px;
          font-weight: 700;
          color: #38bdf8;
        }

        /* Thought of the Day Box */
        .thought-card {
          background: rgba(255, 255, 255, 0.04);
          border-left: 3px solid #38bdf8;
          border-radius: 8px;
          padding: 14px 16px;
          margin-bottom: 20px;
        }

        .thought-text {
          font-size: 13px;
          font-style: italic;
          color: #e2e8f0;
          line-height: 1.5;
          margin: 0 0 6px 0;
        }

        .thought-author {
          font-size: 11px;
          font-weight: 700;
          color: #94a3b8;
          text-align: right;
        }

        /* Highlights Checklist */
        .highlights-box {
          margin-bottom: 24px;
        }

        .highlights-title {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #94a3b8;
          margin-bottom: 12px;
        }

        .highlight-item {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 12.5px;
          color: #cbd5e1;
          margin-bottom: 10px;
        }

        .highlight-tick {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: rgba(56, 189, 248, 0.15);
          color: #38bdf8;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 900;
          flex-shrink: 0;
        }

        /* Launch Button */
        .preview-launch-btn {
          width: 100%;
          padding: 15px;
          border-radius: 12px;
          border: none;
          color: #ffffff;
          font-size: 15px;
          font-weight: 800;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
          transition: all 0.2s;
        }

        .preview-launch-btn:hover {
          filter: brightness(1.1);
          transform: translateY(-2px);
        }

        .preview-powered-tag {
          text-align: center;
          margin-top: 14px;
          font-size: 11px;
          color: #64748b;
          font-weight: 600;
        }

        .preview-powered-tag strong {
          color: #38bdf8;
        }

        /* Responsive Breakpoints */
        @media (max-width: 1024px) {
          .landing-body {
            grid-template-columns: 1fr;
          }
          .right-preview-hub {
            position: relative;
            top: 0;
          }
        }

        @media (max-width: 640px) {
          .landing-nav { padding: 16px 20px; }
          .landing-body { padding: 24px 20px; }
          .hero-headline { font-size: 1.9rem; }
          .modules-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* Top Header */}
      <header className="landing-nav">
        <div className="brand-logo-wrap" onClick={() => setActiveCategory('all')}>
          <div className="brand-logo-icon">360°</div>
          <div className="brand-text-wrap">
            <span className="brand-name">OnePlatform360</span>
            <span className="brand-tagline">Enterprise Cloud ERP OS</span>
          </div>
        </div>

        <div className="nav-actions">
          <button className="nav-direct-login-btn" onClick={() => handleLaunch(selectedModule)}>
            Sign In &rarr;
          </button>
        </div>
      </header>

      {/* Body Area */}
      <main className="landing-body">
        {/* Left Side Modules Grid */}
        <section className="left-suite-section">
          <div className="hero-pill">
            <i className="ti ti-sparkles" /> Multi-Industry Ecosystem
          </div>

          <h1 className="hero-headline">
            Select Your <span>Industry ERP Suite</span>
          </h1>

          <p className="hero-subtext">
            One unified platform tailored with industry-specific workflows. Select your module to access your personalized institution portal.
          </p>

          {/* Category Filter Tabs */}
          <div className="category-tabs">
            {[
              { id: 'all', label: 'All Industries' },
              { id: 'education', label: '🎓 Education & Campus' },
              { id: 'healthcare', label: '🏥 Healthcare & Clinics' },
              { id: 'corporate', label: '🏭 Manufacturing & HR' },
              { id: 'hospitality', label: '🏨 Hospitality & Resorts' },
            ].map(cat => (
              <button
                key={cat.id}
                className={`category-btn ${activeCategory === cat.id ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Module Cards Grid */}
          <div className="modules-grid">
            {filteredModules.map(mod => {
              const isSelected = selectedModule.id === mod.id;
              return (
                <div
                  key={mod.id}
                  className={`module-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedModule(mod)}
                  onDoubleClick={() => handleLaunch(mod)}
                >
                  <div>
                    <div className="card-top">
                      <div className="card-icon-box" style={{ background: mod.theme.gradient }}>
                        <i className={`ti ${mod.icon}`} />
                      </div>
                      <span className="card-badge" style={{ background: mod.theme.pillBg, color: mod.theme.pillText }}>
                        {mod.badge}
                      </span>
                    </div>

                    <h3 className="card-title">{mod.name}</h3>
                    <div className="card-industry">{mod.industry}</div>
                    <p className="card-desc">{mod.desc}</p>
                  </div>

                  <div className="card-footer">
                    <span>{mod.stats}</span>
                    <span style={{ color: mod.theme.accent, fontWeight: 700 }}>
                      {isSelected ? 'Selected ✓' : 'Click to Select →'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Right Side Interactive Live Preview Hub */}
        <section className="right-preview-hub">
          <div>
            <div className="preview-header">
              <div className="preview-icon-huge" style={{ background: selectedModule.theme.gradient }}>
                <i className={`ti ${selectedModule.icon}`} />
              </div>
              <div className="preview-title-box">
                <h2>{selectedModule.name}</h2>
                <p>{selectedModule.industry}</p>
              </div>
            </div>

            {/* Industry Thought of the Day */}
            <div className="thought-card" style={{ borderLeftColor: selectedModule.theme.primary }}>
              <p className="thought-text">{selectedModule.thought}</p>
              <div className="thought-author">— {selectedModule.author}</div>
            </div>

            <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5, marginBottom: 20 }}>
              {selectedModule.desc}
            </p>

            {/* Key Capabilities */}
            <div className="highlights-box">
              <div className="highlights-title">Core Capabilities &amp; Features</div>
              {selectedModule.highlights.map((item, idx) => (
                <div key={idx} className="highlight-item">
                  <div className="highlight-tick">✓</div>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <button
              className="preview-launch-btn"
              style={{ background: selectedModule.theme.gradient }}
              onClick={() => handleLaunch(selectedModule)}
            >
              <span>Launch {selectedModule.name} Portal</span>
              <i className="ti ti-arrow-right" />
            </button>
            <div className="preview-powered-tag">
              Powered by <strong>OnePlatform360</strong> — Multi-Industry OS
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
