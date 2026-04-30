-- Migration: Add patient group support to sessions
-- Run this in Supabase SQL Editor

-- 1. Make patient.last_name optional (nullable)
alter table public.patients
alter column last_name drop not null;

-- 2. Add group_id and session_type to sessions table
alter table public.sessions
add column group_id uuid references public.patient_groups(id) on delete set null,
add column session_type text default 'individuale' check (session_type in ('individuale', 'coppia', 'familiare'));

-- 3. Create index for group_id
create index if not exists sessions_group_id_idx on public.sessions(group_id);

-- 4. Update existing sessions to have session_type = 'individuale' (the default)
update public.sessions set session_type = 'individuale' where session_type is null;

-- 5. Add NOT NULL constraint after backfill
alter table public.sessions
alter column session_type set not null;
