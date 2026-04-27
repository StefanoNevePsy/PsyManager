-- PsyManager Database Schema for Supabase
-- Copy and paste this entire file into the SQL editor in Supabase

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create enum types
create type public.service_type as enum ('private', 'package');
create type public.payment_method as enum ('cash', 'bank_transfer', 'credit_card', 'other');

-- Users table (extends auth.users from Supabase)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Patient groups table (couples, families, etc.)
create table if not exists public.patient_groups (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  type text not null default 'family' check (type in ('couple', 'family', 'other')),
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Patients table
create table if not exists public.patients (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  notes text,
  group_id uuid references public.patient_groups(id) on delete set null,
  group_role text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Clinical notes table (diario clinico)
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

-- Service types table
create table if not exists public.service_types (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  duration_minutes integer not null default 60,
  price numeric(10, 2) not null,
  type public.service_type not null default 'private'::public.service_type,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Session series (defines a recurrence rule for a group of sessions)
create table if not exists public.session_series (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  service_type_id uuid not null references public.service_types(id) on delete restrict,
  frequency text not null check (frequency in ('weekly', 'biweekly', 'monthly', 'custom')),
  interval_value integer not null default 1 check (interval_value > 0),
  interval_unit text not null default 'week' check (interval_unit in ('day', 'week', 'month')),
  days_of_week integer[] not null default '{}',
  end_type text not null check (end_type in ('count', 'until', 'never')),
  end_count integer check (end_count > 0),
  end_date date,
  start_at timestamp with time zone not null,
  duration_minutes integer not null,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Sessions table
create table if not exists public.sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  service_type_id uuid not null references public.service_types(id) on delete restrict,
  series_id uuid references public.session_series(id) on delete set null,
  scheduled_at timestamp with time zone not null,
  duration_minutes integer not null,
  notes text,
  google_calendar_event_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Structures table (for package work)
create table if not exists public.structures (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Package agreements table
create table if not exists public.package_agreements (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  structure_id uuid not null references public.structures(id) on delete cascade,
  total_sessions integer not null,
  completed_sessions integer not null default 0,
  total_price numeric(10, 2) not null,
  paid_amount numeric(10, 2) not null default 0,
  start_date date not null,
  end_date date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Payments table
create table if not exists public.payments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete set null,
  session_id uuid references public.sessions(id) on delete set null,
  amount numeric(10, 2) not null,
  payment_date date not null,
  payment_method public.payment_method not null default 'cash'::public.payment_method,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

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

-- Patient tag assignments (many-to-many: patients can have multiple tags)
create table if not exists public.patient_tag_assignments (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  tag_id uuid not null references public.patient_tags(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(patient_id, tag_id)
);

-- Patient contacts (additional phone numbers and emails with custom labels)
create table if not exists public.patient_contacts (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  kind text not null check (kind in ('phone', 'email')),
  label text not null default '',
  value text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create indexes for performance
create index if not exists patients_user_id_idx on public.patients(user_id);
create index if not exists service_types_user_id_idx on public.service_types(user_id);
create index if not exists sessions_user_id_idx on public.sessions(user_id);
create index if not exists sessions_patient_id_idx on public.sessions(patient_id);
create index if not exists sessions_scheduled_at_idx on public.sessions(scheduled_at);
create index if not exists structures_user_id_idx on public.structures(user_id);
create index if not exists package_agreements_user_id_idx on public.package_agreements(user_id);
create index if not exists package_agreements_structure_id_idx on public.package_agreements(structure_id);
create index if not exists payments_user_id_idx on public.payments(user_id);
create index if not exists payments_patient_id_idx on public.payments(patient_id);
create index if not exists payments_payment_date_idx on public.payments(payment_date);
create index if not exists patient_groups_user_id_idx on public.patient_groups(user_id);
create index if not exists patients_group_id_idx on public.patients(group_id);
create index if not exists clinical_notes_user_id_idx on public.clinical_notes(user_id);
create index if not exists clinical_notes_patient_id_idx on public.clinical_notes(patient_id);
create index if not exists clinical_notes_session_id_idx on public.clinical_notes(session_id);
create index if not exists clinical_notes_note_date_idx on public.clinical_notes(note_date);
create index if not exists patient_tags_user_id_idx on public.patient_tags(user_id);
create index if not exists patient_tag_assignments_patient_id_idx on public.patient_tag_assignments(patient_id);
create index if not exists patient_tag_assignments_tag_id_idx on public.patient_tag_assignments(tag_id);
create index if not exists session_series_user_id_idx on public.session_series(user_id);
create index if not exists session_series_patient_id_idx on public.session_series(patient_id);
create index if not exists sessions_series_id_idx on public.sessions(series_id);
create index if not exists patient_contacts_patient_id_idx on public.patient_contacts(patient_id);
create index if not exists patient_contacts_kind_idx on public.patient_contacts(kind);

-- Enable Row Level Security
alter table public.users enable row level security;
alter table public.patients enable row level security;
alter table public.service_types enable row level security;
alter table public.sessions enable row level security;
alter table public.structures enable row level security;
alter table public.package_agreements enable row level security;
alter table public.payments enable row level security;
alter table public.patient_groups enable row level security;
alter table public.clinical_notes enable row level security;
alter table public.patient_tags enable row level security;
alter table public.patient_tag_assignments enable row level security;
alter table public.session_series enable row level security;
alter table public.patient_contacts enable row level security;

-- Create RLS policies
create policy "Users can view their own data" on public.users
  for select using (auth.uid() = id);

create policy "Users can insert their own data" on public.users
  for insert with check (auth.uid() = id);

create policy "Users can update their own data" on public.users
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "Patients are visible to their owner" on public.patients
  for all using (auth.uid() = user_id);

create policy "Service types are visible to their owner" on public.service_types
  for all using (auth.uid() = user_id);

create policy "Sessions are visible to their owner" on public.sessions
  for all using (auth.uid() = user_id);

create policy "Structures are visible to their owner" on public.structures
  for all using (auth.uid() = user_id);

create policy "Package agreements are visible to their owner" on public.package_agreements
  for all using (auth.uid() = user_id);

create policy "Payments are visible to their owner" on public.payments
  for all using (auth.uid() = user_id);

create policy "Patient groups visible to owner" on public.patient_groups
  for all using (auth.uid() = user_id);

create policy "Clinical notes visible to owner" on public.clinical_notes
  for all using (auth.uid() = user_id);

create policy "Patient tags visible to owner" on public.patient_tags
  for all using (auth.uid() = user_id);

create policy "Patient tag assignments visible to owner" on public.patient_tag_assignments
  for all using (
    exists (
      select 1 from public.patient_tags pt
      where pt.id = tag_id and pt.user_id = auth.uid()
    )
  );

create policy "Session series visible to owner" on public.session_series
  for all using (auth.uid() = user_id);

create policy "Patient contacts visible to patient owner" on public.patient_contacts
  for all using (
    exists (
      select 1 from public.patients p
      where p.id = patient_id and p.user_id = auth.uid()
    )
  );

-- Create triggers for updated_at
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

create trigger patients_updated_at_trigger before update on public.patients
  for each row execute function public.update_updated_at_column();

create trigger service_types_updated_at_trigger before update on public.service_types
  for each row execute function public.update_updated_at_column();

create trigger sessions_updated_at_trigger before update on public.sessions
  for each row execute function public.update_updated_at_column();

create trigger structures_updated_at_trigger before update on public.structures
  for each row execute function public.update_updated_at_column();

create trigger package_agreements_updated_at_trigger before update on public.package_agreements
  for each row execute function public.update_updated_at_column();

create trigger payments_updated_at_trigger before update on public.payments
  for each row execute function public.update_updated_at_column();

create trigger patient_groups_updated_at_trigger before update on public.patient_groups
  for each row execute function public.update_updated_at_column();

create trigger clinical_notes_updated_at_trigger before update on public.clinical_notes
  for each row execute function public.update_updated_at_column();

create trigger patient_tags_updated_at_trigger before update on public.patient_tags
  for each row execute function public.update_updated_at_column();

create trigger session_series_updated_at_trigger before update on public.session_series
  for each row execute function public.update_updated_at_column();

create trigger patient_contacts_updated_at_trigger before update on public.patient_contacts
  for each row execute function public.update_updated_at_column();

-- Auto-create a public.users row whenever a new auth.users row is created
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
