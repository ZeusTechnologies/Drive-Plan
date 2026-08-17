begin;
select plan(49);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'account-a@example.test', '{"full_name":"Account A"}'::jsonb),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'account-b@example.test', '{"full_name":"Account B"}'::jsonb);

select is((select count(*) from public.profiles where id in (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
)), 2::bigint, 'the auth trigger creates profiles for both users');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);

select lives_ok($sql$
  insert into public.transactions (
    id, user_id, gross_amount, platform,
    fuel_percentage, fuel_amount, commission_percentage, commission_amount,
    maintenance_percentage, maintenance_amount, savings_percentage, savings_amount,
    currency, transaction_date
  ) values (
    '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1000, 'uber',
    25, 250, 20, 200, 10, 100, 45, 450, 'UGX', now()
  )
$sql$, 'Account A can create its own transaction');
select results_eq($sql$select count(*) from public.transactions$sql$, array[1::bigint], 'Account A can read its own transaction');
select lives_ok($sql$update public.transactions set gross_amount = 2000, fuel_amount = 500, commission_amount = 400, maintenance_amount = 200, savings_amount = 900 where id = '11111111-1111-4111-8111-111111111111'$sql$, 'Account A can update its own transaction');
select results_eq($sql$select gross_amount from public.transactions where id = '11111111-1111-4111-8111-111111111111'$sql$, array[2000::numeric], 'Account A sees its transaction update');

select lives_ok($sql$insert into public.allocation_rules (user_id) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$sql$, 'Account A can create its own allocation rules');
select results_eq($sql$select count(*) from public.allocation_rules$sql$, array[1::bigint], 'Account A can read its own allocation rules');
select lives_ok($sql$update public.allocation_rules set uber_commission_percentage = 24.5 where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$sql$, 'Account A can update its own allocation rules');
select results_eq($sql$select uber_commission_percentage from public.allocation_rules$sql$, array[24.5::numeric], 'Account A sees its allocation-rule update');

select lives_ok($sql$insert into public.user_settings (user_id, selected_platform) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'uber')$sql$, 'Account A can create its own settings');
select results_eq($sql$select count(*) from public.user_settings$sql$, array[1::bigint], 'Account A can read its own settings');
select lives_ok($sql$update public.user_settings set selected_platform = 'bolt' where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$sql$, 'Account A can update its own settings');
select results_eq($sql$select selected_platform from public.user_settings$sql$, array['bolt'::text], 'Account A sees its settings update');

select results_eq($sql$select count(*) from public.profiles$sql$, array[1::bigint], 'Account A can read only its own profile');
select lives_ok($sql$update public.profiles set full_name = 'Updated Account A' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$sql$, 'Account A can update its own profile');
select results_eq($sql$select full_name from public.profiles$sql$, array['Updated Account A'::text], 'Account A sees its profile update');
select lives_ok($sql$insert into storage.objects (bucket_id, name) values ('driveplan-avatars', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/avatar')$sql$, 'Account A can create its own avatar object');
select results_eq($sql$select count(*) from storage.objects where bucket_id = 'driveplan-avatars'$sql$, array[1::bigint], 'Account A can read its own avatar object');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);

select results_eq($sql$select count(*) from public.transactions where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$sql$, array[0::bigint], 'Account B cannot read Account A transactions');
select results_eq($sql$with changed as (update public.transactions set gross_amount = 3000, fuel_amount = 750, commission_amount = 600, maintenance_amount = 300, savings_amount = 1350 where id = '11111111-1111-4111-8111-111111111111' returning 1) select count(*) from changed$sql$, array[0::bigint], 'Account B cannot update Account A transactions');
select results_eq($sql$with removed as (delete from public.transactions where id = '11111111-1111-4111-8111-111111111111' returning 1) select count(*) from removed$sql$, array[0::bigint], 'Account B cannot delete Account A transactions');

select results_eq($sql$select count(*) from public.allocation_rules where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$sql$, array[0::bigint], 'Account B cannot read Account A allocation rules');
select results_eq($sql$with changed as (update public.allocation_rules set commission_percentage = 21, savings_percentage = 44 where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' returning 1) select count(*) from changed$sql$, array[0::bigint], 'Account B cannot update Account A allocation rules');
select results_eq($sql$with removed as (delete from public.allocation_rules where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' returning 1) select count(*) from removed$sql$, array[0::bigint], 'Account B cannot delete Account A allocation rules');

select results_eq($sql$select count(*) from public.user_settings where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$sql$, array[0::bigint], 'Account B cannot read Account A settings');
select results_eq($sql$with changed as (update public.user_settings set selected_platform = 'faras' where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' returning 1) select count(*) from changed$sql$, array[0::bigint], 'Account B cannot update Account A settings');
select results_eq($sql$with removed as (delete from public.user_settings where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' returning 1) select count(*) from removed$sql$, array[0::bigint], 'Account B cannot delete Account A settings');

select results_eq($sql$select count(*) from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$sql$, array[0::bigint], 'Account B cannot read Account A profile');
select results_eq($sql$with changed as (update public.profiles set full_name = 'Stolen' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' returning 1) select count(*) from changed$sql$, array[0::bigint], 'Account B cannot update Account A profile');
select results_eq($sql$with removed as (delete from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' returning 1) select count(*) from removed$sql$, array[0::bigint], 'Account B cannot delete Account A profile');
select results_eq($sql$select count(*) from storage.objects where bucket_id = 'driveplan-avatars'$sql$, array[0::bigint], 'Account B cannot read Account A avatar object');
select results_eq($sql$with changed as (update storage.objects set metadata = '{"attempted":true}'::jsonb where bucket_id = 'driveplan-avatars' and name = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/avatar' returning 1) select count(*) from changed$sql$, array[0::bigint], 'Account B cannot update Account A avatar object');
select lives_ok($sql$delete from public.profiles where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'$sql$, 'Account B can delete its own profile');
select results_eq($sql$select count(*) from public.profiles$sql$, array[0::bigint], 'Account B profile deletion is visible to Account B');

reset role;
set local role anon;
select throws_ok($sql$select count(*) from public.transactions$sql$, '42501', 'permission denied for table transactions', 'anonymous users cannot read transactions');
select throws_ok($sql$select count(*) from public.allocation_rules$sql$, '42501', 'permission denied for table allocation_rules', 'anonymous users cannot read allocation rules');
select throws_ok($sql$select count(*) from public.user_settings$sql$, '42501', 'permission denied for table user_settings', 'anonymous users cannot read settings');
select throws_ok($sql$select count(*) from public.profiles$sql$, '42501', 'permission denied for table profiles', 'anonymous users cannot read profiles');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);

select throws_ok($sql$insert into public.profiles (id, full_name) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Impersonated')$sql$, '42501', 'new row violates row-level security policy for table "profiles"', 'Account A cannot create Account B profile');
select throws_ok($sql$insert into storage.objects (bucket_id, name) values ('driveplan-avatars', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/avatar')$sql$, '42501', 'new row violates row-level security policy for table "objects"', 'Account A cannot create an avatar object for Account B');

select lives_ok($sql$delete from public.transactions where id = '11111111-1111-4111-8111-111111111111'$sql$, 'Account A can delete its own transaction');
select results_eq($sql$select count(*) from public.transactions$sql$, array[0::bigint], 'Account A transaction deletion succeeds');
select throws_ok($sql$
  insert into public.transactions (
    user_id, gross_amount, platform,
    fuel_percentage, fuel_amount, commission_percentage, commission_amount,
    maintenance_percentage, maintenance_amount, savings_percentage, savings_amount
  ) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 1000, 'uber', 25, 250, 20, 200, 10, 100, 45, 450)
$sql$, '42501', 'new row violates row-level security policy for table "transactions"', 'Account A cannot insert a transaction owned by Account B');

select lives_ok($sql$delete from public.allocation_rules where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$sql$, 'Account A can delete its own allocation rules');
select results_eq($sql$select count(*) from public.allocation_rules$sql$, array[0::bigint], 'Account A allocation-rule deletion succeeds');
select throws_ok($sql$insert into public.allocation_rules (user_id) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')$sql$, '42501', 'new row violates row-level security policy for table "allocation_rules"', 'Account A cannot insert allocation rules owned by Account B');

select lives_ok($sql$delete from public.user_settings where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$sql$, 'Account A can delete its own settings');
select results_eq($sql$select count(*) from public.user_settings$sql$, array[0::bigint], 'Account A settings deletion succeeds');
select throws_ok($sql$insert into public.user_settings (user_id, selected_platform) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'uber')$sql$, '42501', 'new row violates row-level security policy for table "user_settings"', 'Account A cannot insert settings owned by Account B');

select * from finish();
rollback;
