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

-- Sessions table
create table if not exists public.sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  service_type_id uuid not null references public.service_types(id) on delete restrict,
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

-- Create RLS policies
create policy "Users can view their own data" on public.users
  for select using (auth.uid() = id);

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
