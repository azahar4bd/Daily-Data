# Daily-Data

শাখাভিত্তিক দৈনিক তথ্য সংগ্রহ ও মাসিক ক্লোজিং ড্যাশবোর্ড — **বন্ধু কল্যাণ ফাউন্ডেশন, নড়াইল এরিয়া**।

স্ট্যাটিক ফ্রন্টএন্ড + Netlify Function + Neon Postgres। ডাটাবেসে পৌঁছানো না গেলে অ্যাপ
`data/seed.json` থেকে ডেমো ডেটা দেখায়, তাই পেজ কখনো ফাঁকা থাকে না।

---

## ফোল্ডার কাঠামো

```
index.html                  অ্যাপ শেল (৫টি পেজ)
assets/styles.css           সব স্টাইল
assets/app.js               ড্যাশবোর্ড লজিক, API কল, ফর্ম সাবমিট
data/seed.json              অফলাইন/ডেমো ডেটা (import স্ক্রিপ্ট তৈরি করে)
netlify/functions/api.mjs   /api/* সার্ভারলেস ফাংশন
schema.sql                  Postgres স্কিমা (বারবার চালানো নিরাপদ)
scripts/import-sheet.mjs    sheet.xlsx → seed.json / SQL / ডাটাবেস
scripts/lib/xlsx.mjs        নির্ভরতাহীন xlsx রিডার
netlify.toml                বিল্ড, রিডাইরেক্ট ও হেডার কনফিগ
sheet.xlsx                  মূল এক্সেল সোর্স
```

## পেজসমূহ

| পেজ | কাজ |
|---|---|
| ড্যাশবোর্ড | তারিখ ও শাখা ফিল্টার, ৫টি মেট্রিক কার্ড, পারফরম্যান্স টেবিল + মোট সারি, CSV এক্সপোর্ট |
| Daily Entry | দৈনিক তথ্য সেভ/আপডেট → `daily_entries` |
| Month Closing Entry | মাসিক ক্লোজিং সেভ/আপডেট → `month_closings` |
| Compare | দুই তারিখের তুলনা, স্বয়ংক্রিয় হ্রাস/বৃদ্ধি ও মোট |
| Month Closing | মাসিক অর্জন সিট + OTR সারসংক্ষেপ (প্রিন্টযোগ্য) |

---

## লোকালি চালানো

**শুধু ফ্রন্টএন্ড (ডেমো ডেটা):**

```bash
npm run serve        # http://localhost:8080
```

**API সহ পুরো অ্যাপ:**

```bash
npm install
cp .env.example .env         # DATABASE_URL বসান
psql "$DATABASE_URL" -f schema.sql
npm run dev                  # netlify dev -> http://localhost:8888
```

## ডিপ্লয় (Netlify)

1. Site settings → Environment variables → `DATABASE_URL` = Neon connection string।
2. একবার `schema.sql` চালান।
3. Deploy। `/api/*` স্বয়ংক্রিয়ভাবে ফাংশনে রিডাইরেক্ট হবে।

---

## API

বেস পাথ `/api`। সব রেসপন্স JSON।

| মেথড | রুট | কাজ |
|---|---|---|
| GET | `/api/health` | DB সংযোগ চেক |
| GET | `/api/branches` | সক্রিয় শাখার তালিকা |
| GET | `/api/daily?date=YYYY-MM-DD` | ঐ তারিখের সব শাখার এন্ট্রি |
| GET | `/api/daily/dates` | যেসব তারিখে ডেটা আছে |
| POST | `/api/daily` | দৈনিক এন্ট্রি upsert (`entry_date` + `branch_id`/`branch`) |
| GET | `/api/month-close?month=YYYY-MM` | মাসিক ক্লোজিং |
| POST | `/api/month-close` | ক্লোজিং upsert (`month` + শাখা, `closing` = jsonb) |

`branch` হিসেবে ইংরেজি বা বাংলা — দুই নামই চলবে। একই key আবার পাঠালে আগের সারি আপডেট হয়।
`DATABASE_URL` না থাকলে ফাংশন `503 {"error":"db_not_configured"}` দেয়, ক্র্যাশ করে না।

**উদাহরণ:**

```bash
curl -X POST http://localhost:8888/api/daily \
  -H 'content-type: application/json' \
  -d '{"entry_date":"2026-09-28","branch":"Gobra","actual_member":910,
       "actual_loanee":746,"savings":16407489,"kisti_count":424,
       "today_disbursement":50000,"loan_outstanding":52562754,
       "overdue_outstanding":3140817,"recovery_rate":96}'
```

## এক্সেল ইমপোর্ট

`sheet.xlsx` থেকে ডেটা পড়ে ডাটাবেস বা `data/seed.json`-এ তোলে।
কোনো npm প্যাকেজ লাগে না — xlsx রিডার রিপোতেই আছে, শুধু Node 18+ হলেই চলবে।

```bash
npm run import              # ড্রাই রান — কী পাওয়া গেল দেখায়, কিছু লেখে না
npm run import:seed         # data/seed.json নতুন করে তৈরি করে
npm run import:sql          # import.sql তৈরি করে (psql দিয়ে চালানোর জন্য)
npm run import:db           # সরাসরি $DATABASE_URL-এ লেখে
```

সব অপশন:

```
--file <path>            কোন ওয়ার্কবুক               (ডিফল্ট sheet.xlsx)
--daily-sheet <name>     দৈনিক ট্যাব                  (ডিফল্ট "September-2026")
--compare-sheet <name>   তুলনা ট্যাব                  (ডিফল্ট "Compare Sep-26")
--closing-sheet <name>   ক্লোজিং ট্যাব                (ডিফল্ট "Month Closing-sep-26")
--only all|daily|closing কোনটুকু ইমপোর্ট হবে          (ডিফল্ট all)
--month YYYY-MM          ক্লোজিং কোন মাসের
--from / --to            কোন তারিখগুলো ইমপোর্ট হবে
--seed [path] / --sql <path> / --db / --dry-run
--list                   ওয়ার্কবুকের ট্যাব দেখায়
```

**লেখার আগে সবসময় ড্রাই রান দেখে নিন।** সব রাইট পাথ upsert — বারবার চালালেও
সারি ডুপ্লিকেট হয় না, আগেরটা আপডেট হয়।

```bash
node scripts/import-sheet.mjs --dry-run                     # রিপোর্ট
node scripts/import-sheet.mjs --sql import.sql              # SQL বানান
psql "$DATABASE_URL" -f schema.sql                          # স্কিমা
psql "$DATABASE_URL" -f import.sql                          # ডেটা
```

### ⚠️ ওয়ার্কবুকের মাস-লেবেল অসঙ্গতি

ক্লোজিং ট্যাবের নাম `Month Closing-sep-26`, কিন্তু ভেতরের শিরোনামে লেখা
**আগষ্ট-২০২৬**। স্ক্রিপ্ট ট্যাবের নাম ধরে `2026-09` হিসেবে ইমপোর্ট করে এবং
প্রতিবার সতর্কবার্তা দেখায়। ভুল হলে ঠিক মাস দিন:

```bash
node scripts/import-sheet.mjs --month 2026-08 --only closing --db
```

একইভাবে `Compare Sep-26` ট্যাবে লেখা "Month-August-26", কিন্তু ভেতরের আসল
তারিখ দুটি **31-Jul-26 → 28-Sep-26**। স্ক্রিপ্ট লেবেল নয়, আসল তারিখ ব্যবহার করে।

## ডেটা সোর্স ব্যাজ

ড্যাশবোর্ডের উপরে দেখা যায় —

- 🟢 **লাইভ ডাটাবেস** — ডেটা Neon থেকে আসছে
- 🟡 **ডেমো ডেটা** — API-তে পৌঁছানো যায়নি বা ঐ তারিখে ডেটা নেই, `data/seed.json` দেখানো হচ্ছে
