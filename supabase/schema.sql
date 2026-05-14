-- APP 3 — Orders Management: schema
-- Paste into the Supabase SQL editor and run once per project.

create extension if not exists "pgcrypto";

create table if not exists public.orders (
  id            uuid          primary key default gen_random_uuid(),
  instance_name text          not null,
  order_number  text          not null,
  customer      text          not null,
  product_sku   text          not null,
  product_name  text          not null,
  quantity      int           not null default 1,
  unit_price    numeric(12,2) not null default 0,
  total_value   numeric(12,2) generated always as (quantity * unit_price) stored,
  status        text          not null default 'PENDING',
  priority      text          not null default 'NORMAL',
  due_date      date          not null,
  notes         text          not null default '',
  created_at    timestamptz   not null default now(),
  updated_at    timestamptz   not null default now(),
  unique (instance_name, order_number)
);

create index if not exists orders_instance_idx
  on public.orders (instance_name);

create index if not exists orders_status_idx
  on public.orders (instance_name, status);

create or replace function update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.orders;
create trigger set_updated_at
  before update on public.orders
  for each row execute function update_updated_at_column();

alter table public.orders disable row level security;
