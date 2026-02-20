-- =========================================
-- Megakiosco Ohana - Auth + RBAC + RLS
-- Run in Supabase SQL Editor
-- =========================================

create extension if not exists pgcrypto;

-- -----------------------------------------
-- Core tables (if not created yet)
-- -----------------------------------------
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
  total numeric(12,2) not null check (total >= 0),
  payment_method text not null default 'CASH' check (payment_method in ('CASH','MERCADO_PAGO'))
);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid not null references public.products(id),
  qty integer not null check (qty > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_total numeric(12,2) not null check (line_total >= 0)
);

alter table public.sales
  add column if not exists created_by uuid references auth.users(id);

create index if not exists idx_products_barcode on public.products(barcode);
create index if not exists idx_products_stock on public.products(stock);
create index if not exists idx_sales_created_at on public.sales(created_at);
create index if not exists idx_sales_created_by on public.sales(created_by);
create index if not exists idx_sale_items_sale_id on public.sale_items(sale_id);
create index if not exists idx_sale_items_product_id on public.sale_items(product_id);

-- -----------------------------------------
-- Profiles table
-- -----------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'seller' check (role in ('admin', 'seller')),
  created_at timestamptz not null default now()
);

-- Backfill existing auth users without profile
insert into public.profiles (id, full_name, role)
select u.id, coalesce(u.raw_user_meta_data->>'full_name', ''), 'seller'
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- Auto-create profile on auth signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), 'seller')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- -----------------------------------------
-- Role helper functions
-- -----------------------------------------
create or replace function public.auth_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
  limit 1
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.auth_role() = 'admin', false)
$$;

create or replace function public.is_seller()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.auth_role() = 'seller', false)
$$;

-- Prevent non-admin from changing roles
create or replace function public.prevent_non_admin_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role <> old.role and not public.is_admin() then
    raise exception 'Only admin can change role';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_non_admin_role_change on public.profiles;
create trigger trg_prevent_non_admin_role_change
before update on public.profiles
for each row execute function public.prevent_non_admin_role_change();

-- -----------------------------------------
-- Enable RLS
-- -----------------------------------------
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;

-- -----------------------------------------
-- Drop existing policies (idempotent)
-- -----------------------------------------
drop policy if exists profiles_select_self_or_admin on public.profiles;
drop policy if exists profiles_update_self_or_admin on public.profiles;
drop policy if exists profiles_insert_admin_only on public.profiles;

drop policy if exists products_select_logged_in on public.products;
drop policy if exists products_insert_admin_or_seller on public.products;
drop policy if exists products_update_admin_or_seller on public.products;
drop policy if exists products_delete_admin_only on public.products;

drop policy if exists sales_select_admin_or_own on public.sales;
drop policy if exists sales_insert_admin_or_seller on public.sales;

drop policy if exists sale_items_select_admin_or_own_sales on public.sale_items;
drop policy if exists sale_items_insert_admin_or_seller on public.sale_items;

-- -----------------------------------------
-- Profiles policies
-- -----------------------------------------
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

-- -----------------------------------------
-- Products policies
-- -----------------------------------------
create policy products_select_logged_in
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

-- -----------------------------------------
-- Sales policies
-- -----------------------------------------
create policy sales_select_admin_or_own
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

-- -----------------------------------------
-- Sale items policies
-- -----------------------------------------
create policy sale_items_select_admin_or_own_sales
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

-- -----------------------------------------
-- RPC: checkout (transactional)
-- -----------------------------------------
create or replace function public.create_sale(
  p_items jsonb,
  p_payment_method text default 'CASH'
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_sale_id uuid := gen_random_uuid();
  v_total numeric(12,2) := 0;
  v_item jsonb;
  v_product_id uuid;
  v_qty integer;
  v_price numeric(12,2);
  v_stock integer;
  v_line_total numeric(12,2);
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not (public.is_admin() or public.is_seller()) then
    raise exception 'Not allowed';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Invalid cart';
  end if;

  if p_payment_method not in ('CASH', 'MERCADO_PAGO') then
    raise exception 'Invalid payment method';
  end if;

  insert into public.sales (id, created_at, total, payment_method, created_by)
  values (v_sale_id, now(), 0, p_payment_method, auth.uid());

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'productId')::uuid;
    v_qty := (v_item->>'qty')::integer;

    if v_qty is null or v_qty <= 0 then
      raise exception 'Invalid quantity';
    end if;

    select price, stock
    into v_price, v_stock
    from public.products
    where id = v_product_id
    for update;

    if v_price is null then
      raise exception 'Product not found';
    end if;

    if v_stock < v_qty then
      raise exception 'Insufficient stock for product %', v_product_id;
    end if;

    v_line_total := round((v_price * v_qty)::numeric, 2);
    v_total := v_total + v_line_total;

    update public.products
    set stock = stock - v_qty,
        updated_at = now()
    where id = v_product_id;

    insert into public.sale_items (id, sale_id, product_id, qty, unit_price, line_total)
    values (gen_random_uuid(), v_sale_id, v_product_id, v_qty, v_price, v_line_total);
  end loop;

  update public.sales
  set total = v_total
  where id = v_sale_id;

  return jsonb_build_object('saleId', v_sale_id, 'total', v_total);
end;
$$;

-- -----------------------------------------
-- RPC: dashboard (admin only)
-- -----------------------------------------
create or replace function public.get_dashboard_data()
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_sold_today numeric(12,2);
  v_sold_week numeric(12,2);
  v_sold_month numeric(12,2);
  v_sales_count_today integer;
  v_ticket_avg numeric(12,2);
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;

  select coalesce(sum(total), 0)
    into v_sold_today
  from public.sales
  where (created_at at time zone 'America/Bogota')::date = (now() at time zone 'America/Bogota')::date;

  select coalesce(sum(total), 0)
    into v_sold_week
  from public.sales
  where created_at >= now() - interval '7 day';

  select coalesce(sum(total), 0)
    into v_sold_month
  from public.sales
  where date_trunc('month', created_at at time zone 'America/Bogota') =
        date_trunc('month', now() at time zone 'America/Bogota');

  select count(*)
    into v_sales_count_today
  from public.sales
  where (created_at at time zone 'America/Bogota')::date = (now() at time zone 'America/Bogota')::date;

  if v_sales_count_today > 0 then
    v_ticket_avg := round((v_sold_today / v_sales_count_today)::numeric, 2);
  else
    v_ticket_avg := 0;
  end if;

  return jsonb_build_object(
    'kpis', jsonb_build_object(
      'soldToday', coalesce(v_sold_today, 0),
      'soldWeek', coalesce(v_sold_week, 0),
      'soldMonth', coalesce(v_sold_month, 0),
      'salesCountToday', coalesce(v_sales_count_today, 0),
      'ticketAverageToday', coalesce(v_ticket_avg, 0)
    ),
    'topProducts', (
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      from (
        select
          si.product_id::text as product_id,
          p.name,
          sum(si.qty)::int as qty_sold,
          sum(si.line_total)::numeric(12,2) as total_sold
        from public.sale_items si
        inner join public.products p on p.id = si.product_id
        group by si.product_id, p.name
        order by qty_sold desc, total_sold desc
        limit 10
      ) t
    ),
    'recentSales', (
      select coalesce(jsonb_agg(row_to_json(sv)), '[]'::jsonb)
      from (
        select
          s.id::text as id,
          s.created_at,
          s.total,
          count(si.id)::int as items_count,
          s.payment_method
        from public.sales s
        left join public.sale_items si on si.sale_id = s.id
        group by s.id
        order by s.created_at desc
        limit 10
      ) sv
    ),
    'lowStockProducts', (
      select coalesce(jsonb_agg(row_to_json(lp)), '[]'::jsonb)
      from (
        select id::text, name, price, stock, barcode, created_at, updated_at
        from public.products
        where stock <= 3
        order by stock asc, name asc
      ) lp
    )
  );
end;
$$;

