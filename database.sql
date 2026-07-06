-- PsyManager Database Schema for Supabase
-- Copy and paste this entire file into the SQL editor in Supabase

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create enum types
create type public.service_type as enum ('private', 'package');
create type public.payment_method as enum ('cash', 'bank_transfer', 'credit_card', 'other', 'my_invoice', 'center_invoice');

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
  last_name text,
  email text,
  phone text,
  notes text,
  group_id uuid references public.patient_groups(id) on delete set null,
  group_role text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Clinical notes table (diario clinico)
-- NOTE: session_id's FK to sessions is added AFTER the sessions table is
-- created (see below) to avoid a forward reference on fresh installs.
create table if not exists public.clinical_notes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  session_id uuid,
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
  duration_minutes integer not null default 60 check (duration_minutes > 0),
  price numeric(10, 2) not null check (price >= 0),
  type public.service_type not null default 'private'::public.service_type,
  -- Custom display color (hex); NULL = automatic hash-based color
  color text,
  -- Percentage of the price that belongs to the center (billing arrangements)
  center_percentage numeric(5,2) not null default 0 check (center_percentage >= 0 and center_percentage <= 100),
  -- Default method used to project net income for unpaid sessions
  default_payment_method public.payment_method,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Session series (defines a recurrence rule for a group of sessions)
-- A series belongs to EITHER an individual patient OR a patient group.
create table if not exists public.session_series (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete cascade,
  group_id uuid references public.patient_groups(id) on delete restrict,
  session_type text not null default 'individuale' check (session_type in ('individuale', 'coppia', 'familiare')),
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
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint session_series_patient_or_group_chk check (patient_id is not null or group_id is not null)
);

-- Sessions table
-- A session belongs to EITHER an individual patient OR a patient group
-- (couple/family), tracked by session_type.
create table if not exists public.sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete cascade,
  group_id uuid references public.patient_groups(id) on delete restrict,
  session_type text not null default 'individuale' check (session_type in ('individuale', 'coppia', 'familiare')),
  service_type_id uuid not null references public.service_types(id) on delete restrict,
  series_id uuid references public.session_series(id) on delete set null,
  scheduled_at timestamp with time zone not null,
  duration_minutes integer not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled', 'no_show')),
  notes text,
  google_calendar_event_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint sessions_patient_or_group_chk check (patient_id is not null or group_id is not null)
);

-- Now that sessions exists, wire up the clinical_notes FK (see note above)
alter table public.clinical_notes
  drop constraint if exists clinical_notes_session_id_fkey;
alter table public.clinical_notes
  add constraint clinical_notes_session_id_fkey
  foreign key (session_id) references public.sessions(id) on delete set null;

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
  total_sessions integer not null check (total_sessions > 0),
  completed_sessions integer not null default 0,
  total_price numeric(10, 2) not null check (total_price >= 0),
  paid_amount numeric(10, 2) not null default 0 check (paid_amount >= 0),
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
  group_id uuid references public.patient_groups(id) on delete set null,
  session_id uuid references public.sessions(id) on delete set null,
  amount numeric(10, 2) not null check (amount > 0),
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

-- Patient family members (textual genogram)
create table if not exists public.patient_family_members (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  relationship text not null,
  full_name text not null default '',
  age integer,
  alive boolean not null default true,
  relationship_quality text,
  notes text,
  display_order integer not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Attachments (images, SVG, PDF) for patients or clinical notes
create table if not exists public.attachments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  owner_type text not null check (owner_type in ('patient', 'clinical_note')),
  owner_id uuid not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  storage_path text not null unique,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create indexes for performance
create index if not exists patients_user_id_idx on public.patients(user_id);
create index if not exists service_types_user_id_idx on public.service_types(user_id);
create index if not exists sessions_user_id_idx on public.sessions(user_id);
create index if not exists sessions_patient_id_idx on public.sessions(patient_id);
create index if not exists sessions_group_id_idx on public.sessions(group_id);
create index if not exists sessions_scheduled_at_idx on public.sessions(scheduled_at);
create index if not exists sessions_status_idx on public.sessions(status);
create index if not exists session_series_group_id_idx on public.session_series(group_id);
create index if not exists payments_group_id_idx on public.payments(group_id);
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
create index if not exists patient_family_members_patient_id_idx on public.patient_family_members(patient_id);
create index if not exists attachments_owner_idx on public.attachments(owner_type, owner_id);
create index if not exists attachments_user_id_idx on public.attachments(user_id);

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
alter table public.patient_family_members enable row level security;
alter table public.attachments enable row level security;

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
    and exists (
      select 1 from public.patients p
      where p.id = patient_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.patient_tags pt
      where pt.id = tag_id and pt.user_id = auth.uid()
    )
    and exists (
      select 1 from public.patients p
      where p.id = patient_id and p.user_id = auth.uid()
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

create policy "Family members visible to patient owner" on public.patient_family_members
  for all using (
    exists (
      select 1 from public.patients p
      where p.id = patient_id and p.user_id = auth.uid()
    )
  );

create policy "Attachments visible to owner" on public.attachments
  for all using (auth.uid() = user_id);

-- Create triggers for updated_at
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

create trigger users_updated_at_trigger before update on public.users
  for each row execute function public.update_updated_at_column();

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

create trigger patient_family_members_updated_at_trigger before update on public.patient_family_members
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

-- ---------------------------------------------------------------------------
-- Reminder settings: one row per user with notification preferences
-- ---------------------------------------------------------------------------
create table if not exists public.reminder_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade unique,
  pre_session_enabled boolean not null default true,
  pre_session_minutes integer not null default 30,
  post_session_enabled boolean not null default false,
  post_session_minutes integer not null default 30,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reminder_settings enable row level security;

create policy "Users can view own reminder settings"
  on public.reminder_settings for select
  using (auth.uid() = user_id);

create policy "Users can insert own reminder settings"
  on public.reminder_settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update own reminder settings"
  on public.reminder_settings for update
  using (auth.uid() = user_id);

create policy "Users can delete own reminder settings"
  on public.reminder_settings for delete
  using (auth.uid() = user_id);

create index if not exists reminder_settings_user_id_idx on public.reminder_settings(user_id);

create trigger reminder_settings_updated_at_trigger before update on public.reminder_settings
  for each row execute function public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Calendar settings: per-user Google Calendar preferences
-- ---------------------------------------------------------------------------
create table if not exists public.calendar_settings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade unique,
  title_format text not null default 'initials'
    check (title_format in ('full', 'first_initial', 'initials')),
  color_by_service boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.calendar_settings enable row level security;

create policy "Users manage own calendar settings"
  on public.calendar_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists calendar_settings_user_id_idx on public.calendar_settings(user_id);

create trigger calendar_settings_updated_at_trigger before update on public.calendar_settings
  for each row execute function public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Tax settings (regime forfettario) for net income estimates
-- ---------------------------------------------------------------------------
create table if not exists public.tax_settings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade unique,
  coefficiente_redditivita numeric(5,2) not null default 78
    check (coefficiente_redditivita >= 0 and coefficiente_redditivita <= 100),
  imposta_sostitutiva_pct numeric(5,2) not null default 5
    check (imposta_sostitutiva_pct >= 0 and imposta_sostitutiva_pct <= 100),
  enpap_pct numeric(5,2) not null default 10
    check (enpap_pct >= 0 and enpap_pct <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tax_settings enable row level security;

create policy "Users manage own tax settings"
  on public.tax_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists tax_settings_user_id_idx on public.tax_settings(user_id);

create trigger tax_settings_updated_at_trigger before update on public.tax_settings
  for each row execute function public.update_updated_at_column();
