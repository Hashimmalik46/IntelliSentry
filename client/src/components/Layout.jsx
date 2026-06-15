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
             <div className="relative cursor-pointer hover:opacity-80 transition-opacity">
               <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
               <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
             </div>
             <div className="h-8 w-px bg-gray-200"></div>
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
