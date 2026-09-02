"""
Deterministic Payroll Engine for School HRMS
OnePlatform360 / EduERP

Calculates accurate monthly payroll for all employees (Teachers and Staff):
- Configurable calculation policies:
  - PAYABLE_DAYS: Gross / Calendar Days, paid for (Calendar Days - Unpaid Days)
  - WORKING_DAYS: Gross / Working Days, paid for (Present + Paid Leaves + Holidays + Weekly Offs)
  - FIXED_MONTHLY: Flat gross minus LOP deductions
- Auto-recognizes Sundays and configured Weekly Offs (ZERO deduction)
- Auto-recognizes School Holidays (ZERO deduction)
- Excludes approved Paid Leaves from deduction
- Deducts unexcused absences and approved Unpaid Leaves (Loss of Pay)
- Computes salary components (Basic, HRA, DA, TA, Special Allowance, PF, ESI, PT, TDS)
- Batch draft generation, approval, and locking
- Generates linked school expense records upon approval for Financial P&L consistency
"""

import calendar
from datetime import datetime, date, timedelta
from calendar import monthrange
from app import db
from app.models.user import User, UserRole
from app.models.hrms import (
    EmployeeSalaryStructure, PayrollRun, PayrollSlip, PayrollSlipItem,
    PayrollRunStatus, EmployeeProfile, LeaveRequest, LeaveStatus
)
from app.models.staff_attendance import StaffAttendance, StaffAttendanceSettings
from app.models.financial import Holiday
from app.models.finance import Expense
from app.services.hrms_service import log_hrms_audit


def get_month_calendar_info(school_id, month, year):
    """
    Computes total days, weekly offs, and holidays in a given month.
    """
    settings = StaffAttendanceSettings.get_or_create(school_id)
    allowed_working_days = set((settings.working_days or 'Mon,Tue,Wed,Thu,Fri,Sat').split(','))

    days_in_month = monthrange(year, month)[1]
    start_date = date(year, month, 1)
    end_date = date(year, month, days_in_month)

    # Holidays in this month
    holidays_in_month = Holiday.query.filter(
        Holiday.school_id == school_id,
        Holiday.date <= end_date,
        db.or_(Holiday.end_date == None, Holiday.end_date >= start_date)
    ).all()

    holiday_dates = set()
    for h in holidays_in_month:
        h_start = max(h.date, start_date)
        h_end = min(h.end_date or h.date, end_date)
        curr = h_start
        while curr <= h_end:
            if curr.month == month and curr.year == year:
                holiday_dates.add(curr)
            curr += timedelta(days=1)

    working_days_count = 0
    weekly_off_count = 0

    for d in range(1, days_in_month + 1):
        dt = date(year, month, d)
        day_abbr = dt.strftime('%a') # Mon, Tue, ...
        if day_abbr in allowed_working_days:
            if dt not in holiday_dates:
                working_days_count += 1
        else:
            weekly_off_count += 1

    return {
        'total_calendar_days': days_in_month,
        'working_days_count': working_days_count,
        'weekly_off_count': weekly_off_count,
        'holiday_count': len(holiday_dates),
        'holiday_dates': holiday_dates,
        'allowed_working_days': allowed_working_days,
        'start_date': start_date,
        'end_date': end_date,
    }


def calculate_employee_payroll(user, month, year, cal_info, policy='PAYABLE_DAYS'):
    """
    Calculates payroll for one employee for a given month.
    """
    school_id = user.school_id
    total_calendar_days = cal_info['total_calendar_days']
    working_days_count = cal_info['working_days_count']
    weekly_off_count = cal_info['weekly_off_count']
    holiday_count = cal_info['holiday_count']
    holiday_dates = cal_info['holiday_dates']
    allowed_working_days = cal_info['allowed_working_days']
    start_date = cal_info['start_date']
    end_date = cal_info['end_date']

    # 1. Fetch Active Salary Structure
    sal_struct = EmployeeSalaryStructure.query.filter(
        EmployeeSalaryStructure.user_id == user.id,
        EmployeeSalaryStructure.effective_from <= end_date,
        db.or_(
            EmployeeSalaryStructure.effective_to == None,
            EmployeeSalaryStructure.effective_to >= start_date
        ),
        EmployeeSalaryStructure.is_active == True,
    ).order_by(EmployeeSalaryStructure.effective_from.desc(), EmployeeSalaryStructure.id.desc()).first()

    # Fallback to User.salary if no structured salary exists
    if sal_struct:
        base_gross = sal_struct.gross_salary or (user.salary or 0.0)
        basic_pay = sal_struct.basic_salary or (base_gross * 0.5)
        hra = sal_struct.hra or (base_gross * 0.25)
        da = sal_struct.da or (base_gross * 0.15)
        ta = sal_struct.ta or 0.0
        special_allowance = sal_struct.special_allowance or 0.0
        other_allowances = sal_struct.other_allowances or 0.0
        pf_ded = sal_struct.pf_deduction or 0.0
        esi_ded = sal_struct.esi_deduction or 0.0
        prof_tax = sal_struct.prof_tax or 0.0
        tds = sal_struct.tds or 0.0
        other_ded = sal_struct.other_deductions or 0.0
    else:
        base_gross = user.salary or 0.0
        basic_pay = round(base_gross * 0.5, 2)
        hra = round(base_gross * 0.25, 2)
        da = round(base_gross * 0.15, 2)
        ta = 0.0
        special_allowance = round(base_gross * 0.1, 2)
        other_allowances = 0.0
        pf_ded = 0.0
        esi_ded = 0.0
        prof_tax = 0.0
        tds = 0.0
        other_ded = 0.0

    # 2. Check Employment Dates (Mid-month Joining / Exits)
    profile = EmployeeProfile.query.filter_by(user_id=user.id).first()
    emp_start = profile.joining_date if profile and profile.joining_date else start_date
    emp_end = profile.exit_date if profile and profile.exit_date else end_date

    effective_start = max(start_date, emp_start)
    effective_end = min(end_date, emp_end) if emp_end else end_date

    # 3. Consolidate Attendance Records for this employee in month
    att_rows = StaffAttendance.query.filter(
        StaffAttendance.user_id == user.id,
        StaffAttendance.attendance_date >= start_date,
        StaffAttendance.attendance_date <= end_date,
    ).all()
    att_by_date = {r.attendance_date: r for r in att_rows}

    # 4. Consolidate Approved Leaves for this employee in month
    approved_leaves = LeaveRequest.query.filter(
        LeaveRequest.user_id == user.id,
        LeaveRequest.status == LeaveStatus.APPROVED.value,
        LeaveRequest.from_date <= end_date,
        LeaveRequest.to_date >= start_date,
    ).all()

    paid_leave_dates = set()
    unpaid_leave_dates = set()
    half_day_leave_dates = set()

    for lreq in approved_leaves:
        l_start = max(lreq.from_date, start_date)
        l_end = min(lreq.to_date, end_date)
        is_paid = lreq.leave_type.is_paid if lreq.leave_type else True
        curr = l_start
        while curr <= l_end:
            if lreq.is_half_day:
                half_day_leave_dates.add((curr, is_paid))
            elif is_paid:
                paid_leave_dates.add(curr)
            else:
                unpaid_leave_dates.add(curr)
            curr += timedelta(days=1)

    # 5. Day-by-day Evaluation
    present_days = 0.0
    half_days = 0
    late_days = 0
    paid_leave_days = 0.0
    unpaid_leave_days = 0.0
    unexcused_absent_days = 0.0
    applicable_weekly_offs = 0
    applicable_holidays = 0

    for d in range(1, total_calendar_days + 1):
        dt = date(year, month, d)

        # Skip days before joining or after exit
        if dt < effective_start or dt > effective_end:
            unexcused_absent_days += 1.0
            continue

        day_abbr = dt.strftime('%a')
        is_weekly_off = (day_abbr not in allowed_working_days)
        is_holiday = (dt in holiday_dates)

        if is_weekly_off:
            applicable_weekly_offs += 1
            continue
        if is_holiday:
            applicable_holidays += 1
            continue

        # Check Leave
        if dt in paid_leave_dates:
            paid_leave_days += 1.0
            continue
        if dt in unpaid_leave_dates:
            unpaid_leave_days += 1.0
            continue

        # Check Attendance record
        att = att_by_date.get(dt)
        if att:
            if att.status == 'PRESENT':
                present_days += 1.0
            elif att.status == 'LATE':
                present_days += 1.0
                late_days += 1
            elif att.status == 'HALF_DAY':
                present_days += 0.5
                half_days += 1
            elif att.status == 'ON_LEAVE':
                paid_leave_days += 1.0
            elif att.status in ('ABSENT', 'MISSING_CHECKOUT', 'REJECTED'):
                unexcused_absent_days += 1.0
            else:
                present_days += 1.0
        else:
            # No attendance marked on a payable working day = Unexcused Absent
            unexcused_absent_days += 1.0

    # 6. Payable Days Calculation based on selected Policy
    total_unpaid_days = unpaid_leave_days + unexcused_absent_days + (0.5 * half_days)

    if policy == 'WORKING_DAYS':
        # Salary based on expected working days
        divisor_days = max(1, working_days_count)
        per_day_salary = round(base_gross / divisor_days, 2)
        payable_days = max(0.0, working_days_count - total_unpaid_days)
    elif policy == 'CALENDAR_DAYS':
        # Salary based on calendar days
        divisor_days = total_calendar_days
        per_day_salary = round(base_gross / divisor_days, 2)
        payable_days = max(0.0, total_calendar_days - total_unpaid_days)
    else:  # 'PAYABLE_DAYS' default
        divisor_days = total_calendar_days
        per_day_salary = round(base_gross / divisor_days, 2)
        payable_days = max(0.0, total_calendar_days - total_unpaid_days)

    # 7. Compute Deductions & Net Pay
    lop_deduction = round(per_day_salary * total_unpaid_days, 2)
    lop_deduction = min(base_gross, lop_deduction)

    calculated_gross = round(base_gross, 2)
    total_statutory_deductions = round(pf_ded + esi_ded + prof_tax + tds + other_ded, 2)
    total_deductions = round(lop_deduction + total_statutory_deductions, 2)
    net_salary = round(max(0.0, calculated_gross - total_deductions), 2)

    return {
        'user_id': user.id,
        'calendar_days': total_calendar_days,
        'working_days': working_days_count,
        'payable_days': payable_days,
        'present_days': present_days,
        'half_days': half_days,
        'late_days': late_days,
        'paid_leave_days': paid_leave_days,
        'unpaid_leave_days': unpaid_leave_days,
        'weekly_off_days': applicable_weekly_offs,
        'holiday_days': applicable_holidays,
        'absent_days': unexcused_absent_days,
        'base_gross_salary': base_gross,
        'per_day_salary': per_day_salary,
        'basic_pay': basic_pay,
        'hra': hra,
        'da': da,
        'ta': ta,
        'special_allowance': special_allowance,
        'other_allowances': other_allowances,
        'gross_salary': calculated_gross,
        'lop_deduction': lop_deduction,
        'pf_deduction': pf_ded,
        'esi_deduction': esi_ded,
        'prof_tax': prof_tax,
        'tds': tds,
        'other_deductions': other_ded,
        'total_deductions': total_deductions,
        'net_salary': net_salary,
    }


def generate_payroll_run(school_id, month, year, calculation_policy='PAYABLE_DAYS', actor_user=None):
    """
    Generates or recalculates a draft monthly payroll run for all active school employees.
    """
    # Check if a locked payroll run already exists
    existing_run = PayrollRun.query.filter_by(school_id=school_id, month=month, year=year).first()
    if existing_run and existing_run.status == PayrollRunStatus.LOCKED.value:
        raise ValueError('Payroll for this month is already LOCKED and cannot be recalculated.')

    month_name = f"{calendar.month_name[month]} {year}"
    cal_info = get_month_calendar_info(school_id, month, year)

    # Fetch all active employees (excluding Students/Parents)
    employees = User.query.filter(
        User.school_id == school_id,
        User.role != UserRole.STUDENT,
        User.role != UserRole.PARENT,
        User.is_active == True,
    ).order_by(User.name).all()

    if not existing_run:
        payroll_run = PayrollRun(
            school_id=school_id,
            month=month,
            year=year,
            month_name=month_name,
            calculation_policy=calculation_policy,
            status=PayrollRunStatus.DRAFT.value,
            generated_by=actor_user.id if actor_user else None,
            generated_at=datetime.utcnow(),
        )
        db.session.add(payroll_run)
        db.session.flush()
    else:
        payroll_run = existing_run
        payroll_run.calculation_policy = calculation_policy
        payroll_run.generated_at = datetime.utcnow()
        # Delete existing slips to regenerate
        PayrollSlip.query.filter_by(payroll_run_id=payroll_run.id).delete()
        db.session.flush()

    total_gross = 0.0
    total_ded = 0.0
    total_net = 0.0

    for emp in employees:
        calc = calculate_employee_payroll(emp, month, year, cal_info, policy=calculation_policy)

        slip = PayrollSlip(
            payroll_run_id=payroll_run.id,
            school_id=school_id,
            user_id=emp.id,
            calendar_days=calc['calendar_days'],
            working_days=calc['working_days'],
            payable_days=calc['payable_days'],
            present_days=calc['present_days'],
            half_days=calc['half_days'],
            late_days=calc['late_days'],
            paid_leave_days=calc['paid_leave_days'],
            unpaid_leave_days=calc['unpaid_leave_days'],
            weekly_off_days=calc['weekly_off_days'],
            holiday_days=calc['holiday_days'],
            absent_days=calc['absent_days'],
            base_gross_salary=calc['base_gross_salary'],
            per_day_salary=calc['per_day_salary'],
            basic_pay=calc['basic_pay'],
            hra=calc['hra'],
            da=calc['da'],
            ta=calc['ta'],
            special_allowance=calc['special_allowance'],
            other_allowances=calc['other_allowances'],
            gross_salary=calc['gross_salary'],
            lop_deduction=calc['lop_deduction'],
            pf_deduction=calc['pf_deduction'],
            esi_deduction=calc['esi_deduction'],
            prof_tax=calc['prof_tax'],
            tds=calc['tds'],
            other_deductions=calc['other_deductions'],
            total_deductions=calc['total_deductions'],
            net_salary=calc['net_salary'],
            payment_status='PENDING',
        )
        db.session.add(slip)
        total_gross += calc['gross_salary']
        total_ded += calc['total_deductions']
        total_net += calc['net_salary']

    payroll_run.total_employees = len(employees)
    payroll_run.total_gross = round(total_gross, 2)
    payroll_run.total_deductions = round(total_ded, 2)
    payroll_run.total_net = round(total_net, 2)

    log_hrms_audit(
        school_id=school_id,
        action='PAYROLL_GENERATED',
        actor_id=actor_user.id if actor_user else None,
        new_value=f'Payroll Draft for {month_name}: {len(employees)} employees, Net: ₹{payroll_run.total_net:,.2f}',
    )
    db.session.commit()
    return payroll_run


def approve_payroll_run(payroll_run_id, approver):
    """Approves a draft payroll batch."""
    pr = PayrollRun.query.get_or_404(payroll_run_id)
    if pr.school_id != approver.school_id:
        raise ValueError('Unauthorized.')

    if pr.status == PayrollRunStatus.LOCKED.value:
        raise ValueError('Payroll is already locked.')

    pr.status = PayrollRunStatus.APPROVED.value
    pr.approved_by = approver.id
    pr.approved_at = datetime.utcnow()

    log_hrms_audit(
        school_id=pr.school_id,
        action='PAYROLL_APPROVED',
        actor_id=approver.id,
        new_value=f'Approved Payroll for {pr.month_name}',
    )
    db.session.commit()
    return pr


def pay_payroll_slip(slip_id, payment_mode='BANK_TRANSFER', transaction_ref='', paid_by_user=None, remarks=None):
    """
    Pays an individual employee payroll slip, generating a canonical
    Central Finance Expense record and updating HRMS and Finance state simultaneously.
    """
    slip = PayrollSlip.query.get_or_404(slip_id)
    if paid_by_user and slip.school_id != paid_by_user.school_id:
        raise ValueError('Unauthorized.')

    if slip.payment_status == 'PAID':
        raise ValueError(f"Salary for {slip.user.name} ({slip.payroll_run.month_name}) has already been paid (Ref: {slip.remarks}).")

    # Determine Department & Category
    role_str = (slip.user.role.value if hasattr(slip.user.role, 'value') else str(slip.user.role or '')).upper()
    dept_str = str(getattr(slip.user, 'department', '') or '').upper()

    if 'TEACH' in role_str or 'TEACH' in dept_str:
        category = 'TEACHER_SALARY'
    elif 'TRANSPORT' in role_str or 'TRANSPORT' in dept_str or 'DRIV' in dept_str:
        category = 'TRANSPORT_STAFF_SALARY'
    elif 'HOSTEL' in role_str or 'HOSTEL' in dept_str or 'WARDEN' in dept_str:
        category = 'HOSTEL_STAFF_SALARY'
    elif 'LIBRAR' in role_str or 'LIBRAR' in dept_str:
        category = 'LIBRARY_STAFF_SALARY'
    else:
        category = 'STAFF_SALARY'

    # Unique Voucher / Transaction Reference
    inv_no = transaction_ref if transaction_ref else f"SAL-{slip.payroll_run.year}-{slip.id:06d}"

    # Check if canonical Expense already exists for this slip
    exp = Expense.query.filter_by(
        school_id=slip.school_id,
        source='HRMS_PAYROLL',
        source_ref_id=slip.id
    ).first()

    if not exp:
        exp = Expense(
            school_id=slip.school_id,
            category=category,
            title=f"Salary Payment — {slip.user.name} ({slip.payroll_run.month_name})",
            vendor_name=slip.user.name,
            amount=round(float(slip.net_salary), 2),
            payment_method=payment_mode or 'BANK_TRANSFER',
            payment_date=date.today(),
            month=slip.payroll_run.month_name,
            status='PAID',
            source='HRMS_PAYROLL',
            source_ref_id=slip.id,
            invoice_number=inv_no,
            remarks=remarks or f"Net: ₹{slip.net_salary:,.2f}, Gross: ₹{slip.gross_salary:,.2f}, Deductions: ₹{slip.total_deductions:,.2f} | Paid by {paid_by_user.name if paid_by_user else 'Accounts'}",
            created_by=paid_by_user.id if paid_by_user else None,
        )
        db.session.add(exp)
    else:
        exp.amount = round(float(slip.net_salary), 2)
        exp.payment_method = payment_mode or 'BANK_TRANSFER'
        exp.payment_date = date.today()
        exp.invoice_number = inv_no
        exp.status = 'PAID'

    # Update PayrollSlip
    slip.payment_status = 'PAID'
    slip.payment_mode = payment_mode or 'BANK_TRANSFER'
    slip.payment_date = date.today()
    slip.remarks = f"Paid by {paid_by_user.name if paid_by_user else 'Accounts'} | Ref: {inv_no}"

    # Financial Audit Log
    try:
        from app.models.fee_finance import FinancialAuditLog
        audit = FinancialAuditLog(
            school_id=slip.school_id,
            user_id=paid_by_user.id if paid_by_user else None,
            action='SALARY_PAID',
            old_value='PENDING',
            new_value=f"Paid ₹{slip.net_salary:,.2f} to {slip.user.name} via {payment_mode} (Ref: {inv_no})",
            reason=remarks or 'Payroll salary disbursement'
        )
        db.session.add(audit)
    except Exception:
        pass

    log_hrms_audit(
        school_id=slip.school_id,
        action='SALARY_PAID',
        target_user_id=slip.user_id,
        actor_id=paid_by_user.id if paid_by_user else None,
        new_value=f"Paid Net ₹{slip.net_salary:,.2f} for {slip.payroll_run.month_name} (Ref: {inv_no})",
    )

    db.session.commit()
    return slip, exp


def pay_payroll_run_all(payroll_run_id, payment_mode='BANK_TRANSFER', paid_by_user=None, remarks=None):
    """
    Disburses all unpaid slips in a payroll run at once, creating itemized canonical Expenses.
    """
    pr = PayrollRun.query.get_or_404(payroll_run_id)
    if paid_by_user and pr.school_id != paid_by_user.school_id:
        raise ValueError('Unauthorized.')

    paid_count = 0
    for slip in pr.slips:
        if slip.payment_status != 'PAID':
            pay_payroll_slip(
                slip.id,
                payment_mode=payment_mode,
                transaction_ref=f"SAL-{pr.year}-{slip.id:06d}",
                paid_by_user=paid_by_user,
                remarks=remarks or f"Batch payment for {pr.month_name} ({payment_mode})"
            )
            paid_count += 1

    pr.status = PayrollRunStatus.LOCKED.value
    pr.locked_by = paid_by_user.id if paid_by_user else None
    pr.locked_at = datetime.utcnow()
    db.session.commit()
    return pr, paid_count


def lock_payroll_run(payroll_run_id, locker):
    """
    Locks payroll run and disburses all unpaid slips creating itemized canonical expenses.
    """
    pr, paid_count = pay_payroll_run_all(
        payroll_run_id,
        payment_mode='BANK_TRANSFER',
        paid_by_user=locker,
        remarks=f'Locked and disbursed batch for {locker.name}'
    )
    return pr
