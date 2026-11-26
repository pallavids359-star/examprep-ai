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

## 1. How rows become GenPrep questions

The sync reads `public.questions` from each database (the question website's table:
`subject, klass, chapter, topic, exams, q_type, question, opt_a..opt_d, correct_option,
num_answer, solution_text, review_status, acceptance_status ...`). It uses the same rules
as the bulk upload's Supabase CSV import:

- **Syllabus by name:** each exam in `exams` (e.g. `["JEE","NEET"]`) gets its own copy,
  placed under the GenPrep Subject → Chapter → Topic with the same names (case, `&`/`and`
  and punctuation ignored; Maths = Mathematics). A missing **topic** under an existing
  chapter is created; a missing chapter or exam is reported and the row is skipped.
- **Question types:** assertion–reason and match-the-column are built like the bulk upload;
  numerical uses `num_answer`; `correct_option` `"1"`–`"4"` means A–D.
- **Difficulty** comes from `[QBP_DIFFICULTY:…]` in `solution_text`; the tag is removed.
- **Review status:** `pending` → **draft** (hidden from students, like `seed/draftPending.js`),
  `rejected` → archived, otherwise published. Set `SUPABASE_PENDING_STATUS=published` to show
  pending questions too.
- **Already uploaded questions** (same exam, same text) are linked to their row instead of
  being added again, so bookmarks and attempts stay attached.

Options: `SUPABASE_CREATE_TOPICS=false` to skip rows with unknown topics instead of creating
them; `SUPABASE_CREATE_CHAPTERS=true` to also create missing chapters (uses `klass`).

Tables that instead have a GenPrep `topic_id` column are also supported.

**First import from your computer** (fastest, no Vercel time limit):

```
cd server
node seed/syncSupabase.js
```

It prints how many questions were saved per database and the most common reasons rows were
skipped. Your `server/.env` `MONGO_URI` must point to the same database as the live site.

## 2. Prepare each Supabase project (optional)

Nothing is required: the sync only reads. Your tables already have `updated_at`, so only
changed rows are read on each sync. `supabase/setup.sql` (keeps `updated_at` current on
edits) and webhooks (instant updates) are optional and do change the Supabase database.

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

## Write-back: publishing in GenPrep accepts the question in Supabase

Off by default (Supabase stays read-only). To switch it on, set in `server/.env` and on Render:

```
SUPABASE_WRITE_BACK=true
SUPABASE_WRITE_AS=<email of an ACTIVE admin user of the Question Bank Portal>
```

When a question is published in GenPrep (Draft questions page, or saved as Published in the editor),
GenPrep calls the portal's own `public.apply_question_workflow(id, 'accept', admin, ...)`. The portal
sets `review_status = 'accepted'` and records it in its question history, audit log and the author's
notifications, exactly as if that admin accepted it in the portal.

Nothing else is written: edits, deletes and question text stay in GenPrep only.

The connection must be allowed to run that function: `SUPABASE_N_DB_URL` (database owner) works, or
`SUPABASE_N_URL` + `SUPABASE_N_KEY` with the **service_role** key (the anon key is refused).

## Write-back: edits made in GenPrep go to Supabase too

With the same two settings (`SUPABASE_WRITE_BACK=true`, `SUPABASE_WRITE_AS=<admin email>`), saving a
question in GenPrep's question editor also updates its row in the Question Bank Portal.

- Only what changed is written: question text, options A–D, correct option / numerical answer,
  solution and difficulty. The portal's hidden `[QBP_...]` markers are kept.
- Difficulty goes through `apply_question_workflow(..., 'difficulty', ...)`, so it shows in the
  portal's history. Other fields are written like an edit in the portal: `updated_by`,
  `updated_by_name` = "<admin> (GenPrep)", plus an `UPDATE_QUESTION` row in `audit_log`.
- Not sent: images, and the question text of match-the-following / statement-based questions.
  The editor tells you when something was not sent; change those in the portal.
- The copies of the same row for other exams (e.g. NEET and JEE) pick up the change at the next sync.
