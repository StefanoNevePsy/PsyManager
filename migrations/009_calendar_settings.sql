-- Migration 009: Per-user Google Calendar preferences
-- - title_format: how patient names appear in Google event titles.
--   'full'          → "Rossi Mario"
--   'first_initial' → "Mario R."
--   'initials'      → "M.R."  (privacy-friendly default for clinical data)
-- - color_by_service: color Google events by service type (matches the
--   in-app palette).
-- Idempotent: safe to re-run.

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

drop policy if exists "Users manage own calendar settings" on public.calendar_settings;
create policy "Users manage own calendar settings"
  on public.calendar_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists calendar_settings_user_id_idx on public.calendar_settings(user_id);

drop trigger if exists calendar_settings_updated_at_trigger on public.calendar_settings;
create trigger calendar_settings_updated_at_trigger before update on public.calendar_settings
  for each row execute function public.update_updated_at_column();
