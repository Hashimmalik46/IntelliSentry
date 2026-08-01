import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, User, HelpCircle, Key, History, Users } from 'lucide-react';
import { supabase } from '../supabaseClient';

const Sidebar = () => {
  const location = useLocation();

  // Single source of truth role state initialized from cached session
  const [isAdmin, setIsAdmin] = useState(() => {
    return sessionStorage.getItem('user_role') === 'admin';
  });

  const [userName, setUserName] = useState(() => {
    return sessionStorage.getItem('user_name') || 'User';
  });

  const [pendingPassCount, setPendingPassCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function checkRoleAndCount() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && isMounted) {
          const { data: studentRecord } = await supabase
            .from('students')
            .select('role, name')
            .eq('user_id', user.id)
            .single();

          if (studentRecord) {
            const adminStatus = studentRecord.role === 'admin';
            const nameStr = studentRecord.name || user.email.split('@')[0];
            
            setIsAdmin(adminStatus);
            setUserName(nameStr);

            sessionStorage.setItem('user_role', studentRecord.role || 'student');
            sessionStorage.setItem('user_name', nameStr);

            // Fetch pending pass requests count for Admin
            if (adminStatus) {
              const { data: pendingReqs } = await supabase
                .from('pass_requests')
                .select('id')
                .eq('parent_status', 'APPROVED')
                .neq('admin_status', 'APPROVED')
                .neq('admin_status', 'REJECTED');

              if (pendingReqs && isMounted) {
                setPendingPassCount(pendingReqs.length);
              }
            }
          }
        }
      } catch (err) {
        console.warn("Sidebar data fetch notice:", err);
      }
    }

    checkRoleAndCount();
    return () => { isMounted = false; };
  }, [location.pathname]);

  const navItems = [
    { 
      name: 'Dashboard', 
      path: isAdmin ? '/admin' : '/studentportal', 
      icon: LayoutDashboard 
    },
    ...(isAdmin ? [{ name: 'Student Directory', path: '/admin-students', icon: Users }] : []),
    {
      name: isAdmin ? 'Pass Approvals' : 'Leave Passes',
      path: isAdmin ? '/admin-passes' : '/pass-requests',
      icon: Key,
      badge: isAdmin ? pendingPassCount : 0
    },
    ...(!isAdmin ? [{ name: 'Activity Logs', path: '/activity-logs', icon: History }] : []),
    { 
      name: 'Profile', 
      path: '/profile', 
      icon: User 
    }
  ];

  return (
    <div className="w-64 bg-white h-full border-r border-gray-200 flex flex-col shrink-0">
      <div className="p-6 pt-8">
        <h1 className="text-2xl font-bold text-[#006a6a] font-heading">IntelliSentry</h1>
        <p className="text-sm font-semibold text-gray-500 mt-1 font-body">
          {isAdmin ? 'Administrator Portal' : 'Student Access'}
        </p>
      </div>
      
      <nav className="flex-1 mt-4 px-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || 
            (location.pathname === '/' && item.path === (isAdmin ? '/admin' : '/studentportal'));
          
          return (
            <NavLink
              key={item.name}
              to={item.path}
              className={() =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors relative font-body ${
                  isActive
                    ? 'bg-teal-50/50 text-[#006a6a] font-semibold'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                  <Icon size={20} className={isActive ? "text-[#006a6a]" : "text-gray-500"} />
                  <span>{item.name}</span>
                </div>
                {item.badge > 0 && (
                  <span className="px-2 py-0.5 bg-amber-500 text-white text-[10px] font-extrabold rounded-full font-heading shadow-xs">
                    {item.badge}
                  </span>
                )}
              </div>
              {isActive && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-[#006a6a] rounded-l-md"></div>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer Help & Support Button */}
      <div className="p-4 border-t border-gray-100 mt-auto font-body">
        <NavLink
          to="/help"
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-3 rounded-xl transition-all border ${
              isActive
                ? 'bg-teal-50 border-teal-200 text-[#006a6a] font-semibold'
                : 'bg-gray-50 border-gray-100 text-gray-700 hover:bg-gray-100'
            }`
          }
        >
          <HelpCircle size={20} className="text-[#006a6a]" />
          <div className="text-left">
            <p className="text-xs font-bold font-heading text-gray-900">Help & Support</p>
            <p className="text-[10px] text-gray-500">FAQ & Security Guidelines</p>
          </div>
        </NavLink>
      </div>
    </div>
  );
};

export default Sidebar;
