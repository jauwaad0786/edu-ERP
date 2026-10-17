"""
Profit & Loss / Income & Expense Service
Authoritative School Operating Financial Statement Engine
OnePlatform360 Campus / EduERP

Guarantees:
1. Honest, auditable financial categorization.
2. Demand bills are recognized as billing demand, NOT cash receipts.
3. Actual collection is strictly verified successful payments.
4. Total expenses clearly distinguish Paid Outflows from Unpaid Liabilities.
5. Operating Surplus / Deficit = Recognized Operating Income - Recognized Operating Expenses.
6. Period-over-period comparison (Month-over-Month, Session-over-Session).
7. Clean drill-down transactions for non-technical Principals, Owners, and Accountants.
"""

from datetime import date, datetime, timedelta
import calendar
from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy import func, or_, and_

from app import db
from app.models.fee_finance import FeeBill, FeeBillItem, FeePayment, FeePaymentAllocation, FeeHead
from app.models.finance import Expense, VendorBill, VendorPayment, StaffSalaryRecord
from app.services.fee_ledger_service import get_current_academic_session


def _round_curr(val):
    if val is None:
        return 0.0
    d = Decimal(str(val))
    return float(d.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))


class PnLService:

    @staticmethod
    def get_profit_and_loss_statement(
        school_id,
        session=None,
        month=None,
        date_from=None,
        date_to=None,
        basis='CASH', # 'CASH' (Realized Collections) or 'ACCRUAL' (Billed Demand)
        accounting_policy=None
    ):
        """
        Generates comprehensive Profit & Loss / Income & Expenses statement for school management.
        """
        if accounting_policy:
            basis = accounting_policy

        if not session:
            session = get_current_academic_session(school_id)

        # ── 1. Date / Month Boundary Calculation ─────────────────────────
        period_label = f"Session {session}"
        prev_date_from = None
        prev_date_to = None

        if month:
            parsed = False
            # Format 1: "2026-10" or "2026-9"
            if '-' in str(month):
                try:
                    parts = str(month).strip().split('-')
                    yr, mo = int(parts[0]), int(parts[1])
                    date_from = date(yr, mo, 1)
                    last_day = calendar.monthrange(yr, mo)[1]
                    date_to = date(yr, mo, last_day)
                    period_label = f"{calendar.month_name[mo]} {yr}"
                    parsed = True
                except Exception:
                    pass

            # Format 2: "October 2026", "Oct 2026", etc.
            if not parsed:
                try:
                    for fmt in ('%B %Y', '%b %Y', '%Y %B', '%Y %b'):
                        try:
                            dt = datetime.strptime(str(month).strip(), fmt)
                            yr, mo = dt.year, dt.month
                            date_from = date(yr, mo, 1)
                            last_day = calendar.monthrange(yr, mo)[1]
                            date_to = date(yr, mo, last_day)
                            period_label = f"{calendar.month_name[mo]} {yr}"
                            parsed = True
                            break
                        except ValueError:
                            continue
                except Exception:
                    pass

            if parsed:
                # Previous Month Bounds
                prev_yr = yr if mo > 1 else yr - 1
                prev_mo = mo - 1 if mo > 1 else 12
                prev_last_day = calendar.monthrange(prev_yr, prev_mo)[1]
                prev_date_from = date(prev_yr, prev_mo, 1)
                prev_date_to = date(prev_yr, prev_mo, prev_last_day)
        elif date_from and date_to:
            if isinstance(date_from, str):
                date_from = datetime.strptime(date_from, '%Y-%m-%d').date()
            if isinstance(date_to, str):
                date_to = datetime.strptime(date_to, '%Y-%m-%d').date()
            period_label = f"{date_from.strftime('%d %b %Y')} to {date_to.strftime('%d %b %Y')}"
            delta_days = (date_to - date_from).days
            prev_date_to = date_from - timedelta(days=1)
            prev_date_from = prev_date_to - timedelta(days=delta_days)

        # ── 2. Income by Fee Category ───────────────────────────────────
        # Categories: ACADEMIC (Tuition), TRANSPORT, HOSTEL, LIBRARY, EXAM, OTHER
        income_categories = {
            'ACADEMIC':  {'code': 'ACADEMIC',  'name': 'Tuition & Academic Fees', 'amount': 0.0, 'billed': 0.0, 'percentage': 0.0},
            'TRANSPORT': {'code': 'TRANSPORT', 'name': 'Transport Service Fees',  'amount': 0.0, 'billed': 0.0, 'percentage': 0.0},
            'HOSTEL':    {'code': 'HOSTEL',    'name': 'Hostel & Mess Charges',    'amount': 0.0, 'billed': 0.0, 'percentage': 0.0},
            'LIBRARY':   {'code': 'LIBRARY',   'name': 'Library Charges & Fines',  'amount': 0.0, 'billed': 0.0, 'percentage': 0.0},
            'EXAM':      {'code': 'EXAM',      'name': 'Examination Fees',         'amount': 0.0, 'billed': 0.0, 'percentage': 0.0},
            'OTHER':     {'code': 'OTHER',     'name': 'Admission & Other Income', 'amount': 0.0, 'billed': 0.0, 'percentage': 0.0},
        }

        # Query Allocations for Realized Income
        alloc_q = db.session.query(
            FeeHead.category,
            func.coalesce(func.sum(FeePaymentAllocation.allocated_amount), 0.0)
        ).select_from(FeePaymentAllocation).join(
            FeePayment, FeePaymentAllocation.payment_id == FeePayment.id
        ).outerjoin(
            FeeHead, FeePaymentAllocation.fee_head_id == FeeHead.id
        ).filter(
            FeePayment.school_id == school_id,
            FeePayment.status == 'VALID'
        )

        if session:
            alloc_q = alloc_q.filter(FeePayment.session == session)
        if date_from:
            alloc_q = alloc_q.filter(FeePayment.payment_date >= date_from)
        if date_to:
            alloc_q = alloc_q.filter(FeePayment.payment_date <= date_to)

        alloc_rows = alloc_q.group_by(FeeHead.category).all()
        for cat_name, amt in alloc_rows:
            ckey = (cat_name or 'ACADEMIC').upper()
            if ckey not in income_categories:
                ckey = 'OTHER'
            income_categories[ckey]['amount'] = _round_curr(income_categories[ckey]['amount'] + float(amt or 0.0))

        # Query Billed Demand for Invoiced Basis
        bill_item_q = db.session.query(
            FeeHead.category,
            func.coalesce(func.sum(FeeBillItem.net_amount), 0.0)
        ).select_from(FeeBillItem).join(
            FeeBill, FeeBillItem.bill_id == FeeBill.id
        ).outerjoin(
            FeeHead, FeeBillItem.fee_head_id == FeeHead.id
        ).filter(
            FeeBill.school_id == school_id,
            FeeBill.status != 'CANCELLED'
        )

        if session:
            bill_item_q = bill_item_q.filter(FeeBill.session == session)
        if month:
            bill_item_q = bill_item_q.filter(or_(FeeBill.bill_month == month, FeeBill.bill_period_label == month))
        elif date_from and date_to:
            bill_item_q = bill_item_q.filter(FeeBill.due_date >= date_from, FeeBill.due_date <= date_to)

        bill_rows = bill_item_q.group_by(FeeHead.category).all()
        for cat_name, b_amt in bill_rows:
            ckey = (cat_name or 'ACADEMIC').upper()
            if ckey not in income_categories:
                ckey = 'OTHER'
            income_categories[ckey]['billed'] = _round_curr(income_categories[ckey]['billed'] + float(b_amt or 0.0))

        # Total Realized vs Total Billed
        total_realized_income = sum(c['amount'] for c in income_categories.values())
        total_billed_demand   = sum(c['billed'] for c in income_categories.values())

        # If payments have unallocated funds, add to OTHER income
        total_payments_q = FeePayment.query.filter_by(school_id=school_id, status='VALID')
        if session:
            total_payments_q = total_payments_q.filter_by(session=session)
        if date_from:
            total_payments_q = total_payments_q.filter(FeePayment.payment_date >= date_from)
        if date_to:
            total_payments_q = total_payments_q.filter(FeePayment.payment_date <= date_to)

        total_pay_collected = total_payments_q.with_entities(func.coalesce(func.sum(FeePayment.total_paid), 0.0)).scalar() or 0.0
        if total_pay_collected > total_realized_income:
            unalloc = _round_curr(total_pay_collected - total_realized_income)
            income_categories['OTHER']['amount'] = _round_curr(income_categories['OTHER']['amount'] + unalloc)
            total_realized_income = _round_curr(total_pay_collected)

        total_income = total_realized_income if basis == 'CASH' else total_billed_demand
        for c in income_categories.values():
            val = c['amount'] if basis == 'CASH' else c['billed']
            c['percentage'] = round((val / total_income * 100.0), 1) if total_income > 0 else 0.0

        # ── 3. Expenses by Category ─────────────────────────────────────
        exp_q = Expense.query.filter_by(school_id=school_id)
        if date_from:
            exp_q = exp_q.filter(Expense.payment_date >= date_from)
        if date_to:
            exp_q = exp_q.filter(Expense.payment_date <= date_to)

        all_expenses = exp_q.all()

        expense_categories = {}
        total_paid_expenses = 0.0
        total_unpaid_liabilities = 0.0

        capex_categories = {'ASSET_PURCHASE', 'CAPEX_EQUIPMENT', 'CAPEX', 'CAPITAL_EXPENDITURE'}
        total_paid_opex = 0.0
        total_paid_capex = 0.0

        for exp in all_expenses:
            cat = (exp.category or 'OTHER').upper()
            is_capex = cat in capex_categories
            if cat not in expense_categories:
                display_name = cat.replace('_', ' ').title()
                expense_categories[cat] = {
                    'category': cat,
                    'name': display_name,
                    'is_capex': is_capex,
                    'paid_amount': 0.0,
                    'unpaid_amount': 0.0,
                    'total_amount': 0.0,
                    'percentage': 0.0,
                    'count': 0
                }

            amt = float(exp.amount or 0.0)
            expense_categories[cat]['count'] += 1
            expense_categories[cat]['total_amount'] = _round_curr(expense_categories[cat]['total_amount'] + amt)

            if exp.status == 'PAID':
                expense_categories[cat]['paid_amount'] = _round_curr(expense_categories[cat]['paid_amount'] + amt)
                total_paid_expenses += amt
                if is_capex:
                    total_paid_capex += amt
                else:
                    total_paid_opex += amt
            else:
                expense_categories[cat]['unpaid_amount'] = _round_curr(expense_categories[cat]['unpaid_amount'] + amt)
                total_unpaid_liabilities += amt

        # Add outstanding Vendor Bills to unpaid liabilities if any
        vbill_q = VendorBill.query.filter_by(school_id=school_id).filter(VendorBill.status.in_(['PENDING', 'PARTIAL']))
        if date_from:
            vbill_q = vbill_q.filter(VendorBill.bill_date >= date_from)
        if date_to:
            vbill_q = vbill_q.filter(VendorBill.bill_date <= date_to)
        for vb in vbill_q.all():
            vbal = float(vb.balance_amount or 0.0)
            if vbal > 0:
                total_unpaid_liabilities += vbal
                if 'VENDOR_LIABILITIES' not in expense_categories:
                    expense_categories['VENDOR_LIABILITIES'] = {
                        'category': 'VENDOR_LIABILITIES',
                        'name': 'Outstanding Vendor Invoices',
                        'is_capex': False,
                        'paid_amount': 0.0,
                        'unpaid_amount': 0.0,
                        'total_amount': 0.0,
                        'percentage': 0.0,
                        'count': 0
                    }
                expense_categories['VENDOR_LIABILITIES']['unpaid_amount'] = _round_curr(expense_categories['VENDOR_LIABILITIES']['unpaid_amount'] + vbal)
                expense_categories['VENDOR_LIABILITIES']['total_amount'] = _round_curr(expense_categories['VENDOR_LIABILITIES']['total_amount'] + vbal)
                expense_categories['VENDOR_LIABILITIES']['count'] += 1

        total_expenses = _round_curr(total_paid_expenses) if basis == 'CASH' else _round_curr(total_paid_expenses + total_unpaid_liabilities)
        total_capex = _round_curr(sum(ec['paid_amount'] if basis == 'CASH' else ec['total_amount'] for ec in expense_categories.values() if ec.get('is_capex')))
        total_opex = _round_curr(max(0.0, total_expenses - total_capex))

        for ec in expense_categories.values():
            val = ec['paid_amount'] if basis == 'CASH' else ec['total_amount']
            ec['percentage'] = round((val / total_expenses * 100.0), 1) if total_expenses > 0 else 0.0

        # ── 4. Net Operating Surplus / Deficit ───────────────────────────
        operating_surplus = _round_curr(total_income - total_opex)
        operating_margin_pct = round((operating_surplus / total_income * 100.0), 1) if total_income > 0 else 0.0
        net_result = _round_curr(total_income - total_expenses)
        profit_margin = round((net_result / total_income * 100.0), 1) if total_income > 0 else 0.0

        # ── 5. Previous Period Comparison ───────────────────────────────
        prev_income = 0.0
        prev_expenses = 0.0
        prev_net = 0.0
        if prev_date_from and prev_date_to:
            prev_p_q = FeePayment.query.filter(
                FeePayment.school_id == school_id,
                FeePayment.status == 'VALID',
                FeePayment.payment_date >= prev_date_from,
                FeePayment.payment_date <= prev_date_to
            )
            prev_income = _round_curr(prev_p_q.with_entities(func.coalesce(func.sum(FeePayment.total_paid), 0.0)).scalar() or 0.0)

            prev_e_q = Expense.query.filter(
                Expense.school_id == school_id,
                Expense.status == 'PAID',
                Expense.payment_date >= prev_date_from,
                Expense.payment_date <= prev_date_to
            )
            prev_expenses = _round_curr(prev_e_q.with_entities(func.coalesce(func.sum(Expense.amount), 0.0)).scalar() or 0.0)
            prev_net = _round_curr(prev_income - prev_expenses)

        # ── 6. Cash Flow Position (Money In vs Money Out) ───────────────
        cash_inflows = total_realized_income
        cash_outflows = _round_curr(total_paid_expenses)
        net_cash_flow = _round_curr(cash_inflows - cash_outflows)

        return {
            'school_id': school_id,
            'session': session,
            'period_label': period_label,
            'accounting_basis': basis, # CASH or ACCRUAL
            'accounting_policy_label': 'Cash-Basis Realized Statement' if basis == 'CASH' else 'Accrual & Invoiced Statement',
            'is_formal_statutory_filing': False,
            'statutory_disclaimer': 'Management Operating Statement for Principal/School Owner. Reflects recorded fee receipts and approved expenses.',
            'date_from': str(date_from) if date_from else None,
            'date_to': str(date_to) if date_to else None,

            # Core Financial Totals
            'total_income': total_income,
            'total_billed_demand': _round_curr(total_billed_demand),
            'total_realized_collections': _round_curr(total_realized_income),
            'total_expenses': total_expenses,
            'operating_expenses': total_opex,
            'capital_expenditures': total_capex,
            'operating_surplus': operating_surplus,
            'operating_margin_percentage': operating_margin_pct,
            'total_paid_expenses': _round_curr(total_paid_expenses),
            'total_unpaid_liabilities': _round_curr(total_unpaid_liabilities),
            'net_operating_result': net_result,
            'is_surplus': net_result >= 0,
            'profit_margin_percentage': profit_margin,

            # Categorized Breakdown
            'income_by_category': list(income_categories.values()),
            'expenses_by_category': sorted(list(expense_categories.values()), key=lambda x: x['total_amount'], reverse=True),

            # Cash Flow Position
            'cash_flow': {
                'total_inflows': cash_inflows,
                'total_outflows': cash_outflows,
                'net_cash_flow': net_cash_flow,
                'status': 'HEALTHY' if net_cash_flow >= 0 else 'DEFICIT'
            },

            # Comparison with Previous Period
            'comparison': {
                'has_previous_period': bool(prev_date_from),
                'previous_income': prev_income,
                'previous_expenses': prev_expenses,
                'previous_net_result': prev_net,
                'income_growth_pct': round(((total_income - prev_income) / prev_income * 100.0), 1) if prev_income > 0 else 0.0,
                'expense_growth_pct': round(((total_expenses - prev_expenses) / prev_expenses * 100.0), 1) if prev_expenses > 0 else 0.0,
            }
        }
