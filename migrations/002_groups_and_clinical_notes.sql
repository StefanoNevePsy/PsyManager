-- Migration 002: Add patient groups (families/couples) and clinical notes
-- Run this in Supabase SQL Editor.

-- 1) Patient groups table (couples, families)
create table if not exists public.patient_groups (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  type text not null default 'family' check (type in ('couple', 'family', 'other')),
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2) Add group_id and group_role to patients
alter table public.patients
  add column if not exists group_id  uuid references public.patient_groups(id) on delete set null,
  add column if not exists group_role text;

-- 3) Clinical notes (diario clinico)
create table if not exists public.clinical_notes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete set null,
  title text,
  content text not null,
  note_date date not null default current_date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4) Indexes
create index if not exists patient_groups_user_id_idx     on public.patient_groups(user_id);
create index if not exists patients_group_id_idx          on public.patients(group_id);
create index if not exists clinical_notes_user_id_idx     on public.clinical_notes(user_id);
create index if not exists clinical_notes_patient_id_idx  on public.clinical_notes(patient_id);
create index if not exists clinical_notes_session_id_idx  on public.clinical_notes(session_id);
create index if not exists clinical_notes_note_date_idx   on public.clinical_notes(note_date);

-- 5) Row Level Security
alter table public.patient_groups enable row level security;
alter table public.clinical_notes enable row level security;

create policy "Patient groups visible to owner" on public.patient_groups
  for all using (auth.uid() = user_id);

create policy "Clinical notes visible to owner" on public.clinical_notes
  for all using (auth.uid() = user_id);

-- 6) updated_at triggers
create trigger patient_groups_updated_at_trigger
  before update on public.patient_groups
  for each row execute function public.update_updated_at_column();

create trigger clinical_notes_updated_at_trigger
  before update on public.clinical_notes
  for each row execute function public.update_updated_at_column();
