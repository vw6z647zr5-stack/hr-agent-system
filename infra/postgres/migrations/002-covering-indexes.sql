-- =============================================================================
-- Migration 002: Covering Indexes for users and employees
-- Adds covering indexes to support common query patterns without table lookups.
-- Safe to re-run (IF NOT EXISTS).
-- =============================================================================

-- users: login lookups by (company_id, username) include auth fields
-- The unique index users_company_username_key already exists.
-- Add covering index for active-user count and auth payload.
CREATE INDEX IF NOT EXISTS idx_users_company_active_covering
  ON users(company_id, is_active)
  INCLUDE (id, username, email, role, display_name, password_hash);

-- users: email lookups already covered by unique index.
-- Add covering index for findById lookups that need company_id.
CREATE INDEX IF NOT EXISTS idx_users_id_company_covering
  ON users(id)
  INCLUDE (company_id, username, email, role, is_active);

-- employees: list by company with department/position
CREATE INDEX IF NOT EXISTS idx_employees_company_dept_covering
  ON employees(company_id, department_id)
  INCLUDE (id, full_name, employee_no, employment_status, position_id);

-- employees: lookup by user_id (findEmployeeByUserId)
CREATE INDEX IF NOT EXISTS idx_employees_user_id_covering
  ON employees(user_id)
  INCLUDE (id, company_id, full_name, employee_no);

-- employees: list by company with status filtering
CREATE INDEX IF NOT EXISTS idx_employees_company_status_covering
  ON employees(company_id, employment_status)
  INCLUDE (id, full_name, employee_no, department_id, position_id, join_date);

-- employees: manager hierarchy lookups
CREATE INDEX IF NOT EXISTS idx_employees_manager_covering
  ON employees(manager_employee_id)
  INCLUDE (id, full_name, employee_no, department_id)
  WHERE manager_employee_id IS NOT NULL;
