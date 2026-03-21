CREATE TABLE IF NOT EXISTS safety_test_suites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('injection', 'hallucination', 'exfiltration', 'consistency')),
  test_cases JSONB NOT NULL,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS safety_test_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  suite_id UUID NOT NULL REFERENCES safety_test_suites(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'complete', 'failed')),
  results JSONB NOT NULL DEFAULT '{}',
  score FLOAT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS safety_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE UNIQUE,
  injection_resistance FLOAT NOT NULL DEFAULT 0,
  hallucination_rate FLOAT NOT NULL DEFAULT 0,
  exfiltration_score FLOAT NOT NULL DEFAULT 0,
  consistency_score FLOAT NOT NULL DEFAULT 0,
  overall_safety_score FLOAT NOT NULL DEFAULT 0,
  last_tested_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
