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
data/seed.json              অফলাইন/ডেমো ডেটা (API না পেলে ব্যবহৃত হয়)
netlify/functions/api.mjs   /api/* সার্ভারলেস ফাংশন
schema.sql                  Postgres স্কিমা (বারবার চালানো নিরাপদ)
netlify.toml                বিল্ড, রিডাইরেক্ট ও হেডার কনফিগ
sheet.xlsx                  মূল এক্সেল সোর্স (রেফারেন্স)
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

## ডেটা সোর্স ব্যাজ

ড্যাশবোর্ডের উপরে দেখা যায় —

- 🟢 **লাইভ ডাটাবেস** — ডেটা Neon থেকে আসছে
- 🟡 **ডেমো ডেটা** — API-তে পৌঁছানো যায়নি বা ঐ তারিখে ডেটা নেই, `data/seed.json` দেখানো হচ্ছে
