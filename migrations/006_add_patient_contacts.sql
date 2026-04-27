-- Migration: Add additional contacts support for patients
-- Allows multiple phones/emails per patient with custom labels (e.g. "Madre", "Padre", "Lavoro")
-- The primary phone/email on the patients table is kept for backward compatibility.

create table if not exists public.patient_contacts (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  kind text not null check (kind in ('phone', 'email')),
  label text not null default '',
  value text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Indexes
create index if not exists patient_contacts_patient_id_idx on public.patient_contacts(patient_id);
create index if not exists patient_contacts_kind_idx on public.patient_contacts(kind);

-- Enable RLS
alter table public.patient_contacts enable row level security;

-- RLS policy: visible if user owns the parent patient
create policy "Patient contacts visible to patient owner" on public.patient_contacts
  for all using (
    exists (
      select 1 from public.patients p
      where p.id = patient_id and p.user_id = auth.uid()
    )
  );

-- Trigger for updated_at
create trigger patient_contacts_updated_at_trigger before update on public.patient_contacts
  for each row execute function public.update_updated_at_column();
