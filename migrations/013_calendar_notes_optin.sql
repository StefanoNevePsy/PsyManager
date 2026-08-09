-- Migration 013: session notes are no longer pushed to Google by default
--
-- sessionToGoogleEvent put the raw sessions.notes into the calendar event
-- description on every sync. Those notes can be clinically sensitive, and
-- they were leaving for Google's servers with no toggle and no opt-out —
-- while the event TITLE already had a privacy setting. Default is now off.
-- Idempotent: safe to re-run.

alter table public.calendar_settings
  add column if not exists include_notes boolean not null default false;
