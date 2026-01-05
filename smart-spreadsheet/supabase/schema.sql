-- Smart Spreadsheet Schema
-- Run this in your Supabase SQL Editor

-- ============================================
-- DEV MODE: No auth, just get it working
-- ============================================

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),

  -- user_id is nullable for dev mode (no auth)
  user_id uuid default '00000000-0000-0000-0000-000000000000',

  -- Input
  name text not null,

  -- Enrichment fields (null until populated)
  website text,
  description text,
  industry text,
  employee_count text,
  amount_raised text,

  -- Task tracking
  enrichment_status text default 'pending', -- pending, enriching, complete, error
  enrichment_started_at timestamptz,
  enrichment_completed_at timestamptz,

  -- Error tracking per field
  errors jsonb default '{}'::jsonb
);

-- Index for user queries
create index if not exists companies_user_id_idx on companies(user_id);

-- Enable realtime
alter publication supabase_realtime add table companies;

-- RLS disabled for dev mode
-- alter table companies enable row level security;

-- ============================================
-- PRODUCTION: Uncomment below, comment above
-- ============================================
-- Change user_id column to: uuid references auth.users(id) on delete cascade not null
-- Then enable RLS and add these policies:
--
-- alter table companies enable row level security;
--
-- create policy "Users can view own companies"
--   on companies for select
--   using (auth.uid() = user_id);
--
-- create policy "Users can insert own companies"
--   on companies for insert
--   with check (auth.uid() = user_id);
--
-- create policy "Users can update own companies"
--   on companies for update
--   using (auth.uid() = user_id);
--
-- create policy "Users can delete own companies"
--   on companies for delete
--   using (auth.uid() = user_id);
