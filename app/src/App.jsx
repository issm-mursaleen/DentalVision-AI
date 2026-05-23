import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import CavityDetection from './pages/CavityDetection';
import OralScreening from './pages/OralScreening';
import CVLearningLab from './pages/CVLearningLab';
import Reports from './pages/Reports';
import About from './pages/About';
import LoginPage from './pages/LoginPage';
import AuthCallback from './pages/AuthCallback';
import { Activity } from 'lucide-react';

// Renders a full-page spinner while session is being resolved
const LoadingScreen = () => (
  <div className="min-h-screen bg-gradient-to-br from-slate-900 via-sky-950 to-slate-900 flex items-center justify-center">
    <div className="flex flex-col items-center gap-4 text-white">
      <Activity className="w-10 h-10 text-sky-400 animate-spin" />
      <p className="text-slate-400 animate-pulse">Loading DentalVision AI…</p>
    </div>
  </div>
);

// Wraps any route that requires authentication
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user)   return <Navigate to="/login" replace />;
  return children;
};

// Redirects logged-in users away from /login
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user)    return <Navigate to="/" replace />;
  return children;
};

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Protected routes — require login */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="cavity-detection" element={<CavityDetection />} />
          <Route path="oral-screening"   element={<OralScreening />} />
          <Route path="learning-lab"     element={<CVLearningLab />} />
          <Route path="reports"          element={<Reports />} />
          <Route path="about"            element={<About />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
