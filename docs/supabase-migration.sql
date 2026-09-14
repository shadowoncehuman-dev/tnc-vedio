-- Safe Supabase migration for TNC Nursing app.
-- Run this once in the Supabase SQL Editor.

create table if not exists public.bot_users (
  id bigserial primary key,
  telegram_id bigint not null unique,
  username text,
  first_name text not null default '',
  last_name text,
  phone text,
  registration_data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  is_banned boolean not null default false,
  banned_at timestamptz,
  banned_reason text,
  total_study_seconds integer not null default 0,
  metadata jsonb default '{}'::jsonb
);

create table if not exists public.app_users (
  id bigserial primary key,
  user_id text not null unique,
  name text not null,
  mobile text not null unique,
  email text,
  college text,
  state text,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_sessions (
  id bigserial primary key,
  telegram_id bigint not null references public.bot_users(telegram_id) on delete cascade,
  session_id text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  study_date date not null default current_date,
  seconds integer not null default 0 check (seconds >= 0),
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (telegram_id, session_id, study_date)
);

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

create table if not exists public.broadcast_logs (
  id bigserial primary key,
  admin_telegram_id bigint not null,
  content_type text not null,
  message_text text,
  media_url text,
  created_at timestamptz not null default now(),
  total_recipients integer not null default 0,
  successful_sends integer not null default 0,
  failed_sends integer not null default 0
);

create or replace function public.record_study_time(
  p_telegram_id bigint,
  p_session_id text,
  p_seconds integer
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.study_sessions (telegram_id, session_id, study_date, seconds, status, started_at, ended_at)
  values (p_telegram_id, p_session_id, current_date, greatest(p_seconds, 0), 'completed', now(), now())
  on conflict (telegram_id, session_id, study_date)
  do update set
    seconds = public.study_sessions.seconds + excluded.seconds,
    status = 'completed',
    ended_at = now(),
    updated_at = now();
$$;

create or replace function public.record_website_study_time(
  p_visitor_id text,
  p_visitor_name text,
  p_session_id text,
  p_seconds integer
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.website_study_sessions (visitor_id, visitor_name, session_id, study_date, seconds)
  values (p_visitor_id, left(trim(p_visitor_name), 80), p_session_id, current_date, greatest(p_seconds, 0))
  on conflict (visitor_id, session_id, study_date)
  do update set
    visitor_name = excluded.visitor_name,
    seconds = public.website_study_sessions.seconds + excluded.seconds,
    updated_at = now();
$$;

drop view if exists public.study_leaderboard;

create view public.study_leaderboard as
select
  'telegram_' || u.telegram_id::text as participant_id,
  u.first_name,
  u.username,
  coalesce(sum(s.seconds), 0)::integer as seconds,
  coalesce(count(s.id), 0)::integer as sessions
from public.bot_users u
left join public.study_sessions s on s.telegram_id = u.telegram_id
where u.is_banned = false
group by u.telegram_id, u.first_name, u.username
union all
select
  'web_' || visitor_id as participant_id,
  max(visitor_name) as first_name,
  null::text as username,
  sum(seconds)::integer as seconds,
  count(*)::integer as sessions
from public.website_study_sessions
group by visitor_id
order by seconds desc;

create index if not exists idx_bot_users_telegram_id on public.bot_users (telegram_id);
create index if not exists idx_bot_users_banned on public.bot_users (is_banned);
create index if not exists idx_bot_users_created_at on public.bot_users (created_at);
create index if not exists idx_study_sessions_user on public.study_sessions (telegram_id);
create index if not exists idx_study_sessions_dates on public.study_sessions (study_date, telegram_id);
create index if not exists idx_website_study_sessions_visitor on public.website_study_sessions (visitor_id);
create index if not exists idx_broadcast_logs_created_at on public.broadcast_logs (created_at);

alter table public.bot_users enable row level security;
alter table public.app_users enable row level security;
alter table public.study_sessions enable row level security;
alter table public.website_study_sessions enable row level security;
alter table public.broadcast_logs enable row level security;

revoke all on table public.bot_users from anon, authenticated;
revoke all on table public.app_users from anon, authenticated;
revoke all on table public.study_sessions from anon, authenticated;
revoke all on table public.website_study_sessions from anon, authenticated;
revoke all on table public.broadcast_logs from anon, authenticated;
revoke all on function public.record_study_time(bigint, text, integer) from anon, authenticated;
revoke all on function public.record_website_study_time(text, text, text, integer) from anon, authenticated;
revoke all on table public.study_leaderboard from anon, authenticated;

comment on table public.bot_users is 'Telegram bot and mini app users; accessed only server-side with the service-role key';
comment on table public.app_users is 'TNC app login users; accessed only server-side with the service-role key';
comment on table public.study_sessions is 'Trusted study session durations captured by the backend';
comment on table public.broadcast_logs is 'Server-side audit trail for Telegram broadcasts';
