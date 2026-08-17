-- Atomic production verification for DrivePlan's user-owned tables.
-- Fixed test users and all dependent records are removed before completion.

insert into auth.users (id, email, raw_user_meta_data)
values
  ('d1000000-0000-4000-8000-000000000001', 'rls-a@driveplan.test', '{"full_name":"RLS Account A"}'::jsonb),
  ('d2000000-0000-4000-8000-000000000002', 'rls-b@driveplan.test', '{"full_name":"RLS Account B"}'::jsonb);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

insert into public.transactions (
  id, user_id, gross_amount, platform,
  fuel_percentage, fuel_amount, commission_percentage, commission_amount,
  maintenance_percentage, maintenance_amount, savings_percentage, savings_amount
) values (
  'd3000000-0000-4000-8000-000000000003',
  'd1000000-0000-4000-8000-000000000001',
  1000, 'uber', 25, 250, 20, 200, 10, 100, 45, 450
);
insert into public.allocation_rules (user_id)
values ('d1000000-0000-4000-8000-000000000001');
insert into public.user_settings (user_id, selected_platform)
values ('d1000000-0000-4000-8000-000000000001', 'uber');

do $$
begin
  if (select count(*) from public.profiles) <> 1 then raise exception 'A profile read failed'; end if;
  if (select count(*) from public.transactions) <> 1 then raise exception 'A transaction read failed'; end if;
  if (select count(*) from public.allocation_rules) <> 1 then raise exception 'A allocation read failed'; end if;
  if (select count(*) from public.user_settings) <> 1 then raise exception 'A settings read failed'; end if;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d2000000-0000-4000-8000-000000000002","role":"authenticated"}', true);

do $$
declare
  affected integer;
  blocked boolean;
begin
  if (select count(*) from public.profiles where id = 'd1000000-0000-4000-8000-000000000001') <> 0 then raise exception 'B read A profile'; end if;
  if (select count(*) from public.transactions where user_id = 'd1000000-0000-4000-8000-000000000001') <> 0 then raise exception 'B read A transaction'; end if;
  if (select count(*) from public.allocation_rules where user_id = 'd1000000-0000-4000-8000-000000000001') <> 0 then raise exception 'B read A allocation'; end if;
  if (select count(*) from public.user_settings where user_id = 'd1000000-0000-4000-8000-000000000001') <> 0 then raise exception 'B read A settings'; end if;

  update public.profiles set full_name = 'Stolen' where id = 'd1000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'B updated A profile'; end if;
  delete from public.profiles where id = 'd1000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'B deleted A profile'; end if;

  update public.transactions
  set gross_amount = 2000, fuel_amount = 500, commission_amount = 400, maintenance_amount = 200, savings_amount = 900
  where id = 'd3000000-0000-4000-8000-000000000003';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'B updated A transaction'; end if;
  delete from public.transactions where id = 'd3000000-0000-4000-8000-000000000003';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'B deleted A transaction'; end if;

  update public.allocation_rules set uber_commission_percentage = 12
  where user_id = 'd1000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'B updated A allocation'; end if;
  delete from public.allocation_rules where user_id = 'd1000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'B deleted A allocation'; end if;

  update public.user_settings set selected_platform = 'bolt'
  where user_id = 'd1000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'B updated A settings'; end if;
  delete from public.user_settings where user_id = 'd1000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'B deleted A settings'; end if;

  blocked := false;
  begin
    insert into public.transactions (
      user_id, gross_amount, platform,
      fuel_percentage, fuel_amount, commission_percentage, commission_amount,
      maintenance_percentage, maintenance_amount, savings_percentage, savings_amount
    ) values ('d1000000-0000-4000-8000-000000000001', 1000, 'uber', 25, 250, 20, 200, 10, 100, 45, 450);
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'B spoofed A transaction'; end if;

  blocked := false;
  begin
    insert into public.allocation_rules (user_id)
    values ('d1000000-0000-4000-8000-000000000001');
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'B spoofed A allocation'; end if;

  blocked := false;
  begin
    insert into public.user_settings (user_id)
    values ('d1000000-0000-4000-8000-000000000001');
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'B spoofed A settings'; end if;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

update public.profiles set full_name = 'RLS Account A Updated'
where id = 'd1000000-0000-4000-8000-000000000001';
update public.transactions
set gross_amount = 2000, fuel_amount = 500, commission_amount = 400, maintenance_amount = 200, savings_amount = 900
where id = 'd3000000-0000-4000-8000-000000000003';
update public.allocation_rules set uber_commission_percentage = 12
where user_id = 'd1000000-0000-4000-8000-000000000001';
update public.user_settings set selected_platform = 'bolt'
where user_id = 'd1000000-0000-4000-8000-000000000001';

delete from public.user_settings where user_id = 'd1000000-0000-4000-8000-000000000001';
delete from public.allocation_rules where user_id = 'd1000000-0000-4000-8000-000000000001';
delete from public.transactions where id = 'd3000000-0000-4000-8000-000000000003';

reset role;
delete from auth.users
where id in ('d1000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000002');
