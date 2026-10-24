# Teacher Dashboard & Student Dashboard: Comprehensive Architecture, Database Table, API & UI Bug Audit

**Audit Timestamp:** October 2026  
**Audited Components:**  
1. `TeacherDashboard.jsx` (`frontend/src/pages/dashboard/TeacherDashboard.jsx` - 2,894 lines)
2. `StudentDashboard.jsx` (`frontend/src/pages/dashboard/StudentDashboard.jsx` - 2,832 lines)
3. Backend Routing & Models:
   - `backend/app/routes/curriculum.py` (Curriculum & Teaching Diary)
   - `backend/app/routes/student.py` (Student & Parent Portal Core)
   - `backend/app/routes/teacher.py` (Teacher Classroom & Attendance)
   - `backend/app/routes/academic_resources.py` (Assignments & Course Notes)
   - `backend/app/routes/hostel.py` (Student Hostel Gate Passes & Complaints)
   - `backend/app/routes/library.py` (Student & Parent Library Loans)
   - `backend/app/models/curriculum.py`, `backend/app/models/academic.py`, `backend/app/models/examinations.py`

---

## 1. Executive Summary

This audit delivers an exhaustive forensic inspection of the **Teacher Dashboard** and **Student / Parent Portal Dashboard** in Edu-ERP. Both dashboards represent the highest-frequency operational surfaces for educators, pupils, and parents.

While both dashboards feature rich interfaces (Hero banners, live statistics, SVG badges, and multi-tab workflows), deep code analysis revealed **critical navigational broken buttons (404 / 403)**, **API routing prefix mismatches (404)**, **dead/unlinked database entries in legacy marks entry**, and **parent-child context loss in student self-service modules**.

All issues have been cataloged with root cause analysis, security impact, database table linkage, and remediation plans.

---

## 2. Teacher Dashboard Audit (`TeacherDashboard.jsx`)

### 2.1 Tab Architecture & Functional Inventory

The Teacher Dashboard operates across 9 core tabs:
| Tab Key | Display Name | Backend Endpoints Called | State Managed |
| :--- | :--- | :--- | :--- |
| `schedule` | Today's Schedule & Diary | `GET /curriculum/teaching-diary/today`, `POST /curriculum/teaching-diary/entry` | Period timeline, period completion status, teaching log drawer |
| `attendance` | Mark Attendance | `GET /principal/students?class_id=`, `GET /teacher/attendance/:id`, `POST /teacher/attendance` | Student attendance roster (Present / Absent / Late) |
| `syllabus` | Syllabus Progress | `GET /curriculum/analytics/summary` | Chapter/topic pacing, coverage %, completed periods |
| `marks` | Marks Entry | `GET /teacher/marks/:class_id`, `POST /teacher/marks` | In-line student marks input table |
| `homework` | Assignments & Homework | `GET /academic/assignments?academic_year=` | Active coursework, deadline dates, submission counters |
| `notes` | Upload Notes | `GET /academic/notes`, `POST /academic/notes`, `DELETE /academic/notes/:id` | Study materials, PDF uploads, class-subject distribution |
| `leaves` | My Leaves & Quota | `GET /hrms/my/leaves` | Leave quotas (CL, SL, EL, DL), past leave requests |
| `my-att` | My GPS Attendance | `GET /staff-attendance/my-status`, `POST /staff-attendance/check-in`, `POST /staff-attendance/check-out` | Geofence coordinates, check-in timestamps, regularization requests |
| `holidays` | Holidays | `GET /principal/holidays?applies_to=TEACHER` | School calendar, national & academic holidays |

---

### 2.2 Forensic Findings & Critical Defects in Teacher Dashboard

#### Defect T-01: 404 Route on Schedule & Teaching Diary
- **Severity:** High / Blocker
- **Location:** `TeacherDashboard.jsx:128` and `TeacherDailyDiaryPage.jsx:115`
- **Frontend Code:**
  ```javascript
  api.get(`/curriculum/teaching-diary/today?date=${selectedDate}&session=${session}`)
  ```
- **Backend Code (`backend/app/routes/curriculum.py:411`):**
  ```python
  @curriculum_bp.route('/teaching-diary/today', methods=['GET'])
  def get_today_schedule(): ...
  ```
- **Root Cause:**
  `curriculum_bp` is registered with `url_prefix='/api'`. While other endpoints define explicit dual route decorators (e.g., `@curriculum_bp.route('/curriculum/teaching-diary/entry')` and `@curriculum_bp.route('/teaching-diary/entry')`), `/teaching-diary/today` was only registered at `/api/teaching-diary/today`. Calling `/curriculum/teaching-diary/today` returned HTTP 404 Not Found, causing the daily teaching schedule to fail to render.
- **Fix:** Add `@curriculum_bp.route('/curriculum/teaching-diary/today', methods=['GET'])` alias to `curriculum.py:411`, as well as corresponding aliases for `/teaching-diary/history`, `/teaching-diary/worksheets`, and `/teaching-diary/<int:log_id>`.

---

#### Defect T-02: 404 Button on "+ Create Assignment"
- **Severity:** High
- **Location:** `TeacherDashboard.jsx:1854`
- **Frontend Code:**
  ```javascript
  <button type="button" onClick={() => navigate('/academic')} className="btn btn-primary btn-sm">
    + Create Assignment
  </button>
  ```
- **Root Cause:**
  There is no route `/academic` registered in `App.jsx`. Clicking this button sent teachers to an unhandled route resulting in a blank 404 page. The canonical, full-featured assignments module is at route `/assignments` (which maps to `AssignmentsPage.jsx`).
- **Fix:** Update `navigate('/academic')` to `navigate('/assignments')`.

---

#### Defect T-03: 403 Forbidden Button on "Full Curriculum View →"
- **Severity:** High
- **Location:** `TeacherDashboard.jsx:1520`
- **Frontend Code:**
  ```javascript
  <button type="button" onClick={() => navigate('/curriculum')} className="btn btn-primary btn-sm">
    Full Curriculum View →
  </button>
  ```
- **Root Cause:**
  In `App.jsx:939`, `/curriculum` redirects to `curriculum/setup`. However, `/curriculum/setup` is restricted by `TenantProtectedRoute` to `['PRINCIPAL', 'SUPER_ADMIN', 'VICE_PRINCIPAL', 'ACADEMIC_COORDINATOR']`. Teachers do not have access to curriculum setup; their canonical view is `TeacherSyllabusCoveragePage` at `/curriculum/coverage`. Clicking "Full Curriculum View →" caused teachers to be kicked to an Unauthorized (403) screen.
- **Fix:** Update `navigate('/curriculum')` to `navigate('/curriculum/coverage')`.

---

#### Defect T-04: 403 Forbidden Button on "+ Apply for Leave"
- **Severity:** High
- **Location:** `TeacherDashboard.jsx:1990`
- **Frontend Code:**
  ```javascript
  <button type="button" onClick={() => navigate('/hrms')} className="btn btn-primary btn-sm">
    + Apply for Leave
  </button>
  ```
- **Root Cause:**
  `/hrms` is restricted to HR managers, Principals, and Super Admins. Teachers who want to apply for leaves, view balances, and check attendance logs must use `StaffSelfService` at `/my-hr` (registered in `App.jsx:357` with `roles=['TEACHER', ...]`). Clicking `/hrms` resulted in 403 Access Denied.
- **Fix:** Update `navigate('/hrms')` to `navigate('/my-hr')`.

---

#### Defect T-05: Dead Table / Deprecated Marks Data Storage Disconnect
- **Severity:** Architectural Critical
- **Location:** `TeacherDashboard.jsx:272`, `TeacherDashboard.jsx:378`, `backend/app/routes/teacher.py:99-145`
- **Analysis:**
  TeacherDashboard's "Marks Entry" tab calls legacy routes:
  - `GET /teacher/marks/:class_id`
  - `POST /teacher/marks`
  
  In `teacher.py:122-132`, these marks are written directly to table `marks` with **`exam_id=None`**:
  ```python
  existing = Marks.query.filter_by(student_id=..., subject_id=..., exam_type=..., exam_id=None).first()
  ```
  However, in Edu-ERP's Exam & Report Card architecture (`backend/app/routes/student.py:213-225` and `backend/app/routes/result_management.py`):
  ```python
  q_marks = Marks.query.filter(
      Marks.student_id == student.id,
      Marks.exam_id.isnot(None),  # <--- CRITICAL
      Marks.is_absent == False
  )
  ```
  **Consequence:** Marks entered via TeacherDashboard's legacy marks tab NEVER appear on student report cards, cannot be published, and are isolated from ExamSchedule records.
- **Remediation:**
  1. Add a prominent banner and direct link to the official **Exam Marks Entry Grid** (`/mark-entry` or `/marks`) in the TeacherDashboard Marks tab so teachers can record marks against scheduled examinations with moderation and grade calculation.
  2. Maintain backward-compatible fallback for quick assessment marks while clearly indicating exam publication status.

---

## 3. Student & Parent Dashboard Audit (`StudentDashboard.jsx`)

### 3.1 Tab Architecture & Functional Inventory

The Student Dashboard serves dual roles: **Student Self-Service Hub** and **Parent Portal** (with multi-child switcher). It encompasses 11 functional tabs:
| Tab Key | Display Name | Backend Endpoints Called | State Managed |
| :--- | :--- | :--- | :--- |
| `overview` | Overview | Consolidated profile, attendance gauge, fee summary, schedule | High-level KPI cards, recent scores, next period |
| `profile` | My Profile | `GET /student/profile` | Student admission details, blood group, emergency contact, class |
| `attendance` | Attendance | `GET /student/attendance` | Monthly attendance calendar, present/absent/late statistics |
| `marks` | Report Card | `GET /student/marks`, `GET /student/marks?exam_id=` | Exam performance, subject score breakdowns, grades, rank |
| `fees` | Fee Details | `GET /student/fees` | Invoiced fees, paid receipts, outstanding dues, payment history |
| `timetable` | Timetable | `GET /student/timetable` | Weekly schedule by day, period timings, room & teacher name |
| `homework` | Homework & Diary | `GET /student/homework` | Daily classroom diary entries, homework instructions, due dates |
| `library` | My Library | `GET /student/library` | Borrowed books, return due dates, library fines |
| `hostel` | My Hostel | `GET /student/hostel`, `POST /hostel/out-passes`, `POST /hostel/complaints` | Room & bed allocation, gate passes, maintenance complaints |
| `notes` | Study Material | `GET /teacher/notes` | Downloadable chapter notes, lesson PDFs |
| `holidays` | Holidays | `GET /principal/holidays` | Academic calendar & holidays list |

---

### 3.2 Forensic Findings & Critical Defects in Student Dashboard

#### Defect S-01: Multi-Child Context Missing on Hostel & Library Requests
- **Severity:** Medium / High
- **Location:** `StudentDashboard.jsx:77` and `StudentDashboard.jsx:195`
- **Frontend Code:**
  ```javascript
  const fetchHostelData = () => {
    api.get('/student/hostel').then(r => setHostelData(r.data)).catch(() => {});
  };
  // In initial load:
  api.get('/student/library').then(r => setLibraryData(r.data)).catch(() => {});
  fetchHostelData();
  ```
- **Backend Code (`backend/app/routes/student.py:573-575`):**
  ```python
  if user.role.value == 'PARENT':
      if not student_id:
          return jsonify({'error': 'student_id is required for parent'}), 400
  ```
- **Root Cause:**
  When a Parent is logged in and selects a child in the multi-child switcher, `selectedChildId` was properly passed to `/student/profile`, `/student/attendance`, `/student/fees`, `/student/marks`, and `/student/timetable`, BUT NOT to `/student/hostel` and `/student/library`. Consequently, parents always received a 400 Bad Request error on hostel and library data when switching between children.
- **Fix:** Update `fetchHostelData(childId)` to pass `?student_id=${childId}` and pass `?student_id=${selectedChildId}` to `/student/library`.

---

#### Defect S-02: Parent Role Missing on Hostel Out-Pass and Complaint Creation
- **Severity:** Medium
- **Location:** `backend/app/routes/hostel.py:2085` and `backend/app/routes/hostel.py:1993`
- **Backend Code:**
  ```python
  @hostel_bp.route('/out-passes', methods=['POST'])
  @role_required('PRINCIPAL', 'HOSTEL', 'STUDENT')
  def request_out_pass(): ...

  @hostel_bp.route('/complaints', methods=['POST'])
  @role_required('PRINCIPAL', 'HOSTEL', 'STUDENT')
  def create_complaint(): ...
  ```
- **Root Cause:**
  Parents who need to submit a hostel gate pass or maintenance complaint on behalf of their boarding child received HTTP 403 Forbidden because `'PARENT'` was omitted from `@role_required`. Furthermore, the frontend modals in `StudentDashboard.jsx:2532` did not include `student_id: selectedChildId`.
- **Fix:**
  1. Add `'PARENT'` to `@role_required` in `request_out_pass` and `create_complaint`.
  2. If `user.role == 'PARENT'`, resolve student ownership and allow pass/complaint creation.
  3. Update `StudentDashboard.jsx` modal submits to include `student_id: selectedChildId || profile?.id`.

---

#### Defect S-03: Parent Library Loans Identification
- **Severity:** Low / Medium
- **Location:** `backend/app/routes/library.py:1366`
- **Backend Code:**
  ```python
  member = LibraryMember.query.filter_by(school_id=sid, user_id=user.id).first()
  ```
- **Root Cause:**
  When a parent opens "My Library", `user.id` is the parent's user record, not the enrolled student's user record. `LibraryMember` is registered against the student's `user_id`. Thus, parents saw 0 books issued even if their child has active book loans.
- **Fix:** In `backend/app/routes/student.py:550` (`my_student_library`), resolve `effective_student` and query `LibraryMember` using `effective_student.user_id` when the caller is a `PARENT`.

---

## 4. UI/UX Design System Alignment (Salesforce SLDS + SAP Fiori)

### 4.1 Color System Architecture
Both dashboards must align with the enterprise design standards established in Edu-ERP:
- **SAP Fiori Surface:** Modern slate backgrounds (`#f8fafc` light, `#0b0f19` dark) with 0 gutter wastage.
- **Salesforce SLDS Brand Accents:**
  - Primary Action Blue: `#0176D3` / `#2563eb`
  - Success / Attendance Green: `#059669` / `#10b981`
  - Warning / Outstanding Amber: `#d97706` / `#f59e0b`
  - Danger / Absent Crimson: `#dc2626` / `#ef4444`
  - Slate Dark Mode Cards: `#111827` with 1px border `rgba(255,255,255,0.08)`.

### 4.2 Interactive Polish
- Ensure responsive cards wrap gracefully on tablet and mobile viewports.
- Maintain consistent border-radius (16px / 20px) and subtle box-shadows (`0 4px 20px rgba(0,0,0,0.03)`).
- Provide immediate visual confirmation and loading spinners across all asynchronous operations.

---

## 5. Remediation Plan & Execution Steps

| Step | File | Action |
| :--- | :--- | :--- |
| **1** | `backend/app/routes/curriculum.py` | Add `@curriculum_bp.route('/curriculum/teaching-diary/today')` and related aliases for `/history`, `/worksheets`, and `<int:log_id>`. |
| **2** | `backend/app/routes/hostel.py` | Add `'PARENT'` role to `@role_required` for `/out-passes` and `/complaints`. Support parent-initiated requests. |
| **3** | `backend/app/routes/student.py` | In `my_student_library()`, resolve `effective_student` for `PARENT` role so parents see child's library books. |
| **4** | `frontend/src/pages/dashboard/TeacherDashboard.jsx` | Fix 3 broken buttons: `navigate('/curriculum/coverage')`, `navigate('/assignments')`, `navigate('/my-hr')`. Add Exam Marks link in Marks tab. |
| **5** | `frontend/src/pages/dashboard/StudentDashboard.jsx` | Fix hostel and library requests to pass `student_id` in parent view. Pass `student_id` in gate pass & complaint submission modals. |
| **6** | Build & Test | Execute `react-scripts build` to guarantee zero syntax or compilation errors. |
