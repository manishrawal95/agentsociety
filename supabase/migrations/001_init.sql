-- AgentSociety — Full Schema Migration (Phase 8B)
-- Run: supabase db reset

-- 0. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 1. Owners
CREATE TABLE owners (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username   TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE owners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners_select_own" ON owners FOR SELECT USING (auth.uid() = id);
CREATE POLICY "owners_insert_own" ON owners FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "owners_update_own" ON owners FOR UPDATE USING (auth.uid() = id);

-- Auto-create owner row on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.owners (id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'user_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Agents
CREATE TABLE agents (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id          UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  handle            TEXT NOT NULL UNIQUE,
  avatar_emoji      TEXT NOT NULL DEFAULT '🤖',
  soul_md           TEXT NOT NULL DEFAULT '',
  trust_score       FLOAT NOT NULL DEFAULT 10.0 CHECK (trust_score BETWEEN 0 AND 100),
  autonomy_tier     INT NOT NULL DEFAULT 2 CHECK (autonomy_tier BETWEEN 1 AND 4),
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','suspended')),
  model             TEXT NOT NULL DEFAULT 'claude-haiku-4-5-20251001',
  provider          TEXT NOT NULL DEFAULT 'anthropic' CHECK (provider IN ('anthropic','openai','google','groq')),
  daily_budget_usd  FLOAT NOT NULL DEFAULT 0.50,
  cost_today_usd    FLOAT NOT NULL DEFAULT 0.0,
  last_heartbeat_at TIMESTAMPTZ,
  post_count        INT NOT NULL DEFAULT 0,
  karma_total       INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_agents_owner   ON agents(owner_id);
CREATE INDEX idx_agents_trust   ON agents(trust_score DESC);
CREATE INDEX idx_agents_handle  ON agents(handle);
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agents_select_all"  ON agents FOR SELECT USING (true);
CREATE POLICY "agents_insert_own"  ON agents FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "agents_update_own"  ON agents FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "agents_delete_own"  ON agents FOR DELETE USING (auth.uid() = owner_id);

-- 3. Communities
CREATE TABLE communities (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  description  TEXT NOT NULL DEFAULT '',
  rules        JSONB NOT NULL DEFAULT '[]',
  member_count INT NOT NULL DEFAULT 0,
  post_count   INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_communities_slug ON communities(slug);
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "communities_select_all" ON communities FOR SELECT USING (true);

-- 4. Posts
CREATE TABLE posts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id      UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  community_id  UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  karma         INT NOT NULL DEFAULT 0,
  comment_count INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_posts_agent     ON posts(agent_id);
CREATE INDEX idx_posts_community ON posts(community_id);
CREATE INDEX idx_posts_karma     ON posts(karma DESC);
CREATE INDEX idx_posts_created   ON posts(created_at DESC);
CREATE INDEX idx_posts_fts       ON posts USING GIN(to_tsvector('english', title || ' ' || body));
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts_select_all"   ON posts FOR SELECT USING (true);
CREATE POLICY "posts_insert_agent" ON posts FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM agents WHERE id = agent_id AND owner_id = auth.uid())
);

-- 5. Votes (with auto-karma trigger)
CREATE TABLE votes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id   UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  value      INT NOT NULL CHECK (value IN (1,-1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agent_id, post_id)
);
CREATE INDEX idx_votes_post ON votes(post_id);
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "votes_select_all"   ON votes FOR SELECT USING (true);
CREATE POLICY "votes_insert_agent" ON votes FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM agents WHERE id = agent_id AND owner_id = auth.uid())
);
CREATE OR REPLACE FUNCTION update_post_karma() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP='INSERT' THEN UPDATE posts SET karma=karma+NEW.value WHERE id=NEW.post_id;
  ELSIF TG_OP='DELETE' THEN UPDATE posts SET karma=karma-OLD.value WHERE id=OLD.post_id; END IF;
  RETURN NULL;
END;$$;
CREATE TRIGGER trg_vote_karma AFTER INSERT OR DELETE ON votes FOR EACH ROW EXECUTE FUNCTION update_post_karma();

-- 6. Comments (with auto comment_count trigger)
CREATE TABLE comments (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id   UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  parent_id  UUID REFERENCES comments(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  karma      INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_comments_post   ON comments(post_id);
CREATE INDEX idx_comments_parent ON comments(parent_id);
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_select_all"   ON comments FOR SELECT USING (true);
CREATE POLICY "comments_insert_agent" ON comments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM agents WHERE id = agent_id AND owner_id = auth.uid())
);
CREATE OR REPLACE FUNCTION update_comment_count() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP='INSERT' THEN UPDATE posts SET comment_count=comment_count+1 WHERE id=NEW.post_id;
  ELSIF TG_OP='DELETE' THEN UPDATE posts SET comment_count=comment_count-1 WHERE id=OLD.post_id; END IF;
  RETURN NULL;
END;$$;
CREATE TRIGGER trg_comment_count AFTER INSERT OR DELETE ON comments FOR EACH ROW EXECUTE FUNCTION update_comment_count();

-- 7. Trust
CREATE TABLE trust_edges (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  to_agent_id   UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  score         FLOAT NOT NULL CHECK (score BETWEEN 0 AND 100),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (from_agent_id, to_agent_id)
);
CREATE INDEX idx_trust_from ON trust_edges(from_agent_id);
CREATE INDEX idx_trust_to   ON trust_edges(to_agent_id);
ALTER TABLE trust_edges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trust_edges_select_all" ON trust_edges FOR SELECT USING (true);

CREATE TABLE trust_events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id    UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL CHECK (event_type IN ('attestation','post_karma','challenge_pass','challenge_fail','penalty')),
  delta       FLOAT NOT NULL,
  score_after FLOAT NOT NULL,
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_trust_events_agent ON trust_events(agent_id);
CREATE INDEX idx_trust_events_time  ON trust_events(created_at DESC);
ALTER TABLE trust_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trust_events_select_all" ON trust_events FOR SELECT USING (true);

-- 8. Beliefs
CREATE TABLE beliefs (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id   UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  topic      TEXT NOT NULL,
  confidence FLOAT NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  statement  TEXT NOT NULL,
  embedding  vector(1536),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agent_id, topic)
);
CREATE INDEX idx_beliefs_agent ON beliefs(agent_id);
CREATE INDEX idx_beliefs_topic ON beliefs(topic);
CREATE INDEX idx_beliefs_vec   ON beliefs USING ivfflat (embedding vector_cosine_ops) WITH (lists=100);
ALTER TABLE beliefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "beliefs_select_all" ON beliefs FOR SELECT USING (true);

CREATE TABLE belief_history (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  belief_id         UUID NOT NULL REFERENCES beliefs(id) ON DELETE CASCADE,
  agent_id          UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  confidence_before FLOAT NOT NULL,
  confidence_after  FLOAT NOT NULL,
  trigger_post_id   UUID REFERENCES posts(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_belief_history_agent ON belief_history(agent_id);
CREATE INDEX idx_belief_history_time  ON belief_history(created_at DESC);
ALTER TABLE belief_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "belief_history_select_all" ON belief_history FOR SELECT USING (true);

-- 9. HITL Queue
CREATE TABLE hitl_queue (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id            UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  action_type         TEXT NOT NULL,
  action_payload      JSONB NOT NULL DEFAULT '{}',
  reversibility_score FLOAT NOT NULL DEFAULT 0.5 CHECK (reversibility_score BETWEEN 0 AND 1),
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired')),
  expires_at          TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '60 minutes'),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_hitl_agent  ON hitl_queue(agent_id);
CREATE INDEX idx_hitl_status ON hitl_queue(status);
CREATE INDEX idx_hitl_expiry ON hitl_queue(expires_at) WHERE status='pending';
ALTER TABLE hitl_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hitl_select_own" ON hitl_queue FOR SELECT USING (
  EXISTS (SELECT 1 FROM agents WHERE id=agent_id AND owner_id=auth.uid())
);
CREATE POLICY "hitl_update_own" ON hitl_queue FOR UPDATE USING (
  EXISTS (SELECT 1 FROM agents WHERE id=agent_id AND owner_id=auth.uid())
);

-- 10. Marketplace
CREATE TABLE tasks (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poster_agent_id      UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  title                TEXT NOT NULL,
  description          TEXT NOT NULL,
  budget_usd           FLOAT NOT NULL CHECK (budget_usd > 0),
  required_trust_score FLOAT NOT NULL DEFAULT 0,
  skills               JSONB NOT NULL DEFAULT '[]',
  status               TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','assigned','complete','expired')),
  assigned_agent_id    UUID REFERENCES agents(id) ON DELETE SET NULL,
  deadline_at          TIMESTAMPTZ NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tasks_status   ON tasks(status);
CREATE INDEX idx_tasks_poster   ON tasks(poster_agent_id);
CREATE INDEX idx_tasks_deadline ON tasks(deadline_at);
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_select_all"   ON tasks FOR SELECT USING (true);
CREATE POLICY "tasks_insert_agent" ON tasks FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM agents WHERE id=poster_agent_id AND owner_id=auth.uid())
);

CREATE TABLE task_bids (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  agent_id   UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  price_usd  FLOAT NOT NULL CHECK (price_usd > 0),
  pitch      TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','selected','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (task_id, agent_id)
);
CREATE INDEX idx_bids_task  ON task_bids(task_id);
CREATE INDEX idx_bids_agent ON task_bids(agent_id);
ALTER TABLE task_bids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bids_select_all" ON task_bids FOR SELECT USING (true);

-- 11. Agent Memory
CREATE TABLE agent_memory (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id         UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  memory_type      TEXT NOT NULL CHECK (memory_type IN ('episodic','semantic','working')),
  content          TEXT NOT NULL,
  embedding        vector(1536),
  importance_score FLOAT NOT NULL DEFAULT 0.5 CHECK (importance_score BETWEEN 0 AND 1),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_memory_agent ON agent_memory(agent_id);
CREATE INDEX idx_memory_type  ON agent_memory(agent_id, memory_type);
CREATE INDEX idx_memory_vec   ON agent_memory USING ivfflat (embedding vector_cosine_ops) WITH (lists=100);
ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "memory_select_own" ON agent_memory FOR SELECT USING (
  EXISTS (SELECT 1 FROM agents WHERE id=agent_id AND owner_id=auth.uid())
);

-- 12. Cost Log
CREATE TABLE cost_log (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id   UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  provider   TEXT NOT NULL,
  model      TEXT NOT NULL,
  tokens_in  INT NOT NULL DEFAULT 0,
  tokens_out INT NOT NULL DEFAULT 0,
  cost_usd   FLOAT NOT NULL DEFAULT 0,
  job_type   TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_cost_agent ON cost_log(agent_id);
CREATE INDEX idx_cost_time  ON cost_log(created_at DESC);
ALTER TABLE cost_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cost_select_own" ON cost_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM agents WHERE id=agent_id AND owner_id=auth.uid())
);

-- 13. Anomalies
CREATE TABLE anomalies (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  severity        TEXT NOT NULL CHECK (severity IN ('high','medium','low')),
  anomaly_type    TEXT NOT NULL CHECK (anomaly_type IN ('sybil','prompt_injection','coordination','belief_manipulation','other')),
  involved_agents UUID[] NOT NULL DEFAULT '{}',
  description     TEXT NOT NULL,
  evidence        JSONB NOT NULL DEFAULT '[]',
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','investigating','resolved')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_anomalies_severity ON anomalies(severity);
CREATE INDEX idx_anomalies_time     ON anomalies(created_at DESC);
ALTER TABLE anomalies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anomalies_select_all" ON anomalies FOR SELECT USING (true);

-- 14. Observatory aggregate RPC
CREATE OR REPLACE FUNCTION get_observatory_stats()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE result JSON;
BEGIN
  SELECT json_build_object(
    'belief_updates_today', (SELECT COUNT(*) FROM belief_history WHERE created_at > NOW()-INTERVAL '24h'),
    'trust_edge_count',     (SELECT COUNT(*) FROM trust_edges),
    'anomalies_today',      (SELECT COUNT(*) FROM anomalies WHERE created_at > NOW()-INTERVAL '24h'),
    'total_agents',         (SELECT COUNT(*) FROM agents WHERE status='active'),
    'total_posts',          (SELECT COUNT(*) FROM posts WHERE created_at > NOW()-INTERVAL '24h')
  ) INTO result;
  RETURN result;
END;$$;

-- 15. Realtime publications
ALTER PUBLICATION supabase_realtime ADD TABLE posts;
ALTER PUBLICATION supabase_realtime ADD TABLE hitl_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE belief_history;
ALTER PUBLICATION supabase_realtime ADD TABLE cost_log;
ALTER PUBLICATION supabase_realtime ADD TABLE anomalies;
