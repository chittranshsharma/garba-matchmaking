-- Expand app from Delhi NCR to all of India.
-- Adds state, city, lat, lng columns and updates discover to sort by distance.

-- 1. Add new location columns
alter table public.profiles
  add column if not exists state text not null default 'Delhi',
  add column if not exists city  text not null default '',
  add column if not exists lat   double precision,
  add column if not exists lng   double precision;

-- 2. Backfill state from existing area values (Delhi NCR → Delhi)
update public.profiles set state = 'Delhi' where state = 'Delhi';

-- 3. Drop old strict area constraint and replace with a loose one
alter table public.profiles drop constraint if exists profiles_area_check;
alter table public.profiles add constraint profiles_area_check
  check (char_length(trim(area)) between 1 and 100);

-- 4. Drop old strict state constraint (none existed yet) — add a generous one
alter table public.profiles drop constraint if exists profiles_state_check;
alter table public.profiles add constraint profiles_state_check
  check (char_length(trim(state)) between 2 and 100);

-- 5. Update discover_profiles_v2 to:
--    • work with state-based filtering (p_state replaces p_area)
--    • return distance_km (haversine) when caller supplies coords
--    • sort nearest-first when coords provided, newest-first otherwise
create or replace function public.discover_profiles_v2(
  p_min_age  integer  default 18,
  p_max_age  integer  default 60,
  p_area     text     default null,   -- kept for backwards compat (ignored)
  p_state    text     default null,
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
    p.id,
    p.name,
    date_part('year', age(current_date, p.birth_date))::integer,
    p.gender,
    p.area,
    p.state,
    p.city,
    p.bio,
    p.photo_path,
    p.photo_paths,
    p.prompt_answers,
    case
      when p_lat is not null and p_lng is not null and p.lat is not null and p.lng is not null
      then round((
        6371 * acos(
          least(1.0, cos(radians(p_lat)) * cos(radians(p.lat)) *
          cos(radians(p.lng) - radians(p_lng)) +
          sin(radians(p_lat)) * sin(radians(p.lat)))
        )
      )::numeric, 1)::double precision
      else null
    end as distance_km
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
      then 6371 * acos(least(1.0, cos(radians(p_lat)) * cos(radians(p.lat)) * cos(radians(p.lng) - radians(p_lng)) + sin(radians(p_lat)) * sin(radians(p.lat))))
      else null
    end asc nulls last,
    p.created_at desc
  limit 50;
$$;
revoke all on function public.discover_profiles_v2(integer, integer, text, text, double precision, double precision) from public, anon, authenticated;
grant execute on function public.discover_profiles_v2(integer, integer, text, text, double precision, double precision) to authenticated;

-- 6. Update my_matches to return state + city instead of area
create or replace function public.my_matches()
returns table (id uuid, other_id uuid, other_name text, other_area text, other_state text, other_city text, other_photo_path text, created_at timestamptz)
language sql security definer set search_path = '' as $$
  select m.id, p.id, p.name, p.area, p.state, p.city, p.photo_path, m.created_at
  from public.matches m
  join public.profiles p on p.id = case when m.user_a = auth.uid() then m.user_b else m.user_a end
  where (m.user_a = auth.uid() or m.user_b = auth.uid())
    and not exists (select 1 from public.blocks b where (b.blocker_id = m.user_a and b.blocked_id = m.user_b) or (b.blocker_id = m.user_b and b.blocked_id = m.user_a))
  order by m.created_at desc;
$$;
revoke all on function public.my_matches() from public, anon, authenticated;
grant execute on function public.my_matches() to authenticated;
