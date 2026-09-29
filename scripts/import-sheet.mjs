#!/usr/bin/env node
/**
 * Import the Excel workbook into the app.
 *
 *   node scripts/import-sheet.mjs --dry-run          # parse + report, write nothing
 *   node scripts/import-sheet.mjs --seed             # regenerate data/seed.json
 *   node scripts/import-sheet.mjs --sql import.sql   # emit idempotent upsert SQL
 *   node scripts/import-sheet.mjs --db               # upsert into $DATABASE_URL
 *
 * Every write path is an upsert on (entry_date, branch_id) / (month, branch_id),
 * so re-running the importer is safe and never duplicates rows.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readXlsx, serialToISODate } from './lib/xlsx.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ------------------------------ branches ------------------------------ */

const BRANCHES = [
  { id: 1, name: 'Lohagora', bn_name: 'লোহাগড়া' },
  { id: 2, name: 'Gobra', bn_name: 'গোবরা' },
  { id: 3, name: 'Mohajon', bn_name: 'মহাজন' },
  { id: 4, name: 'Noldi', bn_name: 'নলদী' },
  { id: 5, name: 'Narail', bn_name: 'নড়াইল সদর' }
];

// The workbook spells branches inconsistently ("gobra", "নড়াইল সদর ", ...).
const ALIASES = new Map();
for (const b of BRANCHES) {
  ALIASES.set(b.name.toLowerCase(), b.name);
  ALIASES.set(b.bn_name, b.name);
}
ALIASES.set('narail sadar', 'Narail');
ALIASES.set('নড়াইল', 'Narail');

const canonBranch = (raw) => {
  const key = String(raw ?? '').replace(/\s+/g, ' ').trim();
  return ALIASES.get(key.toLowerCase()) ?? ALIASES.get(key) ?? null;
};

/* ------------------------------ CLI ------------------------------ */

function parseArgs(argv) {
  const o = {
    file: 'sheet.xlsx',
    dailySheet: 'September-2026',
    compareSheet: 'Compare Sep-26',
    closingSheet: 'Month Closing-sep-26',
    only: 'all',
    month: null,
    from: null,
    to: null,
    seed: null,
    sql: null,
    db: false,
    dryRun: false,
    quiet: false
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) throw new Error(`${a} needs a value`);
      i++;
      return v;
    };
    switch (a) {
      case '--file': o.file = val(); break;
      case '--daily-sheet': o.dailySheet = val(); break;
      case '--compare-sheet': o.compareSheet = val(); break;
      case '--closing-sheet': o.closingSheet = val(); break;
      case '--only': o.only = val(); break;
      case '--month': o.month = val(); break;
      case '--from': o.from = val(); break;
      case '--to': o.to = val(); break;
      case '--sql': o.sql = val(); break;
      case '--db': o.db = true; break;
      case '--dry-run': o.dryRun = true; break;
      case '--quiet': o.quiet = true; break;
      case '--seed':
        o.seed = (argv[i + 1] && !argv[i + 1].startsWith('--')) ? val() : 'data/seed.json';
        break;
      case '--list':
        o.list = true; break;
      case '-h': case '--help': o.help = true; break;
      default: throw new Error(`unknown option: ${a}`);
    }
  }
  if (!o.seed && !o.sql && !o.db) o.dryRun = true;
  if (!['all', 'daily', 'closing'].includes(o.only)) throw new Error('--only must be all|daily|closing');
  return o;
}

const HELP = `
Import sheet.xlsx into the Daily-Data app.

  --file <path>            workbook to read            (default sheet.xlsx)
  --daily-sheet <name>     daily tab                   (default "September-2026")
  --compare-sheet <name>   comparison tab              (default "Compare Sep-26")
  --closing-sheet <name>   month-closing tab           (default "Month Closing-sep-26")
  --only all|daily|closing what to import              (default all)
  --month YYYY-MM          month the closing tab belongs to
  --from / --to YYYY-MM-DD limit which daily dates are imported
  --seed [path]            write the frontend fallback (default data/seed.json)
  --sql <path>             write idempotent upsert SQL
  --db                     upsert straight into $DATABASE_URL
  --dry-run                parse and report only (default when no target given)
  --list                   list the tabs in the workbook and exit
  --quiet                  only print warnings and the final summary
`.trim();

/* ------------------------------ parsing ------------------------------ */

const DAILY_COLS = {
  actual_member: 6,
  actual_loanee: 9,
  savings: 12,
  kisti_count: 20,
  today_disbursement: 23,
  grant_total_disbursement: 25,
  loan_outstanding: 26,
  overdue_outstanding: 27,
  recovery_rate: 28,
  cash_in_hand: 29,
  bank: 30
};

// a row counts as "not filled in" when every one of these is blank or zero
const SIGNIFICANT = ['actual_member', 'actual_loanee', 'savings', 'loan_outstanding', 'overdue_outstanding'];

/**
 * The daily tab repeats a 9-row block per date:
 *   "Date:" banner / 2 header rows / 5 branch rows / Total row
 */
function parseDaily(sheet, warn) {
  const blocks = [];
  for (let r = sheet.firstRow; r <= sheet.lastRow; r++) {
    if (sheet.str(r, 3) !== 'Date:') continue;
    const date = serialToISODate(sheet.num(r, 6) ?? sheet.num(r, 11));
    if (!date) { warn(`row ${r}: "Date:" banner without a usable date, block skipped`); continue; }

    const rows = [];
    let skipped = 0;
    for (let rr = r + 3; rr <= Math.min(r + 14, sheet.lastRow); rr++) {
      const first = sheet.str(rr, 1);
      if (first.toLowerCase() === 'total') break;
      const rawBranch = sheet.str(rr, 3);
      if (!rawBranch) continue;
      const branch = canonBranch(rawBranch);
      if (!branch) { warn(`row ${rr}: unknown branch "${rawBranch}", row skipped`); continue; }

      const rec = { branch };
      for (const [key, col] of Object.entries(DAILY_COLS)) rec[key] = clean(sheet.num(rr, col));

      if (SIGNIFICANT.every((k) => !rec[k])) { skipped++; continue; }

      const rowDate = serialToISODate(sheet.num(rr, 2));
      if (rowDate && rowDate !== date) warn(`row ${rr}: date ${rowDate} differs from block date ${date}`);
      rows.push(rec);
    }
    blocks.push({ date, rows, blank: skipped, row: r });
  }
  blocks.sort((a, b) => a.date.localeCompare(b.date));
  return blocks;
}

const COMPARE_COLS = {
  member_from: 2, member_to: 3,
  loanee_from: 5, loanee_to: 6,
  savings_from: 8, savings_to: 9,
  outstanding_from: 11, outstanding_to: 12,
  otr: 14,
  disbursement: 15,
  monthly_total: 16, monthly_aday: 17, monthly_due: 18,
  overdue_upto: 19, overdue_this_month: 20, overdue_change: 21,
  cash_in_hand: 22, bank: 23,
  kisti_rate: 24, weekly_loan: 25
};

function parseCompare(sheet, warn) {
  const from = serialToISODate(sheet.num(6, 2));
  const to = serialToISODate(sheet.num(6, 3));
  const rows = [];
  for (let r = 7; r <= Math.min(27, sheet.lastRow); r++) {
    const raw = sheet.str(r, 1);
    if (!raw) break;
    if (raw.toLowerCase() === 'total') break;
    const branch = canonBranch(raw);
    if (!branch) { warn(`compare row ${r}: unknown branch "${raw}"`); continue; }
    const rec = { branch };
    for (const [k, c] of Object.entries(COMPARE_COLS)) rec[k] = clean(sheet.num(r, c));
    if (rec.otr !== null) rec.otr = round(rec.otr, 2);
    rows.push(rec);
  }
  return { from, to, rows };
}

const CLOSING_COLS = {
  samiti: 3,
  member_change: 4, member_total: 5,
  loanee_change: 6, loanee_total: 7,
  savings_change: 8, savings_total: 9,
  loan_change: 10, loan_total: 11,
  overdue_change: 12, overdue_total: 13,
  otr_prev: 14, otr_current: 15, otr_change: 16,
  cash_in_hand: 17, bank: 18,
  profit_this_month: 19, profit_this_year: 20, profit_to_date: 21,
  disbursement_count: 22, disbursement_amount: 23
};

const RECOVERY_COLS = {
  receivable: 8, recovered: 9, otr: 10,
  par_prev: 11, par_current: 12, write_off_recovered: 13,
  overdue_prev: 14, overdue_current: 15, overdue_change: 16,
  llp: 17, current_due_prev: 18, current_due_now: 19,
  current_due_change: 20, new_this_month: 21
};

function parseClosing(sheet, warn) {
  const label = sheet.str(3, 3).replace(/^মাসের নাম-\s*/, '').trim();

  const rows = [];
  for (let r = 6; r <= Math.min(30, sheet.lastRow); r++) {
    const raw = sheet.str(r, 2);
    if (!raw) break;
    if (raw.replace(/\s+/g, '') === 'মোট') break;
    const branch = canonBranch(raw);
    if (!branch) { warn(`closing row ${r}: unknown branch "${raw}"`); continue; }
    const rec = { sl: sheet.num(r, 1), branch };
    for (const [k, c] of Object.entries(CLOSING_COLS)) rec[k] = clean(sheet.num(r, c));
    for (const k of ['otr_prev', 'otr_current']) {
      if (rec[k] !== null) rec[k] = round(rec[k], 2);
    }
    rows.push(rec);
  }

  // second block on the same tab: recoverable / recovered / OTR detail
  const recovery = new Map();
  for (let r = 16; r <= Math.min(40, sheet.lastRow); r++) {
    const raw = sheet.str(r, 7);
    if (!raw) continue;
    if (raw.replace(/\s+/g, '') === 'মোট') break;
    const branch = canonBranch(raw);
    if (!branch) continue;
    const rec = {};
    for (const [k, c] of Object.entries(RECOVERY_COLS)) rec[k] = clean(sheet.num(r, c));
    if (rec.otr !== null) rec.otr = round(rec.otr, 2);
    recovery.set(branch, rec);
  }
  for (const row of rows) {
    if (recovery.has(row.branch)) row.recovery = recovery.get(row.branch);
    else warn(`closing: no recovery block row for ${row.branch}`);
  }

  return { label, rows };
}

const round = (n, d) => Number(Math.round(Number(n + 'e' + d)) + 'e-' + d);
/** Kill binary-float noise: keep integers exact, trim everything else to 4dp. */
const clean = (n) => (n === null || Number.isInteger(n) ? n : round(n, 4));

/** "Month Closing-sep-26" -> "2026-09" */
function monthFromSheetName(name) {
  const m = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[-\s]?(\d{2,4})/i.exec(name);
  if (!m) return null;
  const idx = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
    .indexOf(m[1].toLowerCase());
  const yr = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
  return `${yr}-${String(idx + 1).padStart(2, '0')}`;
}

const BN_MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
const toBnDigits = (v) => String(v).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[+d]);
const monthLabelBn = (ym) => {
  const m = /^(\d{4})-(\d{2})$/.exec(ym || '');
  return m ? `${BN_MONTHS[+m[2] - 1]}-${toBnDigits(m[1])}` : ym;
};

/* ------------------------------ outputs ------------------------------ */

function buildSeed(daily, compare, closing, month) {
  const bnOf = Object.fromEntries(BRANCHES.map((b) => [b.name, b.bn_name]));
  const dailyOut = {};
  for (const block of daily) {
    if (!block.rows.length) continue; // a date nobody filled in yet
    dailyOut[block.date] = block.rows.map((r) => ({
      branch: r.branch,
      members: r.actual_member,
      loanee: r.actual_loanee,
      savings: r.savings,
      kisti: r.kisti_count,
      disbursement: r.today_disbursement,
      loan_outstanding: r.loan_outstanding,
      overdue: r.overdue_outstanding,
      recovery: r.recovery_rate
    }));
  }

  const fmtLabel = (iso) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}-${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m - 1]}-${y.slice(2)}`;
  };

  return {
    _comment: `Generated by scripts/import-sheet.mjs from the workbook. Used only when /api/* is unreachable or empty. Do not edit by hand.`,
    _generated_at: new Date().toISOString().slice(0, 10),
    org: {
      name_en: 'Bandhu Kallyan Foundation', name_bn: 'বন্ধু কল্যাণ ফাউন্ডেশন',
      area_en: 'Narail Area', area_bn: 'নড়াইল এরিয়া'
    },
    branches: BRANCHES,
    daily: dailyOut,
    compare: compare && {
      from_label: fmtLabel(compare.from),
      to_label: fmtLabel(compare.to),
      rows: compare.rows
    },
    closing: closing && {
      month,
      month_label: monthLabelBn(month),
      sheet_label: closing.label,
      rows: closing.rows.map((r) => ({ ...r, branch_bn: bnOf[r.branch] }))
    }
  };
}

const lit = (v) => {
  if (v === null || v === undefined || v === '') return 'null';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'null';
  return `'${String(v).replace(/'/g, "''")}'`;
};

function buildSql(daily, closing, month) {
  const out = [
    '-- Generated by scripts/import-sheet.mjs — safe to run more than once.',
    'begin;',
    ''
  ];
  const cols = ['entry_date', 'branch_id', ...Object.keys(DAILY_COLS)];
  const sets = Object.keys(DAILY_COLS).map((c) => `${c} = excluded.${c}`).concat('updated_at = now()');

  for (const block of daily) {
    for (const r of block.rows) {
      const vals = [lit(block.date), `(select id from branches where name = ${lit(r.branch)})`,
        ...Object.keys(DAILY_COLS).map((k) => lit(r[k]))];
      out.push(
        `insert into daily_entries (${cols.join(', ')})`,
        `values (${vals.join(', ')})`,
        `on conflict (entry_date, branch_id) do update set ${sets.join(', ')};`,
        ''
      );
    }
  }

  if (closing && month) {
    for (const r of closing.rows) {
      const { sl, branch, ...payload } = r;
      out.push(
        `insert into month_closings (month, branch_id, closing, monthly_kisti_count)`,
        `values (${lit(`${month}-01`)}, (select id from branches where name = ${lit(branch)}), ${lit(JSON.stringify(payload))}::jsonb, ${lit(payload.disbursement_count)})`,
        `on conflict (month, branch_id) do update set closing = excluded.closing, monthly_kisti_count = excluded.monthly_kisti_count, closed_at = now();`,
        ''
      );
    }
  }

  out.push('commit;', '');
  return out.join('\n');
}

async function writeToDb(daily, closing, month, log) {
  if (!process.env.DATABASE_URL) throw new Error('--db needs DATABASE_URL to be set (see .env.example)');
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(process.env.DATABASE_URL);

  const ids = new Map();
  for (const row of await sql`select id, name from branches`) ids.set(row.name, row.id);
  for (const b of BRANCHES) {
    if (!ids.has(b.name)) throw new Error(`branch "${b.name}" is missing — run schema.sql first`);
  }

  let dailyCount = 0;
  for (const block of daily) {
    for (const r of block.rows) {
      await sql`
        insert into daily_entries (entry_date, branch_id, actual_member, actual_loanee, savings,
          kisti_count, today_disbursement, grant_total_disbursement, loan_outstanding,
          overdue_outstanding, recovery_rate, cash_in_hand, bank)
        values (${block.date}, ${ids.get(r.branch)}, ${r.actual_member}, ${r.actual_loanee},
          ${r.savings}, ${r.kisti_count}, ${r.today_disbursement}, ${r.grant_total_disbursement},
          ${r.loan_outstanding}, ${r.overdue_outstanding}, ${r.recovery_rate}, ${r.cash_in_hand}, ${r.bank})
        on conflict (entry_date, branch_id) do update set
          actual_member = excluded.actual_member, actual_loanee = excluded.actual_loanee,
          savings = excluded.savings, kisti_count = excluded.kisti_count,
          today_disbursement = excluded.today_disbursement,
          grant_total_disbursement = excluded.grant_total_disbursement,
          loan_outstanding = excluded.loan_outstanding,
          overdue_outstanding = excluded.overdue_outstanding,
          recovery_rate = excluded.recovery_rate, cash_in_hand = excluded.cash_in_hand,
          bank = excluded.bank, updated_at = now()`;
      dailyCount++;
    }
  }

  let closingCount = 0;
  if (closing && month) {
    for (const r of closing.rows) {
      const { sl, branch, ...payload } = r;
      await sql`
        insert into month_closings (month, branch_id, closing, monthly_kisti_count)
        values (${`${month}-01`}, ${ids.get(branch)}, ${JSON.stringify(payload)}, ${payload.disbursement_count})
        on conflict (month, branch_id) do update set
          closing = excluded.closing,
          monthly_kisti_count = excluded.monthly_kisti_count,
          closed_at = now()`;
      closingCount++;
    }
  }
  log(`   wrote ${dailyCount} daily rows and ${closingCount} closing rows to the database`);
}

/* ------------------------------ main ------------------------------ */

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`error: ${e.message}\n\n${HELP}`);
    process.exit(2);
  }
  if (opts.help) { console.log(HELP); return; }

  const warnings = [];
  const warn = (m) => warnings.push(m);
  const log = (...a) => { if (!opts.quiet) console.log(...a); };

  const file = path.resolve(ROOT, opts.file);
  if (!fs.existsSync(file)) throw new Error(`workbook not found: ${file}`);
  const wb = readXlsx(file);

  if (opts.list) {
    console.log(`tabs in ${path.relative(ROOT, file)}:`);
    for (const n of wb.names) console.log(`  ${wb.states[n] === 'hidden' ? '(hidden) ' : '         '}${n}`);
    return;
  }

  log(`reading ${path.relative(ROOT, file)}`);

  /* -- daily -- */
  let daily = [];
  if (opts.only !== 'closing') {
    daily = parseDaily(wb.sheet(opts.dailySheet), warn);
    if (opts.from) daily = daily.filter((b) => b.date >= opts.from);
    if (opts.to) daily = daily.filter((b) => b.date <= opts.to);
    const filled = daily.reduce((a, b) => a + b.rows.length, 0);
    log(`\ndaily  "${opts.dailySheet}": ${daily.length} dates, ${filled} branch rows`);
    for (const b of daily) {
      const total = b.rows.reduce((a, r) => a + (r.savings || 0), 0);
      log(`   ${b.date}  ${String(b.rows.length).padStart(2)} rows` +
          `${b.blank ? `  (${b.blank} blank)` : '           '}  savings ${total.toLocaleString('en-IN')}`);
    }
  }

  /* -- compare -- */
  let compare = null;
  if (opts.only !== 'closing' && wb.names.includes(opts.compareSheet)) {
    compare = parseCompare(wb.sheet(opts.compareSheet), warn);
    log(`\ncompare "${opts.compareSheet}": ${compare.rows.length} branches, ${compare.from} -> ${compare.to}`);
  }

  /* -- closing -- */
  let closing = null;
  let month = opts.month;
  if (opts.only !== 'daily') {
    closing = parseClosing(wb.sheet(opts.closingSheet), warn);
    const guess = monthFromSheetName(opts.closingSheet);
    if (!month) {
      month = guess;
      if (!month) throw new Error(`could not work out the month from "${opts.closingSheet}" — pass --month YYYY-MM`);
    }
    log(`\nclosing "${opts.closingSheet}": ${closing.rows.length} branches, importing as ${month}`);
    if (closing.label) {
      log(`   label inside the sheet: "${closing.label}"`);
      // The tab name and the heading inside the sheet disagree in this workbook,
      // so say so loudly instead of silently picking one.
      const expectMonth = BN_MONTHS[Number(month.slice(5, 7)) - 1];
      const expectYear = toBnDigits(month.slice(0, 4));
      const sameMonth = closing.label.startsWith(expectMonth.slice(0, 4));
      const sameYear = closing.label.includes(expectYear);
      if (!sameMonth || !sameYear) {
        warn(`month mismatch: the tab is called "${opts.closingSheet}"${guess ? ` (-> ${guess})` : ''} but its heading ` +
             `says "${closing.label}". Importing as ${month}${opts.month ? ' (from --month)' : ''}. ` +
             `Use --month YYYY-MM to override.`);
      }
    }
  }
  if (!/^\d{4}-\d{2}$/.test(month || '') && closing) throw new Error('--month must look like YYYY-MM');

  /* -- write -- */
  if (opts.seed) {
    const target = path.resolve(ROOT, opts.seed);
    const seed = buildSeed(daily, compare, closing, month);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(seed, null, 2) + '\n');
    log(`\nwrote ${path.relative(ROOT, target)}`);
  }
  if (opts.sql) {
    const target = path.resolve(ROOT, opts.sql);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, buildSql(daily, closing, month));
    log(`wrote ${path.relative(ROOT, target)}`);
  }
  if (opts.db) {
    log('\nwriting to the database…');
    await writeToDb(daily, closing, month, log);
  }
  if (opts.dryRun) log('\ndry run — nothing was written');

  if (warnings.length) {
    console.warn(`\n${warnings.length} warning(s):`);
    for (const wmsg of warnings) console.warn(`   ! ${wmsg}`);
  }
  const filled = daily.reduce((a, b) => a + b.rows.length, 0);
  console.log(`\ndone — ${filled} daily rows, ${closing ? closing.rows.length : 0} closing rows, ${warnings.length} warning(s)`);
}

main().catch((e) => {
  console.error(`\nimport failed: ${e.message}`);
  process.exitCode = 1;
});
