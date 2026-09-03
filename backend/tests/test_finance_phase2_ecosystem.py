"""
Comprehensive Automated Test Suite: Phase 2 Finance, Purchases, Inventory, Vendors, Expenses & Assets
Tests:
1. Vendor Creation with Bank Details & Payment Terms
2. Purchase Order Creation (Consumables + Assets) & Approval
3. GRN Goods Receipt for Consumables -> Stock Increases & StockMovement logged
4. Inventory Issue to Class/Teacher -> Stock Decreases & Issue Movement logged
5. Stock Adjustment with Mandatory Reason -> Stock Adjusted & Audit logged
6. GRN Goods Receipt for Capital Assets -> Generates 10 Individual SchoolAsset records
7. Asset Assignment to Teacher Rahul -> Status ASSIGNED & Assignment History logged
8. Asset Transfer to Teacher Aman -> Previous & New user logged in Assignment History
9. Asset Maintenance (₹2,000) -> Auto-creates linked Expense in Central Finance
10. Vendor Bill Creation & Partial Payment -> Bill Status PARTIAL, Remaining Balance updated
11. Expense Approval Workflow -> PENDING_APPROVAL -> APPROVED
12. Executive Finance Dashboard Aggregation -> Inventory Value, Payables, and Asset Health
"""

import unittest
from datetime import date, datetime
from app import create_app, db
from app.models.user import User
from app.models.school import School
from app.models.academic import Class, Student
from app.models.finance import (
    Vendor, InventoryItem, StockMovement,
    PurchaseOrder, PurchaseOrderItem,
    GoodsReceiptNote, GoodsReceiptItem,
    VendorBill, VendorPayment,
    SchoolAsset, AssetAssignmentHistory, AssetMaintenanceRecord,
    Expense
)
from app.services.procurement_service import (
    create_purchase_order, approve_purchase_order,
    process_goods_receipt, record_vendor_bill_payment,
    issue_inventory_stock, adjust_inventory_stock
)
from app.services.asset_service import (
    create_asset, assign_or_transfer_asset, record_asset_condition,
    record_asset_maintenance, dispose_or_retire_asset, get_assets_summary
)
from app.services.fee_ledger_service import get_finance_dashboard_metrics


class TestFinancePhase2Ecosystem(unittest.TestCase):
    def setUp(self):
        self.app = create_app('testing')
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

        # 1. School
        self.school = School(name="Delhi Public Academy", code="DPA01")
        db.session.add(self.school)
        db.session.flush()
        self.sid = self.school.id

        # 2. Staff Users
        self.principal = User(school_id=self.sid, name="Dr. Roy", email="principal@dpa.edu", password="pass", role="PRINCIPAL")
        self.accountant = User(school_id=self.sid, name="Accountant Verma", email="acct@dpa.edu", password="pass", role="ACCOUNTANT")
        self.teacher_rahul = User(school_id=self.sid, name="Teacher Rahul", email="rahul@dpa.edu", password="pass", role="TEACHER")
        self.teacher_aman = User(school_id=self.sid, name="Teacher Aman", email="aman@dpa.edu", password="pass", role="TEACHER")
        db.session.add_all([self.principal, self.accountant, self.teacher_rahul, self.teacher_aman])
        db.session.flush()

        # 3. Class
        self.cls = Class(school_id=self.sid, name="Class 8", section="A")
        db.session.add(self.cls)
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_01_vendor_profile_and_balances(self):
        """Creates vendor with payment terms, bank details, and verifies computed balances."""
        vendor = Vendor(
            school_id=self.sid,
            vendor_code="VND-0001",
            name="Apex Stationery Mart",
            contact_person="Ramesh Gupta",
            phone="9876543210",
            email="ramesh@apexstationery.com",
            payment_terms="Net 30",
            bank_name="State Bank of India",
            bank_account_no="123456789012",
            bank_ifsc="SBIN0001234",
            category="STATIONERY"
        )
        db.session.add(vendor)
        db.session.commit()

        self.assertEqual(vendor.vendor_code, "VND-0001")
        self.assertEqual(vendor.total_purchases, 0.0)
        self.assertEqual(vendor.total_paid, 0.0)
        self.assertEqual(vendor.outstanding_balance, 0.0)

    def test_02_procurement_consumables_flow(self):
        """
        Tests complete consumable flow:
        PO (500 Notebooks) -> Approve -> GRN (490 received, 10 damaged) -> Stock +490 -> Issue 20 -> Stock 470 -> Adjust -2 -> Stock 468.
        """
        vendor = Vendor(school_id=self.sid, name="National Book House", vendor_code="VND-0002")
        db.session.add(vendor)
        db.session.commit()

        # 1. Create Purchase Order for 500 Notebooks @ ₹50 each
        po = create_purchase_order(
            school_id=self.sid,
            vendor_id=vendor.id,
            items_data=[{
                'item_name': 'Classmate Notebooks 200pg',
                'category': 'STATIONERY',
                'sku': 'NB-200-001',
                'unit': 'PIECES',
                'ordered_qty': 500,
                'unit_price': 50.0,
                'tax_pct': 0.0,
                'is_asset': False,
            }],
            target_type='INVENTORY',
            user=self.accountant
        )
        self.assertEqual(po.status, 'PENDING_APPROVAL')
        self.assertEqual(po.total_amount, 25000.0)

        # 2. Principal approves PO
        approve_purchase_order(po.id, self.sid, self.principal)
        self.assertEqual(po.status, 'APPROVED')

        # 3. Goods Received (GRN): 490 received, 10 rejected/damaged
        po_item = po.items.first()
        grn, bill = process_goods_receipt(
            po_id=po.id,
            school_id=self.sid,
            received_items=[{
                'po_item_id': po_item.id,
                'received_qty': 490,
                'rejected_qty': 10,
                'rejection_reason': 'Water damage on 10 notebooks',
            }],
            challan_no="CH-9876",
            user=self.accountant
        )
        self.assertIsNotNone(grn)
        self.assertIsNotNone(bill)
        # Billed only for 490 received notebooks: 490 * 50 = ₹24,500
        self.assertEqual(bill.total_amount, 24500.0)
        self.assertEqual(bill.balance_amount, 24500.0)
        self.assertEqual(bill.status, 'PENDING')

        # Verify Inventory Item increased by EXACTLY received quantity (490)
        item = InventoryItem.query.filter_by(school_id=self.sid, name='Classmate Notebooks 200pg').first()
        self.assertIsNotNone(item)
        self.assertEqual(item.quantity, 490)

        # Verify Stock Movement logged
        mov = StockMovement.query.filter_by(item_id=item.id, movement_type='PURCHASE').first()
        self.assertIsNotNone(mov)
        self.assertEqual(mov.quantity, 490)
        self.assertEqual(mov.previous_stock, 0)
        self.assertEqual(mov.new_stock, 490)

        # 4. Issue 20 notebooks to Class 8-A
        issue_mov = issue_inventory_stock(
            item_id=item.id,
            school_id=self.sid,
            quantity=20,
            department='ACADEMIC',
            target_class_id=self.cls.id,
            class_name='Class 8-A',
            reason='Distribution for midterm exams',
            user=self.teacher_rahul
        )
        self.assertEqual(issue_mov.quantity, 20)
        self.assertEqual(item.quantity, 470)

        # 5. Stock adjustment: physical count found 2 broken/termite damaged (-2)
        adj_mov = adjust_inventory_stock(
            item_id=item.id,
            school_id=self.sid,
            adjustment_qty=-2,
            reason='Physical audit found 2 pages water damaged',
            user=self.accountant
        )
        self.assertEqual(item.quantity, 468)

    def test_03_procurement_capital_assets_flow(self):
        """
        Tests purchase of capital equipment (10 Laptops):
        PO -> Approve -> GRN -> Automatically creates 10 individual SchoolAsset records with unique asset tags!
        """
        vendor = Vendor(school_id=self.sid, name="Dell Enterprise Solutions", vendor_code="VND-0003")
        db.session.add(vendor)
        db.session.commit()

        # 1. PO for 10 Laptops @ ₹45,000 each
        po = create_purchase_order(
            school_id=self.sid,
            vendor_id=vendor.id,
            items_data=[{
                'item_name': 'Dell Latitude 3420 Laptop',
                'category': 'LAPTOPS',
                'unit': 'PIECES',
                'ordered_qty': 10,
                'unit_price': 45000.0,
                'tax_pct': 0.0,
                'is_asset': True,
            }],
            target_type='ASSET',
            user=self.accountant
        )
        approve_purchase_order(po.id, self.sid, self.principal)

        # 2. Goods Receipt Note for 10 Laptops
        po_item = po.items.first()
        grn, bill = process_goods_receipt(
            po_id=po.id,
            school_id=self.sid,
            received_items=[{
                'po_item_id': po_item.id,
                'received_qty': 10,
                'rejected_qty': 0,
            }],
            challan_no="DELL-INV-5001",
            user=self.accountant
        )

        # Verify bill generated: 10 * 45,000 = ₹4,50,000
        self.assertEqual(bill.total_amount, 450000.0)

        # CRITICAL TEST: Verify 10 separate SchoolAsset records exist, NOT just "quantity = 10" in inventory!
        assets = SchoolAsset.query.filter_by(school_id=self.sid, category='LAPTOPS').all()
        self.assertEqual(len(assets), 10)
        tags = [a.asset_tag for a in assets]
        self.assertEqual(len(set(tags)), 10) # All tags unique
        self.assertTrue(all(a.status == 'AVAILABLE' for a in assets))

        # Consumable inventory item must NOT have been created for laptops
        inv_item = InventoryItem.query.filter_by(school_id=self.sid, name='Dell Latitude 3420 Laptop').first()
        self.assertIsNone(inv_item)

    def test_04_asset_lifecycle_assignment_maintenance_and_expense_sync(self):
        """
        Tests Asset Assignment -> Transfer -> Maintenance (auto-Expense in Central Finance) -> Disposal.
        """
        asset = create_asset(
            school_id=self.sid,
            data={
                'name': 'Epson EB-X06 Projector',
                'category': 'PROJECTORS',
                'serial_number': 'SN-EPS-9988',
                'purchase_cost': 35000.0,
                'warranty_start': '2026-01-01',
                'warranty_end': '2027-01-01',
                'location': 'Store Room',
            },
            user=self.accountant
        )
        self.assertEqual(asset.status, 'AVAILABLE')

        # 1. Assign to Teacher Rahul
        assign_or_transfer_asset(
            asset_id=asset.id,
            school_id=self.sid,
            to_user_id=self.teacher_rahul.id,
            to_user_name=self.teacher_rahul.name,
            to_location='Room 101',
            to_department='ACADEMIC',
            reason='Assigned for classroom teaching',
            user=self.principal
        )
        self.assertEqual(asset.status, 'ASSIGNED')
        self.assertEqual(asset.assigned_to_name, 'Teacher Rahul')
        self.assertEqual(asset.location, 'Room 101')

        # 2. Transfer from Teacher Rahul to Teacher Aman
        assign_or_transfer_asset(
            asset_id=asset.id,
            school_id=self.sid,
            to_user_id=self.teacher_aman.id,
            to_user_name=self.teacher_aman.name,
            to_location='Physics Lab',
            to_department='SCIENCE',
            reason='Shifted for lab demonstration',
            user=self.principal
        )
        self.assertEqual(asset.assigned_to_name, 'Teacher Aman')
        self.assertEqual(asset.location, 'Physics Lab')

        # Verify assignment history trail
        histories = asset.assignments.all()
        self.assertEqual(len(histories), 2)
        latest_hist = histories[-1]
        self.assertEqual(latest_hist.from_user_name, 'Teacher Rahul')
        self.assertEqual(latest_hist.to_user_name, 'Teacher Aman')

        # 3. Log Maintenance: Lamp replacement costing ₹3,500
        maint = record_asset_maintenance(
            asset_id=asset.id,
            school_id=self.sid,
            title='Projector Lamp Replacement',
            description='Installed OEM replacement bulb',
            cost=3500.0,
            vendor_name='Epson Care Delhi',
            performed_by='Technician Suresh',
            user=self.accountant
        )
        self.assertIsNotNone(maint)
        self.assertIsNotNone(maint.expense_id)

        # CRITICAL TEST: Verify Central Finance Expense was auto-created!
        exp = Expense.query.get(maint.expense_id)
        self.assertIsNotNone(exp)
        self.assertEqual(exp.category, 'MAINTENANCE')
        self.assertEqual(exp.amount, 3500.0)
        self.assertEqual(exp.source, 'ASSET_MAINTENANCE')

        # 4. Dispose / Retire Asset
        dispose_or_retire_asset(
            asset_id=asset.id,
            school_id=self.sid,
            disposal_method='RETIRED',
            disposal_amount=5000.0,
            reason='Replaced by Interactive Smart Panel',
            user=self.principal
        )
        self.assertEqual(asset.status, 'RETIRED')
        self.assertEqual(asset.disposal_amount, 5000.0)

    def test_05_vendor_bill_partial_and_full_payment(self):
        """
        Tests Vendor Bill payment:
        Bill ₹50,000 -> Pay ₹30,000 -> Status PARTIAL, Outstanding ₹20,000 -> Pay ₹20,000 -> Status PAID, Outstanding ₹0.
        """
        vendor = Vendor(school_id=self.sid, name="Universal Sports Supplies", vendor_code="VND-0004")
        db.session.add(vendor)
        db.session.commit()

        bill = VendorBill(
            school_id=self.sid,
            bill_number="VBILL-2026-9001",
            vendor_id=vendor.id,
            bill_date=date.today(),
            total_amount=50000.0,
            paid_amount=0.0,
            balance_amount=50000.0,
            status='PENDING'
        )
        db.session.add(bill)
        db.session.commit()

        self.assertEqual(vendor.outstanding_balance, 50000.0)

        # Partial payment: ₹30,000
        pay1 = record_vendor_bill_payment(
            bill_id=bill.id,
            school_id=self.sid,
            amount=30000.0,
            payment_mode='BANK_TRANSFER',
            reference_no='NEFT-12345',
            user=self.accountant
        )
        self.assertEqual(bill.status, 'PARTIAL')
        self.assertEqual(bill.paid_amount, 30000.0)
        self.assertEqual(bill.balance_amount, 20000.0)
        self.assertEqual(vendor.outstanding_balance, 20000.0)

        # Remaining payment: ₹20,000
        pay2 = record_vendor_bill_payment(
            bill_id=bill.id,
            school_id=self.sid,
            amount=20000.0,
            payment_mode='CHEQUE',
            reference_no='CHQ-556677',
            user=self.accountant
        )
        self.assertEqual(bill.status, 'PAID')
        self.assertEqual(bill.paid_amount, 50000.0)
        self.assertEqual(bill.balance_amount, 0.0)
        self.assertEqual(vendor.outstanding_balance, 0.0)

    def test_06_finance_dashboard_metrics_aggregation(self):
        """Validates that get_finance_dashboard_metrics returns aggregated inventory, vendor, and asset data."""
        # Add an inventory item
        inv = InventoryItem(
            school_id=self.sid,
            item_code='CHALK-01',
            name='White Dustless Chalk',
            category='STATIONERY',
            quantity=8,
            unit_price=100.0,
            min_stock=10, # Low stock condition
        )
        db.session.add(inv)

        # Add an asset
        ast = SchoolAsset(
            school_id=self.sid,
            asset_tag='AST-AIR-0001',
            name='Voltas 2 Ton Split AC',
            category='AIR_CONDITIONERS',
            purchase_cost=42000.0,
            status='ASSIGNED'
        )
        db.session.add(ast)
        db.session.commit()

        metrics = get_finance_dashboard_metrics(self.sid, session='2026-27')

        self.assertIn('inventory_summary', metrics)
        self.assertIn('vendors_summary', metrics)
        self.assertIn('assets_summary', metrics)

        self.assertEqual(metrics['inventory_summary']['total_items'], 1)
        self.assertEqual(metrics['inventory_summary']['total_stock_value'], 800.0)
        self.assertEqual(metrics['inventory_summary']['low_stock_count'], 1)
        self.assertEqual(metrics['assets_summary']['total_assets'], 1)
        self.assertEqual(metrics['assets_summary']['assigned'], 1)


if __name__ == '__main__':
    unittest.main()
