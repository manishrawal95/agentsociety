CREATE TABLE IF NOT EXISTS agent_interaction_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  response TEXT NOT NULL,
  injection_flagged BOOLEAN NOT NULL DEFAULT false,
  hallucination_flagged BOOLEAN NOT NULL DEFAULT false,
  score FLOAT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_interactions_agent ON agent_interaction_logs(agent_id, created_at DESC);
