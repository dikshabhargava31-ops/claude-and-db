-- Evaluation Helpdesk schema.
-- Run once in the Supabase SQL editor (or `supabase db push`) on a NEW project
-- that is separate from the evaluation app's database.
--
-- Security model: Row Level Security is ON for every table and there are NO
-- policies, so the public anon/publishable key can read or write nothing.
-- Only the server (service-role key, kept in Vercel env vars) can touch data.

create extension if not exists pgcrypto;

create table if not exists teachers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  school text,
  access_code_hash text not null unique,      -- sha256 of the access code; the code itself is never stored
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  copy_ref text,                                -- answer-copy / sheet id in the evaluation app
  student_ref text,                             -- roll number or student id (no names needed)
  subject text,
  title text not null,
  classification text not null default 'pending'
    check (classification in ('pending','teacher_query','ai_marking_error','code_bug','needs_more_info')),
  status text not null default 'open'
    check (status in ('open','answered','waiting_owner','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reports_teacher_idx on reports(teacher_id, updated_at desc);

create table if not exists report_messages (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id) on delete cascade,
  role text not null check (role in ('teacher','assistant')),
  content text not null,
  attachments jsonb not null default '[]'::jsonb,   -- [{path, media_type}] in the private bucket
  corrected_marks jsonb,                            -- assistant only: [{question, awarded, should_be, reason}]
  created_at timestamptz not null default now()
);
create index if not exists report_messages_report_idx on report_messages(report_id, created_at);

-- Snapshots of a checked copy, pushed by the evaluation app (optional integration).
create table if not exists copy_snapshots (
  copy_ref text primary key,
  data jsonb not null,
  received_at timestamptz not null default now()
);

-- The change log the owner reviews. Nothing here changes any code by itself.
create table if not exists change_requests (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references reports(id) on delete set null,
  title text not null,
  area text not null,
  severity text not null check (severity in ('low','medium','high','critical')),
  evidence text not null,
  suspected_cause text not null,
  proposed_change text not null,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','done')),
  owner_note text,
  decided_at timestamptz,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists change_requests_status_idx on change_requests(status, created_at desc);

alter table teachers        enable row level security;
alter table reports         enable row level security;
alter table report_messages enable row level security;
alter table copy_snapshots  enable row level security;
alter table change_requests enable row level security;

-- Private bucket for screenshots (not public; the server hands out short-lived signed URLs).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-screenshots', 'report-screenshots', false, 5242880,
        array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;
