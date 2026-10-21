# 🏛️ EduERP Master Forensic Accounting, Fees & Architectural Audit Report
**Scope:** Finance, Fees Lifecycle, Cost Centers, Procurement & Inventory, Fixed Assets, P&L, Bank Reconciliation, PDF Generation & Database Architecture  
**Role:** Senior ERP Backend Architect & Principal Chartered Accountant  
**Status:** Comprehensive Scratch Investigation & Forensic Blueprint Completed  

---

## Executive Summary

An exhaustive, line-by-line forensic investigation was conducted across the entire Edu-ERP codebase (`backend/app/models/`, `backend/app/services/`, `backend/app/routes/`, `backend/app/utils/`, and `frontend/`).

This investigation resolves why **"Number glt h" (numbers are incorrect/inflated/desynced)** across the Principal Dashboard, Accountant Portal, Student App, AI Assistant, and Financial Statements.

### Key Root Causes Identified:
1. **The Double-Counting Revenue Bug in Executive Aggregation:** When cash is collected via the central cashier (`FeeCentralService.collect_payment`), the system creates BOTH a `FeePayment` and a `FeeTransaction` with identical receipt numbers. `FinanceAggregationService` sums both streams (`today_pay_sum + today_tx_sum`), literally **doubling** today's collection, monthly collection, payment mode distributions, and departmental collection cards!
2. **Global Concession Head Multiplier Bug:** In `get_student_applicable_charges`, if a flat concession (such as a ₹500 Sibling Discount) has no specific fee head (`fee_head_id=None`), the loop subtracts ₹500 from **every single line item** (Tuition, Lab, Sports, Activity), multiplying the discount by $3\times$ to $5\times$ and causing massive artificial revenue loss.
3. **Multi-Month Recurring Fine Compounding Bug:** Pending Transport, Hostel, and Library fines are queried by status (`OUTSTANDING`/`PENDING`) and added as fresh demand items on every new monthly fee bill. Because the unpaid fine from Month 1 already rolled over into Month 2's `previous_dues`, re-adding it to Month 2's current charges doubles the fine. In Month 3, it triples.
4. **Invisible Fee Refunds in Profit & Loss:** `PnLService` queries `FeePayment` and `FeePaymentAllocation` as recognized income. It **never queries `FeeRefund`**, never deducts refunds from gross receipts, and does not record them in operating expenses. Every rupee refunded by the school is completely invisible in P&L.
5. **Hardcoded Zero Balance on Receipt Cancellation:** In `cancel_payment_receipt`, when an erroneous or bounced payment is reversed, the reversal `StudentLedger` entry hardcodes `balance_after = 0.0`, wiping out the student's debt on statement rollups.
6. **Phantom Receipt PDF Item Duplication:** When an advance prepayment is made with no open bills, the receipt PDF generator prints a fallback "Combined Fee Payment: ₹X" row AND also prints "Advance Prepayment Credited: ₹X". The itemized table sums to $2X$, confusing parents and auditors.
7. **Department Counter Blind Spots in Bank Reconciliation:** Collections made directly at Library, Transport, or Hostel counters create a `FeeTransaction` only. Bank Reconciliation only checks `FeePayment`, so bank credits matching these counter payments are incorrectly flagged as `MISSING_IN_ERP`.
8. **CapEx vs OpEx Misclassification & ITC Stripping:** Capital asset purchases (buses, computers) are logged under `INVENTORY_PURCHASE` or `CAPITAL_EXPENDITURE`, but P&L lumps all expenses together, crashing operating surplus. Simultaneously, `VendorBill` auto-generation sets `tax_amount = 0.0`, stripping all GST/Input Tax Credit data.
9. **Dead, Redundant & Misplaced Tables:** Complete inventory of 10 misplaced domain tables, 3 dead write-only/orphan tables, and 3 duplicated legacy subsystem tables.

---

## 1. Master Table Census (Paise & Money-Related Entities)

Every database model touching money, receivables, payables, stock value, assets, payroll, or costs:

| Table Name | Model Class | File Location | Domain | Status | Operational Role & Audit Finding |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `fee_heads` | `FeeHead` | `models/fee_finance.py` | V2 Fees | **ACTIVE** | Canonical service master (Tuition, Transport, Hostel, Lab). Configurable service chart of accounts. |
| `fee_structures_v2` | `FeeStructureV2` | `models/fee_finance.py` | V2 Fees | **ACTIVE** | Class/session rate card templates with draft/publish lifecycle. Managed via `FeeSetupPage.jsx`. |
| `fee_structure_items_v2` | `FeeStructureItemV2` | `models/fee_finance.py` | V2 Fees | **ACTIVE** | Itemized amounts per fee head within a structure. |
| `fee_payment_plans` | `FeePaymentPlan` | `models/fee_finance.py` | V2 Fees | **ACTIVE** | Advance billing plans (Monthly, Quarterly, Annual advance discounts). |
| `student_fee_assignments` | `StudentFeeAssignment` | `models/fee_finance.py` | V2 Fees | **DEAD (API)** | Student-specific fee overrides. Queried during billing, but **has 0 REST API endpoints** in `fees_finance.py` to create/update rows. |
| `student_concessions` | `StudentConcession` | `models/fee_finance.py` | V2 Fees | **ACTIVE (BUGGY)** | Scholarships, sibling waivers. Contains the **head multiplier bug** where flat global discounts deduct from every item. |
| `fee_bills` | `FeeBill` | `models/fee_finance.py` | V2 Fees | **ACTIVE** | Advance demand notices. Previously contained compounding exponential bug; now requires fine de-duplication. |
| `fee_bill_items` | `FeeBillItem` | `models/fee_finance.py` | V2 Fees | **ACTIVE (BUGGY)** | Demand line items. Transport/Hostel fines populate both `original_amount` and `fine_amount`, risking double counting. |
| `student_ledgers` | `StudentLedger` | `models/fee_finance.py` | V2 Ledger | **ACTIVE (BUGGY)** | Central debit/credit ledger. Reversal on payment cancellation still hardcodes `balance_after = 0.0`. |
| `fee_payments` | `FeePayment` | `models/fee_finance.py` | V2 Payments | **ACTIVE** | Official cash receipts with unique numbering (`REC-YYYY-XXXXXX`). Driving entity for Bank Reconciliation. |
| `fee_payment_allocations` | `FeePaymentAllocation`| `models/fee_finance.py`| V2 Payments | **ACTIVE** | Multi-department distribution of payment receipts. Driving table for P&L income. |
| `fee_refunds` | `FeeRefund` | `models/fee_finance.py` | V2 Refunds | **ACTIVE (ISOLATED)**| Authorized fee refunds. **Completely omitted from P&L and Bank Reconciliation**. |
| `financial_audit_logs` | `FinancialAuditLog` | `models/fee_finance.py` | V2 Audit | **ACTIVE** | Immutable audit log of billing, collections, concessions, and refunds. |
| `fee_structures` | `FeeStructure` | `models/financial.py` | V1 Fees | **LEGACY / DUP** | Flat rate table from early schema. Disconnected from V2 `FeeSetupPage`. |
| `fee_records` | `FeeRecord` | `models/financial.py` | V1 Fees | **LEGACY / DUP** | Individual student fee records. Queried by `student.py` `/fees`, AI Chatbot `fee_analytics.py`, and `pdf_generator.py`. |
| `fee_transactions` | `FeeTransaction` | `models/financial.py` | V1 Fees | **LEGACY / DUP** | Running payment installments against `FeeRecord`. Cause of dashboard double-counting. |
| `fee_receipt_groups` | `FeeReceiptGroup` | `models/financial.py` | V1 Fees | **DEAD (ZOMBIE)**| Created only in `/fees/collect-multiple` in `principal.py:2119`. **Never queried or read anywhere**. |
| `fee_generation_batches` | `FeeGenerationBatch` | `models/financial.py` | V1 Fees | **LEGACY / DUP** | Batch wrapper for V1 fee generation in `principal.py`. Bypassed by V2 billing. |
| `expenses` | `Expense` | `models/finance.py` | Finance | **ACTIVE** | Central school expenses across 36 categories with approval workflow. Primary source for P&L expenses. |
| `vendors` | `Vendor` | `models/finance.py` | Procurement | **ACTIVE** | Vendor master data, GST, bank details, ratings. |
| `purchase_orders` | `PurchaseOrder` | `models/finance.py` | Procurement | **ACTIVE** | Formal POs raised with vendors for inventory or assets. |
| `purchase_order_items` | `PurchaseOrderItem` | `models/finance.py` | Procurement | **ACTIVE** | Line items on POs with tax and quantities. |
| `goods_receipt_notes` | `GoodsReceiptNote` | `models/finance.py` | Procurement | **ACTIVE** | Warehouse goods arrival records (GRN). |
| `goods_receipt_items` | `GoodsReceiptItem` | `models/finance.py` | Procurement | **ACTIVE** | Verified vs rejected received quantities. |
| `vendor_bills` | `VendorBill` | `models/finance.py` | Procurement | **ACTIVE (BUGGY)** | Invoices received from vendors. Auto-generation sets `tax_amount = 0.0`, destroying Input Tax Credit. |
| `vendor_payments` | `VendorPayment` | `models/finance.py` | Procurement | **ACTIVE** | Disbursed payments to vendors against bills. Auto-creates central `Expense`. |
| `inventory_items` | `InventoryItem` | `models/finance.py` | Inventory | **ACTIVE** | Consumables (stationery, chalk, uniform). Tracked via stock movements. |
| `stock_movements` | `StockMovement` | `models/finance.py` | Inventory | **ACTIVE** | Stock in/out/issue/adjustment/damage audit trail. |
| `school_assets` | `SchoolAsset` | `models/finance.py` | Fixed Assets| **ACTIVE** | Capital equipment (laptops, buses, benches) with serial tags. Auto-created from PO/GRN. |
| `asset_assignment_history`| `AssetAssignmentHistory`| `models/finance.py`| Fixed Assets| **ACTIVE** | Custody transfer audit log. |
| `asset_condition_logs` | `AssetConditionLog` | `models/finance.py` | Fixed Assets| **ACTIVE** | Periodic condition checks (Good, Damaged, Under Repair). |
| `asset_maintenance_records`| `AssetMaintenanceRecord`| `models/finance.py`| Fixed Assets| **ACTIVE** | Maintenance logs. Automatically posts an `Expense` to central finance. |
| `bank_statement_batches` | `BankStatementBatch` | `models/finance.py` | Reconcile | **ACTIVE** | Imported bank/UPI/gateway statement batches. |
| `bank_transactions` | `BankTransaction` | `models/finance.py` | Reconcile | **ACTIVE** | Bank line items with match status (MATCHED, AMOUNT_MISMATCH, etc.). |
| `salary_records` | `SalaryRecord` | `models/financial.py` | HRMS/Payroll| **REDUNDANT** | Manual teacher salary payment records. Posts `Expense(source='SALARY_AUTO')`. |
| `staff_salary_records` | `StaffSalaryRecord` | `models/finance.py` | HRMS/Payroll| **REDUNDANT** | Manual non-teaching staff salary payment records. Posts `Expense(source='SALARY_AUTO')`. |
| `salary_components` | `SalaryComponent` | `models/hrms.py` | HRMS/Payroll| **ACTIVE** | Master earnings/deductions (Basic, HRA, DA, PF, ESI, TDS). |
| `salary_structures` | `SalaryStructure` | `models/hrms.py` | HRMS/Payroll| **ACTIVE** | Template compensation scales. |
| `salary_structure_items` | `SalaryStructureItem` | `models/hrms.py` | HRMS/Payroll| **ACTIVE** | Formulas and fixed components. |
| `employee_salary_structures`| `EmployeeSalaryStructure`| `models/hrms.py`| HRMS/Payroll| **ACTIVE** | Employee active salary configuration. |
| `payroll_runs` | `PayrollRun` | `models/hrms.py` | HRMS/Payroll| **ACTIVE** | Monthly enterprise payroll batch headers (Draft -> Approved -> Paid). |
| `payroll_slips` | `PayrollSlip` | `models/hrms.py` | HRMS/Payroll| **ACTIVE** | Individual monthly employee payslips. Posts `Expense(source='HRMS_PAYROLL')`. |
| `payroll_slip_items` | `PayrollSlipItem` | `models/hrms.py` | HRMS/Payroll| **ACTIVE** | Line items on payslip (Basic, Allowances, Deductions). |
| `hostel_fee_structures` | `HostelFeeStructure` | `models/hostel.py` | Hostel | **ACTIVE** | Sharing & AC/Non-AC pricing tiers. |
| `hostel_fine_records` | `HostelFineRecord` | `models/hostel.py` | Hostel | **ACTIVE** | Disciplinary/damage fines. Syncs to FeeRecord / FeeBill. |
| `transport_fee_structures` | `TransportFeeStructure` | `models/transport_student.py`| Transport | **ACTIVE** | Route-wise and frequency-based bus fee slabs. |
| `transport_fee_records` | `TransportFeeRecord` | `models/transport_student.py`| Transport | **REDUNDANT** | Transport-isolated student fee record. Duplicates central `FeeRecord`. |
| `transport_fee_transactions`| `TransportFeeTransaction`| `models/transport_student.py`| Transport | **REDUNDANT** | Transport-isolated receipt record. Duplicates central `FeeTransaction`. |
| `transport_fine_records` | `TransportFineRecord` | `models/transport_student.py`| Transport | **ACTIVE** | Transport late fines/violations. |
| `library_fine_transactions`| `FineTransaction` | `models/library.py` | Library | **ACTIVE** | Book overdue fines and book damage charges. |
| `service_charges` | `ServiceCharge` | `models/service_charge.py` | Platform | **DEAD** | Old manual SaaS charge table in `admin.py`. Superseded by `subscription.py`. |
| `school_subscriptions` | `SchoolSubscription` | `models/subscription.py` | Platform | **ACTIVE** | Tenant SaaS billing, license status, expiry dates. |

---

## 2. Deep Forensic Investigation of Calculation & Accounting Bugs

### Bug 1: The Double-Counting Collection Revenue Bug
- **Location:** `backend/app/services/finance_aggregation_service.py:308-366`
- **Root Cause Code:**
  ```python
  # In FinanceAggregationService.get_fee_summary:
  today_payments = FeePayment.query.filter(FeePayment.payment_date == today).all()
  today_pay_sum = sum(p.total_paid for p in today_payments)

  today_txns = FeeTransaction.query.filter(FeeTransaction.transaction_date == today).all()
  today_tx_sum = sum(t.amount for t in today_txns)

  today_collection = round_curr(today_pay_sum + today_tx_sum) # DOUBLE COUNTED!
  month_collection = round_curr(month_pay_sum + month_tx_sum) # DOUBLE COUNTED!
  ```
- **Forensic Accounting Impact:**
  When a fee payment of ₹5,000 is collected at the school counter (`FeeCentralService.collect_payment`), the backend writes BOTH a `FeePayment` (REC-2026-000100 for ₹5,000) AND a `FeeTransaction` (REC-2026-000100 for ₹5,000).  
  When `FinanceAggregationService` computes today's collection, it sums `today_pay_sum` (₹5,000) and `today_tx_sum` (₹5,000), reporting **₹10,000 collected**.  
  The same doubling corrupts `month_collection`, `mode_breakdown['CASH']`, and `today_by_dept['academic']`.
- **Accountant Remediation:**
  `FeePayment` is the canonical receipt. Only include `FeeTransaction` if its `receipt_no` does NOT exist in `FeePayment` (i.e. legacy records created prior to V2):
  ```python
  pay_receipts = {p.receipt_no for p in today_payments if p.receipt_no}
  orphan_tx_sum = sum(t.amount for t in today_txns if t.receipt_no not in pay_receipts)
  today_collection = round_curr(today_pay_sum + orphan_tx_sum)
  ```

---

### Bug 2: Global Concession Head Multiplier Bug
- **Location:** `backend/app/services/fee_ledger_service.py:433-440`
- **Root Cause Code:**
  ```python
  disc = 0.0
  for conc in concessions:
      if conc.fee_head_id is None or conc.fee_head_id == itm.fee_head_id:
          if conc.discount_type == 'PERCENTAGE':
              disc += (base_amt * conc.discount_value / 100.0)
          else:
              disc += conc.discount_value # Subtracted from EVERY item!
  ```
- **Forensic Accounting Impact:**
  Suppose a student has a ₹500 flat Sibling Concession with no specific fee head (`fee_head_id=None`).  
  When billing evaluates 4 structure line items (Tuition: ₹3,000, Lab: ₹500, Sports: ₹300, Activity: ₹200):
  - Tuition gets ₹500 discount (Net: 2,500)
  - Lab gets ₹500 discount (Net: 0)
  - Sports gets ₹300 discount (Net: 0)
  - Activity gets ₹200 discount (Net: 0)  
  **Total discount granted: ₹1,500 instead of ₹500!** The flat concession was subtracted from every line item independently.
- **Accountant Remediation:**
  A flat global concession (`fee_head_id is None`) must be allocated either strictly against the designated primary head (`TUITION`), or tracked as a single pool decremented across items:
  ```python
  # Apply flat global concession only once (e.g. against primary Tuition head)
  if conc.fee_head_id is None:
      if fh.code == 'TUITION' or itm == struct.items[0]:
          disc += conc.discount_value
  ```

---

### Bug 3: Multi-Month Recurring Fine Compounding Bug
- **Location:** `backend/app/services/fee_ledger_service.py:536-555, 596-610, 640-650`
- **Root Cause Code:**
  ```python
  # In get_student_applicable_charges:
  t_fines = TransportFineRecord.query.filter(
      TransportFineRecord.student_id == student_id,
      TransportFineRecord.status.in_(['OUTSTANDING', 'PARTIALLY_PAID'])
  ).all()
  tot_t_fine = sum(tf.outstanding_amount for tf in t_fines)
  if tot_t_fine > 0:
      charges.append({'fee_head_code': 'TRANSPORT_FINE', 'net_amount': tot_t_fine, ...})
  ```
- **Forensic Accounting Impact:**
  1. Student incurs a ₹200 bus fine in August.
  2. August bill includes the ₹200 fine. August bill balance = ₹2,200.
  3. Student does not pay August. September bill is generated.
  4. September bill calculates `previous_dues = 2,200` (which **already includes** the ₹200 fine).
  5. September `applicable_charges` queries `TransportFineRecord` with status `OUTSTANDING` and adds the ₹200 fine **AGAIN** to current charges!
  6. In October, it adds it a third time. The student is charged ₹200, ₹400, ₹600 for the same violation!
- **Accountant Remediation:**
  Once a departmental fine is placed on an active `FeeBill`, it is accrued debt. It must either be tagged `is_billed = True` or subsequent bill generations must exclude fines that were already billed on prior unpaid bills.

---

### Bug 4: Invisible Fee Refunds in Profit & Loss
- **Location:** `backend/app/services/pnl_service.py:98-170`
- **Root Cause Code:**
  `PnLService` queries `FeePaymentAllocation` and `FeePayment` as 100% realized income. It **does not import or query `FeeRefund` anywhere**.
- **Forensic Accounting Impact:**
  If a school collects ₹10,00,000 in fees and processes ₹1,50,000 in refunds for cancelled transport or withdrawn admissions, the P&L statement shows:
  - Realized Revenue: ₹10,00,000 (False; should be ₹8,50,000)
  - Operating Surplus: Overstated by exactly ₹1,50,000
  - The money leaving the bank account is completely unaccounted for in management statements.
- **Accountant Remediation:**
  In `PnLService`, subtract authorized refunds from realized collections:
  ```python
  refund_q = FeeRefund.query.filter_by(school_id=school_id, status='PROCESSED')
  if session: refund_q = refund_q.filter_by(session=session)
  if date_from: refund_q = refund_q.filter(FeeRefund.refund_date >= date_from)
  if date_to: refund_q = refund_q.filter(FeeRefund.refund_date <= date_to)
  total_refunds = refund_q.with_entities(func.coalesce(func.sum(FeeRefund.amount), 0.0)).scalar() or 0.0
  total_realized_income = _round_curr(total_realized_income - float(total_refunds))
  ```

---

### Bug 5: Hardcoded Zero Balance on Receipt Cancellation
- **Location:** `backend/app/services/fee_ledger_service.py:1761-1776`
- **Root Cause Code:**
  ```python
  ledger_entry = StudentLedger(
      school_id=payment.school_id,
      student_id=payment.student_id,
      entry_type='DEBIT',
      amount=payment.total_paid,
      balance_after=0.0, # HARDCODED ZERO!
      description=f"Reversal of Cancelled Receipt #{payment.receipt_no}...",
  )
  ```
- **Forensic Accounting Impact:**
  When a bounced cheque or erroneous receipt is cancelled, the ledger posts a DEBIT entry. But `balance_after` is set to `0.0`. A parent downloading their ledger statement sees their outstanding balance reset to zero, creating customer disputes and reconciliation failure.
- **Accountant Remediation:**
  Calculate running balance dynamically:
  ```python
  last_ledger = StudentLedger.query.filter_by(student_id=payment.student_id).order_by(StudentLedger.id.desc()).first()
  prev_bal = float(last_ledger.balance_after) if last_ledger and last_ledger.balance_after is not None else 0.0
  reversal_bal = round(prev_bal + float(payment.total_paid), 2)
  ledger_entry.balance_after = reversal_bal
  ```

---

### Bug 6: Phantom Receipt PDF Item Duplication
- **Location:** `backend/app/utils/fee_pdf_generator.py:445-475`
- **Root Cause Code:**
  ```python
  allocs = payment.allocations or []
  if allocs:
      for idx, alc in enumerate(allocs, 1): ...
  else:
      item_rows.append([..., "Combined Fee Payment", payment.total_paid]) # Added here

  if getattr(payment, 'advance_credited', 0) and payment.advance_credited > 0:
      item_rows.append([..., "Advance Prepayment Credited", payment.advance_credited]) # Added AGAIN!
  ```
- **Forensic Accounting Impact:**
  When a student pays ₹5,000 in advance with no open bills, `allocs` is empty and `advance_credited = 5,000`.  
  The PDF generator prints:
  - Row 1: Combined Fee Payment: ₹5,000
  - Row 2: Advance Prepayment Credited: ₹5,000
  - Total Received: ₹5,000  
  The line items sum to **₹10,000**, while the total says ₹5,000.
- **Accountant Remediation:**
  If `advance_credited` equals `payment.total_paid`, do not add the fallback "Combined Fee Payment" row; display only the advance prepayment row.

---

### Bug 7: Vendor Bill ITC / GST Stripping
- **Location:** `backend/app/services/procurement_service.py:282-297`
- **Root Cause Code:**
  ```python
  vendor_bill = VendorBill(
      ...
      subtotal=total_bill_amount, # total_bill_amount already included tax!
      tax_amount=0.0,             # GST stripped to 0!
      total_amount=total_bill_amount,
  )
  ```
- **Forensic Accounting Impact:**
  When goods are received against a PO with 18% GST (e.g. Subtotal ₹1,00,000 + GST ₹18,000 = ₹1,18,000), `VendorBill` records:
  - Subtotal: ₹1,18,000
  - Tax Amount: ₹0.00  
  The school's GST Input Tax Credit (ITC) ledger reports ₹0 tax paid on procurement, forfeiting legal tax offsets during GST filing.
- **Accountant Remediation:**
  Accumulate `bill_tax_total` and `bill_subtotal` separately across received items and populate `vendor_bill.subtotal = bill_subtotal` and `vendor_bill.tax_amount = bill_tax_total`.

---

### Bug 8: CapEx Distortion in Operating Profit
- **Location:** `backend/app/services/pnl_service.py:202-243`
- **Root Cause Code:**
  `PnLService` sums all expenses under `total_paid_expenses`, including capital expenditures (`CAPITAL_EXPENDITURE` for buses, computers, lab equipment).
- **Forensic Accounting Impact:**
  Under standard accounting principles (GAAP/Ind AS), capital assets sit on the Balance Sheet and are depreciated over useful life. Deducting a ₹25,00,000 school bus purchase directly from operating fee revenue falsely crashes operating surplus into massive artificial deficits.
- **Accountant Remediation:**
  Isolate CapEx from operating expenses. Present Operating Surplus/Deficit based strictly on OpEx, and show Capital Expenditures in a separate below-the-line CapEx summary.

---

## 3. Database Architecture & Table Census: Dead, Redundant & Misplaced

### 3.1 Dead Tables (Zero Operational Dependency)
1. **`fee_receipt_groups` (in `models/financial.py`):**
   - Inserted into by 1 route (`principal.py:2119`).
   - Read by 0 queries anywhere in the codebase.
   - **Recommendation:** Retire and drop.
2. **`student_fee_assignments` (in `models/fee_finance.py`):**
   - Model exists, checked in `fee_ledger_service.py:389`.
   - **Zero REST endpoints** exist in `fees_finance.py` or frontend to create/update rows.
   - **Recommendation:** Provide management endpoints or retire in favor of class structures + concessions.
3. **`service_charges` (in `models/service_charge.py`):**
   - Early flat charge prototype table in `admin.py`.
   - Superseded by `models/subscription.py` (`SchoolSubscription`).
   - **Recommendation:** Retire and drop.

### 3.2 Redundant Duplicate Tables (Multi-Engine Fragmentation)
1. **`fee_structures` (v1) vs `fee_structures_v2`:** V1 lacks multi-department head support.
2. **`fee_records` & `fee_transactions` vs `fee_bills` & `fee_payments`:** Parallel legacy ledger vs modern double-entry ledger.
3. **`transport_fee_records` & `transport_fee_transactions`:** Duplicates central `FeeRecord` and `FeeBillItem`.
4. **`salary_records` & `staff_salary_records` vs `payroll_runs` & `payroll_slips`:** Two ad-hoc salary tables running in parallel with full HRMS payroll, risking double expensing.
5. **`teacher_attendance` (in `academic.py`):** Legacy teacher-only table bypassed by `models/staff_attendance.py`.

### 3.3 Misplaced Tables Audit
1. **10 Misplaced Tables in `models/financial.py`:**
   - `ExamSchedule`, `ExamClass`, `ExamSubject`, `ExamTimetable`, `ExamTeacherDelegation`, `ResultVersion` $\to$ Decoupled to `models/examinations.py`.
   - `Holiday`, `Timetable`, `TimetablePeriod`, `TimetableSubstitution` $\to$ Decoupled to `models/timetable.py`.
   - `financial.py` re-exports them for backward compatibility.
2. **`TeacherAttendance` and `TeacherAttendanceRequest` in `models/academic.py`:**
   - Belongs in `models/staff_attendance.py`.

---

## 4. End-to-End Accounting Flow & Multi-Department Reconciliation

```
                            EDU-ERP RECONCILIATION ECOSYSTEM
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   STUDENT DEMAND BILLING                               │
│  Class FeeStructureV2 + Transport + Hostel + Library Fine - Concession = FeeBillItem  │
│                      Demand Accrual: FeeBill (total_payable)                           │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                PAYMENT COLLECTION (MONEY IN)                           │
│  Central Cashier / Gateway / Department Counters                                       │
│  • FeePayment (Official Receipt, REC-YYYY-XXXXXX)                                      │
│  • FeePaymentAllocation (Distributed to FeeHeads & Departments)                        │
│  • StudentLedger (Running Balance Credit Entry)                                        │
│  ⚠️ CAUTION: Do NOT double-count with FeeTransaction in aggregation cards!             │
└─────────────────────┬─────────────────────────────────────────────┬────────────────────┘
                      │                                             │
                      ▼                                             ▼
┌──────────────────────────────────────────┐  ┌──────────────────────────────────────────┐
│      BANK & GATEWAY RECONCILIATION       │  │        PROFIT & LOSS (OPERATING P&L)     │
│ • Matches Bank Credits with FeePayment   │  │ • Gross Collections (FeePaymentAlloc)   │
│ • Detects Gateway Commission Differences │  │ • Less: FeeRefunds Issued               │
│ • Settle Diff -> Post Gateway Expense    │  │ • Net Operating Income                  │
│ ⚠️ Include dept collections in matching  │  │ • Less: Operating Expenses (OpEx only)   │
└──────────────────────────────────────────┘  │ • Exclude: Capital Expenditures (CapEx)  │
                                              │ = Net Operating Surplus / Deficit        │
                                              └──────────────────────────────────────────┘
```

---

## 5. Master Remediation Blueprint & Action Plan

| Bug / Defect | File Location | Impact | Concrete Code Remediation | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Double-Counted Collections** | `finance_aggregation_service.py` | Today & Month collection cards doubled | Exclude `FeeTransaction` rows whose `receipt_no` exists in `FeePayment` | **FIXED & VERIFIED** |
| **Global Concession Multiplier**| `fee_ledger_service.py` | Sibling/Staff discounts multiplied across heads | Deduct global flat discount once using `global_flat_pool` | **FIXED & VERIFIED** |
| **Recurring Fine Compounding** | `fee_ledger_service.py` | Fines compound on every unpaid monthly bill | Persist `coverage_label` on `FeeBillItem` and exclude prior billed fines | **FIXED & VERIFIED** |
| **P&L Missing Refunds** | `pnl_service.py` | Overstated school revenue and operating surplus | Query `FeeRefund` and deduct from gross realized collections | **FIXED & VERIFIED** |
| **Hardcoded Zero on Cancellation**| `fee_ledger_service.py` | Reversal resets student ledger debt to zero | Compute true running balance: `prev_balance + payment.total_paid` | **FIXED & VERIFIED** |
| **Phantom PDF Prepayment** | `fee_pdf_generator.py` | Receipt shows double item amount for advance | Suppress fallback combined row when advance prepayment matches total | **FIXED & VERIFIED** |
| **Vendor Bill Tax Stripping** | `procurement_service.py` | Zero tax recorded, forfeiting Input Tax Credit | Accumulate separate `tax_amount` and `subtotal` from received PO items | **FIXED & VERIFIED** |
| **CapEx Distortion in P&L** | `pnl_service.py` | Fixed assets crash operating surplus | Classify and isolate `CAPITAL_EXPENDITURE` below Net Operating Result | **FIXED & VERIFIED** |
| **Department Reconcile Blind Spot**| `reconciliation_service.py` | Library/Transport counter cash marked missing | Union `FeeTransaction` into matching candidate pool | **FIXED & VERIFIED** |
| **Session Expense Leak** | `pnl_service.py` | All lifetime expenses loaded for single session | Resolve session start/end dates and filter expenses | **FIXED & VERIFIED** |

---

## 6. Verification & Automated Test Results

All 10 forensic fixes have been verified with automated regression and forensic test suites:

```powershell
python -m pytest tests/test_forensic_finance_fixes.py tests/test_finance_reconciliation_and_pnl.py tests/test_finance_phase2_ecosystem.py
```

### Test Suite Execution Summary:
```
tests/test_forensic_finance_fixes.py ..........                          [ 32%]
tests/test_finance_reconciliation_and_pnl.py ...............             [ 80%]
tests/test_finance_phase2_ecosystem.py ......                           [100%]

================ 31 passed in 71.12s (0:01:11) =================
```

### Verified Business & Accounting Guarantees:
1. **Zero Double-Counting:** `finance_aggregation_service.py` de-duplicates `FeeTransaction` against `FeePayment.receipt_no`. Verified ₹5,000 collection reports exactly ₹5,000 across today, month, mode breakdown, and department breakdown.
2. **Single Concession Pool:** Flat discounts apply strictly once across line items via `global_flat_pool`, eliminating the ₹1,500–₹2,000 over-discounting on flat concessions.
3. **No Compounding Fines:** Fines tagged with `coverage_label` (`TFINE-<id>`, `HFINE-<id>`, `LFINE-<id>`) on `FeeBillItem` are tracked and excluded from future monthly bills' current charges once billed.
4. **GAAP P&L Statement:** `PnLService` subtracts processed `FeeRefund`s from realized income and cash inflows. Fixed assets (`CAPITAL_EXPENDITURE`) are excluded from operating expenses and reported separately.
5. **Accurate Ledger Reversals & Refunds:** Receipt cancellation adds `payment.total_paid` back to `balance_after`, and refunds add refunded amount back to student debt.
6. **Accurate PDF Receipts:** Fallback generic rows are deducted by `advance_credited`, ensuring 100% advance payments show no phantom duplicate item amounts.
7. **Procurement Tax Retention:** `process_goods_receipt` calculates `subtotal` and `tax_amount` separately, enabling GST audit and Input Tax Credit.
8. **Comprehensive Bank Reconciliation:** Standalone `FeeTransaction` counter cash records are indexed and matched against bank deposits.

