import csv
import io
import json
import secrets
from datetime import datetime, date
from app import db
from app.models.academic import Student, StudentEnrollment, Class
from app.models.user import User, UserRole
from app.models.financial import FeeRecord
from app.models.fee_finance import StudentLedger
from app.models.migration import MigrationBatch, MigrationRecord
from app.models.audit import log_school_action
from app.utils.timezone_util import utc_now, ist_today, ist_naive_now

# Standard canonical dictionary of aliases across Indian school operations
FIELD_ALIASES = {
    'admission_no': [
        'admission_no', 'admission_number', 'adm_no', 'adm_number', 'scholar_no',
        'scholarno', 'scholar_number', 'reg_no', 'registration_no', 'sr_no',
        'admission_id', 'student_id', 'scholar', 'admission', 'प्रवेश_क्रमांक', 'दाखिला_संख्या'
    ],
    'name': [
        'name', 'student_name', 'student', 'full_name', 'candidate_name', 'विद्यार्थी_नाम', 'छात्र_का_नाम'
    ],
    'class_name': [
        'class', 'class_name', 'grade', 'standard', 'std', 'कक्षा'
    ],
    'section': [
        'section', 'sec', 'वर्ग', 'सेक्शन'
    ],
    'roll_number': [
        'roll_number', 'roll_no', 'roll', 'अनुक्रमांक'
    ],
    'dob': [
        'dob', 'date_of_birth', 'birth_date', 'birthdate', 'जन्म_तिथि'
    ],
    'gender': [
        'gender', 'sex', 'लिंग'
    ],
    'father_name': [
        'father_name', 'father', 'fathers_name', 'पिता_का_नाम'
    ],
    'mother_name': [
        'mother_name', 'mother', 'mothers_name', 'माता_का_नाम'
    ],
    'parent_phone': [
        'parent_phone', 'phone', 'mobile', 'parent_mobile', 'contact', 'contact_no', 'फोन_नंबर', 'मोबाइल'
    ],
    'parent_email': [
        'parent_email', 'email', 'email_address'
    ],
    'address': [
        'address', 'residential_address', 'permanent_address', 'पता'
    ],
    'blood_group': [
        'blood_group', 'blood_grp', 'bg'
    ],
    'category': [
        'category', 'caste_category', 'caste'
    ],
    'aadhar_no': [
        'aadhar_no', 'student_aadhar', 'aadhar', 'आधार_संख्या'
    ],
    'opening_balance': [
        'opening_balance', 'previous_dues', 'balance', 'balance_due', 'pending_fee',
        'old_dues', 'due_amount', 'outstanding', 'बकाया_राशि', 'बकाया'
    ],
    'legacy_paid_amount': [
        'paid_amount', 'fee_paid', 'total_paid', 'amount_paid', 'जमा_राशि'
    ],
    'transport_route': [
        'transport_route', 'route', 'bus_route', 'route_name', 'बस_रूट'
    ],
    'transport_stop': [
        'transport_stop', 'stop', 'bus_stop', 'pickup_point', 'स्टॉप'
    ],
    'hostel_room': [
        'hostel_room', 'room_no', 'room', 'hostel_room_no', 'कमरा'
    ],
    'library_card': [
        'library_card', 'library_card_no', 'library_card_number', 'lib_card'
    ]
}


def normalize_header(header_str: str) -> str:
    """Normalizes header string to clean lowercase alphanumeric underscore."""
    if not header_str:
        return ''
    h = str(header_str).strip().lower()
    for char in [' ', '-', '.', '/', '(', ')', '[', ']', ':', '#']:
        h = h.replace(char, '_')
    while '__' in h:
        h = h.replace('__', '_')
    return h.strip('_')


def auto_detect_mapping(raw_headers: list) -> dict:
    """Auto-maps raw file headers to canonical Edu-ERP fields."""
    mapping = {}
    used_headers = set()

    normalized_raw = {h: normalize_header(h) for h in raw_headers}

    for canonical_field, aliases in FIELD_ALIASES.items():
        matched = False
        # Exact alias match
        for raw_h, norm_h in normalized_raw.items():
            if raw_h in used_headers:
                continue
            if norm_h in aliases:
                mapping[canonical_field] = raw_h
                used_headers.add(raw_h)
                matched = True
                break
        
        # Substring alias match if not exact
        if not matched:
            for raw_h, norm_h in normalized_raw.items():
                if raw_h in used_headers:
                    continue
                for al in aliases:
                    if al in norm_h:
                        mapping[canonical_field] = raw_h
                        used_headers.add(raw_h)
                        matched = True
                        break
                if matched:
                    break

    return mapping


def parse_rows_from_stream(file_bytes: bytes, filename: str) -> list:
    """Parses tabular rows from CSV or Excel file bytes."""
    fname_lower = (filename or '').lower()
    rows = []

    if fname_lower.endswith('.xlsx') or fname_lower.endswith('.xls'):
        try:
            import openpyxl
            wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
            sheet = wb.active
            iter_rows = sheet.iter_rows(values_only=True)
            header_row = next(iter_rows, None)
            if not header_row:
                return []
            headers = [str(h).strip() if h is not None else f"Column_{idx}" for idx, h in enumerate(header_row)]
            for row in iter_rows:
                if not any(row):
                    continue
                row_dict = {}
                for idx, cell in enumerate(row):
                    if idx < len(headers):
                        val = cell
                        if isinstance(val, (datetime, date)):
                            val = val.strftime('%Y-%m-%d')
                        elif val is not None:
                            val = str(val).strip()
                        else:
                            val = ''
                        row_dict[headers[idx]] = val
                rows.append(row_dict)
            return rows
        except Exception as e:
            # Fallback to CSV reader if openpyxl fails or not available
            print(f"[WARN] OpenPyXL parse error: {e}, falling back to CSV")

    # CSV parser
    try:
        decoded = file_bytes.decode('utf-8-sig', errors='ignore')
    except Exception:
        decoded = file_bytes.decode('latin1', errors='ignore')
    
    stream = io.StringIO(decoded)
    reader = csv.DictReader(stream)
    for r in reader:
        if any(r.values()):
            clean_row = {k.strip(): str(v).strip() if v is not None else '' for k, v in r.items() if k}
            rows.append(clean_row)
    return rows


def validate_migration_payload(school_id: int, rows: list, mapping: dict, session: str) -> dict:
    """
    Performs comprehensive pre-migration analysis:
    - Validates mandatory attributes (name).
    - Checks for duplicate admission numbers and phone matches.
    - Estimates opening balance totals and class distributions.
    """
    total = len(rows)
    valid_rows = []
    errors = []
    warnings = []

    existing_students = Student.query.filter_by(school_id=school_id, is_deleted=False).all()
    adm_map = {s.admission_no.strip().lower(): s for s in existing_students if s.admission_no}
    phone_map = {s.parent_phone.strip(): s for s in existing_students if s.parent_phone}

    existing_classes = Class.query.filter_by(school_id=school_id).all()
    class_name_set = {c.name.strip().lower() for c in existing_classes}

    name_field = mapping.get('name')
    adm_field = mapping.get('admission_no')
    class_field = mapping.get('class_name')
    sec_field = mapping.get('section')
    phone_field = mapping.get('parent_phone')
    ob_field = mapping.get('opening_balance')
    paid_field = mapping.get('legacy_paid_amount')

    total_opening_dues = 0.0
    total_legacy_paid = 0.0
    matched_existing_count = 0
    new_student_count = 0

    classes_to_create = set()

    for idx, r in enumerate(rows, start=1):
        name = (r.get(name_field) or '').strip()
        adm_no = (r.get(adm_field) or '').strip() if adm_field else ''
        cls_name = (r.get(class_field) or '').strip() if class_field else ''
        sec = (r.get(sec_field) or 'A').strip().upper() if sec_field else 'A'
        phone = (r.get(phone_field) or '').strip() if phone_field else ''
        phone_clean = ''.join(ch for ch in phone if ch.isdigit())

        if not name:
            errors.append(f"Row {idx}: Student Name is missing")
            continue

        ob_val = 0.0
        if ob_field and r.get(ob_field):
            try:
                ob_val = max(0.0, float(str(r.get(ob_field)).replace(',', '').strip()))
            except Exception:
                ob_val = 0.0
        total_opening_dues += ob_val

        paid_val = 0.0
        if paid_field and r.get(paid_field):
            try:
                paid_val = max(0.0, float(str(r.get(paid_field)).replace(',', '').strip()))
            except Exception:
                paid_val = 0.0
        total_legacy_paid += paid_val

        # Match check
        is_existing = False
        matched_st = None
        if adm_no and adm_no.lower() in adm_map:
            is_existing = True
            matched_st = adm_map[adm_no.lower()]
        elif phone_clean and len(phone_clean) == 10 and phone_clean in phone_map:
            # Possible match by phone
            matched_st = phone_map[phone_clean]
            if matched_st.user and matched_st.user.name.strip().lower() == name.lower():
                is_existing = True

        if is_existing:
            matched_existing_count += 1
        else:
            new_student_count += 1

        if cls_name and cls_name.lower() not in class_name_set:
            classes_to_create.add(cls_name)

        valid_rows.append({
            'row_num': idx,
            'name': name,
            'admission_no': adm_no,
            'class_name': cls_name or 'General',
            'section': sec,
            'parent_phone': phone_clean,
            'opening_balance': ob_val,
            'legacy_paid_amount': paid_val,
            'is_existing': is_existing,
            'matched_student_id': matched_st.id if matched_st else None,
            'raw_row': r
        })

    return {
        'total_records': total,
        'valid_count': len(valid_rows),
        'error_count': len(errors),
        'errors': errors[:50],
        'warnings': warnings[:50],
        'matched_existing_count': matched_existing_count,
        'new_student_count': new_student_count,
        'total_opening_dues': round(total_opening_dues, 2),
        'total_legacy_paid': round(total_legacy_paid, 2),
        'classes_to_create': list(classes_to_create),
        'preview': valid_rows[:15]
    }


def execute_school_migration(
    school_id: int,
    session: str,
    rows: list,
    mapping: dict,
    is_pilot: bool = False,
    pilot_limit: int = 15,
    user_id: int = None,
    source_type: str = 'EXCEL',
    filename: str = '',
    source_file_url: str = None
) -> dict:
    """
    Executes production migration safely inside a transactional boundary:
    1. Preserves legacy admission numbers (no random override).
    2. Sets Student status='ACTIVE' and StudentEnrollment enrollment_type='MIGRATED'.
    3. Seamlessly records Opening Balance via FeeRecord and StudentLedger.
    4. Connects Transport, Hostel, and Library without creating second fee engines.
    5. Stores detailed MigrationRecord for reconciliation and spot checks.
    """
    seq_count = MigrationBatch.query.filter_by(school_id=school_id).count() + 1
    batch_no = f"MIG-{session[:4]}-{seq_count:04d}"

    target_rows = rows[:pilot_limit] if is_pilot else rows

    batch = MigrationBatch(
        school_id=school_id,
        batch_no=batch_no,
        source_type=source_type,
        session=session,
        total_records=len(target_rows),
        is_pilot=is_pilot,
        status='COMMITTED' if not is_pilot else 'PILOT_TESTED',
        source_filename=filename,
        source_file_url=source_file_url,
        column_mapping=mapping,
        created_by=user_id,
        created_at=utc_now(),
        committed_at=utc_now()
    )
    db.session.add(batch)
    db.session.flush()

    name_field = mapping.get('name')
    adm_field = mapping.get('admission_no')
    class_field = mapping.get('class_name')
    sec_field = mapping.get('section')
    roll_field = mapping.get('roll_number')
    dob_field = mapping.get('dob')
    gender_field = mapping.get('gender')
    father_field = mapping.get('father_name')
    mother_field = mapping.get('mother_name')
    phone_field = mapping.get('parent_phone')
    email_field = mapping.get('parent_email')
    addr_field = mapping.get('address')
    blood_field = mapping.get('blood_group')
    cat_field = mapping.get('category')
    aadhar_field = mapping.get('aadhar_no')
    ob_field = mapping.get('opening_balance')
    paid_field = mapping.get('legacy_paid_amount')
    trans_route_field = mapping.get('transport_route')
    trans_stop_field = mapping.get('transport_stop')
    hostel_room_field = mapping.get('hostel_room')
    lib_card_field = mapping.get('library_card')

    school_classes = Class.query.filter_by(school_id=school_id).all()
    class_lookup = {}
    for c in school_classes:
        key = (c.name.strip().lower(), (c.section or 'A').strip().upper())
        class_lookup[key] = c

    existing_students = Student.query.filter_by(school_id=school_id, is_deleted=False).all()
    adm_map = {s.admission_no.strip().lower(): s for s in existing_students if s.admission_no}

    imported_new = 0
    updated_existing = 0
    failed_count = 0
    total_ob_accum = 0.0
    total_paid_accum = 0.0

    for idx, r in enumerate(target_rows, start=1):
        try:
            name = (r.get(name_field) or '').strip()
            if not name:
                continue

            adm_no = (r.get(adm_field) or '').strip() if adm_field else ''
            cls_name = (r.get(class_field) or 'Class 1').strip() if class_field else 'Class 1'
            sec = (r.get(sec_field) or 'A').strip().upper() if sec_field else 'A'
            roll_no = (r.get(roll_field) or '').strip() if roll_field else ''
            father = (r.get(father_field) or '').strip() if father_field else ''
            mother = (r.get(mother_field) or '').strip() if mother_field else ''
            phone = (r.get(phone_field) or '').strip() if phone_field else ''
            phone_clean = ''.join(ch for ch in phone if ch.isdigit())
            email = (r.get(email_field) or '').strip() if email_field else ''
            addr = (r.get(addr_field) or '').strip() if addr_field else ''
            gender = (r.get(gender_field) or 'Male').strip() if gender_field else 'Male'
            blood = (r.get(blood_field) or '').strip() if blood_field else ''
            category = (r.get(cat_field) or 'General').strip() if cat_field else 'General'
            aadhar = (r.get(aadhar_field) or '').strip() if aadhar_field else ''

            dob_val = None
            if dob_field and r.get(dob_field):
                raw_dob = str(r.get(dob_field)).strip()
                for fmt in ('%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y', '%Y/%m/%d'):
                    try:
                        dob_val = datetime.strptime(raw_dob[:10], fmt).date()
                        break
                    except Exception:
                        pass

            ob_val = 0.0
            if ob_field and r.get(ob_field):
                try:
                    ob_val = max(0.0, float(str(r.get(ob_field)).replace(',', '').strip()))
                except Exception:
                    ob_val = 0.0
            total_ob_accum += ob_val

            paid_val = 0.0
            if paid_field and r.get(paid_field):
                try:
                    paid_val = max(0.0, float(str(r.get(paid_field)).replace(',', '').strip()))
                except Exception:
                    paid_val = 0.0
            total_paid_accum += paid_val

            # Resolve or auto-create class
            cls_key = (cls_name.lower(), sec)
            cls_obj = class_lookup.get(cls_key)
            if not cls_obj and cls_name:
                cls_obj = Class(name=cls_name, section=sec, session=session, school_id=school_id)
                db.session.add(cls_obj)
                db.session.flush()
                class_lookup[cls_key] = cls_obj

            eff_cls_id = cls_obj.id if cls_obj else None

            # Student Match
            existing_student = None
            if adm_no and adm_no.lower() in adm_map:
                existing_student = adm_map[adm_no.lower()]

            if existing_student:
                # Update existing student
                existing_student.class_id = eff_cls_id or existing_student.class_id
                if roll_no:
                    existing_student.roll_number = roll_no
                if phone_clean:
                    existing_student.parent_phone = phone_clean
                    if existing_student.user and not existing_student.user.phone:
                        existing_student.user.phone = phone_clean
                if father:
                    existing_student.father_name = father
                if mother:
                    existing_student.mother_name = mother
                if addr:
                    existing_student.address = addr
                existing_student.session = session
                existing_student.status = 'ACTIVE'

                # Upsert StudentEnrollment for session
                enrollment = StudentEnrollment.query.filter_by(
                    school_id=school_id, student_id=existing_student.id, session=session
                ).first()
                if not enrollment:
                    enrollment = StudentEnrollment(
                        school_id=school_id,
                        student_id=existing_student.id,
                        session=session,
                        class_id=eff_cls_id or existing_student.class_id,
                        section=sec,
                        roll_number=roll_no or existing_student.roll_number,
                        enrollment_status='ACTIVE',
                        enrollment_type='MIGRATED',
                        enrolled_date=ist_today(),
                        remarks=f"Migrated from legacy records ({batch_no})",
                        created_by=user_id
                    )
                    db.session.add(enrollment)
                else:
                    enrollment.class_id = eff_cls_id or enrollment.class_id
                    enrollment.section = sec
                    enrollment.enrollment_status = 'ACTIVE'
                    enrollment.enrollment_type = 'MIGRATED'

                st_id = existing_student.id
                updated_existing += 1
            else:
                # Create brand new student in Edu-ERP representing migrated pupil
                raw_email = email if email else f"migrated_{int(utc_now().timestamp())}_{secrets.randbelow(9000)+1000}@eduerp.com"
                user = User(
                    name=name,
                    email=raw_email,
                    phone=phone_clean if phone_clean else None,
                    role=UserRole.STUDENT,
                    school_id=school_id
                )
                user.set_password('Student@123', store_plain=True)
                db.session.add(user)
                db.session.flush()

                try:
                    from app.services.permission_resolver import ensure_role_assignment_for_user
                    ensure_role_assignment_for_user(user)
                except Exception:
                    pass

                # If school has existing admission number, PRESERVE IT!
                final_adm_no = adm_no
                if not final_adm_no:
                    count_all = Student.query.filter_by(school_id=school_id).count()
                    final_adm_no = f"ADM-{session[:4]}-{count_all + 1:04d}"

                clean_uname = final_adm_no.lower().replace('/', '_').replace(' ', '').replace('-', '_')
                if not User.query.filter_by(username=clean_uname).first():
                    user.username = clean_uname

                new_student = Student(
                    user_id=user.id,
                    school_id=school_id,
                    class_id=eff_cls_id,
                    roll_number=roll_no,
                    admission_no=final_adm_no,
                    admission_date=ist_today(),
                    original_admission_year=session[:4],
                    dob=dob_val,
                    gender=gender,
                    parent_name=father or mother or 'Parent',
                    parent_phone=phone_clean,
                    parent_email=email,
                    father_name=father,
                    mother_name=mother,
                    address=addr,
                    blood_group=blood,
                    category=category,
                    aadhar_no=aadhar,
                    session=session,
                    status='ACTIVE',
                    is_first_school=False
                )
                db.session.add(new_student)
                db.session.flush()

                new_enrollment = StudentEnrollment(
                    school_id=school_id,
                    student_id=new_student.id,
                    session=session,
                    class_id=eff_cls_id or 1,
                    section=sec,
                    roll_number=roll_no,
                    enrollment_status='ACTIVE',
                    enrollment_type='MIGRATED',
                    enrolled_date=ist_today(),
                    remarks=f"Migrated on school onboarding ({batch_no})",
                    created_by=user_id
                )
                db.session.add(new_enrollment)

                st_id = new_student.id
                adm_map[final_adm_no.lower()] = new_student
                imported_new += 1

            # ── OPENING BALANCE INTEGRATION ──
            if ob_val > 0:
                # Check if opening balance already exists to prevent duplicate injection
                existing_ob = FeeRecord.query.filter_by(
                    school_id=school_id, student_id=st_id, source='OPENING_BALANCE'
                ).first()
                if not existing_ob:
                    curr_month_str = ist_today().strftime('%Y-%m')
                    ob_rec = FeeRecord(
                        school_id=school_id,
                        student_id=st_id,
                        fee_type='OPENING_BALANCE',
                        month=curr_month_str,
                        coverage_label='Migrated Opening Balance',
                        amount_due=ob_val,
                        amount_paid=0.0,
                        status='PENDING',
                        billing_frequency='ONE_TIME',
                        session=session,
                        source='OPENING_BALANCE',
                        remarks=f"Legacy opening balance migrated via {batch_no}",
                        due_date=ist_today(),
                        created_at=ist_naive_now()
                    )
                    db.session.add(ob_rec)
                    db.session.flush()

                    # Real-time sync to Central Finance (FeeBill, FeeBillItem & StudentLedger)
                    try:
                        from app.services.fee_central_service import sync_fee_record_to_bill
                        sync_fee_record_to_bill(ob_rec)
                    except Exception as sync_err:
                        print(f"[MigrationService] Error syncing opening balance FeeRecord to FeeBill: {sync_err}")
                        ledger_entry = StudentLedger(
                            school_id=school_id,
                            student_id=st_id,
                            entry_type='DEBIT',
                            amount=ob_val,
                            period_label='Opening Balance',
                            session=session,
                            reference_no=f"OB-{batch_no}",
                            description=f"Legacy school balance brought forward (₹{ob_val:,.2f})",
                            created_by=user_id,
                            created_at=ist_naive_now()
                        )
                        db.session.add(ledger_entry)

            # ── OPTIONAL SERVICES ASSIGNMENT (Reuse Existing Entities) ──
            # 1. Transport
            trans_route_val = (r.get(trans_route_field) or '').strip() if trans_route_field else ''
            if trans_route_val:
                try:
                    from app.models.transport import Route
                    from app.models.transport_student import StudentTransport
                    r_obj = Route.query.filter(
                        Route.school_id == school_id,
                        Route.name.ilike(f"%{trans_route_val}%")
                    ).first()
                    existing_trans = StudentTransport.query.filter_by(student_id=st_id, school_id=school_id).first()
                    if not existing_trans:
                        new_trans = StudentTransport(
                            school_id=school_id,
                            student_id=st_id,
                            route_id=r_obj.id if r_obj else None,
                            academic_year=session,
                            status='ACTIVE',
                            created_by=user_id
                        )
                        db.session.add(new_trans)
                except Exception as t_err:
                    print(f"[WARN] Transport assignment in migration: {t_err}")

            # 2. Hostel
            hostel_room_val = (r.get(hostel_room_field) or '').strip() if hostel_room_field else ''
            if hostel_room_val:
                try:
                    from app.models.hostel import HostelRoom, HostelBed, HostelBedAllocation
                    room_obj = HostelRoom.query.filter(
                        HostelRoom.school_id == school_id,
                        HostelRoom.room_number.ilike(f"%{hostel_room_val}%")
                    ).first()
                    if room_obj:
                        bed = HostelBed.query.filter_by(room_id=room_obj.id, status='AVAILABLE').first()
                        if bed:
                            alloc = HostelBedAllocation(
                                school_id=school_id,
                                student_id=st_id,
                                bed_id=bed.id,
                                room_id=room_obj.id,
                                status='ACTIVE',
                                allocated_at=utc_now()
                            )
                            bed.status = 'OCCUPIED'
                            db.session.add(alloc)
                except Exception as h_err:
                    print(f"[WARN] Hostel assignment in migration: {h_err}")

            # 3. Library
            lib_card_val = (r.get(lib_card_field) or '').strip() if lib_card_field else ''
            if lib_card_val:
                try:
                    from app.models.library import LibraryMember
                    st_user_id = existing_student.user_id if existing_student else user.id
                    existing_lib = LibraryMember.query.filter_by(school_id=school_id, user_id=st_user_id).first()
                    if not existing_lib:
                        lib_mem = LibraryMember(
                            school_id=school_id,
                            user_id=st_user_id,
                            card_number=lib_card_val,
                            member_type='STUDENT',
                            status='ACTIVE',
                            joined_at=utc_now()
                        )
                        db.session.add(lib_mem)
                except Exception as l_err:
                    print(f"[WARN] Library assignment in migration: {l_err}")

            # Add MigrationRecord log
            rec = MigrationRecord(
                batch_id=batch.id,
                school_id=school_id,
                student_id=st_id,
                legacy_admission_no=adm_no or final_adm_no,
                student_name=name,
                class_name=cls_name,
                section=sec,
                opening_balance=ob_val,
                legacy_paid_amount=paid_val,
                raw_data=r,
                status='UPDATED' if existing_student else 'SUCCESS'
            )
            db.session.add(rec)

        except Exception as row_err:
            failed_count += 1
            rec = MigrationRecord(
                batch_id=batch.id,
                school_id=school_id,
                student_name=(r.get(name_field) or 'Unknown'),
                raw_data=r,
                status='ERROR',
                error_message=str(row_err)
            )
            db.session.add(rec)

    batch.imported_count = imported_new
    batch.updated_count = updated_existing
    batch.failed_count = failed_count
    batch.total_opening_dues = round(total_ob_accum, 2)
    batch.total_legacy_paid = round(total_paid_accum, 2)

    db.session.commit()

    log_school_action(
        school_id=school_id,
        user=User.query.get(user_id) if user_id else None,
        module='academic',
        submodule='data_migration',
        action='MIGRATION_BATCH_EXECUTE',
        remarks=f"Batch {batch_no}: {imported_new} imported, {updated_existing} updated, ₹{total_ob_accum:,.2f} opening dues."
    )

    return {
        'batch_id': batch.id,
        'batch_no': batch.batch_no,
        'is_pilot': is_pilot,
        'total_processed': len(target_rows),
        'imported_new': imported_new,
        'updated_existing': updated_existing,
        'failed_count': failed_count,
        'total_opening_dues': round(total_ob_accum, 2),
        'total_legacy_paid': round(total_paid_accum, 2),
        'status': batch.status
    }


def get_migration_reconciliation_summary(batch_id: int, school_id: int) -> dict:
    """
    Computes comparative reconciliation:
    Old Legacy Source Records vs Actual Live Edu-ERP state.
    """
    batch = MigrationBatch.query.filter_by(id=batch_id, school_id=school_id).first()
    if not batch:
        return None

    records = MigrationRecord.query.filter_by(batch_id=batch.id).all()

    total_legacy_students = len(records)
    legacy_total_opening = sum(r.opening_balance or 0.0 for r in records)
    legacy_total_paid = sum(r.legacy_paid_amount or 0.0 for r in records)

    # Live ERP checks
    migrated_student_ids = [r.student_id for r in records if r.student_id]
    live_active_students = Student.query.filter(
        Student.id.in_(migrated_student_ids),
        Student.status == 'ACTIVE',
        Student.is_deleted == False
    ).count() if migrated_student_ids else 0

    live_opening_records = FeeRecord.query.filter(
        FeeRecord.student_id.in_(migrated_student_ids),
        FeeRecord.source == 'OPENING_BALANCE'
    ).all() if migrated_student_ids else []

    live_total_opening_due = sum(fr.amount_due or 0.0 for fr in live_opening_records)
    live_total_opening_paid = sum(fr.amount_paid or 0.0 for fr in live_opening_records)

    # Class-wise distribution
    class_breakdown = {}
    for r in records:
        c_key = f"{r.class_name} {r.section}".strip()
        if c_key not in class_breakdown:
            class_breakdown[c_key] = {'legacy_count': 0, 'legacy_dues': 0.0}
        class_breakdown[c_key]['legacy_count'] += 1
        class_breakdown[c_key]['legacy_dues'] += (r.opening_balance or 0.0)

    discrepancies = []
    if live_active_students != total_legacy_students:
        discrepancies.append(f"Student count mismatch: Legacy has {total_legacy_students}, ERP live active is {live_active_students}")
    if round(live_total_opening_due, 2) != round(legacy_total_opening, 2):
        discrepancies.append(f"Opening dues mismatch: Legacy has ₹{legacy_total_opening:,.2f}, ERP created ₹{live_total_opening_due:,.2f}")

    return {
        'batch_no': batch.batch_no,
        'session': batch.session,
        'source_type': batch.source_type,
        'source_filename': batch.source_filename,
        'status': batch.status,
        'is_pilot': batch.is_pilot,
        'legacy': {
            'total_students': total_legacy_students,
            'total_opening_dues': round(legacy_total_opening, 2),
            'total_paid': round(legacy_total_paid, 2)
        },
        'erp': {
            'live_active_students': live_active_students,
            'live_opening_due': round(live_total_opening_due, 2),
            'live_opening_paid': round(live_total_opening_paid, 2)
        },
        'is_reconciled': len(discrepancies) == 0,
        'discrepancies': discrepancies,
        'class_breakdown': class_breakdown
    }


def get_migration_spot_check_sample(batch_id: int, school_id: int, sample_size: int = 15) -> list:
    """
    Returns random sample students with their raw legacy record alongside their
    current live ERP profile for admin register comparison.
    """
    records = MigrationRecord.query.filter_by(
        batch_id=batch_id, school_id=school_id, status='SUCCESS'
    ).limit(sample_size * 2).all()
    selected = records[:sample_size] if records else []

    sample_out = []
    for r in selected:
        st = r.student
        ob_rec = FeeRecord.query.filter_by(student_id=st.id, source='OPENING_BALANCE').first() if st else None
        sample_out.append({
            'legacy': {
                'admission_no': r.legacy_admission_no,
                'name': r.student_name,
                'class': f"{r.class_name} {r.section}".strip(),
                'opening_balance': r.opening_balance,
                'raw': r.raw_data or {}
            },
            'erp': {
                'id': st.id if st else None,
                'admission_no': st.admission_no if st else '',
                'name': st.user.name if (st and st.user) else '',
                'class': f"{st.class_ref.name} {st.class_ref.section}".strip() if (st and st.class_ref) else '',
                'status': st.status if st else '',
                'parent_phone': st.parent_phone if st else '',
                'opening_fee_due': ob_rec.amount_due if ob_rec else 0.0
            },
            'matches': (
                st is not None and
                (st.admission_no or '').strip().lower() == (r.legacy_admission_no or '').strip().lower()
            )
        })
    return sample_out
