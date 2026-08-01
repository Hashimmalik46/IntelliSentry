import React from 'react';
import Sidebar from './Sidebar';

const Layout = ({ children, headerRight }) => {
  return (
    <div className="flex h-screen w-full bg-[#f8fafb] font-body text-[#333333]">
      <Sidebar />
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Topbar inside Layout */}
        <header className="h-20 bg-white flex items-center justify-between px-8 border-b border-gray-200 shrink-0">
           <div className="flex-1"></div>
           <div className="flex items-center gap-6">
             {headerRight}
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
