-- Migration: Add full_name column to users table
-- Run this migration if you already have PsyManager set up in Supabase

alter table public.users
add column if not exists full_name text;
