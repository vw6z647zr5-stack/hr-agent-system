-- =============================================================================
-- Migration 003: Workflow notifications, tasks, and timeline events
-- Adds a reusable process layer for approvals, recruitment CRM, and onboarding.
-- Safe to re-run (IF NOT EXISTS).
-- =============================================================================

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
