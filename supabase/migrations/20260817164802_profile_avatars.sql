alter table public.profiles
  add column avatar_path text;

alter table public.profiles
  add constraint profiles_avatar_path_owner
  check (avatar_path is null or avatar_path = id::text || '/avatar');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'driveplan-avatars',
  'driveplan-avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy driveplan_avatars_select_own
on storage.objects for select
to authenticated
using (
  bucket_id = 'driveplan-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy driveplan_avatars_insert_own
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'driveplan-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and name = (select auth.uid())::text || '/avatar'
);

create policy driveplan_avatars_update_own
on storage.objects for update
to authenticated
using (
  bucket_id = 'driveplan-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'driveplan-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and name = (select auth.uid())::text || '/avatar'
);

create policy driveplan_avatars_delete_own
on storage.objects for delete
to authenticated
using (
  bucket_id = 'driveplan-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
