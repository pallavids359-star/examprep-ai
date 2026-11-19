# Connecting the Supabase question databases

GenPrep keeps serving questions from its MongoDB. Questions from your Supabase
databases are copied in automatically, so tests, bookmarks, attempts and
progress work exactly as before.

```
Supabase DB 1..8 ──(webhook, instant)──▶ /api/sync/supabase/webhook ──▶ MongoDB ──▶ website
          └─────(daily catch-up + "Sync now" button)─────────────────────┘
```

- **Instant:** every insert, update or delete in Supabase calls a webhook, and the
  question shows up (or disappears) on the site within a second or two.
- **Catch-up:** Supabase does not retry a failed webhook, so a daily job (and the
  **Sync now** button in Admin → Overview) re-reads anything changed since the last run.
- **Deletes:** a deleted row is *archived* in GenPrep, not removed, because old test
  attempts still point to it. **Full resync** also archives questions whose rows
  are gone from Supabase.

## 1. What each Supabase table needs

The sync connects to each database with its Postgres connection string
(or, alternatively, the Supabase REST API) and only reads from it.

The table uses the same fields as GenPrep's `Question` model. Column names can be
camelCase or snake_case.

| Column | Required | Notes |
| --- | --- | --- |
| `id` | yes | primary key (bigint or uuid) |
| `topic_id` / `topicId` | yes | the GenPrep **Topic `_id`** (24-character Mongo id). Exam, subject and chapter are filled in from it. |
| `text` | yes | question text |
| `type` | no | `mcq_single` (default), `mcq_multi`, `numerical` |
| `options` | MCQ | jsonb `[{"id":"A","text":"..."}, ...]`, or `["a","b","c","d"]`, or columns `option_a` … `option_d` |
| `correct_option_ids` / `correctOptionIds` | MCQ | `["B"]`, `"B"` or `"A,C"` (`correct_answer` / `answer` also work) |
| `numerical_answer` | numerical | `{"value": 9.8, "tolerance": 0.1}` or just a number |
| `explanation` | no | text, or `{"text","images","videoUrl"}` |
| `difficulty` | no | `easy`, `medium` (default), `hard` |
| `images`, `tags`, `marks`, `source` | no | same shapes as in MongoDB |
| `status` | no | `published`, `draft`, `archived`. Without it, rows are `published` (change with `SUPABASE_DEFAULT_STATUS=draft`) |
| `updated_at` | recommended | added by `supabase/setup.sql` |

Rows that can't be imported (unknown topic, 3 options, no correct answer…) are
skipped and listed with the reason on the admin dashboard.

## 2. Prepare each Supabase project

In **each** of the 8 projects: SQL Editor → paste `supabase/setup.sql` → Run.

## 3. Add environment variables on Vercel

Project → Settings → Environment Variables. **Paste the connection strings here, not
in code or chat.** `.env` is already in `.gitignore` for local use.

For each database 1 to 8:

| Name | Value |
| --- | --- |
| `SUPABASE_1_DB_URL` | the connection string, e.g. `postgresql://postgres.abcd:PASSWORD@aws-0-ap-south-1.pooler.supabase.com:6543/postgres` |
| `SUPABASE_1_NAME` | optional short label, e.g. `physics` (default `db1`) |
| `SUPABASE_1_TABLE` | optional, default `questions` |
| `SUPABASE_1_SCHEMA` | optional, default `public` |
| `SUPABASE_1_UPDATED_COLUMN` | optional, default `updated_at`; `none` if you skipped setup.sql |
| `SUPABASE_1_CA_CERT` | optional: Supabase's SSL certificate text, to verify the server (Database Settings → SSL Configuration) |
| … `SUPABASE_8_*` | same for the others |
| `SUPABASE_WEBHOOK_SECRET` | any long random string (e.g. from `openssl rand -hex 32`) |
| `CRON_SECRET` | another long random string; Vercel sends it to the daily job automatically |

**Which connection string:** in each Supabase project click **Connect** and copy the
**Transaction pooler** string (host `…pooler.supabase.com`, port `6543`). The
"Direct connection" string (`db.xxxx.supabase.co:5432`) is IPv6-only and Vercel
can't reach it. The admin panel warns you if you use it.

**Password with special characters:** if your database password contains `@ # / ? : %`,
URL-encode it in the string (`@` → `%40`, `#` → `%23`, `/` → `%2F`).

Prefer the REST API instead? Use `SUPABASE_N_URL` (Project URL) + `SUPABASE_N_KEY`
(service_role key) in place of `SUPABASE_N_DB_URL`. You can mix both kinds.

Redeploy after adding them. To run locally, put the same variables in `server/.env`
and run `npm install` in `server` (adds the `pg` driver).

## 4. First import

Admin → Overview → **Supabase question databases** → **Sync now**. The button
keeps going until all 8 databases are caught up (large tables take several rounds
of ~45 s each). Check the "rows that could not be imported" list for each database.

## 5. Turn on instant updates (webhooks)

In **each** Supabase project: Integrations → **Database Webhooks** → Enable → Create a new hook:

- **Table:** `questions` · **Events:** Insert, Update, Delete
- **Type:** HTTP Request · **Method:** POST
- **URL:** `https://YOUR-SITE.vercel.app/api/sync/supabase/webhook?source=physics`
  (use that database's `SUPABASE_N_NAME`, or `db1`, `db2`… if you didn't set one)
- **HTTP Headers:** `x-webhook-secret` = your `SUPABASE_WEBHOOK_SECRET`
- **Timeout:** 10000 ms

Or use the SQL at the bottom of `supabase/setup.sql`.

Test it: edit a question in Supabase, then refresh the admin dashboard. "Last webhook" should say "just now".

## Notes

- **Edit synced questions in Supabase.** An edit made in GenPrep's admin panel is
  overwritten the next time that row changes or a full resync runs.
- **Daily job time:** 02:00 IST (`30 20 * * *` UTC in `vercel.json`). Vercel's
  Hobby plan allows only daily cron jobs. On Pro you can change it to e.g. `*/10 * * * *`.
- Questions you created in GenPrep itself (admin form or bulk upload) are never touched by the sync.
