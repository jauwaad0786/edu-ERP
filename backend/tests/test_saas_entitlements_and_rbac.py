# backend/tests/test_saas_entitlements_and_rbac.py
"""
OnePlatform360 Campus — Automated Test Suite for:
- Phase 4: Guided 5-Step School Onboarding Wizard
- Phase 5: Subscription Plan Engine & Plan Isolation
- Phase 6: Individual Module Grant & Revocation with In-App Notifications
- Phase 3 & 8: Dynamic RBAC, Anti-Escalation, and Root Admin Protection
- Phase 10: Multi-Tenant Data Isolation & Zero Data Loss on Revocation
"""

import unittest
import json
from flask_jwt_extended import create_access_token
from app import create_app, db
from app.models.school import School
from app.models.user import User, UserRole
from app.models.academic import Class, Student
from app.models.transport import Vehicle
from app.models.communication import SupportNotification
from app.models.subscription import (
    PlatformModule, SubscriptionPlan, SchoolSubscription,
    SchoolSubscriptionHistory, SchoolModuleGrant,
    seed_default_subscription_data, calculate_effective_entitlements
)
from app.models.rbac import Role, Permission, UserRoleAssignment
from app.models.permission_catalog import seed_permission_catalog, seed_role_permission_templates


class TestSaaSEntitlementsAndRBAC(unittest.TestCase):

    def setUp(self):
        self.app = create_app('testing')
        self.app_context = self.app.app_context()
        self.app_context.push()
        self.client = self.app.test_client()

        db.create_all()
        seed_default_subscription_data()
        seed_permission_catalog()
        seed_role_permission_templates()

        # 1. Root Platform Super Admin (Protected)
        self.root_admin = User(
            name="Platform Founder",
            email="founder@oneplatform360.com",
            role=UserRole.SUPER_ADMIN,
            is_active=True,
            is_root_protected=True
        )
        self.root_admin.set_password("Founder@123")
        db.session.add(self.root_admin)

        # 2. Company Subordinate Admin (Unprotected Developer / Ops)
        self.sub_admin = User(
            name="Dev Engineer",
            email="dev@oneplatform360.com",
            role=UserRole.SUPER_ADMIN,
            is_active=True,
            is_root_protected=False
        )
        self.sub_admin.set_password("Dev@123")
        db.session.add(self.sub_admin)

        db.session.commit()

        # JWT Headers
        self.root_token = create_access_token(identity=str(self.root_admin.id))
        self.root_headers = {
            'Authorization': f'Bearer {self.root_token}',
            'Content-Type': 'application/json'
        }

        self.sub_token = create_access_token(identity=str(self.sub_admin.id))
        self.sub_headers = {
            'Authorization': f'Bearer {self.sub_token}',
            'Content-Type': 'application/json'
        }

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    # ─────────────────────────────────────────────────────────────────────────
    # TEST A: GUIDED 5-STEP SCHOOL ONBOARDING WIZARD
    # ─────────────────────────────────────────────────────────────────────────
    def test_a_school_onboarding_wizard(self):
        payload = {
            "school_info": {
                "name": "Greenwood High International",
                "code": "GWH-001",
                "address": "123 Bannerghatta Road",
                "city": "Bangalore",
                "state": "Karnataka",
                "pincode": "560083",
                "contact_email": "info@greenwood.edu",
                "contact_phone": "9876543210",
                "type": "K12",
                "affiliation_board": "CBSE"
            },
            "academic_config": {
                "academic_session": "2026-2027",
                "classes": ["Grade 1", "Grade 2", "Grade 3"],
                "timezone": "Asia/Kolkata"
            },
            "subscription_plan": {
                "plan_code": "PROFESSIONAL",
                "billing_period": "ANNUAL",
                "is_trial": False
            },
            "principal_account": {
                "name": "Dr. Alice Principal",
                "email": "alice.principal@greenwood.edu",
                "phone": "9876543211",
                "password": "SecurePassword@123"
            }
        }

        res = self.client.post(
            '/api/admin/schools/onboard-wizard',
            data=json.dumps(payload),
            headers=self.root_headers
        )
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertIn('Greenwood High International', data['message'])

        # Verify School Created
        school = School.query.filter_by(code="GWH-001").first()
        self.assertIsNotNone(school)
        self.assertEqual(school.plan, "PROFESSIONAL")
        self.assertTrue(school.is_active)

        # Verify Subscription Created
        sub = SchoolSubscription.query.filter_by(school_id=school.id).first()
        self.assertIsNotNone(sub)
        self.assertEqual(sub.plan.code, "PROFESSIONAL")
        self.assertEqual(sub.billing_period, "ANNUAL")

        # Verify Principal Account
        principal = User.query.filter_by(email="alice.principal@greenwood.edu").first()
        self.assertIsNotNone(principal)
        self.assertEqual(principal.school_id, school.id)
        self.assertEqual(principal.role, UserRole.PRINCIPAL)
        self.assertTrue(principal.check_password("SecurePassword@123"))

        # Verify Initialized Academic Classes
        classes = Class.query.filter_by(school_id=school.id).all()
        class_names = [c.name for c in classes]
        self.assertEqual(len(classes), 3)
        self.assertIn("Grade 1", class_names)

        # Verify Principal Welcome Notification
        notif = SupportNotification.query.filter_by(school_id=school.id, user_id=principal.id).first()
        self.assertIsNotNone(notif)
        self.assertIn("Welcome", notif.title)

        # Retrying with same school code MUST be rejected (idempotency/uniqueness)
        retry_res = self.client.post(
            '/api/admin/schools/onboard-wizard',
            data=json.dumps(payload),
            headers=self.root_headers
        )
        self.assertEqual(retry_res.status_code, 409)

    # ─────────────────────────────────────────────────────────────────────────
    # TEST B: PLAN ISOLATION (BASIC VS ENTERPRISE)
    # ─────────────────────────────────────────────────────────────────────────
    def test_b_plan_isolation(self):
        # 1. Create School A on BASIC plan
        school_a = School(name="School Alpha", code="ALPHA", plan="BASIC", is_active=True, status="ACTIVE")
        db.session.add(school_a)
        db.session.flush()

        basic_plan = SubscriptionPlan.query.filter_by(code='BASIC').first()
        sub_a = SchoolSubscription(school_id=school_a.id, plan_id=basic_plan.id, status='ACTIVE')
        db.session.add(sub_a)

        principal_a = User(name="Alice Prin", email="alice@alpha.edu", role=UserRole.PRINCIPAL, school_id=school_a.id, is_active=True)
        principal_a.set_password("Prin@123")
        db.session.add(principal_a)

        # 2. Create School B on ENTERPRISE plan
        school_b = School(name="School Beta", code="BETA", plan="ENTERPRISE", is_active=True, status="ACTIVE")
        db.session.add(school_b)
        db.session.flush()

        enterprise_plan = SubscriptionPlan.query.filter_by(code='ENTERPRISE').first()
        sub_b = SchoolSubscription(school_id=school_b.id, plan_id=enterprise_plan.id, status='ACTIVE')
        db.session.add(sub_b)

        principal_b = User(name="Bob Prin", email="bob@beta.edu", role=UserRole.PRINCIPAL, school_id=school_b.id, is_active=True)
        principal_b.set_password("Prin@123")
        db.session.add(principal_b)

        db.session.commit()

        # Verify entitlement isolation via model methods
        self.assertTrue(school_a.has_feature('student_management'))
        self.assertFalse(school_a.has_feature('transport_management'))
        self.assertFalse(school_a.has_feature('hostel_management'))

        self.assertTrue(school_b.has_feature('student_management'))
        self.assertTrue(school_b.has_feature('transport_management'))
        self.assertTrue(school_b.has_feature('hostel_management'))

        # Principal A token calling Transport endpoint MUST be blocked with 403
        token_a = create_access_token(identity=str(principal_a.id))
        headers_a = {'Authorization': f'Bearer {token_a}', 'Content-Type': 'application/json'}

        res_a = self.client.get('/api/transport/vehicles', headers=headers_a)
        self.assertEqual(res_a.status_code, 403)
        self.assertEqual(res_a.get_json().get('error'), 'module_not_entitled')

        # Principal B calling Transport endpoint passes the entitlement boundary
        token_b = create_access_token(identity=str(principal_b.id))
        headers_b = {'Authorization': f'Bearer {token_b}', 'Content-Type': 'application/json'}

        res_b = self.client.get('/api/transport/vehicles', headers=headers_b)
        self.assertNotEqual(res_b.status_code, 403)

    # ─────────────────────────────────────────────────────────────────────────
    # TEST C: INDIVIDUAL MODULE GRANT
    # ─────────────────────────────────────────────────────────────────────────
    def test_c_individual_module_grant(self):
        # School on BASIC plan
        school = School(name="Delta Academy", code="DELTA", plan="BASIC", is_active=True, status="ACTIVE")
        db.session.add(school)
        db.session.flush()

        basic_plan = SubscriptionPlan.query.filter_by(code='BASIC').first()
        sub = SchoolSubscription(school_id=school.id, plan_id=basic_plan.id, status='ACTIVE')
        db.session.add(sub)

        principal = User(name="Principal Delta", email="prin@delta.edu", role=UserRole.PRINCIPAL, school_id=school.id, is_active=True)
        principal.set_password("Delta@123")
        db.session.add(principal)
        db.session.commit()

        self.assertFalse(school.has_feature('transport_management'))

        # Grant Transport Module individually
        grant_payload = {
            "module_code": "transport_management",
            "reason": "Special bus tracking add-on approved by platform"
        }
        res = self.client.post(
            f'/api/admin/schools/{school.id}/modules/grant',
            data=json.dumps(grant_payload),
            headers=self.root_headers
        )
        self.assertEqual(res.status_code, 200)

        # Verify DB Record
        grant = SchoolModuleGrant.query.filter_by(school_id=school.id, module_code='transport_management').first()
        self.assertIsNotNone(grant)
        self.assertTrue(grant.is_active)
        self.assertEqual(grant.status, 'ACTIVE')

        # Verify Effective Entitlements updated
        self.assertTrue(school.has_feature('transport_management'))

        # Verify In-App Notification dispatched to Principal
        notif = SupportNotification.query.filter_by(school_id=school.id, user_id=principal.id).order_by(SupportNotification.id.desc()).first()
        self.assertIsNotNone(notif)
        self.assertIn("Module Enabled", notif.title)
        self.assertIn("Transport", notif.message)

        # Principal calling Transport API now succeeds
        token = create_access_token(identity=str(principal.id))
        headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
        res_transport = self.client.get('/api/transport/vehicles', headers=headers)
        self.assertNotEqual(res_transport.status_code, 403)

    # ─────────────────────────────────────────────────────────────────────────
    # TEST D: INDIVIDUAL MODULE REVOCATION & DATA PRESERVATION
    # ─────────────────────────────────────────────────────────────────────────
    def test_d_individual_module_revocation(self):
        school = School(name="Sigma School", code="SIGMA", plan="BASIC", is_active=True, status="ACTIVE")
        db.session.add(school)
        db.session.flush()

        basic_plan = SubscriptionPlan.query.filter_by(code='BASIC').first()
        sub = SchoolSubscription(school_id=school.id, plan_id=basic_plan.id, status='ACTIVE')
        db.session.add(sub)

        principal = User(name="Principal Sigma", email="prin@sigma.edu", role=UserRole.PRINCIPAL, school_id=school.id, is_active=True)
        principal.set_password("Sigma@123")
        db.session.add(principal)

        # Grant transport
        grant = SchoolModuleGrant(school_id=school.id, module_code='transport_management', is_active=True, status='ACTIVE')
        db.session.add(grant)

        # Add a vehicle under this school
        vehicle = Vehicle(
            school_id=school.id,
            vehicle_number="KA-01-AB-9999",
            vehicle_type="BUS",
            capacity=40,
            status="ACTIVE"
        )
        db.session.add(vehicle)
        db.session.commit()

        self.assertTrue(school.has_feature('transport_management'))

        # Revoke Transport Module
        revoke_payload = {
            "module_code": "transport_management",
            "reason": "Trial expired or customer requested cancellation"
        }
        res = self.client.post(
            f'/api/admin/schools/{school.id}/modules/revoke',
            data=json.dumps(revoke_payload),
            headers=self.root_headers
        )
        self.assertEqual(res.status_code, 200)

        # Verify Effective Entitlement is immediately revoked
        self.assertFalse(school.has_feature('transport_management'))

        # Verify ZERO DATA LOSS: Vehicle record STILL exists in database
        persisted_vehicle = Vehicle.query.filter_by(vehicle_number="KA-01-AB-9999").first()
        self.assertIsNotNone(persisted_vehicle)
        self.assertEqual(persisted_vehicle.school_id, school.id)

        # Principal calling Transport endpoint is now blocked
        token = create_access_token(identity=str(principal.id))
        headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
        blocked_res = self.client.get('/api/transport/vehicles', headers=headers)
        self.assertEqual(blocked_res.status_code, 403)
        self.assertEqual(blocked_res.get_json().get('error'), 'module_not_entitled')

    # ─────────────────────────────────────────────────────────────────────────
    # TEST E: DYNAMIC RBAC & ANTI-ESCALATION
    # ─────────────────────────────────────────────────────────────────────────
    def test_e_dynamic_rbac_and_anti_escalation(self):
        from app.models.rbac import UserPermissionOverride
        manage_perm = Permission.query.filter_by(key='admin.user.manage').first()
        if manage_perm:
            db.session.add(UserPermissionOverride(
                user_id=self.sub_admin.id,
                permission_id=manage_perm.id,
                is_enabled=True,
                granted_by=self.root_admin.id
            ))
            db.session.commit()

        # Subordinate Admin attempts to grant a permission they don't hold
        target_user = User(name="Accountant John", email="acct@eduerp.com", role=UserRole.ACCOUNTANT, is_active=True)
        target_user.set_password("Acct@123")
        db.session.add(target_user)
        db.session.commit()

        # sub_admin tries to grant 'plans.manage' (which sub_admin does not possess)
        escalation_payload = {
            "permission_key": "plans.manage",
            "is_enabled": True
        }
        res = self.client.post(
            f'/api/rbac/users/{target_user.id}/permissions',
            data=json.dumps(escalation_payload),
            headers=self.sub_headers
        )
        # MUST be blocked with 403 (anti-self-escalation)
        self.assertEqual(res.status_code, 403)
        self.assertIn('self-escalation prohibited', res.get_json().get('error', '').lower())

    # ─────────────────────────────────────────────────────────────────────────
    # TEST F: ROOT ADMINISTRATOR PROTECTION
    # ─────────────────────────────────────────────────────────────────────────
    def test_f_root_administrator_protection(self):
        # 1. Subordinate attempts to delete the root protected administrator
        res_del = self.client.delete(
            f'/api/admin/users/{self.root_admin.id}',
            headers=self.sub_headers
        )
        self.assertEqual(res_del.status_code, 403)
        self.assertIn('protected', res_del.get_json().get('error', '').lower())

        # 2. Subordinate attempts to deactivate the root protected administrator
        res_toggle = self.client.put(
            f'/api/admin/users/{self.root_admin.id}/toggle',
            headers=self.sub_headers
        )
        self.assertEqual(res_toggle.status_code, 403)
        self.assertIn('protected', res_toggle.get_json().get('error', '').lower())

        # 3. Subordinate attempts to demote the root protected administrator
        demote_payload = {"role": "TEACHER"}
        res_demote = self.client.put(
            f'/api/admin/users/{self.root_admin.id}/assign-role',
            data=json.dumps(demote_payload),
            headers=self.sub_headers
        )
        self.assertEqual(res_demote.status_code, 403)

        # 4. Attempting to delete the ONLY active super admin is blocked
        # Deactivate sub_admin first
        self.sub_admin.is_active = False
        db.session.commit()

        # Now only root_admin remains. Even with root_headers, cannot delete the last super admin
        res_del_last = self.client.delete(
            f'/api/admin/users/{self.root_admin.id}',
            headers=self.root_headers
        )
        # Blocked: either self-delete blocked (403) or last admin protection (400)
        self.assertIn(res_del_last.status_code, (400, 403))

    # ─────────────────────────────────────────────────────────────────────────
    # TEST G: TENANT ISOLATION
    # ─────────────────────────────────────────────────────────────────────────
    def test_g_tenant_isolation(self):
        school_1 = School(name="Tenant 1", code="T1", plan="BASIC", is_active=True, status="ACTIVE")
        school_2 = School(name="Tenant 2", code="T2", plan="BASIC", is_active=True, status="ACTIVE")
        db.session.add_all([school_1, school_2])
        db.session.flush()

        p1 = User(name="P1", email="p1@t1.com", role=UserRole.PRINCIPAL, school_id=school_1.id, is_active=True)
        p1.set_password("Pass@1")
        p2 = User(name="P2", email="p2@t2.com", role=UserRole.PRINCIPAL, school_id=school_2.id, is_active=True)
        p2.set_password("Pass@2")
        db.session.add_all([p1, p2])
        db.session.commit()

        token_p1 = create_access_token(identity=str(p1.id))
        headers_p1 = {'Authorization': f'Bearer {token_p1}', 'Content-Type': 'application/json'}

        # Principal 1 attempts to call platform admin subscription management endpoint
        res = self.client.get(f'/api/admin/schools/{school_2.id}/entitlements', headers=headers_p1)
        self.assertEqual(res.status_code, 403)


if __name__ == '__main__':
    unittest.main()
