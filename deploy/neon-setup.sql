-- ============================================================================
--  Daily-Data — one-shot Neon / Postgres setup
--
--  Paste this whole file into the Neon SQL Editor and press Run, or:
--      psql "$DATABASE_URL" -f deploy/neon-setup.sql
--
--  Safe to run more than once: the schema uses "create ... if not exists"
--  and every data row is an upsert, so nothing is duplicated.
--
--  Regenerate with:
--      node scripts/import-sheet.mjs --sql deploy/neon-setup.sql
--      (then re-add this header + the schema section)
--
--  NOTE: the month-closing rows are imported as 2026-09 because the workbook
--  tab is named "Month Closing-sep-26". The heading inside that tab says
--  "আগষ্ট-২০২৬". If August is correct, change the date '2026-09-01' to
--  '2026-08-01' in the month_closings statements at the bottom.
-- ============================================================================

-- ------------------------------- 1. schema ---------------------------------
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

-- -------------------------- 2. data from sheet.xlsx ------------------------
begin;

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-01', (select id from branches where name = 'Noldi'), 872, 682, 15517475, 37, null, null, 51998307, 2858154, 87, 30, 298113)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-03', (select id from branches where name = 'Lohagora'), 783, 636, 19409061, 31, 230000, 230000, 53808716, 2661956, 90, 0, 323786)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-03', (select id from branches where name = 'Gobra'), 895, 740, 16277145, 19, 420000, 420000, 52138099, 2507070, 96, 221, 507664)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-03', (select id from branches where name = 'Mohajon'), 915, 757, 22818474, 86, 550000, 1150000, 67778747, 27703640, 83, 156, 595323)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-03', (select id from branches where name = 'Noldi'), 872, 682, 15517475, 37, 700000, 700000, 51998307, 2858154, 87, 30, 298113)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-03', (select id from branches where name = 'Narail'), 862, 698, 17352854, 28, 540000, 540000, 60693393, 2867549, 100, 25, 472888)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-06', (select id from branches where name = 'Lohagora'), 782, 638, 19421642, 50, 190000, 420000, 53830567, 2853340, 86, 11212, 326817)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-06', (select id from branches where name = 'Gobra'), 896, 740, 16054714, 43, 0, 420000, 51866437, 2609685, 96, 223, 462063)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-06', (select id from branches where name = 'Mohajon'), 916, 755, 22867108, 152, 50000, 1200000, 67159771, 2999963, 89, 210, 1369129)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-06', (select id from branches where name = 'Noldi'), 871, 679, 15404460, 63, 0, 700000, 51732879, 2880866, 100, 60, 423501)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-06', (select id from branches where name = 'Narail'), 860, 693, 17254606, 45, 0, 540000, 60236746, 2963751, 100, 20, 886238)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-07', (select id from branches where name = 'Lohagora'), 780, 635, 19469994, 86, 50000, 470000, 53491829, 2991094, 89, 10, 760822)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-07', (select id from branches where name = 'Gobra'), 900, 740, 16107706, 65, 300000, 720000, 51944654, 2254589, 96, 96, 475123)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-07', (select id from branches where name = 'Mohajon'), 916, 752, 22864109, 193, 30000, 1230000, 66620906, 3196861, 87, 296, 1963721)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-07', (select id from branches where name = 'Noldi'), 872, 680, 15401122, 89, 430000, 1130000, 51379480, 3106150, 85, 165, 832321)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-07', (select id from branches where name = 'Narail'), 861, 688, 17322730, 67, 100000, 640000, 60108613, 3047366, 89, 16, 1121068)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-08', (select id from branches where name = 'Lohagora'), 780, 634, 19530641, 125, 0, 470000, 53070204, 3136098, 81, 10, 1303479)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-08', (select id from branches where name = 'Gobra'), 902, 738, 16170018, 90, 150000, 870000, 51782718, 2818502, 91, 2356, 743613)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-08', (select id from branches where name = 'Mohajon'), 918, 757, 22866034, 229, 740000, 1970000, 67050820, 3470295, 83, 0, 1583931)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-08', (select id from branches where name = 'Noldi'), 872, 678, 15424441, null, 240000, 1370000, 51417023, 3334918, 51, 100, 846641)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-08', (select id from branches where name = 'Narail'), 856, 687, 17312871, 95, 430000, 1070000, 60251840, 2092447, 100, 64, 1017608)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-09', (select id from branches where name = 'Lohagora'), 776, 634, 19545882, 158, 420000, 890000, 53206028, 3264942, 85, 0, 1222183)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-09', (select id from branches where name = 'Gobra'), 900, 730, 16130742, 114, 440000, 1310000, 51918686, 2907974, 91, 1381, 611903)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-09', (select id from branches where name = 'Mohajon'), 918, 763, 22923125, 263, 960000, 2930000, 67693883, 3612427, 82, 20, 1052661)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-09', (select id from branches where name = 'Noldi'), 874, 678, 15464448, 148, 550000, 1920000, 51531403, 3561288, 100, 208, 839711)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-09', (select id from branches where name = 'Narail'), 859, 689, 17369621, 125, 300000, 1370000, 60334736, 3149030, 80, 44, 1029298)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-10', (select id from branches where name = 'Lohagora'), 774, 633, 19518183, 185, 730000, 1620000, 53471941, 3311966, 84, 0, 995895)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-10', (select id from branches where name = 'Gobra'), 902, 725, 16156148, 143, 0, 1310000, 51586052, 2950883, 96, 3368, 1011263)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-10', (select id from branches where name = 'Mohajon'), 918, 760, 23003529, 304, 230000, 3160000, 67122364, 3645265, 87, 10, 1819231)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-10', (select id from branches where name = 'Noldi'), 872, 678, 15467726, 202, 765000, 2685000, 51705569, 3619234, 100, 56, 758191)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-10', (select id from branches where name = 'Narail'), 862, 693, 17414827, 154, 810000, 2180000, 60777071, 3357113, 94, 55, 700982)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-13', (select id from branches where name = 'Lohagora'), 774, 633, 19573259, 223, 100000, 1720000, 53167405, 3432278, 85, 0, 1408485)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-13', (select id from branches where name = 'Gobra'), 902, 728, 16190423, 172, 560000, 1870000, 51807059, 3167464, 96, 1430, 882191)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-13', (select id from branches where name = 'Mohajon'), 917, 759, 23064020, 346, 30000, 3190000, 66737603, 3786369, 86, 0, 2326311)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-13', (select id from branches where name = 'Noldi'), 873, 678, 15554693, 242, 400000, 3085000, 51667295, 3717682, 69, 29, 943000)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-13', (select id from branches where name = 'Narail'), 862, 692, 17459586, 195, 30000, 2210000, 60395747, 3362274, 87, 60, 1202622)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-14', (select id from branches where name = 'Lohagora'), 773, 632, 19601614, 254, 140000, 1860000, 53002614, 3524395, 84, 4000, 1646295)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-14', (select id from branches where name = 'Gobra'), 902, 733, 16305214, 194, 553000, 2423000, 52035492, 3292336, 98, 207, 822541)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-14', (select id from branches where name = 'Mohajon'), 917, 761, 23103955, 386, 2530000, 5720000, 68757432, 4058910, 85, 510, 450871)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-14', (select id from branches where name = 'Noldi'), 874, 680, 15597130, 275, 1030000, 4115000, 52382248, 3707117, 100, 2, 333970)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-14', (select id from branches where name = 'Narail'), 862, 694, 17450010, 238, 570000, 2780000, 60477862, 3501388, 92, 0, 1186142)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-15', (select id from branches where name = 'Lohagora'), 774, 632, 19674009, 296, 100000, 1960000, 52686168, 3492185, 88, 0, 2109880)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-15', (select id from branches where name = 'Gobra'), 903, 736, 16237613, 220, 840000, 3263000, 52586698, 3239905, 96, 1017, 244021)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-15', (select id from branches where name = 'Mohajon'), 917, 764, 23147593, 418, 750000, 6470000, 69185213, 4096407, 86, 5, 125591)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-15', (select id from branches where name = 'Noldi'), 872, 680, 15604139, 325, 420000, 4535000, 52043734, 3668494, 100, 25, 751370)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-15', (select id from branches where name = 'Narail'), 865, 694, 17521710, 260, 200000, 2980000, 60417813, 3488550, 96, 55, 1362402)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-16', (select id from branches where name = 'Lohagora'), 773, 630, 19679421, 327, 2100000, 4060000, 54315197, 3525421, 80, 0, 558980)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-16', (select id from branches where name = 'Gobra'), 902, 735, 16240723, 243, 550000, 3813000, 52883675, 3293413, 96, 139, 297521)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-16', (select id from branches where name = 'Mohajon'), 916, 767, 23150907, 445, 661000, 7131000, 69584743, 4156930, 86, 243, 173691)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-16', (select id from branches where name = 'Noldi'), 876, 680, 15599893, 360, 110000, 4645000, 51762778, 3690819, 100, 175, 393840)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-16', (select id from branches where name = 'Narail'), 863, 697, 17568646, 283, 1050000, 4030000, 61193852, 3524849, 98, 84, 692642)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-17', (select id from branches where name = 'Lohagora'), 775, 632, 19718042, 352, 350000, 4410000, 54430597, 3585584, 89, 0, 526607)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-17', (select id from branches where name = 'Gobra'), 905, 734, 16278535, 268, 0, 3813000, 52584052, 3251620, 96, 715, 687281)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-17', (select id from branches where name = 'Mohajon'), 916, 769, 23193731, 472, 355000, 7486000, 69572029, 4205979, 86, 10, 285884)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-17', (select id from branches where name = 'Noldi'), 876, 679, 15624809, 390, null, 4645000, 51481496, 3577423, 100, 177, 741090)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-17', (select id from branches where name = 'Narail'), 864, 699, 17591452, 304, 250000, 4280000, 61206620, 3656850, 100, 77, 748922)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-20', (select id from branches where name = 'Lohagora'), 778, 635, 19863242, 395, 500000, 4910000, 54351937, 3677922, 81, 1255, 846837)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-20', (select id from branches where name = 'Gobra'), 906, 736, 16309053, 304, 150000, 3963000, 52330763, 3404607, 96, 1192, 2042586)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-20', (select id from branches where name = 'Mohajon'), 917, 768, 23320485, 495, 0, 7486000, 69195620, 4034192, 89, 110, 847004)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-20', (select id from branches where name = 'Noldi'), 879, 682, 15604079, 425, 405000, 5050000, 51294351, 3423415, 69, 72, 2173230)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-20', (select id from branches where name = 'Narail'), 864, 698, 17575939, 347, 150000, 4430000, 60840234, 3671143, 100, 24, 99852)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-22', (select id from branches where name = 'Lohagora'), 779, 636, 19901651, 442, 90000, 6800000, 55519885, 3409662, 87, 0, 3353792)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-22', (select id from branches where name = 'Gobra'), 909, 739, 16354138, 330, 90000, 4603000, 52585357, 3465892, 96, 1075, 4304023)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-22', (select id from branches where name = 'Mohajon'), 914, 767, 23311299, 549, 240000, 8506000, 69553493, 3882274, 83, 1254, 4092554)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-22', (select id from branches where name = 'Noldi'), 881, 689, 15682592, 463, 140000, 6030000, 51850851, 3299994, 0, 193, 3272110)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-22', (select id from branches where name = 'Narail'), 867, 698, 17673769, 395, 1420000, 5850000, 61555023, 3724818, 94, 223, 3124202)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-23', (select id from branches where name = 'Lohagora'), 778, 634, 19919248, 460, 0, 6800000, 55190125, 3217398, 90, 0, 3758695)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-23', (select id from branches where name = 'Gobra'), 908, 739, 16380393, 349, 250000, 4853000, 52572667, 3506216, 95, 1042, 3384238)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-23', (select id from branches where name = 'Mohajon'), 915, 769, 23385735, 573, 600000, 9106000, 69855228, 3780170, 84, 5519, 3909334)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-23', (select id from branches where name = 'Noldi'), 882, 692, 15753411, 481, 800000, 6830000, 52369238, 3197843, 100, 134, 2880840)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-23', (select id from branches where name = 'Narail'), 867, 698, 17714031, 415, 60000, 5910000, 61334479, 3706828, 74, 223, 3124202)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-24', (select id from branches where name = 'Lohagora'), 778, 638, 19967482, 478, 530000, 7330000, 55512872, 3155624, 92, 0, 3523670)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-24', (select id from branches where name = 'Gobra'), 908, 740, 16392117, 367, 80000, 4933000, 52446455, 3410681, 97, 573, 3559520)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-24', (select id from branches where name = 'Mohajon'), 913, 771, 23384380, 594, 120000, 9226000, 69744313, 3684108, 86, 0, 4067234)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-24', (select id from branches where name = 'Noldi'), 883, 695, 15828795, 493, 760000, 7590000, 53045169, 3178568, 100, 119, 2300620)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-24', (select id from branches where name = 'Narail'), 866, 700, 17630375, 441, 480000, 6390000, 61474661, 3575490, 100, 126, 3276637)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-27', (select id from branches where name = 'Lohagora'), 777, 638, 19775794, 500, 190000, 7520000, 55229071, 2913466, 95, 3, 3664604)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-27', (select id from branches where name = 'Gobra'), 908, 746, 16365069, 398, 770000, 5703000, 52861164, 3292866, 96, 4102, 3182780)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-27', (select id from branches where name = 'Mohajon'), 913, 769, 23156903, 625, 0, 9226000, 69023126, 3308944, 1300, 1300, 4640734)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-27', (select id from branches where name = 'Noldi'), 884, 695, 15838481, 505, 0, 7590000, 52862165, 3049093, 100, 110, 2522670)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-27', (select id from branches where name = 'Narail'), 866, 702, 17607388, 468, 625000, 7015000, 61782782, 3459740, 89, 321, 3011739)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-28', (select id from branches where name = 'Lohagora'), 777, 635, 19731838, 514, 0, 7520000, 55093843, 2833149, 97, 342, 3230019)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-28', (select id from branches where name = 'Gobra'), 910, 746, 16407489, 424, 50000, 5753000, 52562754, 3140817, 96, 776, 3051193)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-28', (select id from branches where name = 'Mohajon'), 913, 767, 23139576, 638, 60000, 9286000, 68860455, 3135352, 93, 2900, 4047368)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-28', (select id from branches where name = 'Noldi'), 885, 693, 15836369, 512, 0, 7590000, 52762619, 2984488, 100, 14913, 2040794)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank)
values ('2026-09-28', (select id from branches where name = 'Narail'), 863, 700, 17598499, 491, 0, 7015000, 61450252, 3237365, 93, 217, 2457030)
on conflict (entry_date, branch_id) do update set actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee, savings = excluded.savings, kisti_count = excluded.kisti_count, today_disbursement = excluded.today_disbursement, grant_total_disbursement = excluded.grant_total_disbursement, loan_outstanding = excluded.loan_outstanding, overdue_outstanding = excluded.overdue_outstanding, recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand, bank = excluded.bank, updated_at = now();

insert into month_closings (month, branch_id, closing, monthly_kisti_count)
values ('2026-09-01', (select id from branches where name = 'Narail'), '{"samiti":57,"member_change":15,"member_total":858,"loanee_change":5,"loanee_total":705,"savings_change":342499,"savings_total":17448810,"loan_change":-90475,"loan_total":60666312,"overdue_change":36772,"overdue_total":2770418,"otr_prev":98.77,"otr_current":98.92,"otr_change":0.1469,"cash_in_hand":60300,"bank":450218,"profit_this_month":-86419,"profit_this_year":-35645,"profit_to_date":3260735,"disbursement_count":43,"disbursement_amount":6430000,"recovery":{"receivable":6487575,"recovered":6418086,"otr":98.93,"par_prev":0.0587,"par_current":0.0571,"write_off_recovered":516,"overdue_prev":91,"overdue_current":89,"overdue_change":-2,"llp":null,"current_due_prev":12,"current_due_now":12,"current_due_change":0,"new_this_month":0}}'::jsonb, 43)
on conflict (month, branch_id) do update set closing = excluded.closing, monthly_kisti_count = excluded.monthly_kisti_count, closed_at = now();

insert into month_closings (month, branch_id, closing, monthly_kisti_count)
values ('2026-09-01', (select id from branches where name = 'Noldi'), '{"samiti":63,"member_change":7,"member_total":873,"loanee_change":-5,"loanee_total":686,"savings_change":305552,"savings_total":15480081,"loan_change":531913,"loan_total":51742527,"overdue_change":-6005,"overdue_total":2838342,"otr_prev":99.66,"otr_current":99.38,"otr_change":-0.2808,"cash_in_hand":22310,"bank":122923,"profit_this_month":100929,"profit_this_year":301241,"profit_to_date":9212964,"disbursement_count":35,"disbursement_amount":6450000,"recovery":{"receivable":5869031,"recovered":5832650,"otr":99.38,"par_prev":0.0591,"par_current":0.0611,"write_off_recovered":50,"overdue_prev":141,"overdue_current":143,"overdue_change":2,"llp":null,"current_due_prev":4,"current_due_now":4,"current_due_change":0,"new_this_month":2}}'::jsonb, 35)
on conflict (month, branch_id) do update set closing = excluded.closing, monthly_kisti_count = excluded.monthly_kisti_count, closed_at = now();

insert into month_closings (month, branch_id, closing, monthly_kisti_count)
values ('2026-09-01', (select id from branches where name = 'Lohagora'), '{"samiti":68,"member_change":7,"member_total":780,"loanee_change":-1,"loanee_total":640,"savings_change":378324,"savings_total":19409733,"loan_change":285393,"loan_total":53930160,"overdue_change":19948,"overdue_total":2632579,"otr_prev":99.11,"otr_current":99.19,"otr_change":0.0809,"cash_in_hand":36500,"bank":110301,"profit_this_month":161853,"profit_this_year":472170,"profit_to_date":10861662,"disbursement_count":44,"disbursement_amount":6570000,"recovery":{"receivable":6266209,"recovered":6215591,"otr":99.19,"par_prev":0.0576,"par_current":0.0564,"write_off_recovered":0,"overdue_prev":70,"overdue_current":69,"overdue_change":-1,"llp":null,"current_due_prev":8,"current_due_now":9,"current_due_change":1,"new_this_month":1}}'::jsonb, 44)
on conflict (month, branch_id) do update set closing = excluded.closing, monthly_kisti_count = excluded.monthly_kisti_count, closed_at = now();

insert into month_closings (month, branch_id, closing, monthly_kisti_count)
values ('2026-09-01', (select id from branches where name = 'Mohajon'), '{"samiti":60,"member_change":13,"member_total":913,"loanee_change":3,"loanee_total":765,"savings_change":410331,"savings_total":22755262,"loan_change":-642522,"loan_total":67533066,"overdue_change":36038,"overdue_total":2599812,"otr_prev":99.01,"otr_current":98.89,"otr_change":-0.1159,"cash_in_hand":28056,"bank":629117,"profit_this_month":219338,"profit_this_year":481712,"profit_to_date":4638415,"disbursement_count":55,"disbursement_amount":7645000,"recovery":{"receivable":8188004,"recovered":8097309,"otr":98.89,"par_prev":0.0486,"par_current":0.0482,"write_off_recovered":0,"overdue_prev":97,"overdue_current":97,"overdue_change":0,"llp":null,"current_due_prev":14,"current_due_now":10,"current_due_change":-4,"new_this_month":2}}'::jsonb, 55)
on conflict (month, branch_id) do update set closing = excluded.closing, monthly_kisti_count = excluded.monthly_kisti_count, closed_at = now();

insert into month_closings (month, branch_id, closing, monthly_kisti_count)
values ('2026-09-01', (select id from branches where name = 'Gobra'), '{"samiti":72,"member_change":4,"member_total":897,"loanee_change":-6,"loanee_total":741,"savings_change":289524,"savings_total":16266960,"loan_change":504518,"loan_total":51988891,"overdue_change":-5618,"overdue_total":2473437,"otr_prev":99.4,"otr_current":99.4,"otr_change":-0.0041,"cash_in_hand":49024,"bank":856425,"profit_this_month":163803,"profit_this_year":448978,"profit_to_date":17279883,"disbursement_count":43,"disbursement_amount":6280000,"recovery":{"receivable":5743808,"recovered":5709346,"otr":99.4,"par_prev":0.0552,"par_current":0.0533,"write_off_recovered":1700,"overdue_prev":119,"overdue_current":117,"overdue_change":-2,"llp":0,"current_due_prev":6,"current_due_now":6,"current_due_change":0,"new_this_month":0}}'::jsonb, 43)
on conflict (month, branch_id) do update set closing = excluded.closing, monthly_kisti_count = excluded.monthly_kisti_count, closed_at = now();

commit;
