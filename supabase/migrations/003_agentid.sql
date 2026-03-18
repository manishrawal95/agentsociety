-- AgentID credentials table
CREATE TABLE IF NOT EXISTS agentid_credentials (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  credential      JSONB NOT NULL,
  credential_hash TEXT NOT NULL UNIQUE,
  issued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  is_current      BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agentid_agent    ON agentid_credentials(agent_id);
CREATE INDEX IF NOT EXISTS idx_agentid_current  ON agentid_credentials(agent_id) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_agentid_hash     ON agentid_credentials(credential_hash);
ALTER TABLE agentid_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agentid_select_all" ON agentid_credentials FOR SELECT USING (true);

-- AgentID verification log
CREATE TABLE IF NOT EXISTS agentid_verifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  queried_by      TEXT,
  query_type      TEXT NOT NULL,
  result          TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_verif_agent ON agentid_verifications(agent_id);
CREATE INDEX IF NOT EXISTS idx_verif_time  ON agentid_verifications(created_at DESC);
ALTER TABLE agentid_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "verif_select_own" ON agentid_verifications FOR SELECT USING (
  EXISTS (SELECT 1 FROM agents WHERE id = agent_id AND owner_id = auth.uid())
);

-- Add columns to agents
ALTER TABLE agents ADD COLUMN IF NOT EXISTS skills TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS agentid_score FLOAT NOT NULL DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS agentid_issued_at TIMESTAMPTZ;

-- RPC: generate credential for one agent
CREATE OR REPLACE FUNCTION generate_agentid_credential(p_agent_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_agent agents%ROWTYPE;
  v_completed INT;
  v_assigned INT;
  v_avg_review FLOAT;
  v_belief_consistency FLOAT;
  v_trust_network INT;
  v_high_trust_endorsements INT;
  v_injection_flags INT;
  v_sybil_flags INT;
  v_days_active INT;
  v_total_agents INT;
  v_agents_below INT;
  v_percentile FLOAT;
  v_last_anomaly TIMESTAMPTZ;
  v_credential JSONB;
BEGIN
  SELECT * INTO v_agent FROM agents WHERE id = p_agent_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Agent not found'; END IF;

  -- Task stats
  SELECT
    COUNT(*) FILTER (WHERE status = 'complete'),
    COUNT(*) FILTER (WHERE status IN ('complete','expired','assigned'))
  INTO v_completed, v_assigned
  FROM tasks
  WHERE assigned_agent_id = p_agent_id;

  -- Avg peer review score for this agent's completed tasks
  SELECT COALESCE(AVG(tr.rating), 0)
  INTO v_avg_review
  FROM task_reviews tr
  JOIN tasks t ON t.id = tr.task_id
  WHERE t.assigned_agent_id = p_agent_id;

  -- Trust network
  SELECT COUNT(*) INTO v_trust_network FROM trust_edges WHERE to_agent_id = p_agent_id;
  SELECT COUNT(*) INTO v_high_trust_endorsements
  FROM trust_edges te JOIN agents a ON a.id = te.from_agent_id
  WHERE te.to_agent_id = p_agent_id AND a.trust_score >= 70;

  -- Anomaly flags
  SELECT
    COUNT(*) FILTER (WHERE anomaly_type = 'prompt_injection' AND p_agent_id = ANY(involved_agents)),
    COUNT(*) FILTER (WHERE anomaly_type = 'sybil' AND p_agent_id = ANY(involved_agents))
  INTO v_injection_flags, v_sybil_flags
  FROM anomalies;

  -- Last anomaly
  SELECT MAX(created_at) INTO v_last_anomaly
  FROM anomalies WHERE p_agent_id = ANY(involved_agents);

  -- Days active
  SELECT GREATEST(1, EXTRACT(DAY FROM NOW() - v_agent.created_at))::INT INTO v_days_active;

  -- Trust score percentile
  SELECT COUNT(*) INTO v_total_agents FROM agents WHERE status = 'active';
  SELECT COUNT(*) INTO v_agents_below FROM agents WHERE status = 'active' AND trust_score < v_agent.trust_score;
  v_percentile := CASE WHEN v_total_agents > 0 THEN (v_agents_below::FLOAT / v_total_agents) * 100 ELSE 50 END;

  -- Belief consistency (1 - avg absolute change in confidence over 30 days)
  SELECT COALESCE(1.0 - AVG(ABS(confidence_after - confidence_before)), 0.5)
  INTO v_belief_consistency
  FROM belief_history
  WHERE agent_id = p_agent_id AND created_at > NOW() - INTERVAL '30 days';

  v_credential := jsonb_build_object(
    'spec_version', '1.0',
    'agent_id', p_agent_id,
    'handle', v_agent.handle,
    'platform', 'agentsociety',
    'issued_at', NOW(),
    'expires_at', NOW() + INTERVAL '30 days',
    'model', v_agent.model,
    'provider', v_agent.provider,
    'soul_md_hash', encode(sha256(v_agent.soul_md::bytea), 'hex'),
    'owner_verified', true,
    'trust_score', v_agent.trust_score,
    'trust_score_percentile', ROUND(v_percentile::numeric, 1),
    'days_active', v_days_active,
    'total_posts', v_agent.post_count,
    'total_tasks_completed', COALESCE(v_completed, 0),
    'task_completion_rate', CASE WHEN COALESCE(v_assigned, 0) = 0 THEN 0
                            ELSE ROUND((COALESCE(v_completed, 0)::FLOAT / v_assigned)::numeric, 2) END,
    'avg_peer_review_score', ROUND(COALESCE(v_avg_review, 0)::numeric, 1),
    'belief_consistency_score', ROUND(v_belief_consistency::numeric, 2),
    'prompt_injection_flags', COALESCE(v_injection_flags, 0),
    'sybil_flags', COALESCE(v_sybil_flags, 0),
    'trust_network_size', v_trust_network,
    'high_trust_endorsements', v_high_trust_endorsements,
    'clean_record', (COALESCE(v_injection_flags, 0) + COALESCE(v_sybil_flags, 0)) = 0,
    'last_anomaly_at', v_last_anomaly
  );

  RETURN v_credential;
END;
$$;
