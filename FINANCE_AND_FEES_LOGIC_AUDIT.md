# EduERP Complete Finance & Fees Logic Audit
**Document Version:** 7.0.0 (Forensic Full-Stack, HRMS & Cross-Departmental Architecture Audit)  
**Date:** October 18, 2026  
**Audited Modules & Services:** `Accountant Dashboard`, `Finance Command Center`, `Student Dashboard`, `Parent Portal`, `Teacher Dashboard & My HR`, `Hostel & Warden Dashboard`, `Transport Dashboard`, `Library Dashboard`, `Admissions & Provisional Workflow`, `Examinations & Admit Card Gating`, `HRMS & Payroll Engine`, `Procurement & Asset Register`, `Bank & Gateway Reconciliation`, `SuperAdmin SaaS Subscriptions`, `Finance Aggregation Service`, `PnL Service`, `Migration Service`, `Fee Central Service`, `Fee Service Intelligence`, `Archive Service`, `Fee Refund & Cancellation Engine`, `Staff Attendance & Regularization`, `Staff Advances & Full & Final Settlement`  
**Scope:** Forensic, line-by-line identification of flawed business logic, recursive mathematical compounding proofs, double-entry ledger corruptions, missing authentication & IDOR vulnerabilities, cross-module financial leaks, ghost shadow tables, and race conditions across all sidebar services.

---

## Executive Summary & Forensic Matrix

A full-stack audit across every module in the application sidebar reveals that EduERP's financial inconsistencies, dashboard discrepancies, and reconciliation failures stem from deep-seated architectural fractures:

| Module / Service | Critical Technical Flaw Found | Financial & Operational Impact | Primary Code Location |
|---|---|---|---|
| **Accountant Dashboard** | Dueling dashboard routes (`AccountantDashboard.jsx` vs `FinanceDashboard.jsx`), month string parsing crash in `PnLService`. | Two different dashboards show conflicting revenue; monthly view drops dates and pulls all-time history. | `AccountantDashboard.jsx:130`, `pnl_service.py:149` |
| **Finance Aggregation** | Today's & Month collection sums modern `FeePayment` AND legacy `FeeTransaction` (`today_pay_sum + today_tx_sum`). | Every payment collected via central service is counted TWICE; dashboard shows 2x actual collected cash. | `finance_aggregation_service.py:303, 330, 343` |
| **Accrual P&L Engine** | Expense created on payment date + unpaid vendor bill balance added; unpaid staff payroll omitted. | Multi-period vendor bills double-counted across months (+60% error); unpaid staff salaries omitted from liabilities. | `pnl_service.py:214, 237`, `procurement_service.py:353` |
| **Fee Refund Engine** | `process_fee_refund` does not reduce `FeePayment`, does not reopen `FeeBill`, and creates no cash outflow entry. | Refunds never deducted from collected revenue in P&L or dashboards; ₹5 Lakhs in refunds ghosted from accounts. | `fee_ledger_service.py:1718-1760` |
| **Receipt Cancellation** | Reversal loops through allocations and over-deducts `amount_paid`; leaves `FeeTransaction` intact; resets `balance_after=0.0`. | Bill balance corrupted; cancelled receipts remain in legacy dashboards; student running balance destroyed. | `fee_ledger_service.py:1654-1675` |
| **Class Historical AR** | `class_id` missing from `FeeBill`, `FeePayment`, `StudentLedger`; reports dynamically join current `Student.class_id`. | Student promotion to next class retroactively alters all past years' class revenue; archiving deletes history. | `fee_finance.py:399, 536, 566`, `archive_service.py:477` |
| **Late Fine Automation** | Late fine columns exist in schema, but zero automated calculation or grace-period slab engine runs. | Overdue bills stay with ₹0.00 fine forever unless manually patched; school loses lakhs in late fees. | `fee_finance.py:410, 433`, `fee_central_service.py:187` |
| **Online Payment Gateway** | Zero backend gateway integration code (Razorpay/Cashfree order generation, webhooks, signature verification). | Online payment is completely non-functional; 100% of collections forced onto human counter cashiers. | `finance.py:878`, `StudentDashboard.jsx:1532` |
| **Cheque Dishonor Engine** | No cheque bounce / dishonor workflow exists to reverse banked collections or levy bank return penalties. | Bounced cheques remain permanently marked as collected cash; bank charges must be manually adjusted in DB. | `fee_ledger_service.py:1180` |
| **Caution Money / Escrow** | Refundable security deposits (Caution Money ₹5K–₹20K) booked as operating income instead of liabilities. | **[RESOLVED - Section 21]** `CautionMoneyDeposit` escrow liability subledger implemented; clearance preview offsets unpaid bills and refunds net balance via `CautionMoneyPage.jsx`. | `fee_finance.py:CautionMoneyDeposit`, `fee_ledger_service.py:1610`, `CautionMoneyPage.jsx` |
| **No-Dues TC Clearance** | Zero cross-module financial clearance gate before student withdrawal or Transfer Certificate (TC) generation. | Students withdraw with tens of thousands in unpaid tuition, hostel, and library dues without detection. | `documents.py:11`, `pdf_generator.py:541` |
| **Sibling Relationship** | `SIBLING` is a standalone enum string; zero database linking entity (`family_id` / `parent_id`) exists. | **[RESOLVED - Section 23]** `FamilyGroup` relational entity, student foreign key, progressive auto discount engine (1st: 0%, 2nd: 25%, 3rd+: 50%), heuristic clustering auto-detector, and `FamilyGroupsPage.jsx` UI implemented. | `fee_finance.py:FamilyGroup`, `academic.py:family_group_id`, `fee_ledger_service.py:1480`, `FamilyGroupsPage.jsx` |
| **GST & Tax Accounting** | `is_taxable` is a dormant boolean flag; zero tax rate slabs, CGST/SGST breakdowns, or ITC tracking exist. | School purchases and commercial activities pay 18% GST with zero input tax credit tracking or compliance. | `fee_finance.py:103`, `procurement_service.py:291` |
| **Triplicate Salary Conflict** | 3 competing salary disbursement paths (`payroll_engine.py`, `principal.py:540`, `principal.py:669`). | Dual `Expense` entries created under `HRMS_PAYROLL` & `SALARY_AUTO`; salary expense double-counted in P&L. | `principal.py:540, 669`, `payroll_engine.py:463` |
| **Gross vs Net Salary Flaw** | Expense records only `net_salary`; statutory deductions (PF, ESI, TDS, PT) completely omitted from P&L. | Operating labor expenses understated; employee tax & provident withholdings vanish into an unrecorded void. | `payroll_engine.py:468` |
| **Employer Statutory Deficit** | Zero computation or accrual of mandatory Employer EPF (12%) and Employer ESIC (3.25%) contributions. | School Cost-to-Company (CTC) understated by 15.25%; massive unbudgeted cash drains when monthly returns are paid. | `payroll_engine.py:263`, `hrms.py:857` |
| **Staff Loan & Advance Void** | Zero staff loan / salary advance ledger, recovery schedule, or balance sheet asset account exists. | Staff loans expensed or untracked; zero automated deduction during payroll; resignations cause unrecoverable bad debt. | `hrms_service.py:240`, `finance.py:141` |
| **Staff Ward Fee Concession** | No relational link between staff/teachers and student children; concessions entered as manual arbitrary discounts. | Exiting staff continue receiving 50-100% tuition waivers for years; staff welfare expense untracked in P&L. | `academic.py:178`, `hrms_service.py:381` |
| **Missing F&F Clearance** | Employee exit simply flips `is_active=False`; zero Full & Final settlement, asset recovery, or gratuity workflow. | Resigning teachers walk away with unrecovered loans and school laptops; zero leave encashment calculation. | `hrms_service.py:381-409`, `asset_service.py:130` |
| **Attendance Retroactive Drift** | Post-payroll attendance regularization or leave approval does not trigger arrears or retroactive adjustment. | Locked payroll forces permanent LOP deduction on regularized staff; no payroll arrears engine exists. | `payroll_engine.py:306`, `staff_attendance_service.py:87` |
| **Bulk Banking Export Void** | Zero corporate banking bulk disbursement file export (NEFT / RTGS / NACH CSV/Excel). | Accounts officer forced to manually re-type 100+ account numbers and IFSC codes into net banking portals. | `payroll_engine.py:520` |
| **Staff Reimbursement Void** | Zero out-of-pocket teacher expense claim submission, attachment verification, or reimbursement workflow. | Teachers forced to use informal cash drawers; zero audit trail for institutional purchases made by faculty. | `finance.py:141`, `hrms.py:1086` |
| **Income Tax TDS / Form 16** | Flat float `tds` field without Old/New tax regime selection, Section 80C/80D declarations, or Form 16 generation. | School non-compliant with Section 192 of Income Tax Act; cannot issue mandatory quarterly Form 16 certificates. | `hrms.py:698`, `payroll_engine.py:263` |
| **Finance Core (`FeeBill`)** | Recursive compounding of past arrears into `total_payable` + double-debiting arrears in `StudentLedger`. | ₹2,000 monthly fee compounds to ₹16,000 in 4 months (+100% error); Student Ledger inflates arrears twice. | `fee_ledger_service.py:857, 934, 1350`, `fee_finance.py:434` |
| **Central Fee Engine** | Broken running balance in `StudentLedger` (`balance_after = item.balance`); 7 competing payment collection functions. | Ledger running balance shows single item balance instead of cumulative AR; split receipts (`REC-`, `RCP-`, `FP-`). | `fee_central_service.py:223, 527, 563` |
| **HRMS Payroll Engine** | Pre-joining days penalized as unexcused absence at working-day rate; LWP treated as paid leave. | Mid-month joiners suffer >100% LOP deduction, resulting in ₹0 salary; unpaid leaves paid in full. | `payroll_engine.py:196, 230, 246, 259`, `hrms_service.py:555` |
| **Student & Parent Portal** | `my_fees` endpoint strictly queries legacy `FeeRecord`, completely ignoring `FeeBill` and `FeePayment`. | Students & parents cannot see modern fee bills or receipts; zero online payment checkout available. | `student.py:265`, `StudentDashboard.jsx:1532` |
| **Teacher & Staff HRMS** | Payslip PDF download uses unauthenticated `window.open()`; Employer PF/ESI & statutory tax omitted from expenses. | Teachers get 401 Unauthorized when clicking "Payslip PDF"; school payroll costs understated by 15-20%. | `StaffSelfService.jsx:443`, `hrms.py:1056`, `payroll_engine.py:468` |
| **Hostel & Warden** | Warden sees school-wide data; monthly billing writes to legacy `FeeRecord`; room assets bypass central register. | Wardens cannot view hostel-specific metrics; hostel fees split across engines; furniture escapes depreciation. | `HostelDashboard.jsx:19`, `hostel.py:1008, 1040`, `hostel_fee_service.py:168` |
| **Transport Module** | Shadow billing in `TransportFeeRecord`; central desk collections invisible; vehicle repairs bypass `Expense`. | Transport manager shows false dues for students who paid at counter; ₹50,000 bus overhauls vanish from P&L. | `transport_reports.py:51`, `transport_fee_service.py:150`, `transport.py:1036` |
| **Library Circulation** | Staff fines silently dropped (`not_a_student`); fine waiver updates `FeeRecord` but ignores `StudentLedger`. | Teachers never pay overdue fines; students still owe waived fines on modern billing engine (split state). | `library_fee_service.py:27`, `library.py:1164` |
| **Admissions & Provisional** | Promoting provisional student updates `admission_no` string but generates zero academic session bills. | Confirmed students left with ₹0 billing demand; pre-admission payments tied to orphaned `PROV-` numbers. | `admission_service.py:38-81`, `principal.py:1415, 1899` |
| **Fixed Assets & Scrap** | Asset scrap/disposal revenue (`disposal_amount`) bypasses Central Finance; cash hardcoded in repairs. | Sale of old buses/computers yields unrecorded cash; no loss-on-disposal or depreciation schedules exist. | `asset_service.py:165, 195, 212` |
| **Data Migration Service** | If `sync_fee_record_to_bill` fails, opening balance creates standalone ledger entry without `FeeBillItem`. | Migrated student balances cannot be settled through online payment gateway or standard fee bill checkout. | `migration_service.py:585-604` |
| **Examinations Gating** | `admit_card_pdf` and bulk generation have zero financial dues verification or gating threshold. | Students with ₹50,000+ in unpaid tuition/hostel/transport arrears sit for exams; school loses fee recovery lever. | `principal.py:4049, 4076`, `StudentDashboard.jsx:2787` |
| **Concessions & Waivers** | Fixed discounts (e.g. ₹500) deducted from every item of every bill in a loop; deletion leaves reduced bills. | A ₹500 sibling concession deducts ₹6,000 across 3 bills; deleting concession leaves unauthorized discounts. | `fee_ledger_service.py:1584`, `fees_finance.py:1076` |
| **Procurement & Fixed Assets** | All vendor bills unconditionally booked as `INVENTORY_PURCHASE` consumable OPEX. | ₹25,00,000 School Bus purchase is fully expensed in month 1, artificially driving net profit into massive loss. | `procurement_service.py:353` |
| **Bank Reconciliation** | Fuzzy matching arbitrarily pairs same-amount deposits to random students; salary payouts invisible. | Student A's fee is credited to Student B; all salary bank debits flagged as `MISSING_IN_ERP`. | `reconciliation_service.py:418, 449` |
| **Security & Privacy** | IDOR vulnerability on student financial ledger endpoint (`GET /api/fees-finance/students/<id>/ledger`). | Any authenticated student can inspect fee bills, parent income statements, and concessions of any peer. | `fees_finance.py:1155` |
| **Data Types & Concurrency** | All monetary amounts stored as IEEE-754 `Float`; sequence generation uses `.count() + 1` without DB locks. | Binary floating-point rounding drift stops bills from closing; concurrent counter payments collide or double-credit. | `fee_finance.py:407-414`, `fee_ledger_service.py:882, 1187` |

---

---

---

## 1. Deep Dive: The Core Mathematical Compounding & Ledger Corruption

### 1.1 Recursive Exponential Compounding of Previous Dues
* **Source Locations:**
  * `backend/app/services/fee_ledger_service.py` (lines 851–857 and 1344–1353)
  * `backend/app/models/fee_finance.py` (lines 430–435)

#### The Problematic Code:
```python
# fee_ledger_service.py (generate_fee_bill)
prev_bills = FeeBill.query.filter(
    FeeBill.student_id == student_id,
    FeeBill.bill_month < bill_month,
    FeeBill.status != BillStatus.CANCELLED.value
).all()
previous_dues = sum(b.balance_due for b in prev_bills) # <--- BUG: Exponential Compounding Sum
```
```python
# fee_finance.py (FeeBill.calculate_totals)
self.total_payable = round(curr + (self.previous_dues or 0.0), 2)
self.balance_due = round(max(0.0, self.total_payable - (self.amount_paid or 0.0)), 2)
```
And crucially, even if someone attempts to fix `generate_fee_bill`, inside `collect_fee_payment` at lines 1348–1353:
```python
# fee_ledger_service.py (collect_fee_payment)
for idx, b_sub in enumerate(student_bills):
    if idx > 0:
        p_dues = sum(float(pb.balance_due or 0.0) for pb in student_bills[:idx])
        if abs(float(b_sub.previous_dues or 0.0) - p_dues) > 0.001:
            b_sub.previous_dues = round(p_dues, 2)
            b_sub.calculate_totals() # <--- RE-COMPOUNDS EXPONENTIALLY ON PAYMENT!
```

#### Mathematical Proof of Error:
Assume regular tuition is **₹2,000/month** and the student does not pay:

| Billing Month | Real New Charge | `previous_dues` (Sum of prior `balance_due`) | `total_payable` | Real Cumulative Debt | Error (Overstatement) |
|---|---|---|---|---|---|
| **Month 1 (April)** | ₹2,000 | ₹0.00 | **₹2,000.00** | ₹2,000.00 | ₹0.00 |
| **Month 2 (May)** | ₹2,000 | ₹2,000 (from April) | **₹4,000.00** | ₹4,000.00 | ₹0.00 |
| **Month 3 (June)** | ₹2,000 | ₹2,000 (Apr) + ₹4,000 (May) = **₹6,000** | **₹8,000.00** | ₹6,000.00 | **+₹2,000 (+33%)** |
| **Month 4 (July)** | ₹2,000 | ₹2,000 + ₹4,000 + ₹8,000 = **₹14,000** | **₹16,000.00** | ₹8,000.00 | **+₹8,000 (+100%)** |
| **Month 5 (August)**| ₹2,000 | ₹2,000 + ₹4,000 + ₹8,000 + ₹16,000 = **₹30,000** | **₹32,000.00** | ₹10,000.00 | **+₹22,000 (+220%)**|

### 1.2 Double-Debit Ledger Corruption (`StudentLedger`)
* **Source Location:** `backend/app/services/fee_ledger_service.py` (lines 924–941)

#### The Problematic Code:
```python
# Post Debit Ledger Entry for the bill
ledger_entry = StudentLedger(
    school_id=student.school_id,
    student_id=student_id,
    department='ACCOUNTS',
    entry_type='DEBIT',
    entry_date=date.today(),
    period_label=month_label,
    session=session,
    amount=bill.total_payable, # <--- SEVERE BUG: Debiting Total Payable (includes previous dues!)
    ...
)
db.session.add(ledger_entry)
```

#### The Accounting Disaster:
In General Ledger double-entry accounting:
- In Month 1, Ledger was debited ₹2,000. (Cumulative Ledger Balance = ₹2,000).
- In Month 2, `bill.total_payable` is ₹4,000 (₹2,000 May charge + ₹2,000 April arrear).
- Line 934 posts a **DEBIT of ₹4,000** into `StudentLedger`!
- The cumulative ledger balance becomes: $\text{Month 1 Debit (₹2,000)} + \text{Month 2 Debit (₹4,000)} = \mathbf{₹6,000}$!
- The student's April debt is now recorded **TWICE in the general ledger**!
- By Month 4, the student's sub-ledger shows cumulative debits of **₹30,000** instead of the real **₹8,000**!

---

## 2. Module-by-Module Forensic Audit Across Sidebar

```
SIDEBAR WORKFLOW & FINANCIAL CROSS-CONTAMINATION MAP:
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              CENTRAL FINANCE HUB (CANONICAL)                           │
│     fee_bills (Demand) ── FeePayment (Receipts) ── Expenses (AP) ── BankTxn (Recon)     │
└───────────▲─────────────────────────────▲─────────────────────────────▲────────────────┘
            │                             │                             │
    [INDEPENDENT BILLING]         [INDEPENDENT RECEIPTS]         [UN-POSTED EXPENSES]
            │                             │                             │
┌───────────┴───────────┐     ┌───────────┴───────────┐     ┌───────────┴───────────┐
│ • Student Portal      │     │ • Admission Desk      │     │ • Fleet Bus Overhauls │
│   Reads fee_records   │     │   Issues 3 receipt nos│     │   Vanishes from P&L   │
│ • Transport Shadow    │     │ • Library Counter     │     │ • HRMS Net vs Gross   │
│   TransportFeeRecord  │     │   Staff fines dropped │     │   PF/ESI liabilities  │
│ • Hostel Bed Charges  │     │ • Hostel Counter      │     │   never expensed      │
│   hostel_fee_service  │     │   Dual FeeTxn written │     │ • CAPEX vs OPEX       │
│ • Admit Cards Issued  │     │ • Parent Portal       │     │   Buses expensed as   │
│   Zero fee clearance  │     │   No online checkout  │     │   stationery supplies │
└───────────────────────┘     └───────────────────────┘     └───────────────────────┘
```

---

### 2.1 Accountant & Finance Dashboards
* **Files:** `frontend/src/pages/dashboard/AccountantDashboard.jsx`, `frontend/src/pages/finance/FinanceDashboard.jsx`, `backend/app/services/pnl_service.py`, `backend/app/services/finance_aggregation_service.py`

#### Flaws Identified:
1. **Dueling Dashboard Conflict:** 
   - An accountant navigating to `/dashboard` lands on `AccountantDashboard.jsx`. This component calls `/principal/fees/summary`, `/principal/fees/recent-collections`, and `/finance/profit-summary`.
   - An accountant clicking "Finance Dashboard" in the sidebar lands on `FinanceDashboard.jsx`. This component calls `/api/fees-finance/dashboard`.
   - The two pages display completely contradictory collections, demands, and pending dues because they read from different backend tables (`FeeRecord` vs `FeeBill`).
2. **Date String Split Crash (`PnLService`):**
   - In `AccountantDashboard.jsx:130`:
     ```javascript
     const month = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); // "October 2026"
     api.get('/finance/profit-summary', { params: { month } });
     ```
   - In `pnl_service.py:60`:
     ```python
     if month:
         try:
             yr, mo = map(int, month.split('-')) # Fails on "October 2026"!
         except Exception:
             pass # Silently leaves date_from and date_to as None!
     ```
   - Because `date_from` and `date_to` remain `None`, the queries return all-time school revenue and expenses from founding date to present, labeling it as "October 2026".
3. **Session Collections Bleeding into Monthly Cards (`FinanceAggregationService`):**
   - Lines 83–92: The query on `FeePayment` ignores `month`. It sums all payments in the entire 12-month academic session.
   - Result: Selecting "May 2026" shows the entire academic year's collections (e.g. ₹15,00,000) against May's demand (₹1,20,000), showing negative outstanding balance.

---

### 2.2 Student & Parent Portal
* **Files:** `frontend/src/pages/dashboard/StudentDashboard.jsx`, `backend/app/routes/student.py`

#### Flaws Identified:
1. **Disconnected Database Engine:**
   - In `backend/app/routes/student.py:265`:
     ```python
     @student_bp.route('/fees', methods=['GET'])
     @role_required('STUDENT', 'PARENT')
     def my_fees():
         ...
         q = FeeRecord.query.filter_by(student_id=student.id).filter(FeeRecord.status != 'DRAFT')
     ```
   - The student and parent fee screen queries `FeeRecord` (legacy table).
   - Modern demand bills generated in `FeeBill` and payments collected via `FeePayment` **NEVER APPEAR ON THE STUDENT OR PARENT PORTAL**!
2. **Missing Multi-Tenant Isolation:**
   - `FeeRecord.query.filter_by(student_id=student.id)` does not filter by `school_id=user.school_id`.
3. **Absence of Online Payment Gateway:**
   - `student.py` contains zero checkout routes (`/fees/pay`, `/fees/checkout`, `/fees/order`).
   - Parents have no ability to pay online via Razorpay, Cashfree, UPI QR, or Net Banking.
4. **Admit Card Gating Bypassed:**
   - In `StudentDashboard.jsx:2787`, students download official exam admit cards directly from `/principal/admit-card/${profile.id}/${selectedExam}`.
   - The backend issues the admit card PDF with no fee dues verification, allowing students with massive arrears to sit for exams.

---

### 2.3 Teacher Dashboard & Staff Self-Service (`My HR`)
* **Files:** `frontend/src/pages/dashboard/TeacherDashboard.jsx`, `frontend/src/pages/hrms/StaffSelfService.jsx`, `backend/app/routes/hrms.py`, `backend/app/services/payroll_engine.py`

#### Flaws Identified:
1. **Unauthenticated Window.open PDF Download:**
   - In `StaffSelfService.jsx:443`:
     ```javascript
     onClick={() => window.open(`${api.defaults.baseURL}/hrms/payroll/slips/${s.id}/pdf`, '_blank')}
     ```
   - In `backend/app/routes/hrms.py:1056`:
     ```python
     @hrms_bp.route('/payroll/slips/<int:slip_id>/pdf', methods=['GET'])
     @jwt_required()
     ```
   - Standard browser `window.open()` does not pass the `Authorization: Bearer <token>` header. Staff and teachers clicking "Payslip PDF" receive a `401 Unauthorized` error in a blank browser tab.
2. **Gross vs Net Salary Distortion & Omitted Employer Contributions:**
   - In `payroll_engine.py:468`:
     ```python
     exp.amount = round(float(slip.net_salary), 2)
     ```
   - Only `net_salary` is written to `Expense`. Employee withholdings (PF, ESI, TDS) are never booked as liabilities.
   - When the school pays the government EPFO/ESIC department, there are no liability accounts to debit.
   - Institution employer statutory contributions (Employer PF 12% + Employer ESI 3.25%) are never expensed, understating true school operating expenditure by 15–20%.
3. **Missing Employee Salary Advances & Emergency Loans Subledger:**
   - No data model exists to track staff loans, advance salary disbursements, or monthly EMI amortization deductions against payslips.

---

### 2.4 Hostel & Warden Management
* **Files:** `frontend/src/pages/hostel/HostelDashboard.jsx`, `frontend/src/pages/dashboard/WardenDashboard.jsx`, `backend/app/routes/hostel.py`, `backend/app/services/hostel_fee_service.py`

#### Flaws Identified:
1. **Warden Dashboard Isolation Failure:**
   - In `WardenDashboard.jsx:104`, the frontend calls `api.get('/hostel/dashboard')` instead of `/hostel/warden-dashboard`.
   - Wardens are shown campus-wide metrics across all hostel buildings instead of their assigned residence.
2. **Hostel Ingestion into Legacy Tables:**
   - In `hostel_fee_service.py:168`:
     ```python
     rec = FeeRecord(school_id=..., student_id=..., fee_type='HOSTEL', source='HOSTEL', ...)
     db.session.add(rec)
     ```
   - Monthly hostel billing writes to `FeeRecord` rather than appending a `FeeBillItem` under `FeeHead('HOSTEL')` on the central demand bill.
3. **Multi-Process Ineffective Mutex Lock:**
   - In `hostel_fee_service.py:223`:
     ```python
     _hostel_payment_mutex = threading.Lock()
     ```
   - An in-memory Python `threading.Lock` provides zero protection across multi-worker Gunicorn/WSGI deployments, permitting double collections.
4. **Rogue Hostel Inventory:**
   - `hostel_inventory` tracks room assets (beds, almirahs, tables) outside `school_assets` in `finance.py`, evading institutional procurement, audit, and depreciation.

---

### 2.5 Transport Logistics & Fleet Operations
* **Files:** `frontend/src/pages/transport/TransportDashboard.jsx`, `backend/app/routes/transport_reports.py`, `backend/app/services/transport_fee_service.py`, `backend/app/routes/transport.py`

#### Flaws Identified:
1. **Shadow Billing Isolation:**
   - `transport_reports.py:51–62` queries `TransportFeeRecord`.
   - When parents pay transport fees at the central school counter via `collect_fee_payment()`, `TransportFeeRecord` is not updated. The Transport Dashboard continues displaying that the student has overdue transport fees.
2. **Quadruple Table Writing on Collection:**
   - In `transport_fee_service.py:150–265`, a single ₹1,500 collection writes to `FeeRecord`, `FeeTransaction`, `TransportFeeRecord`, `TransportFeeTransaction`, and `FeePayment`.
   - Summing reports across tables produces double or triple collection totals.
3. **Fleet Maintenance Expense Leak:**
   - In `transport.py:1025–1041`, creating or completing a `VehicleMaintenance` record (e.g. ₹45,000 engine overhaul) **never creates an `Expense` record**.
   - Fleet operating costs are omitted from the school's Profit & Loss statements.

---

### 2.6 Library Management & Penalties
* **Files:** `frontend/src/pages/library/LibraryDashboard.jsx`, `backend/app/routes/library.py`, `backend/app/services/library_fee_service.py`

#### Flaws Identified:
1. **Teacher/Staff Fines Discarded:**
   - In `library_fee_service.py:27`:
     ```python
     if not student:
         return None, 'not_a_student'
     ```
   - Fines incurred by teachers and staff are discarded. They are never deducted from payroll payslips or recognized as school revenue.
2. **Fine Waiver Desynchronization:**
   - In `library.py:1164–1172`, waiving a fine updates `FeeRecord.discount`.
   - It **does not update `StudentLedger` or `FeeBillItem`**. The student remains indebted on the central finance billing engine.

---

### 2.7 Admissions & Provisional Workflow
* **Files:** `frontend/src/pages/NewAdmissionPage.jsx`, `backend/app/routes/principal.py`

#### Flaws Identified:
1. **Mismatched Multi-Receipt Generation:**
   - In `principal.py:1899–1955`:
     ```python
     rno = _gen_receipt() # e.g. "REC-2026-0042"
     rec = FeeRecord(..., receipt_no=rno)
     txn = FeeTransaction(..., receipt_no=rno)
     central_pmt = collect_fee_payment(...) # Generates "FP-202610-0089"
     ```
   - `rec.receipt_no` and `txn.receipt_no` are never updated with `central_pmt.receipt_no`. If an accountant searches by the receipt on the parent's admission slip, the record cannot be found.
2. **Race Condition in Admission Counters:**
   - In `principal.py:1413`:
     ```python
     seq = FeePayment.query.filter_by(school_id=sid).count() + 1
     ```
   - Concurrent submissions at multiple admission counters produce identical candidate receipt numbers, causing unique constraint database crashes.

---

### 2.8 Concessions, Scholarships & Waivers (Maafi)
* **Files:** `backend/app/services/fee_ledger_service.py`, `backend/app/routes/fees_finance.py`

#### Flaws Identified:
1. **Compounding Concession Loop Bug:**
   - In `fee_ledger_service.py:1584–1598`:
     ```python
     for bill in open_bills:
         for itm in bill.items:
             if fee_head_id is None or itm.fee_head_id == fee_head_id:
                 if discount_type == 'PERCENTAGE':
                     disc_amt = round(base_amt * (discount_value / 100.0), 2)
                 else:
                     disc_amt = round(discount_value, 2)
                 itm.discount_amount = round((itm.discount_amount or 0.0) + disc_amt, 2)
                 ...
     ```
   - If a student has 3 unpaid bills with 4 items each, a fixed waiver of ₹500 is deducted from **every item of every bill**!
   - 3 bills * 4 items = 12 deductions of ₹500 = **₹6,000 total deduction instead of ₹500**!
   - The ledger entry only logs ₹500 (`amount=discount_value`), causing an immediate ₹5,500 reconciliation discrepancy between bills and ledger.
2. **Destructive Concession Deletion:**
   - In `fees_finance.py:1076`:
     ```python
     conc = StudentConcession.query.filter_by(id=conc_id, school_id=user.school_id).first_or_404()
     db.session.delete(conc)
     db.session.commit()
     ```
   - Deleting a concession row does not restore the deducted amounts on `FeeBillItem` or debit the `StudentLedger`. The student retains unauthorized discounts forever.

---

### 2.9 Procurement, Inventory & Capital Assets (CAPEX vs OPEX)
* **Files:** `backend/app/services/procurement_service.py`, `backend/app/models/finance.py`

#### Flaws Identified:
1. **Unconditional Expensing of Capital Assets:**
   - In `procurement_service.py:353`:
     ```python
     expense = Expense(
         school_id=school_id,
         category='INVENTORY_PURCHASE', # Hardcoded!
         amount=amount,
         ...
     )
     ```
   - Purchasing a ₹25,00,000 School Bus or ₹10,00,000 Computer Lab setup via purchase order is booked as immediate monthly consumable stationery expense (`INVENTORY_PURCHASE`).
   - Monthly P&L shows catastrophic artificial operational losses, while fixed asset balance sheet registers reflect ₹0 additions.

---

### 2.10 Bank & Payment Gateway Reconciliation Engine
* **Files:** `backend/app/services/reconciliation_service.py`

#### Flaws Identified:
1. **Arbitrary Fuzzy Matching Across Students:**
   - In lines 418–434:
     ```python
     candidate_pays = [
         p for p in payments
         if p.id not in allocated_payments
         and abs(float(p.total_paid or 0.0) - amt) < 0.01
         and abs((p.payment_date - t_date).days) <= 3
     ]
     cand = candidate_pays[0] # Blindly picks first student!
     ```
   - If 50 students in Class 4 pay ₹2,500 tuition in the same week, the bank reconciliation engine arbitrarily pairs bank credits with random students regardless of student admission number or parent phone in the narration.
2. **Invisible Salary Disbursements:**
   - When matching bank debits, the engine checks `invoice_number` against `SAL-2026-XXXXXX`. Bank statements contain employee names, account numbers, or UTRs. All salary bank outflows are flagged as false `MISSING_IN_ERP`.
3. **Refunds & Deposit Outflows Missing:**
   - Outflows from `FeeRefund` or caution deposit returns are absent from the matching rules.

---

### 2.11 Security, Privacy & Data Types
* **Files:** `backend/app/routes/fees_finance.py`, `backend/app/models/fee_finance.py`

#### Flaws Identified:
1. **IDOR Vulnerability on Student Financial Ledger:**
   - In `fees_finance.py:1155–1167`:
     ```python
     @fees_finance_bp.route('/students/<int:student_id>/ledger', methods=['GET'])
     @jwt_required()
     def get_student_financial_ledger(student_id):
         user = _get_current_user()
         ...
         ledger_data = get_student_ledger(student_id, session=session)
     ```
   - Missing `_verify_student_access(user, student_id)`. Any authenticated student or parent can query the endpoint for any other student ID and view their fee structures, arrears, waivers, and family financial circumstances.
2. **IEEE-754 Floating-Point Precision Drift:**
   - All monetary fields in `fee_finance.py` (`total_payable`, `balance_due`, `net_amount`, `allocated_amount`) are declared as `db.Float`.
   - Inherent floating-point drift (e.g. `0.0000000000001`) prevents `balance_due <= 0.0` from evaluating to `True`, permanently stranding settled bills in `PARTIALLY_PAID` status.

---

### 2.12 Finance Aggregation Service: 2x Cash Inflation & Double-Counting of Modern & Legacy Payments
* **Files:** `backend/app/services/finance_aggregation_service.py` (lines 285–344)

#### Flaws Identified:
1. **Blind Addition of Modern `FeePayment` and Legacy `FeeTransaction`:**
   - In lines 289–304:
     ```python
     # Modern payments today
     today_payments = FeePayment.query.filter(
         FeePayment.school_id == school_id,
         FeePayment.status == 'VALID',
         FeePayment.payment_date == today
     ).all()
     today_pay_sum = sum(p.total_paid or 0.0 for p in today_payments)

     # Legacy transactions today
     today_txns = FeeTransaction.query.filter(
         FeeTransaction.school_id == school_id,
         FeeTransaction.transaction_date == today
     ).all()
     today_tx_sum = sum(t.amount or 0.0 for t in today_txns)

     today_collection = round_curr(today_pay_sum + today_tx_sum)
     ```
   - In line 330:
     ```python
     month_collection = round_curr(month_pay_sum + month_tx_sum)
     ```
   - And in line 337–343:
     ```python
     for p in month_payments:
         mode_breakdown[m] = round_curr(mode_breakdown[m] + (p.total_paid or 0.0))
     for t in month_txns:
         mode_breakdown[m] = round_curr(mode_breakdown[m] + (t.amount or 0.0))
     ```
   - **Forensic Mathematical Proof of 2x Inflation:**
     - Whenever a payment is collected through `FeeCentralService.collect_payment`, it creates a `FeeTransaction` at line 527 AND a `FeePayment` at line 563 to satisfy legacy and modern schemas.
     - When `FinanceAggregationService.get_fee_summary` executes, it adds `today_pay_sum` (₹10,000) + `today_tx_sum` (₹10,000) = **₹20,000**.
     - Result: `today_collection`, `this_month_collection`, `cash_collection`, `upi_collection`, `online_collection`, and `today_breakdown` report **EXACTLY DOUBLE (200%)** the actual physical and bank cash collected! The Principal and Accountant see 2x money on the dashboard compared to the bank statement.

---

### 2.13 Accrual P&L Engine & Procurement: Inter-Period Expense Double-Counting & Unpaid Payroll Omission
* **Files:** `backend/app/services/pnl_service.py` (lines 176–241), `backend/app/services/procurement_service.py` (lines 305–371)

#### Flaws Identified:
1. **Accrual Basis Double-Counts Vendor Expenses Across Consecutive Periods:**
   - In `procurement_service.py:record_vendor_bill_payment` (line 350), paying a vendor bill automatically creates an `Expense` with `status='PAID'` and `payment_date=date.today()`.
   - In `pnl_service.py:get_profit_and_loss_statement`:
     ```python
     # Cash disbursements
     for exp in all_expenses:
         if exp.status == 'PAID':
             total_paid_expenses += amt
     # Plus unpaid vendor bills
     for vb in vbill_q.all():
         total_unpaid_liabilities += vb.balance_amount
     total_expenses = total_paid_expenses if basis == 'CASH' else (total_paid_expenses + total_unpaid_liabilities)
     ```
   - **Forensic Proof of Double-Counting:**
     - Suppose Vendor Bill `#VB-01` of ₹1,00,000 is received in January. School pays ₹40,000 in January and ₹60,000 in February.
     - **January P&L (Accrual):** Paid Expenses (₹40,000) + Unpaid Liabilities (₹60,000) = **₹1,00,000**. (Correct for January).
     - **February P&L (Accrual):** When the ₹60,000 is paid in February, `record_vendor_bill_payment` posts a new `Expense` with `payment_date` in February. February's `total_paid_expenses` now includes ₹60,000!
     - Unpaid liability is now ₹0. Total February Accrual Expense = **₹60,000**!
     - **Cumulative Expense Recognized across Jan + Feb:** ₹1,00,000 + ₹60,000 = **₹1,60,000** on a ₹1,00,000 invoice (+60% error)!
     - In true double-entry accrual accounting, the entire ₹1,00,000 expense belongs to January. February's payment is an Accounts Payable balance sheet settlement, NOT a February expense.
2. **Accrual P&L Completely Omits Unpaid Staff Payroll Liabilities:**
   - In `pnl_service.py:214–236`, the engine queries ONLY `VendorBill.balance_amount` for `total_unpaid_liabilities`.
   - `StaffSalaryRecord` and `PayrollRun` entries with status `PENDING_APPROVAL` or `APPROVED` (unpaid salaries) are 100% ignored.
   - If a school has ₹15,00,000 in unpaid monthly staff salaries awaiting disbursement, the Accrual Operating Statement reports **₹0 unpaid salary liabilities**, artificially showing a massive fake operating profit!

---

### 2.14 HRMS Payroll Engine & Attendance: Mid-Month Joiner Net Pay Annihilation & Leave-to-Payroll Leak
* **Files:** `backend/app/services/payroll_engine.py` (lines 196–198, 230, 243–265), `backend/app/services/hrms_service.py` (lines 542–559)

#### Flaws Identified:
1. **Pre-Joining Days Counted as Unexcused Absence at Working-Day Rate:**
   - In `payroll_engine.py:196–198`:
     ```python
     # Skip days before joining or after exit
     if dt < effective_start or dt > effective_end:
         unexcused_absent_days += 1.0
         continue
     ```
   - In lines 243–260:
     ```python
     total_unpaid_days = unpaid_leave_days + unexcused_absent_days + (0.5 * half_days)
     if policy == 'WORKING_DAYS':
         divisor_days = max(1, working_days_count) # e.g. 22
         per_day_salary = round(base_gross / divisor_days, 2)
     lop_deduction = round(per_day_salary * total_unpaid_days, 2)
     lop_deduction = min(base_gross, lop_deduction)
     net_salary = round(max(0.0, calculated_gross - total_deductions), 2)
     ```
   - **Forensic Mathematical Proof of ₹0 Salary Bug:**
     - An employee with gross salary ₹44,000 joins mid-month on October 25th in a 31-day month (22 working days).
     - Days 1 to 24 (before joining) get `unexcused_absent_days += 24.0`!
     - `per_day_salary` = ₹44,000 / 22 = ₹2,000/day.
     - `lop_deduction` = ₹2,000 * 24 days = **₹48,000**!
     - Capped at `min(44,000, 48,000)` = ₹44,000.
     - Result: `net_salary` = **₹0.00**! The teacher worked legitimately from October 25th to 31st (7 days), but receives ₹0 salary because pre-employment calendar days were penalized at the working-day penalty rate!
2. **Leave-Without-Pay (LWP) and Direct Attendance Leaves Auto-Converted to Paid Leave:**
   - In `hrms_service.py:_apply_approved_leave_to_attendance` (line 555), leave approval sets `StaffAttendance.status = 'ON_LEAVE'`.
   - In `payroll_engine.py:230`:
     ```python
     elif att.status == 'ON_LEAVE':
         paid_leave_days += 1.0
     ```
   - If an employee takes Leave Without Pay (LWP), or if a Principal manually marks an absent teacher as `ON_LEAVE` directly in the attendance roster without an approved paid `LeaveRequest`, line 230 unconditionally counts it as `paid_leave_days`, completely preventing salary deductions for unpaid leaves!

---

### 2.15 Fee Central Service: Corrupted Cumulative Running Balance in `StudentLedger` & 7 Competing Payment Collection Routes
* **Files:** `backend/app/services/fee_central_service.py` (lines 222–224, 450–600), `backend/app/services/fee_ledger_service.py` (lines 1180–1250)

#### Flaws Identified:
1. **Running Ledger Balance (`balance_after`) Corrupted with Item Balance:**
   - In `fee_central_service.py:222–224`:
     ```python
     bal_amt = round_curr(max(0.0, net_amt - paid_amt))
     ...
     ledger_entry = StudentLedger(
         amount=net_amt,
         balance_after=bal_amt, # <--- FATAL FLAW: Sets item balance instead of cumulative student AR balance
         bill_id=bill.id
     )
     ```
   - In double-entry accounting, `balance_after` MUST represent the student's cumulative outstanding balance after applying the transaction.
   - Setting `balance_after` to `item.balance_amount` breaks the audit trail:
     - Tuition (₹5,000): `balance_after` = ₹5,000
     - Transport (₹2,000): `balance_after` = ₹2,000 (instead of ₹7,000)
     - Library Fine (₹300): `balance_after` = ₹300 (instead of ₹7,300)
   - Any financial statement or parent printout relying on `balance_after` displays completely nonsense fluctuating balances.
2. **Seven Competing Payment Collection Functions Creating Divergent Receipts:**
   - Seven distinct payment collection functions exist across the codebase:
     1. `FeeLedgerService.collect_fee_payment` (`fee_ledger_service.py:1180`) -> Generates `FP-YYYYMM-XXXX`
     2. `FeeCentralService.collect_payment` (`fee_central_service.py:450`) -> Generates `REC-YYYY-XXXXXX`
     3. `record_transport_fee_payment` (`transport_fee_service.py:180`) -> Generates `RCP-YYYYMM-XXXX`
     4. `record_hostel_fee_payment` (`hostel_fee_service.py:250`) -> Generates `REC-YYYY-XXXX`
     5. `record_library_fine_payment` (`library_fee_service.py:110`) -> Generates `LIB-RCP-XXXX`
     6. `principal.py:collect_fee` (`principal.py:1870`) -> Generates `REC-`
     7. `principal.py:collect_multiple` (`principal.py:1920`) -> Generates `REC-`
   - Each route generates separate receipts, posts to different combinations of tables (`FeePayment` vs `FeeTransaction` vs `TransportFeeTransaction`), and leaves competing balance calculations across the system.

---

### 2.16 Asset Service: Financial Omission of Asset Scrap/Disposal Revenue, Depreciation Deficit & Hardcoded Cash Method
* **Files:** `backend/app/services/asset_service.py` (lines 153–175, 186–200, 212)

#### Flaws Identified:
1. **Asset Disposal / Scrap Revenue Completely Bypasses Central Finance:**
   - In `asset_service.py:dispose_or_retire_asset` (lines 195–197):
     ```python
     asset.status = 'DISPOSED' if disposal_method == 'SCRAPPED' else 'RETIRED'
     asset.disposal_date = date.today()
     asset.disposal_method = disposal_method
     asset.disposal_amount = float(disposal_amount or 0.0)
     ```
   - When a retired school bus, generator, or computer lab is scrapped or sold for ₹2,50,000 (`disposal_amount`), **ZERO financial entries are posted to Central Finance**!
   - No cash inflow is recorded in bank accounts or cash registers, and no Gain/Loss on Asset Disposal is recognized in P&L. This creates a severe financial leakage vulnerability where disposal proceeds can easily be pocketed off the books.
2. **Hardcoded `payment_method='CASH'` in Asset Maintenance:**
   - In `asset_service.py:165`, when maintenance is recorded, `Expense` is posted with `payment_method='CASH'` hardcoded, distorting cash drawer balances and bank reconciliation even when the contractor was paid via NEFT or Cheque.
3. **Total Absence of Asset Depreciation Schedules:**
   - Line 212: `total_asset_value = sum(a.purchase_cost for a in assets if a.status not in ['DISPOSED', 'RETIRED'])`.
   - 10-year-old IT equipment and school vehicles purchased in 2015 remain on the balance sheet at 100% historical cost without straight-line or written-down value (WDV) depreciation.

---

### 2.17 Migration Service & Admission Service: Standalone Opening Balance Fallback & Provisional Promotion Stalling
* **Files:** `backend/app/services/migration_service.py` (lines 585–604), `backend/app/services/admission_service.py` (lines 38–81)

#### Flaws Identified:
1. **Opening Balance Sync Failure Creates Unbillable Standalone Ledger Dues:**
   - In `migration_service.py:585–604`:
     - If `sync_fee_record_to_bill` raises an error during CSV/Excel import, the exception handler falls back to inserting a direct `StudentLedger` DEBIT entry with no `bill_id`.
     - When the student logs into the portal or visits the counter, online payment gateways and invoice checkouts allocate payments strictly against `FeeBill` and `FeeBillItem`.
     - Because no `FeeBillItem` exists for this fallback ledger entry, the student's migrated opening balance is permanently stranded in accounts receivable and cannot be paid through standard bill checkout!
2. **Provisional Student Promotion Stalls Billing Cycle:**
   - In `admission_service.py:promote_provisional_student` (lines 38–81):
     - When a provisional student is confirmed, the function updates `student.admission_no` and sets `status = 'ACTIVE'`.
     - However, it **does not trigger fee bill generation** for the current academic session (Tuition, Admission Fee, Annual Charges).
     - The student is confirmed but remains with ₹0 demand billing until an accountant manually discovers the omission and triggers batch billing.

---

### 2.18 Fee Refund Accounting Black Hole & Undetected Cash Drainage
* **Files:** `backend/app/services/fee_ledger_service.py` (lines 1718–1790), `backend/app/services/finance_aggregation_service.py` (lines 100–115), `backend/app/services/pnl_service.py` (lines 98–170)

#### Flaws Identified:
1. **Refunds Never Reduce `FeePayment.total_paid` or Reopen `FeeBill`:**
   - In `fee_ledger_service.py:process_fee_refund` (lines 1728–1760):
     - It inserts a `FeeRefund` row and posts a `StudentLedger` DEBIT entry.
     - However, it **does not decrement `payment.total_paid`**, does not adjust `FeePaymentAllocation`, and does not re-open the underlying `FeeBill` or `FeeBillItem` (`amount_paid` and `balance_due` remain untouched).
     - If a parent paid ₹15,00,00 and ₹5,000 is refunded (e.g. hostel withdrawal), the invoice remains permanently marked `PAID`.
2. **Refunded Cash Is Never Deducted from Dashboard Collections or P&L Statements:**
   - In `finance_aggregation_service.py:114`:
     ```python
     total_pay_collected = pq.with_entities(func.coalesce(func.sum(FeePayment.total_paid), 0.0)).scalar() or 0.0
     ```
   - In `pnl_service.py:100`:
     ```python
     func.coalesce(func.sum(FeePaymentAllocation.allocated_amount), 0.0)
     ```
   - **Forensic Financial Impact:** Neither query subtracts `FeeRefund.amount`! Furthermore, `process_fee_refund` creates **ZERO cash outflow entry in `Expense` or any bank ledger**.
   - If a school collects ₹50,00,000 and issues ₹5,00,000 in refunds during student withdrawals or caution deposit paybacks, the executive dashboard and Operating Statement continue to report **₹50,00,000 collected cash**. The ₹5,00,000 drained from the bank account is completely invisible to management!

---

### 2.19 Payment Cancellation Allocation Loop Over-Deduction & Running Balance Reset
* **Files:** `backend/app/services/fee_ledger_service.py` (lines 1636–1715)

#### Flaws Identified:
1. **Allocation Loop Decrements `bi.bill.amount_paid` Multiple Times:**
   - In lines 1654–1662:
     ```python
     for alc in payment.allocations:
         if alc.bill_item_id:
             bi = FeeBillItem.query.get(alc.bill_item_id)
             if bi:
                 bi.paid_amount = round(max(0.0, (bi.paid_amount or 0.0) - alc.allocated_amount), 2)
                 bi.balance_amount = round(bi.net_amount - bi.paid_amount, 2)
                 if bi.bill:
                     bi.bill.amount_paid = round(max(0.0, (bi.bill.amount_paid or 0.0) - alc.allocated_amount), 2)
                     bi.bill.calculate_totals()
     ```
   - If a bill has 4 line items covered by the receipt, `bi.bill.amount_paid` is decremented in a loop, repeatedly triggering `calculate_totals()` before all allocations are reversed.
2. **Legacy `FeeTransaction` Left Intact Upon Receipt Cancellation:**
   - When a receipt is cancelled, `payment.status` becomes `CANCELLED`. But the corresponding `FeeTransaction` generated during payment collection is **NEVER marked cancelled or deleted**.
   - As a result, legacy dashboards and `today_txns` continue counting the cancelled receipt as live collected cash!
3. **Hardcoded Reset of `balance_after = 0.0` in Reversal Ledger Entry:**
   - In line 1675:
     ```python
     ledger_entry = StudentLedger(
         amount=payment.total_paid,
         balance_after=0.0, # <--- HARDCODED ZERO!
         ...
     )
     ```
   - Instead of reinstating the student's previous outstanding AR balance, cancelling a receipt resets the student's cumulative running balance to ₹0.00!

---

### 2.20 Missing `class_id` in Master Financial Tables & Retroactive Class AR Corruption
* **Files:** `backend/app/models/fee_finance.py` (lines 389–427, 527–550, 560–590), `backend/app/services/archive_service.py` (line 477), `backend/app/services/finance_aggregation_service.py` (line 67, 134)

#### Flaws Identified:
1. **Zero Class Snapshot on Bills, Payments, or Ledger Entries:**
   - `fee_bills`, `fee_payments`, and `student_ledgers` do not possess a `class_id` column.
   - Every class-wise financial breakdown in the entire system (`FinanceAggregationService.get_class_wise_summary`, `get_fee_summary`) joins dynamically:
     ```python
     bq = bq.join(Student, FeeBill.student_id == Student.id).filter(Student.class_id == class_id)
     ```
2. **Catastrophic Historical Revenue Distortion Upon Academic Promotion:**
   - When a student who paid ₹40,000 in Class 4 during session `2024-25` is promoted to Class 5 in `2025-26`, `student.class_id` changes to Class 5.
   - If the Principal runs a historical report for Class 4 in `2024-25`, the student's bills and payments are **completely missing** from Class 4 and retroactively attributed to Class 5!
3. **Permanent Wiping of Class Revenue Upon Student Archival:**
   - In `archive_service.py:477`, permanently purging a student sets `student.class_id = None`.
   - All historical bills, payments, and fees collected from that student throughout their entire school career disappear from every class-wise report in the school's historical ledger!

---

### 2.21 Zero Automated Late Fine Engine & Grace Period Slabs
* **Files:** `backend/app/models/fee_finance.py` (lines 410, 433, 491), `backend/app/services/fee_central_service.py` (line 187)

#### Flaws Identified:
1. **Late Fine Columns Exist but Zero Automation Runs:**
   - Schema defines `total_late_fine` and `fine_amount`, but there is **no scheduled task, no daily fine computation function, and no grace period slab engine**.
   - When `FeeBill.due_date` passes (e.g. after the 10th of the month), the bill status flips to `OVERDUE`, but `total_late_fine` remains **₹0.00** perpetually.
   - Standard school late fine rules (e.g. ₹50 flat after due date, or ₹20/day after 5 days grace period) cannot be enforced automatically, costing schools hundreds of thousands of rupees in uncollected statutory late fees.

---

### 2.22 Complete Absence of Online Payment Gateway Backend & Webhook Verification
* **Files:** `backend/app/models/finance.py` (line 878), `backend/app/routes/student.py` (lines 265–310), `frontend/src/pages/finance/ReconciliationPage.jsx` (lines 209, 649)

#### Flaws Identified:
1. **Razorpay / Cashfree Mentioned in Comments Only:**
   - "Razorpay" exists only as an illustrative string in comments and dropdown options.
   - There is **zero backend SDK integration**:
     - No `POST /api/student/fees/create-order` endpoint to request an order ID.
     - No HMAC-SHA256 signature verification route to validate webhook callbacks.
     - No payment gateway key management in `School` or `PaymentSettings`.
2. **Online Parent Self-Service Is 100% Inoperative:**
   - Parents cannot pay fees online from home. Every payment in EduERP mandates physical travel to the school counter to pay a human cashier, defeating the primary purpose of a modern web portal.

---

### 2.23 Cheque Bouncing & Dishonor Penalty Workflow Absence
* **Files:** `backend/app/services/fee_ledger_service.py` (lines 1180–1250)

#### Flaws Identified:
1. **Permanent Revenue Lock on Uncashed / Dishonored Cheques:**
   - When a counter cashier collects a cheque, `collect_fee_payment` immediately marks the bill `PAID` and credits `StudentLedger`.
   - When the bank returns the cheque 3 days later as **Bounced / Insufficient Funds**, there is no dishonor workflow in the ERP.
   - The school cannot:
     1. Mark the cheque as `BOUNCED`.
     2. Re-open the student's bill to `OVERDUE`.
     3. Reverse the ledger credit.
     4. Post a Cheque Dishonor Bank Penalty (e.g. ₹500) to the student's ledger.
   - As a result, bounced cheques remain banked as real cash in all financial reports.

---

### 2.24 Caution Money / Security Deposit Misclassification as Operating Income [RESOLVED & IMPLEMENTED]
* **Files:** `backend/app/models/fee_finance.py` (`CautionMoneyDeposit`), `backend/app/services/fee_ledger_service.py` (`preview_caution_money_clearance`, `execute_caution_money_settlement`), `backend/app/routes/fees_finance.py`, `frontend/src/pages/finance/CautionMoneyPage.jsx`

#### Resolution Architecture (Section 21 Architecture):
1. **Balance Sheet Escrow Liability Subledger:**
   - Dedicated `CautionMoneyDeposit` model tracking deposit receipt, original deposit amount, held escrow balance, offset amount, and refunded amount under multi-tenant isolation.
   - Status transitions: `HELD` -> `PARTIALLY_SETTLED` -> `FULLY_SETTLED` / `REFUNDED`.
2. **Graduation Clearance & Arrears Offset Engine:**
   - Previews held caution deposit against unpaid AR debts across all departments (Tuition, Hostel, Transport, Library).
   - Atomic settlement offsets outstanding fee bills via `collect_fee_payment(mode='CAUTION_MONEY_OFFSET')`, books net refund in `Expense(category='CAUTION_MONEY_REFUND')`, and records comprehensive audit trails.
3. **Frontend Management Suite (`CautionMoneyPage.jsx`):**
   - KPI metrics (Total Escrow Held, Total Collected, Total Offset, Total Refunded).
   - Direct deposit collection with printable receipt generator.
   - Live interactive graduation clearance wizard with offset arithmetic and net disbursement settlement.

---

### 2.25 Absence of Cross-Module No-Dues Clearance & TC Financial Gating
* **Files:** `backend/app/models/documents.py` (line 11), `backend/app/utils/pdf_generator.py` (line 541), `backend/app/routes/student.py` (line 467)

#### Flaws Identified:
1. **Transfer Certificate (TC) Generated Without Dues Verification:**
   - `Transfer Certificate` is treated purely as a document upload category.
   - There is no automated No-Dues clearance engine checking:
     1. Accounts: Outstanding tuition or term bill balance.
     2. Library: Unreturned books or pending overdue fines.
     3. Hostel: Key handover, room condition damages, mess dues.
     4. Transport: Route pass surrender.
     5. Caution Money: Security deposit settlement.
   - Students routinely withdraw from the school and obtain leaving certificates while owing substantial arrears, resulting in permanent bad debts for the institution.

---

### 2.26 Sibling Relationship Entity Absence & Unregulated Concession Leak [RESOLVED & IMPLEMENTED]
* **Files:** `backend/app/models/fee_finance.py` (`FamilyGroup`), `backend/app/models/academic.py` (`Student.family_group_id`), `backend/app/services/fee_ledger_service.py` (`evaluate_sibling_discount`, `get_student_applicable_charges`), `backend/app/routes/fees_finance.py`, `frontend/src/pages/finance/FamilyGroupsPage.jsx`

#### Resolution Architecture (Section 23 Architecture):
1. **Relational Family Group Entity:**
   - `FamilyGroup` model linking students under `family_groups.id` with household guardian names, contacts, aadhar, and configurable progressive discount rates (`first_child_discount_pct` default 0%, `second_child_discount_pct` default 25%, `third_child_discount_pct` default 50%).
   - Bi-directional relationship with `Student.family_group_rel`.
2. **Dynamic Chronological Sibling Discount Engine:**
   - `evaluate_sibling_discount(student_id)`: ranks active siblings in a household chronologically (`admission_date ASC, id ASC`).
   - Sibling #1 (eldest) receives 0% (baseline), Sibling #2 receives 25%, Sibling #3+ receives 50%.
   - Automatically injected into `get_student_applicable_charges()` for tuition and academic rate cards without requiring manual concession vouchers.
3. **Smart Heuristic Auto-Detection & UI Suite (`FamilyGroupsPage.jsx`):**
   - Heuristic contact clustering endpoint (`GET /api/fees-finance/family-groups/auto-detect`) scans students with matching guardian phone numbers to detect unlinked sibling clusters.
   - 1-click batch linking and creation.
   - Interactive family management table, sibling hierarchy inspector, and integration with `FeeSetupPage.jsx`.

---

### 2.27 Zero GST Tax Computation & Input Tax Credit (ITC) Compliance
* **Files:** `backend/app/models/fee_finance.py` (lines 103, 124), `backend/app/services/procurement_service.py` (line 291)

#### Flaws Identified:
1. **Dormant `is_taxable` Flag with Zero Rates or Breakdowns:**
   - `is_taxable` is an unutilized boolean column.
   - No tax rates (5%, 12%, 18%), CGST/SGST/IGST breakdowns, or SAC/HSN codes exist in `FeeHead` or `FeeBillItem`.
   - In `procurement_service.py:291`:
     ```python
     vendor_bill = VendorBill(
         tax_amount=0.0, # <--- HARDCODED ZERO TAX
         ...
     )
     ```
   - In India, commercial school activities (transport, uniform sales, coaching, canteen) and procurement purchases (buses, hardware, maintenance) are subject to statutory GST. Zero tracking of GST liabilities or input tax credits (ITC) creates massive legal compliance and audit failure risks.

---

### 2.28 Triplicate Competing Salary Disbursement Systems & P&L Double-Counting
* **Files:** `backend/app/services/payroll_engine.py` (lines 425–518), `backend/app/routes/principal.py` (lines 540–600 and 669–725), `backend/app/services/pnl_service.py` (lines 176–212)

#### Flaws Identified:
1. **Three Conflicting Salary Payment Routes Writing to `Expense`:**
   - **Route 1 (HRMS Modern Payroll):** `payroll_engine.py:pay_payroll_slip` creates an `Expense` with `source='HRMS_PAYROLL'`, `category='TEACHER_SALARY'` / `'STAFF_SALARY'`, linked to `PayrollSlip.id`.
   - **Route 2 (Principal Teacher Desk):** `principal.py:add_salary_record` (`/teachers/<id>/salary/record`) creates a legacy `SalaryRecord` and an `Expense` with `source='SALARY_AUTO'`, `category='TEACHER_SALARY'`, linked to `SalaryRecord.id`.
   - **Route 3 (Principal Staff Desk):** `principal.py:record_staff_salary` (`/users/<id>/salary/record`) creates a legacy `StaffSalaryRecord` and an `Expense` with `source='SALARY_AUTO'`, `category='STAFF_SALARY'`, linked to `StaffSalaryRecord.id`.
2. **Catastrophic P&L Labor Expense Double-Counting:**
   - In `pnl_service.py:176`:
     ```python
     all_expenses = Expense.query.filter_by(school_id=school_id).all()
     ```
   - `PnLService` does not filter by `source`. If the HR manager runs monthly payroll via the HRMS module and the Principal also records payments via their dashboard (or vice-versa), both `Expense` records persist in the database.
   - **Forensic Financial Impact:** Salary expense is **double-counted (+100% inflation of labor expenses)** in the school's Profit & Loss statement, turning a healthy operating surplus into an alarming false deficit.
3. **Dual-State Payslip Disconnect:**
   - Salaries recorded via the Principal dashboard do not generate `PayrollSlip` records. Teachers checking "My HR" (`/my/payslips`) see zero payslips and cannot download PDFs.
   - Conversely, salaries disbursed through `payroll_engine.py` do not update `SalaryRecord` or `StaffSalaryRecord`, causing the Principal dashboard to report all employees as perpetually `PENDING` payment.

---

### 2.29 Gross vs Net Salary Accounting Distortion & Missing Statutory Liabilities Subledger
* **Files:** `backend/app/services/payroll_engine.py` (lines 463–486), `backend/app/models/hrms.py` (lines 695–702)

#### Flaws Identified:
1. **Booking `net_salary` as the Expense Instead of Gross Labor Cost:**
   - In `payroll_engine.py:468`:
     ```python
     exp = Expense(
         category=category,
         title=f"Salary Payment — {slip.user.name} ({slip.payroll_run.month_name})",
         amount=round(float(slip.net_salary), 2), # <--- SEVERE ACCOUNTING FLAW: Net instead of Gross!
         ...
     )
     ```
   - In standard GAAP and double-entry accounting:
     $$\text{Salary Expense} \equiv \text{Gross Salary (Basic + HRA + DA + Allowances)}$$
     $$\text{Cash Outflow} \equiv \text{Net Salary}$$
     $$\text{Current Liabilities} \equiv \text{PF Withheld} + \text{ESI Withheld} + \text{TDS Withheld} + \text{PT Withheld}$$
   - **Forensic Financial Impact:** By booking `net_salary` directly to `Expense`, total institutional labor costs are understated by the entire sum of statutory deductions (15% to 25% of payroll).
2. **Employee Withholdings Vanish into an Unrecorded Void:**
   - The school deducts PF (e.g. ₹1,800), ESI (₹375), and TDS (₹2,000) from an employee's paycheck.
   - These deducted sums are held in the school's bank account, representing **Current Liabilities payable to the Government**.
   - Because EduERP creates no liability accounts or subledgers for PF/ESI/TDS withholdings, management has zero visibility into pending statutory liabilities that must be deposited by the 7th/15th of the following month.

---

### 2.30 Zero Employer Statutory Contributions (EPF 12% + ESIC 3.25%) & CTC Distortion
* **Files:** `backend/app/services/payroll_engine.py` (lines 263–297), `backend/app/models/hrms.py` (lines 695–702, 857–863)

#### Flaws Identified:
1. **Zero Computation or Accrual of Mandatory Employer Contributions:**
   - Indian labor laws mandate employer matching contributions:
     - **EPF (Employees' Provident Fund):** 12% of (Basic + DA), capped at ₹1,800/month (with 8.33% to EPS, 3.67% to EPF, 0.5% EDLI, 0.5% Admin).
     - **ESIC (Employees' State Insurance):** 3.25% of Gross Wages.
   - `payroll_engine.py` only models employee deductions (`pf_deduction`, `esi_deduction`).
   - The database contains **zero columns, zero formulas, and zero accrual entries for Employer EPF or Employer ESIC**.
2. **Cost-to-Company (CTC) Understated by 15.25%:**
   - A school with 100 teachers earning an aggregate Basic + DA of ₹30,00,000 has a mandatory employer statutory liability of:
     $$₹30,00,000 \times 12\% = ₹3,60,000 \text{ (EPF)} + \text{ESIC} \approx \mathbf{₹4,50,000 / \text{month}}$$
   - Because this liability is neither calculated on payslips nor accrued in P&L, the school faces an unexpected annual cash drain of **₹54,00,000** when statutory challans are paid to EPFO and ESIC.

---

### 2.31 Absence of Staff Loans & Salary Advance Ledger / Automated Payroll Recovery
* **Files:** `backend/app/services/hrms_service.py` (lines 240–256), `backend/app/services/payroll_engine.py` (lines 125, 263), `backend/app/models/finance.py` (lines 141–175)

#### Flaws Identified:
1. **Zero Staff Loan / Advance Entity or Balance Sheet Asset Account:**
   - Schools routinely grant salary advances or emergency loans to teachers and drivers (₹10,000 to ₹1,00,000).
   - In EduERP, there is no `StaffLoan` or `SalaryAdvance` entity.
   - When funds are disbursed, accountants either record them as immediate operating `Expense` (distorting monthly P&L) or disburse them off-the-books.
   - **Accounting Violation:** A salary advance is a **Current Asset (Loans & Advances to Staff)**, NOT an operating expense.
2. **Zero Automated Payroll Recovery Schedule:**
   - `calculate_employee_payroll` has a static `other_deductions` float field with no recovery schedule or balance tracking.
   - If an employee takes a ₹50,000 advance repayable at ₹5,000/month over 10 months, the accountant must remember to manually enter ₹5,000 every single month.
   - If the accountant forgets or enters the wrong figure, the school fails to recover the loan.
3. **Resignation / Termination Bad Debt Leak:**
   - When an employee is marked `RESIGNED` or `TERMINATED` in `change_employee_status`, there is zero check for outstanding loan balances. Staff routinely leave the institution without repaying their advances.

---

### 2.32 Staff Ward Fee Concession Disconnect & Unchecked Revenue Leakage
* **Files:** `backend/app/models/academic.py` (lines 178–220), `backend/app/services/hrms_service.py` (lines 381–409), `backend/app/services/fee_ledger_service.py` (lines 1541–1590)

#### Flaws Identified:
1. **Zero Relational Link Between Staff Parents and Student Children:**
   - K-12 schools offer 50% to 100% tuition waivers for children of teachers and non-teaching staff (Staff Ward Concession).
   - In EduERP, `Student` has no `staff_parent_id` foreign key linking to `User` or `EmployeeProfile`.
   - Concessions are entered as manual, arbitrary one-off discounts on student invoices.
2. **Perpetual Revenue Bleed After Staff Exit:**
   - When a teacher resigns or is terminated, `change_employee_status` flips `user.is_active = False`.
   - Because no relational link or event listener exists, the billing engine has no knowledge that the parent has exited.
   - The student continues receiving 100% staff tuition waivers for years after the parent has left the institution, resulting in millions of rupees in uncollected tuition.
3. **Misclassification of Staff Perquisite in Financial Accounts:**
   - In institutional accounting (GAAP / Ind AS), staff child fee concessions are **Staff Welfare Expenses (Fringe Benefits)**, NOT a reduction of gross academic tuition revenue.
   - Gross tuition must be recognized in full, with an offsetting debit to `Staff Welfare & Perquisites Expense`. Dropping it directly from the bill conceals true instructional costs.

---

### 2.33 Absence of Full & Final (F&F) Settlement & Multi-Departmental Staff Clearance
* **Files:** `backend/app/services/hrms_service.py` (lines 381–409), `backend/app/services/asset_service.py` (lines 130–160), `backend/app/models/hrms.py` (lines 115–120)

#### Flaws Identified:
1. **Status Transition Merely Flips a Boolean:**
   - In `hrms_service.py:381`:
     ```python
     def change_employee_status(user_id, school_id, new_status, exit_date=None, exit_reason=None, actor_user=None):
         ...
         user.is_active = False
         profile.exit_date = ...
     ```
   - Changing status to `RESIGNED` or `TERMINATED` executes zero financial or asset clearance checks.
2. **Missing Multi-Departmental Signoff Pipeline:**
   - **IT & Fixed Assets:** No check whether the teacher returned institutional laptops, iPads, lab equipment, or campus keys (`asset_service.py`).
   - **Finance & Accounts:** No verification of unrecovered salary advances, travel imprests, or petty cash.
   - **Library:** No check for unreturned reference books or overdue library fines.
   - **Transport:** No verification of fleet vehicle key surrender or fuel card handover.
3. **Zero Statutory Gratuity & Leave Encashment Engine:**
   - Indian law (Payment of Gratuity Act, 1972) mandates gratuity payout for employees with $\ge 5$ years of service:
     $$\text{Gratuity} = \frac{15 \times \text{Last Drawn Basic} \times \text{Years of Service}}{26}$$
   - Furthermore, unused Privilege/Earned Leaves (`LeaveBalance.remaining`) must be encashed upon exit.
   - EduERP has zero calculation, provisioning, or settlement workflow for Gratuity or Leave Encashment.

---

### 2.34 Attendance Regularization & Retroactive Payroll Disconnect (Missing Payroll Arrears Engine)
* **Files:** `backend/app/services/payroll_engine.py` (lines 304–308), `backend/app/services/staff_attendance_service.py` (lines 87–105), `backend/app/models/hrms.py` (lines 781, 807)

#### Flaws Identified:
1. **Locked Payroll Runs Forbid Recalculation:**
   - In `payroll_engine.py:306`:
     ```python
     if existing_run and existing_run.status == PayrollRunStatus.LOCKED.value:
         raise ValueError('Payroll for this month is already LOCKED and cannot be recalculated.')
     ```
   - Payroll for Month $M$ is locked and disbursed on the 1st of Month $M+1$.
2. **Post-Lock Attendance Regularization Penalizes Staff Permanently:**
   - On the 3rd of Month $M+1$, the Principal approves an attendance regularization request (`StaffAttendanceRegularization`) or late medical leave for dates in Month $M$.
   - The attendance record flips from `ABSENT` to `PRESENT` or `ON_LEAVE`.
   - Because the payroll batch is locked and no **Payroll Arrears Engine** exists:
     - The employee cannot be reimbursed for the wrongful Loss of Pay (LOP) deduction.
     - The system has no mechanism to calculate retroactive salary adjustments (+1 day basic + allowances) and roll them into Month $M+1$'s payslip.
     - Teachers are permanently short-changed on their earned wages, causing severe labor disputes and compliance violations.

---

### 2.35 Absence of Corporate Banking Bulk Disbursement File Generator
* **Files:** `backend/app/services/payroll_engine.py` (lines 425–545), `backend/app/routes/hrms.py` (lines 1012–1054)

#### Flaws Identified:
1. **Disbursement Status Updated with Zero Bank Execution Artifact:**
   - Clicking "Pay All" in `pay_payroll_run_all_route` marks 100+ payslips as `PAID` and creates 100+ `Expense` rows.
   - However, **zero banking payment artifact is generated**.
2. **Manual Re-Keying Risk & Scalability Failure:**
   - In corporate institutional banking (SBI Corporate Net Banking, HDFC Enet, ICICI Corporate Internet Banking), bulk payroll is disbursed by uploading encrypted CSV/Excel files containing:
     $$\text{Beneficiary Account Number}, \text{IFSC Code}, \text{Beneficiary Name}, \text{Net Salary Amount}, \text{Narration / UTR Ref}$$
   - Without a bulk disbursement export engine, the school accounts clerk is forced to manually copy and paste 100+ account numbers and amounts into banking portals one by one, creating catastrophic risks of typos, payments to wrong beneficiaries, and duplicate transfers.

---

### 2.36 Absence of Out-of-Pocket Staff Expense Claims & Reimbursements
* **Files:** `backend/app/models/finance.py` (lines 141–175), `backend/app/routes/hrms.py` (lines 1086–1157)

#### Flaws Identified:
1. **Zero Staff Expense Reimbursement Module:**
   - Faculty and operational staff routinely incur out-of-pocket expenses on behalf of the school (science project kits, student medical emergencies, sports tournament travel, urgent diesel refills for school buses).
   - EduERP provides no workflow for staff to submit expense claims with supporting receipt photos/PDFs.
2. **Informal Cash Drawer Drain:**
   - Without an ERP reimbursement workflow, teachers seek cash from counter cashiers, depleting the daily tuition cash drawer off-the-books.
   - This creates reconciliation discrepancies between counter collections and bank deposits, concealing institutional operational expenses from the general ledger.

---

### 2.37 Income Tax Section 192 (TDS) Compliance & Form 16 Absence
* **Files:** `backend/app/models/hrms.py` (lines 698, 752), `backend/app/services/payroll_engine.py` (lines 124, 263, 293)

#### Flaws Identified:
1. **Flat Static TDS Float Without Tax Computation:**
   - In `EmployeeSalaryStructure`, `tds` is a static float (e.g. `tds = 2000.0`).
   - Section 192 of the Indian Income Tax Act requires employers to estimate an employee's annual taxable income, apply progressive tax slabs, evaluate investment declarations, and deduct average monthly tax.
   - EduERP provides:
     - Zero selection between the **Old Tax Regime** (with deductions) and the **New Tax Regime** (Section 115BAC).
     - Zero declaration portal for Section 80C (PPF, ELSS, tuition fees), 80D (health insurance), HRA rent receipts, or home loan interest.
     - Zero cumulative tax computation.
2. **Inability to Generate Form 16 Part A & Part B:**
   - Employers deducting TDS are legally required to file quarterly 24Q returns and provide employees with digitally signed Form 16 certificates.
   - EduERP has zero Form 16 generation capability, forcing schools into severe non-compliance penalties under the Income Tax Act.

---

## 3. Master Table Registry & Deprecation Matrix

| Table Name | Model File | Verdict | Root Cause & Action Required |
|---|---|---|---|
| `fee_structures` | `models/financial.py` | **DELETE** | Legacy flat rate table; superseded by `fee_structures_v2`. |
| `fee_structures_v2` | `models/fee_finance.py` | **CANONICAL** | Authoritative multi-tier rate card; keep as primary. |
| `fee_records` | `models/financial.py` | **SUNSET / READ-ONLY** | Legacy flat table creating dual-state split; stop all new writes. |
| `fee_bills` | `models/fee_finance.py` | **CANONICAL** | Modern demand bill; decouple `previous_dues` from `total_payable`. |
| `fee_bill_items` | `models/fee_finance.py` | **CANONICAL** | Itemized service heads; keep as primary line-item authority. |
| `student_ledgers` | `models/fee_finance.py` | **CANONICAL** | Double-entry AR sub-ledger; debit only new charges, never arrears. |
| `fee_payments` | `models/fee_finance.py` | **CANONICAL** | Master receipt authority; single source of truth for inflows. |
| `fee_payment_allocations` | `models/fee_finance.py`| **CANONICAL**| Line-item settlement breakdown; keep as primary. |
| `fee_transactions` | `models/financial.py` | **DELETE** | Legacy duplicate of `fee_payments`; eliminate writes. |
| `fee_receipt_groups` | `models/financial.py` | **DELETE** | Redundant receipt grouping model; delete. |
| `salary_records` | `models/financial.py` | **DELETE** | Manual scratch salary table; supersede with HRMS `payroll_runs`. |
| `staff_salary_records` | `models/finance.py` | **DELETE** | Duplicate staff salary table; supersede with HRMS `payroll_runs`. |
| `transport_fee_records` | `models/transport_student.py`| **DELETE**| Shadow transport billing; ingest route stops into `FeeBillItem`. |
| `transport_fee_transactions`| `models/transport_student.py`| **DELETE**| Shadow collection table; route all receipts through `FeePayment`. |
| `transport_vehicle_maintenance`| `models/transport.py`| **SYNC** | Hook `status='COMPLETED'` to auto-create verified `Expense`. |
| `hostel_fee_structures` | `models/hostel.py` | **MERGE** | Ingest room sharing & AC matrix into central `FeeHead('HOSTEL')`. |
| `hostel_inventory` | `models/hostel.py` | **MERGE** | Merge room furniture into central `school_assets` register. |
| `service_charges` | `models/service_charge.py`| **DELETE** | Orphan SaaS table; consolidate into `subscription.py`. |
| `exam_schedules` & 9 others | `models/financial.py` | **RELOCATE** | Academic models misplaced in finance file; move to `curriculum.py`. |

---

## 4. Phased Remediation Strategy

```
PHASED EXECUTION PIPELINE:
┌─────────────────────────┐     ┌─────────────────────────┐     ┌─────────────────────────┐     ┌─────────────────────────┐
│        PHASE 1          │     │        PHASE 2          │     │        PHASE 3          │     │        PHASE 4          │
│ Mathematical & Date     │────▶│ Portal & Gating         │────▶│ Elimination of Dead &   │────▶│ Unified P&L & True      │
│ Corrections (Immediate)│     │ Integration             │     │ Duplicate Shadow Tables │     │ Bank Reconciliation     │
└─────────────────────────┘     └─────────────────────────┘     └─────────────────────────┘     └─────────────────────────┘
```

### Phase 1: Mathematical & Date Corrections (Immediate / Zero Migration)
1. **Decouple `previous_dues` from `FeeBill.total_payable`:**
   $$\text{total\_payable} \equiv \text{total\_current\_charges} - \text{total\_discount} + \text{total\_late\_fine}$$
   `previous_dues` is preserved as an informational summary attribute only.
2. **Fix `StudentLedger` Bill Debit:** In `fee_ledger_service.py:934`, post `amount = bill.total_current_charges - bill.total_discount`, eliminating double-debited arrears.
3. **Fix Date Constraints in `FinanceAggregationService`:** Derive `date_from` and `date_to` from `month` parameter and pass to `FeePayment` query.
4. **Fix Concession Loop:** Deduct fixed discounts once from the target fee head, never across every item of every bill.
5. **Close IDOR Vulnerability:** Add `_verify_student_access(user, student_id)` to `GET /api/fees-finance/students/<id>/ledger`.

### Phase 2: Portal & Gating Integration
1. **Migrate Student & Parent Portal to Modern Engine:** Update `student.py:265` to query `FeeBill`, `FeeBillItem`, and `FeePayment` instead of legacy `FeeRecord`.
2. **Exam Admit Card Clearance Gating:** Add outstanding balance check in `principal.py:4049` (`admit_card_pdf`), blocking generation if dues exceed school threshold.
3. **Harmonize Admission Receipt Authority:** Issue single canonical `FP-YYYYMM-XXXX` receipt on admission; eliminate disconnected `REC-` numbers.
4. **Fix Staff Payslip PDF Download:** Accept JWT token as query parameter or implement blob download in `StaffSelfService.jsx`.

### Phase 3: Shadow Table Elimination & Modular Ingestion
1. **Hostel Ingestion:** Route bed charges into `FeeBillItem` under `FeeHead('HOSTEL')`. Stop writes to `FeeRecord`.
2. **Transport Ingestion:** Route route/stop charges into `FeeBillItem` under `FeeHead('TRANSPORT')`. Stop writes to `TransportFeeRecord`.
3. **Merge Inventory:** Consolidate `hostel_inventory` into `school_assets`.
4. **Relocate Academic Models:** Move `exam_schedules`, `timetables`, and `holidays` from `financial.py` into `curriculum.py`.

### Phase 4: Unified P&L, CAPEX Rules & Reconciliation
1. **Accrual & Cash Payroll Integration:** In `payroll_engine.py`, post gross salary and statutory employer liabilities to `Expense` under `TEACHER_SALARY` and `STAFF_SALARY`.
2. **Fleet Repairs Integration:** Auto-create `Expense(category='TRANSPORT_MAINTENANCE')` on vehicle maintenance completion.
3. **CAPEX Segregation:** In `procurement_service.py`, capitalize `target_type='ASSET'` purchase orders into `school_assets` rather than operational `INVENTORY_PURCHASE`.
4. **Reconciliation Engine Overhaul:** Match bank statement credits against unified `FeePayment` records using admission number & phone regex, and match debits against `Expense`, `PayrollSlip`, and `FeeRefund`.
