/* ==========================================================================
   Daily-Data dashboard
   Live data comes from /api/* (Netlify function -> Neon Postgres).
   If the API is unreachable or empty, we fall back to data/seed.json so the
   page still renders as a static demo.
   ========================================================================== */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------- state ---------- */

const state = {
  seed: null,
  branches: [],
  dates: [],
  rows: [],
  source: 'demo' // 'live' | 'demo'
};

/* ---------- formatting helpers ---------- */

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
const BN_MONTHS = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
];

const toBnDigits = (value) => String(value).replace(/\d/g, (d) => BN_DIGITS[+d]);

const nf = new Intl.NumberFormat('en-IN');
const fmt = (n) => (n === null || n === undefined || n === '' ? '—' : nf.format(Number(n)));
const money = (n) => (n === null || n === undefined || n === '' ? '—' : `৳ ${nf.format(Number(n))}`);

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

function deltaCell(n, { money: asMoney = false } = {}) {
  if (n === null || n === undefined || n === '') return '<span class="delta flat">—</span>';
  const v = Number(n);
  const cls = v > 0 ? 'up' : v < 0 ? 'down' : 'flat';
  const sign = v > 0 ? '+' : '';
  const text = asMoney ? nf.format(Math.abs(v)) : nf.format(Math.abs(v));
  return `<span class="delta ${cls}">${v < 0 ? '−' : sign}${text}</span>`;
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
  const res = await fetch('data/seed.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('seed.json could not be loaded');
  state.seed = await res.json();
  return state.seed;
}

/** GET an /api/* endpoint. Returns null on any failure so callers can fall back. */
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
  if (!res.ok) {
    const reason = body?.message || body?.error || `HTTP ${res.status}`;
    throw new Error(reason);
  }
  return body;
}

/** Accept both the API column names and the seed.json field names. */
function normalizeDaily(row, bnLookup) {
  const pick = (...vals) => vals.find((v) => v !== undefined && v !== null) ?? null;
  const branch = pick(row.branch, row.branch_name, '');
  return {
    branch,
    bn: pick(row.bn_name, bnLookup[branch], branch),
    members: pick(row.actual_member, row.members),
    loanee: pick(row.actual_loanee, row.loanee),
    savings: pick(row.savings),
    kisti: pick(row.kisti_count, row.kisti),
    disbursement: pick(row.today_disbursement, row.disbursement),
    loan: pick(row.loan_outstanding, row.loan),
    overdue: pick(row.overdue_outstanding, row.overdue),
    recovery: pick(row.recovery_rate, row.recovery)
  };
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

/* ---------- bootstrap ---------- */

async function bootstrap() {
  const seed = await loadSeed();

  const bnLookup = Object.fromEntries(seed.branches.map((b) => [b.name, b.bn_name]));
  state.bnLookup = bnLookup;

  // branches: live first, seed as fallback
  const liveBranches = await apiGet('branches');
  state.branches = Array.isArray(liveBranches) && liveBranches.length ? liveBranches : seed.branches;

  // available dates: live first, seed as fallback
  const liveDates = await apiGet('daily/dates');
  const seedDates = Object.keys(seed.daily).sort().reverse();
  state.dates = Array.isArray(liveDates) && liveDates.length
    ? [...new Set([...liveDates, ...seedDates])].sort().reverse()
    : seedDates;

  fillDateSelect();
  fillBranchSelects();
  renderCompare(seed.compare);
  renderClosing(seed.closing);
  await refreshDashboard();
}

function fillDateSelect() {
  const el = $('#date');
  el.innerHTML = '';
  state.dates.forEach((d) => el.add(new Option(formatDateBn(d), d)));
}

function fillBranchSelects() {
  const branchFilter = $('#branch');
  branchFilter.innerHTML = '<option value="all">সব শাখা</option>';
  state.branches.forEach((b) => branchFilter.add(new Option(b.bn_name ? `${b.name} — ${b.bn_name}` : b.name, b.name)));

  const entryBranch = $('#deBranch');
  entryBranch.innerHTML = '';
  state.branches.forEach((b) => entryBranch.add(new Option(b.name, b.name)));

  const closeBranch = $('#mcBranch');
  closeBranch.innerHTML = '';
  state.branches.forEach((b) => closeBranch.add(new Option(b.bn_name || b.name, b.bn_name || b.name)));
}

/* ---------- dashboard ---------- */

async function refreshDashboard() {
  const date = $('#date').value;
  if (!date) return;

  const live = await apiGet(`daily?date=${encodeURIComponent(date)}`);
  let rows;
  if (Array.isArray(live) && live.length) {
    rows = live;
    setSource('live');
  } else {
    rows = (state.seed.daily[date] || []);
    setSource('demo');
  }

  state.rows = rows.map((r) => normalizeDaily(r, state.bnLookup));
  renderDashboard();
}

function renderDashboard() {
  const branch = $('#branch').value;
  const rows = branch === 'all' ? state.rows : state.rows.filter((r) => r.branch === branch);

  const sum = (key) => rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
  const recoveries = rows.map((r) => Number(r.recovery)).filter((n) => !Number.isNaN(n) && n !== 0);
  const avgRecovery = recoveries.length
    ? (recoveries.reduce((a, b) => a + b, 0) / recoveries.length).toFixed(1)
    : '—';

  const metrics = [
    ['মোট সদস্য', fmt(sum('members')), `${toBnDigits(rows.length)} টি শাখা`],
    ['মোট ঋণগ্রহীতা', fmt(sum('loanee')), 'সক্রিয় ঋণ হিসাব'],
    ['সঞ্চয় স্থিতি', money(sum('savings')), 'সব শাখা মিলিয়ে'],
    ['আজকের বিতরণ', money(sum('disbursement')), 'নির্বাচিত তারিখে'],
    ['গড় রিকভারি', avgRecovery === '—' ? '—' : `${avgRecovery}%`, 'OTR গড়']
  ];

  $('#metrics').innerHTML = metrics.map(([label, value, hint]) => `
    <div class="card metric">
      <div class="label">${label}</div>
      <div class="value">${value}</div>
      <div class="hint">${hint}</div>
    </div>`).join('');

  $('#rows').innerHTML = rows.length
    ? rows.map((r) => {
        const rec = Number(r.recovery) || 0;
        return `<tr>
          <td><b>${r.branch}</b><div class="form-note">${r.bn || ''}</div></td>
          <td class="num">${fmt(r.members)}</td>
          <td class="num">${fmt(r.loanee)}</td>
          <td class="num">${money(r.savings)}</td>
          <td class="num">${fmt(r.kisti)}</td>
          <td class="num">${money(r.disbursement)}</td>
          <td class="num">${money(r.loan)}</td>
          <td class="num">${money(r.overdue)}</td>
          <td>
            <span class="badge ${rec < 90 ? 'warn' : ''}">${rec ? `${rec}%` : '—'}</span>
            <div class="bar"><i style="width:${Math.min(rec, 100)}%"></i></div>
          </td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="9" class="empty">কোনো তথ্য পাওয়া যায়নি</td></tr>';

  $('#rowsFoot').innerHTML = rows.length
    ? `<tr>
        <td>মোট</td>
        <td class="num">${fmt(sum('members'))}</td>
        <td class="num">${fmt(sum('loanee'))}</td>
        <td class="num">${money(sum('savings'))}</td>
        <td class="num">${fmt(sum('kisti'))}</td>
        <td class="num">${money(sum('disbursement'))}</td>
        <td class="num">${money(sum('loan'))}</td>
        <td class="num">${money(sum('overdue'))}</td>
        <td>${avgRecovery === '—' ? '—' : `${avgRecovery}%`}</td>
      </tr>`
    : '';

  $('#updated').textContent = `তারিখ: ${formatDateBn($('#date').value)}`;
}

function exportCsv() {
  const header = ['Branch', 'Members', 'Loanee', 'Savings', 'Kisti', 'Disbursement', 'LoanOutstanding', 'Overdue', 'Recovery'];
  const body = state.rows.map((r) => [r.branch, r.members, r.loanee, r.savings, r.kisti, r.disbursement, r.loan, r.overdue, r.recovery]
    .map((v) => (v === null || v === undefined ? '' : v)).join(','));
  const csv = [header.join(','), ...body].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `daily-report-${$('#date').value}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('CSV ডাউনলোড শুরু হয়েছে', 'ok');
}

/* ---------- compare sheet ---------- */

function renderCompare(compare) {
  $$('.cmp-from').forEach((el) => { el.textContent = compare.from_label; });
  $$('.cmp-to').forEach((el) => { el.textContent = compare.to_label; });

  const diff = (r, key) => r[`${key}_to`] - r[`${key}_from`];

  $('#compareRows').innerHTML = compare.rows.map((r) => `<tr>
      <td>${r.branch}</td>
      <td>${fmt(r.member_from)}</td><td>${fmt(r.member_to)}</td><td>${deltaCell(diff(r, 'member'))}</td>
      <td>${fmt(r.loanee_from)}</td><td>${fmt(r.loanee_to)}</td><td>${deltaCell(diff(r, 'loanee'))}</td>
      <td>${fmt(r.savings_from)}</td><td>${fmt(r.savings_to)}</td><td>${deltaCell(diff(r, 'savings'))}</td>
      <td>${fmt(r.outstanding_from)}</td><td>${fmt(r.outstanding_to)}</td><td>${deltaCell(diff(r, 'outstanding'))}</td>
      <td>${r.otr}%</td>
      <td>${fmt(r.disbursement)}</td>
    </tr>`).join('');

  const total = (key) => compare.rows.reduce((a, r) => a + (Number(r[key]) || 0), 0);
  const avgOtr = (total('otr') / compare.rows.length).toFixed(1);

  $('#compareFoot').innerHTML = `<tr>
      <td>Total</td>
      <td>${fmt(total('member_from'))}</td><td>${fmt(total('member_to'))}</td><td>${deltaCell(total('member_to') - total('member_from'))}</td>
      <td>${fmt(total('loanee_from'))}</td><td>${fmt(total('loanee_to'))}</td><td>${deltaCell(total('loanee_to') - total('loanee_from'))}</td>
      <td>${fmt(total('savings_from'))}</td><td>${fmt(total('savings_to'))}</td><td>${deltaCell(total('savings_to') - total('savings_from'))}</td>
      <td>${fmt(total('outstanding_from'))}</td><td>${fmt(total('outstanding_to'))}</td><td>${deltaCell(total('outstanding_to') - total('outstanding_from'))}</td>
      <td>${avgOtr}%</td>
      <td>${fmt(total('disbursement'))}</td>
    </tr>`;
}

/* ---------- month closing sheet ---------- */

function renderClosing(closing) {
  $('#autoMonth').textContent = closing.month_label || formatMonthBn(closing.month);

  $('#closingRows').innerHTML = closing.rows.map((r) => `<tr>
      <td>${toBnDigits(r.sl)}</td>
      <td>${r.branch_bn}</td>
      <td>${fmt(r.samiti)}</td>
      <td>${deltaCell(r.member_change)}</td>
      <td>${fmt(r.member_total)}</td>
      <td>${deltaCell(r.loanee_change)}</td>
      <td>${fmt(r.loanee_total)}</td>
      <td>${deltaCell(r.savings_change)}</td>
      <td>${fmt(r.savings_total)}</td>
      <td>${deltaCell(r.loan_change)}</td>
      <td>${fmt(r.loan_total)}</td>
      <td>${deltaCell(r.overdue_change)}</td>
      <td>${fmt(r.overdue_total)}</td>
      <td>${r.otr_prev}%</td>
      <td>${r.otr_current}%</td>
    </tr>`).join('');

  const t = (key) => closing.rows.reduce((a, r) => a + (Number(r[key]) || 0), 0);
  const avg = (key) => (t(key) / closing.rows.length).toFixed(2);

  $('#closingFoot').innerHTML = `<tr>
      <td colspan="2">সর্বমোট</td>
      <td>${fmt(t('samiti'))}</td>
      <td>${deltaCell(t('member_change'))}</td>
      <td>${fmt(t('member_total'))}</td>
      <td>${deltaCell(t('loanee_change'))}</td>
      <td>${fmt(t('loanee_total'))}</td>
      <td>${deltaCell(t('savings_change'))}</td>
      <td>${fmt(t('savings_total'))}</td>
      <td>${deltaCell(t('loan_change'))}</td>
      <td>${fmt(t('loan_total'))}</td>
      <td>${deltaCell(t('overdue_change'))}</td>
      <td>${fmt(t('overdue_total'))}</td>
      <td>${avg('otr_prev')}%</td>
      <td>${avg('otr_current')}%</td>
    </tr>`;

  // Derived summary — every figure below is computed from the rows above.
  $('#recoveryRows').innerHTML = closing.rows.map((r) => {
    const otrShift = (r.otr_current - r.otr_prev).toFixed(2);
    const cls = otrShift > 0 ? 'up' : otrShift < 0 ? 'down' : 'flat';
    const overduePrev = r.overdue_total - r.overdue_change;
    return `<tr>
      <td>${r.branch_bn}</td>
      <td>${deltaCell(r.savings_change)}</td>
      <td>${deltaCell(r.loan_change)}</td>
      <td>${deltaCell(r.overdue_change)}</td>
      <td>${fmt(overduePrev)}</td>
      <td>${fmt(r.overdue_total)}</td>
      <td>${r.otr_prev}%</td>
      <td>${r.otr_current}%</td>
      <td><span class="delta ${cls}">${otrShift > 0 ? '+' : ''}${otrShift}</span></td>
    </tr>`;
  }).join('');
}

/* ---------- data entry forms ---------- */

async function submitDaily(ev) {
  ev.preventDefault();
  const btn = $('#deSave');
  const payload = {
    entry_date: $('#deDate').value,
    branch: $('#deBranch').value,
    actual_member: $('#deMember').value,
    actual_loanee: $('#deLoanee').value,
    savings: $('#deSavings').value,
    kisti_count: $('#deKisti').value,
    today_disbursement: $('#deToday').value,
    grant_total_disbursement: $('#deGrant').value,
    loan_outstanding: $('#deLoanOut').value,
    overdue_outstanding: $('#deOverdue').value,
    recovery_rate: $('#deRecovery').value,
    cash_in_hand: $('#deCash').value,
    bank: $('#deBank').value
  };

  if (!payload.entry_date) return toast('তারিখ দিন', 'err');

  btn.disabled = true;
  btn.textContent = 'সেভ হচ্ছে…';
  try {
    await apiPost('daily', payload);
    toast(`${payload.branch} — ${formatDateBn(payload.entry_date)} সেভ হয়েছে`, 'ok');
    if (payload.entry_date === $('#date').value) await refreshDashboard();
  } catch (err) {
    toast(`সেভ করা যায়নি: ${err.message}`, 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Daily Data';
  }
}

async function submitClosing(ev) {
  ev.preventDefault();
  const btn = $('#mcSave');
  const numOf = (id) => {
    const v = $(id).value;
    return v === '' ? null : Number(v);
  };

  const payload = {
    month: $('#mcMonth').value,
    branch: $('#mcBranch').value,
    monthly_kisti_count: numOf('#mcKisti'),
    closing: {
      samiti: numOf('#mcSamiti'),
      member_change: numOf('#mcMemberChange'),
      member_total: numOf('#mcMemberTotal'),
      loanee_change: numOf('#mcLoaneeChange'),
      loanee_total: numOf('#mcLoaneeTotal'),
      savings_change: numOf('#mcSavingsChange'),
      savings_total: numOf('#mcSavingsTotal'),
      loan_change: numOf('#mcLoanChange'),
      loan_total: numOf('#mcLoanTotal'),
      overdue_change: numOf('#mcOverdueChange'),
      overdue_total: numOf('#mcOverdueTotal'),
      otr_prev: numOf('#mcOtrPrev'),
      otr_current: numOf('#mcOtrCurrent'),
      cash_in_hand: numOf('#mcCash'),
      bank: numOf('#mcBank'),
      profit_loss: numOf('#mcProfit'),
      disbursement_count: numOf('#mcDisCount'),
      disbursement_amount: numOf('#mcDisAmount')
    }
  };

  if (!payload.month) return toast('মাস নির্বাচন করুন', 'err');

  btn.disabled = true;
  btn.textContent = 'সেভ হচ্ছে…';
  try {
    await apiPost('month-close', payload);
    toast(`${payload.branch} — ${formatMonthBn(payload.month)} ক্লোজিং সেভ হয়েছে`, 'ok');
  } catch (err) {
    toast(`সেভ করা যায়নি: ${err.message}`, 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Month Closing';
  }
}

/* ---------- navigation ---------- */

const PAGES = ['dashboard', 'dailyEntry', 'closingEntry', 'compare', 'closing'];

function showPage(page) {
  PAGES.forEach((p) => {
    const el = document.getElementById(`${p}Page`);
    if (el) el.style.display = p === page ? 'block' : 'none';
  });
  $$('.nav[data-page]').forEach((n) => n.classList.toggle('active', n.dataset.page === page));
  $('.side').classList.remove('open');
  window.scrollTo({ top: 0 });
}

/* ---------- wire up ---------- */

function wire() {
  $('#menuToggle').onclick = () => $('.side').classList.toggle('open');
  $$('.nav[data-page]').forEach((n) => { n.onclick = () => showPage(n.dataset.page); });

  $('#apply').onclick = refreshDashboard;
  $('#date').onchange = refreshDashboard;
  $('#branch').onchange = renderDashboard;
  $('#refreshBtn').onclick = async () => {
    const btn = $('#refreshBtn');
    btn.disabled = true;
    await refreshDashboard();
    btn.disabled = false;
    toast('ড্যাশবোর্ড আপডেট হয়েছে', 'ok');
  };
  $('#exportBtn').onclick = exportCsv;
  $('#printBtn').onclick = () => window.print();

  $('#dailyForm').addEventListener('submit', submitDaily);
  $('#closingForm').addEventListener('submit', submitClosing);
}

wire();
bootstrap().catch((err) => {
  console.error(err);
  toast(`ডেটা লোড করা যায়নি: ${err.message}`, 'err');
  $('#rows').innerHTML = '<tr><td colspan="9" class="empty">ডেটা লোড করা যায়নি</td></tr>';
});
