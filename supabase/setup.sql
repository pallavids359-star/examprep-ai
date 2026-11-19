-- Run this once in EACH of your Supabase projects (SQL Editor → New query → Run).
-- Change "questions" below if your table has another name.
--
-- It adds an updated_at column that changes on every edit, so GenPrep's
-- catch-up sync can fetch only what changed since its last run.

alter table public.questions add column if not exists updated_at timestamptz;
update public.questions set updated_at = now() where updated_at is null;
alter table public.questions alter column updated_at set default now();
alter table public.questions alter column updated_at set not null;

create or replace function public.genprep_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists genprep_touch_updated_at on public.questions;
create trigger genprep_touch_updated_at
before update on public.questions
for each row execute function public.genprep_touch_updated_at();

-- Makes the sync's "changed since" query fast
create index if not exists questions_updated_at_id_idx on public.questions (updated_at, id);


-- ─────────────────────────────────────────────────────────────────────────────
-- OPTIONAL: create the instant-update webhook with SQL instead of the dashboard.
-- First enable webhooks once: Dashboard → Integrations → Database Webhooks → Enable.
-- Then replace the 3 placeholders and run:
--
--   YOUR-SITE      your Vercel domain, e.g. genprep.vercel.app
--   DB_NAME        this database's SUPABASE_N_NAME (e.g. physics, or db1)
--   YOUR_SECRET    the same value as SUPABASE_WEBHOOK_SECRET on Vercel
-- ─────────────────────────────────────────────────────────────────────────────
-- drop trigger if exists genprep_sync on public.questions;
-- create trigger genprep_sync
-- after insert or update or delete on public.questions
-- for each row execute function supabase_functions.http_request(
--   'https://YOUR-SITE/api/sync/supabase/webhook?source=DB_NAME',
--   'POST',
--   '{"Content-Type":"application/json","x-webhook-secret":"YOUR_SECRET"}',
--   '{}',
--   '10000'
-- );
