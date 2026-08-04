import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, User, HelpCircle } from 'lucide-react';
import Sidebar from './Sidebar';
import { supabase } from '../supabaseClient';

const Layout = ({ children, headerRight }) => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState(() => {
    return sessionStorage.getItem('user_name') || 'User';
  });
  const [userRole, setUserRole] = useState(() => {
    return sessionStorage.getItem('user_role') || 'student';
  });

  useEffect(() => {
    async function loadUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: studentRecord } = await supabase
            .from('students')
            .select('role, name')
            .eq('user_id', user.id)
            .maybeSingle();

          if (studentRecord) {
            const nameStr = studentRecord.name || user.email.split('@')[0];
            const roleStr = studentRecord.role || 'student';
            setUserName(nameStr);
            setUserRole(roleStr);
            sessionStorage.setItem('user_name', nameStr);
            sessionStorage.setItem('user_role', roleStr);
          }
        }
      } catch (err) {
        console.warn("Layout user load notice:", err);
      }
    }

    loadUser();
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("Signout notice:", err);
    } finally {
      sessionStorage.clear();
      localStorage.clear();
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#f8fafb] font-body text-[#333333] relative">
      <Sidebar />
      <div className="md:pl-64 flex flex-col min-h-screen w-full max-w-full">
        {/* Topbar inside Layout */}
        <header className="sticky top-0 z-40 h-16 md:h-20 bg-white/95 backdrop-blur-md flex items-center justify-between px-4 md:px-8 border-b border-gray-200 shrink-0">
          {/* Left branding on Mobile, empty flex on Desktop */}
          <div className="flex items-center gap-2.5 md:flex-1 min-w-0">
            <div className="flex md:hidden items-center gap-2 min-w-0">
              <img src="/favicon.svg" alt="IntelliSentry Logo" className="w-7 h-7 rounded-lg shadow-2xs shrink-0" />
              <span className="text-base font-bold text-[#006a6a] font-heading tracking-tight truncate">IntelliSentry</span>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            {headerRight}

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="px-2.5 py-1.5 md:px-3.5 md:py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold rounded-xl shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer font-heading shrink-0"
              title="Sign out of IntelliSentry"
            >
              <LogOut className="w-4 h-4 text-red-600 shrink-0" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 md:p-8 pb-24 md:pb-8 w-full max-w-full overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
