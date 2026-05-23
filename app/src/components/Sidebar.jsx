import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Target, BookOpen, FileText, Info, Stethoscope, Microscope, X, LogOut } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuth } from '../context/AuthContext';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { name: 'Dashboard',        path: '/',                  icon: LayoutDashboard },
  { name: 'Cavity Detection', path: '/cavity-detection',  icon: Target },
  { name: 'Oral Screening',   path: '/oral-screening',    icon: Microscope },
  { name: 'CV Learning Lab',  path: '/learning-lab',      icon: BookOpen },
  { name: 'Reports',          path: '/reports',           icon: FileText },
  { name: 'About Project',    path: '/about',             icon: Info },
];

const Sidebar = ({ isOpen, setIsOpen }) => {
  const { user, signOut } = useAuth();

  const avatarUrl  = user?.user_metadata?.avatar_url;
  const fullName   = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const email      = user?.email || '';

  const handleSignOut = async () => {
    try { await signOut(); } catch (e) { console.error(e); }
  };

  return (
    <aside className={cn(
      "w-64 bg-slate-900 text-white flex flex-col shadow-xl z-30 transition-transform duration-300",
      "fixed inset-y-0 left-0 md:relative md:translate-x-0",
      isOpen ? "translate-x-0" : "-translate-x-full"
    )}>
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800 shrink-0">
        <div className="flex items-center">
          <Stethoscope className="w-6 h-6 text-sky-400 mr-2" />
          <span className="text-lg font-bold tracking-wide">DentalVision AI</span>
        </div>
        <button
          className="md:hidden text-slate-400 hover:text-white"
          onClick={() => setIsOpen(false)}
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.name}
              to={item.path}
              end={item.path === '/'}
              onClick={() => setIsOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group',
                  isActive
                    ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                )
              }
            >
              <Icon className="w-5 h-5 mr-3 shrink-0" />
              {item.name}
            </NavLink>
          );
        })}
      </nav>

      {/* User profile + Sign Out */}
      <div className="p-4 border-t border-slate-800 shrink-0">
        <div className="flex items-center gap-3 mb-3">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={fullName}
              className="w-9 h-9 rounded-full object-cover ring-2 ring-sky-500/40 shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-sky-600 flex items-center justify-center shrink-0 text-white font-bold text-sm">
              {fullName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="overflow-hidden">
            <p className="text-sm font-semibold text-white truncate">{fullName}</p>
            <p className="text-xs text-slate-500 truncate">{email}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-slate-400 hover:text-red-400 hover:bg-red-500/10 py-2 rounded-lg transition-colors border border-slate-800 hover:border-red-500/20"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
