-- Creator Research Studio: run once in Supabase → SQL Editor → New query → Run.
-- One table holds all app data as JSON documents; a private bucket holds uploaded files.
-- Row Level Security is on with no policies, so only the server's service role key can read or
-- write. The public "anon" key can't see anything.

create table if not exists public.studio_docs (
  collection text not null,
  id text not null,
  data jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (collection, id)
);
create index if not exists studio_docs_updated_at on public.studio_docs (updated_at);

create or replace function public.studio_touch() returns trigger language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;

drop trigger if exists studio_touch on public.studio_docs;
create trigger studio_touch before insert or update on public.studio_docs
  for each row execute function public.studio_touch();

alter table public.studio_docs enable row level security;

insert into storage.buckets (id, name, public)
values ('studio-files', 'studio-files', false)
on conflict (id) do nothing;
