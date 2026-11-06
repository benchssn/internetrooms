-- =====================================================================
-- Internetrooms — Milestone 5, Phase 2
-- 2/3  Published rooms
--
-- Effect: creates public.rooms (one per owner), visibility and size
-- constraints, timestamps trigger, indexes, row level security, column
-- privileges and three narrowly scoped functions:
--   get_published_room(username, key)   visitor lookup
--   get_my_room_share_token()           owner's unlisted-link key
--   rotate_my_room_share_token()        owner replaces that key
-- Destructive operations: none. Unpublishing sets published_at to null
-- and keeps the room. Safe to run more than once.
-- =====================================================================

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  -- One published room per person for now.
  owner_id uuid not null unique references auth.users (id) on delete cascade,
  configuration jsonb not null,
  visibility text not null default 'private',
  -- Secret key for unlisted links (two v4 UUIDs: ~244 random bits).
  share_token text not null unique
    default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  -- Random storage folder for this room's images.
  asset_folder uuid not null unique default gen_random_uuid(),
  -- Null = not published (the room is kept, just not shown).
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint rooms_visibility_valid
    check (visibility in ('public', 'unlisted', 'private')),
  constraint rooms_configuration_object
    check (jsonb_typeof(configuration) = 'object'),
  constraint rooms_configuration_schema_version
    check (configuration -> 'schemaVersion' = '2'::jsonb),
  -- Generous for text + image references; images themselves live in Storage.
  constraint rooms_configuration_size
    check (octet_length(configuration::text) <= 262144)
);

-- For future discovery of public rooms only (unlisted rooms never appear).
create index if not exists rooms_public_published_idx
  on public.rooms (published_at desc)
  where visibility = 'public' and published_at is not null;

create or replace function public.rooms_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_at := now();
    if new.published_at is not null then
      new.published_at := now();
    end if;
  else
    -- Fixed for the life of the room.
    new.id := old.id;
    new.owner_id := old.owner_id;
    new.created_at := old.created_at;
    -- Only rotate_my_room_share_token() may change the key (clients also
    -- lack the column privilege).
    if coalesce(current_setting('internetrooms.rotating_share_token', true), '') <> 'on' then
      new.share_token := old.share_token;
    end if;
    new.asset_folder := old.asset_folder;
    -- Clients only say "published" or "not": the server sets the time.
    if new.published_at is not null then
      new.published_at := coalesce(old.published_at, now());
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists rooms_before_write on public.rooms;
create trigger rooms_before_write
  before insert or update on public.rooms
  for each row execute function public.rooms_before_write();

-- ---------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------
alter table public.rooms enable row level security;

drop policy if exists "Owners read their own room" on public.rooms;
create policy "Owners read their own room"
  on public.rooms for select
  to authenticated
  using ((select auth.uid()) = owner_id);

-- Unlisted and private rooms are deliberately NOT readable here, so they
-- can't be enumerated. Visitors with an unlisted link use
-- get_published_room(), which needs the exact key.
drop policy if exists "Published public rooms are readable" on public.rooms;
create policy "Published public rooms are readable"
  on public.rooms for select
  to anon, authenticated
  using (visibility = 'public' and published_at is not null);

drop policy if exists "Owners create their own room" on public.rooms;
create policy "Owners create their own room"
  on public.rooms for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Owners update their own room" on public.rooms;
create policy "Owners update their own room"
  on public.rooms for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

-- No delete policy: unpublishing is enough, nothing is destroyed.

-- share_token is never readable through the table, even for public rooms.
revoke all on public.rooms from anon, authenticated;
grant select (id, owner_id, configuration, visibility, asset_folder, published_at, created_at, updated_at)
  on public.rooms to anon, authenticated;
-- owner_id is included so upserts (ON CONFLICT DO UPDATE) work; the
-- policy and trigger stop it from ever changing.
grant insert (owner_id, configuration, visibility, published_at) on public.rooms to authenticated;
grant update (owner_id, configuration, visibility, published_at) on public.rooms to authenticated;

-- ---------------------------------------------------------------------
-- Visitor lookup: the only way to read a non-public room you don't own.
-- ---------------------------------------------------------------------
create or replace function public.get_published_room(p_username text, p_key text default null)
returns table (
  configuration jsonb,
  visibility text,
  is_published boolean,
  is_owner boolean,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.configuration,
    r.visibility,
    r.published_at is not null,
    r.owner_id = auth.uid(),
    r.updated_at
  from public.profiles p
  join public.rooms r on r.owner_id = p.id
  where p.username = lower(p_username)
    and (
      -- Owners can always see their own room (with its status).
      r.owner_id = auth.uid()
      or (r.published_at is not null and r.visibility = 'public')
      or (
        r.published_at is not null
        and r.visibility = 'unlisted'
        and p_key is not null
        and r.share_token = p_key
      )
    )
  limit 1;
$$;

create or replace function public.get_my_room_share_token()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select r.share_token from public.rooms r where r.owner_id = auth.uid();
$$;

-- Lets an owner invalidate an unlisted link that was shared too widely.
create or replace function public.rotate_my_room_share_token()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  next_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  -- Transaction-local flag that lets the trigger accept the new key.
  perform set_config('internetrooms.rotating_share_token', 'on', true);
  update public.rooms set share_token = next_token where owner_id = auth.uid();
  perform set_config('internetrooms.rotating_share_token', 'off', true);
  return next_token;
end;
$$;

-- Supabase grants EXECUTE on new public functions to anon and
-- authenticated by default, so revoke from them explicitly too.
revoke all on function public.rooms_before_write() from public, anon, authenticated;
revoke all on function public.get_published_room(text, text) from public, anon, authenticated;
grant execute on function public.get_published_room(text, text) to anon, authenticated;
revoke all on function public.get_my_room_share_token() from public, anon, authenticated;
grant execute on function public.get_my_room_share_token() to authenticated;
revoke all on function public.rotate_my_room_share_token() from public, anon, authenticated;
grant execute on function public.rotate_my_room_share_token() to authenticated;
