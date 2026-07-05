-- Migration 008: Consolidated schema fixes
-- Safe to run on any database that has applied migrations 001-007 (and the
-- interim 001_add_group_support_to_sessions.sql). Every statement is
-- idempotent: re-running this file is harmless.
--
-- Fixes:
--   1. sessions.patient_id was still NOT NULL → group (couple/family)
--      sessions could never be saved. Now nullable with a CHECK that a
--      session always has a patient OR a group.
--   2. Deleting a group would have silently orphaned its sessions
--      (ON DELETE SET NULL + no patient) → now RESTRICT: sessions must be
--      reassigned or deleted first.
--   3. session_series had no group support → recurring couple/family
--      sessions lost group_id/session_type on every occurrence.
--   4. reminder_settings existed only in database.sql, never as a migration.
--   5. patient_tag_assignments RLS only checked tag ownership, not patient
--      ownership → cross-tenant writes were possible.
--   6. users had no updated_at trigger.
--   7. Money/duration columns had no DB-level CHECK constraints.
--   8. Deleting a patient/clinical note left orphaned attachment rows.

-- ---------------------------------------------------------------------------
-- 1. Allow group-only sessions
-- ---------------------------------------------------------------------------
alter table public.sessions
  alter column patient_id drop not null;

alter table public.sessions
  drop constraint if exists sessions_patient_or_group_chk;
alter table public.sessions
  add constraint sessions_patient_or_group_chk
  check (patient_id is not null or group_id is not null);

-- ---------------------------------------------------------------------------
-- 2. Groups with sessions cannot be silently deleted
-- ---------------------------------------------------------------------------
alter table public.sessions
  drop constraint if exists sessions_group_id_fkey;
alter table public.sessions
  add constraint sessions_group_id_fkey
  foreign key (group_id) references public.patient_groups(id) on delete restrict;

create index if not exists sessions_group_id_idx on public.sessions(group_id);

-- ---------------------------------------------------------------------------
-- 3. Group support for recurring series
-- ---------------------------------------------------------------------------
alter table public.session_series
  alter column patient_id drop not null;

alter table public.session_series
  add column if not exists group_id uuid references public.patient_groups(id) on delete restrict;

alter table public.session_series
  add column if not exists session_type text not null default 'individuale'
    check (session_type in ('individuale', 'coppia', 'familiare'));

alter table public.session_series
  drop constraint if exists session_series_patient_or_group_chk;
alter table public.session_series
  add constraint session_series_patient_or_group_chk
  check (patient_id is not null or group_id is not null);

create index if not exists session_series_group_id_idx on public.session_series(group_id);

-- ---------------------------------------------------------------------------
-- 4. reminder_settings (was missing from the migrations path)
-- ---------------------------------------------------------------------------
create table if not exists public.reminder_settings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade unique,
  pre_session_enabled boolean not null default true,
  pre_session_minutes integer not null default 30,
  post_session_enabled boolean not null default false,
  post_session_minutes integer not null default 30,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reminder_settings enable row level security;

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

create index if not exists reminder_settings_user_id_idx on public.reminder_settings(user_id);

drop trigger if exists reminder_settings_updated_at_trigger on public.reminder_settings;
create trigger reminder_settings_updated_at_trigger before update on public.reminder_settings
  for each row execute function public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 5. Tag assignments must also verify patient ownership
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 6. users.updated_at trigger
-- ---------------------------------------------------------------------------
drop trigger if exists users_updated_at_trigger on public.users;
create trigger users_updated_at_trigger before update on public.users
  for each row execute function public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 7. DB-level integrity for money and durations
-- ---------------------------------------------------------------------------
alter table public.service_types
  drop constraint if exists service_types_duration_chk;
alter table public.service_types
  add constraint service_types_duration_chk check (duration_minutes > 0);

alter table public.service_types
  drop constraint if exists service_types_price_chk;
alter table public.service_types
  add constraint service_types_price_chk check (price >= 0);

alter table public.payments
  drop constraint if exists payments_amount_chk;
alter table public.payments
  add constraint payments_amount_chk check (amount > 0);

alter table public.package_agreements
  drop constraint if exists package_agreements_totals_chk;
alter table public.package_agreements
  add constraint package_agreements_totals_chk
  check (total_sessions > 0 and total_price >= 0 and paid_amount >= 0);

-- ---------------------------------------------------------------------------
-- 8. Session status: cancelled / no-show sessions must not be billed
-- ---------------------------------------------------------------------------
alter table public.sessions
  add column if not exists status text not null default 'scheduled'
    check (status in ('scheduled', 'completed', 'cancelled', 'no_show'));

create index if not exists sessions_status_idx on public.sessions(status);

-- ---------------------------------------------------------------------------
-- 9. Payments can be attributed to a patient group (couple/family sessions)
-- ---------------------------------------------------------------------------
alter table public.payments
  add column if not exists group_id uuid references public.patient_groups(id) on delete set null;

create index if not exists payments_group_id_idx on public.payments(group_id);

-- ---------------------------------------------------------------------------
-- 10. Clean up attachments when their owner row is deleted
-- ---------------------------------------------------------------------------
create or replace function public.cleanup_orphaned_attachments()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.attachments
  where owner_type = case when TG_TABLE_NAME = 'patients' then 'patient' else 'clinical_note' end
    and owner_id = old.id;
  return old;
end;
$$;

drop trigger if exists patients_cleanup_attachments on public.patients;
create trigger patients_cleanup_attachments after delete on public.patients
  for each row execute function public.cleanup_orphaned_attachments();

drop trigger if exists clinical_notes_cleanup_attachments on public.clinical_notes;
create trigger clinical_notes_cleanup_attachments after delete on public.clinical_notes
  for each row execute function public.cleanup_orphaned_attachments();
