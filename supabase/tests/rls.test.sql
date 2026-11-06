-- Database security tests for the Phase 2 migrations.
-- Run with: npm run test:db   (see scripts/test-db.sh)
-- Each check raises an exception (stopping the run) if it fails.

-- ---------------------------------------------------------------------
-- Test helpers
-- ---------------------------------------------------------------------
create schema test;
grant usage on schema test to anon, authenticated;

create function test.pass(label text) returns void language plpgsql as $$
begin
  perform set_config('test.passed', (coalesce(nullif(current_setting('test.passed', true), ''), '0')::int + 1)::text, false);
  raise notice 'ok - %', label;
end $$;

-- Act as a visitor (null) or a signed-in user, like PostgREST does.
create function test.act_as(uid uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false);
  if uid is null then execute 'set role anon'; else execute 'set role authenticated'; end if;
end $$;

create function test.ok(label text, stmt text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    raise exception 'FAIL - %: unexpected error % (%)', label, sqlerrm, sqlstate;
  end;
  perform test.pass(label);
end $$;

create function test.fails(label text, stmt text, expected_state text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if sqlstate = expected_state then
      perform test.pass(label);
      return;
    end if;
    raise exception 'FAIL - %: expected SQLSTATE % but got % (%)', label, expected_state, sqlstate, sqlerrm;
  end;
  raise exception 'FAIL - %: expected SQLSTATE % but the statement succeeded', label, expected_state;
end $$;

create function test.affects(label text, stmt text, expected int) returns void language plpgsql as $$
declare n int;
begin
  execute stmt;
  get diagnostics n = row_count;
  if n <> expected then
    raise exception 'FAIL - %: expected % row(s) affected, got %', label, expected, n;
  end if;
  perform test.pass(label);
end $$;

create function test.count_is(label text, query text, expected int) returns void language plpgsql as $$
declare n int;
begin
  execute format('select count(*) from (%s) q', query) into n;
  if n <> expected then
    raise exception 'FAIL - %: expected % row(s), got %', label, expected, n;
  end if;
  perform test.pass(label);
end $$;

create function test.value_is(label text, query text, expected text) returns void language plpgsql as $$
declare v text;
begin
  execute query into v;
  if v is distinct from expected then
    raise exception 'FAIL - %: expected %, got %', label, coalesce(expected, 'NULL'), coalesce(v, 'NULL');
  end if;
  perform test.pass(label);
end $$;

grant execute on all functions in schema test to anon, authenticated;

-- Users (as the database owner, like Supabase Auth would).
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'alice@example.com'),
  ('22222222-2222-4222-8222-222222222222', 'bob@example.com'),
  ('33333333-3333-4333-8333-333333333333', 'carol@example.com');

\set alice '11111111-1111-4111-8111-111111111111'
\set bob '22222222-2222-4222-8222-222222222222'
\set carol '33333333-3333-4333-8333-333333333333'

-- =====================================================================
-- Profiles
-- =====================================================================
select test.act_as(null);
select test.fails('visitors cannot create profiles',
  $q$insert into public.profiles (id, username) values ('11111111-1111-4111-8111-111111111111', 'alice')$q$, '42501');

select test.act_as(:'alice');
select test.fails('cannot create a profile for someone else',
  $q$insert into public.profiles (id, username) values ('22222222-2222-4222-8222-222222222222', 'notbob')$q$, '42501');
select test.ok('first-login setup creates your own profile',
  $q$insert into public.profiles (id, username, display_name, bio) values ('11111111-1111-4111-8111-111111111111', 'alice', 'Alice', 'hello')$q$);
select test.fails('a second profile for the same user is rejected',
  $q$insert into public.profiles (id, username) values ('11111111-1111-4111-8111-111111111111', 'alice2')$q$, '23505');

select test.act_as(:'bob');
select test.fails('duplicate usernames are rejected',
  $q$insert into public.profiles (id, username) values ('22222222-2222-4222-8222-222222222222', 'alice')$q$, '23505');
select test.fails('uppercase usernames are rejected (uniqueness is case-insensitive)',
  $q$insert into public.profiles (id, username) values ('22222222-2222-4222-8222-222222222222', 'ALICE')$q$, '23514');
select test.fails('usernames shorter than 3 characters are rejected',
  $q$insert into public.profiles (id, username) values ('22222222-2222-4222-8222-222222222222', 'ab')$q$, '23514');
select test.fails('usernames longer than 24 characters are rejected',
  $q$insert into public.profiles (id, username) values ('22222222-2222-4222-8222-222222222222', 'abcdefghijklmnopqrstuvwxy')$q$, '23514');
select test.fails('usernames with spaces are rejected',
  $q$insert into public.profiles (id, username) values ('22222222-2222-4222-8222-222222222222', 'bob smith')$q$, '23514');
select test.fails('usernames with other symbols are rejected',
  $q$insert into public.profiles (id, username) values ('22222222-2222-4222-8222-222222222222', 'bob.smith')$q$, '23514');
select test.fails('reserved usernames are rejected (admin)',
  $q$insert into public.profiles (id, username) values ('22222222-2222-4222-8222-222222222222', 'admin')$q$, '23514');
select test.fails('reserved usernames are rejected (settings)',
  $q$insert into public.profiles (id, username) values ('22222222-2222-4222-8222-222222222222', 'settings')$q$, '23514');
select test.fails('display names over 50 characters are rejected',
  format($q$insert into public.profiles (id, username, display_name) values ('22222222-2222-4222-8222-222222222222', 'bob', %L)$q$, repeat('x', 51)), '23514');
select test.fails('an avatar path in someone else''s folder is rejected',
  $q$insert into public.profiles (id, username, avatar_path) values ('22222222-2222-4222-8222-222222222222', 'bob', '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp')$q$, '23514');
select test.ok('bob creates his own profile with valid values',
  $q$insert into public.profiles (id, username, avatar_path) values ('22222222-2222-4222-8222-222222222222', 'bob_2-b', '22222222-2222-4222-8222-222222222222/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp')$q$);

select test.affects('users cannot update someone else''s profile',
  $q$update public.profiles set display_name = 'hacked' where id = '11111111-1111-4111-8111-111111111111'$q$, 0);
select test.affects('users can update their own profile',
  $q$update public.profiles set display_name = 'Bob', bio = 'my room' where id = '22222222-2222-4222-8222-222222222222'$q$, 1);
select test.fails('users cannot change their profile id',
  $q$update public.profiles set id = '33333333-3333-4333-8333-333333333333' where id = '22222222-2222-4222-8222-222222222222'$q$, '42501');
select test.fails('users cannot change created_at',
  $q$update public.profiles set created_at = '2000-01-01' where id = '22222222-2222-4222-8222-222222222222'$q$, '42501');
select test.fails('users cannot take a username already in use',
  $q$update public.profiles set username = 'alice' where id = '22222222-2222-4222-8222-222222222222'$q$, '23505');
select test.affects('users can change their username',
  $q$update public.profiles set username = 'bobby' where id = '22222222-2222-4222-8222-222222222222'$q$, 1);
select test.fails('users cannot delete profiles',
  $q$delete from public.profiles where id = '22222222-2222-4222-8222-222222222222'$q$, '42501');

select test.act_as(null);
select test.count_is('visitors can read public profile fields',
  $q$select username, display_name, bio, avatar_path from public.profiles$q$, 2);
select test.value_is('the username change is visible',
  $q$select username from public.profiles where id = '22222222-2222-4222-8222-222222222222'$q$, 'bobby');
select test.fails('visitors cannot update profiles (no privilege at all)',
  $q$update public.profiles set bio = 'x'$q$, '42501');

-- =====================================================================
-- Rooms
-- =====================================================================
select test.act_as(:'alice');
select test.fails('cannot create a room for someone else',
  $q$insert into public.rooms (owner_id, configuration) values ('22222222-2222-4222-8222-222222222222', '{"schemaVersion": 2}')$q$, '42501');
select test.fails('room configurations must be schema version 2',
  $q$insert into public.rooms (owner_id, configuration) values ('11111111-1111-4111-8111-111111111111', '{"schemaVersion": 1}')$q$, '23514');
select test.fails('room configurations must be objects',
  $q$insert into public.rooms (owner_id, configuration) values ('11111111-1111-4111-8111-111111111111', '[2]')$q$, '23514');
select test.fails('oversized room configurations are rejected',
  format($q$insert into public.rooms (owner_id, configuration) values ('11111111-1111-4111-8111-111111111111', jsonb_build_object('schemaVersion', 2, 'blob', %L))$q$, repeat('x', 270000)), '23514');
select test.fails('unknown visibility values are rejected',
  $q$insert into public.rooms (owner_id, configuration, visibility) values ('11111111-1111-4111-8111-111111111111', '{"schemaVersion": 2}', 'friends')$q$, '23514');
select test.ok('owners create their own (unpublished, private) room',
  $q$insert into public.rooms (owner_id, configuration, visibility) values ('11111111-1111-4111-8111-111111111111', '{"schemaVersion": 2, "title": "draft"}', 'private')$q$);
select test.fails('one room per owner',
  $q$insert into public.rooms (owner_id, configuration) values ('11111111-1111-4111-8111-111111111111', '{"schemaVersion": 2}')$q$, '23505');
select test.ok('owners upsert (publish) their room',
  $q$insert into public.rooms (owner_id, configuration, visibility, published_at)
     values ('11111111-1111-4111-8111-111111111111', '{"schemaVersion": 2, "title": "alice room"}', 'public', '2000-01-01')
     on conflict (owner_id) do update set configuration = excluded.configuration, visibility = excluded.visibility, published_at = excluded.published_at$q$);
select test.value_is('publish time is set by the server, not the client',
  $q$select (published_at > now() - interval '1 minute')::text from public.rooms where owner_id = '11111111-1111-4111-8111-111111111111'$q$, 'true');
select test.fails('the share token cannot be read through the table',
  $q$select share_token from public.rooms$q$, '42501');
select test.fails('the share token cannot be written directly',
  $q$update public.rooms set share_token = 'guessable' where owner_id = '11111111-1111-4111-8111-111111111111'$q$, '42501');
select test.affects('changing owner_id is ignored (the room stays with its owner)',
  $q$update public.rooms set owner_id = '22222222-2222-4222-8222-222222222222' where owner_id = '11111111-1111-4111-8111-111111111111'$q$, 1);
select test.count_is('… and it still belongs to alice',
  $q$select 1 from public.rooms where owner_id = '11111111-1111-4111-8111-111111111111'$q$, 1);

select test.act_as(:'bob');
select test.affects('others cannot update a room',
  $q$update public.rooms set visibility = 'private' where owner_id = '11111111-1111-4111-8111-111111111111'$q$, 0);
select test.fails('others cannot overwrite a room by upserting with its owner id',
  $q$insert into public.rooms (owner_id, configuration) values ('11111111-1111-4111-8111-111111111111', '{"schemaVersion": 2, "title": "pwned"}')
     on conflict (owner_id) do update set configuration = excluded.configuration$q$, '42501');
select test.fails('rooms cannot be deleted through the API',
  $q$delete from public.rooms where owner_id = '22222222-2222-4222-8222-222222222222'$q$, '42501');

-- Public
select test.act_as(null);
select test.count_is('visitors can read a published public room',
  $q$select configuration from public.rooms$q$, 1);
select test.count_is('visitors can load it by username',
  $q$select * from public.get_published_room('alice')$q$, 1);
select test.count_is('username lookup is case-insensitive',
  $q$select * from public.get_published_room('ALICE')$q$, 1);
select test.value_is('the configuration is the published one',
  $q$select configuration ->> 'title' from public.get_published_room('alice')$q$, 'alice room');

-- Unlisted
select test.act_as(:'alice');
select test.affects('owners can change visibility to unlisted',
  $q$update public.rooms set visibility = 'unlisted' where owner_id = '11111111-1111-4111-8111-111111111111'$q$, 1);
select test.value_is('owners can get their unlisted-link key',
  $q$select length(public.get_my_room_share_token())::text$q$, '64');
select public.get_my_room_share_token() as alice_key \gset

select test.act_as(null);
select test.count_is('unlisted rooms cannot be listed through the table',
  $q$select 1 from public.rooms$q$, 0);
select test.count_is('unlisted rooms are not returned without the key',
  $q$select * from public.get_published_room('alice')$q$, 0);
select test.count_is('unlisted rooms are not returned with a wrong key',
  $q$select * from public.get_published_room('alice', 'not-the-key')$q$, 0);
select test.count_is('unlisted rooms are returned with the exact key',
  format($q$select * from public.get_published_room('alice', %L)$q$, :'alice_key'), 1);
select test.fails('visitors cannot read anyone''s key',
  $q$select public.get_my_room_share_token()$q$, '42501');

select test.act_as(:'bob');
select test.count_is('other users cannot list unlisted rooms either',
  $q$select 1 from public.rooms where owner_id = '11111111-1111-4111-8111-111111111111'$q$, 0);
select test.value_is('another user''s key lookup returns only their own (none)',
  $q$select public.get_my_room_share_token()$q$, null);

select test.act_as(:'alice');
select test.ok('owners can rotate their unlisted-link key',
  $q$select public.rotate_my_room_share_token()$q$);
select test.act_as(null);
select test.count_is('the old key stops working after rotation',
  format($q$select * from public.get_published_room('alice', %L)$q$, :'alice_key'), 0);

-- Private
select test.act_as(:'alice');
select public.get_my_room_share_token() as alice_key2 \gset
select test.affects('owners can make the room private',
  $q$update public.rooms set visibility = 'private' where owner_id = '11111111-1111-4111-8111-111111111111'$q$, 1);
select test.act_as(null);
select test.count_is('private rooms are hidden from visitors',
  $q$select * from public.get_published_room('alice')$q$, 0);
select test.count_is('private rooms are hidden even with the key',
  format($q$select * from public.get_published_room('alice', %L)$q$, :'alice_key2'), 0);
select test.act_as(:'bob');
select test.count_is('private rooms are hidden from other users',
  $q$select * from public.get_published_room('alice')$q$, 0);
select test.act_as(:'alice');
select test.value_is('owners can still see their private room',
  $q$select is_owner::text from public.get_published_room('alice')$q$, 'true');

-- Unpublish / republish
select test.affects('owners can unpublish (public room)',
  $q$update public.rooms set visibility = 'public', published_at = null where owner_id = '11111111-1111-4111-8111-111111111111'$q$, 1);
select test.act_as(null);
select test.count_is('unpublished rooms are hidden from visitors',
  $q$select * from public.get_published_room('alice')$q$, 0);
select test.act_as(:'alice');
select test.value_is('unpublishing keeps the room and its configuration',
  $q$select configuration ->> 'title' from public.rooms where owner_id = '11111111-1111-4111-8111-111111111111'$q$, 'alice room');
select test.affects('owners can republish',
  $q$update public.rooms set published_at = now() where owner_id = '11111111-1111-4111-8111-111111111111'$q$, 1);
select test.act_as(null);
select test.count_is('republished rooms are visible again',
  $q$select * from public.get_published_room('alice')$q$, 1);

-- Bob: a public room for the storage tests
select test.act_as(:'bob');
select test.ok('bob publishes a public room',
  $q$insert into public.rooms (owner_id, configuration, visibility, published_at) values ('22222222-2222-4222-8222-222222222222', '{"schemaVersion": 2}', 'public', now())$q$);
select test.count_is('rooms are found under a changed username',
  $q$select * from public.get_published_room('bobby')$q$, 1);
select test.count_is('… and not under the old one',
  $q$select * from public.get_published_room('bob_2-b')$q$, 0);

-- =====================================================================
-- Storage
-- =====================================================================
reset role;
select asset_folder as alice_folder from public.rooms where owner_id = :'alice' \gset
select asset_folder as bob_folder from public.rooms where owner_id = :'bob' \gset

select test.act_as(:'carol');
select test.fails('users without a room cannot upload room images',
  format($q$insert into storage.objects (bucket_id, name) values ('room-assets', %L)$q$, :'alice_folder' || '/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1.webp'), '42501');

select test.act_as(:'alice');
select test.ok('owners upload into their room folder',
  format($q$insert into storage.objects (bucket_id, name) values ('room-assets', %L)$q$, :'alice_folder' || '/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1.webp'));
select test.fails('owners cannot upload into someone else''s folder',
  format($q$insert into storage.objects (bucket_id, name) values ('room-assets', %L)$q$, :'bob_folder' || '/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2.webp'), '42501');
select test.fails('SVG uploads are rejected',
  format($q$insert into storage.objects (bucket_id, name) values ('room-assets', %L)$q$, :'alice_folder' || '/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3.svg'), '42501');
select test.fails('path traversal is rejected',
  format($q$insert into storage.objects (bucket_id, name) values ('room-assets', %L)$q$, :'alice_folder' || '/../' || :'bob_folder' || '/x.webp'), '42501');
select test.fails('nested folders are rejected',
  format($q$insert into storage.objects (bucket_id, name) values ('room-assets', %L)$q$, :'alice_folder' || '/sub/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4.webp'), '42501');
select test.fails('predictable file names are rejected',
  format($q$insert into storage.objects (bucket_id, name) values ('room-assets', %L)$q$, :'alice_folder' || '/photo.webp'), '42501');
select test.affects('existing images cannot be overwritten',
  $q$update storage.objects set name = name where bucket_id = 'room-assets'$q$, 0);

select test.act_as(:'bob');
select test.ok('bob uploads into his own folder',
  format($q$insert into storage.objects (bucket_id, name) values ('room-assets', %L)$q$, :'bob_folder' || '/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1.png'));
select test.affects('others cannot delete an owner''s images',
  format($q$delete from storage.objects where name like %L$q$, :'alice_folder' || '/%'), 0);

-- alice's room is published + public right now
select test.act_as(null);
select test.count_is('images of a public room are readable by visitors',
  format($q$select 1 from storage.objects where bucket_id = 'room-assets' and name like %L$q$, :'alice_folder' || '/%'), 1);

select test.act_as(:'alice');
select test.affects('alice makes her room unlisted',
  $q$update public.rooms set visibility = 'unlisted' where owner_id = '11111111-1111-4111-8111-111111111111'$q$, 1);
select test.act_as(null);
select test.count_is('images of an unlisted room are readable (link holders need them)',
  format($q$select 1 from storage.objects where bucket_id = 'room-assets' and name like %L$q$, :'alice_folder' || '/%'), 1);

select test.act_as(:'alice');
select test.affects('alice makes her room private',
  $q$update public.rooms set visibility = 'private' where owner_id = '11111111-1111-4111-8111-111111111111'$q$, 1);
select test.act_as(null);
select test.count_is('images of a private room are NOT readable by visitors',
  format($q$select 1 from storage.objects where bucket_id = 'room-assets' and name like %L$q$, :'alice_folder' || '/%'), 0);
select test.act_as(:'bob');
select test.count_is('… or by other users',
  format($q$select 1 from storage.objects where bucket_id = 'room-assets' and name like %L$q$, :'alice_folder' || '/%'), 0);
select test.act_as(:'alice');
select test.count_is('owners can always read their own images',
  format($q$select 1 from storage.objects where bucket_id = 'room-assets' and name like %L$q$, :'alice_folder' || '/%'), 1);

select test.affects('alice publishes publicly again, then unpublishes',
  $q$update public.rooms set visibility = 'public', published_at = null where owner_id = '11111111-1111-4111-8111-111111111111'$q$, 1);
select test.act_as(null);
select test.count_is('images of an unpublished room are NOT readable',
  format($q$select 1 from storage.objects where bucket_id = 'room-assets' and name like %L$q$, :'alice_folder' || '/%'), 0);
select test.fails('visitors cannot upload',
  format($q$insert into storage.objects (bucket_id, name) values ('room-assets', %L)$q$, :'alice_folder' || '/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa9.webp'), '42501');

select test.act_as(:'alice');
select test.affects('owners can delete their own images',
  format($q$delete from storage.objects where name like %L$q$, :'alice_folder' || '/%'), 1);

-- Avatars
select test.ok('users upload avatars into their own folder',
  $q$insert into storage.objects (bucket_id, name) values ('avatars', '11111111-1111-4111-8111-111111111111/cccccccc-cccc-4ccc-8ccc-cccccccccccc.webp')$q$);
select test.fails('users cannot upload avatars into another folder',
  $q$insert into storage.objects (bucket_id, name) values ('avatars', '22222222-2222-4222-8222-222222222222/cccccccc-cccc-4ccc-8ccc-cccccccccccd.webp')$q$, '42501');
select test.fails('avatar SVGs are rejected',
  $q$insert into storage.objects (bucket_id, name) values ('avatars', '11111111-1111-4111-8111-111111111111/cccccccc-cccc-4ccc-8ccc-ccccccccccce.svg')$q$, '42501');
select test.act_as(null);
select test.count_is('the avatar bucket cannot be listed through the API',
  $q$select 1 from storage.objects where bucket_id = 'avatars'$q$, 0);

-- Bucket configuration
reset role;
select test.value_is('room images live in a private bucket',
  $q$select public::text from storage.buckets where id = 'room-assets'$q$, 'false');
select test.value_is('room image uploads are limited to 5 MB',
  $q$select file_size_limit::text from storage.buckets where id = 'room-assets'$q$, '5242880');
select test.value_is('only PNG, JPEG and WebP are accepted',
  $q$select array_to_string(allowed_mime_types, ',') from storage.buckets where id = 'room-assets'$q$, 'image/png,image/jpeg,image/webp');

select test.act_as(null);
select test.fails('visitors cannot call owner-only functions (rotate key)',
  $q$select public.rotate_my_room_share_token()$q$, '42501');
select test.fails('visitors cannot call owner-only functions (asset folder)',
  $q$select public.my_room_asset_folder()$q$, '42501');
reset role;

-- Every table in public has RLS enabled.
select test.count_is('row level security is enabled on every public table',
  $q$select 1 from pg_tables where schemaname = 'public' and not rowsecurity$q$, 0);

do $$ begin raise notice 'All % database checks passed.', current_setting('test.passed'); end $$;
