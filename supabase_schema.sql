-- =========================================================
-- IntelliSentry Complete SQL Setup for Supabase
-- Run this in Supabase Project -> SQL Editor
-- =========================================================

-- 1. Create & Enable RLS on Students Table
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

-- Insert Sample Students
INSERT INTO public.students (name, email, registration_number, role)
VALUES 
    ('Hashim Malik', 'hashim@iust.ac.in', 'IUST0123016837', 'student'),
    ('Shazia Akram', 'shazia@iust.ac.in', 'IUST0123016852', 'student'),
    ('Jahanzeb Khan', 'jahanzeb@iust.ac.in', 'IUST0123016910', 'student'),
    ('Aamir Bhat', 'aamir@iust.ac.in', 'IUST0123016945', 'student')
ON CONFLICT (email) 
DO UPDATE SET 
    name = EXCLUDED.name,
    registration_number = EXCLUDED.registration_number,
    role = EXCLUDED.role;


-- 2. Create University Details Table
CREATE TABLE IF NOT EXISTS public.university_details (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    registration_number TEXT UNIQUE NOT NULL,
    hostel_name TEXT,
    room_number TEXT,
    floor TEXT,
    warden_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.university_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read University Details" ON public.university_details;
DROP POLICY IF EXISTS "Public Insert University Details" ON public.university_details;
DROP POLICY IF EXISTS "Public Update University Details" ON public.university_details;

CREATE POLICY "Public Read University Details" ON public.university_details FOR SELECT USING (true);
CREATE POLICY "Public Insert University Details" ON public.university_details FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update University Details" ON public.university_details FOR UPDATE USING (true);

-- Populate Housing Details for Students
INSERT INTO public.university_details (registration_number, hostel_name, room_number, floor, warden_name)
VALUES 
    ('IUST0123016837', 'Habba Khatoon Hostel', 'Room 102-A', '1st Floor', 'Dr. Shazia'),
    ('IUST0123016852', 'Chenab Hostel', 'Room 304-B', '3rd Floor', 'Mr. Jahanzeb'),
    ('IUST0123016910', 'Habba Khatoon Hostel', 'Room 205-C', '2nd Floor', 'Dr. Shazia'),
    ('IUST0123016945', 'Chenab Hostel', 'Room 108-A', '1st Floor', 'Mr. Jahanzeb')
ON CONFLICT (registration_number) 
DO UPDATE SET 
    hostel_name = EXCLUDED.hostel_name,
    room_number = EXCLUDED.room_number,
    floor = EXCLUDED.floor,
    warden_name = EXCLUDED.warden_name;


-- 3. Create Student Leave Pass Requests Table
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.pass_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Pass Requests" ON public.pass_requests;
DROP POLICY IF EXISTS "Public Insert Pass Requests" ON public.pass_requests;
DROP POLICY IF EXISTS "Public Update Pass Requests" ON public.pass_requests;

CREATE POLICY "Public Read Pass Requests" ON public.pass_requests FOR SELECT USING (true);
CREATE POLICY "Public Insert Pass Requests" ON public.pass_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update Pass Requests" ON public.pass_requests FOR UPDATE USING (true);
