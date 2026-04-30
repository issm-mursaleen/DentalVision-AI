-- Run this once in Supabase SQL Editor:
-- https://eslaqtonokwaabkxtogj.supabase.co/ → SQL Editor → New Query

-- ── Cavity detection reports (replaces SQLite) ────────────────────────────────
CREATE TABLE IF NOT EXISTS cavity_reports (
  id               BIGSERIAL PRIMARY KEY,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  original_img     TEXT,
  annotated_img    TEXT,
  heatmap_img      TEXT,
  confidence       REAL,
  cavity_count     INTEGER     DEFAULT 0,
  cavity_detected  BOOLEAN     DEFAULT FALSE,
  summary          TEXT
);

-- ── Oral screening predictions ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS oral_predictions (
  id                  BIGSERIAL PRIMARY KEY,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  filename            TEXT,
  binary_class        TEXT,
  binary_confidence   REAL,
  disease_class       TEXT,
  disease_confidence  REAL,
  final_label         TEXT,
  heatmap_base64      TEXT
);

-- ── Allow read access for the anon (frontend) role ────────────────────────────
ALTER TABLE cavity_reports  ENABLE ROW LEVEL SECURITY;
ALTER TABLE oral_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read cavity_reports"
  ON cavity_reports FOR SELECT USING (true);

CREATE POLICY "Public read oral_predictions"
  ON oral_predictions FOR SELECT USING (true);

-- Service role (backend) bypasses RLS automatically — no policy needed for writes.
