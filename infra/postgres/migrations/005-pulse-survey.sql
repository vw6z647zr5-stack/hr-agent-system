-- Migration 005: Pulse survey tables for employee sentiment tracking

CREATE TABLE IF NOT EXISTS pulse_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category VARCHAR(40) NOT NULL DEFAULT 'general',
  period_type VARCHAR(30) NOT NULL DEFAULT 'monthly',
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pulse_survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES pulse_surveys(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_sentiment_label VARCHAR(30) NULL,
  ai_sentiment_score NUMERIC(4,2) NULL,
  ai_keywords JSONB NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pulse_survey_responses_employee_survey
  ON pulse_survey_responses(survey_id, employee_id);

CREATE INDEX IF NOT EXISTS idx_pulse_surveys_company_status
  ON pulse_surveys(company_id, status);

CREATE INDEX IF NOT EXISTS idx_pulse_survey_responses_survey
  ON pulse_survey_responses(survey_id);
