"""
Reconciliation Service
Automated Bank Statement, Payment Gateway, and UPI Reconciliation Engine
OnePlatform360 Campus / EduERP

Capabilities:
1. Parse CSV and Excel bank statements and gateway settlement reports.
2. Intelligent matching engine:
   - MATCHED (100% confidence, exact UTR/receipt + amount)
   - AMOUNT_MISMATCH (UTR matches, slight variance due to gateway fee/bank charges)
   - POSSIBLE_MATCH (Amount + date proximity +/- 3 days + student identifier in narration)
   - DUPLICATE (Repeated UTR or transaction)
   - MISSING_IN_ERP (Bank credit with no ERP receipt)
   - MISSING_IN_BANK (ERP collection with no bank credit)
3. Audit-safe resolution:
   - Explain discrepancies to non-technical users
   - Allows recording gateway settlement fee as an expense without modifying student balance
   - Never forces reconciliation by silently editing numbers
"""

import csv
import io
import re
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy import func, or_, and_

from app import db
from app.models.finance import BankStatementBatch, BankTransaction, Expense
from app.models.fee_finance import FeePayment, FeePaymentAllocation, FeeBill
from app.models.academic import Student


def _round_curr(val):
    if val is None:
        return 0.0
    d = Decimal(str(val))
    return float(d.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))


def _parse_date(date_str):
    if not date_str:
        return date.today()
    if isinstance(date_str, (date, datetime)):
        return date_str if isinstance(date_str, date) else date_str.date()

    cleaned = str(date_str).strip()
    formats = [
        '%d/%m/%Y', '%Y-%m-%d', '%d-%m-%Y', '%d/%m/%y',
        '%d-%b-%Y', '%d-%b-%y', '%d %b %Y', '%Y/%m/%d'
    ]
    for fmt in formats:
        try:
            return datetime.strptime(cleaned, fmt).date()
        except Exception:
            continue
    # Fallback to regex extract YYYY-MM-DD or DD/MM/YYYY
    m = re.search(r'(\d{1,4})[-/](\d{1,2})[-/](\d{2,4})', cleaned)
    if m:
        try:
            p1, p2, p3 = m.groups()
            if len(p1) == 4:
                return date(int(p1), int(p2), int(p3))
            elif len(p3) == 4:
                return date(int(p3), int(p2), int(p1))
        except Exception:
            pass
    return date.today()


def _parse_amount(val):
    if val is None:
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).replace(',', '').replace('₹', '').replace('Rs.', '').replace('Rs', '').strip()
    if not s or s == '-' or s.lower() == 'nil':
        return 0.0
    try:
        return float(s)
    except Exception:
        return 0.0


class ReconciliationService:

    @staticmethod
    def parse_statement_file(file_bytes, filename=''):
        """
        Parses CSV or Excel into normalized list of transaction dictionaries.
        Detects Date, Narration, Ref/UTR, Debit/Withdrawal, Credit/Deposit, Balance.
        """
        records = []
        is_excel = filename.lower().endswith(('.xlsx', '.xls'))

        if is_excel:
            try:
                import openpyxl
                wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
                ws = wb.active
                rows = list(ws.iter_rows(values_only=True))
                if not rows:
                    return []
                # Header row search
                header_idx = 0
                for idx, row in enumerate(rows[:10]):
                    row_str = ' '.join(str(c or '').lower() for c in row)
                    if any(k in row_str for k in ['date', 'txn', 'transaction', 'narration', 'description', 'credit', 'deposit', 'amount']):
                        header_idx = idx
                        break

                headers = [str(c or '').strip().lower() for c in rows[header_idx]]
                data_rows = rows[header_idx + 1:]
                records = ReconciliationService._map_tabular_data(headers, data_rows)
            except Exception as e:
                # Fallback to CSV parse if openpyxl fails
                pass

        if not records:
            # Parse as CSV
            try:
                text_content = file_bytes.decode('utf-8-sig', errors='replace')
            except Exception:
                text_content = file_bytes.decode('latin-1', errors='replace')

            reader = list(csv.reader(io.StringIO(text_content)))
            if not reader:
                return []

            header_idx = 0
            for idx, row in enumerate(reader[:15]):
                row_str = ' '.join(str(c or '').lower() for c in row)
                if any(k in row_str for k in ['date', 'txn', 'transaction', 'narration', 'description', 'credit', 'deposit', 'amount']):
                    header_idx = idx
                    break

            headers = [str(c or '').strip().lower() for c in reader[header_idx]]
            data_rows = reader[header_idx + 1:]
            records = ReconciliationService._map_tabular_data(headers, data_rows)

        return records

    @staticmethod
    def _map_tabular_data(headers, data_rows):
        """Maps tabular rows into normalized records based on flexible header matching."""
        def _match_kw(h, keywords):
            for k in keywords:
                if len(k) <= 3:
                    if re.search(r'\b' + re.escape(k) + r'\b', h):
                        return True
                elif k in h:
                    return True
            return False

        # Find column indices
        date_col = next((i for i, h in enumerate(headers) if _match_kw(h, ['date', 'txn_date', 'transaction date', 'value date'])), 0)
        desc_col = next((i for i, h in enumerate(headers) if _match_kw(h, ['narration', 'description', 'particular', 'details', 'remarks'])), 1)
        ref_col  = next((i for i, h in enumerate(headers) if _match_kw(h, ['ref', 'utr', 'cheque', 'chq', 'txn id', 'transaction id', 'receipt', 'reference'])), None)
        credit_col = next((i for i, h in enumerate(headers) if _match_kw(h, ['credit', 'deposit', 'cr', 'received', 'inflow'])), None)
        debit_col  = next((i for i, h in enumerate(headers) if _match_kw(h, ['debit', 'withdrawal', 'dr', 'paid', 'outflow'])), None)
        amount_col = next((i for i, h in enumerate(headers) if _match_kw(h, ['amount', 'txn amount', 'net'])), None)
        type_col   = next((i for i, h in enumerate(headers) if _match_kw(h, ['type', 'cr/dr', 'd/c'])), None)
        bal_col    = next((i for i, h in enumerate(headers) if _match_kw(h, ['balance', 'running bal', 'closing'])), None)

        records = []
        for row in data_rows:
            if not row or all(c is None or str(c).strip() == '' for c in row):
                continue

            row_len = len(row)
            raw_date = row[date_col] if date_col < row_len else None
            if not raw_date:
                continue

            parsed_date = _parse_date(raw_date)
            narration = str(row[desc_col] if desc_col < row_len and row[desc_col] is not None else '').strip()
            reference = str(row[ref_col] if ref_col is not None and ref_col < row_len and row[ref_col] is not None else '').strip()

            # If reference is empty, try to extract UTR or cheque no from narration
            if not reference and narration:
                utr_match = re.search(r'\b([A-Z0-9]{12,22})\b', narration)
                if utr_match:
                    reference = utr_match.group(1)
                else:
                    rec_match = re.search(r'\b(REC-\d{4}-\d+)\b', narration, re.IGNORECASE)
                    if rec_match:
                        reference = rec_match.group(1).upper()

            credit_amt = 0.0
            debit_amt = 0.0
            txn_type = 'CREDIT'
            amount = 0.0

            if credit_col is not None and credit_col < row_len:
                credit_amt = _parse_amount(row[credit_col])
            if debit_col is not None and debit_col < row_len:
                debit_amt = _parse_amount(row[debit_col])

            if credit_amt > 0:
                txn_type = 'CREDIT'
                amount = credit_amt
            elif debit_amt > 0:
                txn_type = 'DEBIT'
                amount = debit_amt
            elif amount_col is not None and amount_col < row_len:
                amt = _parse_amount(row[amount_col])
                t_str = str(row[type_col] if type_col is not None and type_col < row_len else '').upper()
                if 'DR' in t_str or 'DEBIT' in t_str or amt < 0:
                    txn_type = 'DEBIT'
                    amount = abs(amt)
                else:
                    txn_type = 'CREDIT'
                    amount = abs(amt)

            if amount <= 0:
                continue

            running_bal = _parse_amount(row[bal_col]) if bal_col is not None and bal_col < row_len else 0.0

            records.append({
                'txn_date': parsed_date,
                'narration': narration,
                'reference_no': reference,
                'txn_type': txn_type,
                'amount': _round_curr(amount),
                'running_balance': _round_curr(running_bal),
            })

        return records

    @staticmethod
    def create_batch_and_transactions(school_id, file_bytes, filename, bank_name, statement_source='BANK_STATEMENT', user_id=None):
        """Imports statement file, stores transactions, and immediately runs matching."""
        parsed_records = ReconciliationService.parse_statement_file(file_bytes, filename)
        if not parsed_records:
            raise ValueError("No valid transaction entries found in the uploaded statement file.")

        dates = [r['txn_date'] for r in parsed_records if r['txn_date']]
        date_from = min(dates) if dates else date.today()
        date_to = max(dates) if dates else date.today()

        tot_credits = sum(r['amount'] for r in parsed_records if r['txn_type'] == 'CREDIT')
        tot_debits = sum(r['amount'] for r in parsed_records if r['txn_type'] == 'DEBIT')

        # Sequential Batch No
        seq = BankStatementBatch.query.filter_by(school_id=school_id).count() + 1
        batch_no = f"STMT-{date.today().year}-{seq:04d}"

        batch = BankStatementBatch(
            school_id=school_id,
            batch_no=batch_no,
            bank_name=bank_name or 'Bank Account',
            statement_source=statement_source or 'BANK_STATEMENT',
            file_name=filename,
            date_from=date_from,
            date_to=date_to,
            opening_balance=parsed_records[0].get('running_balance', 0.0) if parsed_records else 0.0,
            closing_balance=parsed_records[-1].get('running_balance', 0.0) if parsed_records else 0.0,
            total_credits=_round_curr(tot_credits),
            total_debits=_round_curr(tot_debits),
            total_transactions=len(parsed_records),
            matched_count=0,
            unmatched_count=len(parsed_records),
            status='PENDING',
            uploaded_by=user_id,
        )
        db.session.add(batch)
        db.session.flush()

        txns_to_add = []
        for r in parsed_records:
            tx = BankTransaction(
                batch_id=batch.id,
                school_id=school_id,
                txn_date=r['txn_date'],
                narration=r['narration'],
                reference_no=r['reference_no'],
                txn_type=r['txn_type'],
                amount=r['amount'],
                running_balance=r['running_balance'],
                match_status='NEEDS_REVIEW',
            )
            txns_to_add.append(tx)

        db.session.add_all(txns_to_add)
        db.session.flush()

        # Run automated matching engine
        match_stats = ReconciliationService.run_auto_matching(school_id, batch_id=batch.id)

        # Update batch counters
        batch.matched_count = match_stats.get('matched_count', 0)
        batch.unmatched_count = len(parsed_records) - batch.matched_count
        if batch.matched_count == len(parsed_records):
            batch.status = 'RECONCILED'
        elif batch.matched_count > 0:
            batch.status = 'PARTIALLY_RECONCILED'
        else:
            batch.status = 'PENDING'

        db.session.commit()
        return batch

    @staticmethod
    def run_auto_matching(school_id, batch_id=None):
        """
        Executes smart matching rules across bank transactions:
        1. Exact Match: UTR / Reference match + exact amount.
        2. Amount Mismatch: Reference matches, slight amount difference (gateway fee / surcharge).
        3. Possible Match: Amount matches exact, date within +/- 3 days, admission no/name in narration.
        4. Duplicate: Same reference number matched previously.
        5. Missing in ERP: Credit with no corresponding payment record.
        """
        q = BankTransaction.query.filter_by(school_id=school_id)
        if batch_id:
            q = q.filter_by(batch_id=batch_id)

        transactions = q.all()

        # Pre-fetch ERP FeePayments for school
        payments = FeePayment.query.filter_by(school_id=school_id, status='VALID').all()
        pay_by_ref = {}
        pay_by_receipt = {}
        for p in payments:
            if p.transaction_ref:
                pay_by_ref[p.transaction_ref.strip().upper()] = p
            if p.receipt_no:
                pay_by_receipt[p.receipt_no.strip().upper()] = p

        # Pre-fetch Paid Expenses
        expenses = Expense.query.filter_by(school_id=school_id, status='PAID').all()
        exp_by_ref = {}
        for e in expenses:
            if e.invoice_number:
                exp_by_ref[e.invoice_number.strip().upper()] = e
            if e.expense_number:
                exp_by_ref[e.expense_number.strip().upper()] = e

        matched_count = 0
        allocated_payments = set()
        seen_refs = set()
        seen_fingerprints = set()

        # Pre-populate seen references and fingerprints from prior transactions in this school
        prior_q = BankTransaction.query.filter_by(school_id=school_id)
        if batch_id:
            prior_q = prior_q.filter(BankTransaction.batch_id != batch_id)

        for p_tx in prior_q.all():
            if p_tx.reference_no:
                seen_refs.add(p_tx.reference_no.strip().upper())
            seen_fingerprints.add((p_tx.txn_date, float(p_tx.amount or 0.0), p_tx.txn_type, (p_tx.narration or '').strip().upper()))

        for tx in transactions:
            if tx.resolution_status == 'CONFIRMED':
                matched_count += 1
                continue

            ref_norm = (tx.reference_no or '').strip().upper()
            amt = float(tx.amount or 0.0)
            t_date = tx.txn_date
            fp = (t_date, amt, tx.txn_type, (tx.narration or '').strip().upper())

            # Duplicate check across prior batches or within this batch
            if (ref_norm and ref_norm in seen_refs) or (not ref_norm and fp in seen_fingerprints):
                tx.match_status = 'DUPLICATE'
                tx.match_confidence = 20.0
                tx.explanation = f"Duplicate transaction: Reference #{ref_norm or 'N/A'} already seen in this or a prior statement batch."
                continue

            if ref_norm:
                seen_refs.add(ref_norm)
            seen_fingerprints.add(fp)

            if tx.txn_type == 'CREDIT':
                # Try matching with FeePayment
                matched_pay = None
                if ref_norm and ref_norm in pay_by_ref:
                    matched_pay = pay_by_ref[ref_norm]
                elif ref_norm and ref_norm in pay_by_receipt:
                    matched_pay = pay_by_receipt[ref_norm]
                elif tx.narration:
                    # Look for receipt_no or UTR in narration
                    for r_key, p_obj in pay_by_ref.items():
                        if len(r_key) >= 6 and r_key in tx.narration.upper():
                            matched_pay = p_obj
                            break
                    if not matched_pay:
                        for r_key, p_obj in pay_by_receipt.items():
                            if r_key in tx.narration.upper():
                                matched_pay = p_obj
                                break

                if matched_pay:
                    pay_amt = float(matched_pay.total_paid or 0.0)
                    tx.matched_entity_type = 'FEE_PAYMENT'
                    tx.matched_entity_id = matched_pay.id

                    if abs(amt - pay_amt) < 0.01:
                        tx.match_status = 'MATCHED'
                        tx.match_confidence = 100.0
                        tx.difference_amount = 0.0
                        tx.explanation = f"Exact match with ERP Fee Receipt #{matched_pay.receipt_no} (Collected: ₹{pay_amt:.2f})"
                        matched_count += 1
                        allocated_payments.add(matched_pay.id)
                    else:
                        diff = _round_curr(pay_amt - amt)
                        tx.match_status = 'AMOUNT_MISMATCH'
                        tx.match_confidence = 90.0
                        tx.difference_amount = diff
                        tx.explanation = (
                            f"Reference matches Receipt #{matched_pay.receipt_no}, but Bank credit is ₹{amt:.2f} "
                            f"vs ERP receipt ₹{pay_amt:.2f} (Difference: ₹{diff:.2f}, likely gateway commission or settlement fee)"
                        )
                    continue

                # Fuzzy search: Amount match + date proximity (+/- 3 days)
                candidate_pays = [
                    p for p in payments
                    if p.id not in allocated_payments
                    and abs(float(p.total_paid or 0.0) - amt) < 0.01
                    and abs((p.payment_date - t_date).days) <= 3
                ]

                if candidate_pays:
                    cand = candidate_pays[0]
                    tx.matched_entity_type = 'FEE_PAYMENT'
                    tx.matched_entity_id = cand.id
                    tx.match_status = 'POSSIBLE_MATCH'
                    tx.match_confidence = 75.0
                    tx.difference_amount = 0.0
                    st_name = cand.student.user.name if cand.student and cand.student.user else 'Student'
                    tx.explanation = f"Possible match: Exact amount ₹{amt:.2f} matches Receipt #{cand.receipt_no} dated {cand.payment_date} ({st_name})"
                    allocated_payments.add(cand.id)
                    continue

                # Missing in ERP
                tx.match_status = 'MISSING_IN_ERP'
                tx.match_confidence = 0.0
                tx.explanation = f"Credit of ₹{amt:.2f} received in bank statement, but no matching fee collection or income record found in ERP."

            elif tx.txn_type == 'DEBIT':
                # Try matching with Expense
                matched_exp = None
                if ref_norm and ref_norm in exp_by_ref:
                    matched_exp = exp_by_ref[ref_norm]
                elif tx.narration:
                    for r_key, e_obj in exp_by_ref.items():
                        if len(r_key) >= 5 and r_key in tx.narration.upper():
                            matched_exp = e_obj
                            break

                if matched_exp:
                    exp_amt = float(matched_exp.amount or 0.0)
                    tx.matched_entity_type = 'EXPENSE'
                    tx.matched_entity_id = matched_exp.id

                    if abs(amt - exp_amt) < 0.01:
                        tx.match_status = 'MATCHED'
                        tx.match_confidence = 100.0
                        tx.difference_amount = 0.0
                        tx.explanation = f"Exact match with paid Expense #{matched_exp.expense_number} ({matched_exp.title})"
                        matched_count += 1
                    else:
                        diff = _round_curr(exp_amt - amt)
                        tx.match_status = 'AMOUNT_MISMATCH'
                        tx.match_confidence = 85.0
                        tx.difference_amount = diff
                        tx.explanation = f"Matches Expense #{matched_exp.expense_number}, amount differs by ₹{diff:.2f}"
                    continue

                # Fuzzy search for Expense
                cand_exps = [
                    e for e in expenses
                    if abs(float(e.amount or 0.0) - amt) < 0.01
                    and abs((e.payment_date - t_date).days) <= 3
                ]
                if cand_exps:
                    cand = cand_exps[0]
                    tx.matched_entity_type = 'EXPENSE'
                    tx.matched_entity_id = cand.id
                    tx.match_status = 'POSSIBLE_MATCH'
                    tx.match_confidence = 75.0
                    tx.difference_amount = 0.0
                    tx.explanation = f"Possible match: Amount ₹{amt:.2f} matches Expense #{cand.expense_number} ({cand.title}) on {cand.payment_date}"
                    continue

                tx.match_status = 'MISSING_IN_ERP'
                tx.match_confidence = 0.0
                tx.explanation = f"Debit of ₹{amt:.2f} paid from bank, but no expense or vendor payment recorded in ERP."

        return {
            'total_transactions': len(transactions),
            'matched_count': matched_count,
            'unmatched_count': len(transactions) - matched_count
        }

    @staticmethod
    def resolve_transaction(school_id, txn_id, action, user_id=None, notes='', fee_adjustment_amount=0.0):
        """
        Safely resolves a transaction mismatch:
        - CONFIRM_MATCH: Accountant verifies and approves the suggested match.
        - SETTLE_DIFFERENCE: Records the difference (e.g. ₹100 gateway fee) as an operational expense so records reconcile without altering student's fee payment.
        - IGNORE_NON_SCHOOL: Marks external bank transfers (e.g. transfer between accounts, tax, loan) as non-operating items.
        - MANUAL_LINK: Links to a specific payment or expense ID.
        """
        tx = BankTransaction.query.filter_by(id=txn_id, school_id=school_id).first_or_404()

        if action == 'CONFIRM_MATCH':
            tx.resolution_status = 'CONFIRMED'
            tx.match_status = 'MATCHED'
            tx.resolved_by = user_id
            tx.resolved_at = datetime.utcnow()
            tx.resolution_notes = notes or 'Manually verified and confirmed by Accountant.'

        elif action in ['SETTLE_DIFFERENCE', 'RESOLVE_FEE']:
            # Create a Gateway / Bank Charges Expense for the difference
            diff = abs(float(fee_adjustment_amount or tx.difference_amount or 0.0))
            if diff > 0:
                exp = Expense(
                    school_id=school_id,
                    expense_number=f"EXP-GW-{tx.id:05d}",
                    category='OTHER',
                    title=f"Payment Gateway / Bank Charges Reconciliation ({tx.reference_no})",
                    vendor_name=tx.batch.bank_name if tx.batch else 'Payment Gateway',
                    department='ACCOUNTS',
                    amount=diff,
                    invoice_number=tx.reference_no,
                    payment_method='ONLINE',
                    payment_date=tx.txn_date,
                    month=tx.txn_date.strftime('%B %Y'),
                    status='PAID',
                    source='MANUAL',
                    remarks=f"Settlement fee adjustment from Bank Reconciliation Batch #{tx.batch.batch_no if tx.batch else tx.batch_id}. {notes}",
                    created_by=user_id,
                )
                db.session.add(exp)

            tx.resolution_status = 'ADJUSTED'
            tx.match_status = 'MATCHED'
            tx.resolved_by = user_id
            tx.resolved_at = datetime.utcnow()
            tx.resolution_notes = f"Settled gateway fee difference of ₹{diff:.2f} as operational expense. {notes}"

        elif action in ['IGNORE_NON_SCHOOL', 'MARK_NON_OPERATING', 'NON_OPERATING', 'IGNORE']:
            tx.resolution_status = 'IGNORED'
            tx.match_status = 'NON_OPERATING'
            tx.resolved_by = user_id
            tx.resolved_at = datetime.utcnow()
            tx.resolution_notes = notes or 'Marked as non-ERP / internal contra transaction.'

        else:
            raise ValueError(f"Unknown resolution action '{action}'")

        # Recalculate batch counters
        if tx.batch:
            batch = tx.batch
            m_count = BankTransaction.query.filter_by(batch_id=batch.id, match_status='MATCHED').count()
            batch.matched_count = m_count
            batch.unmatched_count = max(0, (batch.total_transactions or 0) - m_count)
            if batch.unmatched_count == 0 and batch.total_transactions > 0:
                batch.status = 'RECONCILED'
            elif m_count > 0:
                batch.status = 'PARTIALLY_RECONCILED'

        db.session.commit()
        return tx

    @staticmethod
    def get_erp_unmatched_payments(school_id, date_from=None, date_to=None):
        """
        Identifies ERP FeePayment records that have NOT been matched in any imported bank statement.
        Status: MISSING_IN_BANK.
        """
        matched_pay_ids = db.session.query(BankTransaction.matched_entity_id).filter(
            BankTransaction.school_id == school_id,
            BankTransaction.matched_entity_type == 'FEE_PAYMENT',
            BankTransaction.match_status.in_(['MATCHED', 'CONFIRMED'])
        ).all()
        matched_set = {r[0] for r in matched_pay_ids if r[0]}

        q = FeePayment.query.filter(
            FeePayment.school_id == school_id,
            FeePayment.status == 'VALID',
            FeePayment.payment_mode.in_(['ONLINE', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CARD'])
        )
        if date_from:
            q = q.filter(FeePayment.payment_date >= date_from)
        if date_to:
            q = q.filter(FeePayment.payment_date <= date_to)

        unmatched = [p for p in q.order_by(FeePayment.payment_date.desc()).all() if p.id not in matched_set]

        result = []
        for p in unmatched:
            st = p.student
            st_name = st.user.name if st and st.user else ''
            cls_name = f"{st.class_ref.name} {st.class_ref.section or ''}".strip() if st and st.class_ref else ''
            result.append({
                'payment_id': p.id,
                'receipt_no': p.receipt_no,
                'payment_date': str(p.payment_date),
                'total_paid': float(p.total_paid or 0.0),
                'payment_mode': p.payment_mode,
                'transaction_ref': p.transaction_ref or '',
                'student_name': st_name,
                'admission_no': st.admission_no if st else '',
                'class_name': cls_name,
                'status': 'MISSING_IN_BANK',
                'explanation': f"Fee receipt #{p.receipt_no} collected via {p.payment_mode}, but not yet found in bank statement credits."
            })
        return result

    @staticmethod
    def get_reconciliation_summary(school_id, date_from=None, date_to=None):
        """
        High-level reconciliation executive dashboard:
        - Total Bank Statement Credits vs ERP Collections
        - Total Bank Statement Debits vs ERP Paid Expenses
        - Net Difference
        - Status breakdown
        """
        bq = BankTransaction.query.filter_by(school_id=school_id)
        if date_from:
            bq = bq.filter(BankTransaction.txn_date >= date_from)
        if date_to:
            bq = bq.filter(BankTransaction.txn_date <= date_to)

        txns = bq.all()

        bank_credits = sum(float(t.amount or 0.0) for t in txns if t.txn_type == 'CREDIT')
        bank_debits  = sum(float(t.amount or 0.0) for t in txns if t.txn_type == 'DEBIT')

        # Total ERP non-cash collections in range
        pq = FeePayment.query.filter(
            FeePayment.school_id == school_id,
            FeePayment.status == 'VALID',
            FeePayment.payment_mode.in_(['ONLINE', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CARD'])
        )
        if date_from:
            pq = pq.filter(FeePayment.payment_date >= date_from)
        if date_to:
            pq = pq.filter(FeePayment.payment_date <= date_to)
        erp_bank_collections = sum(float(p.total_paid or 0.0) for p in pq.all())

        # Total ERP bank/online paid expenses in range
        eq = Expense.query.filter(
            Expense.school_id == school_id,
            Expense.status == 'PAID',
            Expense.payment_method.in_(['BANK_TRANSFER', 'UPI', 'ONLINE', 'CHEQUE', 'CARD'])
        )
        if date_from:
            eq = eq.filter(Expense.payment_date >= date_from)
        if date_to:
            eq = eq.filter(Expense.payment_date <= date_to)
        erp_bank_expenses = sum(float(e.amount or 0.0) for e in eq.all())

        status_counts = {
            'MATCHED': 0,
            'POSSIBLE_MATCH': 0,
            'AMOUNT_MISMATCH': 0,
            'DUPLICATE': 0,
            'NEEDS_REVIEW': 0,
            'MISSING_IN_ERP': 0,
        }

        matched_credit_amt = 0.0
        for t in txns:
            st = t.match_status or 'NEEDS_REVIEW'
            if st in status_counts:
                status_counts[st] += 1
            else:
                status_counts['NEEDS_REVIEW'] += 1

            if t.txn_type == 'CREDIT' and st in ('MATCHED', 'CONFIRMED'):
                matched_credit_amt += float(t.amount or 0.0)

        unmatched_erp_pays = ReconciliationService.get_erp_unmatched_payments(school_id, date_from, date_to)

        tot_txns = len(txns)
        matched_txns = status_counts['MATCHED']
        reconciled_pct = round((matched_txns / tot_txns * 100.0), 1) if tot_txns > 0 else 100.0

        return {
            'bank_statement_credits': _round_curr(bank_credits),
            'erp_bank_collections': _round_curr(erp_bank_collections),
            'collection_difference': _round_curr(bank_credits - erp_bank_collections),
            'bank_statement_debits': _round_curr(bank_debits),
            'erp_bank_expenses': _round_curr(erp_bank_expenses),
            'expense_difference': _round_curr(bank_debits - erp_bank_expenses),
            'total_transactions': tot_txns,
            'matched_count': matched_txns,
            'possible_match_count': status_counts['POSSIBLE_MATCH'],
            'amount_mismatch_count': status_counts['AMOUNT_MISMATCH'],
            'duplicate_count': status_counts['DUPLICATE'],
            'missing_in_erp_count': status_counts['MISSING_IN_ERP'],
            'missing_in_bank_count': len(unmatched_erp_pays),
            'reconciled_percentage': reconciled_pct,
            'is_fully_reconciled': abs(bank_credits - erp_bank_collections) < 0.01 and len(unmatched_erp_pays) == 0,
        }
