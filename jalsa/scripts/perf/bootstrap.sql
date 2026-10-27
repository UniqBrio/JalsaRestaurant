-- perf rig: the parts of a Supabase project the migrations assume, and nothing else.
-- Roles PostgREST switches into, the `extensions` schema pgcrypto lives in, and a storage.buckets
-- table for the one migration that registers the media bucket. Never run against a real project.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role authenticator login noinherit password 'rig';
grant anon, authenticated, service_role to authenticator;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists storage;
create table if not exists storage.buckets (id text primary key, name text, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now());
-- No default privileges on `public`: that is every Supabase project from 30-Oct-2026. The
-- migrations grant service_role what the server uses (20261027120000_jalsa_explicit_data_api_grants),
-- so a table that forgets its grant fails here as it would in production. Until 27-Oct-2026 this
-- file granted all on tables, sequences and functions to service_role by default, which hid that.
grant usage on schema public to anon, authenticated, service_role;
