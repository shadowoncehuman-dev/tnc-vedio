-- Run once to clear this week's leaderboard stats and enable Monday resets.
-- Study history before this week and lifetime bot-user totals are preserved.

begin;

delete from public.study_sessions
where study_date >= date_trunc('week', current_date)::date;

delete from public.website_study_sessions
where study_date >= date_trunc('week', current_date)::date;

create or replace view public.study_leaderboard as
select
  'telegram_' || u.telegram_id::text as participant_id,
  coalesce(nullif(trim(u.first_name), ''), 'Telegram Student') as first_name,
  u.username,
  coalesce(sum(s.seconds), 0)::integer as seconds,
  count(s.id)::integer as sessions
from public.bot_users u
left join public.study_sessions s
  on s.telegram_id = u.telegram_id
  and s.study_date >= date_trunc('week', current_date)::date
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
where w.study_date >= date_trunc('week', current_date)::date
group by w.visitor_id
order by seconds desc;

commit;
