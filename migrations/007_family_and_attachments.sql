-- Migration: Add family members ("textual genogram") and attachments support

-- Family members (textual genogram) -----------------------------------------
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

create index if not exists patient_family_members_patient_id_idx on public.patient_family_members(patient_id);

alter table public.patient_family_members enable row level security;

create policy "Family members visible to patient owner" on public.patient_family_members
  for all using (
    exists (
      select 1 from public.patients p
      where p.id = patient_id and p.user_id = auth.uid()
    )
  );

create trigger patient_family_members_updated_at_trigger before update on public.patient_family_members
  for each row execute function public.update_updated_at_column();

-- Attachments (files attached to patients or clinical notes) ----------------
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

create index if not exists attachments_owner_idx on public.attachments(owner_type, owner_id);
create index if not exists attachments_user_id_idx on public.attachments(user_id);

alter table public.attachments enable row level security;

create policy "Attachments visible to owner" on public.attachments
  for all using (auth.uid() = user_id);

-- Storage bucket setup (idempotent) -----------------------------------------
-- Create the bucket if it doesn't exist, set as private (signed URLs only)
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
  set file_size_limit = excluded.file_size_limit,
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
