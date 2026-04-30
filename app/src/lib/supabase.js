import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnon) {
  console.error('Missing Supabase env vars. Check app/.env');
}

export const supabase = createClient(supabaseUrl, supabaseAnon);

// ── Convenience helpers ───────────────────────────────────────────────────────

export const getCavityReports = (filter = 'all') => {
  const q = supabase.from('cavity_reports').select('*');
  const now = new Date();
  if (filter === 'today') {
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    return q.gte('created_at', start.toISOString());
  }
  if (filter === 'week') {
    const start = new Date(now); start.setDate(start.getDate() - 7); start.setHours(0, 0, 0, 0);
    return q.gte('created_at', start.toISOString());
  }
  if (filter === 'month') {
    const start = new Date(now); start.setDate(1); start.setHours(0, 0, 0, 0);
    return q.gte('created_at', start.toISOString());
  }
  return q.order('created_at', { ascending: false });
};

export const deleteCavityReport = (id) =>
  supabase.from('cavity_reports').delete().eq('id', id);

export const getOralPredictions = () =>
  supabase.from('oral_predictions').select('*').order('created_at', { ascending: false });
