import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import { useAuth } from '../context/AuthContext';

const Layout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user } = useAuth();

  const avatarUrl = user?.user_metadata?.avatar_url;
  const fullName  = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 relative">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-200 h-16 flex items-center px-4 md:px-6 shadow-sm z-10 shrink-0">
          <button
            className="md:hidden p-2 mr-3 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="text-lg md:text-xl font-semibold bg-gradient-to-r from-sky-600 to-teal-500 bg-clip-text text-transparent truncate flex-1">
            DentalVision AI
          </h1>

          {/* User avatar in header */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="hidden sm:block text-sm text-slate-500 truncate max-w-[140px]">{fullName}</span>
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={fullName}
                className="w-8 h-8 rounded-full object-cover ring-2 ring-sky-500/40"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-sky-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                {fullName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
