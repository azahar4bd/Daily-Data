-- Daily-Data :: Postgres / Neon schema
-- Idempotent: safe to re-run on an existing database.

create table if not exists users (
  id         bigserial primary key,
  email      text unique not null,
  role       text not null default 'viewer',
  created_at timestamptz not null default now()
);

create table if not exists branches (
  id      bigserial primary key,
  name    text unique not null,
  bn_name text,
  active  boolean not null default true
);

-- added after the first release; keep older databases in sync
alter table branches add column if not exists bn_name text;

create table if not exists daily_entries (
  id                       bigserial primary key,
  entry_date               date not null,
  branch_id                bigint not null references branches(id) on delete cascade,
  actual_member            integer,
  actual_loanee            integer,
  savings                  numeric,
  kisti_count              integer,
  today_disbursement       numeric,
  grant_total_disbursement numeric,
  loan_outstanding         numeric,
  overdue_outstanding      numeric,
  recovery_rate            numeric,
  cash_in_hand             numeric,
  bank                     numeric,
  created_by               bigint references users(id),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (entry_date, branch_id)
);

alter table daily_entries add column if not exists kisti_count integer;
alter table daily_entries add column if not exists updated_at timestamptz not null default now();

create index if not exists daily_entries_date_idx   on daily_entries (entry_date desc);
create index if not exists daily_entries_branch_idx on daily_entries (branch_id);

create table if not exists month_closings (
  id                   bigserial primary key,
  month                date not null,
  branch_id            bigint not null references branches(id) on delete cascade,
  opening              jsonb not null default '{}',
  closing              jsonb not null default '{}',
  monthly_kisti_count  integer,
  closed_by            bigint references users(id),
  closed_at            timestamptz not null default now(),
  unique (month, branch_id)
);

create index if not exists month_closings_month_idx on month_closings (month desc);

insert into branches (name, bn_name) values
  ('Lohagora', 'লোহাগড়া'),
  ('Gobra',    'গোবরা'),
  ('Mohajon',  'মহাজন'),
  ('Noldi',    'নলদী'),
  ('Narail',   'নড়াইল সদর')
on conflict (name) do update set bn_name = excluded.bn_name;
