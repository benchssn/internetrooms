-- =====================================================================
-- Internetrooms — Milestone 5, Phase 2
-- 1/3  Profiles: one public identity per account
--
-- Effect: creates public.profiles, its username rules, an updated_at
-- trigger, row level security and column privileges.
-- Destructive operations: none. Safe to run more than once.
-- =====================================================================

-- Usernames that would clash with site routes or imply authority.
create or replace function public.is_reserved_username(candidate text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select lower(candidate) = any (array[
    'about', 'account', 'accounts', 'admin', 'administrator', 'api', 'app',
    'assets', 'auth', 'blog', 'callback', 'dashboard', 'edit', 'editor',
    'explore', 'forgot-password', 'help', 'home', 'internetrooms', 'login',
    'logout', 'me', 'mod', 'moderator', 'new', 'null', 'official', 'owner',
    'privacy', 'profile', 'profiles', 'register', 'reset-password', 'room',
    'rooms', 'root', 'security', 'settings', 'signin', 'signout', 'signup',
    'staff', 'static', 'support', 'supabase-test', 'system', 'templates',
    'terms', 'u', 'undefined', 'user', 'users', 'www'
  ]);
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  display_name text,
  bio text,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- 3–24 characters: lowercase letters, numbers, underscores and hyphens.
  -- Lowercase-only storage makes uniqueness case-insensitive.
  constraint profiles_username_format
    check (username ~ '^[a-z0-9_-]{3,24}$'),
  constraint profiles_username_not_reserved
    check (not public.is_reserved_username(username)),
  constraint profiles_display_name_length
    check (display_name is null or char_length(display_name) <= 50),
  constraint profiles_bio_length
    check (bio is null or char_length(bio) <= 500),
  -- Avatars may only point inside the owner's own folder.
  constraint profiles_avatar_path_owner
    check (
      avatar_path is null
      or avatar_path ~ ('^' || id::text || '/[0-9a-f-]{36}\.(webp|png|jpg|jpeg)$')
    )
);

-- Belt and braces: uniqueness ignoring case even if the format rule changes.
create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username));

-- Keep timestamps honest whatever the client sends.
create or replace function public.profiles_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    new.id := old.id;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_before_write on public.profiles;
create trigger profiles_before_write
  before insert or update on public.profiles
  for each row execute function public.profiles_before_write();

-- ---------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "Profiles are readable by everyone" on public.profiles;
create policy "Profiles are readable by everyone"
  on public.profiles for select
  to anon, authenticated
  using (true);

drop policy if exists "Users create their own profile" on public.profiles;
create policy "Users create their own profile"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "Users update their own profile" on public.profiles;
create policy "Users update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- No delete policy: profiles are removed only when the account is deleted.

-- Column privileges: nobody can write id (after insert) or timestamps.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant insert (id, username, display_name, bio, avatar_path) on public.profiles to authenticated;
grant update (username, display_name, bio, avatar_path) on public.profiles to authenticated;

-- Supabase grants EXECUTE on new public functions to anon and
-- authenticated by default, so revoke from them explicitly too.
revoke all on function public.profiles_before_write() from public, anon, authenticated;
revoke all on function public.is_reserved_username(text) from public, anon, authenticated;
grant execute on function public.is_reserved_username(text) to anon, authenticated;
