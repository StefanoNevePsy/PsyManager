-- Migration: Add recurring sessions support

-- Session series: defines a recurrence rule for a group of sessions
create table if not exists public.session_series (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  service_type_id uuid not null references public.service_types(id) on delete restrict,
  -- frequency: weekly | biweekly | monthly | custom
  frequency text not null check (frequency in ('weekly', 'biweekly', 'monthly', 'custom')),
  -- interval: every N units (1=every, 2=every other, etc.)
  interval_value integer not null default 1 check (interval_value > 0),
  -- interval_unit: day | week | month (only meaningful for custom)
  interval_unit text not null default 'week' check (interval_unit in ('day', 'week', 'month')),
  -- days_of_week: array of 0-6 (sunday-saturday) for weekly/biweekly recurrences
  days_of_week integer[] not null default '{}',
  -- end_type: count | until | never
  end_type text not null check (end_type in ('count', 'until', 'never')),
  end_count integer check (end_count > 0),
  end_date date,
  start_at timestamp with time zone not null,
  duration_minutes integer not null,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add series_id to sessions table to link them to a recurrence series
alter table public.sessions
  add column if not exists series_id uuid references public.session_series(id) on delete set null;

-- Indexes
create index if not exists session_series_user_id_idx on public.session_series(user_id);
create index if not exists session_series_patient_id_idx on public.session_series(patient_id);
create index if not exists sessions_series_id_idx on public.sessions(series_id);

-- Enable RLS
alter table public.session_series enable row level security;

-- RLS policy
create policy "Session series visible to owner" on public.session_series
  for all using (auth.uid() = user_id);

-- Trigger for updated_at
create trigger session_series_updated_at_trigger before update on public.session_series
  for each row execute function public.update_updated_at_column();
