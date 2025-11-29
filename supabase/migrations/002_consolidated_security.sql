-- ============================================================
-- 002_CONSOLIDATED_SECURITY.sql
-- Consolidated security configuration
-- Includes RLS enablement, Policies, and Function Grants
-- ============================================================

-- 1. ENABLE ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;

-- 2. FUNCTION GRANTS
-- ============================================================
-- Allow public access to login and verification functions
GRANT EXECUTE ON FUNCTION public.verify_password(TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_current_admin_role() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.login_admin(TEXT, TEXT) TO anon, authenticated, service_role;

-- 3. RLS POLICIES
-- ============================================================

-- 3.1 STUDENTS
-- ------------------------------------------------------------
-- SELECT: Allow all (Public Website)
DROP POLICY IF EXISTS "students_select_all" ON public.students;
CREATE POLICY "students_select_all" ON public.students FOR SELECT USING (true);

-- INSERT: Superadmin Only
DROP POLICY IF EXISTS "students_insert_superadmin" ON public.students;
CREATE POLICY "students_insert_superadmin" ON public.students FOR INSERT WITH CHECK (public.get_current_admin_role() = 'superadmin');

-- UPDATE: Superadmin Only
DROP POLICY IF EXISTS "students_update_superadmin" ON public.students;
CREATE POLICY "students_update_superadmin" ON public.students FOR UPDATE USING (public.get_current_admin_role() = 'superadmin') WITH CHECK (public.get_current_admin_role() = 'superadmin');

-- DELETE: Superadmin Only
DROP POLICY IF EXISTS "students_delete_superadmin" ON public.students;
CREATE POLICY "students_delete_superadmin" ON public.students FOR DELETE USING (public.get_current_admin_role() = 'superadmin');


-- 3.2 COURSES
-- ------------------------------------------------------------
-- SELECT: Allow all
DROP POLICY IF EXISTS "courses_select_all" ON public.courses;
CREATE POLICY "courses_select_all" ON public.courses FOR SELECT USING (true);

-- INSERT: Superadmin Only
DROP POLICY IF EXISTS "courses_insert_superadmin" ON public.courses;
CREATE POLICY "courses_insert_superadmin" ON public.courses FOR INSERT WITH CHECK (public.get_current_admin_role() = 'superadmin');

-- UPDATE: Superadmin Only
DROP POLICY IF EXISTS "courses_update_superadmin" ON public.courses;
CREATE POLICY "courses_update_superadmin" ON public.courses FOR UPDATE USING (public.get_current_admin_role() = 'superadmin') WITH CHECK (public.get_current_admin_role() = 'superadmin');

-- DELETE: Superadmin Only
DROP POLICY IF EXISTS "courses_delete_superadmin" ON public.courses;
CREATE POLICY "courses_delete_superadmin" ON public.courses FOR DELETE USING (public.get_current_admin_role() = 'superadmin');


-- 3.3 GRADES
-- ------------------------------------------------------------
-- SELECT: Allow all
DROP POLICY IF EXISTS "grades_select_all" ON public.grades;
CREATE POLICY "grades_select_all" ON public.grades FOR SELECT USING (true);

-- INSERT: Superadmin Only
DROP POLICY IF EXISTS "grades_insert_superadmin" ON public.grades;
CREATE POLICY "grades_insert_superadmin" ON public.grades FOR INSERT WITH CHECK (public.get_current_admin_role() = 'superadmin');

-- UPDATE: Superadmin Only
DROP POLICY IF EXISTS "grades_update_superadmin" ON public.grades;
CREATE POLICY "grades_update_superadmin" ON public.grades FOR UPDATE USING (public.get_current_admin_role() = 'superadmin') WITH CHECK (public.get_current_admin_role() = 'superadmin');

-- DELETE: Superadmin Only
DROP POLICY IF EXISTS "grades_delete_superadmin" ON public.grades;
CREATE POLICY "grades_delete_superadmin" ON public.grades FOR DELETE USING (public.get_current_admin_role() = 'superadmin');


-- 3.4 ADMINS
-- ------------------------------------------------------------
-- SELECT: Allow all (Required for some checks, though login uses SECURITY DEFINER)
DROP POLICY IF EXISTS "admins_select_all" ON public.admins;
CREATE POLICY "admins_select_all" ON public.admins FOR SELECT USING (true);

-- WRITE: Blocked (Only via direct DB access or migrations)
DROP POLICY IF EXISTS "admins_insert_blocked" ON public.admins;
CREATE POLICY "admins_insert_blocked" ON public.admins FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "admins_update_blocked" ON public.admins;
CREATE POLICY "admins_update_blocked" ON public.admins FOR UPDATE USING (false);

DROP POLICY IF EXISTS "admins_delete_blocked" ON public.admins;
CREATE POLICY "admins_delete_blocked" ON public.admins FOR DELETE USING (false);


-- 3.5 AUDIT LOGS
-- ------------------------------------------------------------
-- SELECT: Allow all (or restrict to admins? Original was allow all)
DROP POLICY IF EXISTS "audit_logs_select_all" ON public.audit_logs;
CREATE POLICY "audit_logs_select_all" ON public.audit_logs FOR SELECT USING (true);

-- INSERT: Allow all (App needs to write logs)
DROP POLICY IF EXISTS "audit_logs_insert_all" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_all" ON public.audit_logs FOR INSERT WITH CHECK (true);

-- UPDATE/DELETE: Blocked
DROP POLICY IF EXISTS "audit_logs_update_blocked" ON public.audit_logs;
CREATE POLICY "audit_logs_update_blocked" ON public.audit_logs FOR UPDATE USING (false);

DROP POLICY IF EXISTS "audit_logs_delete_blocked" ON public.audit_logs;
CREATE POLICY "audit_logs_delete_blocked" ON public.audit_logs FOR DELETE USING (false);


-- 3.6 ADMIN SESSIONS
-- ------------------------------------------------------------
-- ALL: Allow all (App needs to manage sessions)
DROP POLICY IF EXISTS "sessions_select_all" ON public.admin_sessions;
CREATE POLICY "sessions_select_all" ON public.admin_sessions FOR SELECT USING (true);

DROP POLICY IF EXISTS "sessions_insert_all" ON public.admin_sessions;
CREATE POLICY "sessions_insert_all" ON public.admin_sessions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "sessions_update_all" ON public.admin_sessions;
CREATE POLICY "sessions_update_all" ON public.admin_sessions FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sessions_delete_all" ON public.admin_sessions;
CREATE POLICY "sessions_delete_all" ON public.admin_sessions FOR DELETE USING (true);
