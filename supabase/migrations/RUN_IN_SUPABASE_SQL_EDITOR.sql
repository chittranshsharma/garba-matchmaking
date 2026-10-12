-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/vdmhfbftbamvqsofkxyr/sql/new

-- Drop ALL versions of discover_profiles_v2 (clean slate)
drop function if exists public.discover_profiles_v2(integer, integer, text);
drop function if exists public.discover_profiles_v2(integer, integer, text, text, double precision, double precision);

-- Create new discover function with India / state / GPS distance support
create function public.discover_profiles_v2(
  p_min_age  integer          default 18,
  p_max_age  integer          default 60,
  p_area     text             default null,
  p_state    text             default null,
  p_lat      double precision default null,
  p_lng      double precision default null
)
returns table (
  id             uuid,
  name           text,
  age            integer,
  gender         text,
  area           text,
  state          text,
  city           text,
  bio            text,
  photo_path     text,
  photo_paths    text[],
  prompt_answers jsonb,
  distance_km    double precision
)
language sql security definer set search_path = '' as $$
  select
    p.id, p.name,
    date_part('year', age(current_date, p.birth_date))::integer,
    p.gender, p.area, p.state, p.city, p.bio, p.photo_path, p.photo_paths, p.prompt_answers,
    case
      when p_lat is not null and p_lng is not null and p.lat is not null and p.lng is not null
      then round((6371 * acos(least(1.0,
        cos(radians(p_lat)) * cos(radians(p.lat)) * cos(radians(p.lng) - radians(p_lng)) +
        sin(radians(p_lat)) * sin(radians(p.lat))
      )))::numeric, 1)::double precision
      else null
    end
  from public.profiles p
  join public.profiles me on me.id = auth.uid()
  where p.id <> me.id
    and p.gender = any(me.interested_in)
    and me.gender = any(p.interested_in)
    and date_part('year', age(current_date, p.birth_date)) between greatest(18, p_min_age) and least(100, p_max_age)
    and (p_state is null or p.state = p_state)
    and not exists (select 1 from public.swipes s where s.actor_id = me.id and s.target_id = p.id)
    and not exists (select 1 from public.blocks b where (b.blocker_id = me.id and b.blocked_id = p.id) or (b.blocker_id = p.id and b.blocked_id = me.id))
  order by
    case
      when p_lat is not null and p_lng is not null and p.lat is not null and p.lng is not null
      then 6371 * acos(least(1.0,
        cos(radians(p_lat)) * cos(radians(p.lat)) * cos(radians(p.lng) - radians(p_lng)) +
        sin(radians(p_lat)) * sin(radians(p.lat))
      ))
      else null
    end asc nulls last,
    p.created_at desc
  limit 50;
$$;

revoke all on function public.discover_profiles_v2(integer,integer,text,text,double precision,double precision) from public, anon, authenticated;
grant execute on function public.discover_profiles_v2(integer,integer,text,text,double precision,double precision) to authenticated;

-- Drop and recreate my_matches with state + city columns
drop function if exists public.my_matches();

create function public.my_matches()
returns table (
  id               uuid,
  other_id         uuid,
  other_name       text,
  other_area       text,
  other_state      text,
  other_city       text,
  other_photo_path text,
  created_at       timestamptz
)
language sql security definer set search_path = '' as $$
  select m.id, p.id, p.name, p.area, p.state, p.city, p.photo_path, m.created_at
  from public.matches m
  join public.profiles p on p.id = case when m.user_a = auth.uid() then m.user_b else m.user_a end
  where (m.user_a = auth.uid() or m.user_b = auth.uid())
    and not exists (select 1 from public.blocks b
      where (b.blocker_id = m.user_a and b.blocked_id = m.user_b)
         or (b.blocker_id = m.user_b and b.blocked_id = m.user_a))
  order by m.created_at desc;
$$;

revoke all on function public.my_matches() from public, anon, authenticated;
grant execute on function public.my_matches() to authenticated;
