# Comprehensive EduERP Backend & Web App Blueprint

## Architecture Overview
- **Total Backend Endpoints**: **722 API Endpoints** across **28 Blueprints**
- **Total Database Models**: **31 Model Categories** in `backend/app/models/`
- **Total Enterprise Services**: **22 Services** in `backend/app/services/`
- **Total Web Pages & Modules**: **53 Pages across 16 Dedicated Modules** in `frontend/src/pages/`

---

## Part 1: Exact Screen-by-Screen Mapping of Your UI Mockup

| Screen # | Mockup Screen Name | Backend Route & HTTP Method | Controller File | Request Payload / Query Params | Response Data Shape |
|---|---|---|---|---|---|
| **1** | **Splash Screen** | `GET /api/auth/me` | `backend/app/routes/auth.py` | Header: `Authorization: Bearer <token>` | `{ id, name, email, role, school_id, active_role, permissions }` (Auto-navigates if token valid) |
| **2** | **Login Screen** | `POST /api/auth/login`<br>`POST /api/auth/student-login`<br>`POST /api/auth/forgot-password` | `backend/app/routes/auth.py` | `{ identifier, password, school_slug }`<br>Student: `{ phone, name, password, father_name }` | `{ access_token, refresh_token, user: { id, name, role, school } }` |
| **3** | **Principal Dashboard** | `GET /api/principal/dashboard`<br>`GET /api/principal/fees/summary`<br>`GET /api/notifications` | `backend/app/routes/principal.py`<br>`backend/app/routes/communication/notifications.py` | Query: `?academic_year=2024-25` | `{ total_students: 324, total_teachers: 28, total_classes: 12, students_present: 298, total_demand: 1250000, collected: 1080000, collection_rate: 92 }` |
| **4** | **Classes List** | `GET /api/principal/classes` | `backend/app/routes/principal.py` | Query: `?search=class&academic_year=2024-25` | `[ { id, name: "Class 1", section: "A", grade: 1, students_count: 28, academic_year: "2024-25" } ]` |
| **5** | **Add Class** | `POST /api/principal/classes`<br>`GET /api/principal/sessions` | `backend/app/routes/principal.py` | Body: `{ name: "Class 1", section: "A", grade: 1, academic_year: "2024-25" }` | `{ id: 15, message: "Class created successfully" }` |
| **6** | **Teachers List** | `GET /api/principal/teachers` | `backend/app/routes/principal.py` | Query: `?search=Rohit&department=Math` | `[ { id, name: "Rohit Agarwal", employee_id: "EMP001", subject: "Mathematics", email, phone, avatar_url } ]` |
| **7** | **Add Teacher** | `POST /api/principal/teachers`<br>`GET /api/hrms/departments`<br>`GET /api/hrms/designations` | `backend/app/routes/principal.py`<br>`backend/app/routes/hrms.py` | Body: `{ name, email, phone, employee_id, department, designation, subject, password }` | `{ id: 55, message: "Teacher account created" }` |
| **8** | **Students List** | `GET /api/principal/students`<br>`GET /api/principal/students/search` | `backend/app/routes/principal.py`<br>`backend/app/routes/student_lifecycle.py` | Query: `?class_id=5&section=A&search=Aarav` | `[ { id, name: "Aarav Sharma", roll_no: "1", class_name: "Class 5", section: "A", admission_no: "ADM202401", parent_name, parent_phone } ]` |
| **9** | **Add Student** | `POST /api/principal/students`<br>`POST /api/principal/students/direct-admission` | `backend/app/routes/student_lifecycle.py`<br>`backend/app/routes/principal.py` | Body: `{ name, email, class_id, roll_no, admission_no, parent_name, parent_phone, dob, gender }` | `{ id: 101, admission_no: "ADM202401", message: "Student enrolled" }` |
| **10** | **Menu / Profile & Logout** | `GET /api/auth/me`<br>`GET /api/principal/school/profile`<br>`POST /api/auth/logout` | `backend/app/routes/auth.py`<br>`backend/app/routes/principal.py` | Header token | Clears JWT & invalidates session |
| **11** | **Reports** | `GET /api/principal/reports/students`<br>`GET /api/principal/reports/attendance`<br>`GET /api/fees-finance/reports/collection-summary`<br>`GET /api/results/reports/tabulation` | `backend/app/routes/principal.py`<br>`backend/app/routes/fees_finance.py`<br>`backend/app/routes/result_management.py` | Query: `?academic_year=2024-25&class_id=...` | Formatted aggregations, PDF/Excel download payload |
| **12** | **Fees Management** | `GET /api/fees-finance/dashboard/summary`<br>`GET /api/fees-finance/dues/class-wise`<br>`POST /api/fees-finance/payments/collect` | `backend/app/routes/fees_finance.py`<br>`backend/app/services/fee_ledger_service.py` | Query: `?status=all` | `{ total_demand: 1250000, total_collected: 1080000, collection_percentage: 86.4, classes: [ { class_name: "Class 1", due: 120000 }, ... ] }` |
| **13** | **Examinations** | `GET /api/results/terms`<br>`GET /api/results/terms/<id>/timetable`<br>`GET /api/marks/roster`<br>`POST /api/marks/bulk-save`<br>`POST /api/results/admit-cards/generate`<br>`GET /api/results/report-cards` | `backend/app/routes/result_management.py`<br>`backend/app/routes/marks.py` | Query: `?class_id=...&term_id=...` | Exam dates, student mark roster, printable admit card & report card data |
| **14** | **Settings** | `GET/PUT /api/principal/school/profile`<br>`GET /api/principal/sessions`<br>`PUT /api/auth/change-password`<br>`GET/POST /api/support/tickets` | `backend/app/routes/principal.py`<br>`backend/app/routes/auth.py`<br>`backend/app/routes/communication/tickets.py` | Body: Profile fields, password updates | Profile state, active session switch, support ticket ID |
| **15** | **Logout Modal** | `POST /api/auth/logout` | `backend/app/routes/auth.py` | None | `{ message: "Logged out successfully" }` |

---

## Part 2: Complete Web App Feature & Enterprise Modules Deep Dive
*(These are already fully built in your backend & web app, ready for full mobile UI screens)*

### 1. 🏢 Hostel & Residential Management (`/api/hostel` — 75 Endpoints)
- **Frontend Pages**: `HostelDashboard.jsx`, `HostelSetup.jsx`, `HostelRoomMap.jsx`, `HostelAdmission.jsx`, `HostelAttendance.jsx`, `HostelOutPass.jsx`, `HostelComplaints.jsx`, `HostelFees.jsx`, `HostelVisitors.jsx`, `HostelTransfers.jsx`.
- **Backend File**: `backend/app/routes/hostel.py`, `backend/app/services/hostel_fee_service.py`
- **Key Endpoints**:
  - `GET /api/hostel/buildings`, `POST /api/hostel/buildings`
  - `GET /api/hostel/rooms`, `GET /api/hostel/rooms/<id>/beds`
  - `POST /api/hostel/allocations` (Student bed allocation)
  - `GET /api/hostel/roll-call`, `POST /api/hostel/roll-call/mark` (Night hostel attendance)
  - `GET /api/hostel/out-passes`, `PATCH /api/hostel/out-passes/<id>/status` (Approve/Reject gatepass)
  - `GET /api/hostel/complaints`, `PATCH /api/hostel/complaints/<id>/resolve` (Plumbing/Electrical issues)
  - `POST /api/hostel/visitors` (Log visitor entry & exit)
  - `POST /api/hostel/transfers` (Shift student between rooms/beds)

### 2. 🚌 Transport, Fleet & Live GPS (`/api/transport` — 85 Endpoints)
- **Frontend Pages**: `TransportDashboard.jsx`, `Vehicles.jsx`, `Drivers.jsx`, `Conductors.jsx`, `RouteBuilder.jsx`, `Stops.jsx`, `StudentTransport.jsx`, `LiveTracking.jsx`, `VehicleMaintenance.jsx`, `TransportFees.jsx`.
- **Backend Files**: `backend/app/routes/transport.py`, `transport_gps.py`, `transport_student.py`, `transport_reports.py`
- **Key Endpoints**:
  - `GET/POST /api/transport/vehicles` (Buses, vans, registration, fitness certificate, insurance)
  - `GET/POST /api/transport/drivers`, `conductors`
  - `GET/POST /api/transport/routes`, `GET/POST /api/transport/stops` (Route builder with stops & pickup timings)
  - `POST /api/transport/student-allocations` (Assign student to route & stop)
  - `GET /api/transport/gps/live/<vehicle_id>` (Realtime latitude/longitude, speed & heading)
  - `POST /api/transport/gps/ping` (Driver phone / GPS tracker telemetry ping)
  - `GET/POST /api/transport/maintenance` (Fuel logs, service history, tyre changes)
  - `GET /api/transport/parent/track` (Live tracking for parents on mobile)

### 3. 📚 Library Management System (`/api/library` — 50 Endpoints)
- **Frontend Pages**: `library/LibraryDashboard.jsx`, `library/BookCatalog.jsx`, `library/IssueReturn.jsx`, `library/Fines.jsx`, `library/Members.jsx`.
- **Backend File**: `backend/app/routes/library.py`, `backend/app/services/library_fee_service.py`
- **Key Endpoints**:
  - `GET /api/library/books`, `POST /api/library/books` (ISBN, Title, Author, Category, Copies count)
  - `GET /api/library/books/search?query=...`
  - `POST /api/library/issue` (Issue book to student or staff by barcode/ID)
  - `POST /api/library/return` (Return book, calculate overdue days)
  - `GET /api/library/fines`, `POST /api/library/fines/<id>/waive` or `collect`
  - `GET /api/library/members/<id>/active-books`

### 4. 👥 HRMS & Payroll Engine (`/api/hrms` — 40 Endpoints)
- **Frontend Pages**: `hrms/HRMSDashboard.jsx`, `hrms/Employees.jsx`, `hrms/Payroll.jsx`, `hrms/Leaves.jsx`, `hrms/Departments.jsx`.
- **Backend Files**: `backend/app/routes/hrms.py`, `backend/app/services/payroll_engine.py`, `hrms_service.py`
- **Key Endpoints**:
  - `GET /api/hrms/employees`, `POST /api/hrms/employees` (Full staff directory & records)
  - `GET/POST /api/hrms/salary-structures` (Basic, HRA, DA, PF, ESIC, Tax, Deductions)
  - `POST /api/hrms/payroll/generate` (Auto-calculate monthly payroll with attendance deductions)
  - `GET /api/hrms/payroll/slips/<employee_id>/<month>` (Downloadable salary payslip)
  - `GET /api/hrms/leaves`, `POST /api/hrms/leaves/apply` (Casual, Sick, Maternity leave)
  - `PATCH /api/hrms/leaves/<id>/action` (Approve / Reject leave application)

### 5. 📍 Staff Geo-fenced & Biometric Attendance (`/api/staff-attendance` — 20 Endpoints)
- **Backend Files**: `backend/app/routes/staff_attendance.py`, `backend/app/services/staff_attendance_service.py`
- **Key Endpoints**:
  - `POST /api/staff-attendance/check-in` (GPS latitude & longitude check with school geo-fence validation)
  - `POST /api/staff-attendance/check-out`
  - `GET /api/staff-attendance/my-status` (Today's check-in/out time and hours worked)
  - `GET /api/staff-attendance/monthly-summary` (Monthly attendance calendar & late arrivals)
  - `GET /api/staff-attendance/dashboard` (Principal/HR real-time staff present/absent count)

### 6. 🔄 Teacher Proxy & Delegation Engine (`/api/delegations` — 7 Endpoints)
- **Frontend Pages**: `delegations/DelegationsPage.jsx`, `CreateDelegationWizardModal.jsx`.
- **Backend Files**: `backend/app/routes/delegations.py`, `backend/app/services/teacher_delegation_service.py`
- **Key Endpoints**:
  - `GET /api/delegations/active` (Currently active teacher delegations)
  - `POST /api/delegations/create` (Assign substitute teacher for specific classes & periods)
  - `GET /api/delegations/my-delegated-classes` (Classes substitute teacher needs to take)

### 7. 🎓 Admissions, Student Lifecycle & Documents (`/api/principal/students` — 35 Endpoints)
- **Frontend Pages**: `NewAdmissionPage.jsx` (291KB complete admission wizard!), `ProvisionalAdmissionsPage.jsx`, `DocumentsPage.jsx`, `IDCardPage.jsx`.
- **Backend File**: `backend/app/routes/student_lifecycle.py`, `backend/app/routes/academic_resources.py`
- **Key Endpoints**:
  - `POST /api/principal/students/admission-inquiry` (Lead capture)
  - `POST /api/principal/students/full-admission` (Multi-step admission with parents, address, previous school)
  - `POST /api/principal/students/<id>/documents` (Upload Aadhar, Birth Certificate, Transfer Certificate)
  - `POST /api/principal/students/<id>/generate-id-card` (Printable student ID card)
  - `POST /api/principal/students/<id>/issue-tc` (Transfer certificate issuance)
  - `GET /api/principal/students/<id>/academic-timeline` (Complete multi-year student dossier)

### 8. 📖 Curriculum, Syllabus & Study Notes (`/api/academic` & `/api/curriculum` — 36 Endpoints)
- **Frontend Pages**: `NotesPage.jsx`, `AssignmentsPage.jsx`, `TimetablePage.jsx`, `academics/SyllabusPage.jsx`.
- **Backend Files**: `backend/app/routes/academic_resources.py`, `curriculum.py`
- **Key Endpoints**:
  - `GET/POST /api/academic/notes` (Subject study material & PDFs)
  - `GET/POST /api/academic/assignments` (Teacher homework assignments & student submission portal)
  - `GET/POST /api/curriculum/syllabus` (Term-wise chapters, learning objectives, completion %)
  - `GET/POST /api/principal/timetables` (Period-wise weekly class schedule)

### 9. 📢 Omnichannel Communication & WhatsApp (`/api/support` & `/api/webhooks` — 17 Endpoints)
- **Frontend Pages**: `communication/AnnouncementsPage.jsx`, `TicketsPage.jsx`, `ChatPage.jsx`.
- **Backend Files**: `backend/app/routes/communication/*.py`, `whatsapp_settings.py`
- **Key Endpoints**:
  - `GET/POST /api/support/announcements` (Targeted circulars to Students, Teachers, or Parents)
  - `GET/POST /api/support/tickets` (Parent/Staff grievance ticketing system)
  - `POST /api/principal/whatsapp/send-bulk` (Automated WhatsApp fee reminders & absence notices)
  - `POST /api/webhooks/whatsapp` (Inbound WhatsApp message handler)

### 10. 👑 Multi-School Cloud Platform Super Admin (`/api/admin` — 27 Endpoints)
- **Frontend Pages**: `SchoolsPage.jsx`, `SchoolDetailPage.jsx`, `UsersPage.jsx`.
- **Backend File**: `backend/app/routes/admin.py`, `backend/app/services/school_lifecycle_service.py`
- **Key Endpoints**:
  - `GET/POST /api/admin/schools` (Onboard new school branch / institution)
  - `GET /api/admin/schools/<id>/kpis` (Cross-branch student/staff counts & fee collections)
  - `PATCH /api/admin/schools/<id>/status` (Suspend / Activate tenant instance)
  - `GET /api/admin/subscriptions` (SaaS license plans & expiry tracker)
