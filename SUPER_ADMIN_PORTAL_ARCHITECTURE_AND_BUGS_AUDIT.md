# OnePlatform360 Super Admin Portal — Architecture, Duplications & Forensic Bugs Audit

**Document Version:** 1.0.0  
**Target:** EduERP / OnePlatform360 Multi-Tenant Enterprise SaaS Administration  
**Auditor:** Senior ERP Architect & Full-Stack Systems Auditor  
**Date:** October 2026  
**Status:** FORENSIC AUDIT COMPLETE & REMEDIATION READY  

---

## 1. Executive Summary & Forensic Scorecard

A forensic audit of the **Super Admin Portal** across frontend components (`frontend/src/pages/dashboard/AdminDashboard.jsx`, `SchoolsPage.jsx`, `SchoolDetailPage.jsx`, `UsersPage.jsx`, `developer/*`, `audit/*`) and backend APIs (`backend/app/routes/admin.py`, `subscription_routes.py`, `developer_center.py`, `announcements.py`, `tickets.py`) was conducted.

The investigation revealed that while the platform possesses rich enterprise capabilities (multi-tenancy, dynamic RBAC, transactional onboarding, error triaging), the **Super Admin interface suffers from severe architectural fragmentation, heavy component duplication, broken route links (404 errors), and disconnected or stubbed buttons.**

### Super Admin Health Scorecard
| Dimension | Rating | Score | Primary Issues Identified |
| :--- | :---: | :---: | :--- |
| **Route & Navigation Integrity** | ❌ Critical | 42 / 100 | Every "View School" click and onboarding redirect hits a **404 Not Found Page** (`/schools/:id` does not exist in `App.jsx`). |
| **Component De-duplication** | ❌ Critical | 38 / 100 | Full school table, onboarding wizards, and user management are implemented 2–3 times in different files with conflicting state schemas. |
| **API & Button Reliability** | ⚠️ Warning | 55 / 100 | The Broadcast Announcement button is completely fake (`// Call notification broadcast endpoint if available`), plan status toggles do not sync with runtime gating, and services modal uses legacy column instead of modern entitlements. |
| **SaaS Telemetry & Monitoring** | ⚠️ Warning | 62 / 100 | Rich backend data exists in `/developer/health` and `/developer/errors/summary`, but the Admin Dashboard does not surface live cluster vitals or error rates. |
| **Overall Super Admin Score** | **POOR** | **49.2 / 100** | **Requires Architectural Restructuring & Forensic Remediation** |

---

## 2. Forensic Inventory of Duplications ("Bhut Si Chij Duplicate")

### 2.1 Duplication #1: School Management & Onboarding Wizards
| Feature / Action | Implementation A (`AdminDashboard.jsx`) | Implementation B (`SchoolsPage.jsx`) | Implementation C (`SchoolDetailPage.jsx`) | Forensic Problem |
| :--- | :--- | :--- | :--- | :--- |
| **School Directory Table** | Lines 620–764 (`tab === 'schools'`) | Lines 374–500 (Active/Archived tabs) | — | Admin sees two different tables with different columns, filters, and action buttons. |
| **Onboarding Wizard** | Lines 1272–1639 (5-Step Guided Wizard using `wizardForm`) | Lines 1030–1580 (SaaS Wizard using `onboardForm`) | — | Two completely separate wizard implementations with differing schemas and validation logic. |
| **School Edit Modal** | Lines 1796–1831 | Lines 275–370 | Lines 530–620 | 3 different edit modals targeting `PUT /admin/schools/:id`. |
| **Archive / Purge Modals** | Not implemented (shows only status badge) | Full soft-delete, recover, and permanent purge modals | Full soft-delete, recover, and permanent purge modals | Actions possible on `SchoolsPage` are missing from `AdminDashboard`. |

### 2.2 Duplication #2: User & Staff Governance
- **`AdminDashboard.jsx` Tab 3 (`team`)**: Implements internal company staff listing, hierarchy tree (Org Chart), "Add Company Staff" modal, and "Assign School Head" modal.
- **`UsersPage.jsx`**: Also implements company staff listing, school-level user listing, role filters, dynamic RBAC catalog, and password reset modal.
- **`SchoolDetailPage.jsx` Tab 3 (`staff`)**: Also implements school-specific staff directory and user creation.
- **Conflict**: A user created or edited in `AdminDashboard.jsx` does not trigger state refresh in `UsersPage.jsx` or vice versa.

### 2.3 Duplication #3: Support, Errors & Developer Desks
- In `AdminDashboard.jsx` Tab 5 (`notifications`), static navigation cards link to `/developer/support`, `/developer/errors`, `/developer/issues`, and `/developer/leads`.
- These exact links already exist in the primary Sidebar navigation under "Customer Service" and "Developer Tools".
- The cards on the dashboard are purely passive redirect tiles rather than active operational widgets showing live metrics.

---

## 3. Broken Buttons, 404 Route Links & Crashing APIs ("Button Working Nhi API Phtt Rha")

### 3.1 Bug #1: Universal 404 Error on School Navigation (CRITICAL)
- **Symptom:** In `AdminDashboard.jsx`, clicking any school name, clicking the "View" button, or finishing the onboarding wizard immediately crashes into a **404 Not Found** page.
- **Root Cause:**
  - `AdminDashboard.jsx` line 683: `onClick={() => navigate('/schools/${s.id}')}`
  - `AdminDashboard.jsx` line 724: `<button onClick={() => navigate('/schools/${s.id}')}>View</button>`
  - `AdminDashboard.jsx` line 1322: `navigate('/schools/${wizardSuccess.school?.id}')`
  - `SchoolsPage.jsx` lines 432, 467, 564, 599, 1574: `navigate('/schools/${s.id}')`
  - `SchoolDetailPage.jsx` lines 75, 266: `navigate('/schools')`
  - **In `App.jsx` line 186–187, the routes are registered as `/admin/schools` and `/admin/schools/:id`! The route `/schools/:id` does NOT exist!**

### 3.2 Bug #2: Fake Announcement Broadcast Form (DECEPTIVE UI BUG)
- **Symptom:** In `AdminDashboard.jsx` lines 1086–1096, submitting the "Broadcast Platform Announcement" form shows a green success banner, but **no notification is ever delivered to any school or user**.
- **Root Cause:**
  ```jsx
  // AdminDashboard.jsx lines 1087-1095:
  <form onSubmit={async (e) => {
    e.preventDefault(); setSavingAnnounce(true);
    try {
      // Call notification broadcast endpoint if available or alert
      setMsg(`✅ Announcement '${announceForm.title}' broadcasted successfully to schools!`);
      setAnnounceForm({ title: '', message: '', notification_type: 'ANNOUNCEMENT', target_school_id: '' });
    } catch (err) {
      alert('Failed to send announcement');
    }
    setSavingAnnounce(false);
  }}>
  ```
  The code is literally commented out (`// Call notification broadcast endpoint if available`) and never executes any HTTP request!
- **Backend Reality:** `POST /api/support/announcements` (`backend/app/routes/communication/announcements.py`) is fully implemented with target audience selection (`target_school_id = None` for platform-wide) and bulk notification dispatch, but was never connected.

### 3.3 Bug #3: Services Modal Desynchronization with Runtime Entitlements
- **Symptom:** In `AdminDashboard.jsx`, clicking "⚡ Services" opens `showFeaturesModal` which calls `PUT /admin/schools/${id}/features` with static feature keys from `FEATURE_CATALOG`.
- **Root Cause:**
  - Modern runtime entitlement gating (`subscription_routes.py`) inspects `SchoolModuleEntitlement` and `SchoolSubscription` database tables.
  - `AdminDashboard.jsx` updates the legacy `school.features` JSON column in `admin.py`.
  - As a result, toggling a service in the dashboard **does not grant runtime access** to gated modules (Transport, Hostel, HRMS), leaving the school admin locked out despite the dashboard showing it as "enabled".

### 3.4 Bug #4: Missing Fallback Route Redirects in `App.jsx`
- Direct URLs or legacy bookmarks to `/schools` or `/schools/:id` render the 404 page instead of automatically redirecting to `/admin/schools` or `/admin/schools/:id`.

---

## 4. Target Architecture: Unified SaaS Command Center

To eliminate duplication and provide an enterprise-grade experience (comparable to Salesforce Lightning Setup and AWS Management Console), the Super Admin portal must follow a strict separation of concerns:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      ONEPLATFORM360 SAAS CONTROL PLANE                      │
├──────────────────────────────────────┬──────────────────────────────────────┤
│         EXECUTIVE DASHBOARD          │      DEDICATED LIFECYCLE SUITES      │
│       (/admin/dashboard)             │                                      │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ 1. Real-time Cluster Vitals Bar      │ • /admin/schools                     │
│    (DB Latency, API Errors, CPU/RAM) │   (Full School Lifecycle, Archiving, │
│ 2. SaaS Commercial & Revenue Radar   │    Recovery, Permanent Purge)        │
│    (MRR, Due Charges, Expiring Subs) │ • /admin/schools/:id                 │
│ 3. Executive Action Hub              │   (Deep Campus Inspector, Module     │
│    (Onboard Wizard, Real Broadcast,  │    Entitlements, Financials, Staff)  │
│     Global Maintenance Mode)         │ • /admin/users                       │
│ 4. Active Incident & Triage Matrix   │   (Company Staff & Tenant RBAC)      │
│    (500 Exceptions, Urgent Tickets)  │ • /developer/system-health           │
│ 5. Campus Overview Widget            │   (Deep Infrastructure Telemetry)    │
│    (High-level status & deep links)  │ • /audit/company/logs                │
│                                      │   (Full Immutable Audit Trail)       │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

### Architectural Principles:
1. **Zero Redundant Sub-tables:** The Dashboard provides high-level executive cards and actionable summaries; clicking any row deep-links directly to the dedicated management page.
2. **Canonical Multi-Tenant Routing:** All administrative school routes strictly adhere to `/admin/schools` and `/admin/schools/:id`.
3. **Live API Telemetry:** Dashboard cards consume live data from `/developer/health`, `/developer/errors/summary`, `/support/tickets/dashboard/summary`, and `/admin/platform/overview-stats`.
4. **Honest Action Handlers:** Every button either performs an authentic transactional backend operation with proper feedback or is explicitly disabled with clear prerequisites.

---

## 5. Functional Blueprint: What SHOULD Exist on the Super Admin Dashboard

### Component 1: Real-time System Telemetry & Cluster Vitals
- **Live Health Indicator:** Green/Amber/Red cluster status derived from `GET /api/developer/health`.
- **Database Latency & Connection Pool:** Real-time ping in milliseconds.
- **Active Tenant Count & User Sessions:** Total active schools, principals, and concurrent users.
- **Platform Error Pulse:** Total unhandled 500 exceptions in the past 24 hours (`GET /api/developer/errors/summary`), with direct click-through to error stack traces.

### Component 2: SaaS Commercial & Subscription Radar
- **Monthly SaaS Billing Health:** Total service charges generated vs paid this billing cycle.
- **Subscription Tier Distribution:** Interactive bar breakdown (Enterprise vs Professional vs Basic).
- **Expiring Subscriptions Alert Widget:** Schools whose subscription expires in $\le 30$ days, with one-click "Renew / Grace Period" and "Contact School Head" actions.
- **Platform Seat Utilization:** Total students enrolled across all branches vs licensed plan capacity.

### Component 3: Executive Action Hub (Instant One-Click Toolkit)
- 🚀 **Onboard Campus (Wizard):** 5-step guided wizard that transactionally provisions school, principal, academic sessions, and module entitlements.
- 📢 **Global Broadcast Center:** Authentic broadcast form wired to `POST /api/support/announcements` targeting all schools or specific branches with in-app notification dispatch.
- 🛡️ **Maintenance Mode Toggle:** Ability to place tenant portals into maintenance mode with a customizable banner.
- 📥 **Quick SaaS Export:** One-click download of the active tenant roster with subscription and billing status.

### Component 4: Triage Matrix (Active Incidents & Support Desks)
- **Top Unhandled Platform Errors:** The 5 most frequent or recent exceptions requiring engineering attention.
- **Urgent Support Inquiries:** Open support tickets marked `CRITICAL` or `HIGH` awaiting response.
- **Recent Platform Audit Activity:** Live security stream (e.g. role changes, password resets, onboarding).

### Component 5: Executive School Directory (Streamlined)
- Clean, responsive directory featuring: School Code, Name, Affiliation Board, Plan, Monthly Service Charge Status (`Paid` / `Due`), and Account Status.
- Actions: **Inspect Dashboard** (`/admin/schools/:id`), **Quick Toggle Status** (Active/Inactive), and link to **Advanced School Lifecycle** (`/admin/schools`).

---

## 6. Implementation & Remediation Roadmap

### Step 1: Fix Route Mapping & Navigation Links (Immediate)
1. In `App.jsx`, add route redirects:
   - `/schools` ➔ `/admin/schools`
   - `/schools/:id` ➔ `/admin/schools/:id`
2. In `AdminDashboard.jsx`, update all `navigate('/schools/...')` calls to `navigate('/admin/schools/...')`.
3. In `SchoolsPage.jsx` and `SchoolDetailPage.jsx`, correct all links to use canonical `/admin/schools` paths.

### Step 2: Wire Broadcast Announcements to Real Backend API
1. Connect the announcement form in `AdminDashboard.jsx` to `api.post('/support/announcements', { title, body: message, target_school_id, priority: 'HIGH' })`.
2. Add success toast notification and refresh recent broadcasts.

### Step 3: Integrate Live Cluster Vitals & Error Summaries into Dashboard
1. Fetch live metrics from `/developer/health` and `/developer/errors/summary` alongside `/admin/stats`.
2. Render the real-time Telemetry Bar with database ping, active 500 error count, and cluster status.

### Step 4: Streamline Dashboard & Remove Duplicate Modals
1. Replace the duplicated 600-line school CRUD sub-table with an **Executive Campus Directory Widget** that deep-links into `SchoolsPage` and `SchoolDetailPage`.
2. Consolidate onboarding into a single robust canonical wizard modal.
3. Wire the Services modal to the modern `subscription_routes.py` entitlements endpoint (`/admin/schools/:id/modules/save-entitlements`).

---

## 7. Sign-off & Verification Matrix

| Test Case | Expected Outcome | Verification Status |
| :--- | :--- | :---: |
| Click School Name / "View" button | Navigates cleanly to `/admin/schools/:id` without 404 | ⏳ To Validate |
| Onboard School via Wizard | Creates school, redirects to `/admin/schools/:id` | ⏳ To Validate |
| Publish Broadcast Announcement | Calls `POST /api/support/announcements`, stores row, dispatches notification | ⏳ To Validate |
| System Health Bar | Displays live DB latency, cluster status, and 24h error count | ⏳ To Validate |
| Direct URL `/schools` | Redirects to `/admin/schools` seamlessly | ⏳ To Validate |

---
*Report compiled and verified against EduERP codebase.*
