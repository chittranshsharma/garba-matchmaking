-- Run once in the Supabase SQL editor. The app uses only the publishable key.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 40),
  birth_date date not null,
  gender text not null check (gender in ('Man', 'Woman', 'Non-binary', 'Other')),
  interested_in text[] not null check (array_length(interested_in, 1) between 1 and 4 and interested_in <@ array['Man','Woman','Non-binary','Other']::text[]),
  area text not null check (area in ('Delhi', 'Noida', 'Gurugram', 'Ghaziabad', 'Faridabad')),
  bio text not null default '' check (char_length(bio) <= 240),
  photo_path text,
  photo_paths text[] not null default '{}' check (cardinality(photo_paths) <= 3),
  prompt_answers jsonb not null default '[]'::jsonb check (jsonb_typeof(prompt_answers) = 'array' and jsonb_array_length(prompt_answers) <= 3),
  created_at timestamptz not null default now()
);

create table public.swipes (
  actor_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  liked boolean not null,
  created_at timestamptz not null default now(),
  primary key (actor_id, target_id),
  check (actor_id <> target_id)
);
create index swipes_target_liked on public.swipes (target_id, actor_id) where liked;

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_a, user_b),
  check (user_a < user_b)
);
create index matches_user_b on public.matches (user_b, created_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index messages_match_time on public.messages (match_id, created_at desc);

create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (char_length(trim(reason)) between 5 and 500),
  created_at timestamptz not null default now(),
  check (reporter_id <> reported_id)
);

alter table public.profiles enable row level security;
alter table public.swipes enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;

create policy "read own profile" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "create own profile" on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy "update own profile" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "read own matches" on public.matches for select to authenticated using (
  (user_a = (select auth.uid()) or user_b = (select auth.uid()))
  and not exists (select 1 from public.blocks b where (b.blocker_id = user_a and b.blocked_id = user_b) or (b.blocker_id = user_b and b.blocked_id = user_a))
);
create policy "read matched messages" on public.messages for select to authenticated using (
  exists (select 1 from public.matches m where m.id = match_id and (m.user_a = (select auth.uid()) or m.user_b = (select auth.uid()))
    and not exists (select 1 from public.blocks b where (b.blocker_id = m.user_a and b.blocked_id = m.user_b) or (b.blocker_id = m.user_b and b.blocked_id = m.user_a)))
);
create policy "send matched messages" on public.messages for insert to authenticated with check (
  sender_id = (select auth.uid()) and exists (select 1 from public.matches m where m.id = match_id and (m.user_a = (select auth.uid()) or m.user_b = (select auth.uid()))
    and not exists (select 1 from public.blocks b where (b.blocker_id = m.user_a and b.blocked_id = m.user_b) or (b.blocker_id = m.user_b and b.blocked_id = m.user_a)))
);
create policy "block another user" on public.blocks for insert to authenticated with check (blocker_id = (select auth.uid()));
create policy "read relevant blocks" on public.blocks for select to authenticated using (blocker_id = (select auth.uid()) or blocked_id = (select auth.uid()));
create policy "report another user" on public.reports for insert to authenticated with check (reporter_id = (select auth.uid()));
create policy "read own reports" on public.reports for select to authenticated using (reporter_id = (select auth.uid()));

-- RLS keeps birth dates private. Discovery exposes only calculated age.
create or replace function public.discover_profiles(p_min_age integer default 18, p_max_age integer default 60, p_area text default null)
returns table (id uuid, name text, age integer, gender text, area text, bio text, photo_path text)
language sql security definer set search_path = '' as $$
  select p.id, p.name, date_part('year', age(current_date, p.birth_date))::integer, p.gender, p.area, p.bio, p.photo_path
  from public.profiles p
  join public.profiles me on me.id = auth.uid()
  where p.id <> me.id
    and p.gender = any(me.interested_in)
    and me.gender = any(p.interested_in)
    and date_part('year', age(current_date, p.birth_date)) between greatest(18, p_min_age) and least(100, p_max_age)
    and (p_area is null or p.area = p_area)
    and not exists (select 1 from public.swipes s where s.actor_id = me.id and s.target_id = p.id)
    and not exists (select 1 from public.blocks b where (b.blocker_id = me.id and b.blocked_id = p.id) or (b.blocker_id = p.id and b.blocked_id = me.id))
  order by p.created_at desc
  limit 30;
$$;

create or replace function public.swipe_profile(p_target uuid, p_liked boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_match uuid;
begin
  if v_me is null or v_me = p_target or not exists (select 1 from public.profiles where id = v_me) then
    raise exception 'Profile required';
  end if;
  if not exists (select 1 from public.profiles p join public.profiles me on me.id = v_me
      where p.id = p_target and p.gender = any(me.interested_in) and me.gender = any(p.interested_in))
    or exists (select 1 from public.blocks b where (b.blocker_id = v_me and b.blocked_id = p_target) or (b.blocker_id = p_target and b.blocked_id = v_me)) then
    raise exception 'Profile unavailable';
  end if;
  -- Serialize swipes for a pair so simultaneous likes still create a match.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(least(v_me, p_target)::text || greatest(v_me, p_target)::text, 0));
  insert into public.swipes (actor_id, target_id, liked) values (v_me, p_target, p_liked)
    on conflict (actor_id, target_id) do update set liked = excluded.liked, created_at = now();
  if p_liked and exists (select 1 from public.swipes where actor_id = p_target and target_id = v_me and liked) then
    insert into public.matches (user_a, user_b) values (least(v_me, p_target), greatest(v_me, p_target))
      on conflict (user_a, user_b) do update set created_at = public.matches.created_at
      returning id into v_match;
  end if;
  return v_match;
end;
$$;

create or replace function public.my_matches()
returns table (id uuid, other_id uuid, other_name text, other_area text, other_photo_path text, created_at timestamptz)
language sql security definer set search_path = '' as $$
  select m.id, p.id, p.name, p.area, p.photo_path, m.created_at
  from public.matches m
  join public.profiles p on p.id = case when m.user_a = auth.uid() then m.user_b else m.user_a end
  where (m.user_a = auth.uid() or m.user_b = auth.uid())
    and not exists (select 1 from public.blocks b where (b.blocker_id = m.user_a and b.blocked_id = m.user_b) or (b.blocker_id = m.user_b and b.blocked_id = m.user_a))
  order by m.created_at desc;
$$;

revoke all on function public.discover_profiles(integer, integer, text) from public;
revoke all on function public.swipe_profile(uuid, boolean) from public;
revoke all on function public.my_matches() from public;
grant execute on function public.discover_profiles(integer, integer, text) to authenticated;
grant execute on function public.swipe_profile(uuid, boolean) to authenticated;
grant execute on function public.my_matches() to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 2097152, array['image/jpeg'])
on conflict (id) do nothing;
create policy "signed in users can view photos" on storage.objects for select to authenticated using (bucket_id = 'profile-photos');
create policy "upload own photo" on storage.objects for insert to authenticated with check (
  bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy "delete own photo" on storage.objects for delete to authenticated using (
  bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text
);

alter publication supabase_realtime add table public.messages;

-- Explicit grants and foreign-key indexes used by the production project.
revoke execute on function public.discover_profiles(integer, integer, text) from public, anon, authenticated;
revoke execute on function public.swipe_profile(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.my_matches() from public, anon, authenticated;
grant execute on function public.discover_profiles(integer, integer, text) to authenticated;
grant execute on function public.swipe_profile(uuid, boolean) to authenticated;
grant execute on function public.my_matches() to authenticated;
create index if not exists blocks_blocked_id_idx on public.blocks (blocked_id);
create index if not exists messages_sender_id_idx on public.messages (sender_id);
create index if not exists reports_reporter_id_idx on public.reports (reporter_id);
create index if not exists reports_reported_id_idx on public.reports (reported_id);

-- Discovery v2 includes the profile stories, while still keeping exact birth dates private.
create or replace function public.discover_profiles_v2(p_min_age integer default 18, p_max_age integer default 60, p_area text default null)
returns table (id uuid, name text, age integer, gender text, area text, bio text, photo_path text, photo_paths text[], prompt_answers jsonb)
language sql security definer set search_path = '' as $$
  select p.id, p.name, date_part('year', age(current_date, p.birth_date))::integer, p.gender, p.area, p.bio, p.photo_path, p.photo_paths, p.prompt_answers
  from public.profiles p
  join public.profiles me on me.id = auth.uid()
  where p.id <> me.id
    and p.gender = any(me.interested_in)
    and me.gender = any(p.interested_in)
    and date_part('year', age(current_date, p.birth_date)) between greatest(18, p_min_age) and least(100, p_max_age)
    and (p_area is null or p.area = p_area)
    and not exists (select 1 from public.swipes s where s.actor_id = me.id and s.target_id = p.id)
    and not exists (select 1 from public.blocks b where (b.blocker_id = me.id and b.blocked_id = p.id) or (b.blocker_id = p.id and b.blocked_id = me.id))
  order by p.created_at desc
  limit 30;
$$;
revoke all on function public.discover_profiles_v2(integer, integer, text) from public, anon, authenticated;
grant execute on function public.discover_profiles_v2(integer, integer, text) to authenticated;
