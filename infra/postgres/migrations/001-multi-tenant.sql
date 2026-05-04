-- =============================================================================
-- Migration 001: Multi-Tenant Transformation
-- Converts single-tenant schema to shared-database multi-tenant.
-- Run inside a transaction; rolls back completely on any failure.
-- =============================================================================
BEGIN;

-- 1. Create companies table
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  industry VARCHAR(40) NOT NULL DEFAULT 'it',
  size VARCHAR(20) NOT NULL DEFAULT '1-50',
  contact_name VARCHAR(120) NOT NULL DEFAULT '',
  contact_email VARCHAR(160) NOT NULL,
  contact_phone VARCHAR(40) NOT NULL DEFAULT '',
  trial_ends_at TIMESTAMPTZ NOT NULL,
  max_users INTEGER NOT NULL DEFAULT 20,
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'trial',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Insert default company (all existing data will belong to it)
INSERT INTO companies (id, name, industry, size, contact_name, contact_email, contact_phone, trial_ends_at, max_users, features, status)
VALUES ('00000000-0000-0000-0000-000000000001', '默认企业', 'it', '51-200', '系统管理员', 'admin@company.local', '', '2027-01-01 00:00:00+08', 50, '{"recruitment":true,"attendance":true,"performance":true,"payroll":true,"aiAgent":true}'::jsonb, 'trial')
ON CONFLICT (id) DO NOTHING;

-- 3. Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(120) NOT NULL DEFAULT '',
  entity_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- 4. Add company_id to departments
ALTER TABLE departments ADD COLUMN IF NOT EXISTS company_id UUID;
UPDATE departments SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
ALTER TABLE departments ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE departments ADD CONSTRAINT departments_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
-- Drop old unique constraint if it exists, then add per-company one
ALTER TABLE departments DROP CONSTRAINT IF EXISTS departments_code_key;
ALTER TABLE departments DROP CONSTRAINT IF EXISTS departments_company_code_key;
ALTER TABLE departments ADD CONSTRAINT departments_company_code_key UNIQUE (company_id, code);
CREATE INDEX IF NOT EXISTS idx_departments_company_id ON departments(company_id);

-- 5. Add company_id to positions
ALTER TABLE positions ADD COLUMN IF NOT EXISTS company_id UUID;
UPDATE positions SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
ALTER TABLE positions ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE positions ADD CONSTRAINT positions_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE positions DROP CONSTRAINT IF EXISTS positions_code_key;
ALTER TABLE positions DROP CONSTRAINT IF EXISTS positions_company_code_key;
ALTER TABLE positions ADD CONSTRAINT positions_company_code_key UNIQUE (company_id, code);
CREATE INDEX IF NOT EXISTS idx_positions_company_id ON positions(company_id);

-- 6. Add company_id to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id UUID;
UPDATE users SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
ALTER TABLE users ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE users ADD CONSTRAINT users_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_company_username_key;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_company_email_key;
ALTER TABLE users ADD CONSTRAINT users_company_username_key UNIQUE (company_id, username);
ALTER TABLE users ADD CONSTRAINT users_company_email_key UNIQUE (company_id, email);
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);

-- 7. Add company_id to employees
ALTER TABLE employees ADD COLUMN IF NOT EXISTS company_id UUID;
UPDATE employees SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
ALTER TABLE employees ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE employees ADD CONSTRAINT employees_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_employee_no_key;
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_email_key;
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_company_employee_no_key;
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_company_email_key;
ALTER TABLE employees ADD CONSTRAINT employees_company_employee_no_key UNIQUE (company_id, employee_no);
ALTER TABLE employees ADD CONSTRAINT employees_company_email_key UNIQUE (company_id, email);
CREATE INDEX IF NOT EXISTS idx_employees_company_id ON employees(company_id);

-- 8. Add company_id to performance_cycles
ALTER TABLE performance_cycles ADD COLUMN IF NOT EXISTS company_id UUID;
UPDATE performance_cycles SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
ALTER TABLE performance_cycles ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE performance_cycles ADD CONSTRAINT performance_cycles_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_performance_cycles_company_id ON performance_cycles(company_id);

-- 9. Add company_id to knowledge_base_articles
ALTER TABLE knowledge_base_articles ADD COLUMN IF NOT EXISTS company_id UUID;
UPDATE knowledge_base_articles SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
ALTER TABLE knowledge_base_articles ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE knowledge_base_articles ADD CONSTRAINT knowledge_base_articles_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_knowledge_base_articles_company_id ON knowledge_base_articles(company_id);

-- 10. Add missing indexes on child tables (safe to re-run)
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_id_status ON leave_requests(employee_id, status);
CREATE INDEX IF NOT EXISTS idx_overtime_requests_employee_id_status ON overtime_requests(employee_id, status);
CREATE INDEX IF NOT EXISTS idx_profile_change_requests_employee_id ON profile_change_requests(employee_id);

COMMIT;
