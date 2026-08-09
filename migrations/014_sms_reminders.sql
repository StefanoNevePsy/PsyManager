-- Migration 014: automatic SMS reminders (disabled by default)
--
-- Design notes:
-- * The provider API key is NEVER stored here and never reaches the client.
--   It lives as a secret of the Edge Function (supabase secrets set ...).
--   This table only holds non-secret preferences.
-- * Sending happens server-side on a schedule, so it works with the app
--   closed. reminder_deliveries is the idempotency ledger: the UNIQUE
--   constraint makes a double send impossible even if the job overlaps.
--
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. SMS preferences (per user), all opt-in
-- ---------------------------------------------------------------------------
alter table public.reminder_settings
  add column if not exists sms_enabled boolean not null default false,
  -- 'skebby' | 'twilio' | 'generic' — which adapter the Edge Function uses
  add column if not exists sms_provider text not null default 'skebby',
  -- Alphanumeric sender, max 11 chars (must be registered with the provider)
  add column if not exists sms_sender text not null default '',
  add column if not exists sms_advance_minutes integer not null default 1440,
  add column if not exists sms_template text not null default
    'Le ricordo l''appuntamento di {giorno} alle {ora}.',
  -- Quiet hours: never deliver between these local hours
  add column if not exists sms_quiet_start integer not null default 21,
  add column if not exists sms_quiet_end integer not null default 8,
  -- Which sessions get an automatic SMS:
  --   'all'        every session
  --   'first'      only a patient's first session
  --   'no_show'    only patients with a past no-show
  --   'manual'     none automatically (per-patient flag only)
  add column if not exists sms_rule text not null default 'all';

-- Named constraints: an inline check inside add-column never reaches a
-- database where the column already exists
alter table public.reminder_settings
  drop constraint if exists reminder_settings_sms_quiet_start_chk;
alter table public.reminder_settings
  add constraint reminder_settings_sms_quiet_start_chk check (sms_quiet_start between 0 and 23);
alter table public.reminder_settings
  drop constraint if exists reminder_settings_sms_quiet_end_chk;
alter table public.reminder_settings
  add constraint reminder_settings_sms_quiet_end_chk check (sms_quiet_end between 0 and 23);
alter table public.reminder_settings
  drop constraint if exists reminder_settings_sms_rule_chk;
alter table public.reminder_settings
  add constraint reminder_settings_sms_rule_chk check (sms_rule in ('all', 'first', 'no_show', 'manual'));
alter table public.reminder_settings
  drop constraint if exists reminder_settings_sms_provider_chk;
alter table public.reminder_settings
  add constraint reminder_settings_sms_provider_chk check (sms_provider in ('skebby', 'twilio', 'generic'));

-- ---------------------------------------------------------------------------
-- 2. Per-patient consent — no consent, no SMS, whatever the rule says
-- ---------------------------------------------------------------------------
alter table public.patients
  add column if not exists sms_consent boolean not null default false,
  add column if not exists sms_consent_at timestamptz;

-- ---------------------------------------------------------------------------
-- 3. Delivery ledger
-- ---------------------------------------------------------------------------
create table if not exists public.reminder_deliveries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  channel text not null check (channel in ('sms', 'email', 'whatsapp')),
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'delivered', 'failed', 'skipped')),
  -- Provider-side id, used to reconcile delivery receipts
  provider_message_id text,
  provider text,
  recipient text,
  error text,
  scheduled_for timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One delivery per session per channel: the guarantee against double sends
  unique (session_id, channel)
);

alter table public.reminder_deliveries enable row level security;

drop policy if exists "Reminder deliveries visible to owner" on public.reminder_deliveries;
create policy "Reminder deliveries visible to owner" on public.reminder_deliveries
  for all using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid())
  );

create index if not exists reminder_deliveries_user_id_idx on public.reminder_deliveries(user_id);
create index if not exists reminder_deliveries_session_id_idx on public.reminder_deliveries(session_id);
create index if not exists reminder_deliveries_status_idx on public.reminder_deliveries(status);

drop trigger if exists reminder_deliveries_updated_at_trigger on public.reminder_deliveries;
create trigger reminder_deliveries_updated_at_trigger before update on public.reminder_deliveries
  for each row execute function public.update_updated_at_column();
