-- =====================================================================
-- Internetrooms — Milestone 5, Phase 2
-- 3/3  Storage for published images and profile pictures
--
-- Effect: creates (or updates the limits of) two buckets and adds
-- storage.objects policies:
--   room-assets  PRIVATE. Readable only while the room is published as
--                public or unlisted (or by its owner). Served through
--                short-lived signed URLs, never public URLs.
--   avatars      public (profile pictures are public by design).
-- Uploads: owner only, into their own folder, PNG/JPEG/WebP, size
-- limited, unpredictable names, no overwriting (no update policy).
-- Destructive operations: none. Safe to run more than once.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('room-assets', 'room-assets', false, 5242880, array['image/png', 'image/jpeg', 'image/webp']),
  ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------
-- Helpers. SECURITY DEFINER so storage checks can see a room's state
-- even when the visitor cannot read the room row itself (unlisted).
-- They return only a boolean / the caller's own folder.
-- ---------------------------------------------------------------------
create or replace function public.room_asset_folder_is_readable(folder text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.rooms r
    where r.asset_folder::text = folder
      and (
        r.owner_id = auth.uid()
        or (r.published_at is not null and r.visibility in ('public', 'unlisted'))
      )
  );
$$;

create or replace function public.my_room_asset_folder()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select r.asset_folder::text from public.rooms r where r.owner_id = auth.uid();
$$;

revoke all on function public.room_asset_folder_is_readable(text) from public, anon, authenticated;
grant execute on function public.room_asset_folder_is_readable(text) to anon, authenticated;
revoke all on function public.my_room_asset_folder() from public, anon, authenticated;
grant execute on function public.my_room_asset_folder() to authenticated;

-- ---------------------------------------------------------------------
-- room-assets: <asset_folder>/<uuid>.<webp|png|jpg|jpeg>
-- ---------------------------------------------------------------------
drop policy if exists "Room assets: owners upload into their room folder" on storage.objects;
create policy "Room assets: owners upload into their room folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'room-assets'
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|png|jpg|jpeg)$'
    and split_part(name, '/', 1) = public.my_room_asset_folder()
  );

drop policy if exists "Room assets: readable while the room is" on storage.objects;
create policy "Room assets: readable while the room is"
  on storage.objects for select
  to anon, authenticated
  using (
    bucket_id = 'room-assets'
    and public.room_asset_folder_is_readable(split_part(name, '/', 1))
  );

drop policy if exists "Room assets: owners delete their own" on storage.objects;
create policy "Room assets: owners delete their own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'room-assets'
    and split_part(name, '/', 1) = public.my_room_asset_folder()
  );

-- ---------------------------------------------------------------------
-- avatars: <user id>/<uuid>.<webp|png|jpg|jpeg>
-- Public bucket: files are fetched by public URL; there is no select
-- policy, so the bucket can't be listed through the API.
-- ---------------------------------------------------------------------
drop policy if exists "Avatars: users upload into their own folder" on storage.objects;
create policy "Avatars: users upload into their own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f-]{36}\.(webp|png|jpg|jpeg)$')
  );

drop policy if exists "Avatars: users delete their own" on storage.objects;
create policy "Avatars: users delete their own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = (select auth.uid())::text
  );
