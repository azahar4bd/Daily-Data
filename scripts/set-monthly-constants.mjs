#!/usr/bin/env node
/**
 * প্রতি শাখার মাসিক ধ্রুবক দুটো — মাসিক কিস্তির সংখ্যা ও Weekly Loanee —
 * নির্দিষ্ট মাসের ক্লোজিং রেকর্ডে বসায়।
 *
 *   node scripts/set-monthly-constants.mjs --month 2026-08
 */
import pg from 'pg';

const DATA = {
  Narail:   { monthly_kisti_count: 527, weekly_loanee: 90 },
  Noldi:    { monthly_kisti_count: 525, weekly_loanee: 161 },
  Lohagora: { monthly_kisti_count: 532, weekly_loanee: 108 },
  Mohajon:  { monthly_kisti_count: 675, weekly_loanee: 90 },
  Gobra:    { monthly_kisti_count: 473, weekly_loanee: 268 }
};

const args = process.argv.slice(2);
const month = args[args.indexOf('--month') + 1] || '2026-08';

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
await client.connect();

for (const [branch, vals] of Object.entries(DATA)) {
  await client.query(
    `update month_closings m
        set closing = m.closing || $3::jsonb,
            monthly_kisti_count = $4
       from branches b
      where b.id = m.branch_id and b.name = $1 and m.month = $2::date`,
    [branch, `${month}-01`, JSON.stringify(vals), vals.monthly_kisti_count]
  );
}

const { rows } = await client.query(
  `select b.name,
          m.monthly_kisti_count as kisti,
          m.closing->>'weekly_loanee' as weekly
     from month_closings m join branches b on b.id = m.branch_id
    where m.month = $1::date order by b.name`,
  [`${month}-01`]
);
console.log(`${month} — মাসিক ধ্রুবক বসানো হলো:`);
rows.forEach((r) => console.log(`  ${r.name.padEnd(10)} কিস্তি ${r.kisti}  weekly ${r.weekly}`));
await client.end();
