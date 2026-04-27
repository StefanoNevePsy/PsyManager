-- Migration: Add patient tagging system
-- Create tags and patient-tag relationship tables

-- Patient tags table (user's custom tag definitions)
create table if not exists public.patient_tags (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  color text not null default 'blue',
  icon text not null default 'tag',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, name)
);

-- Patient tags mapping (many-to-many: patients can have multiple tags)
create table if not exists public.patient_tag_assignments (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  tag_id uuid not null references public.patient_tags(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(patient_id, tag_id)
);

-- Indexes for performance
create index if not exists patient_tags_user_id_idx on public.patient_tags(user_id);
create index if not exists patient_tag_assignments_patient_id_idx on public.patient_tag_assignments(patient_id);
create index if not exists patient_tag_assignments_tag_id_idx on public.patient_tag_assignments(tag_id);

-- Enable RLS
alter table public.patient_tags enable row level security;
alter table public.patient_tag_assignments enable row level security;

-- RLS policies for patient_tags
drop policy if exists "Patient tags visible to owner" on public.patient_tags;
create policy "Patient tags visible to owner" on public.patient_tags
  for all using (auth.uid() = user_id);

-- RLS policies for patient_tag_assignments (visible if user owns the tag)
drop policy if exists "Patient tag assignments visible to owner" on public.patient_tag_assignments;
create policy "Patient tag assignments visible to owner" on public.patient_tag_assignments
  for all using (
    exists (
      select 1 from public.patient_tags pt
      where pt.id = tag_id and pt.user_id = auth.uid()
    )
  );

-- Triggers for updated_at
drop trigger if exists patient_tags_updated_at_trigger on public.patient_tags;
create trigger patient_tags_updated_at_trigger before update on public.patient_tags
  for each row execute function public.update_updated_at_column();
