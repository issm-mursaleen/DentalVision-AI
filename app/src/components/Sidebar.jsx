import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Target, BookOpen, FileText, Info, Stethoscope, Microscope, X } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Cavity Detection', path: '/cavity-detection', icon: Target },
  { name: 'Oral Screening', path: '/oral-screening', icon: Microscope },
  { name: 'CV Learning Lab', path: '/learning-lab', icon: BookOpen },
  { name: 'Reports', path: '/reports', icon: FileText },
  { name: 'About Project', path: '/about', icon: Info },
];

const Sidebar = ({ isOpen, setIsOpen }) => {
  return (
    <aside className={cn(
      "w-64 bg-slate-900 text-white flex flex-col shadow-xl z-30 transition-transform duration-300",
      "fixed inset-y-0 left-0 md:relative md:translate-x-0",
      isOpen ? "translate-x-0" : "-translate-x-full"
    )}>
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
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.name}
              to={item.path}
              onClick={() => setIsOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group',
                  isActive
                    ? 'bg-sky-500/10 text-sky-400'
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
      <div className="p-4 border-t border-slate-800">
        <div className="bg-slate-800/50 rounded-lg p-3 text-xs text-slate-400">
          <p className="font-semibold text-slate-300 mb-1">Semester Project</p>
          <p>Computer Vision Lab</p>
          <p>v1.0.0-dummy</p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
