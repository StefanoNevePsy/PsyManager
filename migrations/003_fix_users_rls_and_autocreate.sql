-- Migration: Fix users table RLS policies and auto-create rows
-- Run this migration in Supabase SQL Editor

-- 1) Add missing RLS policies for INSERT and UPDATE on public.users
--    (the original schema only had a SELECT policy, blocking profile updates)
drop policy if exists "Users can insert their own data" on public.users;
create policy "Users can insert their own data" on public.users
  for insert with check (auth.uid() = id);

drop policy if exists "Users can update their own data" on public.users
  ;
create policy "Users can update their own data" on public.users
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- 2) Backfill: insert a row in public.users for any existing auth.users that don't have one
insert into public.users (id, email)
select au.id, au.email
from auth.users au
left join public.users pu on pu.id = au.id
where pu.id is null;

-- 3) Trigger: auto-create a public.users row whenever a new auth.users row is created
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
