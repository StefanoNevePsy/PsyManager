-- =============================================================================
-- PSYMANAGER — SCRIPT UNICO DI CONFIGURAZIONE DATABASE (Supabase)
-- =============================================================================
--
-- COS'È QUESTO FILE
-- Questo è l'UNICO file SQL che serve per creare o aggiornare il database di
-- PsyManager su Supabase. Contiene tutte le tabelle, le regole di sicurezza
-- e le automazioni necessarie al funzionamento dell'app, già unificate in
-- un solo script.
--
-- È SICURO SU UN PROGETTO NUOVO O GIÀ ESISTENTE
-- Puoi incollarlo tanto su un progetto Supabase appena creato (vuoto) quanto
-- su un progetto PsyManager che hai già usato in passato, anche se contiene
-- solo una versione parziale o più vecchia dello schema: lo script controlla
-- ogni volta cosa esiste già e crea solo ciò che manca, senza mai cancellare
-- dati o duplicare oggetti.
--
-- PUOI RIESEGUIRLO SENZA PROBLEMI
-- Se lo esegui più volte (per errore, per sicurezza, o per applicare un
-- aggiornamento futuro) non succede nulla di male: ogni istruzione è scritta
-- in modo da non generare errori né duplicati se l'elemento esiste già.
--
-- COME USARLO (3 passi)
--   1. Apri il tuo progetto su https://supabase.com → menu laterale "SQL Editor".
--   2. Clicca su "New query" e incolla TUTTO il contenuto di questo file.
--   3. Clicca su "Run". Al termine il database sarà completo e aggiornato.
--
-- Non serve eseguire nient'altro: i vecchi file nella cartella migrations/
-- non vanno più applicati manualmente, questo script li sostituisce tutti.
-- =============================================================================


-- =============================================================================
-- SECTION 1: EXTENSIONS
-- =============================================================================

create extension if not exists "uuid-ossp";


-- =============================================================================
-- SECTION 2: ENUM TYPES
-- =============================================================================
-- Created with their final, complete set of values so a brand-new install
-- gets everything immediately. The ALTER TYPE ... ADD VALUE statements below
-- exist only to patch OLDER databases whose enum was created before
-- 'my_invoice' / 'center_invoice' existed; on a fresh install they are
-- harmless no-ops (the values are already present).
--
-- IMPORTANT: a value added via ALTER TYPE ... ADD VALUE cannot be referenced
-- as a literal anywhere later in the same transaction/script. These two
-- statements are therefore kept as plain top-level statements placed early,
-- and neither 'my_invoice' nor 'center_invoice' is used as a literal
-- anywhere else in this file.

do $$ begin
  create type public.service_type as enum ('private', 'package');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_method as enum (
    'cash', 'bank_transfer', 'credit_card', 'other', 'my_invoice', 'center_invoice'
  );
exception when duplicate_object then null;
end $$;

alter type public.payment_method add value if not exists 'my_invoice';
alter type public.payment_method add value if not exists 'center_invoice';


-- =============================================================================
-- SECTION 3: TABLES (in foreign-key dependency order)
-- =============================================================================
-- Each statement reflects the FINAL shape of the table. On an existing
-- database these are no-ops (the table already exists); the "ADDED COLUMNS"
-- section further below patches any older, partial version of each table.

-- users (extends auth.users) -------------------------------------------------
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- patient_groups (couples, families, etc.) -----------------------------------
create table if not exists public.patient_groups (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  type text not null default 'family' check (type in ('couple', 'family', 'other')),
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- patients ---------------------------------------------------------------------
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

-- clinical_notes (diario clinico) ---------------------------------------------
-- NOTE: session_id's FK to sessions is added AFTER the sessions table is
-- created (see the CONSTRAINTS section) to avoid a forward reference.
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

-- service_types ------------------------------------------------------------
create table if not exists public.service_types (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  duration_minutes integer not null default 60,
  price numeric(10, 2) not null,
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

-- session_series (recurrence rule for a group of sessions) -------------------
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

-- sessions ---------------------------------------------------------------------
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
  reminder_sent_at timestamptz,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint sessions_patient_or_group_chk check (patient_id is not null or group_id is not null)
);

-- structures (for package work) ----------------------------------------------
create table if not exists public.structures (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- package_agreements -----------------------------------------------------------
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

-- payments -----------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete set null,
  group_id uuid references public.patient_groups(id) on delete set null,
  session_id uuid references public.sessions(id) on delete set null,
  amount numeric(10, 2) not null,
  payment_date date not null,
  payment_method public.payment_method not null default 'cash'::public.payment_method,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- patient_tags (user's custom tag definitions) --------------------------------
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

-- patient_tag_assignments (many-to-many: patients <-> tags) ------------------
create table if not exists public.patient_tag_assignments (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  tag_id uuid not null references public.patient_tags(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(patient_id, tag_id)
);

-- patient_contacts (extra phone numbers / emails with custom labels) --------
create table if not exists public.patient_contacts (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  kind text not null check (kind in ('phone', 'email')),
  label text not null default '',
  value text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- patient_family_members (textual genogram) ----------------------------------
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

-- attachments (images, SVG, PDF for patients or clinical notes) --------------
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

-- reminder_settings (one row per user) ---------------------------------------
create table if not exists public.reminder_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade unique,
  pre_session_enabled boolean not null default true,
  pre_session_minutes integer not null default 30,
  post_session_enabled boolean not null default false,
  post_session_minutes integer not null default 30,
  whatsapp_enabled boolean not null default false,
  whatsapp_template text not null default
    'Ciao {nome}, ti ricordo il nostro appuntamento di {giorno} alle {ora}. A presto!',
  whatsapp_notify_minutes integer not null default 1440,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- calendar_settings (per-user Google Calendar preferences) -------------------
create table if not exists public.calendar_settings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade unique,
  title_format text not null default 'initials'
    check (title_format in ('full', 'first_initial', 'initials')),
  color_by_service boolean not null default true,
  -- Push session notes into the Google event description (off by default:
  -- clinical content should not leave for Google's servers automatically)
  include_notes boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- tax_settings (regime forfettario, for net income estimates) ----------------
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

-- receipts (ricevute sanitarie) ----------------------------------------------
create table if not exists public.receipts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  number integer not null,
  year integer not null,
  patient_id uuid references public.patients(id) on delete set null,
  group_id uuid references public.patient_groups(id) on delete set null,
  -- Snapshot of the recipient at issue time: a receipt must stay readable
  -- even if the patient is later renamed or deleted.
  recipient_name text not null,
  recipient_tax_code text,
  recipient_address text,
  issue_date date not null default current_date,
  description text not null default 'Prestazione psicologica',
  amount numeric(10,2) not null check (amount >= 0),
  bollo_amount numeric(10,2) not null default 0 check (bollo_amount >= 0),
  payment_method public.payment_method,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, year, number)
);

-- receipt_sessions (many-to-many: receipts <-> sessions they cover) ---------
create table if not exists public.receipt_sessions (
  id uuid primary key default uuid_generate_v4(),
  receipt_id uuid not null references public.receipts(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  unique (receipt_id, session_id)
);

-- receipt_settings (professional header + numbering settings) ---------------
create table if not exists public.receipt_settings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade unique,
  professional_name text not null default '',
  tax_code text,
  vat_number text,
  address text,
  albo_registration text,
  regime_note text not null default
    'Operazione effettuata ai sensi dell''art. 1, commi 54-89, L. 190/2014 - Regime forfettario. Non soggetta a ritenuta d''acconto.',
  exempt_note text not null default
    'Esente IVA art. 10 n. 18 DPR 633/72',
  bollo_threshold numeric(10,2) not null default 77.47,
  bollo_default_amount numeric(10,2) not null default 2.00,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- =============================================================================
-- SECTION 4: ADDED COLUMNS
-- =============================================================================
-- Safety net for databases created from an OLDER version of the tables above
-- (e.g. only the original database.sql, or only some migrations applied).
-- Every column introduced by a migration after a table's first creation is
-- re-stated here as an idempotent ADD COLUMN IF NOT EXISTS. On a fresh
-- install (tables just created with the final shape above) these are all
-- no-ops.

-- users
alter table public.users
  add column if not exists full_name text;

-- patients
alter table public.patients
  add column if not exists group_id uuid references public.patient_groups(id) on delete set null,
  add column if not exists group_role text;

-- service_types
alter table public.service_types
  add column if not exists color text,
  add column if not exists center_percentage numeric(5,2) not null default 0
    check (center_percentage >= 0 and center_percentage <= 100),
  add column if not exists default_payment_method public.payment_method;

-- session_series
alter table public.session_series
  add column if not exists group_id uuid references public.patient_groups(id) on delete restrict,
  add column if not exists session_type text not null default 'individuale'
    check (session_type in ('individuale', 'coppia', 'familiare'));

-- sessions
alter table public.sessions
  add column if not exists group_id uuid references public.patient_groups(id) on delete restrict,
  add column if not exists session_type text not null default 'individuale'
    check (session_type in ('individuale', 'coppia', 'familiare')),
  add column if not exists series_id uuid references public.session_series(id) on delete set null,
  add column if not exists status text not null default 'scheduled'
    check (status in ('scheduled', 'completed', 'cancelled', 'no_show')),
  add column if not exists reminder_sent_at timestamptz;

-- payments
alter table public.payments
  add column if not exists group_id uuid references public.patient_groups(id) on delete set null;

-- reminder_settings
alter table public.reminder_settings
  add column if not exists whatsapp_enabled boolean not null default false,
  add column if not exists whatsapp_template text not null default
    'Ciao {nome}, ti ricordo il nostro appuntamento di {giorno} alle {ora}. A presto!',
  add column if not exists whatsapp_notify_minutes integer not null default 1440;

-- calendar_settings
alter table public.calendar_settings
  add column if not exists include_notes boolean not null default false;


-- =============================================================================
-- SECTION 5: NULLABILITY ADJUSTMENTS
-- =============================================================================
-- Older installations may still have these columns as NOT NULL; dropping a
-- NOT NULL constraint that is already absent is a harmless no-op.

alter table public.patients alter column last_name drop not null;
alter table public.sessions alter column patient_id drop not null;
alter table public.session_series alter column patient_id drop not null;


-- =============================================================================
-- SECTION 6: CONSTRAINTS
-- =============================================================================

-- Forward reference: clinical_notes.session_id -> sessions(id).
-- The column was created without a FK (sessions did not exist yet at that
-- point); now that both tables exist, wire up the constraint.
alter table public.clinical_notes
  drop constraint if exists clinical_notes_session_id_fkey;
alter table public.clinical_notes
  add constraint clinical_notes_session_id_fkey
  foreign key (session_id) references public.sessions(id) on delete set null;

-- payments: the session link is missing on databases created before the
-- payments table was moved after sessions — add it explicitly
alter table public.payments
  drop constraint if exists payments_session_id_fkey;
alter table public.payments
  add constraint payments_session_id_fkey
  foreign key (session_id) references public.sessions(id) on delete set null;

-- sessions: must reference a patient or a group
alter table public.sessions
  drop constraint if exists sessions_patient_or_group_chk;
alter table public.sessions
  add constraint sessions_patient_or_group_chk
  check (patient_id is not null or group_id is not null);

-- sessions: a group with existing sessions cannot be silently deleted
alter table public.sessions
  drop constraint if exists sessions_group_id_fkey;
alter table public.sessions
  add constraint sessions_group_id_fkey
  foreign key (group_id) references public.patient_groups(id) on delete restrict;

-- session_series: must reference a patient or a group
alter table public.session_series
  drop constraint if exists session_series_patient_or_group_chk;
alter table public.session_series
  add constraint session_series_patient_or_group_chk
  check (patient_id is not null or group_id is not null);

-- service_types: DB-level integrity for duration and price
alter table public.service_types
  drop constraint if exists service_types_duration_chk;
alter table public.service_types
  add constraint service_types_duration_chk check (duration_minutes > 0);

alter table public.service_types
  drop constraint if exists service_types_price_chk;
alter table public.service_types
  add constraint service_types_price_chk check (price >= 0);

-- payments: DB-level integrity for amount
alter table public.payments
  drop constraint if exists payments_amount_chk;
alter table public.payments
  add constraint payments_amount_chk check (amount > 0);

-- package_agreements: DB-level integrity for totals
alter table public.package_agreements
  drop constraint if exists package_agreements_totals_chk;
alter table public.package_agreements
  add constraint package_agreements_totals_chk
  check (total_sessions > 0 and total_price >= 0 and paid_amount >= 0);


-- =============================================================================
-- SECTION 7: INDEXES
-- =============================================================================

create index if not exists patients_user_id_idx on public.patients(user_id);
create index if not exists patients_group_id_idx on public.patients(group_id);
create index if not exists service_types_user_id_idx on public.service_types(user_id);
create index if not exists sessions_user_id_idx on public.sessions(user_id);
create index if not exists sessions_patient_id_idx on public.sessions(patient_id);
create index if not exists sessions_group_id_idx on public.sessions(group_id);
create index if not exists sessions_scheduled_at_idx on public.sessions(scheduled_at);
create index if not exists sessions_status_idx on public.sessions(status);
create index if not exists sessions_series_id_idx on public.sessions(series_id);
create index if not exists session_series_user_id_idx on public.session_series(user_id);
create index if not exists session_series_patient_id_idx on public.session_series(patient_id);
create index if not exists session_series_group_id_idx on public.session_series(group_id);
create index if not exists structures_user_id_idx on public.structures(user_id);
create index if not exists package_agreements_user_id_idx on public.package_agreements(user_id);
create index if not exists package_agreements_structure_id_idx on public.package_agreements(structure_id);
create index if not exists payments_user_id_idx on public.payments(user_id);
create index if not exists payments_patient_id_idx on public.payments(patient_id);
create index if not exists payments_group_id_idx on public.payments(group_id);
create index if not exists payments_payment_date_idx on public.payments(payment_date);
create index if not exists patient_groups_user_id_idx on public.patient_groups(user_id);
create index if not exists clinical_notes_user_id_idx on public.clinical_notes(user_id);
create index if not exists clinical_notes_patient_id_idx on public.clinical_notes(patient_id);
create index if not exists clinical_notes_session_id_idx on public.clinical_notes(session_id);
create index if not exists clinical_notes_note_date_idx on public.clinical_notes(note_date);
create index if not exists patient_tags_user_id_idx on public.patient_tags(user_id);
create index if not exists patient_tag_assignments_patient_id_idx on public.patient_tag_assignments(patient_id);
create index if not exists patient_tag_assignments_tag_id_idx on public.patient_tag_assignments(tag_id);
create index if not exists patient_contacts_patient_id_idx on public.patient_contacts(patient_id);
create index if not exists patient_contacts_kind_idx on public.patient_contacts(kind);
create index if not exists patient_family_members_patient_id_idx on public.patient_family_members(patient_id);
create index if not exists attachments_owner_idx on public.attachments(owner_type, owner_id);
create index if not exists attachments_user_id_idx on public.attachments(user_id);
create index if not exists reminder_settings_user_id_idx on public.reminder_settings(user_id);
create index if not exists calendar_settings_user_id_idx on public.calendar_settings(user_id);
create index if not exists tax_settings_user_id_idx on public.tax_settings(user_id);
create index if not exists receipts_user_id_idx on public.receipts(user_id);
create index if not exists receipts_patient_id_idx on public.receipts(patient_id);
create index if not exists receipts_issue_date_idx on public.receipts(issue_date);
create index if not exists receipt_sessions_receipt_id_idx on public.receipt_sessions(receipt_id);
create index if not exists receipt_sessions_session_id_idx on public.receipt_sessions(session_id);
create index if not exists receipt_settings_user_id_idx on public.receipt_settings(user_id);


-- =============================================================================
-- SECTION 8: ROW LEVEL SECURITY — ENABLE
-- =============================================================================

alter table public.users enable row level security;
alter table public.patient_groups enable row level security;
alter table public.patients enable row level security;
alter table public.clinical_notes enable row level security;
alter table public.service_types enable row level security;
alter table public.session_series enable row level security;
alter table public.sessions enable row level security;
alter table public.structures enable row level security;
alter table public.package_agreements enable row level security;
alter table public.payments enable row level security;
alter table public.patient_tags enable row level security;
alter table public.patient_tag_assignments enable row level security;
alter table public.patient_contacts enable row level security;
alter table public.patient_family_members enable row level security;
alter table public.attachments enable row level security;
alter table public.reminder_settings enable row level security;
alter table public.calendar_settings enable row level security;
alter table public.tax_settings enable row level security;
alter table public.receipts enable row level security;
alter table public.receipt_sessions enable row level security;
alter table public.receipt_settings enable row level security;


-- =============================================================================
-- SECTION 9: ROW LEVEL SECURITY — POLICIES
-- =============================================================================
-- These are the FINAL policies, i.e. the state after migration 012 (tenant
-- isolation hardening). Where 012 redefined a policy, only that final
-- version appears below — no earlier/superseded version is recreated.

-- users -----------------------------------------------------------------------
drop policy if exists "Users can view their own data" on public.users;
create policy "Users can view their own data" on public.users
  for select using (auth.uid() = id);

drop policy if exists "Users can insert their own data" on public.users;
create policy "Users can insert their own data" on public.users
  for insert with check (auth.uid() = id);

drop policy if exists "Users can update their own data" on public.users;
create policy "Users can update their own data" on public.users
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- patients (012: group_id must also belong to the caller) --------------------
drop policy if exists "Patients are visible to their owner" on public.patients;
create policy "Patients are visible to their owner" on public.patients
  for all using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (group_id is null or exists (
      select 1 from public.patient_groups g where g.id = group_id and g.user_id = auth.uid()))
  );

-- service_types -----------------------------------------------------------
drop policy if exists "Service types are visible to their owner" on public.service_types;
create policy "Service types are visible to their owner" on public.service_types
  for all using (auth.uid() = user_id);

-- sessions (012: patient/group/service type/series must belong to caller) ---
drop policy if exists "Sessions are visible to their owner" on public.sessions;
create policy "Sessions are visible to their owner" on public.sessions
  for all using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (patient_id is null or exists (
      select 1 from public.patients p where p.id = patient_id and p.user_id = auth.uid()))
    and (group_id is null or exists (
      select 1 from public.patient_groups g where g.id = group_id and g.user_id = auth.uid()))
    and exists (
      select 1 from public.service_types st where st.id = service_type_id and st.user_id = auth.uid())
    and (series_id is null or exists (
      select 1 from public.session_series ss where ss.id = series_id and ss.user_id = auth.uid()))
  );

-- structures ------------------------------------------------------------------
drop policy if exists "Structures are visible to their owner" on public.structures;
create policy "Structures are visible to their owner" on public.structures
  for all using (auth.uid() = user_id);

-- package_agreements (012: structure must belong to caller) ------------------
drop policy if exists "Package agreements are visible to their owner" on public.package_agreements;
create policy "Package agreements are visible to their owner" on public.package_agreements
  for all using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.structures s where s.id = structure_id and s.user_id = auth.uid())
  );

-- payments (012: patient/group/session must belong to caller) ----------------
drop policy if exists "Payments are visible to their owner" on public.payments;
create policy "Payments are visible to their owner" on public.payments
  for all using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (patient_id is null or exists (
      select 1 from public.patients p where p.id = patient_id and p.user_id = auth.uid()))
    and (group_id is null or exists (
      select 1 from public.patient_groups g where g.id = group_id and g.user_id = auth.uid()))
    and (session_id is null or exists (
      select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid()))
  );

-- patient_groups ----------------------------------------------------------
drop policy if exists "Patient groups visible to owner" on public.patient_groups;
create policy "Patient groups visible to owner" on public.patient_groups
  for all using (auth.uid() = user_id);

-- clinical_notes (012: patient/session must belong to caller) ----------------
drop policy if exists "Clinical notes visible to owner" on public.clinical_notes;
create policy "Clinical notes visible to owner" on public.clinical_notes
  for all using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.patients p where p.id = patient_id and p.user_id = auth.uid())
    and (session_id is null or exists (
      select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid()))
  );

-- patient_tags ------------------------------------------------------------
drop policy if exists "Patient tags visible to owner" on public.patient_tags;
create policy "Patient tags visible to owner" on public.patient_tags
  for all using (auth.uid() = user_id);

-- patient_tag_assignments (final version: verifies tag AND patient owner) --
drop policy if exists "Patient tag assignments visible to owner" on public.patient_tag_assignments;
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

-- session_series (012: patient/group/service type must belong to caller) ---
drop policy if exists "Session series visible to owner" on public.session_series;
create policy "Session series visible to owner" on public.session_series
  for all using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (patient_id is null or exists (
      select 1 from public.patients p where p.id = patient_id and p.user_id = auth.uid()))
    and (group_id is null or exists (
      select 1 from public.patient_groups g where g.id = group_id and g.user_id = auth.uid()))
    and exists (
      select 1 from public.service_types st where st.id = service_type_id and st.user_id = auth.uid())
  );

-- patient_contacts ----------------------------------------------------------
drop policy if exists "Patient contacts visible to patient owner" on public.patient_contacts;
create policy "Patient contacts visible to patient owner" on public.patient_contacts
  for all using (
    exists (
      select 1 from public.patients p
      where p.id = patient_id and p.user_id = auth.uid()
    )
  );

-- patient_family_members -----------------------------------------------------
drop policy if exists "Family members visible to patient owner" on public.patient_family_members;
create policy "Family members visible to patient owner" on public.patient_family_members
  for all using (
    exists (
      select 1 from public.patients p
      where p.id = patient_id and p.user_id = auth.uid()
    )
  );

-- attachments (012: polymorphic owner row must belong to caller) -------------
drop policy if exists "Attachments visible to owner" on public.attachments;
create policy "Attachments visible to owner" on public.attachments
  for all using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      (owner_type = 'patient' and exists (
        select 1 from public.patients p where p.id = owner_id and p.user_id = auth.uid()))
      or
      (owner_type = 'clinical_note' and exists (
        select 1 from public.clinical_notes c where c.id = owner_id and c.user_id = auth.uid()))
    )
  );

-- reminder_settings -----------------------------------------------------------
drop policy if exists "Users can view own reminder settings" on public.reminder_settings;
create policy "Users can view own reminder settings"
  on public.reminder_settings for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own reminder settings" on public.reminder_settings;
create policy "Users can insert own reminder settings"
  on public.reminder_settings for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own reminder settings" on public.reminder_settings;
create policy "Users can update own reminder settings"
  on public.reminder_settings for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own reminder settings" on public.reminder_settings;
create policy "Users can delete own reminder settings"
  on public.reminder_settings for delete
  using (auth.uid() = user_id);

-- calendar_settings -------------------------------------------------------
drop policy if exists "Users manage own calendar settings" on public.calendar_settings;
create policy "Users manage own calendar settings"
  on public.calendar_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- tax_settings ------------------------------------------------------------
drop policy if exists "Users manage own tax settings" on public.tax_settings;
create policy "Users manage own tax settings"
  on public.tax_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- receipts (012: patient/group must belong to caller) ------------------------
drop policy if exists "Receipts visible to owner" on public.receipts;
create policy "Receipts visible to owner" on public.receipts
  for all using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (patient_id is null or exists (
      select 1 from public.patients p where p.id = patient_id and p.user_id = auth.uid()))
    and (group_id is null or exists (
      select 1 from public.patient_groups g where g.id = group_id and g.user_id = auth.uid()))
  );

-- receipt_sessions (012: receipt AND session must belong to caller) --------
drop policy if exists "Receipt sessions visible to receipt owner" on public.receipt_sessions;
create policy "Receipt sessions visible to receipt owner" on public.receipt_sessions
  for all using (
    exists (select 1 from public.receipts r where r.id = receipt_id and r.user_id = auth.uid())
    and exists (select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.receipts r where r.id = receipt_id and r.user_id = auth.uid())
    and exists (select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid())
  );

-- receipt_settings ----------------------------------------------------------
drop policy if exists "Users manage own receipt settings" on public.receipt_settings;
create policy "Users manage own receipt settings" on public.receipt_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- =============================================================================
-- SECTION 10: FUNCTIONS
-- =============================================================================

-- Shared updated_at trigger function (012: security invoker, search_path pinned)
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

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

-- Clean up attachments when their owner row (patient / clinical note) is deleted
create or replace function public.cleanup_orphaned_attachments()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.attachments
  where owner_type = case when TG_TABLE_NAME = 'patients' then 'patient' else 'clinical_note' end
    and owner_id = old.id;
  return old;
end;
$$;


-- =============================================================================
-- SECTION 11: TRIGGERS
-- =============================================================================

-- updated_at triggers (one per table that has an updated_at column) ---------
drop trigger if exists users_updated_at_trigger on public.users;
create trigger users_updated_at_trigger before update on public.users
  for each row execute function public.update_updated_at_column();

drop trigger if exists patient_groups_updated_at_trigger on public.patient_groups;
create trigger patient_groups_updated_at_trigger before update on public.patient_groups
  for each row execute function public.update_updated_at_column();

drop trigger if exists patients_updated_at_trigger on public.patients;
create trigger patients_updated_at_trigger before update on public.patients
  for each row execute function public.update_updated_at_column();

drop trigger if exists clinical_notes_updated_at_trigger on public.clinical_notes;
create trigger clinical_notes_updated_at_trigger before update on public.clinical_notes
  for each row execute function public.update_updated_at_column();

drop trigger if exists service_types_updated_at_trigger on public.service_types;
create trigger service_types_updated_at_trigger before update on public.service_types
  for each row execute function public.update_updated_at_column();

drop trigger if exists session_series_updated_at_trigger on public.session_series;
create trigger session_series_updated_at_trigger before update on public.session_series
  for each row execute function public.update_updated_at_column();

drop trigger if exists sessions_updated_at_trigger on public.sessions;
create trigger sessions_updated_at_trigger before update on public.sessions
  for each row execute function public.update_updated_at_column();

drop trigger if exists structures_updated_at_trigger on public.structures;
create trigger structures_updated_at_trigger before update on public.structures
  for each row execute function public.update_updated_at_column();

drop trigger if exists package_agreements_updated_at_trigger on public.package_agreements;
create trigger package_agreements_updated_at_trigger before update on public.package_agreements
  for each row execute function public.update_updated_at_column();

drop trigger if exists payments_updated_at_trigger on public.payments;
create trigger payments_updated_at_trigger before update on public.payments
  for each row execute function public.update_updated_at_column();

drop trigger if exists patient_tags_updated_at_trigger on public.patient_tags;
create trigger patient_tags_updated_at_trigger before update on public.patient_tags
  for each row execute function public.update_updated_at_column();

drop trigger if exists patient_contacts_updated_at_trigger on public.patient_contacts;
create trigger patient_contacts_updated_at_trigger before update on public.patient_contacts
  for each row execute function public.update_updated_at_column();

drop trigger if exists patient_family_members_updated_at_trigger on public.patient_family_members;
create trigger patient_family_members_updated_at_trigger before update on public.patient_family_members
  for each row execute function public.update_updated_at_column();

drop trigger if exists reminder_settings_updated_at_trigger on public.reminder_settings;
create trigger reminder_settings_updated_at_trigger before update on public.reminder_settings
  for each row execute function public.update_updated_at_column();

drop trigger if exists calendar_settings_updated_at_trigger on public.calendar_settings;
create trigger calendar_settings_updated_at_trigger before update on public.calendar_settings
  for each row execute function public.update_updated_at_column();

drop trigger if exists tax_settings_updated_at_trigger on public.tax_settings;
create trigger tax_settings_updated_at_trigger before update on public.tax_settings
  for each row execute function public.update_updated_at_column();

drop trigger if exists receipts_updated_at_trigger on public.receipts;
create trigger receipts_updated_at_trigger before update on public.receipts
  for each row execute function public.update_updated_at_column();

drop trigger if exists receipt_settings_updated_at_trigger on public.receipt_settings;
create trigger receipt_settings_updated_at_trigger before update on public.receipt_settings
  for each row execute function public.update_updated_at_column();

-- auth.users -> public.users auto-provisioning -------------------------------
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Orphaned-attachment cleanup -------------------------------------------------
drop trigger if exists patients_cleanup_attachments on public.patients;
create trigger patients_cleanup_attachments after delete on public.patients
  for each row execute function public.cleanup_orphaned_attachments();

drop trigger if exists clinical_notes_cleanup_attachments on public.clinical_notes;
create trigger clinical_notes_cleanup_attachments after delete on public.clinical_notes
  for each row execute function public.cleanup_orphaned_attachments();


-- =============================================================================
-- SECTION 12: STORAGE — ATTACHMENTS BUCKET
-- =============================================================================
-- Private bucket (files served only via signed URLs). Creating this bucket by
-- hand in the dashboard would default it to PUBLIC, exposing every uploaded
-- clinical document by URL — always use this script instead.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'patient-attachments',
  'patient-attachments',
  false,
  10485760, -- 10 MB per file
  array[
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'application/pdf'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Storage policies: users can manage files inside their own folder (user_id/...)
drop policy if exists "Users can read their own attachments" on storage.objects;
create policy "Users can read their own attachments" on storage.objects
  for select using (
    bucket_id = 'patient-attachments'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can upload their own attachments" on storage.objects;
create policy "Users can upload their own attachments" on storage.objects
  for insert with check (
    bucket_id = 'patient-attachments'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can delete their own attachments" on storage.objects;
create policy "Users can delete their own attachments" on storage.objects
  for delete using (
    bucket_id = 'patient-attachments'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can update their own attachments" on storage.objects;
create policy "Users can update their own attachments" on storage.objects
  for update using (
    bucket_id = 'patient-attachments'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- =============================================================================
-- FINE SCRIPT — il database è pronto.
-- =============================================================================
