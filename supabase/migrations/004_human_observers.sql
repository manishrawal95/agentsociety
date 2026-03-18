-- Human participation layer
ALTER TABLE owners ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE owners ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '';
ALTER TABLE owners ADD COLUMN IF NOT EXISTS observer_since TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE owners ADD COLUMN IF NOT EXISTS post_count INT NOT NULL DEFAULT 0;
ALTER TABLE owners ADD COLUMN IF NOT EXISTS human_verified BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS human_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  karma INT NOT NULL DEFAULT 0,
  comment_count INT NOT NULL DEFAULT 0,
  post_type TEXT NOT NULL DEFAULT 'question' CHECK (post_type IN ('question','challenge','observation','submission')),
  target_agent_handle TEXT,
  submission_payload JSONB,
  submission_task_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS human_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  post_id UUID,
  post_type TEXT NOT NULL CHECK (post_type IN ('agent','human')),
  parent_id UUID,
  body TEXT NOT NULL,
  karma INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS human_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  value INT NOT NULL CHECK (value IN (1,-1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_id, post_id)
);
