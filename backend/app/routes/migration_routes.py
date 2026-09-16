from flask import Blueprint, request, jsonify, Response
from app.utils.decorators import role_required, get_current_user
from app.models.school import School
from app.models.academic import Class
from app.models.migration import MigrationBatch, MigrationRecord
from app.services.migration_service import (
    auto_detect_mapping,
    parse_rows_from_stream,
    validate_migration_payload,
    execute_school_migration,
    get_migration_reconciliation_summary,
    get_migration_spot_check_sample,
    FIELD_ALIASES
)
import io
import csv

migration_bp = Blueprint('migration', __name__)


def _school_id():
    user = get_current_user()
    return user.school_id if user else None


@migration_bp.route('/sources', methods=['GET'])
@role_required('PRINCIPAL', 'SUPER_ADMIN')
def list_migration_sources():
    """
    Returns supported source types, canonical fields, and configuration guidelines.
    """
    sid = _school_id()
    school = School.query.get(sid)
    curr_session = school.current_session if school and school.current_session else '2026-27'

    sources = [
        {
            'id': 'EXCEL',
            'title': 'Excel / Spreadsheet (.xlsx, .xls)',
            'description': 'Upload your school student master sheet or multiple sheets.',
            'recommended': True,
            'icon': 'ti-file-spreadsheet'
        },
        {
            'id': 'CSV',
            'title': 'CSV File (.csv)',
            'description': 'Standard comma-separated text file exported from Google Sheets or old software.',
            'recommended': False,
            'icon': 'ti-file-text'
        },
        {
            'id': 'OLD_ERP',
            'title': 'Existing School ERP Export',
            'description': 'Export files from previous school software.',
            'recommended': False,
            'icon': 'ti-database-export'
        },
        {
            'id': 'REGISTER',
            'title': 'Paper Register / Notebook Entry',
            'description': 'For schools maintaining physical notebooks or registers without spreadsheets.',
            'recommended': False,
            'icon': 'ti-notebook'
        },
        {
            'id': 'MIXED',
            'title': 'Mixed Sources (Excel + Physical Fee Books)',
            'description': 'Students in Excel, but Fee opening balances/receipts in physical books.',
            'recommended': False,
            'icon': 'ti-folders'
        }
    ]

    canonical_fields = [
        {'key': 'admission_no', 'label': 'Admission / Scholar No', 'required': False, 'help': 'Legacy admission number. Will be strictly preserved.'},
        {'key': 'name', 'label': 'Student Full Name', 'required': True, 'help': 'Mandatory full name of pupil.'},
        {'key': 'class_name', 'label': 'Class / Standard', 'required': True, 'help': 'Target class (e.g. Class 7, 8, Nursery).'},
        {'key': 'section', 'label': 'Section', 'required': False, 'help': 'Section (A, B, C). Defaults to A if omitted.'},
        {'key': 'roll_number', 'label': 'Roll Number', 'required': False, 'help': 'Current class roll number.'},
        {'key': 'dob', 'label': 'Date of Birth', 'required': False, 'help': 'YYYY-MM-DD or DD/MM/YYYY.'},
        {'key': 'gender', 'label': 'Gender', 'required': False, 'help': 'Male / Female.'},
        {'key': 'father_name', 'label': "Father's Name", 'required': False, 'help': 'Used for login verification.'},
        {'key': 'mother_name', 'label': "Mother's Name", 'required': False, 'help': 'Mother name.'},
        {'key': 'parent_phone', 'label': 'Primary Mobile', 'required': False, 'help': '10-digit mobile number for portal login and SMS.'},
        {'key': 'parent_email', 'label': 'Parent Email', 'required': False, 'help': 'Parent contact email.'},
        {'key': 'address', 'label': 'Residential Address', 'required': False, 'help': 'Permanent address.'},
        {'key': 'blood_group', 'label': 'Blood Group', 'required': False, 'help': 'e.g. O+, B+, A+.'},
        {'key': 'category', 'label': 'Category', 'required': False, 'help': 'General / OBC / SC / ST / EWS.'},
        {'key': 'aadhar_no', 'label': 'Aadhar Number', 'required': False, 'help': 'Student 12-digit Aadhar.'},
        {'key': 'opening_balance', 'label': 'Opening Fee Dues (₹)', 'required': False, 'help': 'Current pending balance from old school books. Injected as previous dues without generating fake bills.'},
        {'key': 'legacy_paid_amount', 'label': 'Fee Paid in Old System (₹)', 'required': False, 'help': 'Historical amount already paid in legacy system.'},
        {'key': 'transport_route', 'label': 'Transport Route', 'required': False, 'help': 'Existing bus route name if applicable.'},
        {'key': 'transport_stop', 'label': 'Transport Stop', 'required': False, 'help': 'Pickup stop name.'},
        {'key': 'hostel_room', 'label': 'Hostel Room', 'required': False, 'help': 'Hostel room number.'},
        {'key': 'library_card', 'label': 'Library Card No', 'required': False, 'help': 'Existing library membership number.'},
    ]

    classes = Class.query.filter_by(school_id=sid).all()

    return jsonify({
        'sources': sources,
        'current_session': curr_session,
        'canonical_fields': canonical_fields,
        'existing_classes': [{'id': c.id, 'name': c.name, 'section': c.section} for c in classes]
    }), 200


@migration_bp.route('/detect', methods=['POST'])
@role_required('PRINCIPAL', 'SUPER_ADMIN')
def detect_columns():
    """
    Inspects uploaded CSV/Excel file, auto-detects column headers,
    and returns suggested canonical field mappings and sample rows.
    """
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    file = request.files['file']
    filename = file.filename or 'upload.csv'
    file_bytes = file.read()

    rows = parse_rows_from_stream(file_bytes, filename)
    if not rows:
        return jsonify({'error': 'Could not read any rows from the uploaded file. Please check file format.'}), 400

    raw_headers = list(rows[0].keys())
    suggested_mapping = auto_detect_mapping(raw_headers)

    return jsonify({
        'filename': filename,
        'total_rows_detected': len(rows),
        'raw_headers': raw_headers,
        'suggested_mapping': suggested_mapping,
        'preview_rows': rows[:5],
        'all_rows': rows
    }), 200


@migration_bp.route('/validate', methods=['POST'])
@role_required('PRINCIPAL', 'SUPER_ADMIN')
def validate_data():
    """
    Validates mapped migration rows, detects existing vs new students,
    and computes financial opening dues estimation.
    """
    sid = _school_id()
    data = request.get_json() or {}
    rows = data.get('rows') or []
    mapping = data.get('mapping') or {}
    session = data.get('session') or '2026-27'

    if not rows:
        return jsonify({'error': 'No rows provided for validation'}), 400

    analysis = validate_migration_payload(sid, rows, mapping, session)
    return jsonify(analysis), 200


@migration_bp.route('/execute', methods=['POST'])
@role_required('PRINCIPAL', 'SUPER_ADMIN')
def execute_migration():
    """
    Executes student onboarding data migration.
    Supports is_pilot=True for 10-20 student test batches.
    """
    sid = _school_id()
    user = get_current_user()
    data = request.get_json() or {}
    rows = data.get('rows') or []
    mapping = data.get('mapping') or {}
    session = data.get('session') or '2026-27'
    is_pilot = bool(data.get('is_pilot', False))
    pilot_limit = int(data.get('pilot_limit', 15))
    source_type = data.get('source_type', 'EXCEL')
    filename = data.get('filename', '')

    if not rows:
        return jsonify({'error': 'No rows provided for execution'}), 400

    result = execute_school_migration(
        school_id=sid,
        session=session,
        rows=rows,
        mapping=mapping,
        is_pilot=is_pilot,
        pilot_limit=pilot_limit,
        user_id=user.id if user else None,
        source_type=source_type,
        filename=filename
    )
    return jsonify(result), 201


@migration_bp.route('/batches', methods=['GET'])
@role_required('PRINCIPAL', 'SUPER_ADMIN')
def list_batches():
    """Returns list of migration batches executed for this school."""
    sid = _school_id()
    batches = MigrationBatch.query.filter_by(school_id=sid).order_by(MigrationBatch.id.desc()).all()
    return jsonify([b.to_dict() for b in batches]), 200


@migration_bp.route('/batches/<int:batch_id>', methods=['GET'])
@role_required('PRINCIPAL', 'SUPER_ADMIN')
def get_batch_detail(batch_id):
    """Returns batch metadata and first 50 migration records."""
    sid = _school_id()
    batch = MigrationBatch.query.filter_by(id=batch_id, school_id=sid).first_or_404()
    records = MigrationRecord.query.filter_by(batch_id=batch.id).limit(100).all()
    return jsonify({
        'batch': batch.to_dict(),
        'records': [r.to_dict() for r in records]
    }), 200


@migration_bp.route('/reconciliation/<int:batch_id>', methods=['GET'])
@role_required('PRINCIPAL', 'SUPER_ADMIN')
def get_reconciliation(batch_id):
    """Produces comparative reconciliation: Old Legacy Record VS Edu-ERP Live State."""
    sid = _school_id()
    summary = get_migration_reconciliation_summary(batch_id, sid)
    if not summary:
        return jsonify({'error': 'Batch not found'}), 404
    return jsonify(summary), 200


@migration_bp.route('/spot-check/<int:batch_id>', methods=['GET'])
@role_required('PRINCIPAL', 'SUPER_ADMIN')
def get_spot_check(batch_id):
    """Pulls random sample students for physical register comparison."""
    sid = _school_id()
    sample_size = int(request.args.get('size', 15))
    sample = get_migration_spot_check_sample(batch_id, sid, sample_size)
    return jsonify({
        'sample_size': len(sample),
        'students': sample
    }), 200


@migration_bp.route('/manual-entry', methods=['POST'])
@role_required('PRINCIPAL', 'SUPER_ADMIN')
def submit_manual_register_entries():
    """
    Accepts tabular manual rows entered by staff directly from physical registers / notebooks,
    and executes migration with opening balance ledger injection.
    """
    sid = _school_id()
    user = get_current_user()
    data = request.get_json() or {}
    students = data.get('students') or []
    session = data.get('session') or '2026-27'
    is_pilot = bool(data.get('is_pilot', False))

    if not students:
        return jsonify({'error': 'No student rows entered'}), 400

    # Direct mapping since keys are canonical in manual grid
    mapping = {k: k for k in [
        'admission_no', 'name', 'class_name', 'section', 'roll_number',
        'parent_phone', 'father_name', 'mother_name', 'dob', 'gender',
        'opening_balance', 'legacy_paid_amount', 'transport_route', 'hostel_room'
    ]}

    result = execute_school_migration(
        school_id=sid,
        session=session,
        rows=students,
        mapping=mapping,
        is_pilot=is_pilot,
        user_id=user.id if user else None,
        source_type='REGISTER',
        filename='Manual Register Entry'
    )
    return jsonify(result), 201


@migration_bp.route('/sample-template', methods=['GET'])
def download_sample_migration_template():
    """Generates standard CSV migration template with comprehensive real-world Indian school columns."""
    output = io.StringIO()
    writer = csv.writer(output)

    headers = [
        'Scholar No', 'Student Name', 'Class', 'Section', 'Roll No',
        'DOB (YYYY-MM-DD)', 'Gender', 'Father Name', 'Mother Name',
        'Mobile Number', 'Email', 'Address', 'Blood Group', 'Category',
        'Aadhar No', 'Opening Dues (Rs)', 'Amount Paid (Rs)',
        'Bus Route', 'Bus Stop', 'Hostel Room', 'Library Card No'
    ]
    writer.writerow(headers)

    writer.writerow([
        '2021/0142', 'Aarav Sharma', 'Class 8', 'A', '12',
        '2012-06-15', 'Male', 'Rajesh Sharma', 'Sunita Sharma',
        '9876543210', 'rajesh@example.com', 'Sector 14, Main Road', 'B+', 'General',
        '123456789012', '4500', '18000',
        'Route 1 - North City', 'Civil Lines', '', 'LIB-2021-0142'
    ])
    writer.writerow([
        '2022/0305', 'Ananya Patel', 'Class 6', 'B', '05',
        '2014-03-22', 'Female', 'Manoj Patel', 'Geeta Patel',
        '9811223344', 'manoj@example.com', 'Near Old Bus Stand', 'O+', 'OBC',
        '987654321098', '0', '22000',
        '', '', '', 'LIB-2022-0305'
    ])

    response = Response(output.getvalue(), mimetype='text/csv')
    response.headers['Content-Disposition'] = 'attachment; filename=school_data_migration_template.csv'
    return response
