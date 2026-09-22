-- TNC bot and website leaderboard repair
-- Run this entire file once in the Supabase SQL Editor.
-- It is designed to preserve existing bot_users and study_sessions rows.

create table if not exists public.bot_users (
  id bigserial primary key,
  telegram_id bigint not null unique,
  username text,
  first_name text not null default '',
  last_name text,
  is_banned boolean not null default false,
  banned_at timestamptz,
  banned_reason text,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  total_study_seconds integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.bot_users add column if not exists total_study_seconds integer not null default 0;
alter table public.bot_users add column if not exists created_at timestamptz not null default now();

create table if not exists public.study_sessions (
  id bigserial primary key,
  telegram_id bigint not null references public.bot_users(telegram_id) on delete cascade,
  session_id text not null,
  study_date date not null default current_date,
  seconds integer not null default 0 check (seconds >= 0),
  status text not null default 'completed',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (telegram_id, session_id, study_date)
);

alter table public.study_sessions add column if not exists status text not null default 'completed';
alter table public.study_sessions add column if not exists started_at timestamptz not null default now();
alter table public.study_sessions add column if not exists ended_at timestamptz;
alter table public.study_sessions add column if not exists updated_at timestamptz not null default now();

create table if not exists public.website_study_sessions (
  id bigserial primary key,
  visitor_id text not null,
  visitor_name text not null,
  session_id text not null,
  study_date date not null default current_date,
  seconds integer not null default 0 check (seconds >= 0),
  updated_at timestamptz not null default now(),
  unique (visitor_id, session_id, study_date)
);

alter table public.website_study_sessions add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_bot_users_telegram_id on public.bot_users (telegram_id);
create index if not exists idx_study_sessions_telegram_id on public.study_sessions (telegram_id);
create index if not exists idx_website_study_sessions_visitor on public.website_study_sessions (visitor_id);

create or replace function public.record_study_time(
  p_telegram_id bigint,
  p_session_id text,
  p_seconds integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  safe_seconds integer := greatest(least(coalesce(p_seconds, 0), 300), 0);
begin
  if safe_seconds = 0 or p_session_id is null or trim(p_session_id) = '' then
    return;
  end if;

  insert into public.study_sessions (telegram_id, session_id, study_date, seconds, status, started_at, ended_at, updated_at)
  values (p_telegram_id, left(trim(p_session_id), 200), current_date, safe_seconds, 'completed', now(), now(), now())
  on conflict (telegram_id, session_id, study_date)
  do update set
    seconds = public.study_sessions.seconds + excluded.seconds,
    status = 'completed',
    ended_at = now(),
    updated_at = now();

  update public.bot_users
  set total_study_seconds = coalesce(total_study_seconds, 0) + safe_seconds,
      last_seen = now()
  where telegram_id = p_telegram_id;
end;
$$;

create or replace function public.record_website_study_time(
  p_visitor_id text,
  p_visitor_name text,
  p_session_id text,
  p_seconds integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  safe_seconds integer := greatest(least(coalesce(p_seconds, 0), 300), 0);
begin
  if safe_seconds = 0 or nullif(trim(p_visitor_id), '') is null or nullif(trim(p_visitor_name), '') is null or nullif(trim(p_session_id), '') is null then
    return;
  end if;

  insert into public.website_study_sessions (visitor_id, visitor_name, session_id, study_date, seconds, updated_at)
  values (left(trim(p_visitor_id), 120), left(trim(p_visitor_name), 80), left(trim(p_session_id), 200), current_date, safe_seconds, now())
  on conflict (visitor_id, session_id, study_date)
  do update set
    visitor_name = excluded.visitor_name,
    seconds = public.website_study_sessions.seconds + excluded.seconds,
    updated_at = now();
end;
$$;

-- Recreate the view so both Telegram users and website visitors appear.
drop view if exists public.study_leaderboard;
create view public.study_leaderboard as
select
  'telegram_' || u.telegram_id::text as participant_id,
  coalesce(nullif(trim(u.first_name), ''), 'Telegram Student') as first_name,
  u.username,
  coalesce(sum(s.seconds), 0)::integer as seconds,
  count(s.id)::integer as sessions
from public.bot_users u
left join public.study_sessions s on s.telegram_id = u.telegram_id
where u.is_banned = false
group by u.telegram_id, u.first_name, u.username
union all
select
  'web_' || w.visitor_id as participant_id,
  coalesce(nullif(max(trim(w.visitor_name)), ''), 'Website Student') as first_name,
  null::text as username,
  coalesce(sum(w.seconds), 0)::integer as seconds,
  count(w.id)::integer as sessions
from public.website_study_sessions w
group by w.visitor_id
order by seconds desc;

alter table public.bot_users enable row level security;
alter table public.study_sessions enable row level security;
alter table public.website_study_sessions enable row level security;
revoke all on table public.bot_users from anon, authenticated;
revoke all on table public.study_sessions from anon, authenticated;
revoke all on table public.website_study_sessions from anon, authenticated;
revoke all on table public.study_leaderboard from anon, authenticated;
revoke all on function public.record_study_time(bigint, text, integer) from anon, authenticated;
revoke all on function public.record_website_study_time(text, text, text, integer) from anon, authenticated;

grant execute on function public.record_study_time(bigint, text, integer) to service_role;
grant execute on function public.record_website_study_time(text, text, text, integer) to service_role;
