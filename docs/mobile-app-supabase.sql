-- TNC Nursing 2.0 mobile analytics and anonymous student profiles.
-- Run once in Supabase SQL Editor. Credentials remain on the API server only.

create table if not exists public.mobile_app_users (
  install_id text primary key check (length(install_id) between 6 and 100),
  display_name text not null default '',
  platform text not null default 'unknown',
  app_version text,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  is_blocked boolean not null default false,
  blocked_at timestamptz,
  blocked_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.mobile_app_events (
  id bigint generated always as identity primary key,
  install_id text not null references public.mobile_app_users(install_id) on delete cascade,
  event_type text not null check (event_type in ('open', 'lesson_complete')),
  session_id text,
  created_at timestamptz not null default now()
);

create index if not exists mobile_app_users_last_seen_idx
  on public.mobile_app_users (last_seen desc);
create index if not exists mobile_app_events_type_created_idx
  on public.mobile_app_events (event_type, created_at desc);
create index if not exists mobile_app_events_install_created_idx
  on public.mobile_app_events (install_id, created_at desc);
create unique index if not exists mobile_app_events_completed_once_idx
  on public.mobile_app_events (install_id, session_id)
  where event_type = 'lesson_complete' and session_id is not null;

alter table public.mobile_app_users enable row level security;
alter table public.mobile_app_events enable row level security;
revoke all on table public.mobile_app_users from anon, authenticated;
revoke all on table public.mobile_app_events from anon, authenticated;

create or replace function public.tnc_mobile_admin_stats()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'installs', (select count(*) from public.mobile_app_users),
    'opensToday', (
      select count(*) from public.mobile_app_events
      where event_type = 'open' and created_at >= date_trunc('day', now())
    ),
    'opensWeek', (
      select count(*) from public.mobile_app_events
      where event_type = 'open' and created_at >= now() - interval '7 days'
    ),
    'opensTotal', (
      select count(*) from public.mobile_app_events where event_type = 'open'
    ),
    'activeToday', (
      select count(distinct install_id) from public.mobile_app_events
      where event_type = 'open' and created_at >= date_trunc('day', now())
    ),
    'lessonsCompleted', (
      select count(*) from public.mobile_app_events where event_type = 'lesson_complete'
    )
  );
$$;

revoke all on function public.tnc_mobile_admin_stats() from public, anon, authenticated;
grant execute on function public.tnc_mobile_admin_stats() to service_role;

comment on table public.mobile_app_users is
  'Pseudonymous mobile installs and chosen display name; raw IP and hardware identifiers are not stored.';
comment on table public.mobile_app_events is
  'Mobile app opens and lesson completion events used for aggregate admin analytics.';