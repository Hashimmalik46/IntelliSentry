import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, User, HelpCircle, Key, History, Users, UserPlus } from 'lucide-react';
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
  const [pendingOnboardingCount, setPendingOnboardingCount] = useState(0);

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
            .maybeSingle();

          if (studentRecord) {
            const adminStatus = studentRecord.role === 'admin';
            const nameStr = studentRecord.name || user.email.split('@')[0];
            
            setIsAdmin(adminStatus);
            setUserName(nameStr);

            sessionStorage.setItem('user_role', studentRecord.role || 'student');
            sessionStorage.setItem('user_name', nameStr);

            // Fetch pending pass requests & onboarding count for Admin
            if (adminStatus) {
              const { data: allReqs } = await supabase
                .from('pass_requests')
                .select('admin_status');

              if (allReqs && isMounted) {
                const count = allReqs.filter(r => 
                  !['APPROVED', 'REJECTED', 'COMPLETED'].includes(r.admin_status)
                ).length;
                setPendingPassCount(count);
              }

              const { data: allStudents } = await supabase.from('students').select('status, registration_number, role');
              const { data: allHousing } = await supabase.from('university_details').select('registration_number, hostel_name');

              if (allStudents && isMounted) {
                const housingMap = {};
                (allHousing || []).forEach(h => {
                  if (h.registration_number) {
                    housingMap[h.registration_number.toUpperCase().trim()] = h;
                  }
                });

                const pendingOnboard = allStudents.filter(s => {
                  if (!s.role || String(s.role).toLowerCase() === 'admin') return false;

                  const regKey = s.registration_number ? s.registration_number.toUpperCase().trim() : null;
                  const housing = regKey ? (housingMap[regKey] || {}) : {};

                  const isExplicitActive = s.status && String(s.status).toUpperCase() === 'ACTIVE';
                  const hasCompleteHousing = housing.hostel_name && housing.hostel_name !== 'Pending Assignment';

                  const isCompleted = isExplicitActive || hasCompleteHousing;
                  return !isCompleted;
                }).length;

                setPendingOnboardingCount(pendingOnboard);
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
    ...(isAdmin ? [
      { name: 'Student Onboarding', path: '/admin-onboarding', icon: UserPlus, badge: pendingOnboardingCount },
      { name: 'Student Directory', path: '/admin-students', icon: Users }
    ] : []),
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
    <>
      {/* Desktop Vertical Sidebar */}
      <aside className="hidden md:flex fixed top-0 bottom-0 left-0 z-30 w-64 bg-white border-r border-gray-200 flex-col shrink-0">
        <div className="p-6 pt-8 flex items-center gap-3">
          <img src="/favicon.svg" alt="IntelliSentry Logo" className="w-8 h-8 rounded-xl shadow-xs" />
          <div>
            <h1 className="text-xl font-bold text-[#006a6a] font-heading">IntelliSentry</h1>
            <p className="text-xs font-semibold text-gray-500 font-body">
              {isAdmin ? 'Administrator Portal' : 'Student Access'}
            </p>
          </div>
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
                <div className="flex items-center justify-between w-full min-w-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon size={20} className={isActive ? "text-[#006a6a] shrink-0" : "text-gray-500 shrink-0"} />
                    <span className="truncate whitespace-nowrap">{item.name}</span>
                  </div>
                  {item.badge > 0 && (
                    <span className="px-2 py-0.5 bg-amber-500 text-white text-[10px] font-extrabold rounded-full font-heading shadow-xs shrink-0 ml-1">
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

        {/* Footer Element */}
        <div className="p-4 border-t border-gray-100 mt-auto font-body">
          {isAdmin ? (
            <NavLink
              to="/profile"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all border ${
                  isActive
                    ? 'bg-teal-50 border-teal-200 text-[#006a6a]'
                    : 'bg-gray-50/80 border-gray-100 text-gray-700 hover:bg-gray-100/80'
                }`
              }
            >
              <div className="w-9 h-9 rounded-full bg-[#006a6a] text-white flex items-center justify-center font-bold text-sm font-heading shadow-xs shrink-0">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="text-left min-w-0 flex-1">
                <p className="text-xs font-bold font-heading text-gray-900 truncate">{userName}</p>
                <p className="text-[10px] font-semibold text-[#006a6a] font-mono">Administrator</p>
              </div>
            </NavLink>
          ) : (
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
          )}
        </div>
      </aside>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <nav className="flex md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-gray-200 h-16 items-center justify-around px-1 shadow-lg font-body">
        {[
          ...navItems,
          ...(!isAdmin ? [{ name: 'Help & Support', path: '/help', icon: HelpCircle }] : [])
        ].map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || 
            (location.pathname === '/' && item.path === (isAdmin ? '/admin' : '/studentportal'));

          // Shorten names for bottom bar labels
          let shortName = item.name;
          if (item.name === 'Student Onboarding') shortName = 'Onboard';
          else if (item.name === 'Student Directory') shortName = 'Directory';
          else if (item.name === 'Pass Approvals' || item.name === 'Leave Passes') shortName = 'Passes';
          else if (item.name === 'Activity Logs') shortName = 'Logs';
          else if (item.name === 'Dashboard') shortName = 'Home';
          else if (item.name === 'Help & Support') shortName = 'Help';

          return (
            <NavLink
              key={item.name}
              to={item.path}
              className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-all relative ${
                isActive ? 'text-[#006a6a] font-bold' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-[#006a6a] rounded-b-full"></div>
              )}
              <div className="relative">
                <Icon size={20} className={isActive ? 'text-[#006a6a]' : 'text-gray-500'} />
                {item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 px-1.5 py-0.2 bg-amber-500 text-white text-[9px] font-extrabold rounded-full shadow-xs leading-none">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[64px]">
                {shortName}
              </span>
            </NavLink>
          );
        })}
      </nav>
    </>
  );
};

export default Sidebar;
