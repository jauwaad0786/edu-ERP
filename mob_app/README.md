# EduERP Mobile App (`mob_app/`)

React Native (Expo) mobile client for the EduERP school management platform.

> **Does NOT create a separate backend.** This app consumes the exact same Flask backend, APIs, and database as the web frontend.

---

## Architecture

```
mob_app/
├── App.js                         ← Root: GestureHandler + SafeArea + Auth + Navigator
├── app.json                       ← Expo config (iOS, Android, web)
├── package.json                   ← Dependencies (Expo SDK 51)
├── .env.example                   ← Copy to .env for local dev
└── src/
    ├── api/
    │   └── client.js              ← Axios + JWT auto-refresh (SecureStore)
    ├── context/
    │   └── AuthContext.js         ← Login / logout / fetchMe
    ├── navigation/
    │   ├── AppNavigator.js        ← Role-based root navigator
    │   ├── tabBarStyle.js         ← Shared bottom tab styles
    │   └── role/
    │       ├── AdminNavigator.js
    │       ├── PrincipalNavigator.js
    │       ├── VicePrincipalNavigator.js
    │       ├── TeacherNavigator.js
    │       ├── StudentNavigator.js
    │       ├── ParentNavigator.js
    │       ├── AccountantNavigator.js
    │       ├── LibrarianNavigator.js
    │       ├── WardenNavigator.js
    │       ├── TransportNavigator.js
    │       └── HRNavigator.js
    └── screens/
        ├── auth/
        │   └── LoginScreen.js     ← Full login UI with school slug support
        ├── dashboard/             ← Role-specific dashboards (real API data)
        │   ├── AdminDashboardScreen.js
        │   ├── PrincipalDashboardScreen.js
        │   ├── VicePrincipalDashboardScreen.js
        │   ├── TeacherDashboardScreen.js      ← GPS check-in, class list
        │   ├── StudentDashboardScreen.js      ← Profile, attendance bar, fees
        │   ├── AccountantDashboardScreen.js
        │   ├── LibrarianDashboardScreen.js
        │   ├── WardenDashboardScreen.js
        │   ├── TransportDashboardScreen.js
        │   └── HRDashboardScreen.js
        ├── attendance/
        │   └── AttendanceScreen.js            ← Role-aware endpoint
        ├── fees/
        │   └── FeesScreen.js                  ← Student fee + history
        └── settings/
            └── SettingsScreen.js              ← Profile + logout (all roles)
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- `npm install -g expo-cli` (or use `npx expo`)
- Expo Go app on your phone (iOS App Store / Google Play)
- The EduERP Flask backend running

### Install & Run

```bash
cd mob_app

# Install dependencies
npm install

# Copy and configure env
cp .env.example .env
# Edit .env: set EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:5000

# Start development server
npx expo start

# Scan the QR code with Expo Go on your phone
```

### Local Development Notes

- Your phone and laptop must be on the **same WiFi network**
- Use your LAN IP (e.g., `192.168.1.5:5000`), NOT `localhost`
- The Flask backend should have CORS enabled for your LAN IP (it already does via `flask-cors`)
- **You do NOT need to rebuild the APK** when backend data changes — the app fetches live from the server

---

## Role Mapping

| Role | Navigator | Dashboard |
|---|---|---|
| SUPER_ADMIN / CEO | AdminNavigator | Platform-level stats |
| PRINCIPAL / DIRECTOR | PrincipalNavigator | School KPIs, attendance, fees |
| VICE_PRINCIPAL | VicePrincipalNavigator | Academic monitoring |
| TEACHER | TeacherNavigator | GPS check-in, classes, marks |
| STUDENT | StudentNavigator | Profile, attendance, fees, results |
| PARENT | ParentNavigator | Child's attendance, fees, transport |
| ACCOUNTANT | AccountantNavigator | Finance operations |
| LIBRARIAN | LibrarianNavigator | Book management, overdue |
| HOSTEL (Warden) | WardenNavigator | Occupancy, roll call, out-passes |
| TRANSPORT | TransportNavigator | Fleet status, routes, live tracking |
| HR | HRNavigator | Staff, leaves, payroll |

---

## Token Security

- JWT stored in **Expo SecureStore** (AES-256 on Android Keystore / iOS Keychain)
- Auto-refresh using `/api/auth/refresh` — same logic as web frontend
- Logout clears both access_token and refresh_token from SecureStore

---

## Build for Production

```bash
# Android APK (local build)
npx expo build:android

# iOS (requires Xcode / Apple Developer account)
npx expo build:ios

# Using EAS Build (recommended)
npm install -g eas-cli
eas build --platform android
eas build --platform ios
```

---

## No Separate Backend

This mobile app shares 100% of the business logic, APIs, and database with the web frontend. There is:
- No duplicate authentication
- No duplicate models
- No separate server
- No duplicate business logic

Everything is computed server-side and consumed via the same REST API.
