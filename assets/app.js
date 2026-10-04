/* ==========================================================================
   বন্ধু কল্যাণ ফাউন্ডেশন — তিনটি পেজ
     1. entry    : ডেইলি এন্ট্রি ফর্ম + মাস ক্লোজিং এন্ট্রি ফর্ম
     2. compare  : দুই তারিখের শাখাভিত্তিক তুলনা (daily_entries থেকে)
     3. closing  : মাস ক্লোজিং সিট (month_closings থেকে)
   লাইভ ডেটা /api/* (Netlify function → Neon Postgres) থেকে আসে।
   API-তে পৌঁছানো না গেলে data/seed.json থেকে ডেমো দেখানো হয়।
   ========================================================================== */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------- state ---------- */

const state = {
  seed: null,
  branches: [],
  bnLookup: {},
  dates: [],
  months: [],
  live: false,
  entryList: [],
  closingList: [],
  labels: {},
  compareRows: [],
  closingRows: [],
  source: 'demo'
};

/* ==========================================================================
   মাস ক্লোজিং ফর্মের ঘরগুলো — নমুনা টেবিলের হুবহু ক্রমে।
   টেবিলে ভাঙ্গা ভাঙ্গা থাকলেও এখানে পরপর, লাইনে ৩টা করে বসবে।
   kind: 'head' মানে গ্রুপের নাম (পুরো লাইন জুড়ে), বাকিগুলো ইনপুট।
   ========================================================================== */

const MC_FIELDS = [
  { head: 'মূল স্থিতি' },
  { key: 'samiti',                 label: 'সমিতি',              int: true },
  { key: 'member_total',           label: 'সদস্য',               int: true },
  { key: 'loanee_total',           label: 'ঋণী',                 int: true },
  { key: 'savings_total',          label: 'সঞ্চয় স্থিতি' },
  { key: 'loan_total',             label: 'ঋণ স্থিতি' },
  { key: 'overdue_total',          label: 'সাধারণ বকেয়া' },
  { key: 'cash_in_hand',           label: 'হাতে নগদ' },
  { key: 'bank',                   label: 'ব্যাংক' },

  { head: 'লাভ / ক্ষতি' },
  { key: 'profit_this_month',      label: 'এ মাস' },
  { key: 'profit_this_year',       label: 'এ বছর' },
  { key: 'profit_to_date',         label: 'এ পর্যন্ত' },

  { head: 'বিতরণ' },
  { key: 'dis_month_count',        label: 'সংখ্যা',              int: true },
  { key: 'dis_month_amount',       label: 'টাকা' },

  { head: 'সঞ্চয় লভ্যাংশ ও কিস্তি' },
  { key: 'dividend_count',         label: 'সংখ্যা',              int: true },
  { key: 'dividend_amount',        label: 'সঞ্চয় লভ্যাংশ' },
  { key: 'monthly_kisti_count',    label: 'মাসিক কিস্তির সংখ্যা', int: true },

  { head: 'আদায় ও বকেয়া' },
  { key: 'recoverable',            label: 'আদায়যোগ্য' },
  { key: 'recovered',              label: 'আদায়কৃত' },
  { key: 'passed_this_month',      label: 'এ মাসে পার' },
  { key: 'writeoff_recovery',      label: 'রাইট অফ আদায়' },
  { key: 'overdue_this_month',     label: 'এ মাসে মোট বকেয়া (সংখ্যা)',   int: true },
  { key: 'llp',                    label: 'LLP' },
  { key: 'overdue_running',        label: 'এ মাসে চলতি বকেয়া (সংখ্যা)', int: true },
  { key: 'overdue_new',            label: 'এ মাসে নতুন' },
  { key: 'ex_recovery_count',      label: 'Ex Recovery (সংখ্যা)',        int: true },
  { key: 'ex_recovery',            label: 'Ex Recovery (টাকা)' },

  // এই ঘরগুলো আলাদা আলাদা হেডিং ছাড়া পরপর বসে, তাই লাইনে ফাঁক থাকে না
  { head: 'কল্যাণ তহবিল, ঋণ আদায়, ডিপিএস ও সঞ্চয়' },
  { key: 'welfare_return_count',    label: 'কল্যাণ তহবিল ফেরত — সংখ্যা', int: true },
  { key: 'welfare_return_amount',   label: 'কল্যাণ তহবিল ফেরত — টাকা' },
  { key: 'loan_recovery_principal', label: 'ঋণ আদায় এ মাস — ঋণ' },
  { key: 'loan_recovery_service',   label: 'ঋণ আদায় এ মাস — সাঃচার্জ' },
  { key: 'dps_new_count',           label: 'ডিপিএস নতুন — সংখ্যা', int: true },
  { key: 'dps_new_amount',          label: 'ডিপিএস নতুন — টাকা' },
  { key: 'dps_return_count',        label: 'পূর্ণ ডিপিএস ফেরত — সংখ্যা', int: true },
  { key: 'dps_return_amount',       label: 'পূর্ণ ডিপিএস ফেরত — টাকা' },
  { key: 'savings_collection',      label: 'সঞ্চয় — আদায়' },
  { key: 'savings_refund',          label: 'সঞ্চয় — ফেরত' }
];

const MC_KEYS = MC_FIELDS.filter((f) => f.key).map((f) => f.key);

/* ---------- formatting helpers ---------- */

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
const BN_MONTHS = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
];

const toBnDigits = (value) => String(value).replace(/\d/g, (d) => BN_DIGITS[+d]);

const nf = new Intl.NumberFormat('en-IN');
const blank = (n) => n === null || n === undefined || n === '' || Number.isNaN(Number(n));
const fmt = (n) => (blank(n) ? '—' : nf.format(Number(n)));
const money = (n) => (blank(n) ? '—' : `৳ ${nf.format(Number(n))}`);
const pct = (n) => (blank(n) ? '—' : `${Number(n).toFixed(2)}%`);
const numOrNull = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

function formatDateBn(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return iso || '';
  return `${toBnDigits(+m[3])} ${BN_MONTHS[+m[2] - 1]} ${toBnDigits(m[1])}`;
}

function formatMonthBn(ym) {
  const m = /^(\d{4})-(\d{2})/.exec(ym || '');
  if (!m) return ym || '';
  return `${BN_MONTHS[+m[2] - 1]}-${toBnDigits(m[1])}`;
}

function deltaCell(n) {
  if (blank(n)) return '<span class="delta flat">—</span>';
  const v = Number(n);
  const cls = v > 0 ? 'up' : v < 0 ? 'down' : 'flat';
  return `<span class="delta ${cls}">${v < 0 ? '−' : v > 0 ? '+' : ''}${nf.format(Math.abs(v))}</span>`;
}

/* ---------- toast ---------- */

function toast(message, kind = 'info') {
  const stack = $('#toastStack');
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = message;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

/* ---------- data access ---------- */

async function loadSeed() {
  if (state.seed) return state.seed;
  try {
    const res = await fetch('data/seed.json', { cache: 'no-cache' });
    state.seed = res.ok ? await res.json() : { branches: [], daily: {}, compare: null, closing: null };
  } catch {
    state.seed = { branches: [], daily: {}, compare: null, closing: null };
  }
  return state.seed;
}

async function apiGet(path) {
  try {
    const res = await fetch(`/api/${path}`, { headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    const body = await res.json();
    return body && body.error ? null : body;
  } catch {
    return null;
  }
}

async function apiPost(path, payload) {
  const res = await fetch(`/api/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  let body = null;
  try { body = await res.json(); } catch { /* non-JSON error page */ }
  if (!res.ok) throw new Error(body?.message || body?.error || `HTTP ${res.status}`);
  return body;
}

function setSource(source) {
  state.source = source;
  const el = $('#sourceBadge');
  if (source === 'live') {
    el.className = 'badge';
    el.textContent = '● লাইভ ডাটাবেস';
    el.title = 'ডেটা Neon Postgres থেকে আসছে';
  } else {
    el.className = 'badge warn';
    el.textContent = '● ডেমো ডেটা';
    el.title = 'API-তে পৌঁছানো যায়নি — data/seed.json থেকে দেখানো হচ্ছে';
  }
}

/* ---------- daily row normaliser (API নাম ও seed নাম দুটোই বোঝে) ---------- */

function normalizeDaily(row) {
  const pick = (...vals) => vals.find((v) => v !== undefined && v !== null) ?? null;
  const branch = pick(row.branch, row.branch_name, '');
  return {
    branch,
    bn: pick(row.bn_name, state.bnLookup[branch], branch),
    members: pick(row.actual_member, row.members),
    loanee: pick(row.actual_loanee, row.loanee),
    savings: pick(row.savings),
    kisti: pick(row.kisti_count, row.kisti),
    kistiTotal: pick(row.kisti_total, row.kistiTotal),
    collection: pick(row.today_collection, row.collection),
    disbursement: pick(row.today_disbursement, row.disbursement),
    loan: pick(row.loan_outstanding, row.loan),
    overdue: pick(row.overdue_outstanding, row.overdue),
    recovery: pick(row.recovery_rate, row.recovery),
    cash: pick(row.cash_in_hand, row.cash),
    bank: pick(row.bank)
  };
}

async function dailyFor(date) {
  if (!date) return [];
  const live = await apiGet(`daily?date=${encodeURIComponent(date)}`);
  if (Array.isArray(live) && live.length) {
    setSource('live');
    return live.map(normalizeDaily);
  }
  if (state.live) return [];          // ডাটাবেস চালু — ওই দিনে কিছু নেই মানে সত্যিই নেই
  const seedRows = state.seed?.daily?.[date] || [];
  if (seedRows.length) setSource('demo');
  return seedRows.map(normalizeDaily);
}

/* ==========================================================================
   bootstrap
   ========================================================================== */

async function bootstrap() {
  await loadSeed();
  state.bnLookup = Object.fromEntries((state.seed.branches || []).map((b) => [b.name, b.bn_name]));

  const liveBranches = await apiGet('branches');
  const isLive = Array.isArray(liveBranches) && liveBranches.length > 0;
  state.live = isLive;
  state.branches = isLive ? liveBranches : (state.seed.branches || []);
  state.branches.forEach((b) => { if (b.bn_name) state.bnLookup[b.name] = b.bn_name; });
  setSource(isLive ? 'live' : 'demo');

  // ডাটাবেস চালু থাকলে শুধু ডাটাবেসের তারিখ/মাস — seed মেশালে না-থাকা মাসও তালিকায় আসত
  const liveDates = await apiGet('daily/dates');
  const seedDates = Object.keys(state.seed.daily || {});
  state.dates = (isLive ? (liveDates || []) : seedDates).slice().sort().reverse();

  const liveMonths = await apiGet('month-close/months');
  const seedMonth = state.seed.closing?.month ? [state.seed.closing.month.slice(0, 7)] : [];
  state.months = (isLive ? (liveMonths || []) : seedMonth).slice().sort().reverse();

  buildClosingForm();
  fillBranchSelects();
  fillEntryDefaults();
  fillCompareSelects();
  fillMonthSelect();

  setupAdmin();
  setupCellEdit();
  setupWho();
  startVisitPing();
  startLiveSync();
  $('#stRefresh').onclick = () => { refreshStats(); loadHistory(); };
  await loadNotice();
  setupArrowNav();
  setupListCalendar();
  fillListMonths();
  setListDate(todayIso(), true);
  await Promise.all([refreshCompare(), refreshClosingSheet(), refreshEntryList()]);
}

/* ---------- selects ---------- */

function fillBranchSelects() {
  const label = (b) => (b.bn_name ? `${b.name} — ${b.bn_name}` : b.name);
  ['#deBranch', '#mcBranch'].forEach((sel) => {
    const el = $(sel);
    el.innerHTML = '';
    state.branches.forEach((b) => el.add(new Option(label(b), b.name)));
  });
}

function fillEntryDefaults() {
  $('#deDate').value = todayIso();
  $('#mcMonth').value = thisMonthIso();
}

/** চলতি মাসের সব তারিখ — এন্ট্রি থাক বা না থাক, ফিল্টারে সবগুলোই থাকবে */
function monthDates(ym) {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const out = [];
  for (let d = 1; d <= last; d++) out.push(`${ym}-${String(d).padStart(2, '0')}`);
  return out;
}

function fillCompareSelects() {
  const today = todayIso();
  setCompareDate(state.dates[0] || today, true);
}

/* ---------- ক্লিক করলেই বেছে নেওয়া ক্যালেন্ডার ---------- */

let calCursor = '';   // ক্যালেন্ডারে যে মাসটা এখন দেখানো হচ্ছে

/** ক্যালেন্ডার ইংরেজিতে: 28 Sep 2026 */
function formatDateEn(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return '—';
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(m[3])} ${MON[+m[2] - 1]} ${m[1]}`;
}

function setCompareDate(iso, silent) {
  $('#cmpDate').value = iso || '';
  $('#cmpDateText').textContent = iso ? formatDateEn(iso) : '—';
  calCursor = (iso || todayIso()).slice(0, 7);
  if (!silent) refreshCompare();
}

function renderCalendar() {
  const [y, m] = calCursor.split('-').map(Number);
  const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  $('#calTitle').textContent = `${MONTHS_EN[m - 1]} ${y}`;

  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const sel = $('#cmpDate').value;
  const today = todayIso();

  let html = '';
  for (let i = 0; i < first; i++) html += '<span class="cal-cell blank"></span>';
  for (let d = 1; d <= last; d++) {
    const iso = `${calCursor}-${String(d).padStart(2, '0')}`;
    const cls = [
      'cal-cell',
      iso === sel ? 'sel' : '',
      iso === today ? 'today' : '',
      state.dates.includes(iso) ? 'has' : ''
    ].filter(Boolean).join(' ');
    html += `<button type="button" class="${cls}" data-date="${iso}">${d}</button>`;
  }
  $('#calGrid').innerHTML = html;
}

function openCalendar(show) {
  const pop = $('#cmpCal');
  if (show) { renderCalendar(); pop.hidden = false; } else pop.hidden = true;
}

function setupCalendar() {
  $('#cmpDateBtn').onclick = (e) => {
    e.stopPropagation();
    openCalendar($('#cmpCal').hidden);
  };

  $('#cmpCal').addEventListener('click', (e) => {
    e.stopPropagation();
    const nav = e.target.closest('[data-cal]');
    if (nav) {
      const [y, m] = calCursor.split('-').map(Number);
      const d = new Date(Date.UTC(y, m - 1 + (nav.dataset.cal === 'next' ? 1 : -1), 1));
      calCursor = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      renderCalendar();
      return;
    }
    const cell = e.target.closest('.cal-cell[data-date]');
    if (cell) {
      // এক ক্লিকেই বাছাই — আলাদা করে OK চাপতে হবে না
      setCompareDate(cell.dataset.date);
      openCalendar(false);
    }
  });

  document.addEventListener('click', () => openCalendar(false));
}

function fillMonthSelect() {
  const el = $('#mcsMonth');
  el.innerHTML = '';
  state.months.forEach((m) => el.add(new Option(formatMonthBn(m), m)));
}

/* ==========================================================================
   PAGE 1 — এন্ট্রি ফর্ম
   ========================================================================== */

function buildClosingForm() {
  $('#mcFields').innerHTML = MC_FIELDS.map((f) => {
    if (f.head) return `<div class="group-head">${f.head}</div>`;
    const step = f.int ? '1' : '0.01';
    const mode = f.int ? 'numeric' : 'decimal';
    return `<label class="field"><span>${f.label}</span>
      <input type="number" step="${step}" inputmode="${mode}" data-mc="${f.key}" /></label>`;
  }).join('');
}

const DAILY_INPUTS = {
  actual_member: '#deMember',
  actual_loanee: '#deLoanee',
  savings: '#deSavings',
  today_disbursement: '#deDisbursement',
  kisti_count: '#deKisti',
  loan_outstanding: '#deLoanOut',
  overdue_outstanding: '#deOverdue',
  recovery_rate: '#deRecovery',
  cash_in_hand: '#deCash',
  bank: '#deBank'
};

function clearDailyForm() {
  Object.values(DAILY_INPUTS).forEach((sel) => { $(sel).value = ''; });
}

function clearClosingForm() {
  $$('#mcFields input[data-mc]').forEach((el) => { el.value = ''; });
}

/* ---------- Edit: যেকোনো তারিখ / মাসের এন্ট্রি ---------- */

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const thisMonthIso = () => todayIso().slice(0, 7);

function setBadge(sel, kind, text) {
  const el = $(sel);
  el.className = `badge ${kind}`;
  el.textContent = text;
}

/** ফর্ম নিজে থেকে কিছু লোড করে না — Edit চাপলেই কেবল আগের তথ্য আসে */
async function editDaily() {
  const date = $('#deDate').value;
  const branch = $('#deBranch').value;
  if (!date || !branch) return toast('তারিখ ও শাখা নির্বাচন করুন', 'err');

  const btn = $('#deEdit');
  btn.disabled = true;
  try {
    const rows = await apiGet(`daily?date=${encodeURIComponent(date)}`);
    const row = Array.isArray(rows) ? rows.find((r) => r.branch === branch) : null;
    if (!row) {
      setBadge('#dailyLoadBadge', 'muted', 'নতুন এন্ট্রি');
      return toast('এই তারিখে এই শাখার কোনো এন্ট্রি নেই', 'warn');
    }
    Object.entries(DAILY_INPUTS).forEach(([key, sel]) => {
      $(sel).value = row[key] === null || row[key] === undefined ? '' : row[key];
    });
    setBadge('#dailyLoadBadge', 'info', 'এডিট মোড — সেভ করলে আপডেট হবে');
    toast('আগের তথ্য লোড হয়েছে', 'ok');
  } finally {
    btn.disabled = false;
  }
}

async function editClosing() {
  const month = $('#mcMonth').value;
  const branch = $('#mcBranch').value;
  if (!month || !branch) return toast('মাস ও শাখা নির্বাচন করুন', 'err');

  const btn = $('#mcEdit');
  btn.disabled = true;
  try {
    const rows = await apiGet(`month-close?month=${encodeURIComponent(month)}`);
    const row = Array.isArray(rows) ? rows.find((r) => r.branch === branch) : null;
    if (!row) {
      setBadge('#mcLoadBadge', 'muted', 'নতুন এন্ট্রি');
      return toast('এই মাসে এই শাখার কোনো ক্লোজিং নেই', 'warn');
    }
    const data = { ...(row.closing || {}), monthly_kisti_count: row.monthly_kisti_count };
    $$('#mcFields input[data-mc]').forEach((el) => {
      const v = data[el.dataset.mc];
      el.value = v === null || v === undefined ? '' : v;
    });
    setBadge('#mcLoadBadge', 'info', 'এডিট মোড — সেভ করলে আপডেট হবে');
    toast('আগের তথ্য লোড হয়েছে', 'ok');
  } finally {
    btn.disabled = false;
  }
}


async function submitDaily(ev) {
  ev.preventDefault();
  const btn = $('#deSave');
  const payload = {
    entry_date: $('#deDate').value,
    branch: $('#deBranch').value
  };
  Object.entries(DAILY_INPUTS).forEach(([key, sel]) => { payload[key] = numOrNull($(sel).value); });

  if (!payload.entry_date) return toast('তারিখ দিন', 'err');
  if (!payload.branch) return toast('শাখা নির্বাচন করুন', 'err');

  btn.disabled = true;
  btn.textContent = 'সেভ হচ্ছে…';
  try {
    await apiPost('daily', payload);
    toast(`${payload.branch} — ${formatDateBn(payload.entry_date)} সেভ হয়েছে`, 'ok');
    markLocalChange();
    clearDailyForm();
    setBadge('#dailyLoadBadge', 'muted', 'নতুন এন্ট্রি');
    if ($('#listDate').value === payload.entry_date) refreshEntryList();
    if (!state.dates.includes(payload.entry_date)) {
      state.dates = [...state.dates, payload.entry_date].sort().reverse();
      refreshCompare();
    }
    await refreshCompare();
  } catch (err) {
    toast(`সেভ করা যায়নি: ${err.message}`, 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save';
  }
}

async function submitClosing(ev) {
  ev.preventDefault();
  const btn = $('#mcSave');
  const closing = {};
  $$('#mcFields input[data-mc]').forEach((el) => { closing[el.dataset.mc] = numOrNull(el.value); });

  const payload = {
    month: $('#mcMonth').value,
    branch: $('#mcBranch').value,
    monthly_kisti_count: closing.monthly_kisti_count,
    closing
  };

  if (!payload.month) return toast('মাস নির্বাচন করুন', 'err');
  if (!payload.branch) return toast('শাখা নির্বাচন করুন', 'err');

  btn.disabled = true;
  btn.textContent = 'সেভ হচ্ছে…';
  try {
    await apiPost('month-close', payload);
    toast(`${payload.branch} — ${formatMonthBn(payload.month)} ক্লোজিং সেভ হয়েছে`, 'ok');
    markLocalChange();
    clearClosingForm();
    setBadge('#mcLoadBadge', 'muted', 'নতুন এন্ট্রি');
    fillListMonths();
    if ($('#listMonth').value === payload.month) refreshClosingList();
    if (!state.months.includes(payload.month)) {
      state.months = [...state.months, payload.month].sort().reverse();
      fillMonthSelect();
    }
    $('#mcsMonth').value = payload.month;
    await refreshClosingSheet();
  } catch (err) {
    toast(`সেভ করা যায়নি: ${err.message}`, 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save';
  }
}

/* ==========================================================================
   PAGE 2 — COMPARE
   ========================================================================== */

async function refreshCompare() {
  const to = $('#cmpDate').value;
  // ভিত্তি = আগের মাসের ক্লোজিং (মাসের শেষ দিন), ডেইলি এন্ট্রি নয়
  const baseMonth = to ? prevMonth(to.slice(0, 7)) : '';
  const from = baseMonth ? monthEndDate(baseMonth) : '';
  const sheetDate = (iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return '—';
    const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${m[3]}-${MON[+m[2] - 1]}-${m[1].slice(2)}`;
  };
  $$('.cmp-from').forEach((el) => { el.textContent = sheetDate(from); });
  $$('.cmp-to').forEach((el) => { el.textContent = sheetDate(to); });

  if (to) {
    const d = new Date(`${to}T00:00:00`);
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    $('#cmpMonthLabel').textContent = `Month-${MONTHS[d.getMonth()]}-${to.slice(2, 4)}`;
    $('#cmpDateLabel').textContent = sheetDate(to);
    $('#cmpDayLabel').textContent = DAYS[d.getDay()];
  }

  if (!from || !to) {
    $('#compareRows').innerHTML = '<tr><td colspan="25" class="empty">তারিখ নির্বাচন করুন</td></tr>';
    $('#compareFoot').innerHTML = '';
    return;
  }

  const [toRows, baseClosings, monthRows] = await Promise.all([
    dailyFor(to),
    apiGet(`month-close?month=${encodeURIComponent(baseMonth)}`),
    apiGet(`daily?month=${encodeURIComponent(to.slice(0, 7))}`)
  ]);

  /* মাসিক কিস্তি আদায় (Aday):
     শিট থেকে আসা রোগুলোতে মানটা মাসের চলতি যোগফল, আর ফর্ম থেকে দেওয়া নতুন
     এন্ট্রিতে সেদিনের সংখ্যা। তাই = নির্বাচিত দিন পর্যন্ত শেষ চলতি-যোগফল
     + তার পরের দিনগুলোর এন্ট্রি যোগ। */
  const adayOf = new Map();
  const disOf = new Map();
  if (Array.isArray(monthRows)) {
    const upto = monthRows.filter((r) => r.entry_date <= to);
    const byBr = new Map();
    upto.forEach((r) => {
      if (!byBr.has(r.branch)) byBr.set(r.branch, []);
      byBr.get(r.branch).push(r);
    });
    byBr.forEach((list, br) => {
      list.sort((a, b) => a.entry_date.localeCompare(b.entry_date));
      let base = 0;
      let baseDate = '';
      list.forEach((r) => {
        if (r.kisti_cumulative && !blank(r.kisti_count)) {
          base = Number(r.kisti_count);
          baseDate = r.entry_date;
        }
      });
      const added = list
        .filter((r) => !r.kisti_cumulative && r.entry_date > baseDate && !blank(r.kisti_count))
        .reduce((a, r) => a + Number(r.kisti_count), 0);
      adayOf.set(br, base + added);

      /* Dis (মোট বিতরণ) একই নিয়মে:
         শিট থেকে আসা রোতে grant_total_disbursement মাসের চলতি মোট,
         আর নতুন এন্ট্রিতে সেদিনের "Today Disbursement" — দুটো যোগ হয় */
      let disBase = 0;
      let disDate = '';
      list.forEach((r) => {
        if (r.kisti_cumulative && !blank(r.grant_total_disbursement)) {
          disBase = Number(r.grant_total_disbursement);
          disDate = r.entry_date;
        }
      });
      const disAdded = list
        .filter((r) => r.entry_date > disDate && !blank(r.today_disbursement))
        .reduce((a, r) => a + Number(r.today_disbursement), 0);
      disOf.set(br, disBase + disAdded);
    });
  }

  /* ভিত্তি কলামগুলো (Member / Loanee / Savings / Outstanding / overdue Up To /
     Monthly Total) আগের মাসের ক্লোজিং থেকে আসে — CSV-তে এগুলোই দেওয়া থাকে */
  const base = new Map();
  const kistiTarget = new Map();
  (Array.isArray(baseClosings) ? baseClosings : []).forEach((row) => {
    const c = normalizeClosing(row);
    base.set(c.branch, {
      members: c.member_total,
      loanee: c.loanee_total,
      savings: c.savings_total,
      loan: c.loan_total,
      overdue: c.overdue_total,
      weekly: c.weekly_loanee
    });
    const k = c.monthly_kisti_count;
    if (!blank(k)) kistiTarget.set(c.branch, Number(k));
  });

  const byBranch = new Map();
  const touch = (name, bn) => {
    if (!byBranch.has(name)) byBranch.set(name, { branch: name, bn: bn || state.bnLookup[name] });
    return byBranch.get(name);
  };
  base.forEach((val, name) => { touch(name).a = val; });
  toRows.forEach((r) => { touch(r.branch, r.bn).b = r; });

  const rows = orderRows([...byBranch.values()]);
  state.compareRows = rows;
  $('#cmpSource').className = state.source === 'live' ? 'badge' : 'badge warn';
  $('#cmpSource').textContent = state.source === 'live' ? '● লাইভ ডাটাবেস' : '● ডেমো ডেটা';

  const v = (r, side, key) => {
    const x = r[side] ? r[side][key] : null;
    return blank(x) ? 0 : Number(x);
  };
  const diff = (r, key) => v(r, 'b', key) - v(r, 'a', key);

  /* প্রতি শাখার হিসাব করা মানগুলো একবারেই বের করে রাখি */
  const calc = (r) => {
    const fromDaily = v(r, 'b', 'kistiTotal');
    const total = fromDaily || (kistiTarget.has(r.branch) ? kistiTarget.get(r.branch) : 0);
    const aday = adayOf.has(r.branch) ? adayOf.get(r.branch) : v(r, 'b', 'kisti');
    return {
      total,
      aday,
      due: total - aday,
      pct: total ? Math.round((aday / total) * 100) : 0,
      dis: disOf.has(r.branch) ? disOf.get(r.branch) : v(r, 'b', 'disbursement'),
      otr: v(r, 'b', 'recovery'),
      cash: v(r, 'b', 'cash'),
      bank: v(r, 'b', 'bank')
    };
  };
  rows.forEach((r) => { r.calc = calc(r); });

  const nCell = (n, cls) => `<td class="${cls}">${nf.format(n)}</td>`;
  const dCell = (n) => `<td class="c-delta ${n < 0 ? 'neg' : n > 0 ? 'pos' : ''}">${nf.format(n)}</td>`;

  /* অ্যাডমিনের সম্পাদনার জন্য:
     শুরুর কলাম ও Monthly/Weekly → আগের মাসের ক্লোজিং
     শেষ তারিখের কলামগুলো → ওই দিনের ডেইলি এন্ট্রি */
  const EC = (r, key, val, cls) =>
    `<td class="${cls || ''}" data-e="closing" data-m="${baseMonth}" data-b="${r.branch}" data-f="${key}" data-raw="${blank(val) ? '' : val}">${nf.format(Number(val) || 0)}</td>`;
  const ED = (r, key, val, cls) =>
    `<td class="${cls || ''}" data-e="daily" data-d="${to}" data-b="${r.branch}" data-f="${key}" data-raw="${blank(val) ? '' : val}">${nf.format(Number(val) || 0)}</td>`;
  const CLOSE_KEY = { members: 'member_total', loanee: 'loanee_total', savings: 'savings_total', loan: 'loan_total', overdue: 'overdue_total' };
  const DAILY_KEY = { members: 'actual_member', loanee: 'actual_loanee', savings: 'savings', loan: 'loan_outstanding', overdue: 'overdue_outstanding' };

  $('#compareRows').innerHTML = rows.length ? rows.map((r) => `<tr>
      <td class="c-branch">${r.branch}</td>
      ${['members', 'loanee', 'savings', 'loan'].map((k) =>
        EC(r, CLOSE_KEY[k], v(r, 'a', k), 'c-from')
        + ED(r, DAILY_KEY[k], v(r, 'b', k), 'c-to')
        + dCell(diff(r, k))).join('')}
      ${ED(r, 'recovery_rate', r.calc.otr, 'c-yellow')}
      ${ED(r, 'grant_total_disbursement', r.calc.dis, 'c-yellow')}
      ${EC(r, 'monthly_kisti_count', r.calc.total, 'c-blue2')}
      ${ED(r, 'kisti_count', r.calc.aday, 'c-yellow')}
      <td>${nf.format(r.calc.due)}</td>
      ${EC(r, 'overdue_total', v(r, 'a', 'overdue'), 'c-from')}${ED(r, 'overdue_outstanding', v(r, 'b', 'overdue'), 'c-to')}${dCell(diff(r, 'overdue'))}
      ${ED(r, 'cash_in_hand', r.calc.cash, 'c-yellow')}
      ${ED(r, 'bank', r.calc.bank, 'c-yellow')}
      <td>${r.calc.pct}%</td>
      ${EC(r, 'weekly_loanee', r.a?.weekly, '')}
    </tr>`).join('')
    : `<tr><td colspan="25" class="empty">${baseMonth ? `${formatMonthBn(baseMonth)} মাসের ক্লোজিং নেই — ভিত্তি কলাম ভরতে সেটা দরকার` : 'কোনো তথ্য নেই'}</td></tr>`;

  renderCompareCards(rows, v, sheetDate(from), sheetDate(to));

  const tot = (side, key) => rows.reduce((a, r) => a + v(r, side, key), 0);
  const totc = (key) => rows.reduce((a, r) => a + (Number(r.calc[key]) || 0), 0);
  const pctTotal = totc('total') ? Math.round((totc('aday') / totc('total')) * 100) : 0;

  $('#compareFoot').innerHTML = rows.length ? `<tr>
      <td class="c-branch">Total</td>
      ${['members', 'loanee', 'savings', 'loan'].map((k) =>
        `<td>${nf.format(tot('a', k))}</td><td>${nf.format(tot('b', k))}</td>
         <td class="c-delta ${tot('b', k) - tot('a', k) < 0 ? 'neg' : ''}">${nf.format(tot('b', k) - tot('a', k))}</td>`).join('')}
      <td>${nf.format(Math.round(totc('otr')))}</td>
      <td>${nf.format(totc('dis'))}</td>
      <td>${nf.format(totc('total'))}</td>
      <td>${nf.format(totc('aday'))}</td>
      <td>${nf.format(totc('due'))}</td>
      <td>${nf.format(tot('a', 'overdue'))}</td>
      <td>${nf.format(tot('b', 'overdue'))}</td>
      <td class="c-delta ${tot('b', 'overdue') - tot('a', 'overdue') < 0 ? 'neg' : ''}">${nf.format(tot('b', 'overdue') - tot('a', 'overdue'))}</td>
      <td>${nf.format(totc('cash'))}</td>
      <td>${nf.format(totc('bank'))}</td>
      <td>${pctTotal}%</td>
      <td>${nf.format(rows.reduce((a, r) => a + (Number(r.a?.weekly) || 0), 0))}</td>
    </tr>` : '';
}

/** মোবাইল ভিউ — একই টেবিল দুই ভাগে, দুটোতেই প্রথম কলাম Branch */
function renderCompareCards(rows, v, fromLabel, toLabel) {
  const box = $('#compareCards');
  if (!box) return;
  if (!rows.length) { box.innerHTML = ''; return; }

  const N = (x) => nf.format(Math.round(Number(x) || 0));
  const cell = (n, cls) => `<td class="${cls}">${N(n)}</td>`;
  const dcell = (n) => `<td class="c-delta ${n < 0 ? 'neg' : n > 0 ? 'pos' : ''}">${N(n)}</td>`;
  const tot = (side, key) => rows.reduce((a, r) => a + v(r, side, key), 0);
  const totc = (key) => rows.reduce((a, r) => a + (Number(r.calc[key]) || 0), 0);
  const groups = ['members', 'loanee', 'savings', 'loan'];

  /* ---------- উপরের টেবিল: Branch → Diferent ---------- */
  const head1 = `
    <thead>
      <tr>
        <th rowspan="2">Branch</th>
        <th colspan="2">Member</th><th rowspan="2">Inc / Dec</th>
        <th colspan="2">Loanee</th><th rowspan="2">Inc / Dec</th>
        <th colspan="2">Savings</th><th rowspan="2">Inc / Dec</th>
        <th colspan="2">Outstading</th><th rowspan="2">Diferent</th>
      </tr>
      <tr>
        ${[0, 1, 2, 3].map(() =>
          `<th class="h-from">${fromLabel}</th><th class="h-to">${toLabel}</th>`).join('')}
      </tr>
    </thead>`;

  const body1 = rows.map((r) => `<tr>
      <td class="c-branch">${r.branch}</td>
      ${groups.map((k) =>
        cell(v(r, 'a', k), 'c-from') + cell(v(r, 'b', k), 'c-to') + dcell(v(r, 'b', k) - v(r, 'a', k))
      ).join('')}
    </tr>`).join('');

  const foot1 = `<tr>
      <td class="c-branch">Total</td>
      ${groups.map((k) =>
        `<td>${N(tot('a', k))}</td><td>${N(tot('b', k))}</td>` +
        `<td class="c-delta ${tot('b', k) - tot('a', k) < 0 ? 'neg' : ''}">${N(tot('b', k) - tot('a', k))}</td>`
      ).join('')}
    </tr>`;

  /* ---------- নিচের টেবিল: Branch + O.T.R → Weekly Loney ---------- */
  const head2 = `
    <thead>
      <tr>
        <th rowspan="2">Branch</th>
        <th rowspan="2">O.T.R</th>
        <th rowspan="2">Dis</th>
        <th colspan="2">Monthly</th>
        <th rowspan="2">Due</th>
        <th colspan="2">overdue</th>
        <th rowspan="2">Inc / Dec</th>
        <th rowspan="2">Cash In Hand</th>
        <th rowspan="2">BANK</th>
        <th rowspan="2">Monthly Kisti Aday ( % )</th>
        <th rowspan="2">Weekly Loney</th>
      </tr>
      <tr>
        <th>Total</th><th>Aday</th>
        <th class="h-from">Up To</th><th class="h-to">This Month</th>
      </tr>
    </thead>`;

  const body2 = rows.map((r) => `<tr>
      <td class="c-branch">${r.branch}</td>
      <td class="c-yellow">${N(r.calc.otr)}</td>
      <td class="c-yellow">${N(r.calc.dis)}</td>
      <td class="c-blue2">${N(r.calc.total)}</td>
      <td class="c-yellow">${N(r.calc.aday)}</td>
      <td>${N(r.calc.due)}</td>
      ${cell(v(r, 'a', 'overdue'), 'c-from')}${cell(v(r, 'b', 'overdue'), 'c-to')}
      ${dcell(v(r, 'b', 'overdue') - v(r, 'a', 'overdue'))}
      <td class="c-yellow">${N(r.calc.cash)}</td>
      <td class="c-yellow">${N(r.calc.bank)}</td>
      <td>${r.calc.pct}%</td>
      <td>${blank(r.a?.weekly) ? '—' : N(r.a.weekly)}</td>
    </tr>`).join('');

  const pctTotal = totc('total') ? Math.round((totc('aday') / totc('total')) * 100) : 0;
  const foot2 = `<tr>
      <td class="c-branch">Total</td>
      <td>${N(Math.round(totc('otr')))}</td>
      <td>${N(totc('dis'))}</td>
      <td>${N(totc('total'))}</td>
      <td>${N(totc('aday'))}</td>
      <td>${N(totc('due'))}</td>
      <td>${N(tot('a', 'overdue'))}</td>
      <td>${N(tot('b', 'overdue'))}</td>
      <td class="c-delta ${tot('b', 'overdue') - tot('a', 'overdue') < 0 ? 'neg' : ''}">${N(tot('b', 'overdue') - tot('a', 'overdue'))}</td>
      <td>${N(totc('cash'))}</td>
      <td>${N(totc('bank'))}</td>
      <td>${pctTotal}%</td>
      <td>${N(rows.reduce((a, r) => a + (Number(r.a?.weekly) || 0), 0))}</td>
    </tr>`;

  box.innerHTML = `
    <div class="cmp-part">
      <table class="cmp-table split" id="tblCmpA">${head1}<tbody>${body1}</tbody><tfoot>${foot1}</tfoot></table>
    </div>
    <div class="cmp-part">
      <table class="cmp-table split" id="tblCmpB">${head2}<tbody>${body2}</tbody><tfoot>${foot2}</tfoot></table>
    </div>`;
  relabel();
}

function compareCsv() {
  const head = ['Branch', 'Member From', 'Member To', 'Inc/Dec', 'Loanee From', 'Loanee To', 'Inc/Dec',
    'Savings From', 'Savings To', 'Inc/Dec', 'Outstanding From', 'Outstanding To', 'Diferent',
    'OTR', 'Dis', 'Monthly Total', 'Monthly Aday', 'Due',
    'Overdue Up To', 'Overdue This Month', 'Inc/Dec', 'Cash In Hand', 'BANK', 'Monthly Kisti Aday %', 'Weekly Loanee'];
  const g = (r, side, key) => {
    const x = r[side] ? r[side][key] : null;
    return blank(x) ? 0 : Number(x);
  };
  // (r.a = আগের মাসের ক্লোজিং, r.b = নির্বাচিত দিনের ডেইলি এন্ট্রি)
  const body = state.compareRows.map((r) => [
    r.branch,
    ...['members', 'loanee', 'savings', 'loan'].flatMap((k) => [g(r, 'a', k), g(r, 'b', k), g(r, 'b', k) - g(r, 'a', k)]),
    r.calc.otr, r.calc.dis, r.calc.total, r.calc.aday, r.calc.due,
    g(r, 'a', 'overdue'), g(r, 'b', 'overdue'), g(r, 'b', 'overdue') - g(r, 'a', 'overdue'),
    r.calc.cash, r.calc.bank, `${r.calc.pct}%`, (r.a && r.a.weekly) || 0
  ].join(','));
  downloadCsv([head.join(','), ...body].join('\n'), `compare-${$('#cmpDate').value}.csv`);
}

/* ==========================================================================
   PAGE 3 — MONTH CLOSING সিট
   ========================================================================== */

/* পুরনো (sheet.xlsx থেকে আসা) কি-নাম → নতুন ফর্মের কি-নাম */
const LEGACY_ALIASES = {
  dis_month_count:       ['disbursement_count'],
  dis_month_amount:      ['disbursement_amount'],
  recoverable:           ['recovery.receivable'],
  recovered:             ['recovery.recovered'],
  writeoff_recovery:     ['recovery.write_off_recovered'],
  passed_this_month:     ['recovery.par_current'],
  overdue_this_month:    ['recovery.overdue_current'],
  llp:                   ['recovery.llp'],
  overdue_new:           ['recovery.new_this_month'],
  overdue_running:       ['recovery.current_due_now'],
  otr_current:           ['recovery.otr']
};

/** month_closings রো → সমতল অবজেক্ট (পুরনো seed কি-নামগুলোও বোঝে) */
function normalizeClosing(row, index) {
  const c = row.closing || row;
  const dig = (obj, path) => path.split('.').reduce((o, k) => (o == null ? null : o[k]), obj);
  const get = (...keys) => {
    for (const k of keys) {
      const v = k.includes('.') ? dig(c, k) : c[k];
      if (v !== undefined && v !== null) return v;
    }
    for (const k of keys) {
      for (const alias of (LEGACY_ALIASES[k] || [])) {
        const v = dig(c, alias);
        if (v !== undefined && v !== null) return v;
      }
    }
    return null;
  };
  const out = {
    sl: index + 1,
    branch: row.branch || row.branch_name || '',
    branch_bn: row.bn_name || row.branch_bn || state.bnLookup[row.branch] || row.branch || '',
    monthly_kisti_count: row.monthly_kisti_count ?? get('monthly_kisti_count')
  };
  MC_KEYS.forEach((k) => { out[k] = get(k); });
  // OTR ফর্মে আর চাওয়া হয় না — পুরনো ডেটায় থাকলে দেখাই, না থাকলে হিসাব করে নিই
  out.otr_current = get('otr_current');
  out.otr_prev = get('otr_prev');
  ['otr_prev_par', 'overdue_prev_month', 'overdue_running_prev', 'overdue_total_prev', 'weekly_loanee']
    .forEach((k) => { out[k] = get(k); });
  // পুরনো seed-এ ব্যবহৃত নামগুলোর সমতা
  out.member_total ??= get('member_total');
  out.member_change = get('member_change');
  out.loanee_change = get('loanee_change');
  out.savings_change = get('savings_change');
  out.loan_change = get('loan_change');
  out.overdue_change = get('overdue_change');
  return out;
}

/** আগের মাসের সাথে তুলনা করে হ্রাস/বৃদ্ধি বের করে (এন্ট্রিতে আলাদা করে দিতে হয় না) */
function applyChanges(rows, prevRows) {
  const prev = new Map((prevRows || []).map((r) => [r.branch, r]));
  const pairs = [
    ['member_total', 'member_change'],
    ['loanee_total', 'loanee_change'],
    ['savings_total', 'savings_change'],
    ['loan_total', 'loan_change'],
    ['overdue_total', 'overdue_change']
  ];
  rows.forEach((r) => {
    const p = prev.get(r.branch);
    pairs.forEach(([totalKey, changeKey]) => {
      if (r[changeKey] !== null && r[changeKey] !== undefined) return; // এন্ট্রিতে দেওয়া থাকলে সেটাই
      if (p && !blank(p[totalKey]) && !blank(r[totalKey])) r[changeKey] = Number(r[totalKey]) - Number(p[totalKey]);
      else r[changeKey] = null;
    });
  });
  return rows;
}

/** কোনো মাসের শেষ দিনের তারিখ — ভিত্তি কলামের লেবেলে দেখানো হয় */
function monthEndDate(ym) {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${ym}-${String(last).padStart(2, '0')}`;
}

function prevMonth(ym) {
  const m = /^(\d{4})-(\d{2})$/.exec(ym || '');
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, 1));
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
}

/* শিটের শাখা-ক্রম */
const SHEET_ORDER = ['Narail', 'Noldi', 'Lohagora', 'Mohajon', 'Gobra'];
const orderRows = (rows) => rows.slice().sort((a, b) => {
  const i = SHEET_ORDER.indexOf(a.branch);
  const j = SHEET_ORDER.indexOf(b.branch);
  return (i < 0 ? 99 : i) - (j < 0 ? 99 : j);
});

async function refreshClosingSheet() {
  const month = $('#mcsMonth').value;
  $('#autoMonth').textContent = month ? formatMonthBn(month) : '—';
  $('#disHead').textContent = month ? `বিতরণ- ${formatMonthBn(month)}` : 'বিতরণ';

  /* "মোট" আর OTR-এর দুই ঘরে কোন মাসের হিসাব সেটা লিখে দিই */
  const shortMonth = (ym) => {
    if (!ym) return '';
    const MB = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
      'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
    const [y, m] = ym.split('-').map(Number);
    return `${MB[m - 1]} - ${toBnDigits(String(y).slice(2))}`;
  };
  const cur = shortMonth(month);
  const pre = shortMonth(month ? prevMonth(month) : '');
  $$('#tblMain .h-total').forEach((el) => { el.textContent = cur ? `${cur}(মোট)` : 'মোট'; });
  const otrPrevTh = $('#tblMain .h-otr-prev');
  const otrCurTh = $('#tblMain .h-otr-cur');
  if (otrPrevTh) otrPrevTh.textContent = pre ? `${pre}(OTR)` : 'বিগত মাস';
  if (otrCurTh) otrCurTh.textContent = cur ? `${cur}(OTR)` : 'এ মাস';

  // আদায় টেবিলের PAR ও বকেয়া সংখ্যার ঘরেও মাসের নাম
  const setHead = (sel, text, fallback) => {
    const el = $(sel);
    if (el) el.innerHTML = text || fallback;
  };
  setHead('#tblRecovery .h-par-prev', pre && `${pre}<br />(PAR)`, 'বিগত পার');
  setHead('#tblRecovery .h-par-cur', cur && `${cur}<br />(PAR)`, 'এ মাসে<br />পার');
  setHead('#tblRecovery .h-due-prev', pre && `${pre}<br />(বকেয়া সংখ্যা)`, 'বকেয়া<br />গত মাস');
  setHead('#tblRecovery .h-due-cur', cur && `${cur}<br />(বকেয়া সংখ্যা)`, 'বকেয়া এ<br />মাস');

  // মাসের শেষ তারিখ — নিচের টেবিলগুলোর উপরে যেটা লেখা থাকে
  if (month) {
    const [y, mm] = month.split('-').map(Number);
    const last = new Date(Date.UTC(y, mm, 0)).getUTCDate();
    $('#dpsHead').textContent = `${toBnDigits(`${last}/${mm}/${String(y).slice(2)}`)} ডিপিএস নতুন`;
  }

  let rows = [];
  let prevRows = [];
  let live = false;
  if (month) {
    const [res, prev] = await Promise.all([
      apiGet(`month-close?month=${encodeURIComponent(month)}`),
      apiGet(`month-close?month=${encodeURIComponent(prevMonth(month))}`)
    ]);
    prevRows = Array.isArray(prev) ? prev.map(normalizeClosing) : [];

    if (Array.isArray(res) && res.length) {
      live = true;
      rows = res.map(normalizeClosing);
      applyChanges(rows, prevRows);
    } else if (prevRows.length) {
      /* এ মাসের ক্লোজিং এখনো দেওয়া হয়নি — তখন শুধু "গত মাস" কলামগুলো
         আগের মাসের ক্লোজিং থেকে ভরে দিই, বাকি সব ঘর ফাঁকা থাকে */
      live = true;
      rows = prevRows.map((p) => ({
        branch: p.branch,
        branch_bn: p.branch_bn,
        otr_prev: p.otr_current,
        otr_prev_par: p.passed_this_month,
        overdue_prev_month: p.overdue_this_month,
        overdue_running_prev: p.overdue_running,
        overdue_total_prev: p.overdue_total,
        awaiting: true
      }));
    }
  }
  if (!rows.length && !state.live && state.seed.closing?.rows) {
    rows = state.seed.closing.rows.map((r, i) => normalizeClosing({ ...r, closing: r }, i));
  }
  rows = orderRows(rows);
  rows.forEach((r, i) => { r.sl = i + 1; });

  // আগের মাসের মান পাশে রাখি (গত মাস কলামগুলোর জন্য)
  const prevBy = new Map(prevRows.map((r) => [r.branch, r]));
  rows.forEach((r) => {
    const p = prevBy.get(r.branch) || {};
    // আগের মাস ডাটাবেসে না থাকলে CSV থেকে আসা "গত মাস" মানগুলোই কাজে লাগে
    r.prev = {
      otr_current: p.otr_current ?? null,
      passed_this_month: p.passed_this_month ?? r.otr_prev_par ?? null,
      overdue_this_month: p.overdue_this_month ?? r.overdue_prev_month ?? null,
      overdue_running: p.overdue_running ?? r.overdue_running_prev ?? null,
      overdue_total: p.overdue_total ?? r.overdue_total_prev ?? null,
      recoverable: p.recoverable ?? null,
      recovered: p.recovered ?? null
    };
  });

  state.closingRows = rows;

  const badge = $('#mcsSource');
  if (live && rows.some((r) => r.awaiting)) {
    badge.className = 'badge warn';
    badge.textContent = '● এ মাসের ক্লোজিং বাকি — শুধু গত মাসের ঘর ভরা';
  } else if (live) {
    badge.className = 'badge';
    badge.textContent = '● লাইভ ডাটাবেস';
  } else if (state.live) {
    badge.className = 'badge warn';
    badge.textContent = '● এই মাসের ক্লোজিং এখনো দেওয়া হয়নি';
  } else {
    badge.className = 'badge warn';
    badge.textContent = '● ডেমো ডেটা';
  }

  renderClosingTables(rows, month);
  requestAnimationFrame(fitSheetToView);
}


function renderClosingTables(rows, month) {
  const n = (x) => (blank(x) ? 0 : Number(x));
  // সিটের সব সংখ্যা বাংলা অঙ্কে
  const bn = (txt) => String(txt).replace(/\d/g, (d) => BN_DIGITS[+d]);
  const P = (x) => (blank(x) ? '' : bn(`${Number(x).toFixed(2)}%`));
  const D = (x) => bn(blank(x) ? '0' : nf.format(Number(x)));
  const t = (key) => rows.reduce((a, r) => a + n(r[key]), 0);
  const tp = (key) => rows.reduce((a, r) => a + n(r.prev[key]), 0);

  const otr = (r) => {
    if (!blank(r.otr_current)) return Number(r.otr_current);
    return n(r.recoverable) ? (n(r.recovered) / n(r.recoverable)) * 100 : null;
  };
  const otrPrev = (r) => {
    if (!blank(r.prev.otr_current)) return Number(r.prev.otr_current);
    if (!blank(r.otr_prev)) return Number(r.otr_prev);
    return n(r.prev.recoverable) ? (n(r.prev.recovered) / n(r.prev.recoverable)) * 100 : null;
  };
  const f2 = (x) => (x === null || x === undefined ? '' : toBnDigits(Number(x).toFixed(2)));

  const empty = (cols) => `<tr><td colspan="${cols}" class="empty">এই মাসের কোনো তথ্য নেই</td></tr>`;
  if (!rows.length) {
    $('#closingRows').innerHTML = empty(21);
    ['#closingFoot', '#dividendFoot', '#recoveryFoot', '#exFoot', '#overdueFoot', '#dpsFoot'].forEach((x) => { $(x).innerHTML = ''; });
    ['#dividendRows', '#recoveryRows', '#exRows', '#overdueRows', '#dpsRows'].forEach((x) => { $(x).innerHTML = empty(8); });
    return;
  }

  /* ---------- ক : মূল সিট ---------- */
  // অ্যাডমিন সরাসরি বদলাতে পারে এমন ঘর
  const E = (r, key, text) =>
    `<td data-e="closing" data-m="${month}" data-b="${r.branch}" data-f="${key}" data-raw="${blank(r[key]) ? '' : r[key]}">${text}</td>`;

  $('#closingRows').innerHTML = rows.map((r) => `<tr>
      <td class="b-name">${r.branch_bn}</td>
      ${E(r, 'samiti', D(r.samiti))}
      <td>${D(r.member_change)}</td>${E(r, 'member_total', D(r.member_total))}
      <td>${D(r.loanee_change)}</td>${E(r, 'loanee_total', D(r.loanee_total))}
      <td>${D(r.savings_change)}</td>${E(r, 'savings_total', D(r.savings_total))}
      <td>${D(r.loan_change)}</td>${E(r, 'loan_total', D(r.loan_total))}
      <td>${D(r.overdue_change)}</td>${E(r, 'overdue_total', D(r.overdue_total))}
      <td class="hl">${f2(otrPrev(r))}</td>
      <td class="hl">${f2(otr(r))}</td>
      <td class="hl">${otr(r) === null || otrPrev(r) === null ? '' : toBnDigits((otr(r) - otrPrev(r)).toFixed(2))}</td>
      ${E(r, 'cash_in_hand', D(r.cash_in_hand))}
      ${E(r, 'bank', D(r.bank))}
      ${E(r, 'profit_this_month', D(r.profit_this_month))}${E(r, 'profit_this_year', D(r.profit_this_year))}${E(r, 'profit_to_date', D(r.profit_to_date))}
      ${E(r, 'dis_month_count', D(r.dis_month_count))}${E(r, 'dis_month_amount', D(r.dis_month_amount))}
    </tr>`).join('');

  // মোট সারির OTR = শাখাগুলোর গড় (শিটে এভাবেই হিসাব হয়)
  const avgOf = (fn) => {
    const v = rows.map(fn).filter((x) => x !== null && x !== undefined && !Number.isNaN(x));
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const otrP = avgOf(otrPrev);
  const otrC = avgOf(otr);

  $('#closingFoot').innerHTML = `<tr>
      <td class="b-name">মোট</td>
      <td>${D(t('samiti'))}</td>
      <td>${D(t('member_change'))}</td><td>${D(t('member_total'))}</td>
      <td>${D(t('loanee_change'))}</td><td>${D(t('loanee_total'))}</td>
      <td>${D(t('savings_change'))}</td><td>${D(t('savings_total'))}</td>
      <td>${D(t('loan_change'))}</td><td>${D(t('loan_total'))}</td>
      <td>${D(t('overdue_change'))}</td><td>${D(t('overdue_total'))}</td>
      <td class="hl">${f2(otrP)}</td><td class="hl">${f2(otrC)}</td>
      <td class="hl">${otrP === null || otrC === null ? '' : toBnDigits((otrC - otrP).toFixed(2))}</td>
      <td>${D(t('cash_in_hand'))}</td><td>${D(t('bank'))}</td>
      <td>${D(t('profit_this_month'))}</td><td>${D(t('profit_this_year'))}</td><td>${D(t('profit_to_date'))}</td>
      <td>${D(t('dis_month_count'))}</td><td>${D(t('dis_month_amount'))}</td>
    </tr>`;

  /* ---------- খ : সঞ্চয় লভ্যাংশ ---------- */
  $('#dividendRows').innerHTML = rows.map((r) => `<tr>
      <td class="b-name">${r.branch_bn}</td>
      ${E(r, 'dividend_count', blank(r.dividend_count) ? '' : D(r.dividend_count))}
      ${E(r, 'dividend_amount', blank(r.dividend_amount) ? '' : D(r.dividend_amount))}
      ${E(r, 'monthly_kisti_count', blank(r.monthly_kisti_count) ? '' : D(r.monthly_kisti_count))}
    </tr>`).join('');
  $('#dividendFoot').innerHTML = `<tr class="hl">
      <td class="b-name">মোট</td>
      <td>${D(t('dividend_count'))}</td><td>${D(t('dividend_amount'))}</td><td>${D(t('monthly_kisti_count'))}</td>
    </tr>`;

  /* ---------- গ : আদায় ---------- */
  $('#recoveryRows').innerHTML = rows.map((r) => `<tr>
      <td class="b-name">${r.branch_bn}</td>
      ${E(r, 'recoverable', D(r.recoverable))}
      ${E(r, 'recovered', D(r.recovered))}
      <td class="hl">${f2(otr(r))}</td>
      <td class="hl">${P(r.prev.passed_this_month)}</td>
      ${E(r, 'passed_this_month', P(r.passed_this_month))}
      ${E(r, 'writeoff_recovery', D(r.writeoff_recovery))}
      <td class="hl">${D(r.prev.overdue_this_month)}</td>
      ${E(r, 'overdue_this_month', D(r.overdue_this_month))}
      <td class="hl">${D(n(r.overdue_this_month) - n(r.prev.overdue_this_month))}</td>
      ${E(r, 'llp', blank(r.llp) ? '' : D(r.llp))}
      <td class="hl">${D(r.prev.overdue_running)}</td>
      ${E(r, 'overdue_running', D(r.overdue_running))}
      <td class="hl">${D(n(r.overdue_running) - n(r.prev.overdue_running))}</td>
      ${E(r, 'overdue_new', D(r.overdue_new))}
    </tr>`).join('');
  $('#recoveryFoot').innerHTML = `<tr class="hl">
      <td class="b-name">মোট</td>
      <td>${D(t('recoverable'))}</td><td>${D(t('recovered'))}</td>
      <td>${f2(otrC)}</td>
      <td>${t('recoverable') ? P((tp('passed_this_month') / rows.length)) : ''}</td>
      <td>${P(t('passed_this_month') / rows.length)}</td>
      <td>${D(t('writeoff_recovery'))}</td>
      <td>${D(tp('overdue_this_month'))}</td><td>${D(t('overdue_this_month'))}</td>
      <td>${D(t('overdue_this_month') - tp('overdue_this_month'))}</td>
      <td>${D(t('llp'))}</td>
      <td>${D(tp('overdue_running'))}</td><td>${D(t('overdue_running'))}</td>
      <td>${D(t('overdue_running') - tp('overdue_running'))}</td>
      <td>${D(t('overdue_new'))}</td>
    </tr>`;

  /* ---------- ঘ : Ex Recovery ---------- */
  $('#exRows').innerHTML = rows.map((r) => `<tr>
      <td class="b-name">${r.branch_bn}</td>
      ${E(r, 'ex_recovery_count', D(r.ex_recovery_count))}
      ${E(r, 'ex_recovery', D(r.ex_recovery))}
    </tr>`).join('');
  $('#exFoot').innerHTML = `<tr class="hl">
      <td class="b-name">মোট</td><td>${D(t('ex_recovery_count'))}</td><td>${D(t('ex_recovery'))}</td>
    </tr>`;

  /* ---------- ঙ : Overdue / কল্যাণ তহবিল / ঋণ আদায় ---------- */
  $('#overdueRows').innerHTML = rows.map((r) => `<tr>
      <td class="b-name">${r.branch_bn}</td>
      <td class="hl">${D(r.prev.overdue_total)}</td>
      <td>${D(r.overdue_total)}</td>
      <td class="hl">${D(r.overdue_change)}</td>
      ${E(r, 'welfare_return_count', D(r.welfare_return_count))}
      ${E(r, 'welfare_return_amount', D(r.welfare_return_amount))}
      ${E(r, 'loan_recovery_principal', D(r.loan_recovery_principal))}
      ${E(r, 'loan_recovery_service', D(r.loan_recovery_service))}
    </tr>`).join('');
  $('#overdueFoot').innerHTML = `<tr class="hl">
      <td class="b-name">মোট</td>
      <td>${D(tp('overdue_total'))}</td><td>${D(t('overdue_total'))}</td><td>${D(t('overdue_change'))}</td>
      <td>${D(t('welfare_return_count'))}</td><td>${D(t('welfare_return_amount'))}</td>
      <td>${D(t('loan_recovery_principal'))}</td><td>${D(t('loan_recovery_service'))}</td>
    </tr>`;

  /* ---------- চ : ডিপিএস ও সঞ্চয় ---------- */
  $('#dpsRows').innerHTML = rows.map((r) => `<tr>
      <td class="b-name">${r.branch_bn}</td>
      ${E(r, 'dps_new_count', D(r.dps_new_count))}${E(r, 'dps_new_amount', D(r.dps_new_amount))}
      ${E(r, 'dps_return_count', D(r.dps_return_count))}${E(r, 'dps_return_amount', D(r.dps_return_amount))}
      ${E(r, 'savings_collection', D(r.savings_collection))}${E(r, 'savings_refund', D(r.savings_refund))}
    </tr>`).join('');
  $('#dpsFoot').innerHTML = `<tr class="hl">
      <td class="b-name">মোট</td>
      <td>${D(t('dps_new_count'))}</td><td>${D(t('dps_new_amount'))}</td>
      <td>${D(t('dps_return_count'))}</td><td>${D(t('dps_return_amount'))}</td>
      <td>${D(t('savings_collection'))}</td><td>${D(t('savings_refund'))}</td>
    </tr>`;
}

/** OTR: এন্ট্রিতে দেওয়া থাকলে সেটাই, না দিলে আদায়কৃত ÷ আদায়যোগ্য */
function otrOf(r) {
  if (!blank(r.otr_current)) return pct(r.otr_current);
  if (!blank(r.recoverable) && Number(r.recoverable) !== 0 && !blank(r.recovered)) {
    return pct((Number(r.recovered) / Number(r.recoverable)) * 100);
  }
  return '—';
}

function closingCsv() {
  const head = ['SL', 'Branch', ...MC_KEYS];
  const body = state.closingRows.map((r) => [r.sl, r.branch, ...MC_KEYS.map((k) => (blank(r[k]) ? '' : r[k]))].join(','));
  downloadCsv([head.join(','), ...body].join('\n'), `month-closing-${$('#mcsMonth').value}.csv`);
}

/* ---------- স্ক্রিনে সিটটা পুরো দেখানো (স্ক্রল ছাড়া) ---------- */

// মোবাইলেও পুরো সিট এক পলকে দেখা যাবে (PC-র মতো একই সাজ), তাই সীমাটা অনেক নিচে
const MIN_VIEW_ZOOM = 0.12;

let sheetZoom = 1;        // এখন যত গুণ দেখানো হচ্ছে
let sheetFitZoom = 1;     // পর্দায় ঠিক আঁটে এমন মাপ

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 3;

function applySheetZoom(z, keep) {
  const doc = $('.mcs-doc');
  if (!doc) return;
  sheetZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
  doc.style.zoom = Math.round(sheetZoom * 1000) / 1000;
  const el = $('#mcsZoomVal');
  if (el) el.textContent = `${toBnDigits(Math.round(sheetZoom * 100))}%`;
  if (!keep) $('.mcs-scroll')?.scrollTo({ left: 0 });
}

function fitSheetToView() {
  const doc = $('.mcs-doc');
  const box = $('.mcs-scroll');
  if (!doc || !box || $('#closingPage').style.display === 'none') return;

  doc.style.zoom = '';
  // মোবাইলে ছোট করা হয় না — টেবিলগুলো পড়ার মতো বড় থেকে আলাদা আলাদা স্ক্রল হয়
  if (window.innerWidth <= 760) { applySheetZoom(1, true); return; }
  const avail = box.clientWidth;
  const w = doc.scrollWidth;
  if (!avail || !w) return;

  sheetFitZoom = Math.min(1, Math.max(avail / w, MIN_VIEW_ZOOM));
  applySheetZoom(sheetFitZoom);
}

/* ---------- দুই আঙুলে পিঞ্চ-জুম ---------- */

function setupPinchZoom() {
  const box = $('.mcs-scroll');
  if (!box) return;

  const pts = new Map();
  let startDist = 0;
  let startZoom = 1;

  const dist = () => {
    const [a, b] = [...pts.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  box.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) {
      startDist = dist();
      startZoom = sheetZoom;
      box.style.touchAction = 'none';   // দুই আঙুল থাকলে স্ক্রলও নয়, শুধু জুম
    }
  });

  box.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2 && startDist > 0) {
      e.preventDefault();               // ব্রাউজারের নিজের জুম নয়, আমাদেরটাই
      applySheetZoom(startZoom * (dist() / startDist), true);
    }
  }, { passive: false });

  const drop = (e) => {
    pts.delete(e.pointerId);
    if (pts.size < 2) {
      startDist = 0;
      box.style.touchAction = '';
    }
  };
  box.addEventListener('pointerup', drop);
  box.addEventListener('pointercancel', drop);
  box.addEventListener('pointerleave', drop);

  // iOS Safari মেটা ট্যাগ মানে না — তার নিজের জেসচার আটকে দিই
  ['gesturestart', 'gesturechange', 'gestureend'].forEach((ev) => {
    document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
  });

  // ডেস্কটপে Ctrl + স্ক্রলেও কাজ করবে
  box.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    applySheetZoom(sheetZoom * (e.deltaY < 0 ? 1.1 : 0.9), true);
  }, { passive: false });
}

let fitTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(fitTimer);
  fitTimer = setTimeout(fitSheetToView, 120);
});

/* ---------- প্রিন্ট: A4 ল্যান্ডস্কেপ, ০.৩" মার্জিন, এক পাতায় ---------- */

/* ছাপার জায়গা: 297×210mm − দুই পাশে 0.3in মার্জিন, 96dpi হিসাবে পিক্সেলে */
const PAGE_W = ((297 - 2 * 7.62) / 25.4) * 96;   // ≈ 1065px
const PAGE_H = ((210 - 2 * 7.62) / 25.4) * 96;   // ≈ 736px

function fitSheetForPrint() {
  const doc = $('.mcs-doc');
  const box = $('.mcs-scroll');
  if (!doc || !box) return;

  document.body.classList.add('printing');
  doc.style.zoom = '';
  doc.style.width = 'max-content';   // মাপার সময় কনটেন্টের আসল চওড়া
  box.style.width = '';
  box.style.height = '';

  const w = doc.scrollWidth;
  const h = doc.scrollHeight;
  if (!w || !h) return;

  /* মাপা অবস্থাটাই স্থির করে দিই — ছাপার সময় লেআউট আবার বদলে গিয়ে
     উচ্চতা বেড়ে দ্বিতীয় পাতা তৈরি হওয়ার সুযোগ থাকে না */
  doc.style.width = `${w}px`;

  const scale = Math.floor(Math.min(PAGE_W / w, PAGE_H / h) * 0.98 * 1000) / 1000;
  doc.style.zoom = scale;
}

function clearPrintFit() {
  const doc = $('.mcs-doc');
  const box = $('.mcs-scroll');
  document.body.classList.remove('printing');
  if (doc) { doc.style.zoom = ''; doc.style.width = ''; }
  if (box) { box.style.width = ''; box.style.height = ''; }
  fitSheetToView();   // প্রিন্টের পর আবার স্ক্রিনের মাপে
}

/** Ctrl+P বা বাটন — দুই পথেই মাপ ঠিক হয়ে যায় */
window.addEventListener('beforeprint', () => {
  if ($('#closingPage').style.display !== 'none') fitSheetForPrint();
  if ($('#comparePage').style.display !== 'none') fitCompareForPrint();
});
window.addEventListener('afterprint', () => { clearPrintFit(); clearComparePrint(); });


/* ---------- Compare প্রিন্ট: A4 ল্যান্ডস্কেপ, পুরো পাতা জুড়ে এক পাতায় ---------- */

function fitCompareForPrint() {
  const tbl = $('#tblCompare');
  const wrap = $('.cmp-wrap');
  if (!tbl || !wrap) return;

  document.body.classList.add('printing-cmp');
  tbl.style.zoom = '';
  tbl.style.removeProperty('--cmp-pad');

  /* পর্দায় ঘরের যে প্যাডিং, ছাপাতেও সেটাই ভিত্তি ধরি — নইলে মাপা উচ্চতার সাথে
     ছাপার উচ্চতা মেলে না, আর টেবিল দরকারের চেয়ে অনেক ছোট হয়ে যায় */
  const sampleTd = tbl.querySelector('tbody td');
  const sampleTh = tbl.querySelector('thead th');
  const padTd = sampleTd ? parseFloat(getComputedStyle(sampleTd).paddingTop) || 4 : 4;
  const padTh = sampleTh ? parseFloat(getComputedStyle(sampleTh).paddingTop) || 4 : 4;
  tbl.style.setProperty('--cmp-base-td', `${padTd}px`);
  tbl.style.setProperty('--cmp-base-th', `${padTh}px`);

  /* টেবিলের চওড়া শতকরায় থাকলে zoom বসানোর পর সেটা আবার পাত্রের মাপে মিলে যায়,
     ফলে দ্বিগুণ ছোট হয়ে পড়ে। তাই আগে আসল (max-content) চওড়া মেপে
     সেটাকেই পিক্সেলে স্থির করে দিই */
  tbl.style.width = 'max-content';
  const w = tbl.scrollWidth;
  const h = tbl.scrollHeight;
  if (!w || !h) return;
  tbl.style.width = `${w}px`;

  // উপরে একটু ফাঁক রেখে বসাই, তাই ততটুকু উচ্চতা বাদ দিয়ে হিসাব
  const TOP_GAP = 34;
  const availH = PAGE_H - TOP_GAP;
  const scale = Math.floor(Math.min(PAGE_W / w, availH / h) * 0.995 * 1000) / 1000;
  tbl.style.zoom = scale;

  // বাকি উচ্চতাটা সারিগুলোর মধ্যে ভাগ করে পাতা ভরাট করি
  const rowCount = tbl.querySelectorAll('tr').length || 1;
  const freeH = availH - h * scale;
  if (freeH > 8) {
    tbl.style.setProperty('--cmp-pad', `${Math.min(freeH / scale / rowCount / 2, 7).toFixed(1)}px`);
  }
}

function clearComparePrint() {
  const tbl = $('#tblCompare');
  document.body.classList.remove('printing-cmp');
  if (tbl) {
    tbl.style.zoom = '';
    tbl.style.width = '';
    tbl.style.removeProperty('--cmp-pad');
    tbl.style.removeProperty('--cmp-base-td');
    tbl.style.removeProperty('--cmp-base-th');
  }
}

function printCompare() {
  fitCompareForPrint();
  requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
}

function printClosingSheet() {
  fitSheetForPrint();
  // লেআউট বসার জন্য এক ফ্রেম সময় দিই
  requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
}


/* ==========================================================================
   এন্ট্রির তালিকা (এন্ট্রি পেজের নিচে) — তারিখ ফিল্টার, এডিট, ডিলিট
   ========================================================================== */

let listCursor = '';

function setListDate(iso, silent) {
  $('#listDate').value = iso || '';
  $('#listDateText').textContent = iso ? formatDateEn(iso) : '—';
  listCursor = (iso || todayIso()).slice(0, 7);
  if (!silent) refreshEntryList();
}

function renderListCalendar() {
  const [y, m] = listCursor.split('-').map(Number);
  const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  $('#listCalTitle').textContent = `${MONTHS_EN[m - 1]} ${y}`;

  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const sel = $('#listDate').value;
  const today = todayIso();

  let html = '';
  for (let i = 0; i < first; i++) html += '<span class="cal-cell blank"></span>';
  for (let d = 1; d <= last; d++) {
    const iso = `${listCursor}-${String(d).padStart(2, '0')}`;
    const cls = ['cal-cell', iso === sel ? 'sel' : '', iso === today ? 'today' : '',
      state.dates.includes(iso) ? 'has' : ''].filter(Boolean).join(' ');
    html += `<button type="button" class="${cls}" data-date="${iso}">${d}</button>`;
  }
  $('#listCalGrid').innerHTML = html;
}

function setupListCalendar() {
  $('#listDateBtn').onclick = (e) => {
    e.stopPropagation();
    const pop = $('#listCal');
    if (pop.hidden) { renderListCalendar(); pop.hidden = false; } else pop.hidden = true;
  };
  $('#listCal').addEventListener('click', (e) => {
    e.stopPropagation();
    const nav = e.target.closest('[data-cal]');
    if (nav) {
      const [y, m] = listCursor.split('-').map(Number);
      const d = new Date(Date.UTC(y, m - 1 + (nav.dataset.cal === 'next' ? 1 : -1), 1));
      listCursor = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      renderListCalendar();
      return;
    }
    const cell = e.target.closest('.cal-cell[data-date]');
    if (cell) {
      setListDate(cell.dataset.date);      // এক ক্লিকেই বাছাই
      $('#listCal').hidden = true;
    }
  });
  document.addEventListener('click', () => { $('#listCal').hidden = true; });
  $('#listReload').onclick = () => {
    if ($('#tblEntryList').style.display === 'none') refreshClosingList(); else refreshEntryList();
  };
  $('#listMonth').onchange = refreshClosingList;
}

const LIST_FIELDS = [
  'actual_member', 'actual_loanee', 'savings', 'kisti_count',
  'today_disbursement', 'grant_total_disbursement', 'loan_outstanding',
  'overdue_outstanding', 'recovery_rate', 'cash_in_hand', 'bank'
];

async function refreshEntryList() {
  const date = $('#listDate').value;
  const body = $('#entryListRows');
  if (!date) { body.innerHTML = ''; return; }

  const rows = await apiGet(`daily?date=${encodeURIComponent(date)}`);
  const list = Array.isArray(rows) ? rows : [];
  state.entryList = list;

  if (!list.length) {
    body.innerHTML = '<tr><td colspan="13" class="empty">এই তারিখে কোনো এন্ট্রি নেই</td></tr>';
    return;
  }

  const F = (x) => (blank(x) ? '—' : nf.format(Number(x)));
  body.innerHTML = list.map((r) => `<tr>
      <td class="left">${r.bn_name || r.branch}</td>
      ${LIST_FIELDS.map((k) => `<td>${F(r[k])}</td>`).join('')}
      <td class="row-actions">
        <button class="mini edit" type="button" data-edit="${r.branch}">এডিট</button>
        <button class="mini del" type="button" data-del="${r.branch}">ডিলিট</button>
      </td>
    </tr>`).join('');

  body.querySelectorAll('[data-edit]').forEach((b) => {
    b.onclick = () => loadEntryIntoForm(b.dataset.edit);
  });
  body.querySelectorAll('[data-del]').forEach((b) => {
    b.onclick = () => deleteEntry(b.dataset.del);
  });
}

function loadEntryIntoForm(branch) {
  const date = $('#listDate').value;
  const row = (state.entryList || []).find((r) => r.branch === branch);
  if (!row) return;
  showForm('daily');
  $('#deDate').value = date;
  $('#deBranch').value = branch;
  Object.entries(DAILY_INPUTS).forEach(([key, sel]) => {
    $(sel).value = blank(row[key]) ? '' : row[key];
  });
  setBadge('#dailyLoadBadge', 'info', 'এডিট মোড — সেভ করলে আপডেট হবে');
  $('#dailyForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  toast(`${branch} — এন্ট্রি ফর্মে আনা হয়েছে`, 'ok');
}

async function deleteEntry(branch) {
  if (!guardWho()) return;
  const date = $('#listDate').value;
  if (!window.confirm(`${branch} — ${formatDateBn(date)} এর এন্ট্রি মুছে ফেলবেন?`)) return;
  try {
    const res = await fetch(`/api/daily?date=${encodeURIComponent(date)}&branch=${encodeURIComponent(branch)}`,
      { method: 'DELETE' });
    if (!res.ok) throw new Error('delete failed');
    toast('এন্ট্রি মুছে ফেলা হয়েছে', 'ok');
    markLocalChange();
    await refreshEntryList();
    refreshCompare();
  } catch (e) {
    toast('মোছা যায়নি — আবার চেষ্টা করুন', 'err');
  }
}



/* ==========================================================================
   অ্যাডমিন — পাসওয়ার্ড দিয়ে ঢুকে টেবিলের হেডার লেখা বদলানো

   চাবি বানানো হয় টেবিলের নিজস্ব আইডি + সারি + ঘরের অবস্থান দিয়ে
   (যেমন tblRecovery.r0c3)। প্রতিটা টেবিলের আইডি আলাদা, তাই দুই টেবিলের
   হেডার আর কখনো এক চাবিতে পড়বে না।
   ========================================================================== */

const ADMIN_KEY = 'bkf_admin_pass';
let adminPass = sessionStorage.getItem(ADMIN_KEY) || '';

const relabel = () => {};   // হেডার লেখার সুবিধা আপাতত বন্ধ

function setAdminMode(on) {
  document.body.classList.toggle('admin-on', on);
  toggleStats(on);
  $('#adminFab').textContent = on ? '✎' : '🔒';
  $('#adminFab').title = on ? 'অ্যাডমিন চালু' : 'অ্যাডমিন লগইন';
}

function setupAdmin() {
  if (adminPass) setAdminMode(true);

  $('#adminFab').onclick = () => {
    if (adminPass) {
      adminPass = '';
      sessionStorage.removeItem(ADMIN_KEY);
      setAdminMode(false);
      toast('অ্যাডমিন বন্ধ করা হলো');
      return;
    }
    $('#adminModal').hidden = false;
    $('#adminPass').value = '';
    $('#adminPass').focus();
  };

  const tryLogin = async () => {
    const password = $('#adminPass').value;
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password })
    });
    if (!res.ok) return toast('পাসওয়ার্ড ঠিক নয়', 'err');
    adminPass = password;
    sessionStorage.setItem(ADMIN_KEY, password);
    $('#adminModal').hidden = true;
    setAdminMode(true);
    toast('অ্যাডমিন চালু', 'ok');
  };

  $('#adminLogin').onclick = tryLogin;
  $('#adminPass').addEventListener('keydown', (e) => { if (e.key === 'Enter') tryLogin(); });
  $('#adminCancel').onclick = () => { $('#adminModal').hidden = true; };
  $('#noticeBar').onclick = () => { if (adminPass) editNotice(); };
  $('#adminModal').addEventListener('click', (e) => {
    if (e.target.id === 'adminModal') $('#adminModal').hidden = true;
  });

}


/* ---------- ক্লোজিং এন্ট্রির তালিকা ---------- */

/* তালিকায় ক্লোজিং ফর্মের সব ঘরই দেখাব — ক্রম ও নাম ফর্মের স্পেক থেকেই */
const CLOSING_LIST_COLS = MC_FIELDS.filter((f) => f.key);

function buildClosingListHead() {
  const tr = $('#closingListHead');
  if (!tr || tr.children.length) return;
  tr.innerHTML = '<th>শাখা</th>'
    + CLOSING_LIST_COLS.map((f) => `<th>${f.label}</th>`).join('')
    + '<th>কাজ</th>';
}

function fillListMonths() {
  const el = $('#listMonth');
  const keep = el.value;
  const months = [...new Set([...(state.months || []), thisMonthIso()])].sort().reverse();
  el.innerHTML = '';
  months.forEach((m) => el.add(new Option(formatMonthBn(m), m)));
  el.value = keep && months.includes(keep) ? keep : months[0];
}

async function refreshClosingList() {
  const month = $('#listMonth').value;
  const body = $('#closingListRows');
  if (!month) { body.innerHTML = ''; return; }

  const res = await apiGet(`month-close?month=${encodeURIComponent(month)}`);
  const list = Array.isArray(res) ? res.map(normalizeClosing) : [];
  state.closingList = list;

  buildClosingListHead();
  const cols = CLOSING_LIST_COLS.length + 2;

  if (!list.length) {
    body.innerHTML = `<tr><td colspan="${cols}" class="empty">এই মাসের কোনো ক্লোজিং এন্ট্রি নেই</td></tr>`;
    return;
  }

  const F = (x) => (blank(x) ? '—' : nf.format(Number(x)));
  body.innerHTML = orderRows(list).map((r) => `<tr>
      <td class="left">${r.branch_bn || r.branch}</td>
      ${CLOSING_LIST_COLS.map((f) => `<td>${F(r[f.key])}</td>`).join('')}
      <td class="row-actions">
        <button class="mini edit" type="button" data-cedit="${r.branch}">এডিট</button>
        <button class="mini del" type="button" data-cdel="${r.branch}">ডিলিট</button>
      </td>
    </tr>`).join('');

  body.querySelectorAll('[data-cedit]').forEach((b) => {
    b.onclick = () => loadClosingRowIntoForm(b.dataset.cedit);
  });
  body.querySelectorAll('[data-cdel]').forEach((b) => {
    b.onclick = () => deleteClosingEntry(b.dataset.cdel);
  });
}

function loadClosingRowIntoForm(branch) {
  const month = $('#listMonth').value;
  const row = (state.closingList || []).find((r) => r.branch === branch);
  if (!row) return;
  showForm('closing');
  $('#mcMonth').value = month;
  $('#mcBranch').value = branch;
  $$('#mcFields input[data-mc]').forEach((el) => {
    const v = row[el.dataset.mc];
    el.value = blank(v) ? '' : v;
  });
  setBadge('#mcLoadBadge', 'info', 'এডিট মোড — সেভ করলে আপডেট হবে');
  $('#closingForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  toast(`${branch} — ক্লোজিং ফর্মে আনা হয়েছে`, 'ok');
}

async function deleteClosingEntry(branch) {
  if (!guardWho()) return;
  const month = $('#listMonth').value;
  if (!window.confirm(`${branch} — ${formatMonthBn(month)} এর ক্লোজিং মুছে ফেলবেন?`)) return;
  try {
    const res = await fetch(`/api/month-close?month=${encodeURIComponent(month)}&branch=${encodeURIComponent(branch)}`,
      { method: 'DELETE' });
    if (!res.ok) throw new Error('failed');
    toast('ক্লোজিং মুছে ফেলা হয়েছে', 'ok');
    markLocalChange();
    await refreshClosingList();
    refreshClosingSheet();
  } catch (e) {
    toast('মোছা যায়নি — আবার চেষ্টা করুন', 'err');
  }
}

/** এন্ট্রি পেজে যে ফর্ম খোলা, তালিকাও সেটারই দেখাবে */
function syncListWithForm(which) {
  if (!$('#tblClosingList')) return;
  const daily = which === 'daily';
  $('#listTitle').textContent = daily ? 'ডেইলি এন্ট্রির তালিকা' : 'Month Closing এন্ট্রির তালিকা';
  $('#listDateBtn').closest('.cal-field').style.display = daily ? '' : 'none';
  $('#listMonthWrap').style.display = daily ? 'none' : '';
  $('#tblEntryList').style.display = daily ? '' : 'none';
  $('#tblClosingList').style.display = daily ? 'none' : '';
  if (daily) refreshEntryList(); else refreshClosingList();
}


/* ==========================================================================
   কি-বোর্ডের তীর দিয়ে এক ঘর থেকে আরেক ঘরে যাওয়া
   ↑ ↓ ← →  এবং Enter — এন্ট্রি পেজের দুই ফর্মেই কাজ করে
   ========================================================================== */

function setupArrowNav() {
  const NAV = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'];

  const cells = (el) => {
    const form = el.closest('form');
    if (!form) return [];
    return [...form.querySelectorAll('input, select')]
      .filter((n) => !n.disabled && n.type !== 'hidden' && n.offsetParent !== null);
  };

  const center = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };

  document.addEventListener('keydown', (e) => {
    if (!NAV.includes(e.key)) return;
    const el = e.target;
    if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement)) return;
    if (!el.closest('#entryPage')) return;
    // ড্রপডাউন খোলা থাকলে উপর-নিচ তার নিজের কাজ করুক
    if (el.tagName === 'SELECT' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) return;

    const list = cells(el);
    const i = list.indexOf(el);
    if (i < 0) return;

    let next = null;

    if (e.key === 'Enter' || (e.key === 'ArrowRight' && e.ctrlKey)) {
      next = list[i + 1];
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const me = center(el);
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      // একই সারির মধ্যে পাশের ঘর
      const sameRow = list.filter((n, k) => {
        if (k === i) return false;
        const c = center(n);
        return Math.abs(c.y - me.y) < 12 && (c.x - me.x) * dir > 0;
      });
      next = sameRow.sort((a, b) =>
        Math.abs(center(a).x - me.x) - Math.abs(center(b).x - me.x))[0]
        || list[i + dir];
    } else {
      const me = center(el);
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      // উপরে/নিচে — যেটা সবচেয়ে কাছাকাছি খাড়া অবস্থানে
      const others = list.filter((n, k) => {
        if (k === i) return false;
        const c = center(n);
        return (c.y - me.y) * dir > 6;
      });
      next = others.sort((a, b) => {
        const ca = center(a);
        const cb = center(b);
        const da = Math.abs(ca.x - me.x) + Math.abs(ca.y - me.y) * 2;
        const db = Math.abs(cb.x - me.x) + Math.abs(cb.y - me.y) * 2;
        return da - db;
      })[0];
    }

    if (!next) return;
    e.preventDefault();
    next.focus();
    if (next.select) next.select();
  });
}


/* ==========================================================================
   চলমান নোটিশ + অ্যাডমিনের সরাসরি টেবিল সম্পাদনা
   ========================================================================== */

const NOTICE_KEY = 'notice.text';

async function loadNotice() {
  const map = await apiGet('labels');
  state.labels = map && typeof map === 'object' ? map : {};
  applyNotice();
}

function applyNotice() {
  const txt = (state.labels || {})[NOTICE_KEY] || '';
  const bar = $('#noticeBar');
  const el = $('#noticeText');
  if (!bar || !el) return;
  el.textContent = txt || 'কোনো নোটিশ নেই';
  bar.classList.toggle('empty', !txt);
  // লেখা লম্বা হলে সেই অনুযায়ী চলার সময় ঠিক করি
  const secs = Math.max(12, Math.round((txt.length || 20) / 3));
  el.style.animationDuration = `${secs}s`;
}

async function editNotice() {
  const cur = (state.labels || {})[NOTICE_KEY] || '';
  const next = window.prompt('নোটিশের লেখা (ফাঁকা রাখলে মুছে যাবে):', cur);
  if (next === null) return;
  const ok = await saveLabel(NOTICE_KEY, next);
  if (!ok) return;
  if (next) state.labels[NOTICE_KEY] = next; else delete state.labels[NOTICE_KEY];
  applyNotice();
  toast(next ? 'নোটিশ বদলানো হয়েছে' : 'নোটিশ মুছে ফেলা হয়েছে', 'ok');
}

async function saveLabel(key, label) {
  const res = await fetch('/api/labels', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin-password': adminPass },
    body: JSON.stringify({ key, label })
  });
  if (res.status === 401) {
    adminPass = '';
    sessionStorage.removeItem(ADMIN_KEY);
    setAdminMode(false);
    toast('অ্যাডমিন সেশন শেষ — আবার লগইন করুন', 'err');
    return false;
  }
  return res.ok;
}

/* ---------- টেবিলের ঘরে সরাসরি সম্পাদনা ---------- */

/** শুধু যে ঘরটি বদলানো হলো সেটিই পাঠাই — বাকি সব অক্ষত থাকে */
async function patchDaily(date, branch, field, value) {
  const payload = { entry_date: date, branch };
  if (value === null) payload.clear = [field];
  else payload[field] = value;
  await apiPost('daily', payload);
}

/** ক্লোজিংয়ের শুধু বদলানো ঘরটিই পাঠাই */
async function patchClosing(month, branch, field, value) {
  const payload = { month, branch };
  if (value === null) payload.clear = [field];
  else payload.closing = { [field]: value };
  if (field === 'monthly_kisti_count' && value !== null) payload.monthly_kisti_count = value;
  await apiPost('month-close', payload);
}

/** অ্যাডমিন চালু থাকলে চিহ্নিত ঘরে চাপ দিলে সেখানেই লেখা যায় */
function setupCellEdit() {
  document.addEventListener('click', async (e) => {
    if (!adminPass) return;
    const cell = e.target.closest('td[data-e]');
    if (!cell || cell.querySelector('input')) return;

    const { e: src, b: branch, f: field, d: date, m: month } = cell.dataset;
    const raw = cell.dataset.raw ?? '';
    const input = document.createElement('input');
    input.type = 'number';
    input.step = 'any';
    input.className = 'cell-edit';
    input.value = raw;
    const old = cell.innerHTML;
    cell.innerHTML = '';
    cell.appendChild(input);
    input.focus();
    input.select();

    let done = false;
    const finish = async (save) => {
      if (done) return;
      done = true;
      const val = input.value.trim() === '' ? null : Number(input.value);
      if (!save || String(val ?? '') === String(raw ?? '')) { cell.innerHTML = old; return; }
      cell.innerHTML = '<span class="saving">…</span>';
      try {
        if (src === 'daily') await patchDaily(date, branch, field, val);
        else await patchClosing(month, branch, field, val);
        toast('ডাটাবেসে আপডেট হয়েছে', 'ok');
        markLocalChange();
        if (src === 'daily') { refreshCompare(); refreshEntryList(); }
        else { refreshClosingSheet(); refreshCompare(); refreshClosingList(); }
      } catch (err) {
        toast('সেভ করা যায়নি', 'err');
        cell.innerHTML = old;
      }
    };

    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); finish(true); }
      if (ev.key === 'Escape') { ev.preventDefault(); finish(false); }
    });
    input.addEventListener('blur', () => finish(true));
  });
}


/* ==========================================================================
   ভিজিটর গণনা — সবার ব্রাউজার থেকে ping, হিসাব শুধু অ্যাডমিন দেখে
   ========================================================================== */

const VID_KEY = 'bkf_vid';

function visitorId() {
  let v = localStorage.getItem(VID_KEY);
  if (!v) {
    v = `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(VID_KEY, v);
  }
  return v;
}

async function pingVisit() {
  try {
    await fetch('/api/ping', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ vid: visitorId(), ...(whoAmI() || {}) })
    });
  } catch (e) { /* নেট না থাকলে চুপচাপ */ }
}

function startVisitPing() {
  pingVisit();
  // প্রতি ৬০ সেকেন্ডে জানান দিই — তাই "এখন অনলাইনে" হিসাব ঠিক থাকে
  setInterval(() => { if (!document.hidden) pingVisit(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pingVisit(); });
}

let statsTimer = null;

async function refreshStats() {
  if (!adminPass) return;
  try {
    const res = await fetch('/api/stats', { headers: { 'x-admin-password': adminPass } });
    if (!res.ok) return;
    const s = await res.json();
    const set = (sel, v) => { const el = $(sel); if (el) el.textContent = toBnDigits(nf.format(v || 0)); };
    set('#stOnline', s.online_now);
    set('#stToday', s.today_visitors);
    set('#stDay', s.day_visitors);
    set('#stTotal', s.total_visitors);
    set('#stHits', s.total_hits);

    const box = $('#stRecent');
    if (box) {
      box.innerHTML = (s.recent || []).map((r) =>
        `<li><b>${r.person}</b>${r.branch ? ` — ${r.branch}` : ''}
         <span>${toBnDigits(r.last_seen)} · ${toBnDigits(r.hits)} বার</span></li>`).join('')
        || '<li class="muted-note">কোনো তথ্য নেই</li>';
    }
  } catch (e) { /* চুপচাপ */ }
}


/* ---------- পরিবর্তনের ইতিহাস — অ্যাডমিন ফেরাতে পারে ---------- */

async function loadHistory() {
  if (!adminPass) return;
  const box = $('#stHistory');
  if (!box) return;
  try {
    const res = await fetch('/api/history', { headers: { 'x-admin-password': adminPass } });
    if (!res.ok) return;
    const rows = await res.json();
    if (!rows.length) { box.innerHTML = '<li class="muted-note">কোনো পরিবর্তন নেই</li>'; return; }

    const what = (r) => (r.tbl === 'daily_entries' ? 'ডেইলি' : 'ক্লোজিং');
    const how = (r) => (r.op === 'DELETE' ? 'মুছে ফেলা' : 'বদলানো');
    box.innerHTML = rows.map((r) => `
      <li>
        <b>${what(r)} · ${r.branch || '—'} · ${r.ref || ''}</b>
        <span>${how(r)} · ${toBnDigits(r.at)} · ${toBnDigits(r.old_fields)} ঘর</span>
        <button class="mini edit" type="button" data-restore="${r.id}">ফেরাও</button>
      </li>`).join('');

    box.querySelectorAll('[data-restore]').forEach((b) => {
      b.onclick = async () => {
        if (!window.confirm('এই অবস্থায় ফিরিয়ে আনবেন?')) return;
        b.disabled = true;
        const res2 = await fetch('/api/history/restore', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-admin-password': adminPass },
          body: JSON.stringify({ id: Number(b.dataset.restore) })
        });
        if (res2.ok) {
          toast('ফিরিয়ে আনা হয়েছে', 'ok');
          markLocalChange();
          await reloadVisible();
          loadHistory();
        } else {
          toast('ফেরানো যায়নি', 'err');
          b.disabled = false;
        }
      };
    });
  } catch (e) { /* চুপচাপ */ }
}

function toggleStats(on) {
  const box = $('#adminStats');
  if (!box) return;
  box.hidden = !on;
  clearInterval(statsTimer);
  if (on) {
    refreshStats();
    loadHistory();
    statsTimer = setInterval(refreshStats, 30000);
  }
}


/* ==========================================================================
   লাইভ সিঙ্ক — কেউ এন্ট্রি দিলে বা বদলালে সবার পর্দা নিজে থেকেই হালনাগাদ হয়
   (Netlify-তে সব সময় খোলা সংযোগ রাখা যায় না, তাই অল্প সময় পরপর
   সার্ভারকে জিজ্ঞেস করি "ডেটা বদলেছে?" — বদলালে তবেই নতুন করে আনি)
   ========================================================================== */

let liveStamp = null;
let liveTimer = null;
let liveBusy = false;

async function liveCheck(firstRun) {
  if (liveBusy || document.hidden) return;
  liveBusy = true;
  try {
    const res = await fetch('/api/version', { cache: 'no-store' });
    if (!res.ok) return;
    const v = await res.json();

    const chip = $('#liveOnline');
    if (chip) chip.textContent = toBnDigits(v.online ?? 0);
    $('#liveChip')?.classList.add('on');

    const names = $('#liveNames');
    if (names) {
      const me = (whoAmI() || {}).person;
      const list = (v.who || [])
        .map((w) => (w.branch ? `${w.person} (${w.branch})` : w.person))
        .filter((t, i, a) => a.indexOf(t) === i);
      names.innerHTML = list.length
        ? list.map((t) => `<b class="${me && t.startsWith(me) ? 'me' : ''}">${t}</b>`).join('')
        : '';
    }

    if (firstRun || liveStamp === null) { liveStamp = v.stamp; return; }
    if (v.stamp === liveStamp) return;

    liveStamp = v.stamp;
    await reloadVisible();
    toast('নতুন তথ্য এসেছে — পর্দা হালনাগাদ হলো', 'ok');
  } catch (e) {
    $('#liveChip')?.classList.remove('on');
  } finally {
    liveBusy = false;
  }
}

/** যে পেজটা খোলা আছে শুধু সেটাই নতুন করে আঁকি */
async function reloadVisible() {
  const jobs = [];
  if ($('#entryPage').style.display !== 'none') {
    jobs.push($('#tblEntryList').style.display === 'none' ? refreshClosingList() : refreshEntryList());
  }
  if ($('#comparePage').style.display !== 'none') jobs.push(refreshCompare());
  if ($('#closingPage').style.display !== 'none') jobs.push(refreshClosingSheet());
  // তারিখ ও মাসের তালিকাও হালনাগাদ রাখি
  const [dates, months] = await Promise.all([apiGet('daily/dates'), apiGet('month-close/months')]);
  if (Array.isArray(dates)) state.dates = dates;
  if (Array.isArray(months)) {
    state.months = months;
    const keep = $('#mcsMonth').value;
    fillMonthSelect();
    if (keep && months.includes(keep)) $('#mcsMonth').value = keep;
    fillListMonths();
  }
  await Promise.all(jobs);
}

function startLiveSync() {
  liveCheck(true);
  clearInterval(liveTimer);
  liveTimer = setInterval(() => liveCheck(false), 6000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) liveCheck(false); });
}

/** নিজে সেভ করার পর সঙ্গে সঙ্গে ছাপ মিলিয়ে নিই, যাতে নিজের কাছেই টোস্ট না আসে */
async function markLocalChange() {
  try {
    const res = await fetch('/api/version', { cache: 'no-store' });
    if (res.ok) liveStamp = (await res.json()).stamp;
  } catch (e) { /* কিছু না */ }
}


/* ==========================================================================
   পরিচয় — কে ভিজিট করছে / এন্ট্রি দিচ্ছে
   (ব্রাউজার থেকে গুগল অ্যাকাউন্ট পড়া যায় না, তাই একবার নাম-শাখা জেনে নিই)
   ========================================================================== */

const WHO_KEY = 'bkf_who';
let whoMemory = null;          // স্টোরেজ বন্ধ থাকলেও অন্তত এই সেশনে মনে থাকবে

/** তিন জায়গা থেকে পরিচয় খুঁজি — স্মৃতি, localStorage, কুকি।
    কোনো এক জায়গা কাজ না করলেও (প্রাইভেট মোড, স্টোরেজ বন্ধ) বাক্স বারবার আসবে না */
function whoAmI() {
  if (whoMemory && whoMemory.person && whoMemory.branch) return whoMemory;

  try {
    const v = JSON.parse(localStorage.getItem(WHO_KEY) || 'null');
    if (v && v.person && v.branch) { whoMemory = v; return v; }
  } catch (e) { /* স্টোরেজ পড়া যায়নি */ }

  const m = document.cookie.match(/(?:^|;\s*)bkf_who=([^;]+)/);
  if (m) {
    try {
      const v = JSON.parse(decodeURIComponent(m[1]));
      if (v && v.person && v.branch) { whoMemory = v; return v; }
    } catch (e) { /* কুকি পড়া যায়নি */ }
  }
  return null;
}

function saveWho(who) {
  whoMemory = who;
  const raw = JSON.stringify(who);
  try { localStorage.setItem(WHO_KEY, raw); } catch (e) { /* উপেক্ষা */ }
  try {
    document.cookie = `bkf_who=${encodeURIComponent(raw)};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
  } catch (e) { /* উপেক্ষা */ }
}

const AREA_NAME = 'নড়াইল এরিয়া';

function openWhoModal(force) {
  const cur = whoAmI() || {};
  const sel = $('#whoBranch');
  sel.innerHTML = '<option value="">— বেছে নিন —</option>';
  // এরিয়া ম্যানেজারের জন্য শাখার বদলে পুরো এরিয়া
  sel.add(new Option(`${AREA_NAME} (এরিয়া ম্যানেজার)`, AREA_NAME));
  // ডাটাবেস থেকে শাখা না এলেও তালিকা ফাঁকা থাকবে না
  const list = (state.branches && state.branches.length)
    ? state.branches.map((b) => b.bn_name || b.name)
    : ['নড়াইল সদর', 'নলদী', 'লোহাগড়া', 'মহাজন', 'গোবরা'];
  list.forEach((name) => sel.add(new Option(name, name)));
  $('#whoName').value = cur.person || '';
  sel.value = cur.branch || '';
  $('#whoError').hidden = true;
  $('#whoModal').hidden = false;
  document.body.classList.toggle('locked', !!force);
  setTimeout(() => $('#whoName').focus(), 50);
}

/** পরিচয় না দিলে পাতা ব্যবহার করা যাবে না */
function requireWho() {
  const me = whoAmI();
  const ok = me && me.person && me.branch;
  document.body.classList.toggle('locked', !ok);
  if (!ok) openWhoModal(true);
  return ok;
}

function setupWho() {
  const save = () => {
    const person = $('#whoName').value.trim();
    const branch = $('#whoBranch').value;
    const err = $('#whoError');

    if (person.length < 2) {
      err.textContent = 'নাম লিখুন (অন্তত ২ অক্ষর)';
      err.hidden = false;
      $('#whoName').focus();
      return;
    }
    if (!branch) {
      err.textContent = 'শাখা অথবা এরিয়া বেছে নিন';
      err.hidden = false;
      $('#whoBranch').focus();
      return;
    }

    saveWho({ person, branch });
    $('#whoModal').hidden = true;
    document.body.classList.remove('locked');
    pingVisit();
    liveCheck(false);
    toast(`স্বাগতম, ${person} — ${branch}`, 'ok');
  };

  $('#whoSave').onclick = save;
  ['#whoName', '#whoBranch'].forEach((sel) => {
    $(sel).addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
  });
  $('#liveChip').onclick = () => openWhoModal(false);

  // বাইরে ক্লিক করে বা Esc চেপে এড়ানো যাবে না
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('locked')) e.preventDefault();
  });

  requireWho();
}

/** সেভ/এডিট/ডিলিটের আগে পরিচয় আছে কিনা দেখি */
function guardWho() {
  if (requireWho()) return true;
  toast('আগে নাম ও শাখা দিন', 'err');
  return false;
}

/* ---------- shared ---------- */

function downloadCsv(csv, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('CSV ডাউনলোড শুরু হয়েছে', 'ok');
}

/* ---------- এন্ট্রি পেজের ফর্ম সুইচ (ডিফল্ট: ডেইলি) ---------- */

function showForm(which) {
  $('#dailyFormCard').style.display = which === 'daily' ? 'block' : 'none';
  $('#closingFormCard').style.display = which === 'closing' ? 'block' : 'none';
  $$('.switch-btn').forEach((b) => b.classList.toggle('active', b.dataset.form === which));
  if ($('#listTitle')) syncListWithForm(which);
}

/* ---------- navigation ---------- */

const PAGES = ['entry', 'compare', 'closing'];

function showPage(page) {
  PAGES.forEach((p) => {
    const el = document.getElementById(`${p}Page`);
    if (el) el.style.display = p === page ? 'block' : 'none';
  });
  $$('.nav[data-page]').forEach((n) => n.classList.toggle('active', n.dataset.page === page));
  window.scrollTo({ top: 0 });
  if (page === 'closing') requestAnimationFrame(fitSheetToView);
}

/* ---------- wire up ---------- */

function wire() {
  $$('.nav[data-page]').forEach((n) => { n.onclick = () => showPage(n.dataset.page); });

  /* বাড়তি নিরাপত্তা — বাটনের ভেতরের আইকন/লেখায় চাপ পড়লেও, কিংবা কোনো কারণে
     সরাসরি বাঁধা হ্যান্ডলার কাজ না করলেও এখান থেকে ধরা পড়বে */
  document.addEventListener('click', (e) => {
    const nav = e.target.closest('.nav[data-page]');
    if (nav) { showPage(nav.dataset.page); return; }
    const sw = e.target.closest('.switch-btn');
    if (sw) showForm(sw.dataset.form);
  });

  $$('.switch-btn').forEach((b) => { b.onclick = () => showForm(b.dataset.form); });
  showForm('daily');

  $('#dailyForm').addEventListener('submit', submitDaily);
  $('#closingForm').addEventListener('submit', submitClosing);
  $('#deReset').onclick = () => {
    clearDailyForm();
    setBadge('#dailyLoadBadge', 'muted', 'নতুন এন্ট্রি');
    if ($('#listDate').value === payload.entry_date) refreshEntryList();
    toast('ডেইলি ফর্ম ফাঁকা করা হয়েছে');
  };
  $('#mcReset').onclick = () => {
    clearClosingForm();
    setBadge('#mcLoadBadge', 'muted', 'নতুন এন্ট্রি');
    fillListMonths();
    if ($('#listMonth').value === payload.month) refreshClosingList();
    toast('ক্লোজিং ফর্ম ফাঁকা করা হয়েছে');
  };
  $('#deEdit').onclick = editDaily;
  $('#mcEdit').onclick = editClosing;

  // তারিখ/মাস বা শাখা বদলালে ফর্ম ফাঁকা হয়ে যায় — কিছু লোড হয় না
  $('#deDate').onchange = $('#deBranch').onchange = () => {
    clearDailyForm();
    setBadge('#dailyLoadBadge', 'muted', 'নতুন এন্ট্রি');
    if ($('#listDate').value === payload.entry_date) refreshEntryList();
  };
  $('#mcMonth').onchange = $('#mcBranch').onchange = () => {
    clearClosingForm();
    setBadge('#mcLoadBadge', 'muted', 'নতুন এন্ট্রি');
    fillListMonths();
    if ($('#listMonth').value === payload.month) refreshClosingList();
  };

  $('#cmpApply').onclick = refreshCompare;
  setupCalendar();
  $('#cmpCsv').onclick = compareCsv;
  $('#printBtn').onclick = printCompare;

  $('#mcsApply').onclick = refreshClosingSheet;
  $('#mcsMonth').onchange = refreshClosingSheet;
  $('#mcsCsv').onclick = closingCsv;
  $('#mcsPrint').onclick = printClosingSheet;
  $('#mcsZoomIn').onclick = () => applySheetZoom(sheetZoom * 1.2, true);
  $('#mcsZoomOut').onclick = () => applySheetZoom(sheetZoom / 1.2, true);
  $('#mcsZoomFit').onclick = () => fitSheetToView();
  setupPinchZoom();
}

wire();
bootstrap().catch((err) => {
  console.error(err);
  toast(`ডেটা লোড করা যায়নি: ${err.message}`, 'err');
});
