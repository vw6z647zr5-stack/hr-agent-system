-- Migration 006: Agent run ledger for observability and audit review

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
