"""
School Asset Management Service Engine
Handles:
1. Asset Registration (tag generation, specs, purchase info)
2. Asset Assignments & Location Transfers with historical tracking
3. Periodic Condition Inspections & Logs
4. Asset Maintenance linked directly to Finance Expenses
5. Asset Warranty Tracking & Expiration Alerts
6. Asset Disposal & Retirement (historical records preserved)
"""

from datetime import date, datetime
from app import db
from app.models.finance import (
    SchoolAsset, AssetAssignmentHistory,
    AssetConditionLog, AssetMaintenanceRecord,
    Expense
)


def create_asset(school_id, data, user=None):
    """
    Manually creates a new individual school asset.
    data: dict containing name, category, serial_number, model_number, brand, purchase_cost,
          purchase_date, vendor_id, vendor_name, invoice_no, warranty_start, warranty_end,
          location, department, notes.
    """
    category = data.get('category', 'OTHER')
    cat_short = (category[:3] if category else 'AST').upper()
    existing_count = SchoolAsset.query.filter_by(school_id=school_id).count() + 1
    asset_tag = data.get('asset_tag') or f"AST-{cat_short}-{existing_count:04d}"

    p_date = date.fromisoformat(data['purchase_date']) if data.get('purchase_date') else date.today()
    w_start = date.fromisoformat(data['warranty_start']) if data.get('warranty_start') else None
    w_end = date.fromisoformat(data['warranty_end']) if data.get('warranty_end') else None

    asset = SchoolAsset(
        school_id=school_id,
        asset_tag=asset_tag,
        name=data.get('name', '').strip(),
        category=category,
        serial_number=data.get('serial_number', '').strip(),
        model_number=data.get('model_number', '').strip(),
        brand=data.get('brand', '').strip(),
        purchase_date=p_date,
        purchase_cost=float(data.get('purchase_cost', 0.0)),
        vendor_id=data.get('vendor_id'),
        vendor_name=data.get('vendor_name', '').strip(),
        invoice_no=data.get('invoice_no', '').strip(),
        warranty_start=w_start,
        warranty_end=w_end,
        location=data.get('location', 'Store / Unassigned').strip(),
        department=data.get('department', 'ADMIN').strip(),
        condition=data.get('condition', 'NEW'),
        status='AVAILABLE',
        notes=data.get('notes', '').strip(),
        created_by=user.id if user else None,
    )
    db.session.add(asset)
    db.session.commit()
    return asset


def assign_or_transfer_asset(asset_id, school_id, to_user_id=None, to_user_name='',
                             to_location='', to_department='', reason='', user=None):
    """
    Transfers or assigns an asset.
    Preserves historical assignment trail in AssetAssignmentHistory.
    """
    asset = SchoolAsset.query.filter_by(id=asset_id, school_id=school_id).first_or_404()

    from_user_id = asset.assigned_to_user_id
    from_user_name = asset.assigned_to_name
    from_location = asset.location

    # Record history
    history = AssetAssignmentHistory(
        asset_id=asset.id,
        from_user_id=from_user_id,
        from_user_name=from_user_name or 'Unassigned',
        to_user_id=to_user_id,
        to_user_name=to_user_name or 'Unassigned',
        from_location=from_location or '',
        to_location=to_location or asset.location,
        transfer_date=date.today(),
        transferred_by=user.id if user else None,
        reason=reason or f"Transferred to {to_user_name or to_location}",
    )
    db.session.add(history)

    # Update asset current assignment
    asset.assigned_to_user_id = to_user_id
    asset.assigned_to_name = to_user_name or ''
    asset.assigned_date = date.today() if to_user_id or to_user_name else None
    if to_location:
        asset.location = to_location
    if to_department:
        asset.department = to_department
    asset.status = 'ASSIGNED' if (to_user_id or to_user_name) else 'AVAILABLE'

    db.session.commit()
    return asset


def record_asset_condition(asset_id, school_id, new_condition, notes='', user=None):
    """
    Records condition inspection (New, Good, Fair, Damaged, Critical, Under Repair).
    """
    asset = SchoolAsset.query.filter_by(id=asset_id, school_id=school_id).first_or_404()
    prev_condition = asset.condition

    asset.condition = new_condition
    if new_condition in ['DAMAGED', 'CRITICAL']:
        asset.status = 'DAMAGED'

    log = AssetConditionLog(
        asset_id=asset.id,
        previous_condition=prev_condition,
        new_condition=new_condition,
        inspected_date=date.today(),
        inspected_by=user.id if user else None,
        notes=notes or '',
    )
    db.session.add(log)
    db.session.commit()
    return asset


def record_asset_maintenance(asset_id, school_id, title, description='', cost=0.0,
                             vendor_id=None, vendor_name='', performed_by='', user=None):
    """
    Records asset repair/maintenance and automatically creates an Expense in Central Finance.
    """
    asset = SchoolAsset.query.filter_by(id=asset_id, school_id=school_id).first_or_404()
    cost = float(cost or 0.0)

    maint = AssetMaintenanceRecord(
        school_id=school_id,
        asset_id=asset.id,
        maintenance_date=date.today(),
        title=title.strip(),
        description=description.strip(),
        vendor_id=vendor_id,
        vendor_name=vendor_name.strip(),
        cost=cost,
        performed_by=performed_by.strip(),
        status='COMPLETED',
        created_by=user.id if user else None,
    )
    db.session.add(maint)
    db.session.flush()

    # Automatically post maintenance expense to Central Finance if cost > 0
    if cost > 0:
        year = date.today().year
        exp_count = Expense.query.filter_by(school_id=school_id).count() + 1
        expense = Expense(
            school_id=school_id,
            expense_number=f"EXP-{year}-{exp_count:05d}",
            category='MAINTENANCE',
            title=f"Asset Maintenance — {asset.name} ({asset.asset_tag}): {title}",
            vendor_name=vendor_name or asset.vendor_name,
            department=asset.department or 'MAINTENANCE',
            amount=cost,
            payment_method='CASH',
            payment_date=date.today(),
            month=date.today().strftime('%B %Y'),
            status='PAID',
            source='ASSET_MAINTENANCE',
            source_ref_id=maint.id,
            remarks=f"Asset tag: {asset.asset_tag}. Details: {description}".strip(),
            created_by=user.id if user else None,
        )
        db.session.add(expense)
        db.session.flush()
        maint.expense_id = expense.id

    # Restore asset condition and status if repaired
    asset.condition = 'GOOD'
    asset.status = 'ASSIGNED' if asset.assigned_to_name else 'AVAILABLE'

    db.session.commit()
    return maint


def dispose_or_retire_asset(asset_id, school_id, disposal_method='RETIRED',
                            disposal_amount=0.0, reason='', user=None):
    """
    Retires or disposes of an asset while keeping historical record intact.
    """
    asset = SchoolAsset.query.filter_by(id=asset_id, school_id=school_id).first_or_404()
    asset.status = 'DISPOSED' if disposal_method == 'SCRAPPED' else 'RETIRED'
    asset.disposal_date = date.today()
    asset.disposal_method = disposal_method
    asset.disposal_amount = float(disposal_amount or 0.0)
    asset.disposal_reason = reason.strip()

    db.session.commit()
    return asset


def get_assets_summary(school_id):
    """
    Executive statistics for school assets.
    """
    assets = SchoolAsset.query.filter_by(school_id=school_id).all()
    total_assets = len(assets)
    assigned_count = sum(1 for a in assets if a.status == 'ASSIGNED')
    under_repair_count = sum(1 for a in assets if a.status in ['UNDER_MAINTENANCE', 'IN_REPAIR', 'DAMAGED'])
    warranty_expiring_count = sum(1 for a in assets if a.is_warranty_expiring_soon)
    disposed_count = sum(1 for a in assets if a.status in ['DISPOSED', 'RETIRED', 'LOST'])
    total_asset_value = sum(a.purchase_cost for a in assets if a.status not in ['DISPOSED', 'RETIRED'])

    return {
        'total_assets': total_assets,
        'assigned_count': assigned_count,
        'available_count': total_assets - assigned_count - under_repair_count - disposed_count,
        'under_repair_count': under_repair_count,
        'warranty_expiring_count': warranty_expiring_count,
        'disposed_count': disposed_count,
        'total_asset_value': round(total_asset_value, 2),
    }
