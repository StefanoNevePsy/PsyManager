-- Migration 010: custom service colors + center billing + net income settings
-- Idempotent: safe to re-run.

-- 1. Custom color per service type (hex like '#3b82f6'; NULL = automatic)
alter table public.service_types
  add column if not exists color text;

-- 2. Center share for services performed in/through a center.
--    Meaning: percentage of the session price that belongs to the CENTER.
alter table public.service_types
  add column if not exists center_percentage numeric(5,2) not null default 0
    check (center_percentage >= 0 and center_percentage <= 100);

-- 3. Default payment method per service type, used to project the NET for
--    sessions that have not been paid yet.
alter table public.service_types
  add column if not exists default_payment_method public.payment_method;

-- 4. New payment methods for center billing arrangements:
--    'my_invoice'     → I invoice the full amount, return center_percentage
--                       to the center at month end
--    'center_invoice' → the center invoices the client and pays me
--                       (100 - center_percentage)% of the session
alter type public.payment_method add value if not exists 'my_invoice';
alter type public.payment_method add value if not exists 'center_invoice';

-- 5. Tax settings (regime forfettario) for net income estimates.
--    Effective tax on invoiced revenue =
--      coefficiente/100 * (imposta_sostitutiva + enpap)/100
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

drop policy if exists "Users manage own tax settings" on public.tax_settings;
create policy "Users manage own tax settings"
  on public.tax_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists tax_settings_user_id_idx on public.tax_settings(user_id);

drop trigger if exists tax_settings_updated_at_trigger on public.tax_settings;
create trigger tax_settings_updated_at_trigger before update on public.tax_settings
  for each row execute function public.update_updated_at_column();
