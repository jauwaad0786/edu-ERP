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
    FeeBill, FeeBillItem, StudentLedger, FeePayment, FeePaymentAllocation,
    BillStatus, PaymentStatus
)
from app.models.financial import FeeRecord, FeeGenerationBatch
from app.models.academic import Student, Class
from app.models.user import User
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


def _normalize_service_code(val):
    """Maps varied service labels and types to canonical service codes."""
    v = (val or '').strip().upper()
    if any(k in v for k in ('OPENING', 'PREVIOUS', 'MIGRAT', 'PRIOR', 'BACKLOG', 'LEGACY')):
        return 'OPENING_BALANCE'
    if any(k in v for k in ('TUITION', 'ACADEMIC', 'CLASS', 'SCHOOL')):
        return 'TUITION'
    if any(k in v for k in ('TRANSPORT', 'BUS', 'VAN', 'CAB', 'ROUTE')):
        return 'TRANSPORT'
    if any(k in v for k in ('HOSTEL', 'MESS', 'ROOM', 'BED', 'DORM')):
        return 'HOSTEL'
    if any(k in v for k in ('LIB', 'BOOK')):
        return 'LIBRARY'
    if any(k in v for k in ('EXAM', 'TEST', 'ASSESS')):
        return 'EXAM'
    if any(k in v for k in ('ADMISSION', 'REGIST', 'ENROLL')):
        return 'ADMISSION'
    if any(k in v for k in ('SPORT', 'ACTIVIT')):
        return 'ACTIVITY'
    if any(k in v for k in ('LAB', 'COMPUTER', 'SCIENCE')):
        return 'LAB'
    return v or 'ACADEMIC'


def get_academic_class_breakdown(school_id, month_code, session='2026-27'):
    """
    Returns live class-wise fee generation and pending status.
    Accounts for class-specific tuition fees.
    """
    classes = Class.query.filter_by(school_id=school_id).order_by(Class.name.asc(), Class.section.asc()).all()
    breakdown = []
    total_classes = len(classes)
    generated_classes = 0
    pending_classes = 0

    for cls in classes:
        # 1. Total active students in this class
        students = Student.query.filter_by(school_id=school_id, class_id=cls.id, status='ACTIVE', is_deleted=False).all()
        stu_count = len(students)
        stu_ids = [s.id for s in students]

        # 2. Fee records for students in this class for this month
        fee_records = []
        if stu_ids:
            fee_records = FeeRecord.query.filter(
                FeeRecord.school_id == school_id,
                FeeRecord.student_id.in_(stu_ids),
                FeeRecord.status != 'DRAFT',
                FeeRecord.status != 'CANCELLED',
                or_(
                    FeeRecord.source.in_(['ACADEMIC', 'TUITION']),
                    FeeRecord.fee_type.ilike('%Tuition%')
                ),
                or_(
                    FeeRecord.month == month_code,
                    FeeRecord.month.like(f"%{month_code}%")
                )
            ).all()

        gen_stu_ids = {r.student_id for r in fee_records}
        gen_count = len(gen_stu_ids)
        pending_count = max(0, stu_count - gen_count)

        billed = sum(float(r.amount_due + (r.fine or 0.0) - (r.discount or 0.0)) for r in fee_records)
        paid = sum(float(r.amount_paid or 0.0) for r in fee_records)
        pending_amt = max(0.0, billed - paid)

        # Rate determination: from FeeStructure or average billed
        rate = 0.0
        try:
            from app.models.financial import FeeStructure
            fs = FeeStructure.query.filter_by(school_id=school_id, class_id=cls.id, fee_type='Tuition Fee').first()
            if fs and fs.amount:
                rate = float(fs.amount)
            elif billed > 0 and gen_count > 0:
                rate = round(billed / gen_count, 2)
        except Exception:
            rate = 0.0

        if stu_count == 0:
            st = 'EMPTY'
        elif gen_count == 0:
            st = 'NOT_GENERATED'
            pending_classes += 1
        elif gen_count >= stu_count:
            st = 'GENERATED'
            generated_classes += 1
        else:
            st = 'PARTIALLY_GENERATED'
            pending_classes += 1

        breakdown.append({
            'item_id': cls.id,
            'class_id': cls.id,
            'name': f"{cls.name} {f'({cls.section})' if cls.section else ''}".strip(),
            'class_name': cls.name,
            'section': cls.section or '',
            'total_students': stu_count,
            'generated_students': gen_count,
            'pending_students': pending_count,
            'rate': rate,
            'billed': round(billed, 2),
            'paid': round(paid, 2),
            'pending': round(pending_amt, 2),
            'status': st,
            'can_generate': st in ('NOT_GENERATED', 'PARTIALLY_GENERATED') and stu_count > 0
        })

    return {
        'type': 'CLASS_WISE',
        'unit_label': 'Classes',
        'title': 'Class-Wise Academic & Tuition Status',
        'description': 'Each class can have distinct fee structures and tuition rates.',
        'summary': {
            'total_units': total_classes,
            'generated_units': generated_classes,
            'pending_units': pending_classes,
        },
        'items': breakdown
    }


def get_transport_route_breakdown(school_id, month_code, session='2026-27'):
    """
    Returns live route-wise fee generation and pending status.
    Accounts for route-specific pricing slabs.
    """
    from app.models.transport import Route
    from app.models.transport_student import StudentTransport, TransportFeeStructure

    routes = Route.query.filter_by(school_id=school_id).order_by(Route.name.asc()).all()
    breakdown = []
    total_routes = len(routes)
    generated_routes = 0
    pending_routes = 0

    for r in routes:
        # Active students allocated to this route
        assignments = StudentTransport.query.filter_by(school_id=school_id, route_id=r.id, status='ACTIVE').all()
        stu_ids = [a.student_id for a in assignments]
        stu_count = len(stu_ids)

        # Route rate from TransportFeeStructure
        tfs = TransportFeeStructure.query.filter_by(school_id=school_id, route_id=r.id, status='ACTIVE').first()
        if not tfs:
            tfs = TransportFeeStructure.query.filter_by(school_id=school_id, route_id=None, status='ACTIVE').first()
        rate = float(tfs.amount or 0.0) if tfs else 0.0

        fee_records = []
        if stu_ids:
            fee_records = FeeRecord.query.filter(
                FeeRecord.school_id == school_id,
                FeeRecord.student_id.in_(stu_ids),
                FeeRecord.status != 'DRAFT',
                FeeRecord.status != 'CANCELLED',
                or_(
                    FeeRecord.source == 'TRANSPORT',
                    FeeRecord.fee_type.ilike('%Transport%')
                ),
                or_(
                    FeeRecord.month == month_code,
                    FeeRecord.month.like(f"%{month_code}%")
                )
            ).all()

        gen_stu_ids = {rec.student_id for rec in fee_records}
        gen_count = len(gen_stu_ids)
        pending_count = max(0, stu_count - gen_count)

        billed = sum(float(rec.amount_due + (rec.fine or 0.0) - (rec.discount or 0.0)) for rec in fee_records)
        paid = sum(float(rec.amount_paid or 0.0) for rec in fee_records)
        pending_amt = max(0.0, billed - paid)

        if stu_count == 0:
            st = 'EMPTY'
        elif gen_count == 0:
            st = 'NOT_GENERATED'
            pending_routes += 1
        elif gen_count >= stu_count:
            st = 'GENERATED'
            generated_routes += 1
        else:
            st = 'PARTIALLY_GENERATED'
            pending_routes += 1

        breakdown.append({
            'item_id': r.id,
            'route_id': r.id,
            'name': r.name,
            'code': r.code or '',
            'vehicle_number': r.vehicle.vehicle_number if r.vehicle else 'Not Assigned',
            'total_students': stu_count,
            'generated_students': gen_count,
            'pending_students': pending_count,
            'rate': rate,
            'billed': round(billed, 2),
            'paid': round(paid, 2),
            'pending': round(pending_amt, 2),
            'status': st,
            'can_generate': st in ('NOT_GENERATED', 'PARTIALLY_GENERATED') and stu_count > 0
        })

    # Also account for any student who has a transport FeeRecord not linked to a specific route
    all_transport_recs = FeeRecord.query.filter(
        FeeRecord.school_id == school_id,
        FeeRecord.status != 'DRAFT',
        FeeRecord.status != 'CANCELLED',
        or_(
            FeeRecord.source == 'TRANSPORT',
            FeeRecord.fee_type.ilike('%Transport%')
        ),
        or_(
            FeeRecord.month == month_code,
            FeeRecord.month.like(f"%{month_code}%")
        )
    ).all()
    assigned_stu_ids = set()
    for r in routes:
        assigned_stu_ids.update([a.student_id for a in StudentTransport.query.filter_by(school_id=school_id, route_id=r.id, status='ACTIVE').all()])

    unlinked_stu_ids = {rec.student_id for rec in all_transport_recs if rec.student_id not in assigned_stu_ids}
    if unlinked_stu_ids:
        u_billed = sum(float(rec.amount_due + (rec.fine or 0.0) - (rec.discount or 0.0)) for rec in all_transport_recs if rec.student_id in unlinked_stu_ids)
        u_paid = sum(float(rec.amount_paid or 0.0) for rec in all_transport_recs if rec.student_id in unlinked_stu_ids)
        breakdown.append({
            'item_id': 0,
            'route_id': None,
            'name': 'Standard / Campus Transport Slabs',
            'code': 'STD',
            'vehicle_number': 'School Transport',
            'total_students': len(unlinked_stu_ids),
            'generated_students': len(unlinked_stu_ids),
            'pending_students': 0,
            'rate': round(u_billed / len(unlinked_stu_ids), 2) if unlinked_stu_ids else 0.0,
            'billed': round(u_billed, 2),
            'paid': round(u_paid, 2),
            'pending': round(max(0.0, u_billed - u_paid), 2),
            'status': 'GENERATED',
            'can_generate': False
        })
        total_routes += 1
        generated_routes += 1

    return {
        'type': 'ROUTE_WISE',
        'unit_label': 'Routes',
        'title': 'Route-Wise Transport Fee Generation Status',
        'description': 'Each transport route has distinct pricing slabs and vehicle allocations.',
        'summary': {
            'total_units': total_routes,
            'generated_units': generated_routes,
            'pending_units': pending_routes,
        },
        'items': breakdown
    }


def get_hostel_room_type_breakdown(school_id, month_code, session='2026-27'):
    """
    Returns live room type / AC vs Non-AC fee generation and pending status.
    Accounts for room-type and AC vs Non-AC rate differences.
    """
    from app.models.hostel import (
        HostelRoom, HostelBed, HostelBedAllocation, HostelFeeStructure
    )

    active_allocs = HostelBedAllocation.query.filter_by(school_id=school_id, status='ACTIVE').all()
    alloc_map = {}
    for alloc in active_allocs:
        bed = HostelBed.query.get(alloc.bed_id)
        room = bed.room if bed else None
        rtype = (room.room_type if room and room.room_type else 'STANDARD').upper()
        is_ac = bool(room.is_ac) if room else False
        key = f"{rtype}_{'AC' if is_ac else 'NON_AC'}"
        if key not in alloc_map:
            alloc_map[key] = {
                'room_type': rtype,
                'is_ac': is_ac,
                'student_ids': []
            }
        alloc_map[key]['student_ids'].append(alloc.student_id)

    # Also inspect configured fee structures
    fee_structures = HostelFeeStructure.query.filter_by(school_id=school_id, status='ACTIVE').all()
    for fs in fee_structures:
        key = f"{fs.sharing_type.upper()}_{'AC' if fs.is_ac else 'NON_AC'}"
        if key not in alloc_map:
            alloc_map[key] = {
                'room_type': fs.sharing_type.upper(),
                'is_ac': bool(fs.is_ac),
                'student_ids': []
            }

    # Also check if any student has Hostel FeeRecord directly without bed allocation
    all_hostel_recs = FeeRecord.query.filter(
        FeeRecord.school_id == school_id,
        FeeRecord.status != 'DRAFT',
        FeeRecord.status != 'CANCELLED',
        or_(
            FeeRecord.source == 'HOSTEL',
            FeeRecord.fee_type.ilike('%Hostel%')
        ),
        or_(
            FeeRecord.month == month_code,
            FeeRecord.month.like(f"%{month_code}%")
        )
    ).all()
    allocated_stu_ids = set()
    for info in alloc_map.values():
        allocated_stu_ids.update(info['student_ids'])
    unlinked_stu_ids = {r.student_id for r in all_hostel_recs if r.student_id not in allocated_stu_ids}
    if unlinked_stu_ids:
        alloc_map['STANDARD_HOSTEL'] = {
            'room_type': 'STANDARD',
            'is_ac': False,
            'student_ids': list(unlinked_stu_ids)
        }

    # If nothing configured, present defaults
    if not alloc_map:
        for rtype in ['SINGLE', 'DOUBLE', 'TRIPLE']:
            for is_ac in [True, False]:
                key = f"{rtype}_{'AC' if is_ac else 'NON_AC'}"
                alloc_map[key] = {'room_type': rtype, 'is_ac': is_ac, 'student_ids': []}

    breakdown = []
    total_categories = len(alloc_map)
    generated_categories = 0
    pending_categories = 0

    for key, info in sorted(alloc_map.items()):
        rtype = info['room_type']
        is_ac = info['is_ac']
        stu_ids = info['student_ids']
        stu_count = len(stu_ids)

        fs = HostelFeeStructure.query.filter_by(
            school_id=school_id, sharing_type=rtype, is_ac=is_ac, status='ACTIVE'
        ).first()
        rate = float(fs.monthly_fee or 0.0) if fs else 0.0

        fee_records = []
        if stu_ids:
            fee_records = FeeRecord.query.filter(
                FeeRecord.school_id == school_id,
                FeeRecord.student_id.in_(stu_ids),
                FeeRecord.status != 'DRAFT',
                FeeRecord.status != 'CANCELLED',
                or_(
                    FeeRecord.source == 'HOSTEL',
                    FeeRecord.fee_type.ilike('%Hostel%')
                ),
                or_(
                    FeeRecord.month == month_code,
                    FeeRecord.month.like(f"%{month_code}%")
                )
            ).all()

        gen_stu_ids = {rec.student_id for rec in fee_records}
        gen_count = len(gen_stu_ids)
        pending_count = max(0, stu_count - gen_count)

        billed = sum(float(rec.amount_due + (rec.fine or 0.0) - (rec.discount or 0.0)) for rec in fee_records)
        paid = sum(float(rec.amount_paid or 0.0) for rec in fee_records)
        pending_amt = max(0.0, billed - paid)

        if not rate and billed > 0 and gen_count > 0:
            rate = round(billed / gen_count, 2)

        label_title = f"{rtype.replace('_', ' ').title()} ({'AC' if is_ac else 'Non-AC'})" if rtype != 'STANDARD' else 'Standard Hostel & Mess'

        if stu_count == 0:
            st = 'EMPTY'
        elif gen_count == 0:
            st = 'NOT_GENERATED'
            pending_categories += 1
        elif gen_count >= stu_count:
            st = 'GENERATED'
            generated_categories += 1
        else:
            st = 'PARTIALLY_GENERATED'
            pending_categories += 1

        breakdown.append({
            'item_id': key,
            'name': label_title,
            'room_type': rtype,
            'is_ac': is_ac,
            'total_students': stu_count,
            'generated_students': gen_count,
            'pending_students': pending_count,
            'rate': rate,
            'billed': round(billed, 2),
            'paid': round(paid, 2),
            'pending': round(pending_amt, 2),
            'status': st,
            'can_generate': st in ('NOT_GENERATED', 'PARTIALLY_GENERATED') and stu_count > 0
        })

    return {
        'type': 'ROOM_WISE',
        'unit_label': 'Room Categories',
        'title': 'Hostel Room-Type & AC Status',
        'description': 'Hostel charges differ by sharing capacity and Air Conditioning (AC) availability.',
        'summary': {
            'total_units': total_categories,
            'generated_units': generated_categories,
            'pending_units': pending_categories,
        },
        'items': breakdown
    }


def get_service_detail_breakdown(school_id, service_code, month=None, session='2026-27'):
    """Returns granular drill-down breakdown for a specific service."""
    month_code, month_label, yr, mo = _parse_month(month)
    norm_code = _normalize_service_code(service_code)
    if norm_code == 'TUITION':
        return get_academic_class_breakdown(school_id, month_code, session)
    elif norm_code == 'TRANSPORT':
        return get_transport_route_breakdown(school_id, month_code, session)
    elif norm_code == 'HOSTEL':
        return get_hostel_room_type_breakdown(school_id, month_code, session)
    else:
        return {
            'type': 'GENERIC',
            'unit_label': 'Service',
            'title': f'{service_code} Breakdown',
            'summary': {'total_units': 1, 'generated_units': 1, 'pending_units': 0},
            'items': []
        }


def get_services_generation_status(school_id, month=None, session='2026-27', class_id=None, category=None):
    """
    Returns dynamic status of each service in the school for a given month:
    - Generated vs Not Generated vs Partially Generated
    - Granular breakdown (Class-wise for Academic, Route-wise for Transport, Room-type for Hostel)
    - Total eligible students vs generated students count
    - Billed, Collected, and Pending totals per service
    """
    ensure_default_fee_heads(school_id)
    month_code, month_label, yr, mo = _parse_month(month)

    # 1. Fetch active fee heads for the school and deduplicate by canonical code
    head_query = FeeHead.query.filter_by(school_id=school_id, is_active=True)
    if category and category.upper() != 'ALL':
        head_query = head_query.filter_by(category=category.upper())
    raw_fee_heads = head_query.order_by(FeeHead.id.asc()).all()

    seen_norm = set()
    fee_heads = []
    for fh in raw_fee_heads:
        norm = _normalize_service_code(fh.code)
        if norm not in seen_norm:
            seen_norm.add(norm)
            fee_heads.append(fh)

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

    # 4. Check FeeRecords with robust multi-format month & session matching
    m_start = date(yr, mo, 1)
    m_end = date(yr, mo, calendar.monthrange(yr, mo)[1])

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
            FeeRecord.month == month_label,
            FeeRecord.month.like(f"%{month_code}%"),
            and_(FeeRecord.due_date >= m_start, FeeRecord.due_date <= m_end)
        )
    )
    if session:
        fee_rec_q = fee_rec_q.filter(or_(FeeRecord.session == session, FeeRecord.session.is_(None)))
    if class_id:
        fee_rec_q = fee_rec_q.join(Student, FeeRecord.student_id == Student.id).filter(Student.class_id == int(class_id))

    fee_rec_rows = fee_rec_q.group_by(FeeRecord.fee_type, FeeRecord.source).all()
    rec_data_by_key = {}
    for r in fee_rec_rows:
        b_amt = float(r.billed_amt or 0.0)
        p_amt = float(r.paid_amt or 0.0)
        entry = {
            'student_count': int(r.student_count or 0),
            'billed': round(b_amt, 2),
            'paid': round(p_amt, 2),
            'pending': round(max(0.0, b_amt - p_amt), 2),
            'last_generated': r.last_generated.isoformat() if r.last_generated else None
        }

        # Determine single canonical key for this row
        k_src = _normalize_service_code(r.source) if r.source and r.source.upper() != 'ACADEMIC' else None
        k_typ = _normalize_service_code(r.fee_type) if r.fee_type else None
        canonical_k = k_src or k_typ or 'TUITION'

        if canonical_k not in rec_data_by_key:
            rec_data_by_key[canonical_k] = dict(entry)
        else:
            rec_data_by_key[canonical_k]['student_count'] += entry['student_count']
            rec_data_by_key[canonical_k]['billed'] += entry['billed']
            rec_data_by_key[canonical_k]['paid'] += entry['paid']
            rec_data_by_key[canonical_k]['pending'] += entry['pending']

    # 5. Fetch batches for this month
    batch_q = FeeGenerationBatch.query.filter_by(school_id=school_id, month=month_code)
    if class_id:
        batch_q = batch_q.filter(or_(FeeGenerationBatch.class_id == int(class_id), FeeGenerationBatch.class_id.is_(None)))
    batches = {_normalize_service_code(b.fee_type): b.to_dict() for b in batch_q.all()}

    services_result = []
    generated_services_count = 0
    not_generated_services_count = 0
    total_billed_all = 0.0
    total_collected_all = 0.0

    for fh in fee_heads:
        norm_code = _normalize_service_code(fh.code)

        # Determine target eligible students for this service
        if norm_code == 'TRANSPORT':
            eligible = transport_count
        elif norm_code == 'HOSTEL':
            eligible = hostel_count
        else:
            eligible = total_active_students

        # Merge bill item data or fee record data
        b_data = bill_items_data.get(fh.id) or rec_data_by_key.get(norm_code)
        if not b_data and norm_code == 'TUITION':
            b_data = rec_data_by_key.get('ACADEMIC')

        student_count = b_data['student_count'] if b_data else 0
        billed = b_data['billed'] if b_data else 0.0
        paid = b_data['paid'] if b_data else 0.0
        pending = b_data['pending'] if b_data else 0.0
        last_gen = b_data['last_generated'] if b_data else None

        batch_info = batches.get(norm_code)

        # Attach service-specific granular breakdown
        breakdown = None
        if norm_code == 'TUITION':
            breakdown = get_academic_class_breakdown(school_id, month_code, session)
        elif norm_code == 'TRANSPORT':
            breakdown = get_transport_route_breakdown(school_id, month_code, session)
            # If no routes configured but fee was generated, add an unassigned item
            if breakdown and breakdown['summary']['total_units'] == 0 and (billed > 0 or student_count > 0):
                breakdown['summary']['total_units'] = 1
                breakdown['summary']['generated_units'] = 1
                breakdown['items'].append({
                    'item_id': 0, 'route_id': None, 'name': 'Direct / Standard Transport Fee',
                    'code': 'STD', 'vehicle_number': 'Standard', 'total_students': student_count,
                    'generated_students': student_count, 'pending_students': 0, 'rate': billed,
                    'billed': billed, 'paid': paid, 'pending': pending, 'status': 'GENERATED',
                    'can_generate': False
                })
        elif norm_code == 'HOSTEL':
            breakdown = get_hostel_room_type_breakdown(school_id, month_code, session)
            # If no room allocations but fee was generated, add a general hostel item
            if breakdown and breakdown['summary']['total_units'] == 0 and (billed > 0 or student_count > 0):
                breakdown['summary']['total_units'] = 1
                breakdown['summary']['generated_units'] = 1
                breakdown['items'].append({
                    'item_id': 'STD_HOSTEL', 'name': 'Standard Hostel & Mess Fee',
                    'room_type': 'STANDARD', 'is_ac': False, 'total_students': student_count,
                    'generated_students': student_count, 'pending_students': 0, 'rate': billed,
                    'billed': billed, 'paid': paid, 'pending': pending, 'status': 'GENERATED',
                    'can_generate': False
                })

        # Status determination: if breakdown has items, align status
        if breakdown and breakdown.get('summary') and breakdown['summary']['total_units'] > 0:
            bsum = breakdown['summary']
            if bsum['generated_units'] >= bsum['total_units']:
                status = 'GENERATED'
            elif bsum['generated_units'] > 0:
                status = 'PARTIALLY_GENERATED'
            else:
                status = 'NOT_GENERATED'
        else:
            if student_count == 0 or (billed == 0 and paid == 0):
                status = 'NOT_GENERATED'
            elif eligible > 0 and student_count >= eligible:
                status = 'GENERATED'
            elif eligible > 0 and student_count < eligible:
                status = 'PARTIALLY_GENERATED'
            else:
                status = 'GENERATED' if (billed > 0 or paid > 0) else 'NOT_GENERATED'

        if status == 'NOT_GENERATED':
            not_generated_services_count += 1
        else:
            generated_services_count += 1

        total_billed_all += billed
        total_collected_all += paid

        services_result.append({
            'head_id':                  fh.id,
            'name':                     fh.name,
            'code':                     fh.code,
            'canonical_code':           norm_code,
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
            'breakdown':                breakdown,
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
        stu_q = stu_q.join(User, Student.user_id == User.id).filter(
            or_(
                Student.admission_no.ilike(s),
                Student.roll_number.ilike(s),
                User.name.ilike(s)
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
    bill_q = FeeBill.query.filter(
        FeeBill.school_id == school_id,
        FeeBill.student_id.in_(st_ids),
        FeeBill.bill_month == month_code,
        FeeBill.status != BillStatus.CANCELLED.value
    )
    if session:
        bill_q = bill_q.filter(or_(FeeBill.session == session, FeeBill.session.is_(None)))
    bills = bill_q.all()

    bill_map = {b.student_id: b for b in bills}

    # 4. Fetch FeeRecords for these students for this month
    rec_q = FeeRecord.query.filter(
        FeeRecord.school_id == school_id,
        FeeRecord.student_id.in_(st_ids),
        or_(FeeRecord.month == month_code, FeeRecord.month == month_label),
        FeeRecord.status.notin_(['DRAFT', 'CANCELLED'])
    )
    if session:
        rec_q = rec_q.filter(or_(FeeRecord.session == session, FeeRecord.session.is_(None)))
    records = rec_q.all()

    rec_by_student = {}
    for r in records:
        rec_by_student.setdefault(r.student_id, []).append(r)

    # 5. Fetch all Opening Balance & Previous Dues for these students
    # (Opening balance / legacy dues persist across months until settled)
    ob_q = FeeRecord.query.filter(
        FeeRecord.school_id == school_id,
        FeeRecord.student_id.in_(st_ids),
        or_(
            FeeRecord.source == 'OPENING_BALANCE',
            FeeRecord.fee_type == 'OPENING_BALANCE',
            FeeRecord.fee_type.ilike('%opening%'),
            FeeRecord.fee_type.ilike('%previous%'),
            FeeRecord.coverage_label.ilike('%opening%'),
            FeeRecord.coverage_label.ilike('%migrat%')
        ),
        FeeRecord.status.notin_(['DRAFT', 'CANCELLED'])
    )
    if session:
        ob_q = ob_q.filter(or_(FeeRecord.session == session, FeeRecord.session.is_(None)))
    ob_records = ob_q.all()

    ob_by_student = {}
    for r in ob_records:
        ob_by_student.setdefault(r.student_id, []).append(r)

    # Also check bill items for OPENING_BALANCE across any bill
    ob_fh_ids = [fh.id for fh in fee_heads if fh.code == 'OPENING_BALANCE']
    ob_bi_q = FeeBillItem.query.join(FeeBill).filter(
        FeeBill.school_id == school_id,
        FeeBill.student_id.in_(st_ids),
        FeeBill.status != BillStatus.CANCELLED.value,
        or_(
            FeeBillItem.department == 'OPENING_BALANCE',
            FeeBillItem.coverage_label.ilike('%opening%'),
            FeeBillItem.fee_head_id.in_(ob_fh_ids) if ob_fh_ids else False
        )
    )
    if session:
        ob_bi_q = ob_bi_q.filter(or_(FeeBill.session == session, FeeBill.session.is_(None)))
    ob_bill_items = ob_bi_q.all()

    ob_bi_by_student = {}
    for bi in ob_bill_items:
        ob_bi_by_student.setdefault(bi.bill.student_id, []).append(bi)

    # Also check student ledgers for opening balance debits
    ob_lg_q = StudentLedger.query.filter(
        StudentLedger.school_id == school_id,
        StudentLedger.student_id.in_(st_ids),
        StudentLedger.entry_type == 'DEBIT',
        or_(
            StudentLedger.period_label == 'Opening Balance',
            StudentLedger.reference_no.ilike('OB-%'),
            StudentLedger.description.ilike('%opening%'),
            StudentLedger.description.ilike('%legacy%')
        )
    )
    if session:
        ob_lg_q = ob_lg_q.filter(or_(StudentLedger.session == session, StudentLedger.session.is_(None)))
    ob_ledgers = ob_lg_q.all()

    ob_ledg_by_student = {}
    for lg in ob_ledgers:
        ob_ledg_by_student.setdefault(lg.student_id, []).append(lg)

    # 6. Build student collection records
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
    if 'OPENING_BALANCE' not in service_totals:
        service_totals['OPENING_BALANCE'] = {
            'code': 'OPENING_BALANCE',
            'name': 'Previous Dues / Opening Balance',
            'category': 'OTHER',
            'billed': 0.0,
            'collected': 0.0,
            'pending': 0.0,
            'paid_students': 0,
            'pending_students': 0
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
        candidate_bill_id = b.id if b else None
        candidate_bill_no = b.bill_no if b else None

        if b and b.items:
            s_total_due = float(b.total_payable or 0.0)
            s_total_paid = float(b.amount_paid or 0.0)
            s_balance = float(b.balance_due or 0.0)

            for it in b.items:
                head = fh_map.get(it.fee_head_id)
                h_code = head.code if head else _normalize_service_code(it.department or 'TUITION')
                net = float(it.net_amount or 0.0)
                paid = float(it.paid_amount or 0.0)
                bal = float(it.balance_amount or 0.0)

                st_code = 'PAID' if bal <= 0 and net > 0 else ('PARTIAL' if paid > 0 else 'PENDING')
                student_services[h_code] = {
                    'name': head.name if head else h_code.replace('_', ' ').title(),
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
                norm_k = _normalize_service_code(r.source or r.fee_type)
                h_code = norm_k if norm_k in service_totals else (r.fee_type or r.source or 'TUITION').upper()
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

        # Check if student has Opening Balance / Previous Dues not yet in student_services
        if 'OPENING_BALANCE' not in student_services:
            s_ob_recs = ob_by_student.get(s.id, [])
            s_ob_bis = ob_bi_by_student.get(s.id, [])
            s_ob_lgs = ob_ledg_by_student.get(s.id, [])

            ob_billed = 0.0
            ob_collected = 0.0
            ob_bal = 0.0

            if s_ob_recs:
                for obr in s_ob_recs:
                    d = float(obr.effective_due() if hasattr(obr, 'effective_due') else (obr.amount_due or 0.0))
                    p = float(obr.amount_paid or 0.0)
                    ob_billed += d
                    ob_collected += p
                    ob_bal += max(0.0, d - p)
            elif s_ob_bis:
                for bi in s_ob_bis:
                    d = float(bi.net_amount or 0.0)
                    p = float(bi.paid_amount or 0.0)
                    ob_billed += d
                    ob_collected += p
                    ob_bal += float(bi.balance_amount or max(0.0, d - p))
                    if not candidate_bill_id and bi.bill:
                        candidate_bill_id = bi.bill.id
                        candidate_bill_no = bi.bill.bill_no
            elif s_ob_lgs:
                for lg in s_ob_lgs:
                    d = float(lg.amount or 0.0)
                    ob_billed += d
                    ob_bal += d

            # Also check if b has previous_dues and b was used
            prev_dues = float(getattr(b, 'previous_dues', 0.0) or 0.0) if b else 0.0
            if prev_dues > 0 and ob_billed == 0.0:
                ob_billed = prev_dues
                ob_bal = prev_dues

            if ob_billed > 0 or ob_collected > 0:
                # If b was present and already counted b.previous_dues in b.total_payable,
                # avoid double counting in s_total_due / s_balance
                if not (b and prev_dues > 0 and abs(prev_dues - ob_billed) < 0.01):
                    s_total_due += ob_billed
                    s_total_paid += ob_collected
                    s_balance += ob_bal

                st_code = 'PAID' if ob_bal <= 0 and ob_billed > 0 else ('PARTIAL' if ob_collected > 0 else 'PENDING')
                student_services['OPENING_BALANCE'] = {
                    'name': 'Previous Dues / Opening Balance',
                    'code': 'OPENING_BALANCE',
                    'billed': round(ob_billed, 2),
                    'paid': round(ob_collected, 2),
                    'balance': round(ob_bal, 2),
                    'status': st_code,
                }

                if 'OPENING_BALANCE' in service_totals:
                    service_totals['OPENING_BALANCE']['billed'] += ob_billed
                    service_totals['OPENING_BALANCE']['collected'] += ob_collected
                    service_totals['OPENING_BALANCE']['pending'] += ob_bal
                    if ob_bal <= 0 and ob_billed > 0:
                        service_totals['OPENING_BALANCE']['paid_students'] += 1
                    elif ob_bal > 0:
                        service_totals['OPENING_BALANCE']['pending_students'] += 1

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
            'bill_no':      candidate_bill_no,
            'bill_id':      candidate_bill_id,
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
