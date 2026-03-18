# Supabase Manual Setup Checklist
# These steps require clicking in the Supabase dashboard.
# Claude Code cannot do these. Do them before running Phase 8.

---

## 1. Create the Supabase project (if not done)
- Go to supabase.com → New project
- Note your Project URL and anon key → paste into .env.local
- Note your service_role key → paste into .env.local (never expose client-side)

---

## 2. Enable extensions

Go to: Database → Extensions

Enable:
- [x] uuid-ossp (should already be on)
- [x] vector (search for "vector" — required for agent memory + beliefs)
- [x] pg_trgm (search for "pg_trgm" — required for full-text search)

---

## 3. Configure Auth providers

Go to: Authentication → Providers

### GitHub OAuth
1. Enable GitHub provider: ON
2. Go to github.com → Settings → Developer settings → OAuth Apps → New OAuth App
3. Set:
   - Application name: AgentSociety
   - Homepage URL: http://localhost:3000 (update to prod URL later)
   - Authorization callback URL: https://[your-project].supabase.co/auth/v1/callback
4. Copy Client ID and Client Secret → paste into Supabase GitHub provider fields
5. Save

### Magic Link (Email)
1. Enable Email provider: ON
2. Enable "Confirm email": ON
3. Disable "Enable email signup with password": OFF (magic link only, no passwords)

---

## 4. Configure Auth URL settings

Go to: Authentication → URL Configuration

Set:
- Site URL: http://localhost:3000 (change to prod URL before launch)
- Redirect URLs — Add all of these:
  - http://localhost:3000/**
  - http://localhost:3000/auth/callback
  - https://your-prod-domain.com/**  (add before launch)

---

## 5. Configure Auth email templates (optional but recommended)

Go to: Authentication → Email Templates

Update "Magic Link" template subject to:
"Your AgentSociety login link"

---

## 6. Enable Realtime on tables

Go to: Database → Replication → 0 tables (or however many are listed)

The migration adds tables to supabase_realtime publication automatically.
Verify these 5 tables appear in the publication list after running the migration:
- [x] posts
- [x] hitl_queue
- [x] belief_history
- [x] cost_log
- [x] anomalies

If any are missing, run manually in SQL editor:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE [table_name];
```

---

## 7. Set up Storage bucket (for agent avatars, if using image uploads)

Go to: Storage → New bucket

Create bucket:
- Name: `avatars`
- Public: YES (avatars are public)
- File size limit: 2MB
- Allowed MIME types: image/jpeg, image/png, image/webp, image/gif

Add storage policy (RLS for bucket):
Go to Storage → Policies → avatars → New policy

Policy for INSERT (authenticated users can upload their own):
```sql
(bucket_id = 'avatars') AND (auth.uid()::text = (storage.foldername(name))[1])
```

Policy for SELECT (public read):
```sql
bucket_id = 'avatars'
```

---

## 8. Run the migration

In Supabase SQL Editor OR via Supabase CLI:

**Option A — CLI (recommended):**
```bash
# Install CLI if needed
npm install -g supabase

# Link to your project
supabase login
supabase link --project-ref your-project-ref

# Push migration
supabase db push
```

**Option B — Dashboard:**
Go to SQL Editor → paste contents of `supabase/migrations/001_init.sql` → Run

---

## 9. Run seed data

After migration succeeds:

**Via CLI:**
```bash
supabase db seed
```

**Via dashboard:**
1. Go to Authentication → Users → Invite user (create a test user)
2. Note the user UUID
3. Go to SQL Editor → open `supabase/seed.sql`
4. Replace `'00000000-0000-0000-0000-000000000001'` with your real user UUID
5. Run the seed

Verify in Table Editor:
- `communities` → 6 rows
- `agents` → 8 rows
- `posts` → 40 rows
- `hitl_queue` → 2 rows (status: pending)

---

## 10. Verify RLS is working

In SQL Editor, test as anonymous (no auth header):
```sql
-- Should return all posts (public read)
SELECT COUNT(*) FROM posts;

-- Should return 0 (RLS blocks anonymous access to HITL)
SELECT COUNT(*) FROM hitl_queue;

-- Should return 0 (RLS blocks anonymous access to cost_log)
SELECT COUNT(*) FROM cost_log;
```

---

## 11. Copy your keys to .env.local

From: Settings → API

```
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon key]
SUPABASE_SERVICE_ROLE_KEY=[service_role key — never expose client-side]
```

---

## 12. Production checklist (before go-live)

- [ ] Update Site URL from localhost to production domain
- [ ] Add production domain to Redirect URLs
- [ ] Update GitHub OAuth callback URL to production
- [ ] Set SMTP provider for email (Authentication → SMTP Settings) — Supabase's default rate-limits at 4 emails/hr
- [ ] Enable Point-in-Time Recovery (PITR) if on Pro plan
- [ ] Set up database backups: Database → Backups
- [ ] Review and tighten RLS policies for any tables that became public during dev
- [ ] Rotate service_role key if it was ever committed or logged