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

    if (route === 'daily' && method === 'GET') {
      const date = query.date ? requireDate(query.date, 'date') : null;
      const sql = db();
      const rows = date
        ? await sql`
            select to_char(d.entry_date, 'YYYY-MM-DD') as entry_date,
                   b.name as branch, b.bn_name, d.branch_id,
                   d.actual_member, d.actual_loanee, d.savings, d.kisti_count,
                   d.today_disbursement, d.grant_total_disbursement,
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
                   d.today_disbursement, d.grant_total_disbursement,
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

      const rows = await sql`
        insert into daily_entries (
          entry_date, branch_id, actual_member, actual_loanee, savings, kisti_count,
          today_disbursement, grant_total_disbursement, loan_outstanding,
          overdue_outstanding, recovery_rate, cash_in_hand, bank
        ) values (
          ${entryDate}, ${branchId}, ${int(x.actual_member)}, ${int(x.actual_loanee)},
          ${num(x.savings)}, ${int(x.kisti_count)}, ${num(x.today_disbursement)},
          ${num(x.grant_total_disbursement)}, ${num(x.loan_outstanding)},
          ${num(x.overdue_outstanding)}, ${num(x.recovery_rate)},
          ${num(x.cash_in_hand)}, ${num(x.bank)}
        )
        on conflict (entry_date, branch_id) do update set
          actual_member            = excluded.actual_member,
          actual_loanee            = excluded.actual_loanee,
          savings                  = excluded.savings,
          kisti_count              = excluded.kisti_count,
          today_disbursement       = excluded.today_disbursement,
          grant_total_disbursement = excluded.grant_total_disbursement,
          loan_outstanding         = excluded.loan_outstanding,
          overdue_outstanding      = excluded.overdue_outstanding,
          recovery_rate            = excluded.recovery_rate,
          cash_in_hand             = excluded.cash_in_hand,
          bank                     = excluded.bank,
          updated_at               = now()
        returning *
      `;
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

      const rows = await sql`
        insert into month_closings (month, branch_id, opening, closing, monthly_kisti_count)
        values (
          ${month}, ${branchId},
          ${JSON.stringify(x.opening ?? {})}, ${JSON.stringify(x.closing ?? {})},
          ${int(x.monthly_kisti_count)}
        )
        on conflict (month, branch_id) do update set
          opening             = excluded.opening,
          closing             = excluded.closing,
          monthly_kisti_count = excluded.monthly_kisti_count,
          closed_at           = now()
        returning *
      `;
      return json(rows[0], 201);
    }

    return json({ error: 'not_found', route, method }, 404);
  } catch (e) {
    const status = e.statusCode || 500;
    return json({ error: e.code || 'server_error', message: e.message }, status);
  }
}
