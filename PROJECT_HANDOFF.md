# IntelliSentry - Complete Project Handoff & Architecture Blueprint

> **DOCUMENT PURPOSE**: This document contains the full system architecture, database schema, workflow mechanics, API routes, layout architecture, and status details of the **IntelliSentry** project. If your session or account limits expire, any AI assistant or developer can read this document and seamlessly pick up where you left off.

---

## 1. Project Overview & Purpose

**IntelliSentry** is an AI-driven Hostel Access Control and Safety Monitoring System built for the **Islamic University of Science & Technology (IUST)**. It provides multi-factor campus access control combining:
- **Geofence GPS Location Radius Checks (Haversine Formula)**
- **Facial Biometric Embedding Authentication (DeepFace / OpenCV)**
- **Automated Parent 2FA SMS Verification via Twilio**
- **Split Exit Movement Control (Normal Exit vs Leave to Home)**
- **Dynamic Curfew Engine & Custom Gate Hour Controls**
- **Pre-Curfew Warning Alert Banners & Overdue Tracking**
- **Multi-Level Warden Emergency Override System**
- **Dedicated Admin Student Onboarding Portal & Profile Activation**
- **Strict Registration ID & Email Uniqueness Enforcement (Signup & Onboarding Pre-Checks)**
- **Fully Responsive Layout & Mobile Bottom Navigation Bar (5-Tab Access)**
- **Render Production Deployment Configuration**

---

## 2. Technology Stack & Environment

- **Frontend**: React.js (Vite), TailwindCSS, Lucide React Icons, Supabase JS Client v2, React Router DOM.
- **Backend Server**: Python 3.12, Flask, Flask-CORS, Gunicorn, OpenCV (`opencv-python-headless`), DeepFace, Haversine Geofencing, Twilio REST API SDK.
- **Frontend Host**: Deployed on **Vercel** (`https://intellisentry.vercel.app`).
- **Backend Host**: Deployed on **Render** (`https://intellisentry.onrender.com` / `gunicorn --bind 0.0.0.0:$PORT app:app`).
- **Database & Authentication**: Supabase PostgreSQL with Row Level Security (RLS) policies.
- **Virtual Environment Path**: `c:\Users\91903\Desktop\Coding\IntelliSentry\.venv\Scripts\python.exe`
- **Geofence Boundary Configuration**:
  - Campus Center: Latitude `34.056423`, Longitude `74.948681`
  - Radius Threshold: `500 meters` (Configurable in `server/app.py`, with Developer Location Bypass option in frontend modal)

---

## 3. Complete Database Schema & Structure

The system uses 6 core tables in Supabase (`public` schema):

### Table 1: `public.students`
Stores registered student profile accounts.
- `id` (UUID, Primary Key)
- `user_id` (UUID, Unique, linked to Supabase Auth)
- `name` (TEXT)
- `email` (TEXT, Unique)
- `phone` (TEXT) -- Student's personal phone number entered at signup
- `registration_number` (TEXT, Unique)
- `role` (TEXT, default `'student'`)
- `status` (TEXT, default `'PENDING'`) -- `'PENDING'` (Awaiting onboarding setup) or `'ACTIVE'`
- `created_at` (TIMESTAMP)

### Table 2: `public.university_details`
Official university records containing official parent contact information (cannot be edited by students).
- `id` (UUID, Primary Key)
- `registration_number` (TEXT, Unique)
- `hostel_name` (TEXT)
- `room_number` (TEXT)
- `floor` (TEXT)
- `warden_name` (TEXT)
- `parent_name` (TEXT)
- `parent_phone` (TEXT)
- `created_at` (TIMESTAMP)

### Table 3: `public.pass_requests`
Student Leave Pass requests with parent token and 2FA OTP tracking fields.
- `id` (UUID, Primary Key)
- `user_id` (UUID)
- `student_name` (TEXT)
- `registration_number` (TEXT)
- `leave_type` (TEXT)
- `reason` (TEXT)
- `leave_date` (TEXT)
- `leave_time` (TEXT)
- `return_date` (TEXT)
- `return_time` (TEXT)
- `parent_name` (TEXT)
- `parent_phone` (TEXT)
- `parent_status` (TEXT: `'PENDING'`, `'APPROVED'`, `'REJECTED'`)
- `admin_status` (TEXT: `'WAITING_FOR_PARENT'`, `'PENDING_ADMIN'`, `'APPROVED'`, `'REJECTED'`, `'COMPLETED'`)
- `final_status` (TEXT)
- `token` (TEXT, Unique - 256-bit URL-safe token)
- `token_expires_at` (TIMESTAMP)
- `token_used` (BOOLEAN, default `FALSE`)
- `otp_code` (TEXT - 6-digit OTP)
- `otp_expires_at` (TIMESTAMP)
- `otp_attempts` (INTEGER, default `0`)
- `otp_last_sent_at` (TIMESTAMP)
- `otp_verified` (BOOLEAN, default `FALSE`)
- `created_at` (TIMESTAMP)

### Table 4: `public.attendance_logs`
Geofence & Biometric gate movement logs.
- `id` (UUID, Primary Key)
- `user_id` (UUID)
- `student_name` (TEXT)
- `registration_number` (TEXT)
- `type` (TEXT: `'Entry'`, `'Exit (Normal)'`, `'Exit (Leave to Home)'`)
- `exit_type` (TEXT: `'ENTRY'`, `'NORMAL_EXIT'`, `'LEAVE_TO_HOME'`)
- `expected_return_time` (TEXT)
- `leave_pass_id` (UUID, Foreign Key referencing `pass_requests.id`)
- `status` (TEXT, default `'AUTHORIZED'`)
- `method` (TEXT, default `'Geofence + Biometric AI'`, or `'Warden Emergency Override'`)
- `created_at` (TIMESTAMP)

### Table 5: `public.face_embeddings`
Registered student facial feature embedding vectors for DeepFace match verification.
- `id` (UUID, Primary Key)
- `user_id` (UUID)
- `registration_number` (TEXT)
- `embedding` (TEXT / JSON)

### Table 6: `public.system_settings`
Global system configurations including dynamic curfew settings.
- `id` (UUID, Primary Key)
- `key` (TEXT, Unique, e.g. `'curfew_config'`)
- `value` (JSONB / JSON, e.g. `{ "startHour": 17, "endHour": 8, "warningMins": 60 }`)

---

## 4. Master Consolidated SQL Migration Script

Run this SQL script in **Supabase SQL Editor** to establish all tables and RLS policies:

```sql
-- =========================================================
-- IntelliSentry Master Database Setup
-- Run this in Supabase Project -> SQL Editor
-- =========================================================

-- 1. Students Table
CREATE TABLE IF NOT EXISTS public.students (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID UNIQUE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    registration_number TEXT UNIQUE,
    role TEXT DEFAULT 'student',
    status TEXT DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING';
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Students" ON public.students;
DROP POLICY IF EXISTS "Public Insert Students" ON public.students;
DROP POLICY IF EXISTS "Public Update Students" ON public.students;
CREATE POLICY "Public Read Students" ON public.students FOR SELECT USING (true);
CREATE POLICY "Public Insert Students" ON public.students FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update Students" ON public.students FOR UPDATE USING (true);

-- 2. University Details Table (Official Parent Contacts)
CREATE TABLE IF NOT EXISTS public.university_details (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    registration_number TEXT UNIQUE NOT NULL,
    hostel_name TEXT,
    room_number TEXT,
    floor TEXT,
    warden_name TEXT,
    parent_name TEXT,
    parent_phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.university_details ADD COLUMN IF NOT EXISTS parent_name TEXT;
ALTER TABLE public.university_details ADD COLUMN IF NOT EXISTS parent_phone TEXT;
ALTER TABLE public.university_details ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read University Details" ON public.university_details;
DROP POLICY IF EXISTS "Public Insert University Details" ON public.university_details;
DROP POLICY IF EXISTS "Public Update University Details" ON public.university_details;
CREATE POLICY "Public Read University Details" ON public.university_details FOR SELECT USING (true);
CREATE POLICY "Public Insert University Details" ON public.university_details FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update University Details" ON public.university_details FOR UPDATE USING (true);

-- 3. Pass Requests Table
CREATE TABLE IF NOT EXISTS public.pass_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    student_name TEXT NOT NULL,
    registration_number TEXT NOT NULL,
    leave_type TEXT NOT NULL DEFAULT 'Weekend Home Pass',
    reason TEXT NOT NULL,
    leave_date TEXT NOT NULL,
    leave_time TEXT NOT NULL,
    return_date TEXT NOT NULL,
    return_time TEXT NOT NULL,
    parent_name TEXT NOT NULL,
    parent_phone TEXT NOT NULL,
    parent_status TEXT NOT NULL DEFAULT 'PENDING',
    admin_status TEXT NOT NULL DEFAULT 'WAITING_FOR_PARENT',
    final_status TEXT NOT NULL DEFAULT 'Waiting for Parent Approval',
    token TEXT UNIQUE,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    token_used BOOLEAN DEFAULT FALSE,
    otp_code TEXT,
    otp_expires_at TIMESTAMP WITH TIME ZONE,
    otp_attempts INTEGER DEFAULT 0,
    otp_last_sent_at TIMESTAMP WITH TIME ZONE,
    otp_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.pass_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Pass Requests" ON public.pass_requests;
DROP POLICY IF EXISTS "Public Insert Pass Requests" ON public.pass_requests;
DROP POLICY IF EXISTS "Public Update Pass Requests" ON public.pass_requests;
DROP POLICY IF EXISTS "Public Delete Pass Requests" ON public.pass_requests;
CREATE POLICY "Public Read Pass Requests" ON public.pass_requests FOR SELECT USING (true);
CREATE POLICY "Public Insert Pass Requests" ON public.pass_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update Pass Requests" ON public.pass_requests FOR UPDATE USING (true);
CREATE POLICY "Public Delete Pass Requests" ON public.pass_requests FOR DELETE USING (true);

-- 4. Attendance Logs Table
CREATE TABLE IF NOT EXISTS public.attendance_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    student_name TEXT NOT NULL,
    registration_number TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'Entry',
    exit_type TEXT DEFAULT 'NORMAL_EXIT',
    expected_return_time TEXT,
    leave_pass_id UUID REFERENCES public.pass_requests(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'AUTHORIZED',
    method TEXT NOT NULL DEFAULT 'Geofence + Biometric AI',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Attendance Logs" ON public.attendance_logs;
DROP POLICY IF EXISTS "Public Insert Attendance Logs" ON public.attendance_logs;
CREATE POLICY "Public Read Attendance Logs" ON public.attendance_logs FOR SELECT USING (true);
CREATE POLICY "Public Insert Attendance Logs" ON public.attendance_logs FOR INSERT WITH CHECK (true);

-- 5. System Settings Table (Dynamic Curfew Config)
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read System Settings" ON public.system_settings;
DROP POLICY IF EXISTS "Public Upsert System Settings" ON public.system_settings;
CREATE POLICY "Public Read System Settings" ON public.system_settings FOR SELECT USING (true);
CREATE POLICY "Public Upsert System Settings" ON public.system_settings FOR ALL USING (true);
```

---

## 5. Complete Backend API Route Registry (`server/app.py`)

| Method | Route | Description |
| :--- | :--- | :--- |
| `POST` | `/location-status` | Accepts `{ lat, lng, bypass_geofence }` and returns Haversine distance to campus geofence (inside: true/false). |
| `POST` | `/enroll-face` | Accepts `{ user_id, registration_number, image }`, extracts face embeddings, stores vector in `face_embeddings`. |
| `POST` | `/verify-face` | Accepts captured webcam image & landmarks, checks curfew guardrail (supports `bypass_curfew`), compares embedding, returns match status. |
| `POST` | `/log-attendance` | Saves gate scan to `attendance_logs` (`type`, `exit_type`, `expected_return_time`, `leave_pass_id`). |
| `POST` | `/create-pass-request` | Pulls official parent details from `university_details`, generates 256-bit token, saves pass request, sends Twilio SMS. |
| `POST` | `/api/parent/verify-token` | Validates token/link existence, single-use state, 24h expiry, and returns masked parent phone number. |
| `POST` | `/api/parent/send-otp` | Generates 6-digit OTP code, sets 10min expiry, sends Twilio SMS. Enforces 60-second rate limits. |
| `POST` | `/api/parent/verify-otp` | Verifies 6-digit OTP code. Enforces max 5 failed attempts before locking. |
| `POST` | `/api/parent/submit-decision` | Requires valid token & verified OTP, updates `parent_status` (`APPROVED`/`REJECTED`), and invalidates token. |
| `DELETE` | `/delete-pass-request/<id>` | Forcefully deletes pass request row by ID using Supabase service role key (bypasses RLS). |

---

## 6. System Features & Workflows

### A. Dynamic Curfew Engine & Custom Gate Controls
1. **Dynamic Curfew Config Module (`curfewConfig.js`)**:
   - Centralized management of `startHour` (e.g. 5:00 PM), `endHour` (e.g. 8:00 AM), and `warningMins` (e.g. 60 mins).
   - Synchronizes between `localStorage` and Supabase `public.system_settings`.
2. **Admin Dashboard Control Panel (`AdminDashboard.jsx`)**:
   - **`⚙️ Curfew Config`** button opens interactive modal.
   - Admins can set custom curfew start times (4:00 PM – 11:00 PM), end times (5:00 AM – 9:00 AM), and warning lead times.
3. **Strict Bidirectional Curfew Lockouts**:
   - During curfew hours, **both** campus Exits (Normal & Home Exit) AND Hostel Entry scans are locked (`🔒 Gate Closed`).
   - UI badges, return deadlines, and alert banners update in real-time across student and admin dashboards.

### B. Pre-Curfew Warning & Overdue Alert Banners
1. **Pre-Curfew Warning Banner**:
   - Triggered when a student is marked `OUT` during the pre-curfew window (e.g., 60 minutes before curfew).
   - Displays an animated amber alert (`⏰ URGENT CURFEW ALERT: Gate Closing Soon!`) with live countdown minutes.
2. **Active Curfew Overdue Banner**:
   - Replaces warning if student is marked `OUT` during active curfew hours (`🔒 CURFEW ACTIVE: GATE CLOSED`).

### C. Exclusive Admin Emergency Authorization System
1. **Warden Emergency Entry Clearance (Admin Dashboard)**:
   - In the **Outside After Curfew** modal on `/admin-dashboard`, wardens click **"Authorize Entry"** to log an emergency entry scan with method `Warden Emergency Override`, instantly clearing the student.
2. **Warden Emergency Exit Clearance (Admin Dashboard)**:
   - In the **Inside Premises** modal on `/admin-dashboard`, wardens click **"Authorize Exit"** to log an emergency exit scan for students requiring emergency outbound movement during curfew.
3. **Student Portal Protocol (Student Device)**:
   - All student-side PIN input options have been removed for maximum security. During curfew, students see a clear alert directing them to report to the Hostel Warden Office for authorization.
4. **Backend API Bypass (`bypass_curfew`)**:
   - `/verify-face` accepts `"bypass_curfew": true` in POST payload to override curfew checks for warden APIs.

### D. Secure Parent Pass & 2FA OTP Request Flow via Twilio
1. **Creation (`POST /create-pass-request`)**:
   - Student submits pass request on `/pass-requests`.
   - Backend automatically queries `public.university_details` by `registration_number` to pull official `parent_name` & `parent_phone`.
   - Generates cryptographically secure single-use 24-hour token (`secrets.token_urlsafe(32)`).
   - Generates approval URL pointing to production frontend domain (`https://intellisentry.vercel.app/parent-approval/<token>`).
   - Formats phone numbers automatically (`format_phone_number()`) to E.164 standard (`+916005674521`).
   - Dispatches live SMS notification to parent via Twilio.
2. **Parent OTP Authorization (`ParentApproval.jsx`)**:
   - Parent opens `/parent-approval/<token>` -> requests 6-digit OTP SMS -> verifies OTP -> approves or rejects request.
   - 6-digit OTP is generated on backend via Python's secure `secrets` module, valid for 10 minutes, with 60-second resend rate limits and 5-attempt locking.
3. **Warden / Admin Final Pass Approval (`AdminPasses.jsx`)**:
   - Admin grants final approval (`APPROVED`).

### E. Split Exit & Entry Movement Control
1. **Enter into Hostel**: Return scan with Geofence GPS + Biometric AI. Prevents duplicate entries.
2. **Normal Exit**: Local outings during standard non-curfew hours.
3. **Exit to Home**: Requires approved Leave Pass and non-curfew hours.

### F. Dedicated Student Onboarding & Registration Security (`AdminOnboarding.jsx` & `Signup.jsx`)
1. **Strict Registration ID & Email Uniqueness Enforcement**:
   - **Student Signup (`Signup.jsx`)**: Pre-checks Registration ID (`registration_number.ilike`) and Email (`email.ilike`) against `public.students` *before* calling `supabase.auth.signUp()`. This prevents orphaned Auth accounts and provides clean error messages (e.g., `"Registration Number 'IUST...' is already registered"`).
   - **Admin Onboarding (`AdminOnboarding.jsx`)**: Pre-checks if the assigned `registration_number` belongs to another student (`id != current_student.id`) before updating database records, displaying explicit warning messages if a conflict occurs.
   - **Uppercase Normalization**: Both Signup and Admin Onboarding automatically trim and convert all Registration IDs to uppercase (`trim().toUpperCase()`) for consistent database collation.
2. **Profile Activation & Cascade Sync**:
   - Admins onboard new pending students by completing hostel assignment, parent contacts, and registration IDs.
   - **Cascade Sync**: Automatically updates linked records across `face_embeddings`, `pass_requests`, and `attendance_logs`.

### G. Render & Vercel Cloud Deployment Configuration
- **Central API Base URL Config (`client/src/apiConfig.js`)**:
  - Dynamically switches between production backend (`https://intellisentry.onrender.com`) and local development (`http://127.0.0.1:5000`) based on `VITE_API_BASE_URL`.
- **Backend Credential Sanitization (`server/sms_service.py`)**:
  - Auto-strips trailing spaces, newlines, and quotes from `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE_NUMBER` to prevent 404/401 API errors on Render.
- **Headless Linux Fix**: Backend includes `opencv-python-headless` (prevents `libGL.so.1` Linux load crashes).
- **Port Binding**: Port binding uses `port = int(os.environ.get("PORT", 5000))`.
- **Start Command**: `gunicorn --bind 0.0.0.0:$PORT app:app`.
- **SPA 404 Refresh Fix**: Includes `client/public/_redirects` (`/* /index.html 200`) and `client/vercel.json` to prevent 404 errors on page refresh for deployed React router URLs (Render, Netlify, Vercel).

---

## 7. Key Source Code Files

- **`server/app.py`**: Flask server API endpoints & Render deployment port binding.
- **`server/sms_service.py`**: Twilio SMS & OTP notification module with E.164 phone formatting and environment sanitization.
- **`server/requirements.txt`**: Production requirements (`opencv-python-headless`, `gunicorn`, `numpy`, `requests`, `twilio`, `flask`, `flask-cors`, `python-dotenv`, `pyproj`, `shapely`).
- **`client/src/apiConfig.js`**: Centralized API Base URL configuration for Vercel/Render production environments.
- **`client/src/utils/curfewConfig.js`**: Centralized curfew settings helper module.
- **`client/src/pages/Signup.jsx`**: Student registration page with Registration ID & Email uniqueness pre-checks, case normalization, and Auth account creation.
- **`client/src/pages/StudentDashboard.jsx`**: Student portal with dynamic curfew locks, warning banners, movement cards, and Warden Contact Info modal.
- **`client/src/pages/AdminDashboard.jsx`**: Master attendance audit portal with **`⚙️ Curfew Config`** modal, overdue student tracking, Warden Authorize Entry/Exit clearance buttons, and CSV exporter.
- **`client/src/pages/AdminOnboarding.jsx`**: Dedicated Student Onboarding portal with interactive profile completion modal, Registration ID conflict validation, and cascade ID sync.
- **`client/src/pages/PassRequests.jsx`**: Student Leave Pass management page with biometric return auto-completion.
- **`client/src/pages/AdminPasses.jsx`**: Warden / Admin pass review portal.
- **`client/src/components/VerificationModal.jsx`**: Geofence GPS + Biometric camera verification modal.
- **`client/src/components/Sidebar.jsx`**: Dual-mode desktop sidebar & mobile 5-tab bottom navigation bar.

---

## 8. How to Run & Test

1. **Start Backend Server**:
   ```powershell
   cd server
   c:\Users\91903\Desktop\Coding\IntelliSentry\.venv\Scripts\python.exe app.py
   ```
2. **Start Frontend Client**:
   ```powershell
   cd client
   npm run dev
   ```
3. **Run Automated Test Suite**:
   ```powershell
   cd server
   c:\Users\91903\Desktop\Coding\IntelliSentry\.venv\Scripts\python.exe test_parent_flow.py
   ```
