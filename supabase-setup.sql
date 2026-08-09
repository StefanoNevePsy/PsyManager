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
  -- Automatic SMS reminders (off until a provider is configured; the API key
  -- is an Edge Function secret and is never stored here)
  sms_enabled boolean not null default false,
  sms_provider text not null default 'skebby',
  sms_sender text not null default '',
  sms_advance_minutes integer not null default 1440,
  sms_template text not null default 'Le ricordo l''appuntamento di {giorno} alle {ora}.',
  sms_quiet_start integer not null default 21,
  sms_quiet_end integer not null default 8,
  sms_rule text not null default 'all',
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
-- Delivery ledger for automatic reminders. The UNIQUE(session_id, channel)
-- constraint is what makes a double send impossible, even if two scheduled
-- runs overlap.
create table if not exists public.reminder_deliveries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  channel text not null check (channel in ('sms', 'email', 'whatsapp')),
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'delivered', 'failed', 'skipped')),
  provider_message_id text,
  provider text,
  recipient text,
  error text,
  scheduled_for timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, channel)
);

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
  add column if not exists whatsapp_notify_minutes integer not null default 1440,
  add column if not exists sms_enabled boolean not null default false,
  add column if not exists sms_provider text not null default 'skebby',
  add column if not exists sms_sender text not null default '',
  add column if not exists sms_advance_minutes integer not null default 1440,
  add column if not exists sms_template text not null default 'Le ricordo l''appuntamento di {giorno} alle {ora}.',
  add column if not exists sms_quiet_start integer not null default 21,
  add column if not exists sms_quiet_end integer not null default 8,
  add column if not exists sms_rule text not null default 'all';

alter table public.patients
  add column if not exists sms_consent boolean not null default false,
  add column if not exists sms_consent_at timestamptz;

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

-- reminder_settings: valid quiet hours and a known SMS rule
alter table public.reminder_settings
  drop constraint if exists reminder_settings_sms_quiet_start_chk;
alter table public.reminder_settings
  add constraint reminder_settings_sms_quiet_start_chk
  check (sms_quiet_start between 0 and 23);

alter table public.reminder_settings
  drop constraint if exists reminder_settings_sms_quiet_end_chk;
alter table public.reminder_settings
  add constraint reminder_settings_sms_quiet_end_chk
  check (sms_quiet_end between 0 and 23);

alter table public.reminder_settings
  drop constraint if exists reminder_settings_sms_rule_chk;
alter table public.reminder_settings
  add constraint reminder_settings_sms_rule_chk
  check (sms_rule in ('all', 'first', 'no_show', 'manual'));

alter table public.reminder_settings
  drop constraint if exists reminder_settings_sms_provider_chk;
alter table public.reminder_settings
  add constraint reminder_settings_sms_provider_chk
  check (sms_provider in ('skebby', 'twilio', 'generic'));

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
create index if not exists reminder_deliveries_user_id_idx on public.reminder_deliveries(user_id);
create index if not exists reminder_deliveries_session_id_idx on public.reminder_deliveries(session_id);
create index if not exists reminder_deliveries_status_idx on public.reminder_deliveries(status);
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
alter table public.reminder_deliveries enable row level security;
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
drop policy if exists "Reminder deliveries visible to owner" on public.reminder_deliveries;
create policy "Reminder deliveries visible to owner" on public.reminder_deliveries
  for all using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid())
  );

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

drop trigger if exists reminder_deliveries_updated_at_trigger on public.reminder_deliveries;
create trigger reminder_deliveries_updated_at_trigger before update on public.reminder_deliveries
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

-- =============================================================================
-- SMS AUTOMATICI — invio dal database (opzionale, inerte finché non
-- configurato). Nulla parte finché non salvi le credenziali del provider
-- nell'app e non accendi l'interruttore nelle impostazioni.
-- =============================================================================

-- =============================================================================
-- 1. Estensioni (pg_cron, pg_net)
-- =============================================================================
-- Su alcuni progetti Supabase l'abilitazione di un'estensione richiede un
-- privilegio che l'utente collegato allo SQL Editor non ha sempre finché non
-- la attiva prima dal pannello Database > Extensions. Per questo ogni CREATE
-- EXTENSION è avvolto in un blocco che non fa fallire l'intero script: se
-- manca il privilegio, lo script stampa un avviso e prosegue. Chi legge
-- l'avviso può abilitare l'estensione dal Dashboard e rilanciare questo file
-- (è idempotente).
do $$
begin
  create extension if not exists pg_cron;
exception when others then
  raise notice 'pg_net/pg_cron: impossibile abilitare "pg_cron" automaticamente (%). '
    'Abilitala da Supabase Dashboard > Database > Extensions, poi rilancia questa migrazione.', sqlerrm;
end $$;

do $$
begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net/pg_cron: impossibile abilitare "pg_net" automaticamente (%). '
    'Abilitala da Supabase Dashboard > Database > Extensions, poi rilancia questa migrazione.', sqlerrm;
end $$;

-- =============================================================================
-- 2. Credenziali SMS — tabella SOLO SCRITTURA dal client
-- =============================================================================
-- Contiene il segreto del provider (password/API key/token). A differenza di
-- ogni altra tabella di PsyManager, qui NON esiste alcuna policy SELECT: la
-- riga si può creare e aggiornare ma mai più rileggere via API/client, nè da
-- parte dell'utente proprietario nè da chiunque altro. È una scelta
-- deliberata — vedi il commento sulla tabella più sotto.
create table if not exists public.sms_credentials (
  user_id uuid primary key references public.users(id) on delete cascade,
  -- URL del singolo endpoint REST del provider (es. https://api.esempio.it/sms)
  endpoint_url text not null default '',
  auth_type text not null default 'basic',
  -- Basic: "auth_user" + "auth_secret" (utente/password o key/secret)
  -- Bearer: solo "auth_secret" (il token)
  -- None:   nessuna intestazione di autenticazione
  auth_user text default '',
  auth_secret text default '',
  body_format text not null default 'json',
  -- Corpo della richiesta del provider, con segnaposto {{to}} {{text}} {{sender}}.
  -- Per body_format='json' i segnaposto vanno dentro le virgolette JSON, es:
  --   {"to":"{{to}}","message":"{{text}}","from":"{{sender}}"}
  -- Per body_format='form' è una stringa key=value&key=value (vedi nota sul
  -- limite di pg_net più sotto, funzione public._build_sms_request).
  body_template text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Vincoli con nome esplicito: un CHECK inline dentro un ADD COLUMN non
-- raggiungerebbe mai un database dove la colonna esiste già.
alter table public.sms_credentials
  drop constraint if exists sms_credentials_auth_type_chk;
alter table public.sms_credentials
  add constraint sms_credentials_auth_type_chk check (auth_type in ('basic', 'bearer', 'none'));
alter table public.sms_credentials
  drop constraint if exists sms_credentials_body_format_chk;
alter table public.sms_credentials
  add constraint sms_credentials_body_format_chk check (body_format in ('json', 'form'));

comment on table public.sms_credentials is
  'Credenziali del provider SMS (URL, autenticazione, modello del corpo). '
  'SOLO SCRITTURA dal client: esistono policy RLS per INSERT e UPDATE ma '
  'DELIBERATAMENTE nessuna per SELECT, quindi nessun ruolo applicativo (anon, '
  'authenticated) può mai rileggere endpoint_url/auth_user/auth_secret una '
  'volta salvati. La lettura, quando serve (invio SMS), avviene solo dentro '
  'funzioni SECURITY DEFINER di questo file, eseguite dal ruolo proprietario. '
  'Per mostrare all''utente "è configurato" senza esporre il segreto, usa '
  'la vista public.sms_credentials_status.';

alter table public.sms_credentials enable row level security;

drop policy if exists "Sms credentials insert own" on public.sms_credentials;
create policy "Sms credentials insert own" on public.sms_credentials
  for insert
  with check (auth.uid() = user_id);

-- NOTE: an UPDATE policy's USING clause is NOT defaulted from WITH CHECK
-- (only the reverse is true in Postgres) — omitting it here would default to
-- USING (true), letting the UPDATE command target any row before WITH CHECK
-- rejects the write. Both clauses are specified explicitly.
drop policy if exists "Sms credentials update own" on public.sms_credentials;
create policy "Sms credentials update own" on public.sms_credentials
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Nessuna "create policy ... for select" qui: è intenzionale (vedi commento
-- sulla tabella). Difesa in profondità: anche a livello di GRANT togliamo
-- esplicitamente il SELECT ai ruoli applicativi, così la protezione non
-- dipende solo da RLS.
revoke select on public.sms_credentials from authenticated, anon;
grant insert, update on public.sms_credentials to authenticated;

drop trigger if exists sms_credentials_updated_at_trigger on public.sms_credentials;
create trigger sms_credentials_updated_at_trigger before update on public.sms_credentials
  for each row execute function public.update_updated_at_column();

-- =============================================================================
-- 3. Vista di stato — "è configurato?", mai il segreto
-- =============================================================================
-- NOTA SU security_invoker: la tabella sms_credentials non ha (di proposito)
-- alcuna policy SELECT, quindi una vista con security_invoker = true
-- erediterebbe quel divieto e restituirebbe SEMPRE zero righe a un utente
-- autenticato (RLS verrebbe valutata con i suoi permessi, che non includono
-- mai SELECT sulla tabella). Per restare utile la vista è quindi creata con
-- il comportamento predefinito (security_invoker = false): viene eseguita
-- con i permessi del proprietario della vista, che è owner anche della
-- tabella e quindi bypassa RLS per leggerla. La sicurezza per-utente non
-- viene quindi dalla RLS della tabella sottostante ma dal filtro esplicito
-- "where user_id = auth.uid()" qui sotto, che è l'unica barriera e per
-- questo è obbligatorio. La vista non espone MAI auth_user/auth_secret.
drop view if exists public.sms_credentials_status;
create view public.sms_credentials_status as
select
  sc.user_id,
  (sc.endpoint_url <> '') as configured,
  nullif(
    regexp_replace(sc.endpoint_url, '^[a-zA-Z][a-zA-Z0-9+.-]*://([^/?#]+).*$', '\1'),
    sc.endpoint_url
  ) as endpoint_host,
  sc.auth_type,
  sc.body_format,
  sc.updated_at
from public.sms_credentials sc
where sc.user_id = auth.uid();

revoke all on public.sms_credentials_status from public, anon;
grant select on public.sms_credentials_status to authenticated;

-- =============================================================================
-- 4. Rendering del template SMS ({nome}, {giorno}, {ora}, ...)
-- =============================================================================
-- Porta in SQL la stessa logica di src/lib/whatsapp.ts::renderTemplate.
-- I nomi di giorni/mesi sono hardcoded (NON ci si affida a lc_time del
-- server, che su Supabase è tipicamente "C"/"en_US" e non garantito) e tutti
-- gli orari sono resi in Europe/Rome indipendentemente dal timezone di
-- sessione del chiamante (pg_cron esegue con il TimeZone di default del
-- database, che potrebbe non essere Europe/Rome).
drop function if exists public.render_sms_template(text, text, text, timestamptz, integer, text);
create function public.render_sms_template(
  p_template text,
  p_first_name text,
  p_last_name text,
  p_scheduled_at timestamptz,
  p_duration integer,
  p_service text
)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_local timestamp;
  v_dow integer;
  v_month integer;
  v_day integer;
  v_day_names text[] := array['domenica','lunedì','martedì','mercoledì','giovedì','venerdì','sabato'];
  v_month_names text[] := array['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
  v_giorno text;
  v_giorno_settimana text;
  v_data text;
  v_ora text;
  v_durata text;
  v_nome_completo text;
  v_out text;
begin
  if p_template is null then
    return '';
  end if;

  if p_scheduled_at is null then
    v_local := now() at time zone 'Europe/Rome';
  else
    v_local := p_scheduled_at at time zone 'Europe/Rome';
  end if;

  v_dow := extract(dow from v_local)::integer;   -- 0=domenica .. 6=sabato
  v_month := extract(month from v_local)::integer;
  v_day := extract(day from v_local)::integer;

  v_giorno_settimana := v_day_names[v_dow + 1];
  v_giorno := v_giorno_settimana || ' ' || v_day::text || ' ' || v_month_names[v_month];
  v_data := lpad(v_day::text, 2, '0') || '/' || lpad(v_month::text, 2, '0') || '/' || extract(year from v_local)::text;
  v_ora := lpad(extract(hour from v_local)::integer::text, 2, '0') || ':' || lpad(extract(minute from v_local)::integer::text, 2, '0');
  v_durata := coalesce(p_duration, 0)::text || ' minuti';
  v_nome_completo := trim(both ' ' from (coalesce(p_first_name, '') || ' ' || coalesce(p_last_name, '')));

  -- Nessun segnaposto è prefisso di un altro fino alla parentesi graffa di
  -- chiusura (es. "{giorno}" non è una sottostringa di "{giorno_settimana}"),
  -- quindi l'ordine delle sostituzioni non ha effetti collaterali.
  v_out := p_template;
  v_out := replace(v_out, '{nome_completo}', v_nome_completo);
  v_out := replace(v_out, '{nome}', coalesce(p_first_name, ''));
  v_out := replace(v_out, '{cognome}', coalesce(p_last_name, ''));
  v_out := replace(v_out, '{giorno_settimana}', v_giorno_settimana);
  v_out := replace(v_out, '{giorno}', v_giorno);
  v_out := replace(v_out, '{data}', v_data);
  v_out := replace(v_out, '{ora}', v_ora);
  v_out := replace(v_out, '{durata}', v_durata);
  v_out := replace(v_out, '{prestazione}', coalesce(p_service, ''));

  return v_out;
end;
$$;

revoke all on function public.render_sms_template(text, text, text, timestamptz, integer, text) from public;

-- =============================================================================
-- 5. Normalizzazione numero italiano
-- =============================================================================
-- Porta esatta di src/lib/whatsapp.ts::normalizePhone in SQL.
drop function if exists public.normalize_phone_it(text);
create function public.normalize_phone_it(p_raw text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  n text;
begin
  if p_raw is null then
    return null;
  end if;

  -- Tiene solo cifre e '+'
  n := regexp_replace(p_raw, '[^0-9+]', '', 'g');
  if n = '' then
    return null;
  end if;

  if left(n, 2) = '00' then
    n := '+' || substring(n from 3);
  end if;

  if left(n, 1) = '+' then
    n := substring(n from 2);
    return nullif(n, '');
  end if;

  -- Numero nazionale nudo: assume Italia
  if left(n, 2) = '39' and length(n) >= 11 then
    return n;
  end if;

  return '39' || n;
end;
$$;

revoke all on function public.normalize_phone_it(text) from public;

-- =============================================================================
-- 6. Helper interni (non esposti all'app)
-- =============================================================================

-- Escape di una stringa per l'inserimento dentro un valore JSON già tra
-- virgolette (es. "text":"{{text}}"). to_json() produce l'intera stringa
-- JSON già racchiusa e correttamente sfuggita fra virgolette; qui si tolgono
-- solo il primo e l'ultimo carattere (le virgolette di apertura/chiusura)
-- con substring per posizione — MAI con trim('"'), che rimuoverebbe anche
-- virgolette interne sfuggite se il testo termina con una virgoletta
-- letterale (es. testo che finisce con \").
drop function if exists public._json_escape(text);
create function public._json_escape(p_text text)
returns text
language sql
immutable
set search_path = public
as $$
  select substring(
    to_json(coalesce(p_text, ''))::text
    from 2
    for length(to_json(coalesce(p_text, ''))::text) - 2
  );
$$;

revoke all on function public._json_escape(text) from public;

-- Costruisce body/params/headers per la chiamata HTTP al provider, a partire
-- dalle credenziali salvate e dal messaggio già renderizzato.
--
-- LIMITE NOTO DI pg_net: net.http_post(url, body jsonb, params jsonb,
-- headers jsonb, timeout_milliseconds) accetta SOLO un body di tipo jsonb —
-- non esiste (verificato sulla definizione SQL dell'estensione) alcun
-- overload con corpo testuale libero. pg_net serializza sempre `body` come
-- JSON. Questo significa che un vero corpo POST
-- "application/x-www-form-urlencoded" (stringa "a=1&b=2" grezza) NON è
-- raggiungibile da SQL con questa estensione.
-- Per body_format='json' non c'è alcun problema: il body è JSON per
-- natura e viene inviato così com'è.
-- Per body_format='form' si usa un compromesso esplicito (non un'accettazione
-- ottimistica): il body_template "chiave=valore&chiave=valore" viene
-- scomposto qui in singole coppie chiave/valore e inviato tramite il
-- parametro `params` di net.http_post, che pg_net stesso URL-encoda e
-- accoda come query string alla URL della richiesta (che resta comunque una
-- POST). Molti provider SMS "semplici" accettano le credenziali/il testo
-- anche come query string; per quelli che richiedono ESATTAMENTE un body
-- application/x-www-form-urlencoded, questa funzione non è sufficiente e va
-- usato body_format='json' se il provider lo supporta, oppure la vecchia
-- Edge Function (supabase/functions/send-sms-reminders).
drop function if exists public._build_sms_request(public.sms_credentials, text, text, text);
create function public._build_sms_request(
  p_cred public.sms_credentials,
  p_phone text,
  p_message text,
  p_sender text,
  out p_body jsonb,
  out p_params jsonb,
  out p_headers jsonb
)
language plpgsql
set search_path = public
as $$
declare
  v_auth_header text;
  v_pair text;
  v_key text;
  v_val text;
  v_eq_pos integer;
  v_text text;
begin
  if p_cred.auth_type = 'basic' then
    v_auth_header := 'Basic ' || encode(
      convert_to(coalesce(p_cred.auth_user, '') || ':' || coalesce(p_cred.auth_secret, ''), 'utf8'),
      'base64'
    );
  elsif p_cred.auth_type = 'bearer' then
    v_auth_header := 'Bearer ' || coalesce(p_cred.auth_secret, '');
  else
    v_auth_header := null;
  end if;

  p_headers := jsonb_build_object(
    'Content-Type',
    case when p_cred.body_format = 'json' then 'application/json' else 'application/x-www-form-urlencoded' end
  );
  if v_auth_header is not null then
    p_headers := p_headers || jsonb_build_object('Authorization', v_auth_header);
  end if;

  if p_cred.body_format = 'json' then
    v_text := coalesce(p_cred.body_template, '');
    v_text := replace(v_text, '{{to}}', public._json_escape(p_phone));
    v_text := replace(v_text, '{{text}}', public._json_escape(p_message));
    v_text := replace(v_text, '{{sender}}', public._json_escape(coalesce(p_sender, '')));
    -- Cast esplicito: se il modello salvato non produce JSON valido dopo la
    -- sostituzione, questo solleva un'eccezione (catturata dal chiamante e
    -- registrata come invio fallito) invece di inviare qualcosa di rotto.
    p_body := v_text::jsonb;
    p_params := '{}'::jsonb;
  else
    p_body := '{}'::jsonb;
    p_params := '{}'::jsonb;
    foreach v_pair in array regexp_split_to_array(coalesce(p_cred.body_template, ''), '&') loop
      if v_pair = '' then
        continue;
      end if;
      v_eq_pos := position('=' in v_pair);
      if v_eq_pos = 0 then
        v_key := v_pair;
        v_val := '';
      else
        v_key := substring(v_pair from 1 for v_eq_pos - 1);
        v_val := substring(v_pair from v_eq_pos + 1);
      end if;
      -- Valori grezzi (non URL-encodati qui): lo fa pg_net internamente
      -- quando costruisce la query string da `params`.
      v_val := replace(v_val, '{{to}}', coalesce(p_phone, ''));
      v_val := replace(v_val, '{{text}}', coalesce(p_message, ''));
      v_val := replace(v_val, '{{sender}}', coalesce(p_sender, ''));
      p_params := p_params || jsonb_build_object(v_key, v_val);
    end loop;
  end if;
end;
$$;

revoke all on function public._build_sms_request(public.sms_credentials, text, text, text) from public;

-- =============================================================================
-- 7. Invio dei promemoria dovuti
-- =============================================================================
alter table public.reminder_deliveries
  add column if not exists provider_request_id bigint;

create index if not exists reminder_deliveries_provider_request_id_idx
  on public.reminder_deliveries(provider_request_id)
  where provider_request_id is not null;

drop function if exists public.send_due_sms_reminders();
create function public.send_due_sms_reminders()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed integer := 0;
  v_skipped integer := 0;
  v_failed integer := 0;
  v_now_hour integer;
  v_settings public.reminder_settings%rowtype;
  v_cred public.sms_credentials%rowtype;
  v_session record;
  v_window_end timestamptz;
  v_is_quiet boolean;
  v_first_session_id uuid;
  v_has_no_show boolean;
  v_message text;
  v_delivery_id uuid;
  v_built record;
  v_request_id bigint;
begin
  v_now_hour := extract(hour from (now() at time zone 'Europe/Rome'))::integer;

  for v_settings in
    select * from public.reminder_settings
    where sms_enabled = true
      and sms_rule <> 'manual'
  loop
    -- Serve una configurazione salvata e utilizzabile (endpoint non vuoto).
    select * into v_cred
    from public.sms_credentials
    where user_id = v_settings.user_id
      and endpoint_url <> '';

    if not found then
      continue;
    end if;

    v_window_end := now() + (v_settings.sms_advance_minutes || ' minutes')::interval;

    for v_session in
      select sub.*
      from (
        select
          s.id,
          s.user_id,
          s.patient_id,
          s.scheduled_at,
          s.duration_minutes,
          p.first_name,
          p.last_name,
          p.sms_consent,
          public.normalize_phone_it(p.phone) as phone_norm,
          st.name as service_name
        from public.sessions s
        join public.patients p on p.id = s.patient_id
        left join public.service_types st on st.id = s.service_type_id
        where s.user_id = v_settings.user_id
          and s.patient_id is not null
          and s.scheduled_at >= now()
          and s.scheduled_at <= v_window_end
          and s.status not in ('cancelled', 'no_show')
      ) sub
      where sub.sms_consent = true
        and sub.phone_norm is not null
    loop
      v_delivery_id := null;

      -- sms_rule: filtra QUALI sedute ricevono un SMS automatico.
      if v_settings.sms_rule = 'first' then
        select s2.id into v_first_session_id
        from public.sessions s2
        where s2.user_id = v_settings.user_id
          and s2.patient_id = v_session.patient_id
          and s2.status not in ('cancelled', 'no_show')
        order by s2.scheduled_at asc
        limit 1;

        if v_first_session_id is distinct from v_session.id then
          v_skipped := v_skipped + 1;
          continue;
        end if;
      elsif v_settings.sms_rule = 'no_show' then
        select exists(
          select 1 from public.sessions s3
          where s3.user_id = v_settings.user_id
            and s3.patient_id = v_session.patient_id
            and s3.status = 'no_show'
            and s3.scheduled_at < now()
        ) into v_has_no_show;

        if not v_has_no_show then
          v_skipped := v_skipped + 1;
          continue;
        end if;
      end if;
      -- 'all' non richiede controlli aggiuntivi.

      -- Fascia di silenzio: [quiet_start, quiet_end), con wraparound su
      -- mezzanotte; quiet_start = quiet_end significa "nessuna fascia".
      -- Nessuna riga di delivery viene scritta qui, così un run successivo
      -- (ancora dentro la finestra di invio) ritenta senza bisogno di sblocco.
      v_is_quiet := case
        when v_settings.sms_quiet_start = v_settings.sms_quiet_end then false
        when v_settings.sms_quiet_start < v_settings.sms_quiet_end then
          v_now_hour >= v_settings.sms_quiet_start and v_now_hour < v_settings.sms_quiet_end
        else
          v_now_hour >= v_settings.sms_quiet_start or v_now_hour < v_settings.sms_quiet_end
      end;

      if v_is_quiet then
        v_skipped := v_skipped + 1;
        continue;
      end if;

      begin
        -- Claim: l'INSERT con ON CONFLICT DO NOTHING è il vero lock. Se un
        -- altro run parallelo ha già rivendicato questa (sessione, canale),
        -- non torna alcuna riga e ci si ferma senza inviare due volte.
        insert into public.reminder_deliveries
          (user_id, session_id, channel, status, recipient, provider, scheduled_for)
        values
          (v_settings.user_id, v_session.id, 'sms', 'pending', v_session.phone_norm, 'db-cron', v_session.scheduled_at)
        on conflict (session_id, channel) do nothing
        returning id into v_delivery_id;

        if v_delivery_id is null then
          v_skipped := v_skipped + 1;
        else
          v_claimed := v_claimed + 1;

          v_message := public.render_sms_template(
            v_settings.sms_template,
            v_session.first_name,
            v_session.last_name,
            v_session.scheduled_at,
            v_session.duration_minutes,
            v_session.service_name
          );

          select * into v_built
          from public._build_sms_request(v_cred, v_session.phone_norm, v_message, v_settings.sms_sender);

          v_request_id := net.http_post(
            url := v_cred.endpoint_url,
            body := v_built.p_body,
            params := v_built.p_params,
            headers := v_built.p_headers
          );

          update public.reminder_deliveries
          set provider_request_id = v_request_id
          where id = v_delivery_id;

          update public.sessions
          set reminder_sent_at = now()
          where id = v_session.id;
        end if;
      exception when others then
        -- Un fallimento su una singola seduta non deve mai interrompere il
        -- giro sulle altre. Se il claim era già avvenuto, la riga di delivery
        -- viene marcata 'failed' con il motivo; altrimenti si conta e basta.
        v_failed := v_failed + 1;
        if v_delivery_id is not null then
          update public.reminder_deliveries
          set status = 'failed', error = left(sqlerrm, 2000)
          where id = v_delivery_id;
        end if;
      end;
    end loop;
  end loop;

  return jsonb_build_object('claimed', v_claimed, 'skipped', v_skipped, 'failed', v_failed);
end;
$$;

revoke all on function public.send_due_sms_reminders() from public;

-- =============================================================================
-- 8. Riconciliazione delle risposte asincrone di pg_net
-- =============================================================================
-- net.http_post è asincrono: restituisce subito un id di richiesta (bigint) e
-- la risposta arriva più tardi in net._http_response. Questa funzione chiude
-- il cerchio: legge le risposte arrivate e aggiorna reminder_deliveries.
drop function if exists public.reconcile_sms_deliveries();
create function public.reconcile_sms_deliveries()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sent integer := 0;
  v_failed integer := 0;
  v_pending integer := 0;
  v_row record;
  v_status_code integer;
  v_body text;
  v_error_msg text;
  v_found boolean;
  v_message_id text;
begin
  for v_row in
    select id, created_at, provider_request_id
    from public.reminder_deliveries
    where status = 'pending' and provider_request_id is not null
  loop
    v_found := false;

    select r.status_code, r.content, r.error_msg
    into v_status_code, v_body, v_error_msg
    from net._http_response r
    where r.id = v_row.provider_request_id;

    if found then
      v_found := true;
    end if;

    if not v_found then
      -- Nessuna risposta ancora (o già scaduta dalla tabella interna di
      -- pg_net, che la conserva solo per alcune ore): dopo 30 minuti senza
      -- risposta si considera persa la richiesta.
      if v_row.created_at < now() - interval '30 minutes' then
        update public.reminder_deliveries
        set status = 'failed', error = 'timeout'
        where id = v_row.id;
        v_failed := v_failed + 1;
      else
        v_pending := v_pending + 1;
      end if;
      continue;
    end if;

    if v_error_msg is not null then
      -- Errore a livello di rete/pg_net (DNS, connessione rifiutata, ecc.),
      -- non un errore HTTP del provider.
      update public.reminder_deliveries
      set status = 'failed', error = left(v_error_msg, 500)
      where id = v_row.id;
      v_failed := v_failed + 1;
    elsif v_status_code between 200 and 299 then
      v_message_id := null;
      begin
        v_message_id := coalesce(
          v_body::jsonb ->> 'id',
          v_body::jsonb ->> 'message_id',
          v_body::jsonb ->> 'order_id'
        );
      exception when others then
        -- Risposta 2xx ma corpo non-JSON o senza un campo id riconosciuto:
        -- l'invio resta comunque un successo, semplicemente senza id da
        -- riconciliare in futuro.
        v_message_id := null;
      end;

      update public.reminder_deliveries
      set status = 'sent', sent_at = now(), provider_message_id = v_message_id
      where id = v_row.id;
      v_sent := v_sent + 1;
    else
      update public.reminder_deliveries
      set status = 'failed', error = left(coalesce(v_body, ''), 500)
      where id = v_row.id;
      v_failed := v_failed + 1;
    end if;
  end loop;

  return jsonb_build_object('sent', v_sent, 'failed', v_failed, 'pending', v_pending);
end;
$$;

revoke all on function public.reconcile_sms_deliveries() from public;

-- =============================================================================
-- 9. Invio di prova (manuale, dall'app)
-- =============================================================================
-- A differenza delle funzioni sopra, questa è pensata per essere chiamata
-- direttamente dal client via RPC per un pulsante "Invia SMS di prova" in
-- Impostazioni. Nonostante sia SECURITY DEFINER (deve poter leggere le
-- proprie credenziali dalla tabella write-only), agisce ESCLUSIVAMENTE per
-- auth.uid(): non accetta uno user_id come parametro e non tocca mai
-- reminder_deliveries.
drop function if exists public.send_test_sms(text);
create function public.send_test_sms(p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_cred public.sms_credentials%rowtype;
  v_phone text;
  v_sender text;
  v_built record;
  v_request_id bigint;
begin
  if v_uid is null then
    raise exception 'send_test_sms richiede un utente autenticato';
  end if;

  select * into v_cred from public.sms_credentials where user_id = v_uid;
  if not found or v_cred.endpoint_url = '' then
    raise exception 'Nessuna configurazione SMS salvata: apri Impostazioni e configura il provider prima di inviare un test.';
  end if;

  v_phone := public.normalize_phone_it(p_phone);
  if v_phone is null then
    raise exception 'Numero di telefono non valido: %', coalesce(p_phone, '(vuoto)');
  end if;

  select coalesce(sms_sender, '') into v_sender
  from public.reminder_settings
  where user_id = v_uid;

  select * into v_built
  from public._build_sms_request(v_cred, v_phone, 'PsyManager: messaggio di prova.', coalesce(v_sender, ''));

  v_request_id := net.http_post(
    url := v_cred.endpoint_url,
    body := v_built.p_body,
    params := v_built.p_params,
    headers := v_built.p_headers
  );

  return jsonb_build_object('ok', true, 'request_id', v_request_id);
end;
$$;

revoke all on function public.send_test_sms(text) from public;
grant execute on function public.send_test_sms(text) to authenticated;

-- =============================================================================
-- 10. Pianificazione (pg_cron)
-- =============================================================================
-- Ogni job è avvolto in un blocco difensivo che: (a) rimuove prima un job
-- omonimo già pianificato (rieseguire questa migrazione non duplica nulla),
-- (b) non fa fallire l'intera migrazione se pg_cron non è ancora abilitato
-- (sezione 1) — in quel caso stampa solo un avviso.
do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname = 'psymanager-send-sms';
  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;

  perform cron.schedule(
    'psymanager-send-sms',
    '*/15 * * * *',
    $cron$select public.send_due_sms_reminders();$cron$
  );
exception when others then
  raise notice 'psymanager-send-sms: impossibile pianificare il job pg_cron (%). '
    'Abilita l''estensione pg_cron (sezione 1) e rilancia questa migrazione.', sqlerrm;
end $$;

do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname = 'psymanager-reconcile-sms';
  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;

  perform cron.schedule(
    'psymanager-reconcile-sms',
    '*/5 * * * *',
    $cron$select public.reconcile_sms_deliveries();$cron$
  );
exception when others then
  raise notice 'psymanager-reconcile-sms: impossibile pianificare il job pg_cron (%). '
    'Abilita l''estensione pg_cron (sezione 1) e rilancia questa migrazione.', sqlerrm;
end $$;

