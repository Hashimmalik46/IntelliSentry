import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, User } from 'lucide-react';
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
            .single();

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
    <div className="flex h-screen w-full bg-[#f8fafb] font-body text-[#333333]">
      <Sidebar />
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Topbar inside Layout */}
        <header className="h-20 bg-white flex items-center justify-between px-8 border-b border-gray-200 shrink-0">
          <div className="flex-1"></div>

          <div className="flex items-center gap-4">
            {headerRight}

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold rounded-xl shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer font-heading"
              title="Sign out of IntelliSentry"
            >
              <LogOut className="w-4 h-4 text-red-600" /> Logout
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
