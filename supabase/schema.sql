-- ============================================================
-- NewlyNow — Supabase schema + hardened RLS
-- Run in Supabase SQL Editor. Project ref: obdnbxwcuvpygkdjlljs
-- NOTE: never expose the service_role key in the frontend.
-- ============================================================

-- ---------- helpers ----------
create table if not exists public.admins (
  email text primary key,
  created_at timestamptz default now()
);
insert into public.admins(email) values
  ('elawaady.official@gmail.com'), ('elawadi.store4@gmail.com')
on conflict do nothing;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admins a
    where a.email = (auth.jwt() ->> 'email')
  );
$$;

-- ---------- categories ----------
create table if not exists public.categories (
  id text primary key,
  title text not null,
  intro text,
  icon text, image_url text,
  sort int default 0, active boolean default true,
  created_at timestamptz default now()
);

-- ---------- services ----------
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  category_id text references public.categories(id) on delete set null,
  title text not null,
  description text,
  price numeric(10,2),                     -- null = "حسب الطلب"
  image_url text,
  fields jsonb default '[]'::jsonb,         -- custom inputs the service needs
  active boolean default true,
  sort int default 0,
  created_at timestamptz default now()
);

-- ---------- orders (manual-payment state machine) ----------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text unique not null,
  user_id uuid references auth.users(id) on delete set null,   -- null for guests
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  items jsonb not null,                     -- [{service_id,title,qty,link,notes}]
  total_amount numeric(10,2),
  status text not null default 'new'
    check (status in ('new','processing','done','cancelled','disputed')),
  payment_method text default '',
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid','pending_verification','paid','failed','rejected','refunded')),
  custom_inputs jsonb,
  admin_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------- RLS ----------
alter table public.categories enable row level security;
alter table public.services   enable row level security;
alter table public.orders     enable row level security;
alter table public.admins     enable row level security;

-- categories / services: everyone reads active rows, only admin writes
create policy cat_read  on public.categories for select using (active or public.is_admin());
create policy cat_admin on public.categories for all using (public.is_admin()) with check (public.is_admin());
create policy svc_read  on public.services   for select using (active or public.is_admin());
create policy svc_admin on public.services   for all using (public.is_admin()) with check (public.is_admin());

-- orders:
--  create: guests or logged-in; but a NEW order must start clean (no self-granted paid status)
create policy ord_insert on public.orders for insert
  with check (
    (user_id is null or user_id = auth.uid())
    and status = 'new'
    and payment_status in ('unpaid','pending_verification')
  );
--  read: owner sees own; admin sees all
create policy ord_read on public.orders for select
  using (public.is_admin() or (auth.uid() is not null and auth.uid() = user_id));
--  update: ADMIN ONLY (moving to paid / changing status is server-side authority)
create policy ord_update on public.orders for update
  using (public.is_admin()) with check (public.is_admin());
--  no delete for anyone (financial history is immutable)

-- admins table: readable only by admins
create policy adm_read on public.admins for select using (public.is_admin());
