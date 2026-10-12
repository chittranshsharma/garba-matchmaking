-- Show only actionable incoming likes to the signed-in profile owner.
create or replace function public.my_likes()
returns table (id uuid, name text, age integer, gender text, area text, bio text, photo_path text, photo_paths text[], prompt_answers jsonb, liked_at timestamptz)
language sql security definer set search_path = '' as $$
  select p.id, p.name, date_part('year', age(current_date, p.birth_date))::integer,
    p.gender, p.area, p.bio, p.photo_path, p.photo_paths, p.prompt_answers, s.created_at
  from public.swipes s
  join public.profiles me on me.id = auth.uid() and s.target_id = me.id
  join public.profiles p on p.id = s.actor_id
  where s.liked
    and p.gender = any(me.interested_in)
    and me.gender = any(p.interested_in)
    and not exists (select 1 from public.swipes mine where mine.actor_id = me.id and mine.target_id = p.id)
    and not exists (select 1 from public.blocks b where (b.blocker_id = me.id and b.blocked_id = p.id) or (b.blocker_id = p.id and b.blocked_id = me.id))
  order by s.created_at desc
  limit 50;
$$;
revoke all on function public.my_likes() from public, anon, authenticated;
grant execute on function public.my_likes() to authenticated;

create policy "delete own profile" on public.profiles for delete to authenticated
  using (id = (select auth.uid()));
