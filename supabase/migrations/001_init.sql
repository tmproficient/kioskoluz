-- Megakiosco Ohana - 001_init.sql
-- Auth + RBAC + RLS + core tables

create extension if not exists pgcrypto;

-- --------------------------------------------------
-- Core tables
-- --------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  full_name text,
  role text not null default 'seller' check (role in ('admin', 'seller')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(12,2) not null check (price >= 0),
  stock integer not null check (stock >= 0),
  barcode text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  total numeric(12,2) not null check (total >= 0),
  payment_method text not null default 'CASH' check (payment_method in ('CASH','MERCADO_PAGO')),
  created_by uuid not null references auth.users(id)
);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid not null references public.products(id),
  qty integer not null check (qty > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_username on public.profiles(username);
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_products_barcode on public.products(barcode);
create index if not exists idx_products_stock on public.products(stock);
create index if not exists idx_sales_created_by on public.sales(created_by);
create index if not exists idx_sales_created_at on public.sales(created_at);
create index if not exists idx_sale_items_sale_id on public.sale_items(sale_id);
create index if not exists idx_sale_items_product_id on public.sale_items(product_id);

-- --------------------------------------------------
-- updated_at trigger
-- --------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists trg_sales_updated_at on public.sales;
create trigger trg_sales_updated_at
before update on public.sales
for each row execute function public.set_updated_at();

drop trigger if exists trg_sale_items_updated_at on public.sale_items;
create trigger trg_sale_items_updated_at
before update on public.sale_items
for each row execute function public.set_updated_at();

-- --------------------------------------------------
-- Profile bootstrap on signup
-- --------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
begin
  v_username :=
    coalesce(
      nullif(lower(new.raw_user_meta_data->>'username'), ''),
      split_part(lower(new.email), '@', 1)
    );

  insert into public.profiles (id, username, full_name, role)
  values (
    new.id,
    v_username,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'seller'
  )
  on conflict (id) do update set
    username = excluded.username,
    full_name = coalesce(public.profiles.full_name, excluded.full_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Backfill profiles for existing users without profile
insert into public.profiles (id, username, full_name, role)
select
  u.id,
  split_part(lower(u.email), '@', 1),
  coalesce(u.raw_user_meta_data->>'full_name', ''),
  'seller'
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- --------------------------------------------------
-- Role helper functions
-- --------------------------------------------------
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role() = 'admin', false);
$$;

create or replace function public.is_seller()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role() = 'seller', false);
$$;

-- Enforce only admin can change username/role
create or replace function public.enforce_profile_update_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    if new.username is distinct from old.username then
      raise exception 'Only admin can change username';
    end if;
    if new.role is distinct from old.role then
      raise exception 'Only admin can change role';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_profile_update_rules on public.profiles;
create trigger trg_enforce_profile_update_rules
before update on public.profiles
for each row execute function public.enforce_profile_update_rules();

-- --------------------------------------------------
-- RLS
-- --------------------------------------------------
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;

-- Drop policies for idempotent migration
drop policy if exists profiles_select_self_or_admin on public.profiles;
drop policy if exists profiles_update_self_or_admin on public.profiles;
drop policy if exists profiles_insert_admin_only on public.profiles;

drop policy if exists products_select_authenticated on public.products;
drop policy if exists products_insert_admin_or_seller on public.products;
drop policy if exists products_update_admin_or_seller on public.products;
drop policy if exists products_delete_admin_only on public.products;

drop policy if exists sales_select_admin_or_owner on public.sales;
drop policy if exists sales_insert_admin_or_seller on public.sales;
drop policy if exists sales_update_admin_only on public.sales;
drop policy if exists sales_delete_admin_only on public.sales;

drop policy if exists sale_items_select_admin_or_owner on public.sale_items;
drop policy if exists sale_items_insert_admin_or_seller on public.sale_items;
drop policy if exists sale_items_update_admin_only on public.sale_items;
drop policy if exists sale_items_delete_admin_only on public.sale_items;

-- profiles policies
create policy profiles_select_self_or_admin
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_admin());

create policy profiles_update_self_or_admin
on public.profiles
for update
to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

create policy profiles_insert_admin_only
on public.profiles
for insert
to authenticated
with check (public.is_admin());

-- products policies
create policy products_select_authenticated
on public.products
for select
to authenticated
using (true);

create policy products_insert_admin_or_seller
on public.products
for insert
to authenticated
with check (public.is_admin() or public.is_seller());

create policy products_update_admin_or_seller
on public.products
for update
to authenticated
using (public.is_admin() or public.is_seller())
with check (public.is_admin() or public.is_seller());

create policy products_delete_admin_only
on public.products
for delete
to authenticated
using (public.is_admin());

-- sales policies
create policy sales_select_admin_or_owner
on public.sales
for select
to authenticated
using (public.is_admin() or created_by = auth.uid());

create policy sales_insert_admin_or_seller
on public.sales
for insert
to authenticated
with check (
  (public.is_admin() or public.is_seller())
  and created_by = auth.uid()
);

create policy sales_update_admin_only
on public.sales
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy sales_delete_admin_only
on public.sales
for delete
to authenticated
using (public.is_admin());

-- sale_items policies
create policy sale_items_select_admin_or_owner
on public.sale_items
for select
to authenticated
using (
  exists (
    select 1
    from public.sales s
    where s.id = sale_items.sale_id
      and (public.is_admin() or s.created_by = auth.uid())
  )
);

create policy sale_items_insert_admin_or_seller
on public.sale_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.sales s
    where s.id = sale_items.sale_id
      and s.created_by = auth.uid()
      and (public.is_admin() or public.is_seller())
  )
);

create policy sale_items_update_admin_only
on public.sale_items
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy sale_items_delete_admin_only
on public.sale_items
for delete
to authenticated
using (public.is_admin());

-- --------------------------------------------------
-- Stock low view (<=3), visible to admin/seller
-- --------------------------------------------------
create or replace view public.low_stock_products
with (security_invoker = true)
as
select
  p.id,
  p.name,
  p.price,
  p.stock,
  p.barcode,
  p.created_at,
  p.updated_at
from public.products p
where p.stock <= 3
order by p.stock asc, p.name asc;

grant select on public.low_stock_products to authenticated;

