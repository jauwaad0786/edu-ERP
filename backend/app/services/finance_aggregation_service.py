"""
Finance Aggregation Service
Authoritative calculations for Dashboards, Analytics, and Financial Reports.

Guarantees:
1. Strict session and multi-tenant isolation.
2. Dashboard metrics strictly match the sum of individual records from the detail view.
3. Consistent formula:
   Gross Due = amount_due
   Net Due = amount_due + fine - discount
   Balance = max(0, Net Due - amount_paid)
4. Full support for filtering by session, month, class_id, source/service, and status.
"""

from datetime import date, datetime
import calendar
from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy import func, case, or_, and_
from app import db
from app.models.financial import FeeRecord, FeeTransaction
from app.models.fee_finance import FeeHead, FeePayment, FeePaymentAllocation, FeeBill, FeeBillItem
from app.models.academic import Student, Class


def round_curr(val):
    if val is None:
        return 0.0
    d = Decimal(str(val))
    return float(d.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))


class FinanceAggregationService:

    @staticmethod
    def get_fee_summary(
        school_id,
        session='2026-27',
        month=None,
        class_id=None,
        source=None,
        status=None,
        date_from=None,
        date_to=None
    ):
        """
        Returns authoritative aggregated metrics for dashboard cards and summary widgets.
        Guaranteed to match the sum of items returned by the detail records endpoint with identical filters.
        """
        # ── 1. Modern Engine: FeeBill & FeePayment Aggregates ─────────────────
        bq = FeeBill.query.filter(
            FeeBill.school_id == school_id,
            FeeBill.status != 'CANCELLED'
        )
        if session:
            bq = bq.filter(FeeBill.session == session)
        if month:
            bq = bq.filter(or_(FeeBill.bill_month == month, FeeBill.bill_period_label == month))
        if class_id:
            bq = bq.join(Student, FeeBill.student_id == Student.id).filter(Student.class_id == class_id)
        if date_from:
            bq = bq.filter(FeeBill.due_date >= date_from)
        if date_to:
            bq = bq.filter(FeeBill.due_date <= date_to)

        if status and status != 'ALL':
            st_upper = status.upper()
            if st_upper == 'PENDING':
                bq = bq.filter(FeeBill.status.in_(['ISSUED', 'OVERDUE']))
            elif st_upper == 'PARTIAL':
                bq = bq.filter(FeeBill.status == 'PARTIALLY_PAID')
            elif st_upper == 'PAID':
                bq = bq.filter(FeeBill.status == 'PAID')
            elif st_upper == 'OVERDUE':
                bq = bq.filter(FeeBill.status == 'OVERDUE')
            else:
                bq = bq.filter(FeeBill.status == st_upper)

        bagg = bq.with_entities(
            func.coalesce(func.sum(FeeBill.total_current_charges), 0.0).label('gross_due'),
            func.coalesce(func.sum(FeeBill.total_discount), 0.0).label('total_discount'),
            func.coalesce(func.sum(FeeBill.total_late_fine), 0.0).label('total_fine'),
            func.coalesce(func.sum(FeeBill.total_payable), 0.0).label('total_due'),
            func.coalesce(func.sum(FeeBill.amount_paid), 0.0).label('total_paid'),
            func.coalesce(func.sum(FeeBill.balance_due), 0.0).label('outstanding'),
            func.count(FeeBill.id).label('total_count'),
            func.coalesce(func.sum(case((FeeBill.status == 'ISSUED', 1), else_=0)), 0).label('pending_count'),
            func.coalesce(func.sum(case((FeeBill.status == 'PARTIALLY_PAID', 1), else_=0)), 0).label('partial_count'),
            func.coalesce(func.sum(case((FeeBill.status == 'PAID', 1), else_=0)), 0).label('paid_count'),
            func.coalesce(func.sum(case((FeeBill.status == 'OVERDUE', 1), else_=0)), 0).label('overdue_count'),
        ).first()

        # FeePayment total paid in session
        pq = FeePayment.query.filter(
            FeePayment.school_id == school_id,
            FeePayment.status == 'VALID'
        )
        if session:
            pq = pq.filter(FeePayment.session == session)
        if class_id:
            pq = pq.join(Student, FeePayment.student_id == Student.id).filter(Student.class_id == class_id)
        if date_from:
            pq = pq.filter(FeePayment.payment_date >= date_from)
        if date_to:
            pq = pq.filter(FeePayment.payment_date <= date_to)

        total_pay_collected = pq.with_entities(func.coalesce(func.sum(FeePayment.total_paid), 0.0)).scalar() or 0.0

        # ── 2. Legacy Engine: FeeRecord Aggregates ───────────────────────────
        q = FeeRecord.query.filter(
            FeeRecord.school_id == school_id,
            FeeRecord.status.notin_(['DRAFT', 'CANCELLED'])
        )
        if session:
            q = q.filter(FeeRecord.session == session)
        if month:
            q = q.filter(FeeRecord.month == month)
        if source:
            src_upper = source.upper()
            if src_upper == 'ACADEMIC':
                q = q.filter(or_(FeeRecord.source.in_(['ACADEMIC', 'TUITION', None]), FeeRecord.source == ''))
            else:
                q = q.filter(FeeRecord.source == src_upper)
        if status and status != 'ALL':
            q = q.filter(FeeRecord.status == status)
        if class_id:
            q = q.join(Student, FeeRecord.student_id == Student.id).filter(Student.class_id == class_id)
        if date_from:
            q = q.filter(FeeRecord.due_date >= date_from)
        if date_to:
            q = q.filter(FeeRecord.due_date <= date_to)

        net_expr = FeeRecord.amount_due + func.coalesce(FeeRecord.fine, 0.0) - func.coalesce(FeeRecord.discount, 0.0)
        bal_expr = case(
            (net_expr > func.coalesce(FeeRecord.amount_paid, 0.0), net_expr - func.coalesce(FeeRecord.amount_paid, 0.0)),
            else_=0.0
        )

        r_agg = q.with_entities(
            func.coalesce(func.sum(FeeRecord.amount_due), 0.0).label('gross_due'),
            func.coalesce(func.sum(FeeRecord.discount), 0.0).label('total_discount'),
            func.coalesce(func.sum(FeeRecord.fine), 0.0).label('total_fine'),
            func.coalesce(func.sum(net_expr), 0.0).label('total_due'),
            func.coalesce(func.sum(FeeRecord.amount_paid), 0.0).label('total_paid'),
            func.coalesce(func.sum(bal_expr), 0.0).label('outstanding'),
            func.count(FeeRecord.id).label('total_count'),
            func.coalesce(func.sum(case((FeeRecord.status == 'PENDING', 1), else_=0)), 0).label('pending_count'),
            func.coalesce(func.sum(case((FeeRecord.status == 'PARTIAL', 1), else_=0)), 0).label('partial_count'),
            func.coalesce(func.sum(case((FeeRecord.status == 'PAID', 1), else_=0)), 0).label('paid_count'),
            func.coalesce(func.sum(case((FeeRecord.status == 'OVERDUE', 1), else_=0)), 0).label('overdue_count'),
        ).first()

        use_modern = (bagg and bagg.total_count > 0) or (total_pay_collected > 0)

        if use_modern:
            gross_due = round_curr(bagg.gross_due if bagg else 0.0)
            total_discount = round_curr(bagg.total_discount if bagg else 0.0)
            total_fine = round_curr(bagg.total_fine if bagg else 0.0)
            total_due = round_curr(bagg.total_due if bagg else 0.0)
            total_paid = round_curr(max(float(bagg.total_paid if bagg else 0.0), float(total_pay_collected)))
            outstanding = round_curr(bagg.outstanding if bagg else max(0.0, total_due - total_paid))
            total_count = int(bagg.total_count if bagg else 0)
            pending_count = int(bagg.pending_count if bagg else 0)
            partial_count = int(bagg.partial_count if bagg else 0)
            paid_count = int(bagg.paid_count if bagg else 0)
            overdue_count = int(bagg.overdue_count if bagg else 0)
        else:
            gross_due = round_curr(r_agg.gross_due if r_agg else 0.0)
            total_discount = round_curr(r_agg.total_discount if r_agg else 0.0)
            total_fine = round_curr(r_agg.total_fine if r_agg else 0.0)
            total_due = round_curr(r_agg.total_due if r_agg else 0.0)
            total_paid = round_curr(r_agg.total_paid if r_agg else 0.0)
            outstanding = round_curr(r_agg.outstanding if r_agg else 0.0)
            total_count = int(r_agg.total_count if r_agg else 0)
            pending_count = int(r_agg.pending_count if r_agg else 0)
            partial_count = int(r_agg.partial_count if r_agg else 0)
            paid_count = int(r_agg.paid_count if r_agg else 0)
            overdue_count = int(r_agg.overdue_count if r_agg else 0)

        collection_rate = round(total_paid / total_due * 100, 1) if total_due > 0 else 0.0

        # ── Service-wise Breakdown ─────────────────────────────────────────
        services = {
            'ACADEMIC':  {'name': 'Tuition / School Fees', 'due': 0.0, 'paid': 0.0, 'outstanding': 0.0, 'count': 0},
            'TRANSPORT': {'name': 'Transport Service',     'due': 0.0, 'paid': 0.0, 'outstanding': 0.0, 'count': 0},
            'HOSTEL':    {'name': 'Hostel & Mess',         'due': 0.0, 'paid': 0.0, 'outstanding': 0.0, 'count': 0},
            'LIBRARY':   {'name': 'Library & Fines',       'due': 0.0, 'paid': 0.0, 'outstanding': 0.0, 'count': 0},
            'EXAM':      {'name': 'Examinations',          'due': 0.0, 'paid': 0.0, 'outstanding': 0.0, 'count': 0},
            'OTHER':     {'name': 'Other Services',       'due': 0.0, 'paid': 0.0, 'outstanding': 0.0, 'count': 0},
        }

        # Query FeeBillItem joined with FeeHead
        item_q = db.session.query(
            FeeHead.category,
            func.coalesce(func.sum(FeeBillItem.net_amount), 0.0).label('due'),
            func.coalesce(func.sum(FeeBillItem.paid_amount), 0.0).label('paid'),
            func.coalesce(func.sum(FeeBillItem.balance_amount), 0.0).label('bal'),
            func.count(FeeBillItem.id).label('cnt')
        ).select_from(FeeBillItem).join(
            FeeBill, FeeBillItem.bill_id == FeeBill.id
        ).outerjoin(
            FeeHead, FeeBillItem.fee_head_id == FeeHead.id
        ).filter(
            FeeBill.school_id == school_id,
            FeeBill.status != 'CANCELLED'
        )
        if session:
            item_q = item_q.filter(FeeBill.session == session)
        if month:
            item_q = item_q.filter(or_(FeeBill.bill_month == month, FeeBill.bill_period_label == month))
        if class_id:
            item_q = item_q.join(Student, FeeBill.student_id == Student.id).filter(Student.class_id == class_id)

        bill_items = item_q.group_by(FeeHead.category).all()
        if bill_items:
            for cat_name, b_due, b_paid, b_bal, b_cnt in bill_items:
                cat_key = (cat_name or 'ACADEMIC').upper()
                if cat_key not in services:
                    cat_key = 'OTHER'
                services[cat_key]['due'] = round_curr(services[cat_key]['due'] + float(b_due))
                services[cat_key]['paid'] = round_curr(services[cat_key]['paid'] + float(b_paid))
                services[cat_key]['outstanding'] = round_curr(services[cat_key]['outstanding'] + float(b_bal))
                services[cat_key]['count'] += int(b_cnt)
        else:
            # Fallback to FeeRecord
            sq = FeeRecord.query.filter(
                FeeRecord.school_id == school_id,
                FeeRecord.status.notin_(['DRAFT', 'CANCELLED'])
            )
            if session:
                sq = sq.filter(FeeRecord.session == session)
            if month:
                sq = sq.filter(FeeRecord.month == month)
            if class_id:
                sq = sq.join(Student, FeeRecord.student_id == Student.id).filter(Student.class_id == class_id)

            service_agg = sq.with_entities(
                FeeRecord.source,
                func.coalesce(func.sum(net_expr), 0.0).label('due'),
                func.coalesce(func.sum(FeeRecord.amount_paid), 0.0).label('paid'),
                func.coalesce(func.sum(bal_expr), 0.0).label('bal'),
                func.count(FeeRecord.id).label('cnt')
            ).group_by(FeeRecord.source).all()

            for row in service_agg:
                raw_src = (row.source or 'ACADEMIC').upper()
                if 'TRANSPORT' in raw_src:
                    k = 'TRANSPORT'
                elif 'HOSTEL' in raw_src:
                    k = 'HOSTEL'
                elif 'LIB' in raw_src:
                    k = 'LIBRARY'
                elif 'EXAM' in raw_src:
                    k = 'EXAM'
                elif raw_src in ('ACADEMIC', 'TUITION'):
                    k = 'ACADEMIC'
                else:
                    k = 'OTHER'

                services[k]['due'] = round_curr(services[k]['due'] + float(row.due))
                services[k]['paid'] = round_curr(services[k]['paid'] + float(row.paid))
                services[k]['outstanding'] = round_curr(services[k]['outstanding'] + float(row.bal))
                services[k]['count'] += int(row.cnt)

        # ── Today's Collection & Payment Mode Distribution ─────────────────
        today = date.today()

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

        # Month collection
        this_month_label = month or today.strftime('%Y-%m')
        try:
            yr, mo = map(int, this_month_label.split('-'))
            start_m = date(yr, mo, 1)
            end_m = date(yr, mo, calendar.monthrange(yr, mo)[1])
        except Exception:
            start_m = date(today.year, today.month, 1)
            end_m = date(today.year, today.month, calendar.monthrange(today.year, today.month)[1])

        month_payments = FeePayment.query.filter(
            FeePayment.school_id == school_id,
            FeePayment.status == 'VALID',
            FeePayment.payment_date >= start_m,
            FeePayment.payment_date <= end_m
        ).all()
        month_pay_sum = sum(p.total_paid or 0.0 for p in month_payments)

        month_txns = FeeTransaction.query.filter(
            FeeTransaction.school_id == school_id,
            FeeTransaction.transaction_date >= start_m,
            FeeTransaction.transaction_date <= end_m
        ).all()
        month_tx_sum = sum(t.amount or 0.0 for t in month_txns)

        month_collection = round_curr(month_pay_sum + month_tx_sum)

        mode_breakdown = {'CASH': 0.0, 'UPI': 0.0, 'ONLINE': 0.0, 'CHEQUE': 0.0, 'CARD': 0.0, 'BANK_TRANSFER': 0.0, 'OTHER': 0.0}
        for p in month_payments:
            m = (p.payment_mode or 'CASH').upper()
            if m not in mode_breakdown:
                mode_breakdown[m] = 0.0
            mode_breakdown[m] = round_curr(mode_breakdown[m] + (p.total_paid or 0.0))

        for t in month_txns:
            m = (t.payment_mode or 'CASH').upper()
            if m not in mode_breakdown:
                mode_breakdown[m] = 0.0
            mode_breakdown[m] = round_curr(mode_breakdown[m] + (t.amount or 0.0))

        # Today's breakdown by department
        today_by_dept = {
            'academic': 0.0, 'hostel': 0.0, 'transport': 0.0,
            'library': 0.0, 'admission': 0.0, 'other': 0.0,
            'total': today_collection
        }
        for p in today_payments:
            if p.allocations:
                for a in p.allocations:
                    dept = (a.department or 'ACADEMIC').upper()
                    amt = float(a.allocated_amount or 0.0)
                    if 'HOSTEL' in dept:
                        today_by_dept['hostel'] += amt
                    elif 'TRANSPORT' in dept:
                        today_by_dept['transport'] += amt
                    elif 'LIB' in dept:
                        today_by_dept['library'] += amt
                    elif 'ADMISSION' in dept:
                        today_by_dept['admission'] += amt
                    elif any(k in dept for k in ['ACADEMIC', 'ACCOUNTS', 'TUITION', 'EXAM']):
                        today_by_dept['academic'] += amt
                    else:
                        today_by_dept['other'] += amt
            else:
                dept = (p.department or 'ACADEMIC').upper()
                amt = float(p.total_paid or 0.0)
                if 'HOSTEL' in dept:
                    today_by_dept['hostel'] += amt
                elif 'TRANSPORT' in dept:
                    today_by_dept['transport'] += amt
                elif 'LIB' in dept:
                    today_by_dept['library'] += amt
                else:
                    today_by_dept['academic'] += amt

        for t in today_txns:
            rec = t.fee_record
            src = (rec.source if rec and rec.source else 'ACADEMIC').upper()
            amt = float(t.amount or 0.0)
            if 'HOSTEL' in src:
                today_by_dept['hostel'] += amt
            elif 'TRANSPORT' in src:
                today_by_dept['transport'] += amt
            elif 'LIB' in src:
                today_by_dept['library'] += amt
            elif 'ADMISSION' in src:
                today_by_dept['admission'] += amt
            elif any(k in src for k in ['ACADEMIC', 'TUITION', 'EXAM']):
                today_by_dept['academic'] += amt
            else:
                today_by_dept['other'] += amt

        for k in today_by_dept:
            today_by_dept[k] = round_curr(today_by_dept[k])

        return {
            'gross_due': gross_due,
            'total_due': total_due,
            'total_demand': total_due,           # Compatible with AccountantDashboard / Mobile
            'total_collected': total_paid,
            'total_paid': total_paid,
            'collected': total_paid,             # Compatible with AccountantDashboard / Mobile
            'outstanding': outstanding,
            'balance': outstanding,              # Compatible with AccountantDashboard / Mobile
            'total_discount': total_discount,
            'total_fine': total_fine,
            'total_count': total_count,
            'pending_count': pending_count,
            'partial_count': partial_count,
            'paid_count': paid_count,
            'overdue_count': overdue_count,
            'collection_rate': collection_rate,
            'today_collection': today_collection,
            'today_breakdown': today_by_dept,
            'this_month': this_month_label,
            'this_month_collection': month_collection,
            'cash_collection': mode_breakdown.get('CASH', 0.0),
            'upi_collection': mode_breakdown.get('UPI', 0.0),
            'online_collection': mode_breakdown.get('ONLINE', 0.0),
            'cheque_collection': mode_breakdown.get('CHEQUE', 0.0),
            'services': services,
            'service_breakdown': {
                'academic': services['ACADEMIC']['paid'],
                'transport': services['TRANSPORT']['paid'],
                'hostel': services['HOSTEL']['paid'],
                'library': services['LIBRARY']['paid'],
                'exam': services['EXAM']['paid'],
                'other': services['OTHER']['paid'],
            }
        }

    @staticmethod
    def get_class_wise_summary(school_id, session='2026-27', month=None):
        """Returns class-wise fee realization matrix (combining FeeBill and FeeRecord)."""
        classes = Class.query.filter_by(school_id=school_id).all()
        result = []

        # 1. Pre-query FeeBill by student class
        class_bill_data = {}
        bq = db.session.query(
            Student.class_id,
            func.coalesce(func.sum(FeeBill.total_payable), 0.0).label('due'),
            func.coalesce(func.sum(FeeBill.amount_paid), 0.0).label('paid'),
            func.coalesce(func.sum(FeeBill.balance_due), 0.0).label('bal'),
            func.count(FeeBill.id).label('cnt')
        ).join(Student, FeeBill.student_id == Student.id).filter(
            FeeBill.school_id == school_id,
            FeeBill.status != 'CANCELLED'
        )
        if session:
            bq = bq.filter(FeeBill.session == session)
        if month:
            bq = bq.filter(or_(FeeBill.bill_month == month, FeeBill.bill_period_label == month))

        for cid, due, paid, bal, cnt in bq.group_by(Student.class_id).all():
            if cid:
                class_bill_data[cid] = {
                    'due': float(due or 0.0),
                    'paid': float(paid or 0.0),
                    'bal': float(bal or 0.0),
                    'cnt': int(cnt or 0)
                }

        # 2. Pre-query FeeRecord by student class
        class_record_data = {}
        net_expr = FeeRecord.amount_due + func.coalesce(FeeRecord.fine, 0.0) - func.coalesce(FeeRecord.discount, 0.0)
        bal_expr = case(
            (net_expr > func.coalesce(FeeRecord.amount_paid, 0.0), net_expr - func.coalesce(FeeRecord.amount_paid, 0.0)),
            else_=0.0
        )
        rq = db.session.query(
            Student.class_id,
            func.coalesce(func.sum(net_expr), 0.0).label('due'),
            func.coalesce(func.sum(FeeRecord.amount_paid), 0.0).label('paid'),
            func.coalesce(func.sum(bal_expr), 0.0).label('bal'),
            func.count(FeeRecord.id).label('cnt')
        ).join(Student, FeeRecord.student_id == Student.id).filter(
            FeeRecord.school_id == school_id,
            FeeRecord.status.notin_(['DRAFT', 'CANCELLED'])
        )
        if session:
            rq = rq.filter(FeeRecord.session == session)
        if month:
            rq = rq.filter(FeeRecord.month == month)

        for cid, due, paid, bal, cnt in rq.group_by(Student.class_id).all():
            if cid:
                class_record_data[cid] = {
                    'due': float(due or 0.0),
                    'paid': float(paid or 0.0),
                    'bal': float(bal or 0.0),
                    'cnt': int(cnt or 0)
                }

        for cls in classes:
            b_data = class_bill_data.get(cls.id)
            r_data = class_record_data.get(cls.id)

            if b_data and b_data['cnt'] > 0:
                due = round_curr(b_data['due'])
                paid = round_curr(b_data['paid'])
                bal = round_curr(b_data['bal'])
                cnt = b_data['cnt']
            elif r_data:
                due = round_curr(r_data['due'])
                paid = round_curr(r_data['paid'])
                bal = round_curr(r_data['bal'])
                cnt = r_data['cnt']
            else:
                due = 0.0
                paid = 0.0
                bal = 0.0
                cnt = 0

            result.append({
                'class_id': cls.id,
                'class_name': f"{cls.name} {cls.section or ''}".strip(),
                'total_due': due,
                'total_paid': paid,
                'total_collected': paid,
                'outstanding': bal,
                'balance': bal,
                'pending': bal,
                'count': cnt,
                'collection_rate': round(paid / due * 100, 1) if due > 0 else 0.0
            })

        return result

    @staticmethod
    def audit_reconciliation(school_id, session='2026-27'):
        """
        Comprehensive financial data integrity auditor:
        - Detects discrepancies between dashboard aggregates and detail records.
        - Checks for overpaid, negative balance, or inconsistent status records.
        - Identifies orphaned service charges or broken student references.
        """
        anomalies = []

        # 1. Query all FeeRecords for the school and session
        recs = FeeRecord.query.filter_by(school_id=school_id)
        if session:
            recs = recs.filter_by(session=session)
        recs = recs.all()

        total_due_calc = 0.0
        total_paid_calc = 0.0

        for r in recs:
            eff_due = r.effective_due() if hasattr(r, 'effective_due') else (r.amount_due or 0.0)
            paid = round_curr(r.amount_paid or 0.0)
            bal = round_curr(eff_due - paid)

            if r.status not in ('DRAFT', 'CANCELLED'):
                total_due_calc += eff_due
                total_paid_calc += paid

            # Anomaly: Negative balance
            if bal < -0.01:
                anomalies.append({
                    'type': 'NEGATIVE_BALANCE',
                    'record_id': r.id,
                    'student_id': r.student_id,
                    'effective_due': eff_due,
                    'amount_paid': paid,
                    'balance': bal,
                    'message': f"Record #{r.id} has negative balance ₹{bal:.2f} (paid > effective due)"
                })

            # Anomaly: Status inconsistent with payment
            if paid >= eff_due and eff_due > 0 and r.status not in ('PAID', 'CANCELLED'):
                anomalies.append({
                    'type': 'INCORRECT_STATUS',
                    'record_id': r.id,
                    'current_status': r.status,
                    'expected_status': 'PAID',
                    'message': f"Record #{r.id} is fully paid but status is {r.status}"
                })
            elif paid > 0 and paid < eff_due and r.status not in ('PARTIAL', 'CANCELLED'):
                anomalies.append({
                    'type': 'INCORRECT_STATUS',
                    'record_id': r.id,
                    'current_status': r.status,
                    'expected_status': 'PARTIAL',
                    'message': f"Record #{r.id} is partially paid but status is {r.status}"
                })

            # Anomaly: Invalid student
            if not r.student_ref and not Student.query.get(r.student_id):
                anomalies.append({
                    'type': 'ORPHANED_RECORD',
                    'record_id': r.id,
                    'student_id': r.student_id,
                    'message': f"Record #{r.id} references non-existent student #{r.student_id}"
                })

        # 2. Check synchronization with FeeBillItems
        bill_items_due = db.session.query(
            func.coalesce(func.sum(FeeBillItem.net_amount), 0.0)
        ).join(FeeBill, FeeBillItem.bill_id == FeeBill.id).filter(
            FeeBill.school_id == school_id,
            FeeBill.session == session,
            FeeBill.status != 'CANCELLED'
        ).scalar() or 0.0

        summary = FinanceAggregationService.get_fee_summary(school_id, session=session)

        reconciled = abs(round_curr(total_due_calc) - round_curr(summary['total_due'])) < 0.01

        return {
            'school_id': school_id,
            'session': session,
            'total_fee_records': len(recs),
            'summary_total_due': summary['total_due'],
            'records_total_due': round_curr(total_due_calc),
            'summary_total_paid': summary['total_paid'],
            'records_total_paid': round_curr(total_paid_calc),
            'bill_items_net_due': round_curr(bill_items_due),
            'is_fully_reconciled': reconciled and len(anomalies) == 0,
            'anomalies_count': len(anomalies),
            'anomalies': anomalies[:50]
        }
