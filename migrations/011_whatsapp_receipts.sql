-- Migration 011: WhatsApp reminders + health receipts (ricevute sanitarie)
-- Idempotent: safe to re-run.

-- 1. WhatsApp reminder preferences (per user)
alter table public.reminder_settings
  add column if not exists whatsapp_enabled boolean not null default false,
  add column if not exists whatsapp_template text not null default
    'Ciao {nome}, ti ricordo il nostro appuntamento di {giorno} alle {ora}. A presto!',
  add column if not exists whatsapp_notify_minutes integer not null default 1440;

-- 2. Track which sessions already got a reminder sent
alter table public.sessions
  add column if not exists reminder_sent_at timestamptz;

-- 3. Health receipts (ricevute sanitarie)
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

alter table public.receipts enable row level security;

drop policy if exists "Receipts visible to owner" on public.receipts;
create policy "Receipts visible to owner" on public.receipts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists receipts_user_id_idx on public.receipts(user_id);
create index if not exists receipts_patient_id_idx on public.receipts(patient_id);
create index if not exists receipts_issue_date_idx on public.receipts(issue_date);

drop trigger if exists receipts_updated_at_trigger on public.receipts;
create trigger receipts_updated_at_trigger before update on public.receipts
  for each row execute function public.update_updated_at_column();

-- 4. Link receipts to the sessions they cover (many-to-many)
create table if not exists public.receipt_sessions (
  id uuid primary key default uuid_generate_v4(),
  receipt_id uuid not null references public.receipts(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  unique (receipt_id, session_id)
);

alter table public.receipt_sessions enable row level security;

drop policy if exists "Receipt sessions visible to receipt owner" on public.receipt_sessions;
create policy "Receipt sessions visible to receipt owner" on public.receipt_sessions
  for all using (
    exists (select 1 from public.receipts r where r.id = receipt_id and r.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.receipts r where r.id = receipt_id and r.user_id = auth.uid())
  );

create index if not exists receipt_sessions_receipt_id_idx on public.receipt_sessions(receipt_id);
create index if not exists receipt_sessions_session_id_idx on public.receipt_sessions(session_id);

-- 5. Professional header + numbering settings for receipts
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

alter table public.receipt_settings enable row level security;

drop policy if exists "Users manage own receipt settings" on public.receipt_settings;
create policy "Users manage own receipt settings" on public.receipt_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists receipt_settings_user_id_idx on public.receipt_settings(user_id);

drop trigger if exists receipt_settings_updated_at_trigger on public.receipt_settings;
create trigger receipt_settings_updated_at_trigger before update on public.receipt_settings
  for each row execute function public.update_updated_at_column();
