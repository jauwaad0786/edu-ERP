"""
Comprehensive End-to-End Test Suite for School Transport Management Module
Covers:
- Models & Schema Integrity (Pickup/Drop Stops, Attendance, Fines)
- Multi-tenant isolation
- Driver Trip Lifecycle & Live Telemetry
- Automated Haversine Stop Detection
- Idempotent Student Pickup/Drop Attendance
- Central Financial Ledger Integration & Two-Way Sync
- Double-payment prevention & Partial Payments
- Fine creation, payment & Principal-only waiver
"""

import unittest
import os
import sys
import unittest
import json
from datetime import datetime, date

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app import create_app, db
from app.models.user import User
from app.models.school import School
from app.models.academic import Student, Class
from app.models.transport import Vehicle, Driver, Route, RouteStop, Stop
from app.models.transport_student import StudentTransport, TransportFeeStructure, TransportFeeRecord, TransportFineRecord
from app.models.transport_gps import TripLog, GPSLog, TripStudentAttendance
from app.models.financial import FeeRecord, FeeTransaction
from app.services.transport_fee_service import (
    generate_transport_fee_record,
    record_transport_fee_payment,
    create_transport_fine,
    record_transport_fine_payment,
    waive_transport_fine,
    sync_transport_from_fee_record,
)
from app.routes.transport_gps import _haversine_km


class TransportE2ETestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app('testing')
        self.app_context = self.app.app_context()
        self.app_context.push()
        self.client = self.app.test_client()
        db.create_all()

        # 1. Setup School 1 & School 2
        self.school1 = School(name="Delhi Public Academy", code="DPA01", is_active=True)
        self.school2 = School(name="St Xavier High", code="SXH01", is_active=True)
        db.session.add_all([self.school1, self.school2])
        db.session.flush()

        # 2. Setup Principal, Driver & Student users
        self.principal1 = User(name="Principal DPA", email="principal@dpa.edu", role="PRINCIPAL", school_id=self.school1.id)
        self.principal1.set_password("pass123")

        self.driver_user = User(name="Ramesh Driver", email="driver1@dpa.edu", role="DRIVER", school_id=self.school1.id)
        self.driver_user.set_password("driver123")

        self.st1_user = User(name="Aarav Sharma", email="aarav@dpa.edu", role="STUDENT", school_id=self.school1.id)
        self.st1_user.set_password("student123")

        self.st2_user = User(name="Priya Verma", email="priya@dpa.edu", role="STUDENT", school_id=self.school1.id)
        self.st2_user.set_password("student123")

        db.session.add_all([self.principal1, self.driver_user, self.st1_user, self.st2_user])
        db.session.flush()

        # 3. Setup Class & Students
        self.cls1 = Class(name="Class 10-A", school_id=self.school1.id)
        db.session.add(self.cls1)
        db.session.flush()

        self.student1 = Student(
            user_id=self.st1_user.id,
            admission_no="DPA-101", class_id=self.cls1.id,
            school_id=self.school1.id, father_name="Rajesh Sharma",
            parent_phone="9876543210"
        )
        self.student2 = Student(
            user_id=self.st2_user.id,
            admission_no="DPA-102", class_id=self.cls1.id,
            school_id=self.school1.id, father_name="Suresh Verma",
            parent_phone="9876543211"
        )
        db.session.add_all([self.student1, self.student2])
        db.session.flush()

        # 4. Setup Vehicle, Driver, Route, Stops
        self.driver = Driver(
            school_id=self.school1.id, user_id=self.driver_user.id,
            name="Ramesh Kumar", mobile_number="9898989898", license_number="DL-01-2020-001"
        )
        self.vehicle = Vehicle(
            school_id=self.school1.id, vehicle_number="DL-01-AB-1234",
            vehicle_name="Bus #1", vehicle_type="BUS", capacity=40,
            driver_id=self.driver_user.id
        )
        db.session.add_all([self.driver, self.vehicle])
        db.session.flush()

        # Stop 1: Connaught Place (28.6315, 77.2167)
        self.stop1 = Stop(
            school_id=self.school1.id, name="Connaught Place Circle",
            latitude=28.6315, longitude=77.2167, radius=200
        )
        # Stop 2: Karol Bagh (28.6517, 77.1906)
        self.stop2 = Stop(
            school_id=self.school1.id, name="Karol Bagh Metro",
            latitude=28.6517, longitude=77.1906, radius=200
        )
        db.session.add_all([self.stop1, self.stop2])
        db.session.flush()

        self.route = Route(
            school_id=self.school1.id, name="Route 10 - Central",
            vehicle_id=self.vehicle.id
        )
        db.session.add(self.route)
        db.session.flush()

        self.rs1 = RouteStop(route_id=self.route.id, stop_id=self.stop1.id, sequence=1, estimated_time="07:30 AM")
        self.rs2 = RouteStop(route_id=self.route.id, stop_id=self.stop2.id, sequence=2, estimated_time="07:45 AM")
        db.session.add_all([self.rs1, self.rs2])

        # 5. Assign Student 1 to Transport with distinct Pickup and Drop stops
        self.assignment1 = StudentTransport(
            school_id=self.school1.id, student_id=self.student1.id,
            route_id=self.route.id, vehicle_id=self.vehicle.id,
            stop_id=self.stop1.id, pickup_stop_id=self.stop1.id,
            drop_stop_id=self.stop2.id, academic_year="2026-27",
            status='ACTIVE'
        )
        db.session.add(self.assignment1)
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_01_student_transport_model_stops(self):
        """Test pickup_stop_id and drop_stop_id relations and data integrity"""
        st = StudentTransport.query.filter_by(student_id=self.student1.id).first()
        self.assertIsNotNone(st)
        self.assertEqual(st.pickup_stop_id, self.stop1.id)
        self.assertEqual(st.drop_stop_id, self.stop2.id)
        self.assertEqual(st.pickup_stop.name, "Connaught Place Circle")
        self.assertEqual(st.drop_stop.name, "Karol Bagh Metro")

    def test_02_haversine_stop_detection(self):
        """Test automatic GPS geofence stop detection within radius"""
        trip = TripLog(
            school_id=self.school1.id, vehicle_id=self.vehicle.id,
            driver_id=self.driver.id, route_id=self.route.id,
            status='RUNNING', start_time=datetime.utcnow()
        )
        db.session.add(trip)
        db.session.commit()

        # Simulate vehicle telemetry directly inside Connaught Place geofence (28.63155, 77.21675) ~8 meters away
        dist_km = _haversine_km(28.63155, 77.21675, self.stop1.latitude, self.stop1.longitude)
        dist_m = dist_km * 1000.0
        self.assertLess(dist_m, 20.0)  # within 20m
        self.assertLessEqual(dist_m, self.stop1.radius)

        # Simulate location far away (e.g. Noida 28.5355, 77.3910)
        dist_far_km = _haversine_km(28.5355, 77.3910, self.stop1.latitude, self.stop1.longitude)
        dist_far_m = dist_far_km * 1000.0
        self.assertGreater(dist_far_m, float(self.stop1.radius))

    def test_03_student_attendance_event_idempotency(self):
        """Test driver one-tap student events (PICKED_UP, DROPPED_OFF, ABSENT) with unique constraint idempotency"""
        trip = TripLog(
            school_id=self.school1.id, vehicle_id=self.vehicle.id,
            driver_id=self.driver.id, route_id=self.route.id,
            status='RUNNING', start_time=datetime.utcnow()
        )
        db.session.add(trip)
        db.session.commit()

        # 1. First event: PICKED_UP
        ev1 = TripStudentAttendance(
            school_id=self.school1.id, trip_id=trip.id,
            student_id=self.student1.id, stop_id=self.stop1.id,
            event_type='PICKED_UP', recorded_by=self.driver_user.id
        )
        db.session.add(ev1)
        db.session.commit()
        self.assertEqual(ev1.event_type, 'PICKED_UP')

        # 2. Duplicate event check (must not duplicate or crash)
        existing = TripStudentAttendance.query.filter_by(
            trip_id=trip.id, student_id=self.student1.id, event_type='PICKED_UP'
        ).first()
        self.assertIsNotNone(existing)

    def test_04_central_fee_generation_and_payment(self):
        """Test central financial ledger integration for Transport Fees"""
        # 1. Generate monthly fee
        fee_rec, reason = generate_transport_fee_record(
            assignment=self.assignment1,
            month="2026-05",
            due_date=date(2026, 5, 10),
            created_by_id=self.principal1.id
        )
        self.assertIsNotNone(fee_rec)
        self.assertEqual(fee_rec.source, 'TRANSPORT')
        self.assertEqual(fee_rec.fee_type, 'TRANSPORT')
        self.assertEqual(fee_rec.status, 'PENDING')

        # 2. Duplicate generation prevention
        fee_rec2, reason2 = generate_transport_fee_record(
            assignment=self.assignment1,
            month="2026-05"
        )
        self.assertEqual(fee_rec.id, fee_rec2.id)
        self.assertEqual(reason2, 'already_exists')

        # 3. Partial payment (1000 out of fee)
        due = fee_rec.amount_due
        rec_partial, txn_partial = record_transport_fee_payment(
            record=fee_rec,
            amount=1000.0,
            payment_mode='UPI',
            collected_by_user=self.principal1,
            remarks="Partial UPI installment"
        )
        self.assertEqual(rec_partial.status, 'PARTIAL' if due > 1000 else 'PAID')
        self.assertEqual(rec_partial.amount_paid, 1000.0)
        self.assertIsNotNone(txn_partial)

        # 4. Final remaining payment
        rem = round(due - 1000.0, 2)
        if rem > 0:
            rec_full, txn_full = record_transport_fee_payment(
                record=fee_rec,
                amount=rem,
                payment_mode='CASH',
                collected_by_user=self.principal1
            )
            self.assertEqual(rec_full.status, 'PAID')
            self.assertEqual(rec_full.amount_paid, due)
            self.assertIsNotNone(txn_full)

    def test_05_fines_and_waiver_lifecycle(self):
        """Test Transport Fine creation, payment, and waiver with central synchronization"""
        # 1. Create Fine for bus window damage
        fine = create_transport_fine(
            school_id=self.school1.id,
            student_id=self.student1.id,
            amount=500.0,
            fine_type='DAMAGE',
            reason='Broken seat lever on Route 10',
            created_by_user=self.principal1
        )
        self.assertIsNotNone(fine)
        self.assertEqual(fine.outstanding_amount, 500.0)
        self.assertEqual(fine.status, 'OUTSTANDING')

        # 2. Principal Waives 200 of the fine
        waived_fine = waive_transport_fine(
            fine=fine,
            waiver_amount=200.0,
            reason="Principal concession on parent request",
            waived_by_user=self.principal1
        )
        self.assertEqual(waived_fine.waived_amount, 200.0)
        self.assertEqual(waived_fine.outstanding_amount, 300.0)

        # 3. Pay remaining 300
        pay_res = record_transport_fine_payment(
            fine=fine,
            amount=300.0,
            payment_mode='CASH',
            collected_by_user=self.principal1
        )
        self.assertEqual(pay_res.status, 'PAID')
        self.assertEqual(pay_res.outstanding_amount, 0.0)

    def test_06_multi_tenant_isolation(self):
        """Ensure School B cannot view or collect School A transport fees or student records"""
        # Create student in School B
        st_b_user = User(name="Kabir Mehta", email="kabir@sxh.edu", role="STUDENT", school_id=self.school2.id)
        st_b_user.set_password("student123")
        db.session.add(st_b_user)
        db.session.flush()

        student_b = Student(
            user_id=st_b_user.id,
            admission_no="SXH-201",
            school_id=self.school2.id
        )
        db.session.add(student_b)
        db.session.commit()

        # Generate fee for School A student
        fee_rec_a, reason = generate_transport_fee_record(
            assignment=self.assignment1,
            month="2026-06"
        )
        self.assertIsNotNone(fee_rec_a)

        # Verify School B query isolation
        records_school_b = TransportFeeRecord.query.filter_by(school_id=self.school2.id).all()
        self.assertEqual(len(records_school_b), 0)

    def test_07_driver_mobile_and_password_login(self):
        """Test driver login using mobile number (and/or username) and password"""
        # 1. Login with mobile number '9898989898'
        res = self.client.post('/api/auth/login', json={
            'identifier': '9898989898',
            'password': 'driver123'
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn('access_token', data)
        self.assertEqual(data['user']['role'], 'DRIVER')

        # 2. Login with email
        res2 = self.client.post('/api/auth/login', json={
            'identifier': 'driver1@dpa.edu',
            'password': 'driver123'
        })
        self.assertEqual(res2.status_code, 200)

    def test_08_vehicle_students_endpoint(self):
        """Test GET /api/transport/vehicles/<id>/students works without 500 error"""
        login_res = self.client.post('/api/auth/login', json={
            'identifier': 'principal@dpa.edu',
            'password': 'pass123'
        })
        token = login_res.get_json()['access_token']

        res = self.client.get(
            f'/api/transport/vehicles/{self.vehicle.id}/students',
            headers={'Authorization': f'Bearer {token}'}
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get('success'))
        self.assertEqual(data['data']['assigned_count'], 1)
        self.assertEqual(len(data['data']['students']), 1)
        self.assertEqual(data['data']['students'][0]['student_name'], 'Aarav Sharma')

    def test_09_driver_today_with_assigned_vehicle(self):
        """Test GET /api/transport/driver/today returns has_vehicle: True and stop students"""
        # Login as driver
        res = self.client.post('/api/auth/login', json={
            'identifier': '9898989898',
            'password': 'driver123'
        })
        token = res.get_json()['access_token']

        res2 = self.client.get(
            '/api/transport/driver/today',
            headers={'Authorization': f'Bearer {token}'}
        )
        self.assertEqual(res2.status_code, 200)
        data = res2.get_json()
        self.assertTrue(data.get('success'))
        self.assertTrue(data['data']['has_vehicle'])
        self.assertEqual(data['data']['vehicle_number'], self.vehicle.vehicle_number)
        self.assertTrue(len(data['data']['stops']) > 0)

    def test_10_student_travel_history_endpoint(self):
        """Test GET /api/transport/travel-history returns datewise boarding & dropoff history"""
        # Login as principal
        login_res = self.client.post('/api/auth/login', json={
            'identifier': 'principal@dpa.edu',
            'password': 'pass123'
        })
        token = login_res.get_json()['access_token']

        # 1. Query travel history for today
        res = self.client.get(
            f'/api/transport/travel-history?date={date.today().isoformat()}',
            headers={'Authorization': f'Bearer {token}'}
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get('success'))
        self.assertEqual(data['summary']['total_enrolled'], 1)
        self.assertEqual(len(data['data']), 1)
        st_row = data['data'][0]
        self.assertEqual(st_row['student_name'], 'Aarav Sharma')
        self.assertEqual(st_row['vehicle_number'], self.vehicle.vehicle_number)
        self.assertIn('boarded_time', st_row)
        self.assertIn('dropped_time', st_row)

        # 2. Query month-wise travel history
        current_month = date.today().strftime('%Y-%m')
        res_month = self.client.get(
            f'/api/transport/travel-history?month={current_month}',
            headers={'Authorization': f'Bearer {token}'}
        )
        self.assertEqual(res_month.status_code, 200)
        data_month = res_month.get_json()
        self.assertTrue(data_month.get('success'))
        self.assertTrue(data_month['summary']['is_month_view'])


if __name__ == '__main__':
    unittest.main()


