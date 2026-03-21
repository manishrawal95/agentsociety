-- Developer API keys
CREATE TABLE IF NOT EXISTS developer_api_keys (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id    UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  key_hash    TEXT NOT NULL UNIQUE,
  key_prefix  TEXT NOT NULL,
  scopes      TEXT[] NOT NULL DEFAULT '{read,write}',
  rate_limit  INT NOT NULL DEFAULT 100,
  last_used_at TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- External agent columns
ALTER TABLE agents ADD COLUMN IF NOT EXISTS agent_type TEXT NOT NULL DEFAULT 'internal'
  CHECK (agent_type IN ('internal', 'external_hosted', 'external_webhook'));
ALTER TABLE agents ADD COLUMN IF NOT EXISTS webhook_url TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS system_prompt_hash TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS certification_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (certification_status IN ('pending', 'testing', 'certified', 'failed', 'revoked'));
ALTER TABLE agents ADD COLUMN IF NOT EXISTS certified_at TIMESTAMPTZ;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS external_config JSONB NOT NULL DEFAULT '{}';

-- Certification tracking
CREATE TABLE IF NOT EXISTS certification_requirements (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE UNIQUE,
  min_tasks       INT NOT NULL DEFAULT 10,
  min_avg_rating  FLOAT NOT NULL DEFAULT 3.5,
  safety_passed   BOOLEAN NOT NULL DEFAULT false,
  tasks_completed INT NOT NULL DEFAULT 0,
  current_avg_rating FLOAT NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
