import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnon) {
  console.error('Missing Supabase env vars. Check app/.env');
}

export const supabase = createClient(supabaseUrl, supabaseAnon);

// ── Auth helpers ──────────────────────────────────────────────────────────────
// Every backend call that touches Supabase data must include the user's JWT
// so the backend can verify identity and filter by user_id. The service role
// key on the backend bypasses RLS, so this header is the only thing keeping
// users from seeing each other's data.

export const getAccessToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
};

export const authHeaders = async () => {
  const token = await getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};
