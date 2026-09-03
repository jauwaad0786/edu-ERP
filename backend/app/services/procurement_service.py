"""
Procurement & Inventory Service Engine
Handles:
1. Purchase Orders (PO generation, approvals, status updates)
2. Goods Receipt Notes (GRN arrival, partial/full receipts, rejected quantities)
3. Automatic stock movement & inventory increments for consumables
4. Automatic SchoolAsset generation for capital equipment (1 per received unit)
5. Vendor Bills & Payments (with partial payment tracking & auto-sync to Finance Expenses)
6. Inventory Issues (to classes, teachers, departments) and Audited Stock Adjustments
"""

from datetime import date, datetime
from app import db
from app.models.finance import (
    Vendor, InventoryItem, StockMovement,
    PurchaseOrder, PurchaseOrderItem,
    GoodsReceiptNote, GoodsReceiptItem,
    VendorBill, VendorPayment,
    SchoolAsset, Expense
)


def create_purchase_order(school_id, vendor_id, items_data, target_type='INVENTORY',
                          expected_delivery_date=None, notes='', user=None):
    """
    Creates a new Purchase Order in PENDING_APPROVAL status.
    items_data: list of dicts: [{item_name, category, sku, unit, ordered_qty, unit_price, tax_pct, is_asset}]
    """
    vendor = Vendor.query.filter_by(id=vendor_id, school_id=school_id).first()
    if not vendor:
        raise ValueError(f"Vendor with ID {vendor_id} not found.")

    if not items_data:
        raise ValueError("Purchase order must have at least one line item.")

    # Generate sequential PO number
    year = date.today().year
    count = PurchaseOrder.query.filter_by(school_id=school_id).count() + 1
    po_number = f"PO-{year}-{count:04d}"

    # Calculate totals
    subtotal = 0.0
    tax_total = 0.0
    for itm in items_data:
        qty = int(itm.get('ordered_qty', 1))
        price = float(itm.get('unit_price', 0.0))
        tax = float(itm.get('tax_pct', 0.0))
        line_sub = round(qty * price, 2)
        line_tax = round(line_sub * (tax / 100.0), 2)
        subtotal += line_sub
        tax_total += line_tax

    total_amount = round(subtotal + tax_total, 2)

    po = PurchaseOrder(
        school_id=school_id,
        po_number=po_number,
        vendor_id=vendor_id,
        order_date=date.today(),
        expected_delivery_date=expected_delivery_date,
        status='PENDING_APPROVAL',
        target_type=target_type,
        subtotal=subtotal,
        tax_amount=tax_total,
        total_amount=total_amount,
        notes=notes or '',
        created_by=user.id if user else None,
    )
    db.session.add(po)
    db.session.flush()

    for itm in items_data:
        qty = int(itm.get('ordered_qty', 1))
        price = float(itm.get('unit_price', 0.0))
        tax = float(itm.get('tax_pct', 0.0))
        line_total = round(qty * price * (1.0 + tax / 100.0), 2)

        po_item = PurchaseOrderItem(
            purchase_order_id=po.id,
            item_name=itm.get('item_name', '').strip(),
            category=itm.get('category', 'OTHER'),
            sku=itm.get('sku', '').strip(),
            unit=itm.get('unit', 'PIECES'),
            ordered_qty=qty,
            received_qty=0,
            unit_price=price,
            tax_pct=tax,
            total_price=line_total,
            is_asset=bool(itm.get('is_asset', False) or target_type == 'ASSET'),
        )
        db.session.add(po_item)

    db.session.commit()
    return po


def approve_purchase_order(po_id, school_id, user):
    """Approves a pending Purchase Order."""
    po = PurchaseOrder.query.filter_by(id=po_id, school_id=school_id).first_or_404()
    if po.status not in ['DRAFT', 'PENDING_APPROVAL']:
        raise ValueError(f"Cannot approve PO with status {po.status}")

    po.status = 'APPROVED'
    po.approved_by = user.id if user else None
    po.approved_at = datetime.utcnow()
    db.session.commit()
    return po


def cancel_purchase_order(po_id, school_id, user, reason=''):
    """Cancels a Purchase Order."""
    po = PurchaseOrder.query.filter_by(id=po_id, school_id=school_id).first_or_404()
    if po.status in ['RECEIVED']:
        raise ValueError("Cannot cancel an already received purchase order.")

    po.status = 'CANCELLED'
    if reason:
        po.notes = f"{po.notes}\nCancellation reason: {reason}".strip()
    db.session.commit()
    return po


def process_goods_receipt(po_id, school_id, received_items, challan_no='', notes='', user=None):
    """
    Records Goods Receipt Note (GRN).
    received_items: list of dicts: [{po_item_id, received_qty, rejected_qty, rejection_reason}]
    
    CRITICAL BEHAVIOR:
    - Only received quantity enters stock.
    - If item is consumable: updates or creates InventoryItem and logs StockMovement(type='PURCHASE').
    - If item is asset: automatically generates N individual SchoolAsset records!
    - Automatically creates a VendorBill for the verified received amount.
    """
    po = PurchaseOrder.query.filter_by(id=po_id, school_id=school_id).first_or_404()
    if po.status not in ['APPROVED', 'PARTIALLY_RECEIVED']:
        raise ValueError(f"Cannot receive goods for PO with status {po.status}. PO must be APPROVED first.")

    year = date.today().year
    grn_count = GoodsReceiptNote.query.filter_by(school_id=school_id).count() + 1
    grn_number = f"GRN-{year}-{grn_count:04d}"

    grn = GoodsReceiptNote(
        school_id=school_id,
        grn_number=grn_number,
        purchase_order_id=po.id,
        vendor_id=po.vendor_id,
        receipt_date=date.today(),
        challan_no=challan_no or '',
        status='VERIFIED',
        received_by=user.id if user else None,
        notes=notes or '',
    )
    db.session.add(grn)
    db.session.flush()

    total_bill_amount = 0.0
    all_completed = True

    po_items_by_id = {item.id: item for item in po.items}

    for r_entry in received_items:
        po_item_id = r_entry.get('po_item_id')
        po_item = po_items_by_id.get(po_item_id)
        if not po_item:
            continue

        r_qty = int(r_entry.get('received_qty', 0))
        rej_qty = int(r_entry.get('rejected_qty', 0))
        rej_reason = r_entry.get('rejection_reason', '')

        if r_qty <= 0 and rej_qty <= 0:
            continue

        po_item.received_qty = (po_item.received_qty or 0) + r_qty
        if po_item.received_qty < po_item.ordered_qty:
            all_completed = False

        val_sub = round(r_qty * po_item.unit_price, 2)
        val_tax = round(val_sub * ((po_item.tax_pct or 0.0) / 100.0), 2)
        total_bill_amount += round(val_sub + val_tax, 2)

        # 1. Consumable Inventory Item flow
        inv_item = None
        if not po_item.is_asset:
            # Find matching item by name and category or create new
            inv_item = InventoryItem.query.filter_by(
                school_id=school_id, name=po_item.item_name, category=po_item.category
            ).first()

            if not inv_item:
                inv_count = InventoryItem.query.filter_by(school_id=school_id).count() + 1
                item_code = po_item.sku or f"ITM-{inv_count:04d}"
                inv_item = InventoryItem(
                    school_id=school_id,
                    item_code=item_code,
                    name=po_item.item_name,
                    category=po_item.category,
                    unit=po_item.unit or 'PIECES',
                    sku=po_item.sku,
                    vendor_id=po.vendor_id,
                    vendor_name=po.vendor.name if po.vendor else '',
                    quantity=0,
                    unit_price=po_item.unit_price,
                    purchase_date=date.today(),
                    condition='NEW',
                    status='ACTIVE',
                    created_by=user.id if user else None,
                )
                db.session.add(inv_item)
                db.session.flush()

            # Increase stock by verified received quantity only
            prev_stock = inv_item.quantity or 0
            new_stock = prev_stock + r_qty
            inv_item.quantity = new_stock
            inv_item.unit_price = po_item.unit_price

            movement = StockMovement(
                school_id=school_id,
                item_id=inv_item.id,
                movement_type='PURCHASE',
                quantity=r_qty,
                previous_stock=prev_stock,
                new_stock=new_stock,
                unit_price=po_item.unit_price,
                movement_date=date.today(),
                reference_no=grn_number,
                reason=f"Goods received via {po.po_number}",
                performed_by=user.id if user else None,
            )
            db.session.add(movement)

        # 2. Capital Asset Item flow: Automatically creates N individual SchoolAsset records
        else:
            cat_short = (po_item.category[:3] if po_item.category else 'AST').upper()
            existing_asset_count = SchoolAsset.query.filter_by(school_id=school_id).count()

            for i in range(1, r_qty + 1):
                asset_tag = f"AST-{cat_short}-{(existing_asset_count + i):04d}"
                asset = SchoolAsset(
                    school_id=school_id,
                    asset_tag=asset_tag,
                    name=po_item.item_name,
                    category=po_item.category,
                    brand='',
                    purchase_date=date.today(),
                    purchase_cost=po_item.unit_price,
                    vendor_id=po.vendor_id,
                    vendor_name=po.vendor.name if po.vendor else '',
                    invoice_no=challan_no or po.po_number,
                    location='Store / Unassigned',
                    department='ADMIN',
                    condition='NEW',
                    status='AVAILABLE',
                    notes=f"Auto-created from {po.po_number} via {grn_number}",
                    created_by=user.id if user else None,
                )
                db.session.add(asset)

        # Log receipt line item
        grn_item = GoodsReceiptItem(
            grn_id=grn.id,
            po_item_id=po_item.id,
            item_id=inv_item.id if inv_item else None,
            item_name=po_item.item_name,
            ordered_qty=po_item.ordered_qty,
            received_qty=r_qty,
            rejected_qty=rej_qty,
            unit_price=po_item.unit_price,
            rejection_reason=rej_reason or '',
        )
        db.session.add(grn_item)

    # Check overall PO completion
    po.status = 'RECEIVED' if all_completed else 'PARTIALLY_RECEIVED'

    # Create VendorBill for received goods
    bill_count = VendorBill.query.filter_by(school_id=school_id).count() + 1
    bill_number = f"VBILL-{year}-{bill_count:04d}"

    vendor_bill = VendorBill(
        school_id=school_id,
        bill_number=bill_number,
        vendor_id=po.vendor_id,
        purchase_order_id=po.id,
        grn_id=grn.id,
        bill_date=date.today(),
        due_date=date.today(),
        subtotal=total_bill_amount,
        tax_amount=0.0,
        total_amount=total_bill_amount,
        paid_amount=0.0,
        balance_amount=total_bill_amount,
        status='PENDING',
        notes=f"Auto-generated against {grn_number} ({po.po_number})",
        created_by=user.id if user else None,
    )
    db.session.add(vendor_bill)

    db.session.commit()
    return grn, vendor_bill


def record_vendor_bill_payment(bill_id, school_id, amount, payment_mode='BANK_TRANSFER',
                               reference_no='', notes='', user=None):
    """
    Records a payment against a vendor bill.
    Supports partial and full payment.
    Updates bill status (PARTIAL or PAID).
    Automatically logs an Expense under category INVENTORY_PURCHASE with source='VENDOR_BILL'.
    """
    bill = VendorBill.query.filter_by(id=bill_id, school_id=school_id).first_or_404()
    if bill.status == 'PAID':
        raise ValueError("Bill is already fully paid.")

    amount = float(amount)
    if amount <= 0:
        raise ValueError("Payment amount must be greater than zero.")

    rem_balance = round(bill.total_amount - (bill.paid_amount or 0.0), 2)
    if amount > rem_balance:
        raise ValueError(f"Payment amount ₹{amount} exceeds remaining bill balance of ₹{rem_balance}.")

    bill.paid_amount = round((bill.paid_amount or 0.0) + amount, 2)
    bill.balance_amount = round(bill.total_amount - bill.paid_amount, 2)
    bill.status = 'PAID' if bill.balance_amount <= 0.0 else 'PARTIAL'

    year = date.today().year
    pay_count = VendorPayment.query.filter_by(school_id=school_id).count() + 1
    payment_number = f"VPAY-{year}-{pay_count:04d}"

    v_pay = VendorPayment(
        school_id=school_id,
        payment_number=payment_number,
        vendor_id=bill.vendor_id,
        vendor_bill_id=bill.id,
        amount=amount,
        payment_date=date.today(),
        payment_mode=payment_mode,
        reference_no=reference_no or '',
        paid_by=user.id if user else None,
        notes=notes or '',
    )
    db.session.add(v_pay)
    db.session.flush()

    # Automatically post Expense to Central Finance
    exp_count = Expense.query.filter_by(school_id=school_id).count() + 1
    expense = Expense(
        school_id=school_id,
        expense_number=f"EXP-{year}-{exp_count:05d}",
        category='INVENTORY_PURCHASE',
        title=f"Vendor Bill Payment — {bill.vendor.name} ({bill.bill_number})",
        vendor_name=bill.vendor.name if bill.vendor else '',
        department='ACCOUNTS',
        amount=amount,
        invoice_number=bill.bill_number,
        payment_method=payment_mode,
        payment_date=date.today(),
        month=date.today().strftime('%B %Y'),
        status='PAID',
        source='VENDOR_BILL',
        source_ref_id=v_pay.id,
        remarks=f"Payment ref: {reference_no}. {notes}".strip(),
        created_by=user.id if user else None,
    )
    db.session.add(expense)

    db.session.commit()
    return v_pay


def issue_inventory_stock(item_id, school_id, quantity, issued_to_user_id=None,
                          issued_to_name='', department='', target_class_id=None,
                          class_name='', reason='', user=None):
    """
    Issues inventory items to a teacher, staff, student, class, or department.
    Automatically decreases current stock and logs a StockMovement(type='ISSUE').
    """
    item = InventoryItem.query.filter_by(id=item_id, school_id=school_id).first_or_404()
    quantity = int(quantity)
    if quantity <= 0:
        raise ValueError("Issue quantity must be greater than zero.")

    if (item.quantity or 0) < quantity:
        raise ValueError(f"Insufficient stock. Available: {item.quantity}, Requested: {quantity}")

    prev_stock = item.quantity or 0
    new_stock = prev_stock - quantity
    item.quantity = new_stock

    year = date.today().year
    iss_count = StockMovement.query.filter_by(school_id=school_id, movement_type='ISSUE').count() + 1
    reference_no = f"ISS-{year}-{iss_count:04d}"

    movement = StockMovement(
        school_id=school_id,
        item_id=item.id,
        movement_type='ISSUE',
        quantity=quantity,
        previous_stock=prev_stock,
        new_stock=new_stock,
        unit_price=item.unit_price,
        movement_date=date.today(),
        reference_no=reference_no,
        issued_to_user_id=issued_to_user_id,
        issued_to_name=issued_to_name or '',
        department=department or '',
        target_class_id=target_class_id,
        class_name=class_name or '',
        reason=reason or f"Stock issued to {issued_to_name or class_name or department}",
        performed_by=user.id if user else None,
    )
    db.session.add(movement)
    db.session.commit()
    return movement


def adjust_inventory_stock(item_id, school_id, adjustment_qty, reason, user=None):
    """
    Authorized stock adjustment with mandatory audit reason (e.g. damaged, physical audit diff).
    adjustment_qty can be positive (+5) or negative (-3).
    """
    item = InventoryItem.query.filter_by(id=item_id, school_id=school_id).first_or_404()
    adjustment_qty = int(adjustment_qty)
    if adjustment_qty == 0:
        raise ValueError("Adjustment quantity cannot be 0.")

    if not reason or not reason.strip():
        raise ValueError("A mandatory audit reason must be provided for stock adjustments.")

    prev_stock = item.quantity or 0
    new_stock = prev_stock + adjustment_qty
    if new_stock < 0:
        raise ValueError(f"Adjustment would result in negative stock ({new_stock}).")

    item.quantity = new_stock

    m_type = 'DAMAGE' if ('damage' in reason.lower() or 'broken' in reason.lower()) else 'ADJUSTMENT'
    year = date.today().year
    adj_count = StockMovement.query.filter_by(school_id=school_id, movement_type=m_type).count() + 1
    reference_no = f"ADJ-{year}-{adj_count:04d}"

    movement = StockMovement(
        school_id=school_id,
        item_id=item.id,
        movement_type=m_type,
        quantity=abs(adjustment_qty),
        previous_stock=prev_stock,
        new_stock=new_stock,
        unit_price=item.unit_price,
        movement_date=date.today(),
        reference_no=reference_no,
        reason=reason.strip(),
        performed_by=user.id if user else None,
    )
    db.session.add(movement)
    db.session.commit()
    return movement
