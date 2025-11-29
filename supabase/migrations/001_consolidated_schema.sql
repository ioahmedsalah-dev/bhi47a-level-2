-- ============================================================
-- 001_CONSOLIDATED_SCHEMA.sql
-- Consolidated schema definition for Students, Grades, and Admin system
-- Includes tables, columns, constraints, functions, and initial data.
-- ============================================================

-- 1. EXTENSIONS
-- ============================================================
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

-- 2. TABLES
-- ============================================================

-- 2.1 STUDENTS
CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_code TEXT UNIQUE NOT NULL,
  student_name TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  national_id VARCHAR(14),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT students_status_check CHECK (status IN ('active', 'absent', 'hide', 'inactive', 'محجوب', 'غائب'))
);

-- 2.2 COURSES
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2.3 GRADES
CREATE TABLE IF NOT EXISTS public.grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  grade INTEGER NOT NULL CHECK (grade >= 0 AND grade <= 30),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(student_id, course_id)
);

-- 2.4 ADMINS
CREATE TABLE IF NOT EXISTS public.admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_code TEXT UNIQUE NOT NULL,
  admin_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'superadmin' CHECK (role IN ('superadmin', 'viewer')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
COMMENT ON COLUMN public.admins.role IS 'Role determines access level: superadmin (read/write) or viewer (read-only)';

-- 2.5 AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_code TEXT NOT NULL,
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL,
  changed_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2.6 ADMIN SESSIONS
CREATE TABLE IF NOT EXISTS public.admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_code TEXT NOT NULL,
  session_token TEXT NOT NULL UNIQUE,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT now() + interval '24 hours',
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. FUNCTIONS
-- ============================================================

-- 3.1 Hash Password (for creating admins)
CREATE OR REPLACE FUNCTION public.hash_password(password TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN crypt(password, gen_salt('bf', 4));
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT SECURITY DEFINER SET search_path = public, extensions;

-- 3.2 Verify Password (for login)
CREATE OR REPLACE FUNCTION public.verify_password(password TEXT, hash TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN hash = crypt(password, hash);
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT SECURITY DEFINER SET search_path = public, extensions;

-- 3.3 Get Current Admin Role (for RLS)
CREATE OR REPLACE FUNCTION public.get_current_admin_role()
RETURNS TEXT 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  token text;
  found_role text;
BEGIN
  -- Get token from custom header 'x-admin-token'
  BEGIN
    token := current_setting('request.headers', true)::json->>'x-admin-token';
  EXCEPTION WHEN OTHERS THEN
    token := NULL;
  END;
  
  IF token IS NULL THEN
    RETURN NULL;
  END IF;

  -- Check if token exists, is valid, and not expired
  SELECT a.role INTO found_role
  FROM public.admin_sessions s
  JOIN public.admins a ON s.admin_code = a.admin_code
  WHERE s.session_token = token
  AND s.expires_at > now();
  
  RETURN found_role;
END;
$$;

-- 3.4 Login Admin (Secure Server-Side Login)
CREATE OR REPLACE FUNCTION public.login_admin(p_admin_code TEXT, p_password TEXT)
RETURNS TABLE (
  success BOOLEAN,
  session_token TEXT,
  admin_name TEXT,
  admin_id UUID,
  error_message TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_admin_record RECORD;
  v_existing_token TEXT;
  v_new_token TEXT;
BEGIN
  -- 1. Find the admin
  SELECT * INTO v_admin_record
  FROM public.admins
  WHERE admin_code = p_admin_code;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::TEXT, NULL::UUID, 'Admin code or password is incorrect';
    RETURN;
  END IF;

  -- 2. Verify password
  IF v_admin_record.password_hash = crypt(p_password, v_admin_record.password_hash) THEN
    
    -- 3. Check for existing valid session
    SELECT s.session_token INTO v_existing_token
    FROM public.admin_sessions s
    WHERE s.admin_code = p_admin_code
    AND s.expires_at > now()
    ORDER BY s.created_at DESC
    LIMIT 1;

    IF v_existing_token IS NOT NULL THEN
      -- Extend session
      UPDATE public.admin_sessions
      SET expires_at = now() + interval '24 hours',
          last_activity = now()
      WHERE admin_sessions.session_token = v_existing_token;
      
      RETURN QUERY SELECT true, v_existing_token, v_admin_record.admin_name, v_admin_record.id, NULL::TEXT;
    ELSE
      -- Create new session
      v_new_token := encode(gen_random_bytes(32), 'hex');
      
      INSERT INTO public.admin_sessions (admin_code, session_token, expires_at)
      VALUES (p_admin_code, v_new_token, now() + interval '24 hours');
      
      RETURN QUERY SELECT true, v_new_token, v_admin_record.admin_name, v_admin_record.id, NULL::TEXT;
    END IF;

  ELSE
    RETURN QUERY SELECT false, NULL::TEXT, NULL::TEXT, NULL::UUID, 'Admin code or password is incorrect';
  END IF;
END;
$$;

-- 4. INITIAL DATA
-- ============================================================
INSERT INTO public.admins (admin_code, admin_name, password_hash, role)
VALUES 
  ('ADMIN002', 'مدير المستوي  الثاني', crypt('admin123', gen_salt('bf', 4)), 'superadmin')
ON CONFLICT (admin_code) 
DO UPDATE SET 
  admin_name = EXCLUDED.admin_name,
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role;
