import os
import sys
from datetime import datetime, date, timedelta
from app import create_app, db
from app.models.school import School
from app.models.user import User, UserRole
from app.models.academic import Student, Teacher, Class
from app.models.library import (
    Book, BookCopy, BookCategory, LibraryMember,
    BookIssue, FineTransaction, LibrarySettings
)

def seed_library():
    app = create_app()
    with app.app_context():
        school1 = School.query.get(1)
        if not school1:
            print("School 1 not found. Exiting.")
            return

        print(f"[*] Seeding Library catalog for School: {school1.name} (ID: {school1.id})...")

        # 1. Library Settings
        settings = LibrarySettings.query.filter_by(school_id=school1.id).first()
        if not settings:
            settings = LibrarySettings(
                school_id=school1.id,
                student_max_books=3,
                teacher_max_books=10,
                issue_duration_days=14,
                fine_per_day=5.0,
                max_renewal_times=2,
                allow_issue_if_overdue=False,
                damaged_book_fine_multiplier=0.5,
                lost_card_fine=50.0,
                missing_pages_fine=100.0,
            )
            db.session.add(settings)
            db.session.commit()
            print("  [+] Seeded LibrarySettings")

        # 2. Categories
        cat_data = [
            ("Science & Technology", "Physics, Chemistry, Biology and Engineering resources"),
            ("Mathematics", "Algebra, Calculus, Geometry, and NCERT reference books"),
            ("English Literature", "Novels, Classic plays, Poetry, and Grammar guides"),
            ("Computer Science & AI", "Python, Web Development, Databases and Artificial Intelligence"),
            ("Social Studies & History", "World History, Civics, Geography and Indian Polity"),
            ("General Knowledge & Fiction", "Encyclopedias, biographies, quiz books, and popular fiction"),
        ]
        cat_map = {}
        for name, desc in cat_data:
            cat = BookCategory.query.filter_by(school_id=school1.id, name=name).first()
            if not cat:
                cat = BookCategory(school_id=school1.id, name=name, description=desc)
                db.session.add(cat)
                db.session.flush()
            cat_map[name] = cat.id
        db.session.commit()
        print("  [+] Seeded Categories")

        # 3. Books Catalog
        sample_books = [
            {
                "title": "Concepts of Physics (Vol 1 & 2)",
                "author": "Dr. H.C. Verma",
                "publisher": "Bharati Bhawan",
                "category": "Science & Technology",
                "subject": "Physics",
                "isbn": "978-8177091878",
                "edition": "2024 Revised",
                "language": "English",
                "rack": "Rack-A",
                "shelf": "Shelf-1",
                "purchase_price": 420.0,
                "mrp": 495.0,
                "copies_count": 4,
                "description": "Standard comprehensive physics textbook for secondary and higher secondary students.",
            },
            {
                "title": "Mathematics for Class 10 (RD Sharma)",
                "author": "Dr. R.D. Sharma",
                "publisher": "Dhanpat Rai Publications",
                "category": "Mathematics",
                "subject": "Mathematics",
                "isbn": "978-9383182855",
                "edition": "12th Edition",
                "language": "English",
                "rack": "Rack-A",
                "shelf": "Shelf-2",
                "purchase_price": 550.0,
                "mrp": 650.0,
                "copies_count": 5,
                "description": "Comprehensive mathematics reference guide with solved exercises and board questions.",
            },
            {
                "title": "Computer Science with Python",
                "author": "Sumita Arora",
                "publisher": "Dhanpat Rai & Co.",
                "category": "Computer Science & AI",
                "subject": "Computer Science",
                "isbn": "978-9389972344",
                "edition": "2025 Edition",
                "language": "English",
                "rack": "Rack-B",
                "shelf": "Shelf-1",
                "purchase_price": 480.0,
                "mrp": 540.0,
                "copies_count": 4,
                "description": "Class XI & XII Computer Science reference covering Python, Data Structures, and SQL.",
            },
            {
                "title": "Wings of Fire: An Autobiography",
                "author": "Dr. A.P.J. Abdul Kalam",
                "publisher": "Universities Press",
                "category": "General Knowledge & Fiction",
                "subject": "Biography",
                "isbn": "978-8173711463",
                "edition": "Collector Edition",
                "language": "English",
                "rack": "Rack-C",
                "shelf": "Shelf-1",
                "purchase_price": 280.0,
                "mrp": 350.0,
                "copies_count": 3,
                "description": "Inspirational autobiography of the Missile Man and 11th President of India.",
            },
            {
                "title": "To Kill a Mockingbird",
                "author": "Harper Lee",
                "publisher": "HarperCollins",
                "category": "English Literature",
                "subject": "English Classic",
                "isbn": "978-0060935467",
                "edition": "50th Anniversary",
                "language": "English",
                "rack": "Rack-C",
                "shelf": "Shelf-3",
                "purchase_price": 320.0,
                "mrp": 399.0,
                "copies_count": 3,
                "description": "Pulitzer Prize winning classic exploring themes of justice and compassion.",
            },
            {
                "title": "India: A History",
                "author": "John Keay",
                "publisher": "HarperPress",
                "category": "Social Studies & History",
                "subject": "History",
                "isbn": "978-0007307753",
                "edition": "2nd Edition",
                "language": "English",
                "rack": "Rack-D",
                "shelf": "Shelf-2",
                "purchase_price": 600.0,
                "mrp": 799.0,
                "copies_count": 3,
                "description": "Five thousand years of the Indian subcontinent from Harappa to modern democracy.",
            },
            {
                "title": "NCERT Exemplar Problems - Biology Class 12",
                "author": "NCERT Editorial Team",
                "publisher": "NCERT",
                "category": "Science & Technology",
                "subject": "Biology",
                "isbn": "978-9350077821",
                "edition": "Latest",
                "language": "English",
                "rack": "Rack-A",
                "shelf": "Shelf-3",
                "purchase_price": 150.0,
                "mrp": 180.0,
                "copies_count": 4,
                "description": "Challenging problems and case study questions for CBSE Board & NEET preparation.",
            },
            {
                "title": "A Brief History of Time",
                "author": "Stephen Hawking",
                "publisher": "Bantam Books",
                "category": "Science & Technology",
                "subject": "Cosmology",
                "isbn": "978-0553380163",
                "edition": "Illustrated",
                "language": "English",
                "rack": "Rack-B",
                "shelf": "Shelf-4",
                "purchase_price": 450.0,
                "mrp": 599.0,
                "copies_count": 2,
                "description": "Landmark volume in science writing about the origin, evolution, and nature of the universe.",
            },
        ]

        barcode_idx = 101
        for b_data in sample_books:
            existing = Book.query.filter_by(school_id=school1.id, title=b_data["title"]).first()
            if not existing:
                cat_id = cat_map.get(b_data["category"])
                book = Book(
                    school_id=school1.id,
                    title=b_data["title"],
                    author=b_data["author"],
                    publisher=b_data["publisher"],
                    category_id=cat_id,
                    subject=b_data["subject"],
                    isbn=b_data["isbn"],
                    edition=b_data["edition"],
                    language=b_data["language"],
                    rack=b_data["rack"],
                    shelf=b_data["shelf"],
                    purchase_price=b_data["purchase_price"],
                    mrp=b_data["mrp"],
                    description=b_data["description"],
                    is_active=True,
                )
                db.session.add(book)
                db.session.flush()

                # Physical copies
                for c_num in range(1, b_data["copies_count"] + 1):
                    accession = f"ACC-{school1.code}-{book.id:03d}-{c_num:02d}"
                    barcode = f"890{school1.id:02d}{book.id:04d}{c_num:03d}"
                    copy = BookCopy(
                        book_id=book.id,
                        school_id=school1.id,
                        copy_accession_no=accession,
                        barcode=barcode,
                        status="AVAILABLE",
                        shelf_location=f"{b_data['rack']}/{b_data['shelf']}",
                    )
                    db.session.add(copy)
                print(f"  [+] Added Book: {book.title} ({b_data['copies_count']} copies)")

        db.session.commit()

        # 4. Enroll Students & Teachers as Library Members if not already enrolled
        users = User.query.filter_by(school_id=school1.id).all()
        enrolled_count = 0
        for u in users:
            if u.role in (UserRole.STUDENT, UserRole.TEACHER):
                m = LibraryMember.query.filter_by(school_id=school1.id, user_id=u.id).first()
                if not m:
                    card_no = f"LIB-{school1.code}-{u.id:04d}"
                    m = LibraryMember(
                        school_id=school1.id,
                        user_id=u.id,
                        card_number=card_no,
                        member_type="STUDENT" if u.role == UserRole.STUDENT else "TEACHER",
                        status="ACTIVE",
                    )
                    db.session.add(m)
                    enrolled_count += 1
        db.session.commit()
        print(f"  [+] Enrolled {enrolled_count} members.")

        print("\n✅ Library Sample Catalog Seeded Successfully!")

if __name__ == '__main__':
    seed_library()
