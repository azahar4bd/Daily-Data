import { neon } from '@neondatabase/serverless';

const CORS = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'cache-control': 'no-store'
};

const json = (body, statusCode = 200) => ({
  statusCode,
  headers: CORS,
  body: JSON.stringify(body)
});

/**
 * Accept whichever name the connection string arrived under:
 *   DATABASE_URL          set by hand
 *   NETLIFY_DATABASE_URL  set by the Netlify Neon extension
 *   NEON_DATABASE_URL     set by some Neon integrations
 */
const dbUrl = () =>
  process.env.DATABASE_URL ||
  process.env.NETLIFY_DATABASE_URL ||
  process.env.NEON_DATABASE_URL ||
  null;

/** Lazily create the SQL client so a missing connection string can't crash the module. */
let _sql;
let _sqlFor;
function db() {
  const url = dbUrl();
  if (!url) {
    const err = new Error('No database connection string. Set DATABASE_URL (or install the Netlify Neon extension).');
    err.statusCode = 503;
    err.code = 'db_not_configured';
    throw err;
  }
  if (!_sql || _sqlFor !== url) { _sql = neon(url); _sqlFor = url; }
  return _sql;
}

const num = (v) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));
const int = (v) => (num(v) === null ? null : Math.round(Number(v)));

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  err.code = 'bad_request';
  return err;
}

/** "2026-09" or "2026-09-14" -> "2026-09-01" */
function toMonthStart(value) {
  if (!value) throw badRequest('month is required (YYYY-MM)');
  const m = /^(\d{4})-(\d{2})/.exec(String(value));
  if (!m) throw badRequest('month must look like YYYY-MM');
  return `${m[1]}-${m[2]}-01`;
}

function requireDate(value, field = 'entry_date') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) {
    throw badRequest(`${field} must look like YYYY-MM-DD`);
  }
  return value;
}

/** অ্যাডমিন পাসওয়ার্ড যাচাই — হেডার লেবেল বদলাতে লাগে */
function requireAdmin(event) {
  const given = event.headers['x-admin-password'] || event.headers['X-Admin-Password'] || '';
  const pass = process.env.ADMIN_PASSWORD || 'bkf2026';
  if (String(given) !== pass) {
    const err = new Error('admin password required');
    err.statusCode = 401;
    err.code = 'unauthorized';
    throw err;
  }
}

function parseBody(event) {
  try {
    return JSON.parse(event.body || '{}');
  } catch {
    throw badRequest('request body must be valid JSON');
  }
}

/** Accept a branch id or a branch name and return the numeric id. */
async function resolveBranchId(sql, payload) {
  if (payload.branch_id !== undefined && payload.branch_id !== null && payload.branch_id !== '') {
    return int(payload.branch_id);
  }
  const name = payload.branch || payload.branch_name;
  if (!name) throw badRequest('branch_id or branch is required');
  const found = await sql`select id from branches where name = ${name} or bn_name = ${name} limit 1`;
  if (!found.length) throw badRequest(`unknown branch: ${name}`);
  return found[0].id;
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  const route = (event.path || '').replace(/^.*\/api\/?/, '').replace(/\/+$/, '');
  const method = event.httpMethod;
  const query = event.queryStringParameters || {};

  try {
    if (route === 'health') {
      const source = process.env.DATABASE_URL ? 'DATABASE_URL'
        : process.env.NETLIFY_DATABASE_URL ? 'NETLIFY_DATABASE_URL'
        : process.env.NEON_DATABASE_URL ? 'NEON_DATABASE_URL' : null;
      if (!source) return json({ ok: false, database: 'not_configured' }, 503);
      const sql = db();
      const rows = await sql`select count(*)::int as branches from branches`;
      return json({ ok: true, database: 'connected', variable: source, branches: rows[0].branches });
    }

    if (route === 'branches' && method === 'GET') {
      const sql = db();
      return json(await sql`
        select id, name, bn_name
        from branches
        where active = true
        order by name
      `);
    }

    if (route === 'daily/dates' && method === 'GET') {
      const sql = db();
      const rows = await sql`
        select distinct to_char(entry_date, 'YYYY-MM-DD') as entry_date
        from daily_entries
        order by entry_date desc
        limit 180
      `;
      return json(rows.map((r) => r.entry_date));
    }

    if (route === 'month-close/months' && method === 'GET') {
      const sql = db();
      const rows = await sql`
        select distinct to_char(month, 'YYYY-MM') as month
        from month_closings
        order by month desc
        limit 120
      `;
      return json(rows.map((r) => r.month));
    }

    if (route === 'daily' && method === 'GET') {
      const date = query.date ? requireDate(query.date, 'date') : null;
      const month = /^\d{4}-\d{2}$/.test(query.month || '') ? `${query.month}-01` : null;
      const sql = db();

      // ?month=YYYY-MM — পুরো মাসের সব রো (মাসিক আদায়ের চলতি যোগফল বের করতে লাগে)
      if (month) {
        const rows = await sql`
          select to_char(d.entry_date, 'YYYY-MM-DD') as entry_date,
                 b.name as branch, b.bn_name, d.branch_id,
                 d.actual_member, d.actual_loanee, d.savings, d.kisti_count,
                 d.kisti_cumulative, d.today_collection, d.kisti_total,
                 d.today_disbursement, d.grant_total_disbursement,
                 d.loan_outstanding, d.overdue_outstanding, d.recovery_rate,
                 d.cash_in_hand, d.bank
          from daily_entries d
          join branches b on b.id = d.branch_id
          where date_trunc('month', d.entry_date) = ${month}::date
          order by d.entry_date, b.name
        `;
        return json(rows);
      }

      const rows = date
        ? await sql`
            select to_char(d.entry_date, 'YYYY-MM-DD') as entry_date,
                   b.name as branch, b.bn_name, d.branch_id,
                   d.actual_member, d.actual_loanee, d.savings, d.kisti_count,
                   d.kisti_cumulative, d.today_collection, d.kisti_total, d.today_disbursement, d.grant_total_disbursement,
                   d.loan_outstanding, d.overdue_outstanding, d.recovery_rate,
                   d.cash_in_hand, d.bank
            from daily_entries d
            join branches b on b.id = d.branch_id
            where d.entry_date = ${date}
            order by b.name
          `
        : await sql`
            select to_char(d.entry_date, 'YYYY-MM-DD') as entry_date,
                   b.name as branch, b.bn_name, d.branch_id,
                   d.actual_member, d.actual_loanee, d.savings, d.kisti_count,
                   d.kisti_cumulative, d.today_collection, d.kisti_total, d.today_disbursement, d.grant_total_disbursement,
                   d.loan_outstanding, d.overdue_outstanding, d.recovery_rate,
                   d.cash_in_hand, d.bank
            from daily_entries d
            join branches b on b.id = d.branch_id
            order by d.entry_date desc, b.name
            limit 500
          `;
      return json(rows);
    }

    if (route === 'daily' && method === 'POST') {
      const x = parseBody(event);
      const entryDate = requireDate(x.entry_date);
      const sql = db();
      const branchId = await resolveBranchId(sql, x);

      /* আংশিক সেভ: যে ঘরে কিছু লেখা হয়নি সেটি আগের মানই রাখে।
         coalesce(excluded.col, daily_entries.col) — নতুন মান থাকলে সেটি,
         না থাকলে আগেরটি। ইচ্ছে করে ফাঁকা করতে চাইলে clear তালিকায় নাম পাঠাতে হয়। */
      const rows = await sql`
        insert into daily_entries (
          entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count,
          kisti_total, today_collection, today_disbursement, grant_total_disbursement,
          loan_outstanding, overdue_outstanding, recovery_rate, cash_in_hand, bank
        ) values (
          ${entryDate}, ${branchId}, ${int(x.actual_member)}, ${int(x.actual_loanee)},
          ${num(x.savings)}, ${int(x.kisti_count)}, ${int(x.kisti_total)},
          ${num(x.today_collection)}, ${num(x.today_disbursement)},
          ${num(x.grant_total_disbursement)}, ${num(x.loan_outstanding)},
          ${num(x.overdue_outstanding)}, ${num(x.recovery_rate)},
          ${num(x.cash_in_hand)}, ${num(x.bank)}
        )
        on conflict (entry_date, branch_id) do update set
          actual_member            = coalesce(excluded.actual_member, daily_entries.actual_member),
          actual_loanee            = coalesce(excluded.actual_loanee, daily_entries.actual_loanee),
          savings                  = coalesce(excluded.savings, daily_entries.savings),
          kisti_count              = coalesce(excluded.kisti_count, daily_entries.kisti_count),
          kisti_total              = coalesce(excluded.kisti_total, daily_entries.kisti_total),
          today_collection         = coalesce(excluded.today_collection, daily_entries.today_collection),
          today_disbursement       = coalesce(excluded.today_disbursement, daily_entries.today_disbursement),
          grant_total_disbursement = coalesce(excluded.grant_total_disbursement, daily_entries.grant_total_disbursement),
          loan_outstanding         = coalesce(excluded.loan_outstanding, daily_entries.loan_outstanding),
          overdue_outstanding      = coalesce(excluded.overdue_outstanding, daily_entries.overdue_outstanding),
          recovery_rate            = coalesce(excluded.recovery_rate, daily_entries.recovery_rate),
          cash_in_hand             = coalesce(excluded.cash_in_hand, daily_entries.cash_in_hand),
          bank                     = coalesce(excluded.bank, daily_entries.bank),
          updated_at               = now()
        returning *
      `;

      /* ইচ্ছে করে কোনো ঘর ফাঁকা করতে চাইলে — প্রতিটি কলামের জন্য আলাদা,
         নির্দিষ্ট করে লেখা কোয়েরি (কাঁচা SQL জোড়া লাগাই না) */
      const CLEARERS = {
        actual_member: () => sql`update daily_entries set actual_member = null, updated_at = now() where entry_date = ${entryDate} and branch_id = ${branchId}`,
        actual_loanee: () => sql`update daily_entries set actual_loanee = null, updated_at = now() where entry_date = ${entryDate} and branch_id = ${branchId}`,
        savings: () => sql`update daily_entries set savings = null, updated_at = now() where entry_date = ${entryDate} and branch_id = ${branchId}`,
        kisti_count: () => sql`update daily_entries set kisti_count = null, updated_at = now() where entry_date = ${entryDate} and branch_id = ${branchId}`,
        kisti_total: () => sql`update daily_entries set kisti_total = null, updated_at = now() where entry_date = ${entryDate} and branch_id = ${branchId}`,
        today_collection: () => sql`update daily_entries set today_collection = null, updated_at = now() where entry_date = ${entryDate} and branch_id = ${branchId}`,
        today_disbursement: () => sql`update daily_entries set today_disbursement = null, updated_at = now() where entry_date = ${entryDate} and branch_id = ${branchId}`,
        grant_total_disbursement: () => sql`update daily_entries set grant_total_disbursement = null, updated_at = now() where entry_date = ${entryDate} and branch_id = ${branchId}`,
        loan_outstanding: () => sql`update daily_entries set loan_outstanding = null, updated_at = now() where entry_date = ${entryDate} and branch_id = ${branchId}`,
        overdue_outstanding: () => sql`update daily_entries set overdue_outstanding = null, updated_at = now() where entry_date = ${entryDate} and branch_id = ${branchId}`,
        recovery_rate: () => sql`update daily_entries set recovery_rate = null, updated_at = now() where entry_date = ${entryDate} and branch_id = ${branchId}`,
        cash_in_hand: () => sql`update daily_entries set cash_in_hand = null, updated_at = now() where entry_date = ${entryDate} and branch_id = ${branchId}`,
        bank: () => sql`update daily_entries set bank = null, updated_at = now() where entry_date = ${entryDate} and branch_id = ${branchId}`
      };
      for (const key of (Array.isArray(x.clear) ? x.clear : [])) {
        if (CLEARERS[key]) await CLEARERS[key]();
      }

      return json(rows[0], 201);
    }

    if (route === 'month-close' && method === 'GET') {
      const month = toMonthStart(query.month);
      const sql = db();
      return json(await sql`
        select to_char(m.month, 'YYYY-MM') as month,
               b.name as branch, b.bn_name, m.branch_id,
               m.opening, m.closing, m.monthly_kisti_count, m.closed_at
        from month_closings m
        join branches b on b.id = m.branch_id
        where m.month = ${month}
        order by b.name
      `);
    }

    if (route === 'month-close' && method === 'POST') {
      const x = parseBody(event);
      const month = toMonthStart(x.month);
      const sql = db();
      const branchId = await resolveBranchId(sql, x);

      /* আংশিক সেভ: যে ঘরে কিছু লেখা হয়নি সেটি বাদ দিয়ে দিই,
         তাই পুরনো মান অক্ষত থাকে। jsonb-এর || দিয়ে কেবল নতুন ঘরগুলো বসে। */
      const incoming = {};
      for (const [k, v] of Object.entries(x.closing || {})) {
        if (v !== null && v !== undefined && v !== '') incoming[k] = v;
      }
      const opening = x.opening && Object.keys(x.opening).length ? x.opening : null;
      const kisti = int(x.monthly_kisti_count);

      const rows = await sql`
        insert into month_closings (month, branch_id, opening, closing, monthly_kisti_count)
        values (
          ${month}, ${branchId},
          ${JSON.stringify(opening ?? {})}, ${JSON.stringify(incoming)}, ${kisti}
        )
        on conflict (month, branch_id) do update set
          opening             = case when ${opening === null} then month_closings.opening
                                     else excluded.opening end,
          closing             = coalesce(month_closings.closing, '{}'::jsonb) || excluded.closing,
          monthly_kisti_count = coalesce(excluded.monthly_kisti_count, month_closings.monthly_kisti_count),
          closed_at           = now()
        returning *
      `;

      // ইচ্ছে করে কোনো ঘর মুছতে চাইলে: clear: ["key", ...]
      for (const key of (Array.isArray(x.clear) ? x.clear : [])) {
        if (typeof key === 'string' && /^[a-z_]{2,40}$/.test(key)) {
          await sql`update month_closings set closing = closing - ${key}, closed_at = now()
                    where month = ${month} and branch_id = ${branchId}`;
        }
      }

      return json(rows[0], 201);
    }


    /* ---------------- হেডার/নোটিশের লেখা ---------------- */

    if (route === 'labels' && method === 'GET') {
      const sql = db();
      const rows = await sql`select key, label from ui_labels`;
      return json(Object.fromEntries(rows.map((r) => [r.key, r.label])));
    }

    if (route === 'labels' && method === 'POST') {
      requireAdmin(event);
      const x = parseBody(event);
      const key = String(x.key || '').trim();
      if (!key) return json({ error: 'key_required' }, 400);
      const sql = db();
      const label = String(x.label ?? '');
      if (!label) {
        await sql`delete from ui_labels where key = ${key}`;
        return json({ ok: true, key, label: null });
      }
      await sql`
        insert into ui_labels (key, label) values (${key}, ${label})
        on conflict (key) do update set label = excluded.label, updated_at = now()
      `;
      return json({ ok: true, key, label });
    }

    /* ---------------- লাইভ সিঙ্ক ---------------- */

    if (route === 'version' && method === 'GET') {
      const sql = db();
      const rows = await sql`
        select
          coalesce((select max(greatest(updated_at, created_at)) from daily_entries), 'epoch')  as daily_at,
          (select count(*)::int from daily_entries)                                             as daily_n,
          coalesce((select max(closed_at) from month_closings), 'epoch')                        as closing_at,
          (select count(*)::int from month_closings)                                            as closing_n,
          coalesce((select max(updated_at) from ui_labels), 'epoch')                            as labels_at,
          (select count(*)::int from visitors where last_seen > now() - interval '2 minutes')   as online
      `;
      const r = rows[0];
      const who = await sql`
        select coalesce(person, 'অজানা') as person, branch
        from visitors where last_seen > now() - interval '2 minutes'
        order by last_seen desc limit 12
      `;
      return json({
        stamp: `${r.daily_at}|${r.daily_n}|${r.closing_at}|${r.closing_n}|${r.labels_at}`,
        online: r.online,
        who
      });
    }

    /* ---------------- ভিজিটর ---------------- */

    if (route === 'ping' && method === 'POST') {
      const x = parseBody(event);
      const vid = String(x.vid || '').slice(0, 64);
      if (!vid) return json({ error: 'vid_required' }, 400);
      const person = x.person ? String(x.person).slice(0, 60) : null;
      const branch = x.branch ? String(x.branch).slice(0, 40) : null;
      const sql = db();
      await sql`
        insert into visitors (vid, person, branch) values (${vid}, ${person}, ${branch})
        on conflict (vid) do update set
          last_seen = now(),
          hits      = visitors.hits + 1,
          person    = coalesce(${person}, visitors.person),
          branch    = coalesce(${branch}, visitors.branch)
      `;
      return json({ ok: true });
    }

    if (route === 'who' && method === 'GET') {
      const sql = db();
      const rows = await sql`
        select coalesce(person, 'অজানা') as person, branch, last_seen
        from visitors where last_seen > now() - interval '2 minutes'
        order by last_seen desc limit 30
      `;
      return json(rows);
    }

    if (route === 'stats' && method === 'GET') {
      requireAdmin(event);
      const sql = db();
      const rows = await sql`
        select
          (select count(*)::int from visitors)                                               as total_visitors,
          (select coalesce(sum(hits), 0)::int from visitors)                                 as total_hits,
          (select count(*)::int from visitors where last_seen > now() - interval '3 minutes') as online_now,
          (select count(*)::int from visitors where last_seen::date = current_date)           as today_visitors,
          (select count(*)::int from visitors where last_seen > now() - interval '24 hours')  as day_visitors
      `;
      const recent = await sql`
        select coalesce(person, 'অজানা') as person, branch, hits,
               to_char(last_seen, 'YYYY-MM-DD HH24:MI') as last_seen
        from visitors order by last_seen desc limit 25
      `;
      return json({ ...rows[0], recent });
    }

    /* ---------------- অ্যাডমিন লগইন ---------------- */

    if (route === 'admin/login' && method === 'POST') {
      const x = parseBody(event);
      const pass = process.env.ADMIN_PASSWORD || 'bkf2026';
      if (String(x.password || '') !== pass) return json({ error: 'wrong_password' }, 401);
      return json({ ok: true, token: pass });
    }

    /* ---------------- মুছে ফেলা ---------------- */

    if (route === 'month-close' && method === 'DELETE') {
      const month = toMonthStart(query.month);
      const branch = String(query.branch || '').trim();
      if (!branch) return json({ error: 'branch_required' }, 400);
      const sql = db();
      const branchId = await resolveBranchId(sql, { branch });
      const rows = await sql`
        delete from month_closings where month = ${month} and branch_id = ${branchId} returning id
      `;
      return json({ ok: true, deleted: rows.length });
    }

    if (route === 'daily' && method === 'DELETE') {
      const date = requireDate(query.date, 'date');
      const branch = String(query.branch || '').trim();
      if (!branch) return json({ error: 'branch_required' }, 400);
      const sql = db();
      const branchId = await resolveBranchId(sql, { branch });
      const rows = await sql`
        delete from daily_entries where entry_date = ${date} and branch_id = ${branchId} returning id
      `;
      return json({ ok: true, deleted: rows.length });
    }


    /* ---------------- পরিবর্তনের ইতিহাস ও পুনরুদ্ধার ---------------- */

    if (route === 'history' && method === 'GET') {
      requireAdmin(event);
      const sql = db();
      const rows = await sql`
        select id, tbl, op, branch, ref,
               to_char(changed_at, 'YYYY-MM-DD HH24:MI') as at,
               (select count(*) from jsonb_each(coalesce(old_data, '{}'::jsonb)) e
                 where e.value::text not in ('null','""')) as old_fields
        from change_log
        where op in ('DELETE', 'UPDATE')
        order by id desc limit 60
      `;
      return json(rows);
    }

    if (route === 'history/restore' && method === 'POST') {
      requireAdmin(event);
      const x = parseBody(event);
      const id = Number(x.id);
      if (!id) return json({ error: 'id_required' }, 400);

      const sql = db();
      const found = await sql`select * from change_log where id = ${id}`;
      if (!found.length) return json({ error: 'not_found' }, 404);

      const log = found[0];
      const d = log.old_data;
      if (!d) return json({ error: 'nothing_to_restore' }, 400);

      if (log.tbl === 'daily_entries') {
        await sql`
          insert into daily_entries (
            entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count,
            kisti_total, kisti_cumulative, today_collection, today_disbursement,
            grant_total_disbursement, loan_outstanding, overdue_outstanding,
            recovery_rate, cash_in_hand, bank
          ) values (
            ${d.entry_date}, ${d.branch_id}, ${d.actual_member}, ${d.actual_loanee},
            ${d.savings}, ${d.kisti_count}, ${d.kisti_total}, ${d.kisti_cumulative ?? false},
            ${d.today_collection}, ${d.today_disbursement}, ${d.grant_total_disbursement},
            ${d.loan_outstanding}, ${d.overdue_outstanding}, ${d.recovery_rate},
            ${d.cash_in_hand}, ${d.bank}
          )
          on conflict (entry_date, branch_id) do update set
            actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee,
            savings = excluded.savings, kisti_count = excluded.kisti_count,
            kisti_total = excluded.kisti_total, kisti_cumulative = excluded.kisti_cumulative,
            today_collection = excluded.today_collection,
            today_disbursement = excluded.today_disbursement,
            grant_total_disbursement = excluded.grant_total_disbursement,
            loan_outstanding = excluded.loan_outstanding,
            overdue_outstanding = excluded.overdue_outstanding,
            recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand,
            bank = excluded.bank, updated_at = now()
        `;
      } else if (log.tbl === 'month_closings') {
        await sql`
          insert into month_closings (month, branch_id, opening, closing, monthly_kisti_count)
          values (${d.month}, ${d.branch_id}, ${JSON.stringify(d.opening || {})},
                  ${JSON.stringify(d.closing || {})}, ${d.monthly_kisti_count})
          on conflict (month, branch_id) do update set
            opening = excluded.opening, closing = excluded.closing,
            monthly_kisti_count = excluded.monthly_kisti_count, closed_at = now()
        `;
      } else {
        return json({ error: 'unknown_table' }, 400);
      }

      return json({ ok: true, restored: { table: log.tbl, branch: log.branch, ref: log.ref } });
    }

    return json({ error: 'not_found', route, method }, 404);
  } catch (e) {
    const status = e.statusCode || 500;
    return json({ error: e.code || 'server_error', message: e.message }, status);
  }
}
