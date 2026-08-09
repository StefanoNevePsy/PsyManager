-- Migration 012: tenant-isolation hardening
--
-- Ownership policies so far only checked the row's own user_id. That leaves
-- foreign keys unvalidated: a user could point their own row at ANOTHER
-- user's patient/session/group, because the FK constraint is evaluated with
-- elevated privilege and is not RLS-filtered. Nothing leaks through the app
-- today (every read of the referenced row is still filtered by its owner),
-- but it breaks referential integrity across tenants and would become a real
-- leak as soon as any privileged path (Edge Function, SECURITY DEFINER RPC,
-- reporting view) joins those tables.
--
-- Every policy below therefore re-states `auth.uid() = user_id` in WITH CHECK:
-- adding an explicit WITH CHECK disables Postgres' implicit reuse of USING.
-- NULL foreign keys stay allowed.
--
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. receipt_sessions: the linked session must belong to the caller too
--    (previously only the receipt's ownership was verified, so a receipt
--    could be linked to someone else's session)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 2. sessions: patient, group, service type and series must all be the
--    caller's own
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 3. session_series: same references
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 4. payments: patient, group and session must be the caller's own
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 5. patients: the group a patient is assigned to must be the caller's own
-- ---------------------------------------------------------------------------
drop policy if exists "Patients are visible to their owner" on public.patients;
create policy "Patients are visible to their owner" on public.patients
  for all using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (group_id is null or exists (
      select 1 from public.patient_groups g where g.id = group_id and g.user_id = auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- 6. clinical_notes: patient and session must be the caller's own
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 7. receipts: patient and group must be the caller's own
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 8. attachments: the polymorphic owner row must be the caller's own
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 9. package_agreements: the structure must be the caller's own
-- ---------------------------------------------------------------------------
drop policy if exists "Package agreements are visible to their owner" on public.package_agreements;
create policy "Package agreements are visible to their owner" on public.package_agreements
  for all using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.structures s where s.id = structure_id and s.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 10. Defense in depth: pin the search_path of the shared trigger function
-- ---------------------------------------------------------------------------
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
