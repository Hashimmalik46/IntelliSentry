import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Activity, Key, User, HelpCircle } from 'lucide-react';

const Sidebar = () => {
  const location = useLocation();
  
  const navItems = [
    { name: 'Dashboard', path: '/studentportal', icon: LayoutDashboard },
    { name: 'Activity', path: '/activity', icon: Activity },
    { name: 'Pass Requests', path: '/pass-requests', icon: Key },
    { name: 'Profile', path: '/profile', icon: User },
    { name: 'Help', path: '/help', icon: HelpCircle },
  ];

  return (
    <div className="w-64 bg-white h-full border-r border-gray-200 flex flex-col shrink-0">
      <div className="p-6 pt-8">
        <h1 className="text-2xl font-bold text-[#006a6a]">Security Portal</h1>
        <p className="text-sm text-gray-500 mt-1">Student Access</p>
      </div>
      
      <nav className="flex-1 mt-6 px-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          // Determine if active based on path. 
          // If on /studentportal, we might want to fake "Activity" as active to match screenshot if they click it,
          // but let's stick to matching the actual path.
          const isActive = location.pathname === item.path || (location.pathname === '/' && item.path === '/studentportal');
          
          return (
            <NavLink
              key={item.name}
              to={item.path}
              className={() =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors relative ${
                  isActive
                    ? 'bg-teal-50/50 text-[#006a6a] font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <Icon size={20} className={isActive ? "text-[#006a6a]" : "text-gray-500"} />
              <span>{item.name}</span>
              {isActive && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-[#006a6a] rounded-l-md"></div>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-6 border-t border-gray-100 mt-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#006a6a] flex items-center justify-center text-white font-semibold">
            HM
          </div>
          <div>
            <p className="font-medium text-sm text-gray-900">Hashim Malik</p>
            <p className="text-xs text-gray-500">ID: 2849-NS</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
