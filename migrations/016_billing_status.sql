-- Migration 016: billing status per session
--
-- Receipts already support one invoice covering many sessions (the
-- receipt_sessions join table). What was missing is seeing it from the
-- sessions side: which sessions are still to invoice.
--
-- Rules:
-- * invoiced     → the session is linked to a receipt
-- * cash         → paid in cash: no invoice is due (per the user's workflow)
-- * exempt       → manually marked as not requiring an invoice
-- * to_invoice   → everything else that has ended and is billable
--
-- Idempotent: safe to re-run.

-- Manual override for the cases the rules can't infer
alter table public.sessions
  add column if not exists invoice_exempt boolean not null default false;

-- One place that answers "what still needs an invoice?", so the client never
-- has to reimplement the rules.
drop view if exists public.session_billing_status;
create view public.session_billing_status as
select
  s.id                                as session_id,
  s.user_id,
  s.scheduled_at,
  s.status,
  s.invoice_exempt,
  rs.receipt_id,
  r.number                            as receipt_number,
  r.year                              as receipt_year,
  r.issue_date                        as receipt_date,
  -- A session counts as cash-paid when any linked payment was in cash
  exists (
    select 1 from public.payments p
    where p.session_id = s.id and p.payment_method = 'cash'
  )                                   as paid_cash,
  case
    when rs.receipt_id is not null then 'invoiced'
    when s.invoice_exempt then 'exempt'
    when exists (
      select 1 from public.payments p
      where p.session_id = s.id and p.payment_method = 'cash'
    ) then 'cash'
    when s.status in ('cancelled', 'no_show') then 'not_due'
    when s.scheduled_at > now() then 'not_due'
    else 'to_invoice'
  end                                 as billing_status
from public.sessions s
left join public.receipt_sessions rs on rs.session_id = s.id
left join public.receipts r on r.id = rs.receipt_id
where s.user_id = auth.uid();

revoke all on public.session_billing_status from public, anon;
grant select on public.session_billing_status to authenticated;

create index if not exists sessions_invoice_exempt_idx
  on public.sessions(invoice_exempt) where invoice_exempt;
