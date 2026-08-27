# EduERP — Enterprise School Management System

> Salesforce-style ERP for Schools, Colleges, Hospitals & Industry  
> Built with Flask + React | JWT Auth | Role-Based Access

---

## 🏗️ Project Structure

```
EduERP/
├── backend/          # Flask REST API
│   ├── app/
│   │   ├── models/   # SQLAlchemy DB models
│   │   ├── routes/   # API endpoints (auth, admin, principal, teacher, student)
│   │   └── utils/    # JWT decorators, PDF generator
│   ├── requirements.txt
│   ├── config.py
│   ├── run.py
│   └── .env.example
└── frontend/         # React App
    └── src/
        ├── pages/    # Landing, Login, Dashboards
        ├── components/ # Sidebar, Navbar, etc.
        ├── context/  # AuthContext
        └── api/      # Axios instance
```

---

## ⚙️ Roles & Access

| Role         | Access |
|--------------|--------|
| SUPER_ADMIN  | All schools, assign school access |
| PRINCIPAL    | Own school only — teachers, students, fees, results |
| TEACHER      | Own classes — attendance, marks, notes upload |
| STUDENT      | Own profile — results, fees, timetable |
| PARENT       | Child's profile — results, attendance, fees |

---


### 1. Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/EduERP.git
cd EduERP
```

### 2. Backend Setup
```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# Mac/Linux
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# Edit .env with your SECRET_KEY

python run.py
# API runs at http://localhost:5000
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm start
# App runs at http://localhost:3000
```

---

## 🔄 Git Workflow (Office → Home)

```bash
# Office → push work
git add .
git commit -m "feat: attendance module"
git push origin main

# Home → pull and continue
git pull origin main
cd backend && venv\Scripts\activate && pip install -r requirements.txt
cd frontend && npm install
```

---

## 📦 Tech Stack

| Layer      | Tech |
|------------|------|
| Backend    | Python, Flask, SQLAlchemy, Flask-JWT-Extended |
| Frontend   | React, React Router v6, Axios |
| Database   | SQLite (dev) → PostgreSQL (prod) |
| Auth       | JWT (Access + Refresh tokens), bcrypt |
| PDF Gen    | ReportLab (admit card, result card) |
| Styling    | Custom CSS (Salesforce Lightning inspired) |

---

## 🎨 Design System

- **Primary**: `#0176d3` (Salesforce Blue)
- **Dark**: `#032d60`
- **Surface**: `#f3f2f2`
- **Font**: Plus Jakarta Sans

---

## 📋 Features

- ✅ Attendance Management (daily, monthly reports)
- ✅ Result Card (auto-generate PDF from marks)
- ✅ Admit Card (auto-generate with roll numbers)
- ✅ Fees Management (per student, per class, total revenue)
- ✅ Teacher Management Dashboard
- ✅ Notes Upload by Teacher
- ✅ Marks Entry by Teacher
- ✅ Role-Based Dashboards (Principal / Teacher / Student / Parent)
- ✅ Super Admin — assign school access
- 🔜 College Module
- 🔜 Hospital Module
- 🔜 Industry Module
