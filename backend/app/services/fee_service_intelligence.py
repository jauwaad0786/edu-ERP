"""
Fee Service Intelligence
Aggregates service-wise generation status and student collection matrix.
Provides dynamic data for Principal Dashboard and Central Finance suites.
"""

from datetime import date, datetime
import calendar
from sqlalchemy import func, or_, and_
from app import db
from app.models.fee_finance import (
    FeeHead, FeeStructureV2, FeeStructureItemV2,
    FeeBill, FeeBillItem, FeePayment, FeePaymentAllocation,
    BillStatus, PaymentStatus
)
from app.models.financial import FeeRecord, FeeGenerationBatch
from app.models.academic import Student, Class
from app.services.fee_ledger_service import ensure_default_fee_heads


def _parse_month(month_str=None):
    """Parses 'YYYY-MM' or returns current year-month."""
    today = date.today()
    if not month_str:
        return today.strftime('%Y-%m'), today.strftime('%B %Y'), today.year, today.month
    try:
        yr, mo = map(int, month_str.split('-'))
        dt = date(yr, mo, 1)
        return dt.strftime('%Y-%m'), dt.strftime('%B %Y'), yr, mo
    except Exception:
        return today.strftime('%Y-%m'), today.strftime('%B %Y'), today.year, today.month


def get_services_generation_status(school_id, month=None, session='2026-27', class_id=None, category=None):
    """
    Returns dynamic status of each service in the school for a given month:
    - Generated vs Not Generated vs Partially Generated
    - Total eligible students vs generated students count
    - Billed, Collected, and Pending totals per service
    - Batch and generation timestamps
    """
    ensure_default_fee_heads(school_id)
    month_code, month_label, yr, mo = _parse_month(month)

    # 1. Fetch all active fee heads / services for the school
    head_query = FeeHead.query.filter_by(school_id=school_id, is_active=True)
    if category and category.upper() != 'ALL':
        head_query = head_query.filter_by(category=category.upper())
    fee_heads = head_query.order_by(FeeHead.id.asc()).all()

    # 2. Count active eligible students in the school / class
    stu_q = Student.query.filter_by(school_id=school_id, status='ACTIVE', is_deleted=False)
    if class_id:
        stu_q = stu_q.filter_by(class_id=int(class_id))
    total_active_students = stu_q.count()

    # Transport active allocations
    transport_count = 0
    try:
        from app.models.transport_student import StudentTransport
        t_q = StudentTransport.query.filter_by(status='ACTIVE')
        if class_id:
            t_q = t_q.join(Student, StudentTransport.student_id == Student.id).filter(Student.school_id == school_id, Student.class_id == int(class_id), Student.status == 'ACTIVE')
        else:
            t_q = t_q.join(Student, StudentTransport.student_id == Student.id).filter(Student.school_id == school_id, Student.status == 'ACTIVE')
        transport_count = t_q.count()
    except Exception:
        transport_count = 0

    # Hostel active allocations
    hostel_count = 0
    try:
        from app.models.hostel import HostelBedAllocation
        h_q = HostelBedAllocation.query.filter_by(school_id=school_id, status='ACTIVE')
        if class_id:
            h_q = h_q.join(Student, HostelBedAllocation.student_id == Student.id).filter(Student.class_id == int(class_id), Student.status == 'ACTIVE')
        else:
            h_q = h_q.join(Student, HostelBedAllocation.student_id == Student.id).filter(Student.status == 'ACTIVE')
        hostel_count = h_q.count()
    except Exception:
        hostel_count = 0

    # 3. Aggregate FeeBillItems for this month & school
    bill_items_q = db.session.query(
        FeeBillItem.fee_head_id,
        func.count(func.distinct(FeeBill.student_id)).label('student_count'),
        func.coalesce(func.sum(FeeBillItem.net_amount), 0.0).label('billed_amt'),
        func.coalesce(func.sum(FeeBillItem.paid_amount), 0.0).label('paid_amt'),
        func.coalesce(func.sum(FeeBillItem.balance_amount), 0.0).label('bal_amt'),
        func.max(FeeBill.created_at).label('last_generated')
    ).select_from(FeeBillItem).join(
        FeeBill, FeeBillItem.bill_id == FeeBill.id
    ).filter(
        FeeBill.school_id == school_id,
        FeeBill.bill_month == month_code,
        FeeBill.status != BillStatus.CANCELLED.value
    )

    if class_id:
        bill_items_q = bill_items_q.join(Student, FeeBill.student_id == Student.id).filter(Student.class_id == int(class_id))

    bill_items_data = {
        row.fee_head_id: {
            'student_count': int(row.student_count or 0),
            'billed': round(float(row.billed_amt or 0.0), 2),
            'paid': round(float(row.paid_amt or 0.0), 2),
            'pending': round(float(row.bal_amt or 0.0), 2),
            'last_generated': row.last_generated.isoformat() if row.last_generated else None
        }
        for row in bill_items_q.group_by(FeeBillItem.fee_head_id).all()
    }

    # 4. Also check FeeRecords (support legacy/direct batches)
    fee_rec_q = db.session.query(
        FeeRecord.fee_type,
        FeeRecord.source,
        func.count(func.distinct(FeeRecord.student_id)).label('student_count'),
        func.coalesce(func.sum(FeeRecord.amount_due + func.coalesce(FeeRecord.fine, 0) - func.coalesce(FeeRecord.discount, 0)), 0.0).label('billed_amt'),
        func.coalesce(func.sum(FeeRecord.amount_paid), 0.0).label('paid_amt'),
        func.max(FeeRecord.created_at).label('last_generated')
    ).filter(
        FeeRecord.school_id == school_id,
        FeeRecord.status != 'DRAFT',
        FeeRecord.status != 'CANCELLED',
        or_(
            FeeRecord.month == month_code,
            FeeRecord.month == month_label
        )
    )
    if class_id:
        fee_rec_q = fee_rec_q.join(Student, FeeRecord.student_id == Student.id).filter(Student.class_id == int(class_id))

    fee_rec_rows = fee_rec_q.group_by(FeeRecord.fee_type, FeeRecord.source).all()
    rec_data_by_key = {}
    for r in fee_rec_rows:
        key = (r.fee_type or r.source or 'ACADEMIC').upper()
        b_amt = float(r.billed_amt or 0.0)
        p_amt = float(r.paid_amt or 0.0)
        rec_data_by_key[key] = {
            'student_count': int(r.student_count or 0),
            'billed': round(b_amt, 2),
            'paid': round(p_amt, 2),
            'pending': round(max(0.0, b_amt - p_amt), 2),
            'last_generated': r.last_generated.isoformat() if r.last_generated else None
        }

    # 5. Fetch batches for this month
    batch_q = FeeGenerationBatch.query.filter_by(school_id=school_id, month=month_code)
    if class_id:
        batch_q = batch_q.filter(or_(FeeGenerationBatch.class_id == int(class_id), FeeGenerationBatch.class_id.is_(None)))
    batches = {b.fee_type.upper(): b.to_dict() for b in batch_q.all()}

    services_result = []
    generated_services_count = 0
    not_generated_services_count = 0
    total_billed_all = 0.0
    total_collected_all = 0.0

    for fh in fee_heads:
        # Determine target eligible students for this service
        cat = (fh.category or 'ACADEMIC').upper()
        if cat == 'TRANSPORT':
            eligible = transport_count
        elif cat == 'HOSTEL':
            eligible = hostel_count
        else:
            eligible = total_active_students

        # Merge bill item data or fee record data
        b_data = bill_items_data.get(fh.id)
        if not b_data:
            # Check by code or category
            b_data = rec_data_by_key.get(fh.code.upper()) or rec_data_by_key.get(cat)

        student_count = b_data['student_count'] if b_data else 0
        billed = b_data['billed'] if b_data else 0.0
        paid = b_data['paid'] if b_data else 0.0
        pending = b_data['pending'] if b_data else 0.0
        last_gen = b_data['last_generated'] if b_data else None

        batch_info = batches.get(fh.code.upper()) or batches.get(cat)

        # Determine generation status
        if student_count == 0 or (billed == 0 and paid == 0):
            status = 'NOT_GENERATED'
            not_generated_services_count += 1
        elif eligible > 0 and student_count >= eligible:
            status = 'GENERATED'
            generated_services_count += 1
        elif eligible > 0 and student_count < eligible:
            status = 'PARTIALLY_GENERATED'
            generated_services_count += 1
        else:
            status = 'GENERATED'
            generated_services_count += 1

        total_billed_all += billed
        total_collected_all += paid

        services_result.append({
            'head_id':                  fh.id,
            'name':                     fh.name,
            'code':                     fh.code,
            'category':                 fh.category or 'ACADEMIC',
            'department':               fh.department or 'ACCOUNTS',
            'frequency':                fh.default_frequency or 'MONTHLY',
            'is_recurring':             bool(fh.is_recurring),
            'status':                   status,
            'is_generated':             status in ('GENERATED', 'PARTIALLY_GENERATED'),
            'eligible_students_count':  eligible,
            'generated_students_count': student_count,
            'missing_students_count':   max(0, eligible - student_count),
            'total_billed':             round(billed, 2),
            'total_collected':          round(paid, 2),
            'total_pending':            round(pending, 2),
            'collection_percentage':    round((paid / billed * 100), 1) if billed > 0 else 0.0,
            'last_generated_at':        last_gen,
            'batch':                    batch_info,
            'can_generate':             status != 'GENERATED' and eligible > 0,
        })

    # Summary object
    total_services = len(services_result)
    total_pending_all = max(0.0, round(total_billed_all - total_collected_all, 2))
    overall_recovery_pct = round((total_collected_all / total_billed_all * 100), 1) if total_billed_all > 0 else 0.0

    return {
        'month':                    month_code,
        'month_label':              month_label,
        'session':                  session,
        'summary': {
            'total_services':           total_services,
            'generated_services_count': generated_services_count,
            'not_generated_count':      not_generated_services_count,
            'total_billed':             round(total_billed_all, 2),
            'total_collected':          round(total_collected_all, 2),
            'total_pending':            total_pending_all,
            'collection_percentage':    overall_recovery_pct,
            'active_students_count':    total_active_students,
            'transport_students_count': transport_count,
            'hostel_students_count':    hostel_count,
        },
        'services': services_result,
    }


def get_services_collection_matrix(
    school_id, month=None, session='2026-27', class_id=None,
    status=None, service_code=None, search=None
):
    """
    Returns student collection matrix with per-service status,
    plus aggregated charts data (status ratios, service realization, class performance).
    """
    ensure_default_fee_heads(school_id)
    month_code, month_label, yr, mo = _parse_month(month)

    # 1. Fetch active fee heads
    fee_heads = FeeHead.query.filter_by(school_id=school_id, is_active=True).order_by(FeeHead.id.asc()).all()
    fh_map = {fh.id: fh for fh in fee_heads}
    fh_by_code = {fh.code: fh for fh in fee_heads}

    # 2. Base student query
    stu_q = Student.query.filter_by(school_id=school_id, status='ACTIVE', is_deleted=False)
    if class_id:
        stu_q = stu_q.filter_by(class_id=int(class_id))
    if search:
        s = f"%{search.strip()}%"
        stu_q = stu_q.join(Student.user).filter(
            or_(
                Student.admission_no.ilike(s),
                Student.roll_number.ilike(s),
                db.func.lower(db.text("users.name")).ilike(s.lower())
            )
        )
    students = stu_q.order_by(Student.class_id.asc(), Student.id.asc()).all()
    if not students:
        return {
            'month': month_code, 'month_label': month_label, 'session': session,
            'summary': {'total_students_billed': 0, 'fully_paid_count': 0, 'partial_count': 0, 'pending_count': 0, 'total_due': 0, 'total_collected': 0, 'total_pending': 0, 'recovery_rate': 0},
            'service_breakdown': [], 'class_breakdown': [], 'students': []
        }

    st_ids = [s.id for s in students]

    # 3. Fetch FeeBills for these students this month
    bills = FeeBill.query.filter(
        FeeBill.school_id == school_id,
        FeeBill.student_id.in_(st_ids),
        FeeBill.bill_month == month_code,
        FeeBill.status != BillStatus.CANCELLED.value
    ).all()

    bill_map = {b.student_id: b for b in bills}

    # 4. Fetch FeeRecords (support legacy records if bills not present)
    records = FeeRecord.query.filter(
        FeeRecord.school_id == school_id,
        FeeRecord.student_id.in_(st_ids),
        or_(FeeRecord.month == month_code, FeeRecord.month == month_label),
        FeeRecord.status.notin_(['DRAFT', 'CANCELLED'])
    ).all()

    rec_by_student = {}
    for r in records:
        rec_by_student.setdefault(r.student_id, []).append(r)

    # 5. Build student collection records
    student_records = []
    fully_paid_count = 0
    partial_count = 0
    pending_count = 0
    total_due_all = 0.0
    total_paid_all = 0.0

    service_totals = {
        fh.code: {
            'code': fh.code,
            'name': fh.name,
            'category': fh.category,
            'billed': 0.0,
            'collected': 0.0,
            'pending': 0.0,
            'paid_students': 0,
            'pending_students': 0
        }
        for fh in fee_heads
    }

    class_totals = {}

    for s in students:
        c_name = f"{s.class_ref.name} {s.class_ref.section or ''}".strip() if s.class_ref else 'Unknown Class'
        if c_name not in class_totals:
            class_totals[c_name] = {'class_name': c_name, 'billed': 0.0, 'collected': 0.0, 'pending': 0.0, 'students_count': 0}
        class_totals[c_name]['students_count'] += 1

        b = bill_map.get(s.id)
        s_recs = rec_by_student.get(s.id, [])

        student_services = {}
        s_total_due = 0.0
        s_total_paid = 0.0
        s_balance = 0.0

        if b and b.items:
            s_total_due = float(b.total_payable or 0.0)
            s_total_paid = float(b.amount_paid or 0.0)
            s_balance = float(b.balance_due or 0.0)

            for it in b.items:
                head = fh_map.get(it.fee_head_id)
                h_code = head.code if head else (it.department or 'TUITION')
                net = float(it.net_amount or 0.0)
                paid = float(it.paid_amount or 0.0)
                bal = float(it.balance_amount or 0.0)

                st_code = 'PAID' if bal <= 0 and net > 0 else ('PARTIAL' if paid > 0 else 'PENDING')
                student_services[h_code] = {
                    'name': head.name if head else h_code,
                    'code': h_code,
                    'billed': round(net, 2),
                    'paid': round(paid, 2),
                    'balance': round(bal, 2),
                    'status': st_code,
                }

                if h_code in service_totals:
                    service_totals[h_code]['billed'] += net
                    service_totals[h_code]['collected'] += paid
                    service_totals[h_code]['pending'] += bal
                    if bal <= 0 and net > 0:
                        service_totals[h_code]['paid_students'] += 1
                    elif bal > 0:
                        service_totals[h_code]['pending_students'] += 1

        elif s_recs:
            for r in s_recs:
                h_code = (r.fee_type or r.source or 'TUITION').upper()
                due = float(r.effective_due() if hasattr(r, 'effective_due') else (r.amount_due or 0.0))
                paid = float(r.amount_paid or 0.0)
                bal = max(0.0, due - paid)

                s_total_due += due
                s_total_paid += paid
                s_balance += bal

                st_code = 'PAID' if bal <= 0 and due > 0 else ('PARTIAL' if paid > 0 else 'PENDING')
                student_services[h_code] = {
                    'name': h_code.replace('_', ' ').title(),
                    'code': h_code,
                    'billed': round(due, 2),
                    'paid': round(paid, 2),
                    'balance': round(bal, 2),
                    'status': st_code,
                }

                if h_code in service_totals:
                    service_totals[h_code]['billed'] += due
                    service_totals[h_code]['collected'] += paid
                    service_totals[h_code]['pending'] += bal
                    if bal <= 0 and due > 0:
                        service_totals[h_code]['paid_students'] += 1
                    elif bal > 0:
                        service_totals[h_code]['pending_students'] += 1

        # Evaluate student status
        if s_total_due == 0.0:
            st_overall = 'NOT_BILLED'
        elif s_balance <= 0.0:
            st_overall = 'PAID'
            fully_paid_count += 1
        elif s_total_paid > 0.0:
            st_overall = 'PARTIALLY_PAID'
            partial_count += 1
        else:
            st_overall = 'PENDING'
            pending_count += 1

        total_due_all += s_total_due
        total_paid_all += s_total_paid
        class_totals[c_name]['billed'] += s_total_due
        class_totals[c_name]['collected'] += s_total_paid
        class_totals[c_name]['pending'] += s_balance

        # Apply status filter if requested
        if status and status.upper() != 'ALL':
            if status.upper() == 'PAID' and st_overall != 'PAID':
                continue
            if status.upper() in ('PARTIAL', 'PARTIALLY_PAID') and st_overall != 'PARTIALLY_PAID':
                continue
            if status.upper() in ('PENDING', 'UNPAID') and st_overall not in ('PENDING', 'PARTIALLY_PAID'):
                continue

        # Apply service filter if requested (e.g. show students whose TRANSPORT is unpaid)
        if service_code and service_code.upper() != 'ALL':
            svc = student_services.get(service_code.upper())
            if not svc or svc.get('status') == 'PAID':
                continue

        student_records.append({
            'student_id':   s.id,
            'name':         s.user.name if (getattr(s, 'user', None) and s.user) else f"Student #{s.id}",
            'admission_no': s.admission_no or '',
            'roll_no':      s.roll_number or '',
            'class_id':     s.class_id,
            'class_name':   c_name,
            'phone':        (getattr(s, 'parent_phone', None) or getattr(s, 'phone', None) or (s.user.phone if (getattr(s, 'user', None) and s.user) else '') or ''),
            'total_due':    round(s_total_due, 2),
            'amount_paid':  round(s_total_paid, 2),
            'balance_due':  round(s_balance, 2),
            'status':       st_overall,
            'services':     student_services,
            'bill_no':      b.bill_no if b else None,
            'bill_id':      b.id if b else None,
        })

    # Prepare service breakdown array for graph
    service_breakdown = []
    for s_code, val in service_totals.items():
        if val['billed'] > 0 or val['collected'] > 0:
            b = round(val['billed'], 2)
            c = round(val['collected'], 2)
            service_breakdown.append({
                'code':             s_code,
                'name':             val['name'],
                'category':         val['category'],
                'billed':           b,
                'collected':        c,
                'pending':          round(max(0.0, b - c), 2),
                'collection_pct':   round((c / b * 100), 1) if b > 0 else 0.0,
                'paid_students':    val['paid_students'],
                'pending_students': val['pending_students'],
            })

    # Prepare class breakdown array for graph
    class_breakdown = []
    for c_name, val in class_totals.items():
        b = round(val['billed'], 2)
        c = round(val['collected'], 2)
        pct = round((c / b * 100), 1) if b > 0 else 0.0
        class_breakdown.append({
            'class_name':     c_name,
            'billed':         b,
            'collected':      c,
            'pending':        round(max(0.0, b - c), 2),
            'collection_pct': pct,
            'students_count': val['students_count'],
        })

    total_pending_all = max(0.0, round(total_due_all - total_paid_all, 2))
    overall_recovery_pct = round((total_paid_all / total_due_all * 100), 1) if total_due_all > 0 else 0.0

    return {
        'month':       month_code,
        'month_label': month_label,
        'session':     session,
        'summary': {
            'total_students_billed': len(students),
            'fully_paid_count':      fully_paid_count,
            'partial_count':         partial_count,
            'pending_count':         pending_count,
            'total_due':             round(total_due_all, 2),
            'total_collected':       round(total_paid_all, 2),
            'total_pending':         total_pending_all,
            'recovery_rate':         overall_recovery_pct,
        },
        'service_breakdown': service_breakdown,
        'class_breakdown':   class_breakdown,
        'students':          student_records,
    }
