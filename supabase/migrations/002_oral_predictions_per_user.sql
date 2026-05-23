-- Per-user oral screening reports.
-- Run this once in the Supabase SQL editor (after 001_cavity_reports_per_user.sql).

create table if not exists public.oral_predictions (
  id                   bigserial primary key,
  created_at           timestamptz not null default now(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  filename             text,

  -- Images (base64-encoded JPEG, downscaled before insert)
  original_img         text not null,
  heatmap_img          text,

  -- Stage 1: binary (Normal vs Abnormal)
  binary_class         text   not null,
  binary_confidence    real   not null,
  binary_probs         jsonb  not null,

  -- Stage 2: disease (Variation / OPMD / Oral Cancer) — null when Normal
  disease_class        text,
  disease_confidence   real,
  disease_probs        jsonb,

  -- Convenience: what to show on the card
  final_label          text not null
);

create index if not exists oral_predictions_user_id_idx
  on public.oral_predictions (user_id, created_at desc);

-- Defense-in-depth RLS. The backend uses the service role key (which bypasses
-- RLS); the authoritative isolation lives in the JWT check in
-- backends/oral/app.py. These policies protect against any future code that
-- queries with the anon key.
alter table public.oral_predictions enable row level security;

drop policy if exists "oral_predictions_select_own" on public.oral_predictions;
create policy "oral_predictions_select_own"
  on public.oral_predictions for select
  using (auth.uid() = user_id);

drop policy if exists "oral_predictions_insert_own" on public.oral_predictions;
create policy "oral_predictions_insert_own"
  on public.oral_predictions for insert
  with check (auth.uid() = user_id);

drop policy if exists "oral_predictions_delete_own" on public.oral_predictions;
create policy "oral_predictions_delete_own"
  on public.oral_predictions for delete
  using (auth.uid() = user_id);
