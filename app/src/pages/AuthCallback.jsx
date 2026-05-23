import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Activity } from 'lucide-react';

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase automatically exchanges the code/token from the URL hash.
    // We just wait for onAuthStateChange to fire, then redirect.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        navigate('/', { replace: true });
      } else if (event === 'SIGNED_OUT' || !session) {
        navigate('/login', { replace: true });
      }
    });

    // Fallback: if already signed in (race condition), redirect immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/', { replace: true });
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-sky-950 to-slate-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-white">
        <Activity className="w-10 h-10 text-sky-400 animate-spin" />
        <p className="text-lg font-semibold animate-pulse">Signing you in…</p>
      </div>
    </div>
  );
};

export default AuthCallback;
