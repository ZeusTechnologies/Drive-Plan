-- DrivePlan Phase 1: user-owned profiles, financial data, settings, and RLS.
-- This migration is intentionally additive. It does not remove browser data.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (full_name is null or char_length(btrim(full_name)) between 2 and 100),
  email text,
  currency text not null default 'UGX' check (currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  gross_amount numeric(14, 0) not null check (gross_amount > 0),
  platform text not null check (platform in ('uber', 'bolt', 'safeboda', 'faras', 'private', 'lolo', 'littlecab', 'ridenow', 'union', 'other')),
  fuel_percentage numeric(5, 2) not null check (fuel_percentage between 0 and 100),
  fuel_amount numeric(14, 0) not null check (fuel_amount >= 0),
  commission_percentage numeric(5, 2) not null check (commission_percentage between 0 and 100),
  commission_amount numeric(14, 0) not null check (commission_amount >= 0),
  maintenance_percentage numeric(5, 2) not null check (maintenance_percentage between 0 and 100),
  maintenance_amount numeric(14, 0) not null check (maintenance_amount >= 0),
  savings_percentage numeric(5, 2) not null check (savings_percentage between 0 and 100),
  savings_amount numeric(14, 0) not null check (savings_amount >= 0),
  currency text not null default 'UGX' check (currency ~ '^[A-Z]{3}$'),
  transaction_date timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactions_percentages_total check (
    fuel_percentage + commission_percentage + maintenance_percentage + savings_percentage = 100
  ),
  constraint transactions_amounts_total check (
    fuel_amount + commission_amount + maintenance_amount + savings_amount = gross_amount
  )
);

create table public.allocation_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  fuel_percentage numeric(5, 2) not null default 25 check (fuel_percentage between 0 and 100),
  commission_percentage numeric(5, 2) not null default 20 check (commission_percentage between 0 and 100),
  maintenance_percentage numeric(5, 2) not null default 10 check (maintenance_percentage between 0 and 100),
  savings_percentage numeric(5, 2) not null default 45 check (savings_percentage between 0 and 100),
  uber_commission_percentage numeric(5, 2) check (uber_commission_percentage between 0 and 60),
  bolt_commission_percentage numeric(5, 2) check (bolt_commission_percentage between 0 and 60),
  safeboda_commission_percentage numeric(5, 2) check (safeboda_commission_percentage between 0 and 60),
  faras_commission_percentage numeric(5, 2) check (faras_commission_percentage between 0 and 60),
  private_commission_percentage numeric(5, 2) check (private_commission_percentage between 0 and 60),
  lolo_commission_percentage numeric(5, 2) check (lolo_commission_percentage between 0 and 60),
  littlecab_commission_percentage numeric(5, 2) check (littlecab_commission_percentage between 0 and 60),
  ridenow_commission_percentage numeric(5, 2) check (ridenow_commission_percentage between 0 and 60),
  union_commission_percentage numeric(5, 2) check (union_commission_percentage between 0 and 60),
  other_commission_percentage numeric(5, 2) check (other_commission_percentage between 0 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint allocation_rules_percentages_total check (
    fuel_percentage + commission_percentage + maintenance_percentage + savings_percentage = 100
  )
);

create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  selected_platform text not null default 'uber' check (selected_platform in ('uber', 'bolt', 'safeboda', 'faras', 'private', 'lolo', 'littlecab', 'ridenow', 'union', 'other')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index transactions_user_date_idx
  on public.transactions (user_id, transaction_date desc);

-- allocation_rules.user_id already has a unique index, and the primary keys on
-- profiles.id and user_settings.user_id cover their ownership lookups.

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger transactions_set_updated_at
before update on public.transactions
for each row execute function private.set_updated_at();

create trigger allocation_rules_set_updated_at
before update on public.allocation_rules
for each row execute function private.set_updated_at();

create trigger user_settings_set_updated_at
before update on public.user_settings
for each row execute function private.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    case
      when char_length(btrim(new.raw_user_meta_data ->> 'full_name')) between 2 and 100
        then btrim(new.raw_user_meta_data ->> 'full_name')
      else null
    end,
    new.email
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

-- Idempotently add profiles for users who existed before this migration.
insert into public.profiles (id, full_name, email)
select
  users.id,
  case
    when char_length(btrim(users.raw_user_meta_data ->> 'full_name')) between 2 and 100
      then btrim(users.raw_user_meta_data ->> 'full_name')
    else null
  end,
  users.email
from auth.users as users
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.transactions enable row level security;
alter table public.allocation_rules enable row level security;
alter table public.user_settings enable row level security;

create policy profiles_select_own
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

create policy profiles_insert_own
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id);

create policy profiles_update_own
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy profiles_delete_own
on public.profiles for delete
to authenticated
using ((select auth.uid()) = id);

create policy transactions_select_own
on public.transactions for select
to authenticated
using ((select auth.uid()) = user_id);

create policy transactions_insert_own
on public.transactions for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy transactions_update_own
on public.transactions for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy transactions_delete_own
on public.transactions for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy allocation_rules_select_own
on public.allocation_rules for select
to authenticated
using ((select auth.uid()) = user_id);

create policy allocation_rules_insert_own
on public.allocation_rules for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy allocation_rules_update_own
on public.allocation_rules for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy allocation_rules_delete_own
on public.allocation_rules for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy user_settings_select_own
on public.user_settings for select
to authenticated
using ((select auth.uid()) = user_id);

create policy user_settings_insert_own
on public.user_settings for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy user_settings_update_own
on public.user_settings for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy user_settings_delete_own
on public.user_settings for delete
to authenticated
using ((select auth.uid()) = user_id);

-- Supabase no longer implicitly grants Data API access for new tables. Keep
-- anonymous access revoked and grant only authenticated CRUD operations.
revoke all on table public.profiles from anon;
revoke all on table public.transactions from anon;
revoke all on table public.allocation_rules from anon;
revoke all on table public.user_settings from anon;

grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.transactions to authenticated;
grant select, insert, update, delete on table public.allocation_rules to authenticated;
grant select, insert, update, delete on table public.user_settings to authenticated;
