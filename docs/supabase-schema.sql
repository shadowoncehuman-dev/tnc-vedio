-- TNC Nursing Classes: run this once in Supabase SQL Editor.
-- The service-role key is used only by the API server; never put it in Vite
-- or browser code. RLS is enabled so a browser cannot read these tables.

create table if not exists public.bot_users (
  id serial primary key,
  telegram_id bigint not null unique,
  username text,
  first_name text not null default '',
  last_name text,
  is_banned boolean not null default false,
  banned_at timestamptz,
  banned_reason text,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
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
  study_date date not null default current_date,
  seconds integer not null default 0 check (seconds >= 0),
  updated_at timestamptz not null default now(),
  unique (telegram_id, session_id, study_date)
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
  insert into public.study_sessions (telegram_id, session_id, study_date, seconds)
  values (p_telegram_id, p_session_id, current_date, greatest(p_seconds, 0))
  on conflict (telegram_id, session_id, study_date)
  do update set
    seconds = public.study_sessions.seconds + excluded.seconds,
    updated_at = now();
$$;

create or replace view public.study_leaderboard as
select
  u.telegram_id,
  u.first_name,
  u.username,
  coalesce(sum(s.seconds), 0)::integer as seconds
from public.bot_users u
join public.study_sessions s on s.telegram_id = u.telegram_id
where u.is_banned = false
group by u.telegram_id, u.first_name, u.username
order by seconds desc;

alter table public.bot_users enable row level security;
alter table public.app_users enable row level security;
alter table public.study_sessions enable row level security;

revoke all on table public.bot_users from anon, authenticated;
revoke all on table public.app_users from anon, authenticated;
revoke all on table public.study_sessions from anon, authenticated;
revoke all on function public.record_study_time(bigint, text, integer) from anon, authenticated;
revoke all on table public.study_leaderboard from anon, authenticated;

comment on table public.bot_users is 'Telegram Mini App users; accessed server-side with SUPABASE_SERVICE_ROLE_KEY';
comment on table public.app_users is 'TNC app login users; accessed server-side with SUPABASE_SERVICE_ROLE_KEY';