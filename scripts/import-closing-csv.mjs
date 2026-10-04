#!/usr/bin/env node
/**
 * Month Closing শিটের CSV থেকে month_closings টেবিল ভরে।
 *
 *   node scripts/import-closing-csv.mjs <file.csv> --month 2026-08 [--dry-run]
 *
 * শিটটা ছয়টা ব্লকে ভাগ: মূল স্থিতি, সঞ্চয় লভ্যাংশ, আদায়, Ex Recovery,
 * Overdue/কল্যাণ তহবিল/ঋণ আদায়, ডিপিএস/সঞ্চয়। প্রতিটা ব্লকের শাখা-সারি
 * খুঁজে নিয়ে একটাই closing অবজেক্টে জুড়ে দেওয়া হয়, তারপর upsert।
 */

import fs from 'node:fs';

const BRANCHES = {
  'নড়াইল সদর': 'Narail',
  'নলদী': 'Noldi',
  'লোহাগড়া': 'Lohagora',
  'মহাজন': 'Mohajon',
  'গোবরা': 'Gobra'
};

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const month = (args[args.indexOf('--month') + 1] || '').slice(0, 7);
const dryRun = args.includes('--dry-run');

if (!file || !/^\d{4}-\d{2}$/.test(month)) {
  console.error('ব্যবহার: node scripts/import-closing-csv.mjs <file.csv> --month YYYY-MM [--dry-run]');
  process.exit(1);
}

/* ---------- CSV পার্সার (কোট সহ) ---------- */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const clean = (s) => (s || '').replace(/\u00a0/g, ' ').trim();
const num = (s) => {
  const v = clean(s).replace(/,/g, '').replace(/%$/, '');
  if (v === '' || v === '-') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

const rows = parseCsv(fs.readFileSync(file, 'utf8'));

/** কোন কলামে শাখার নাম আছে সেটা ধরে ওই ব্লকের সারিগুলো ফেরত দেয় */
function block(colIndex, startAfter = 0) {
  const out = new Map();
  for (let i = startAfter; i < rows.length; i++) {
    const name = clean(rows[i][colIndex]);
    if (BRANCHES[name] && !out.has(name)) out.set(name, rows[i]);
  }
  return out;
}

/* শিটের ব্লকগুলো: শাখার নাম যে কলামে, সেটা দিয়ে চিনি */
const main = block(1);                       // ক্র নং, শাখার নাম, ...
const recovery = block(6);                   // ..., শাখা, আদায়যোগ্য, ...
const exRec = block(1, rowsIndexOfExBlock()); // Ex Recovery ব্লকও কলাম ১-এ
const overdue = block(5, rowsIndexOfExBlock());
const dps = block(14, rowsIndexOfExBlock());

function rowsIndexOfExBlock() {
  const i = rows.findIndex((r) => r.some((c) => clean(c) === 'Ex Recovery'));
  return i < 0 ? 0 : i;
}

const data = [];
for (const [bn, en] of Object.entries(BRANCHES)) {
  const m = main.get(bn) || [];
  const r = recovery.get(bn) || [];
  const e = exRec.get(bn) || [];
  const o = overdue.get(bn) || [];
  const d = dps.get(bn) || [];

  const closing = {
    samiti: num(m[2]),
    member_change: num(m[3]),
    member_total: num(m[4]),
    loanee_change: num(m[5]),
    loanee_total: num(m[6]),
    savings_change: num(m[7]),
    savings_total: num(m[8]),
    loan_change: num(m[9]),
    loan_total: num(m[10]),
    overdue_change: num(m[11]),
    overdue_total: num(m[12]),
    otr_prev: num(m[13]),
    otr_current: num(m[14]),
    cash_in_hand: num(m[16]),
    bank: num(m[17]),
    profit_this_month: num(m[18]),
    profit_this_year: num(m[19]),
    profit_to_date: num(m[20]),
    dis_month_count: num(m[21]),
    dis_month_amount: num(m[22]),

    dividend_count: null,
    dividend_amount: null,
    monthly_kisti_count: null,

    recoverable: num(r[7]),
    recovered: num(r[8]),
    otr_prev_par: num(r[10]),
    passed_this_month: num(r[11]),
    writeoff_recovery: num(r[12]),
    overdue_prev_month: num(r[13]),
    overdue_this_month: num(r[14]),
    llp: num(r[16]),
    overdue_running_prev: num(r[17]),
    overdue_running: num(r[18]),
    overdue_new: num(r[20]),

    ex_recovery_count: num(e[2]),
    ex_recovery: num(e[3]),

    overdue_total_prev: num(o[6]),
    welfare_return_count: num(o[9]),
    welfare_return_amount: num(o[10]),
    loan_recovery_principal: num(o[11]),
    loan_recovery_service: num(o[12]),

    dps_new_count: num(d[15]),
    dps_new_amount: num(d[16]),
    dps_return_count: num(d[17]),
    dps_return_amount: num(d[18]),
    savings_collection: num(d[19]),
    savings_refund: num(d[20])
  };

  data.push({ branch: en, bn, closing });
}

console.log(`মাস: ${month} — ${data.length} শাখা`);
for (const d of data) {
  const filled = Object.values(d.closing).filter((v) => v !== null).length;
  console.log(`  ${d.bn.padEnd(12)} → ${d.branch.padEnd(9)} ${filled}/${Object.keys(d.closing).length} ঘর, সদস্য ${d.closing.member_total}, সঞ্চয় ${d.closing.savings_total}`);
}

if (dryRun) {
  console.log('\n--dry-run — ডাটাবেসে কিছু লেখা হয়নি');
  process.exit(0);
}

const { Client } = await import('pg');
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
await client.connect();

for (const d of data) {
  const b = await client.query('select id from branches where name = $1', [d.branch]);
  if (!b.rows.length) { console.error(`শাখা পাওয়া যায়নি: ${d.branch}`); continue; }
  await client.query(
    `insert into month_closings (month, branch_id, opening, closing, monthly_kisti_count)
     values ($1, $2, '{}'::jsonb, $3::jsonb, $4)
     on conflict (month, branch_id) do update set
       closing = excluded.closing,
       monthly_kisti_count = excluded.monthly_kisti_count,
       closed_at = now()`,
    [`${month}-01`, b.rows[0].id, JSON.stringify(d.closing), d.closing.monthly_kisti_count]
  );
}

const check = await client.query(
  `select to_char(month,'YYYY-MM') m, count(*) n from month_closings group by 1 order by 1`
);
console.log('\nডাটাবেসে এখন:', check.rows.map((r) => `${r.m}: ${r.n}`).join(', '));
await client.end();
