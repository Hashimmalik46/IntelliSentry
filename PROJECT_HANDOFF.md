# IntelliSentry - Complete Project Handoff & Architecture Blueprint

> **DOCUMENT PURPOSE**: This document contains the full system architecture, database schema, workflow mechanics, API routes, and status details of the **IntelliSentry** project. If your session or account limits expire, any AI assistant or developer can read this document and seamlessly pick up where you left off.

---

## 1. Project Overview & Purpose

**IntelliSentry** is an AI-driven Hostel Access Control and Safety Monitoring System built for the **Islamic University of Science & Technology (IUST)**. It provides multi-factor campus access control combining:
- **Geofence GPS Location Radius Checks (Haversine Formula)**
- **Facial Biometric Embedding Authentication (DeepFace / OpenCV)**
- **Automated Parent 2FA SMS Verification via Twilio**
- **Split Exit Movement Control (Normal Exit vs Leave to Home)**
- **Real-Time Admin Oversight & Master Access Audit Logs**

---

## 2. Technology Stack & Environment

- **Frontend**: React.js (Vite), TailwindCSS, Lucide React Icons, Supabase JS Client v2, React Router DOM.
- **Backend Server**: Python 3.12, Flask, Flask-CORS, DeepFace / OpenCV, Haversine Geofencing, Twilio REST API SDK.
- **Database & Authentication**: Supabase PostgreSQL with Row Level Security (RLS) policies.
- **Virtual Environment Path**: `c:\Users\91903\Desktop\Coding\IntelliSentry\.venv\Scripts\python.exe`
- **Geofence Boundary Configuration**:
  - Campus Center: Latitude `33.9255`, Longitude `74.9080` (IUST Campus)
  - Radius Threshold: `200 meters` (Configurable in `server/haversine_check.py`, with Developer Location Bypass option in frontend modal)

---

## 3. Complete Database Schema & Structure

The system uses 5 core tables in Supabase (`public` schema):

### Table 1: `public.students`
Stores registered student profile accounts.
- `id` (UUID, Primary Key)
- `user_id` (UUID, Unique, linked to Supabase Auth)
- `name` (TEXT)
- `email` (TEXT, Unique)
- `registration_number` (TEXT, Unique)
- `role` (TEXT, default `'student'`)
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
- `method` (TEXT, default `'Geofence + Biometric AI'`)
- `created_at` (TIMESTAMP)

### Table 5: `public.face_embeddings`
Registered student facial feature embedding vectors for DeepFace match verification.
- `id` (UUID, Primary Key)
- `user_id` (UUID)
- `registration_number` (TEXT)
- `embedding` (TEXT / JSON)

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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

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
```

---

## 5. Complete Backend API Route Registry (`server/app.py`)

| Method | Route | Description |
| :--- | :--- | :--- |
| `POST` | `/location-status` | Accepts `{ lat, lng, bypass_geofence }` and returns Haversine distance to IUST campus (inside: true/false). |
| `POST` | `/enroll-face` | Accepts `{ user_id, registration_number, image }`, extracts face embeddings, stores vector in `face_embeddings`. |
| `POST` | `/verify-face` | Accepts captured webcam image & landmarks, compares embedding against registered profile, returns match status. |
| `POST` | `/log-attendance` | Saves gate scan to `attendance_logs` (`type`, `exit_type`, `expected_return_time`, `leave_pass_id`). |
| `POST` | `/create-pass-request` | Pulls official parent details from `university_details`, generates 256-bit token, saves pass request, sends Twilio SMS. |
| `POST` | `/api/parent/verify-token` | Validates token/link existence, single-use state, 24h expiry, and returns masked parent phone number. |
| `POST` | `/api/parent/send-otp` | Generates 6-digit OTP code, sets 10min expiry, sends Twilio SMS. Enforces 60-second rate limits. |
| `POST` | `/api/parent/verify-otp` | Verifies 6-digit OTP code. Enforces max 5 failed attempts before locking. |
| `POST` | `/api/parent/submit-decision` | Requires valid token & verified OTP, updates `parent_status` (`APPROVED`/`REJECTED`), and invalidates token. |
| `DELETE` | `/delete-pass-request/<id>` | Forcefully deletes pass request row by ID using Supabase service role key (bypasses RLS). |

---

## 6. System Features & Workflows

### A. Secure Parent Pass & 2FA OTP Request Flow
1. **Creation (`POST /create-pass-request`)**:
   - Student submits pass request on `/pass-requests`.
   - Backend automatically queries `public.university_details` by `registration_number` to pull official `parent_name` & `parent_phone`. (Students cannot enter or change the parent number).
   - Generates cryptographically secure single-use 24-hour token (`secrets.token_urlsafe(32)`).
   - Delivers link via Twilio SMS to registered parent phone number.
2. **Parent OTP Authorization (`ParentApproval.jsx`)**:
   - Parent opens `/parent-approval/<token>`.
   - Clicks **Send Verification Code** (`POST /api/parent/send-otp`) -> sends 6-digit OTP SMS. Enforces 60s resend rate limits.
   - Enforces max 5 failed attempts (`POST /api/parent/verify-otp`).
   - Upon verification, parent approves or rejects (`POST /api/parent/submit-decision`).
   - Token & OTP are immediately invalidated upon submission.
3. **Warden / Admin Final Pass Approval (`AdminPasses.jsx`)**:
   - Once parent approves (`PENDING_ADMIN`), warden / admin reviews and grants final approval (`APPROVED`).

### B. Split Exit Movement Control
1. **Normal Exit**:
   - Local outings during standard hours.
   - Requires student status = `IN HOSTEL`.
   - Logs `attendance_logs` with `type = 'Exit (Normal)'`, `exit_type = 'NORMAL_EXIT'`, `expected_return_time = 'Same Day Outing'`.
2. **Exit to Home**:
   - Weekend / Home leave.
   - System checks `public.pass_requests` for an `APPROVED` pass for this student. If missing/unapproved, exit is blocked.
   - Logs `attendance_logs` with `type = 'Exit (Leave to Home)'`, `exit_type = 'LEAVE_TO_HOME'`, `expected_return_time = '${return_date} at ${return_time}'`.

### C. Automated & Biometric Return Completion & Active Exit Constraints
1. **Prevent Multiple Active Exits**: Students marked `OUT` cannot initiate another exit scan until they log an `Entry` scan.
2. **Prevent Multiple Pass Requests**: Students with an active or pending leave pass (`WAITING_FOR_PARENT`, `PENDING_ADMIN`, `APPROVED`) cannot submit another request. The **"Raise Leave Pass Request"** button is automatically disabled with an `"Active Request Exists"` status badge.
3. **Biometric & Geofence Return Verification**: 
   - Scanning `Enter into Hostel` (`Entry`) at the gate or clicking **Mark Returned** on `PassRequests.jsx` triggers the interactive `VerificationModal` (Geofence GPS + Biometric AI Face Match).
   - Upon successful verification, logs an `Entry` scan into `attendance_logs`, marks `pass_requests` as `COMPLETED` (`Completed (Returned)`), and updates student presence back to **`IN HOSTEL` 🟢**.
4. **Guaranteed Service-Role Row Deletion**:
   - Student & Admin cancellations invoke Flask backend service-role route `DELETE /delete-pass-request/${id}` first to bypass RLS policies and forcefully purge rows from Supabase PostgreSQL database.

---

## 7. Key Source Code Files

- **`server/app.py`**: Flask server API endpoints.
- **`server/haversine_check.py`**: GPS distance calculation module (IUST campus coordinates).
- **`server/face_service.py`**: DeepFace / OpenCV facial feature extraction & Supabase embedding vector handling.
- **`server/sms_service.py`**: Twilio SMS notification & OTP sending functions.
- **`server/test_parent_flow.py`**: Automated end-to-end Python test script.
- **`client/src/pages/PassRequests.jsx`**: Student Leave Pass management page featuring tabbed navigation (**Active/Pending Pass** vs **Pass History** vs **All Records**), multi-request prevention, biometric return verification, and guaranteed server service-role row deletion.
- **`client/src/pages/AdminPasses.jsx`**: Warden / Admin pass review portal featuring tabbed segregation (**Current Pending Requests** vs **Request History** vs **All Records**) and administrative request row deletion.
- **`client/src/pages/ActivityLogs.jsx`**: Personal student audit history with date range filtering (All Time, Past Week, Past Month, Past 3 Months).
- **`client/src/pages/AdminDashboard.jsx`**: Master attendance audit portal, live campus location metrics, and CSV exporter.
- **`client/src/components/Layout.jsx`**: Master container layout rendering topbar custom page headers and universal **Logout button** (redirecting to `/` landing route).
- **`client/src/pages/Login.jsx` & `client/src/pages/Signup.jsx`**: User authentication portals featuring centered card layout, official `favicon.svg` brand badge header, and clean top notification banners.
- **`client/src/components/Sidebar.jsx`**: Sidebar navigation featuring official `favicon.svg` logo badge, active role detection, and live pending pass counter badge (strictly counts active unfinalized pending requests).
- **`client/src/pages/Profile.jsx`**: Student face biometric registration & profile details.

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
