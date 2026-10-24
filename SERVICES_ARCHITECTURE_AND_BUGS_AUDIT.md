# EDU-ERP MASTER SERVICES ARCHITECTURE & BUG AUDIT REPORT
**Generated:** October 2026  
**Auditor:** Principal Backend ERP & Systems Architect  
**Scope:** Complete deep forensic analysis of all 31 backend services across Edu-ERP (`backend/app/services/`).

---

## EXECUTIVE SUMMARY

A comprehensive, service-by-service architectural and code audit was conducted on all **31 services** within the Edu-ERP backend. The audit verified:
1. **Database Table & Model Linkages:** Detecting connections to non-existent, legacy, or dead models.
2. **Multi-Tenant Scoping (`school_id`):** Ensuring tenant isolation prevents cross-school data pollution or leakage.
3. **Runtime Crash Hazards:** Finding broken imports, missing functions, or undefined variables.
4. **Performance & Concurrency Pitfalls:** Uncovering $O(N^2)$ memory loads, un-indexed queries, and transaction locking traps.
5. **Ledger & Accounting Alignment:** Verifying that transactional services properly sync with the canonical central finance system (`FeeBill`, `FeePayment`, `StudentLedger`, `Expense`).

### High-Impact Bugs Identified & Remediated:
| Severity | Service | Bug Description | Impact | Remediation Status |
|---|---|---|---|---|
| **CRITICAL** | `curriculum_service.py` | Line 256 imports non-existent `PeriodSubstitution` from `app.models.financial`. Model does not exist anywhere. | Calling `get_teacher_today_schedule` crashes with `ImportError`. | Fixed: Replaced with `TimetableSubstitution` from `app.models.timetable`. |
| **HIGH** | `archive_service.py` | Line 655 imports non-existent `HostelFineTransaction` instead of `HostelFineRecord`. Silently caught by `_safe_exec`. | Unpaid hostel fines are ignored; students with debt can be deleted. | Fixed: Updated to `HostelFineRecord`. |
| **HIGH** | `archive_service.py` | Line 711 imports `InternalMark` from `app.models.academic_resources` instead of `InternalMarks` from `app.models.academic`. | Internal marks of permanently deleted students are orphaned in DB. | Fixed: Updated to `from app.models.academic import InternalMarks`. |
| **HIGH** | `arrival_service.py` | `_find_linked_parent` loads all active parent users in the school into memory (`User.query.filter_by(role=PARENT).all()`) and loops in Python. | $O(N^2)$ memory load during morning arrival scan (1,000 scans $\times$ 1,500 parents = 1.5M objects loaded). | Fixed: Converted to indexed SQL query (`phone` / `email`). |
| **MEDIUM** | `admission_service.py` | `generate_official_admission_no` counts all active students across school history without filtering by year prefix. | New session starts with high sequences (e.g. `ADM-2026-0501` instead of `ADM-2026-0001`). | Fixed: Filter sequence by `ADM-{year_prefix}-%`. |
| **MEDIUM** | `audit_service.py` | `record_audit_event` invokes unconditional `db.session.commit()` on success and `db.session.rollback()` on error. | Commits callers' unfinished transactions prematurely or rolls them back on audit glitch. | Fixed: Added `commit=True` parameter and savepoint protection. |
| **MEDIUM** | `migration_service.py` | Opening balance migration creates `StudentLedger` debit only if `sync_fee_record_to_bill` throws an exception. | Normal migrations omit `StudentLedger` opening balance debit row. | Fixed: Always record opening balance in `StudentLedger`. |
| **LOW** | `substitute_service.py` & `payroll_engine.py` | Imported `Timetable`, `TimetablePeriod`, `TimetableSubstitution`, `Holiday` from `financial.py`. | Architectural debt; relies on re-export bridges in `financial.py`. | Fixed: Decoupled to canonical `app.models.timetable`. |

---

## SERVICE-BY-SERVICE DEEP AUDIT MATRIX

---

### 1. `admission_service.py`
- **File Path:** `backend/app/services/admission_service.py`
- **Purpose:** Manages monotonic provisional and official student admission numbers, student promotion from unconfirmed/provisional to confirmed/active status.
- **Models & Tables Used:**
  - `Student` (`students`)
  - `StudentEnrollment` (`student_enrollments`)
- **Key Functions:**
  - `generate_provisional_admission_no(school_id, session_str)`
  - `generate_official_admission_no(school_id, session_str)`
  - `promote_provisional_student(student)`
- **Architectural Findings & Bugs:**
  - **Bug Found:** In `generate_official_admission_no`, the sequence counter was `Student.query.filter_by(school_id=school_id).filter(Student.status != 'PROVISIONAL').count()`. This ignored the academic session year prefix, unlike `generate_provisional_admission_no`. If a school had 800 students from 2024–2025, a student admitted in 2026 received `ADM-2026-0801` instead of `ADM-2026-0001`.
  - **Fix:** Filter sequence count by `Student.admission_no.like(f"ADM-{year_prefix}-%")`.

---

### 2. `archive_service.py`
- **File Path:** `backend/app/services/archive_service.py`
- **Purpose:** Central soft-delete, data retention policy (1-year lock window), and permanent cascading purge engine for Students, Teachers, and Staff.
- **Models & Tables Used:**
  - `Student`, `Teacher`, `User`, `Attendance`, `Marks`, `InternalMarks`
  - `FeeRecord`, `FeePayment`, `StudentLedger`, `TransportFeeRecord`, `HostelBed`, `HostelFineRecord`
- **Key Functions:**
  - `archive_student(student_id, user_id, reason)`
  - `restore_student(student_id, user_id)`
  - `permanently_delete_student(student_id, user_id)`
  - `_check_student_financial_history(student_id)`
  - `_cleanup_student_operational_records(student, user)`
- **Architectural Findings & Severe Bugs:**
  - **Severe Bug 1 (Line 655):** `from app.models.hostel import HostelFineTransaction`. The class in `app/models/hostel.py` is named `HostelFineRecord`. Because `_safe_exec` caught the `ImportError` and returned `None`, any student with unpaid hostel fines passed the financial check, allowing permanent deletion of indebted students.
  - **Severe Bug 2 (Line 711):** `from app.models.academic_resources import InternalMark`. The model is `InternalMarks` in `app/models/academic.py`. The cleanup failed silently, leaving orphaned internal marks in `internal_marks` table.
  - **Fix:** Correct both import paths and class names.

---

### 3. `arrival_service.py`
- **File Path:** `backend/app/services/arrival_service.py`
- **Purpose:** RFID/QR/Gatekeeper student physical arrival recording, parent notifications, and interactive YES/NO confirmation lifecycle.
- **Models & Tables Used:**
  - `StudentArrivalEvent` (`student_arrival_events`)
  - `Student` (`students`)
  - `User` (`users`)
  - `SupportNotification` (`support_notifications`)
- **Key Functions:**
  - `ArrivalService.record_arrival(school_id, student_id, ...)`
  - `ArrivalService.process_parent_response(event_id, ...)`
  - `_find_linked_parent(student, school_id)`
- **Architectural Findings & Performance Trap:**
  - **Severe N+1 Performance Trap:** `_find_linked_parent` loaded all active parent users in the school into memory (`User.query.filter_by(school_id=school_id, role=UserRole.PARENT).all()`) and iterated through them in Python. On a morning gate scan with 1,000 students and 1,500 parents, this generated 1,000 queries loading 1.5 million ORM objects, causing severe CPU spikes and potential timeout.
  - **Fix:** Replace with targeted SQL filter queries on normalized phone and lowercased email.

---

### 4. `asset_service.py`
- **File Path:** `backend/app/services/asset_service.py`
- **Purpose:** Fixed asset register, barcode/tag assignment, depreciation schedules (Straight Line, Written Down Value), condition tracking, and maintenance expense linkage.
- **Models & Tables Used:**
  - `SchoolAsset` (`school_assets`)
  - `AssetConditionLog` (`asset_condition_logs`)
  - `AssetAssignmentHistory` (`asset_assignment_history`)
  - `Expense` (`expenses`)
- **Key Functions:**
  - `create_asset(...)`, `assign_asset(...)`, `log_asset_maintenance(...)`
  - `calculate_depreciation(...)`, `run_monthly_depreciation(...)`
- **Architectural Findings:**
  - Automatically posts maintenance costs as canonical `Expense` records (`source='ASSET_MAINTENANCE'`).
  - Strict tenant isolation enforced on all asset lookups.
  - Clean.

---

### 5. `audit_service.py`
- **File Path:** `backend/app/services/audit_service.py`
- **Purpose:** Enterprise-grade security and action audit logging, deep recursive payload diffing, and sensitive key redaction (`password`, `token`, `otp`, `secret`).
- **Models & Tables Used:**
  - `AuditLog` (`audit_logs`)
  - `CompanyActivityLog` (`company_activity_logs`)
- **Key Functions:**
  - `record_audit_event(...)`
  - `log_action(...)`
  - `compute_changed_fields(old_val, new_val)`
  - `_mask_sensitive_dict(d)`
- **Architectural Findings & Bug:**
  - **Transaction Side-Effect Bug:** `record_audit_event` executed `db.session.commit()` on success and `db.session.rollback()` on error. When called mid-transaction by outer services (e.g., student attendance marking, payroll slip generation), it committed prematurely or destroyed caller's pending operations if audit insertion failed.
  - **Fix:** Add a `commit=True` flag and protect the audit insert with a nested transaction/savepoint (`db.session.begin_nested()`).

---

### 6. `curriculum_service.py`
- **File Path:** `backend/app/services/curriculum_service.py`
- **Purpose:** Lesson planning, syllabus chapters, teaching topics, lesson diary entries, teacher daily timetable lookup.
- **Models & Tables Used:**
  - `CurriculumChapter`, `CurriculumTopic`, `TeachingLog`
  - `Class`, `Subject`, `Teacher`
  - `Timetable`, `TimetablePeriod`, `TimetableSubstitution`
- **Critical Crash Bug:**
  - **Crash Bug (Line 256):** `from app.models.financial import PeriodSubstitution`. `PeriodSubstitution` does NOT exist in `financial.py` or anywhere in the codebase! The canonical substitution model is `TimetableSubstitution` in `app/models/timetable.py`. Calling `get_teacher_today_schedule` crashed at runtime with `ImportError`.
  - **Fix:** Import `TimetableSubstitution`, `Timetable`, and `TimetablePeriod` from `app.models.timetable`.

---

### 7. `delegation_service.py`
- **File Path:** `backend/app/services/delegation_service.py`
- **Purpose:** Temporary RBAC role delegation (e.g., Teacher covering as Accountant), hierarchy rank checks, auto-expiry, and audit logging.
- **Models & Tables Used:**
  - `Role` (`roles`), `UserRoleAssignment` (`user_role_assignments`)
  - `TemporaryRoleDelegation` (`temporary_role_delegations`), `User` (`users`)
- **Key Functions:**
  - `create_delegation(delegator, delegatee_user_id, role_key, end_date, ...)`
  - `revoke_delegation(delegation_id, revoker_user, ...)`
  - `expire_active_delegations()`
- **Architectural Findings:**
  - Includes `_get_user_roles_with_legacy_fallback()` to handle accounts where role is stored as legacy `UserRole` enum.
  - Prevents delegation of protected administrative roles (`PRINCIPAL`, `DIRECTOR`, `SUPER_ADMIN`).
  - Clean.

---

### 8. `fee_central_service.py`
- **File Path:** `backend/app/services/fee_central_service.py`
- **Purpose:** Dual-engine bridge ensuring bi-directional synchronization between legacy `FeeRecord` (V1) and canonical Central Finance `FeeBill` / `FeeBillItem` (V2).
- **Models & Tables Used:**
  - `FeeRecord` (`fee_records`), `FeeTransaction` (`fee_transactions`)
  - `FeeBill` (`fee_bills`), `FeeBillItem` (`fee_bill_items`), `StudentLedger` (`student_ledgers`)
- **Key Functions:**
  - `sync_fee_record_to_bill(fee_record)`
  - `sync_bill_to_fee_record(bill)`
  - `sync_payment_to_transaction(payment, bill, ...)`
- **Architectural Findings:**
  - Maintains idempotency; avoids infinite recursive sync loops using context flags.
  - Clean.

---

### 9. `fee_ledger_service.py`
- **File Path:** `backend/app/services/fee_ledger_service.py`
- **Purpose:** Core financial ledger engine of Edu-ERP (V2). Generates student bills, fee structures, service charges (Hostel, Transport, Library), payment collections, fee head allocations, double-entry ledger bookkeeping.
- **Models & Tables Used:**
  - `FeeHead`, `FeeStructureV2`, `FeeStructureItemV2`
  - `FeeBill`, `FeeBillItem`, `StudentLedger`, `FeePayment`, `FeePaymentAllocation`
- **Key Functions:**
  - `generate_student_bill(...)`, `collect_fee_payment(...)`
  - `register_or_sync_service_charge(...)`, `reconcile_school_fee_balances(...)`
- **Architectural Findings:**
  - Fully remediated in prior milestone (100% test coverage).
  - Clean.

---

### 10. `fee_service_intelligence.py`
- **File Path:** `backend/app/services/fee_service_intelligence.py`
- **Purpose:** Fee generation intelligence, class-wise fee breakdowns, batch draft-to-publish workflows, student payment matrices.
- **Models & Tables Used:**
  - `FeeRecord`, `FeeGenerationBatch` (`fee_generation_batches`)
  - `FeeBill`, `FeeBillItem`, `FeePayment`, `StudentLedger`
- **Key Functions:**
  - `get_academic_class_breakdown(school_id, month_code, ...)`
  - `get_service_generation_overview(school_id, month_code, ...)`
- **Architectural Findings:**
  - Acts as an intelligent read-aggregation layer across V1 and V2 fee architectures.
  - Clean.

---

### 11. `finance_aggregation_service.py`
- **File Path:** `backend/app/services/finance_aggregation_service.py`
- **Purpose:** Real-time financial metrics for executive dashboards (total revenue, collected fees, outstanding dues, monthly breakdown, expense totals).
- **Models & Tables Used:**
  - `FeePayment`, `FeeBill`, `FeeRecord`, `Expense`
- **Key Functions:**
  - `get_comprehensive_financial_kpis(school_id, ...)`
  - `get_financial_dashboard_summary(school_id, ...)`
- **Architectural Findings:**
  - Fully remediated in prior milestone; handles V1 and V2 reconciliation.
  - Clean.

---

### 12. `hostel_fee_service.py`
- **File Path:** `backend/app/services/hostel_fee_service.py`
- **Purpose:** Hostel fee calculation based on room type, AC status, sharing type; coverage period calculations; fine creation and payment collection.
- **Models & Tables Used:**
  - `HostelFeeStructure`, `HostelBed`, `HostelFineRecord`
  - `FeeRecord`, `FeeTransaction`
- **Key Functions:**
  - `resolve_fee_structure(bed)`
  - `generate_hostel_fee_record(allocation, ...)`
  - `record_hostel_fine_payment(...)`
- **Architectural Findings:**
  - Employs specificity matching: Floor-level > Building-level > Hostel-wide.
  - Auto-syncs charges to Central Finance via `register_or_sync_service_charge`.
  - Clean.

---

### 13. `hrms_service.py`
- **File Path:** `backend/app/services/hrms_service.py`
- **Purpose:** Complete HR employee lifecycle, employee profile creation, departments, designations, shifts, documents, leave requests and approvals.
- **Models & Tables Used:**
  - `EmployeeProfile`, `EmployeeDepartment`, `EmployeeDesignation`
  - `Shift`, `EmployeeShiftAssignment`, `LeaveRequest`, `LeaveBalance`, `OfficialDuty`
- **Key Functions:**
  - `create_employee(school_id, data, ...)`, `update_employee(...)`
  - `apply_leave(...)`, `approve_leave(...)`
- **Architectural Findings:**
  - Automatically provisions `Teacher` profile when role is `TEACHER`.
  - Syncs approved leaves with staff attendance and payroll calculations.
  - Clean.

---

### 14. `library_fee_service.py`
- **File Path:** `backend/app/services/library_fee_service.py`
- **Purpose:** Library fine management, overdue charges, book damage/lost penalties, payment collection.
- **Models & Tables Used:**
  - `FineTransaction` (`fine_transactions`), `LibraryMember` (`library_members`)
  - `Student` (`students`), `FeeRecord`, `FeeTransaction`
- **Key Functions:**
  - `generate_library_fine_fee_record(fine_txn, ...)`
  - `record_library_fine_payment(fine_txn, ...)`
  - `sync_library_fine_from_fee_record(fee_record, ...)`
- **Architectural Findings:**
  - Atomically syncs with `register_or_sync_service_charge` and `collect_fee_payment`.
  - Generates unique library receipt vouchers.
  - Clean.

---

### 15. `migration_service.py`
- **File Path:** `backend/app/services/migration_service.py`
- **Purpose:** Bulk onboarding and data migration engine from legacy CSV/Excel spreadsheets to Edu-ERP.
- **Models & Tables Used:**
  - `MigrationBatch`, `MigrationRecord`
  - `Student`, `StudentEnrollment`, `Class`, `FeeRecord`, `StudentLedger`
- **Key Functions:**
  - `parse_rows_from_stream(file_bytes, filename)`
  - `validate_migration_payload(...)`
  - `execute_migration_batch(...)`
  - `get_migration_reconciliation_summary(batch_id, school_id)`
- **Architectural Findings & Bug:**
  - **Issue:** When importing students with legacy opening balances, `sync_fee_record_to_bill` was called, but `StudentLedger` was only populated in the `except` fallback block. If `sync_fee_record_to_bill` succeeded, no `StudentLedger` opening debit was created.
  - **Fix:** Ensure `StudentLedger` opening balance debit is recorded reliably.

---

### 16. `notification_service.py` (Facade)
- **File Path:** `backend/app/services/notification_service.py`
- **Purpose:** Root service facade re-exporting `NotificationService` from `communication/notification_service.py` to preserve backward compatibility for legacy imports.
- **Status:** Clean facade.

---

### 17. `payroll_engine.py`
- **File Path:** `backend/app/services/payroll_engine.py`
- **Purpose:** Monthly payroll generation, payable day calculation, loss of pay (LOP) deductions, statutory components (PF, ESI, PT, TDS), approval lock, salary disbursement, and expense creation.
- **Models & Tables Used:**
  - `EmployeeSalaryStructure`, `PayrollRun`, `PayrollSlip`, `PayrollSlipItem`
  - `StaffAttendance`, `Holiday`, `Expense`
- **Key Functions:**
  - `generate_monthly_payroll(...)`, `approve_payroll_run(...)`
  - `pay_payroll_slip(...)`, `pay_payroll_run_all(...)`
- **Architectural Findings:**
  - Generates linked `Expense` records upon payment disbursement with `source='HRMS_PAYROLL'`.
  - Decoupled `Holiday` model import from `financial.py` to canonical `app.models.timetable`.
  - Clean.

---

### 18. `permission_resolver.py`
- **File Path:** `backend/app/services/permission_resolver.py`
- **Purpose:** Route security decorator (`@permission_required`), per-request cached permission evaluation via `flask.g`, and automated sync between legacy `User.role` enum and DB-driven `UserRoleAssignment`.
- **Models & Tables Used:**
  - `Role`, `UserRoleAssignment`, `Permission`, `Product`
- **Key Functions:**
  - `permission_required(*permission_keys)`
  - `role_or_permission_required(...)`
  - `ensure_role_assignment_for_user(user)`
  - `sync_legacy_role_assignments()`
- **Architectural Findings:**
  - Prevents N+1 database role evaluation per HTTP request by caching resolved permissions on `flask.g`.
  - Clean.

---

### 19. `pnl_service.py`
- **File Path:** `backend/app/services/pnl_service.py`
- **Purpose:** Comprehensive Profit and Loss (P&L) statements, revenue recognition (Tuition, Transport, Hostel, Library), operating expense categorizations, Cash vs Accrual accounting.
- **Models & Tables Used:**
  - `FeePayment`, `FeeRecord`, `FeeBill`, `Expense`
- **Key Functions:**
  - `generate_pnl_statement(school_id, period_type, ...)`
  - `get_pnl_summary(school_id, ...)`
- **Architectural Findings:**
  - Fully remediated and verified in prior turn.
  - Clean.

---

### 20. `procurement_service.py`
- **File Path:** `backend/app/services/procurement_service.py`
- **Purpose:** Procurement lifecycle: purchase requisitions, RFQs, purchase orders, goods receipt notes (GRN), inventory stock updates, vendor invoices and payments.
- **Models & Tables Used:**
  - `PurchaseOrder`, `PurchaseOrderItem`, `GoodsReceiptNote`, `GoodsReceiptItem`
  - `Vendor`, `Expense`, `StockItem`
- **Key Functions:**
  - `create_po_invoice_and_expense(po, ...)`
  - `record_vendor_payment(vendor_id, amount, ...)`
- **Architectural Findings:**
  - Fully remediated in prior turn; posts vendor disbursements into central `Expense` model.
  - Clean.

---

### 21. `reconciliation_service.py`
- **File Path:** `backend/app/services/reconciliation_service.py`
- **Purpose:** Auto-reconciliation of student ledgers vs bank statements vs fee bills, gap detection, automated repair.
- **Models & Tables Used:**
  - `StudentLedger`, `FeeBill`, `FeePayment`, `FeePaymentAllocation`, `FeeRecord`
- **Key Functions:**
  - `reconcile_student_ledger(student_id)`
  - `reconcile_school_finance(school_id)`
- **Architectural Findings:**
  - Fully remediated in prior turn.
  - Clean.

---

### 22. `school_lifecycle_service.py`
- **File Path:** `backend/app/services/school_lifecycle_service.py`
- **Purpose:** Multi-tenant school lifecycle management (Active -> Archived -> Permanent Delete), computing archive summaries, cascading deletion across 80+ tables in topological order.
- **Models & Tables Used:**
  - `School`, `User`, `Student`, and direct SQL cascading on all tables.
- **Key Functions:**
  - `archive_school(school_id, user_id, reason)`
  - `restore_school(school_id, user_id)`
  - `permanently_delete_school(school_id, user_id)`
  - `get_school_archive_summary(school_id)`
- **Architectural Findings:**
  - Highly robust 4-phase deletion ordering: Leaf child tables -> User sub-tables -> Circular FK nullifications -> Main ordered tables.
  - Clean.

---

### 23. `staff_attendance_service.py`
- **File Path:** `backend/app/services/staff_attendance_service.py`
- **Purpose:** Teacher and staff biometric/GPS campus check-in/out, geofence radius calculation, grace minutes, half-day threshold, overtime, shift timings, regularization requests.
- **Models & Tables Used:**
  - `StaffAttendance`, `StaffAttendanceSettings`, `StaffAttendanceRegularization`
  - `StaffAttendanceAuditLog`, `EmployeeShiftAssignment`
- **Key Functions:**
  - `check_in(user, latitude, longitude, ...)`, `check_out(user, ...)`
  - `finalize_working_status(record, settings)`
  - `get_user_shift_timings(user, on_date)`
- **Architectural Findings:**
  - Uses haversine distance formula with GPS accuracy compensation.
  - Shift timings take precedence over global settings when an active shift assignment exists.
  - Clean.

---

### 24. `student_attendance_service.py`
- **File Path:** `backend/app/services/student_attendance_service.py`
- **Purpose:** Classroom student daily attendance marking, teacher class assignment validation, future date restriction, idempotent updates, correction audit logging, and notification event emission.
- **Models & Tables Used:**
  - `Attendance` (`attendance`), `AttendanceCorrection` (`attendance_corrections`)
  - `Class`, `Student`, `Teacher`, `Subject`
- **Key Functions:**
  - `validate_teacher_class_assignment(user, cls)`
  - `validate_attendance_submission(...)`
  - `process_attendance_submission(...)`
- **Architectural Findings:**
  - Triggers asynchronous `attendance.absent` notification events only for newly absent students (deduplicated).
  - Clean.

---

### 25. `substitute_service.py`
- **File Path:** `backend/app/services/substitute_service.py`
- **Purpose:** Timetable collision detection (teacher double-booking, room clash), absent teacher identification from attendance and leaves, intelligent substitute teacher workload ranking and assignment.
- **Models & Tables Used:**
  - `Timetable`, `TimetablePeriod`, `TimetableSubstitution`
  - `Teacher`, `Subject`, `Class`, `StaffAttendance`, `LeaveRequest`
- **Key Functions:**
  - `validate_timetable_conflict(...)`
  - `get_absent_teachers_for_date(school_id, target_date)`
  - `get_substitute_suggestions(...)`
  - `assign_substitution(...)`
- **Architectural Findings:**
  - Decoupled imports from `app.models.financial` to canonical `app.models.timetable`.
  - Clean.

---

### 26. `teacher_delegation_service.py`
- **File Path:** `backend/app/services/teacher_delegation_service.py`
- **Purpose:** Academic temporary delegation (attendance marking, mark entry) from absent teacher to substitute teacher with class and subject scoping.
- **Models & Tables Used:**
  - `TeacherDelegation`, `TeacherDelegationScope`, `TeacherDelegationPermission`
  - `Teacher`, `Class`, `Subject`
- **Key Functions:**
  - `validate_delegation_request(...)`
  - `check_delegation_conflicts(...)`
  - `create_teacher_delegation(...)`
  - `revoke_teacher_delegation(...)`
- **Architectural Findings:**
  - Strictly enforces forbidden administrative permissions (`USER_CREATE`, `FEE_COLLECT`, `SETTINGS_EDIT`).
  - Validates school boundaries across delegator, delegatee, class, and subjects.
  - Clean.

---

### 27. `transport_fee_service.py`
- **File Path:** `backend/app/services/transport_fee_service.py`
- **Purpose:** School transport monthly fees, route-based fee structures, payment collection with double-payment mutex, fine creation and waivers.
- **Models & Tables Used:**
  - `StudentTransport`, `TransportFeeStructure`, `TransportFeeRecord`
  - `TransportFineRecord`, `FeeRecord`, `FeeTransaction`
- **Key Functions:**
  - `generate_transport_fee_record(assignment, ...)`
  - `record_transport_fee_payment(...)`
  - `waive_transport_fine(...)`
  - `sync_transport_from_fee_record(...)`
- **Architectural Findings:**
  - Thread-safe payment execution via mutex lock `_transport_payment_mutex`.
  - Automatically syncs charges to Central Finance via `register_or_sync_service_charge`.
  - Clean.

---

### 28. `communication/msg91_service.py`
- **File Path:** `backend/app/services/communication/msg91_service.py`
- **Purpose:** Outbound external communication gateway (SMS, Email, OTP) via MSG91 API.
- **Key Functions:**
  - `send_otp(mobile, otp, template_id)`
  - `send_sms_flow(mobile, flow_id, variables)`
  - `send_email(...)`
- **Architectural Findings:**
  - Never logs or exposes AuthKey or secret OTP values.
  - Supports automatic development/testing mock mode when MSG91 credentials are not present.
  - Clean.

---

### 29. `communication/notification_service.py`
- **File Path:** `backend/app/services/communication/notification_service.py`
- **Purpose:** Multi-tenant notification dispatcher (in-app bell, SMS, push) writing to `SupportNotification` (`support_notifications` table).
- **Models & Tables Used:**
  - `SupportNotification`, `User`, `UserDevice`
- **Key Functions:**
  - `send_notification(user_id, title, message, ...)`
  - `broadcast_school_notification(...)`
  - `broadcast_platform_notification(...)`
- **Architectural Findings:**
  - Uses `SupportNotification` (`support_notifications`) as the unified in-app notification table.
  - Push dispatcher integration delegates to `PushDispatcher` (Expo mobile push and web push).
  - Clean.

---

### 30. `communication/otp_service.py`
- **File Path:** `backend/app/services/communication/otp_service.py`
- **Purpose:** Secure cryptographically salted OTP generation, verification, attempt tracking, and cooldown enforcement.
- **Models & Tables Used:**
  - `OTPVerification` (`otp_verifications`)
- **Key Functions:**
  - `generate_otp(length=6)`
  - `hash_otp(otp)`
  - `verify_otp_hash(raw_otp, stored_hash)`
  - `create_otp(identifier, purpose, ...)`
  - `verify_otp(identifier, entered_otp, purpose)`
- **Architectural Findings:**
  - Employs HMAC-SHA256 with backend secret salt and constant-time `hmac.compare_digest` to prevent timing attacks.
  - Auto-invalidates prior active OTPs upon resend.
  - Clean.

---

### 31. `notification/notification_engine.py` (& Submodules)
- **File Path:** `backend/app/services/notification/`
  - `notification_engine.py`
  - `event_emitter.py`
  - `push_provider.py`
  - `recipient_resolver.py`
  - `preference_checker.py`
  - `template_renderer.py`
- **Purpose:** Asynchronous event-driven notification architecture. Domain events (`attendance.absent`, `fees.collected`, `exam.published`) are matched against `NotificationRule`, rendered through `NotificationTemplate`, checked against user quiet hours and preferences, and dispatched to in-app bell and mobile devices.
- **Models & Tables Used:**
  - `SupportNotification`, `NotificationDeliveryLog`, `NotificationTemplate`, `NotificationRule`, `NotificationPreference`
- **Architectural Findings:**
  - Implements in-app deduplication window (suppresses duplicate notifications delivered within 15 seconds).
  - Tracks delivery receipts and provider responses in `NotificationDeliveryLog`.
  - Clean.

---

## REMEDIATION SUMMARY & VERIFICATION

All critical and high-priority bugs identified during the audit were remediated directly in code:
1. `curriculum_service.py`: Fixed `PeriodSubstitution` crash; imported `TimetableSubstitution` and timetable models from canonical `app.models.timetable`.
2. `archive_service.py`: Fixed `HostelFineTransaction` to `HostelFineRecord` and `academic_resources.InternalMark` to `academic.InternalMarks`.
3. `arrival_service.py`: Optimized `_find_linked_parent` to use targeted SQL queries instead of full-table parent scans.
4. `admission_service.py`: Fixed admission sequence counting to respect academic year prefix.
5. `audit_service.py`: Added `commit=True` option and savepoint isolation.
6. `substitute_service.py` & `payroll_engine.py`: Cleaned up imports from `app.models.timetable`.
7. `migration_service.py`: Ensured opening balances write properly to `StudentLedger`.
