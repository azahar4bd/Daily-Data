# ডিপ্লয় গাইড

## 🚀 সহজ পথ — আপনার শুধু ২টা সিক্রেট যোগ করতে হবে

বাকি সবকিছু [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
নিজে থেকে করে ফেলবে: Neon প্রজেক্ট তৈরি → টেবিল ও ডেটা লোড →
Netlify সাইট তৈরি → `DATABASE_URL` বসানো → ডিপ্লয় → লাইভ লিংক পরীক্ষা।

### যা করতে হবে

1. **Neon API key নিন** — <https://console.neon.tech> → ডানে উপরে প্রোফাইল →
   **Account settings** → **API keys** → **Create new API key** → কপি করুন।

2. **Netlify token নিন** — <https://app.netlify.com/user/applications> →
   **Personal access tokens** → **New access token** → কপি করুন।

3. **দুটোই GitHub-এ বসান** —
   <https://github.com/azahar4bd/Daily-Data/settings/secrets/actions>
   → **New repository secret** (দুইবার):

   | Name (হুবহু এভাবে লিখুন) | Secret |
   |---|---|
   | `NEON_API_KEY` | Neon থেকে পাওয়া key |
   | `NETLIFY_AUTH_TOKEN` | Netlify থেকে পাওয়া token |

4. ব্যস। এরপর <https://github.com/azahar4bd/Daily-Data/actions> →
   **Deploy** → **Run workflow** চাপুন (branch: `arena/01a0eb92-daily-data`)।

৩–৪ মিনিট পর রানের **Summary**-তে লাইভ লিংক দেখাবে, যেমন
`https://bkf-daily-data.netlify.app`।

> **পরে আবার ডিপ্লয়:** শুধু `git push` — একই ওয়ার্কফ্লো আবার চলবে, লিংক একই থাকবে।
> ডাটাবেস ও সাইট নতুন করে তৈরি হবে না, আগেরটাই ব্যবহার হবে।

---

## 🟢 টোকেন ছাড়া পথ — সব ব্রাউজারে, কোনো key কপি করতে হবে না

কোথাও টোকেন বানাতে না চাইলে এটাই সবচেয়ে সহজ।

1. **সাইট বানান** — README-র [**Deploy to Netlify**](https://app.netlify.com/start/deploy?repository=https://github.com/azahar4bd/Daily-Data)
   বাটনে ক্লিক → Netlify-তে লগইন → GitHub অনুমতি দিন → **Save & Deploy**।
   (`DATABASE_URL` চাইলে আপাতত ফাঁকা রাখুন।)

2. **ডাটাবেস যোগ করুন** — Netlify-তে সাইট খুলে
   **Extensions** → **Neon** খুঁজে **Install** → **Add database**।
   Netlify নিজেই একটা Neon ডাটাবেস বানিয়ে কানেকশন স্ট্রিং বসিয়ে দেবে।

   > অ্যাপটা `DATABASE_URL`, `NETLIFY_DATABASE_URL`, `NEON_DATABASE_URL` —
   > তিন নামের যেটাই পাক সেটাই ব্যবহার করে, তাই আলাদা করে কিছু সেট করতে হবে না।

3. **ডেটা ঢোকান** — Neon কনসোলে (Netlify থেকেই লিংক পাবেন) **SQL Editor** খুলুন,
   [`deploy/neon-setup.sql`](deploy/neon-setup.sql) ফাইলটা পুরো কপি-পেস্ট করে **Run**।

4. Netlify-তে **Deploys** → **Trigger deploy** → **Clear cache and deploy site**।

`https://<your-site>.netlify.app/api/health` খুললে দেখবেন
`{"ok":true,"database":"connected","variable":"NETLIFY_DATABASE_URL","branches":5}`।

---

## হাতে হাতে করতে চাইলে (উপরেরটা না চাইলে)

নিচের ধাপগুলো একই কাজ ব্রাউজারে করে। সব মিলিয়ে ৫–১০ মিনিট।

---

## ধাপ ১ — Neon ডাটাবেস (৩ মিনিট)

1. <https://console.neon.tech> → **New Project**
   নাম `daily-data`, রিজিয়ন **AWS ap-southeast-1 (Singapore)** (ঢাকা থেকে সবচেয়ে কাছে)।
2. প্রজেক্ট তৈরি হলে **Connection string** কপি করুন। দেখতে এমন:
   ```
   postgresql://neondb_owner:xxxxx@ep-xxx-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
   এটা আলাদা করে রাখুন — ধাপ ২-এ লাগবে।
3. বাঁ পাশের মেনু থেকে **SQL Editor** খুলুন।
4. এই রিপোর [`deploy/neon-setup.sql`](deploy/neon-setup.sql) ফাইলটা পুরো কপি করে
   এডিটরে পেস্ট করুন → **Run**।

   এই এক ফাইলেই টেবিল তৈরি, ৫টা শাখা, আর `sheet.xlsx` থেকে নেওয়া
   **১৮ দিনের ৮৬টি দৈনিক সারি + ৫টি মাসিক ক্লোজিং** বসে যাবে।
   বারবার চালালেও ডুপ্লিকেট হবে না।

5. যাচাই — একই এডিটরে চালান:
   ```sql
   select entry_date, count(*), sum(savings)
   from daily_entries group by entry_date order by entry_date desc limit 3;
   ```
   সর্বশেষ সারিতে `2026-09-28 | 5 | 92713771` দেখা যাবে।

---

## ধাপ ২ — Netlify সাইট (৩ মিনিট)

**সবচেয়ে সহজ পথ — রিপো কানেক্ট করা।** এতে পরে শুধু `git push` করলেই
নিজে থেকে নতুন ডিপ্লয় হবে, কোনো টোকেন লাগবে না।

1. <https://app.netlify.com> → **Add new site** → **Import an existing project**
2. **GitHub** বেছে নিন → রিপো `azahar4bd/Daily-Data` বাছুন।
   (প্রথমবার হলে Netlify-কে রিপোতে অ্যাক্সেস দিতে হবে — *Configure Netlify on GitHub*।)
3. **Branch to deploy**: `arena/01a0eb92-daily-data`
   *(main-এ মার্জ করার পর এটা `main` করে দেবেন)*
4. Build settings — `netlify.toml` থেকে নিজে থেকেই ভরে যাবে:

   | ঘর | মান |
   |---|---|
   | Build command | `echo static-build` |
   | Publish directory | `.` |
   | Functions directory | `netlify/functions` |

5. **Add environment variables** → নতুন ভেরিয়েবল:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | ধাপ ১-এ কপি করা Neon connection string |

   > এটা এখনই দিন। না দিলে সাইট চলবে ঠিকই, কিন্তু 🟡 **ডেমো ডেটা** মোডে থাকবে।

6. **Deploy site** চাপুন।

ডিপ্লয় শেষ হলে লিংক পাবেন `https://<random-name>.netlify.app`।
**Site configuration → Change site name** থেকে সুন্দর নাম দিন, যেমন
`bkf-daily-data` → স্থায়ী লিংক হবে:

```
https://bkf-daily-data.netlify.app
```

---

## ধাপ ৩ — কাজ করছে কিনা দেখুন

1. `https://<your-site>.netlify.app/api/health` খুলুন →
   `{"ok":true,"database":"connected"}` আসা উচিত।
   `503` এলে `DATABASE_URL` ঠিকমতো বসেনি — ধাপ ২.৫ দেখুন।
2. ড্যাশবোর্ড খুলুন। উপরে ডানদিকে ব্যাজে 🟢 **লাইভ ডাটাবেস** দেখাবে।
3. **Daily Entry** পেজে একটা সারি সেভ করে রিফ্রেশ দিন — ডেটা থেকে যাবে।

---

## পরে আবার ডিপ্লয় করা

রিপো কানেক্ট করা থাকলে আর কিছুই করতে হবে না:

```bash
git add -A
git commit -m "আপডেট"
git push
```

Netlify নিজে থেকে বিল্ড করে লাইভ করে দেবে। **লিংক একই থাকবে।**

- প্রতিটি ডিপ্লয়ের আলাদা স্থায়ী URL-ও থাকে (Deploys ট্যাবে), তাই পুরোনো
  ভার্সনে ফিরে যাওয়া যায় — **Deploys → পুরোনো একটা → Publish deploy**।
- Pull request খুললে Netlify আলাদা **Deploy Preview** লিংক দেয়, লাইভ সাইট
  না ছুঁয়েই দেখে নিতে পারবেন।

---

## বিকল্প — টোকেন দিয়ে CI থেকে ডিপ্লয়

রিপো কানেক্ট না করতে চাইলে [`.github/workflows/deploy-netlify.yml`](.github/workflows/deploy-netlify.yml)
ব্যবহার করুন। GitHub-এ **Settings → Secrets and variables → Actions** থেকে দুটো সিক্রেট দিন:

| Secret | কোথায় পাবেন |
|---|---|
| `NETLIFY_AUTH_TOKEN` | Netlify → User settings → Applications → **New access token** |
| `NETLIFY_SITE_ID` | Netlify → Site configuration → General → **Site ID** |

তারপর push করলেই, বা **Actions → Deploy to Netlify → Run workflow** চাপলেই ডিপ্লয় হবে।

---

## স্ট্যাটিক প্রিভিউ (ডাটাবেস ছাড়া, ফ্রি, স্থায়ী)

শুধু দেখানোর জন্য হলে GitHub Pages-ই যথেষ্ট — ডেমো ডেটায় চলবে:

**Settings → Pages → Source: Deploy from a branch →
Branch: `arena/01a0eb92-daily-data` / `/ (root)` → Save**

লিংক হবে `https://azahar4bd.github.io/Daily-Data/`।
এখানে `/api/*` থাকবে না, তাই ব্যাজে সবসময় 🟡 **ডেমো ডেটা** দেখাবে —
`data/seed.json`-এর ১৮ দিনের আসল সংখ্যা ঠিকই দেখা যাবে।

---

## সমস্যা হলে

| লক্ষণ | কারণ ও সমাধান |
|---|---|
| ব্যাজে সবসময় 🟡 ডেমো ডেটা | `DATABASE_URL` সেট হয়নি, বা ঐ তারিখে DB-তে সারি নেই। `/api/health` দেখুন |
| `/api/*` → 404 | Functions directory `netlify/functions` কিনা দেখুন |
| `503 db_not_configured` | এনভায়রনমেন্ট ভেরিয়েবল যোগ করার পর **Deploys → Trigger deploy → Clear cache and deploy site** |
| `relation "daily_entries" does not exist` | ধাপ ১.৪ (`deploy/neon-setup.sql`) চালানো হয়নি |
| Neon ঘুমিয়ে গেছে | ফ্রি টিয়ারে নিষ্ক্রিয় থাকলে অটো-সাসপেন্ড হয়; প্রথম রিকোয়েস্টে ১–২ সেকেন্ড দেরি হবে, এরপর স্বাভাবিক |
