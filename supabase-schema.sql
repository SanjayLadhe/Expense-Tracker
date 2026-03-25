-- ============================================================
-- ExpenseTracker — Supabase Schema (multi-user + RLS)
-- Run this in the Supabase SQL Editor to create all tables.
--
-- Profiles are created automatically when a user signs up
-- (is_approved = false until an admin approves). The first
-- account has no admin yet — after signing up, use the SQL
-- snippet below (service role or dashboard) to promote yourself.
--
-- After creating your first account, run this to make yourself admin:
-- UPDATE profiles SET is_approved = true, is_admin = true WHERE email = 'your@email.com';
-- ============================================================

-- ---------------------------------------------------------------------------
-- Profiles (linked to auth.users; admin approval workflow)
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text default '',
  is_approved boolean default false,
  is_admin    boolean default false,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- 1. Expenses
-- ---------------------------------------------------------------------------
create table if not exists expenses (
  id            text primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  amount        numeric(12,2) not null default 0,
  category      text not null,
  sub_category  text default '',
  date          date not null default current_date,
  payment_mode  text default 'cash',
  note          text default '',
  tags          text[] default '{}',
  is_recurring  boolean default false,
  recurring_frequency text,
  created_at    timestamptz default now()
);

create index if not exists idx_expenses_date on expenses (date desc);
create index if not exists idx_expenses_category on expenses (category);
create index if not exists idx_expenses_user_id on expenses (user_id);

-- ---------------------------------------------------------------------------
-- 2. Settings (one row per user)
-- ---------------------------------------------------------------------------
create table if not exists settings (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  currency        text default 'INR',
  theme           text default 'dark',
  monthly_budget  numeric(12,2) default 0,
  category_budgets jsonb default '{}'::jsonb,
  updated_at      timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- 3. Custom categories
-- ---------------------------------------------------------------------------
create table if not exists custom_categories (
  id              text primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  icon            text default 'Sparkles',
  color           text default '#9CA3AF',
  sub_categories  text[] default '{}',
  created_at      timestamptz default now()
);

create index if not exists idx_custom_categories_user_id on custom_categories (user_id);

-- ---------------------------------------------------------------------------
-- 4. Savings goal (one row per user)
-- ---------------------------------------------------------------------------
create table if not exists savings_goal (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  name            text default '',
  target_amount   numeric(12,2) default 0,
  current_amount  numeric(12,2) default 0,
  target_date     text default '',
  updated_at      timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Helper: check if the current caller is an admin (SECURITY DEFINER bypasses RLS)
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- RPC: fetch own profile (SECURITY DEFINER bypasses RLS)
-- ---------------------------------------------------------------------------
create or replace function public.get_my_profile()
returns setof profiles
language sql
security definer
set search_path = public
stable
as $$ select * from public.profiles where id = auth.uid(); $$;

-- ---------------------------------------------------------------------------
-- RPC: admins fetch all profiles (SECURITY DEFINER bypasses RLS)
-- ---------------------------------------------------------------------------
create or replace function public.get_all_profiles()
returns setof profiles
language sql
security definer
set search_path = public
stable
as $$ select * from public.profiles order by created_at; $$;

-- ---------------------------------------------------------------------------
-- RPC: admin update profile (bypasses trigger)
-- ---------------------------------------------------------------------------
create or replace function public.admin_update_profile(
  target_id uuid,
  new_is_approved boolean default null,
  new_is_admin boolean default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  update public.profiles set
    is_approved = coalesce(new_is_approved, is_approved),
    is_admin = coalesce(new_is_admin, is_admin),
    updated_at = now()
  where id = target_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Auto-create profile on signup
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, is_approved, is_admin)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    false,
    false
  );
  return new;
end;
$$ language plpgsql security definer
set search_path = public;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Non-admins cannot change is_approved / is_admin on any row via UPDATE
create or replace function public.profiles_prevent_privileged_field_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  new.is_approved := old.is_approved;
  new.is_admin := old.is_admin;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_privileged_fields on public.profiles;
create trigger profiles_prevent_privileged_fields
  before update on public.profiles
  for each row
  execute function public.profiles_prevent_privileged_field_changes();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table expenses enable row level security;
alter table settings enable row level security;
alter table custom_categories enable row level security;
alter table savings_goal enable row level security;

-- profiles: every authenticated user can read their own row
create policy "profiles_select_own"
  on profiles for select
  to authenticated
  using (id = auth.uid());

-- profiles: admins can read ALL rows (uses SECURITY DEFINER helper to avoid recursion)
create policy "profiles_select_admin"
  on profiles for select
  to authenticated
  using (public.is_admin());

-- profiles: users update own row
create policy "profiles_update_own"
  on profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- profiles: admins update any row
create policy "profiles_update_admin"
  on profiles for update
  to authenticated
  using (public.is_admin())
  with check (true);

-- expenses
create policy "expenses_select_own"
  on expenses for select
  to authenticated
  using (user_id = auth.uid());

create policy "expenses_insert_own"
  on expenses for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "expenses_update_own"
  on expenses for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "expenses_delete_own"
  on expenses for delete
  to authenticated
  using (user_id = auth.uid());

-- custom_categories
create policy "custom_categories_select_own"
  on custom_categories for select
  to authenticated
  using (user_id = auth.uid());

create policy "custom_categories_insert_own"
  on custom_categories for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "custom_categories_update_own"
  on custom_categories for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "custom_categories_delete_own"
  on custom_categories for delete
  to authenticated
  using (user_id = auth.uid());

-- settings (read / upsert own row)
create policy "settings_select_own"
  on settings for select
  to authenticated
  using (user_id = auth.uid());

create policy "settings_insert_own"
  on settings for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "settings_update_own"
  on settings for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- savings_goal (read / upsert own row)
create policy "savings_goal_select_own"
  on savings_goal for select
  to authenticated
  using (user_id = auth.uid());

create policy "savings_goal_insert_own"
  on savings_goal for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "savings_goal_update_own"
  on savings_goal for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
