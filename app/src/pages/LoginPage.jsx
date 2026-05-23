import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Stethoscope, Activity, ShieldCheck, Sparkles, ScanEye, Microscope } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const features = [
  { icon: ScanEye,    label: 'AI Cavity Detection',    desc: 'YOLO bounding-box inference with XAI heatmaps' },
  { icon: Microscope, label: 'Oral Cancer Screening',  desc: 'Two-stage hierarchical ResNet classification' },
  { icon: Sparkles,   label: 'Explainable AI',         desc: 'Grad-CAM++ localisation of high-risk regions' },
  { icon: ShieldCheck,label: 'Private & Secure',        desc: 'Data tied to your account — only you can see it' },
];

const LoginPage = () => {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      await signInWithGoogle();
      // Page will redirect to Google — no further action needed here
    } catch (err) {
      setError(err.message || 'Sign-in failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-sky-950 to-slate-900 flex items-center justify-center p-4 font-sans relative overflow-hidden">

      {/* Background decorative blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-sky-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-teal-600/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center z-10">

        {/* Left Panel — branding */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="text-white flex flex-col gap-8"
        >
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-sky-500/20 border border-sky-500/40 rounded-xl flex items-center justify-center backdrop-blur">
              <Stethoscope className="w-6 h-6 text-sky-400" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">DentalVision AI</h1>
              <p className="text-sky-400 text-sm font-medium">Computer Vision Diagnostics</p>
            </div>
          </div>

          {/* Headline */}
          <div>
            <h2 className="text-4xl lg:text-5xl font-black leading-tight mb-4">
              Smart Dental<br />
              <span className="bg-gradient-to-r from-sky-400 to-teal-400 bg-clip-text text-transparent">
                Diagnostics
              </span>
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed">
              AI-powered cavity detection and oral cancer screening.
              Sign in to keep your scan history private and accessible only to you.
            </p>
          </div>

          {/* Feature pills */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {features.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-xl p-3 backdrop-blur-sm">
                <div className="w-8 h-8 shrink-0 bg-sky-500/20 rounded-lg flex items-center justify-center mt-0.5">
                  <Icon className="w-4 h-4 text-sky-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{label}</p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Right Panel — sign-in card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="bg-white/10 border border-white/15 backdrop-blur-xl rounded-3xl p-8 md:p-10 flex flex-col items-center gap-6 shadow-2xl shadow-black/40"
        >
          {/* Card header */}
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-sky-500 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-sky-500/30">
              <Stethoscope className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-white">Welcome back</h3>
            <p className="text-slate-400 mt-1 text-sm">Sign in to access your dental scans</p>
          </div>

          {/* Divider */}
          <div className="w-full border-t border-white/10" />

          {/* Error */}
          {error && (
            <div className="w-full bg-red-500/20 border border-red-500/40 text-red-300 text-sm rounded-xl px-4 py-3 text-center">
              {error}
            </div>
          )}

          {/* Google Sign-in button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 disabled:bg-slate-200 text-slate-800 font-semibold py-3.5 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed"
          >
            {loading ? (
              <Activity className="w-5 h-5 animate-spin text-sky-600" />
            ) : (
              /* Google "G" SVG */
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            {loading ? 'Redirecting to Google…' : 'Continue with Google'}
          </button>

          {/* Privacy note */}
          <p className="text-slate-500 text-xs text-center leading-relaxed">
            By continuing, you agree to our terms of service. Your data is stored securely in Supabase and is only accessible to you.
          </p>

          {/* Badge */}
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-4 py-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-emerald-300 text-xs font-medium">Row Level Security enabled — your scans are private</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default LoginPage;
