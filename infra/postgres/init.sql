CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Companies (tenants)
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

-- Audit logs
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

CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  parent_id UUID NULL,
  name VARCHAR(120) NOT NULL,
  code VARCHAR(60) NOT NULL,
  manager_employee_id UUID NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT departments_company_code_key UNIQUE (company_id, code)
);

CREATE TABLE IF NOT EXISTS positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  department_id UUID NULL REFERENCES departments(id) ON DELETE SET NULL,
  name VARCHAR(120) NOT NULL,
  code VARCHAR(60) NOT NULL,
  level VARCHAR(50) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT positions_company_code_key UNIQUE (company_id, code)
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  username VARCHAR(60) NOT NULL,
  email VARCHAR(160) NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  password_hash TEXT NOT NULL,
  photo_url TEXT NOT NULL DEFAULT '',
  role VARCHAR(24) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_company_username_key UNIQUE (company_id, username),
  CONSTRAINT users_company_email_key UNIQUE (company_id, email)
);

CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  employee_no VARCHAR(40) NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  gender VARCHAR(20) NOT NULL DEFAULT 'unknown',
  birth_date DATE NULL,
  department_id UUID NULL REFERENCES departments(id) ON DELETE SET NULL,
  position_id UUID NULL REFERENCES positions(id) ON DELETE SET NULL,
  manager_employee_id UUID NULL REFERENCES employees(id) ON DELETE SET NULL,
  employment_type VARCHAR(30) NOT NULL DEFAULT 'full_time',
  employment_status VARCHAR(30) NOT NULL DEFAULT 'probation',
  grade VARCHAR(50) NOT NULL DEFAULT 'P1',
  join_date DATE NOT NULL,
  probation_end_date DATE NULL,
  regularization_date DATE NULL,
  exit_date DATE NULL,
  education TEXT NOT NULL DEFAULT '',
  certificates JSONB NOT NULL DEFAULT '[]'::jsonb,
  address TEXT NOT NULL DEFAULT '',
  emergency_contact JSONB NOT NULL DEFAULT '{}'::jsonb,
  national_id_masked VARCHAR(40) NOT NULL DEFAULT '',
  bank_account_masked VARCHAR(60) NOT NULL DEFAULT '',
  profile_summary TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT employees_company_employee_no_key UNIQUE (company_id, employee_no),
  CONSTRAINT employees_company_email_key UNIQUE (company_id, email)
);

CREATE TABLE IF NOT EXISTS agent_run_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  employee_id UUID NULL REFERENCES employees(id) ON DELETE SET NULL,
  agent_type VARCHAR(60) NOT NULL,
  action VARCHAR(80) NOT NULL,
  mode VARCHAR(20) NOT NULL,
  provider VARCHAR(30) NOT NULL,
  model VARCHAR(100) NOT NULL,
  fallback_reason VARCHAR(60) NULL,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  tool_names JSONB NOT NULL DEFAULT '[]'::jsonb,
  subject_type VARCHAR(80) NOT NULL DEFAULT '',
  subject_id UUID NULL,
  summary TEXT NOT NULL DEFAULT '',
  error_message TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_run_logs_company_created
  ON agent_run_logs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_run_logs_company_agent_created
  ON agent_run_logs(company_id, agent_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_run_logs_company_mode_created
  ON agent_run_logs(company_id, mode, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_run_logs_company_fallback_created
  ON agent_run_logs(company_id, fallback_reason, created_at DESC);

ALTER TABLE departments
  ADD CONSTRAINT departments_parent_id_fkey
  FOREIGN KEY (parent_id) REFERENCES departments(id) ON DELETE SET NULL;

ALTER TABLE departments
  ADD CONSTRAINT departments_manager_employee_id_fkey
  FOREIGN KEY (manager_employee_id) REFERENCES employees(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS employee_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  contract_no VARCHAR(80) NOT NULL UNIQUE,
  contract_type VARCHAR(40) NOT NULL,
  status VARCHAR(30) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  probation_months INTEGER NOT NULL DEFAULT 0,
  salary_base NUMERIC(12, 2) NOT NULL DEFAULT 0,
  file_path TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NULL REFERENCES departments(id) ON DELETE SET NULL,
  position_id UUID NULL REFERENCES positions(id) ON DELETE SET NULL,
  title VARCHAR(160) NOT NULL,
  employment_type VARCHAR(40) NOT NULL DEFAULT 'full_time',
  location VARCHAR(120) NOT NULL DEFAULT '',
  description TEXT NOT NULL,
  requirements TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  target_count INTEGER NOT NULL DEFAULT 1,
  published_at TIMESTAMPTZ NULL,
  closed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applied_job_posting_id UUID NULL REFERENCES job_postings(id) ON DELETE SET NULL,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  phone VARCHAR(40) NOT NULL,
  source VARCHAR(80) NOT NULL DEFAULT 'website',
  stage VARCHAR(40) NOT NULL DEFAULT 'new',
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  current_company VARCHAR(120) NOT NULL DEFAULT '',
  years_of_experience NUMERIC(5, 2) NOT NULL DEFAULT 0,
  skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai_match_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  file_name VARCHAR(260) NOT NULL,
  file_path TEXT NOT NULL,
  parsed_text TEXT NOT NULL DEFAULT '',
  parsed_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_posting_id UUID NULL REFERENCES job_postings(id) ON DELETE SET NULL,
  interviewer_employee_id UUID NULL REFERENCES employees(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  interview_type VARCHAR(40) NOT NULL DEFAULT 'onsite',
  status VARCHAR(30) NOT NULL DEFAULT 'scheduled',
  score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  feedback TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_posting_id UUID NULL REFERENCES job_postings(id) ON DELETE SET NULL,
  approval_by_employee_id UUID NULL REFERENCES employees(id) ON DELETE SET NULL,
  salary_offered NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  offered_at TIMESTAMPTZ NULL,
  accepted_at TIMESTAMPTZ NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  clock_in_at TIMESTAMPTZ NULL,
  clock_out_at TIMESTAMPTZ NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'present',
  source VARCHAR(30) NOT NULL DEFAULT 'manual',
  late_minutes INTEGER NOT NULL DEFAULT 0,
  undertime_minutes INTEGER NOT NULL DEFAULT 0,
  anomaly_reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT attendances_employee_work_date_key UNIQUE (employee_id, work_date)
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  approver_employee_id UUID NULL REFERENCES employees(id) ON DELETE SET NULL,
  leave_type VARCHAR(40) NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  duration_days NUMERIC(6, 2) NOT NULL DEFAULT 0,
  reason TEXT NOT NULL DEFAULT '',
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  rejection_reason TEXT NOT NULL DEFAULT '',
  approved_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type VARCHAR(40) NOT NULL,
  year INTEGER NOT NULL,
  total_days NUMERIC(6, 2) NOT NULL DEFAULT 0,
  used_days NUMERIC(6, 2) NOT NULL DEFAULT 0,
  remaining_days NUMERIC(6, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT leave_balances_employee_leave_type_year_key UNIQUE (employee_id, leave_type, year)
);

CREATE TABLE IF NOT EXISTS overtime_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  approver_employee_id UUID NULL REFERENCES employees(id) ON DELETE SET NULL,
  work_date DATE NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  hours NUMERIC(6, 2) NOT NULL DEFAULT 0,
  reason TEXT NOT NULL DEFAULT '',
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  approved_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS performance_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(160) NOT NULL,
  year INTEGER NOT NULL,
  period_type VARCHAR(30) NOT NULL DEFAULT 'quarterly',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS performance_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES performance_cycles(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  category VARCHAR(40) NOT NULL DEFAULT 'okr',
  weight NUMERIC(5, 2) NOT NULL DEFAULT 0,
  target_value VARCHAR(120) NOT NULL DEFAULT '',
  current_value VARCHAR(120) NOT NULL DEFAULT '',
  status VARCHAR(30) NOT NULL DEFAULT 'in_progress',
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS performance_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES performance_cycles(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  reviewer_employee_id UUID NULL REFERENCES employees(id) ON DELETE SET NULL,
  overall_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  rating VARCHAR(30) NOT NULL DEFAULT 'meets_expectation',
  strengths TEXT NOT NULL DEFAULT '',
  improvements TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS salary_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  pay_type VARCHAR(30) NOT NULL DEFAULT 'monthly',
  base_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
  housing_allowance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  transport_allowance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  bonus_rate NUMERIC(6, 4) NOT NULL DEFAULT 0,
  social_insurance_base NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(6, 4) NOT NULL DEFAULT 0,
  effective_from DATE NOT NULL,
  effective_to DATE NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS salary_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  attendance_days NUMERIC(6, 2) NOT NULL DEFAULT 0,
  overtime_hours NUMERIC(6, 2) NOT NULL DEFAULT 0,
  performance_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  gross_pay NUMERIC(12, 2) NOT NULL DEFAULT 0,
  deductions NUMERIC(12, 2) NOT NULL DEFAULT 0,
  net_pay NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT salary_records_employee_month_key UNIQUE (employee_id, month)
);

CREATE TABLE IF NOT EXISTS payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salary_record_id UUID NOT NULL UNIQUE REFERENCES salary_records(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  slip_no VARCHAR(80) NOT NULL UNIQUE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  download_path TEXT NOT NULL DEFAULT '',
  visible_to_employee BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS knowledge_base_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category VARCHAR(80) NOT NULL,
  title VARCHAR(180) NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profile_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  reviewer_employee_id UUID NULL REFERENCES employees(id) ON DELETE SET NULL,
  changes JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  review_comment TEXT NOT NULL DEFAULT '',
  reviewed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NULL REFERENCES users(id) ON DELETE CASCADE,
  employee_id UUID NULL REFERENCES employees(id) ON DELETE CASCADE,
  category VARCHAR(40) NOT NULL DEFAULT 'system',
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  title VARCHAR(180) NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  link_path TEXT NOT NULL DEFAULT '',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  owner_employee_id UUID NULL REFERENCES employees(id) ON DELETE SET NULL,
  category VARCHAR(40) NOT NULL DEFAULT 'general',
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  link_path TEXT NOT NULL DEFAULT '',
  related_entity_type VARCHAR(80) NOT NULL DEFAULT '',
  related_entity_id UUID NULL,
  due_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  actor_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  actor_employee_id UUID NULL REFERENCES employees(id) ON DELETE SET NULL,
  category VARCHAR(40) NOT NULL DEFAULT 'activity',
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  related_entity_type VARCHAR(80) NOT NULL DEFAULT '',
  related_entity_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_departments_parent_id ON departments(parent_id);
CREATE INDEX IF NOT EXISTS idx_departments_company_id ON departments(company_id);
CREATE INDEX IF NOT EXISTS idx_positions_company_id ON positions(company_id);
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_employees_department_id ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_manager_employee_id ON employees(manager_employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_company_id ON employees(company_id);
CREATE INDEX IF NOT EXISTS idx_job_postings_status ON job_postings(status);
CREATE INDEX IF NOT EXISTS idx_candidates_stage ON candidates(stage);
CREATE INDEX IF NOT EXISTS idx_resumes_candidate_id ON resumes(candidate_id);
CREATE INDEX IF NOT EXISTS idx_attendances_employee_id_work_date ON attendances(employee_id, work_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_id_status ON leave_requests(employee_id, status);
CREATE INDEX IF NOT EXISTS idx_overtime_requests_employee_id_status ON overtime_requests(employee_id, status);
CREATE INDEX IF NOT EXISTS idx_performance_goals_employee_id ON performance_goals(employee_id);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_employee_id ON performance_reviews(employee_id);
CREATE INDEX IF NOT EXISTS idx_performance_cycles_company_id ON performance_cycles(company_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_articles_company_id ON knowledge_base_articles(company_id);
CREATE INDEX IF NOT EXISTS idx_salary_records_employee_id_month ON salary_records(employee_id, month);
CREATE INDEX IF NOT EXISTS idx_profile_change_requests_employee_id ON profile_change_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_workflow_notifications_company_read_created
  ON workflow_notifications(company_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_notifications_company_employee_read
  ON workflow_notifications(company_id, employee_id, is_read);
CREATE INDEX IF NOT EXISTS idx_workflow_notifications_company_user_read
  ON workflow_notifications(company_id, user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_company_status_priority
  ON workflow_tasks(company_id, status, priority);
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_company_owner_status
  ON workflow_tasks(company_id, owner_employee_id, status);
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_related_entity
  ON workflow_tasks(related_entity_type, related_entity_id);
CREATE INDEX IF NOT EXISTS idx_workflow_events_company_created
  ON workflow_events(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_events_related_entity_created
  ON workflow_events(related_entity_type, related_entity_id, created_at DESC);

-- Covering indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_users_company_active_covering
  ON users(company_id, is_active)
  INCLUDE (id, username, email, role, display_name, password_hash);

CREATE INDEX IF NOT EXISTS idx_users_id_company_covering
  ON users(id)
  INCLUDE (company_id, username, email, role, is_active);

CREATE INDEX IF NOT EXISTS idx_employees_company_dept_covering
  ON employees(company_id, department_id)
  INCLUDE (id, full_name, employee_no, employment_status, position_id);

CREATE INDEX IF NOT EXISTS idx_employees_user_id_covering
  ON employees(user_id)
  INCLUDE (id, company_id, full_name, employee_no);

CREATE INDEX IF NOT EXISTS idx_employees_company_status_covering
  ON employees(company_id, employment_status)
  INCLUDE (id, full_name, employee_no, department_id, position_id, join_date);

CREATE INDEX IF NOT EXISTS idx_employees_manager_covering
  ON employees(manager_employee_id)
  INCLUDE (id, full_name, employee_no, department_id)
  WHERE manager_employee_id IS NOT NULL;
