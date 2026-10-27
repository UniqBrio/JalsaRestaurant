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
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on functions to service_role;
grant usage on schema public to anon, authenticated, service_role;
