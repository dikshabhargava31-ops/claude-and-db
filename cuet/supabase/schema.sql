-- Everything CUET: accounts and leads.
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Then add your own login email to public.admins (last statement) so the site's Admin page shows every lead.

-- One row per signed-in student: the lead.
create table if not exists public.leads (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  name text,
  phone text,
  class12_year text,
  category text,
  state text,
  interest text,
  whatsapp_ok boolean not null default true,
  dream_list jsonb not null default '[]'::jsonb,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Everything a student asks for: alerts, form filling orders, senior calls, groups, allotment reports.
create table if not exists public.requests (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists requests_user_idx on public.requests (user_id);

-- Emails allowed to see every lead. Not readable through the API.
create table if not exists public.admins (email text primary key);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where lower(email) = lower(auth.jwt() ->> 'email'));
$$;
grant execute on function public.is_admin() to authenticated;

alter table public.leads enable row level security;
alter table public.requests enable row level security;
alter table public.admins enable row level security;

drop policy if exists "read own lead, admins read all" on public.leads;
create policy "read own lead, admins read all" on public.leads
  for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists "create own lead" on public.leads;
create policy "create own lead" on public.leads
  for insert to authenticated with check (id = auth.uid());
drop policy if exists "update own lead" on public.leads;
create policy "update own lead" on public.leads
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "read own requests, admins read all" on public.requests;
create policy "read own requests, admins read all" on public.requests
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "create own requests" on public.requests;
create policy "create own requests" on public.requests
  for insert to authenticated with check (user_id = auth.uid());

-- Replace with the email you log in with, then run this line.
insert into public.admins (email) values ('your-email@example.com') on conflict do nothing;

-- Sign-ups, bookings and reminder requests sent from the website without a login (login: "form" in config.js).
-- Visitors can only add rows; nobody can read them through the API. View them in the Supabase Table Editor.
create table if not exists public.signups (
  id bigint generated always as identity primary key,
  kind text not null check (char_length(kind) <= 40),
  name text check (char_length(name) <= 120),
  phone text check (char_length(phone) <= 20),
  email text check (char_length(email) <= 160),
  course text check (char_length(course) <= 120),
  payload jsonb not null default '{}'::jsonb check (pg_column_size(payload) <= 16000),
  page text check (char_length(page) <= 300),
  created_at timestamptz not null default now()
);
alter table public.signups enable row level security;
drop policy if exists "visitors can add" on public.signups;
create policy "visitors can add" on public.signups for insert to anon, authenticated with check (true);
drop policy if exists "admins read" on public.signups;
create policy "admins read" on public.signups for select to authenticated using ((select public.is_admin()));
revoke update, delete on public.signups from anon, authenticated;
