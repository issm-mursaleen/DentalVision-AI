-- Per-user isolation for cavity_reports.
-- Run this once in the Supabase SQL editor.

-- 1. Ensure the user_id column exists and points at auth.users.
alter table public.cavity_reports
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists cavity_reports_user_id_idx
  on public.cavity_reports (user_id, created_at desc);

-- 2. Enable Row Level Security. Note that the backend uses the service role
-- key, which BYPASSES RLS — the real enforcement is the JWT check in
-- backends/cavity/main.py. These policies are defense-in-depth for any code
-- path that hits Supabase with the anon key (e.g. the frontend reading
-- cavity_reports directly in the future).
alter table public.cavity_reports enable row level security;

drop policy if exists "cavity_reports_select_own" on public.cavity_reports;
create policy "cavity_reports_select_own"
  on public.cavity_reports for select
  using (auth.uid() = user_id);

drop policy if exists "cavity_reports_insert_own" on public.cavity_reports;
create policy "cavity_reports_insert_own"
  on public.cavity_reports for insert
  with check (auth.uid() = user_id);

drop policy if exists "cavity_reports_update_own" on public.cavity_reports;
create policy "cavity_reports_update_own"
  on public.cavity_reports for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "cavity_reports_delete_own" on public.cavity_reports;
create policy "cavity_reports_delete_own"
  on public.cavity_reports for delete
  using (auth.uid() = user_id);

-- 3. Existing rows have no user_id and will be invisible to everyone after
-- this migration. If you want to keep them around for a specific user,
-- backfill manually, e.g.:
--   update public.cavity_reports
--   set    user_id = '<your-auth-user-uuid>'
--   where  user_id is null;
-- Otherwise, clean them up:
--   delete from public.cavity_reports where user_id is null;
