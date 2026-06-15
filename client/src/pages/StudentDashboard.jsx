import React from 'react';
import Layout from '../components/Layout';
import { CheckCircle2, LogIn, LogOut, Download, Filter } from 'lucide-react';

const StudentDashboard = () => {
  const headerRight = (
    <div className="text-right">
      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-0.5">Access Status</p>
      <p className="text-sm font-bold text-[#006a6a]">Verified Student</p>
    </div>
  );

  const history = [
    { id: 1, date: 'May 24, 2024', time: '08:42 AM', type: 'Entry', method: 'NFC\nSmartcard', status: 'AUTHORIZED', statusColor: 'bg-teal-50 text-[#006a6a]' },
    { id: 2, date: 'May 23, 2024', time: '10:15 PM', type: 'Exit', method: 'Biometric', status: 'AUTHORIZED', statusColor: 'bg-teal-50 text-[#006a6a]' },
    { id: 3, date: 'May 23, 2024', time: '07:55 AM', type: 'Entry', method: 'NFC\nSmartcard', status: 'AUTHORIZED', statusColor: 'bg-teal-50 text-[#006a6a]' },
    { id: 4, date: 'May 22, 2024', time: '09:02 PM', type: 'Late Exit', method: 'Manual\nPass', status: 'FLAGGED', statusColor: 'bg-orange-50 text-orange-600' },
  ];

  return (
    <Layout headerRight={headerRight}>
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Status Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-between relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-[#006a6a]"></div>
          <div className="flex items-center gap-5 ml-4">
            <div className="w-14 h-14 rounded-full bg-teal-50 flex items-center justify-center">
               <CheckCircle2 className="w-8 h-8 text-[#006a6a]" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Current Status</p>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-gray-900">Inside Campus</h2>
                <span className="px-3 py-1 bg-teal-50 text-[#006a6a] text-xs font-semibold rounded-full">Secure</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500 mb-1 font-medium">Last Scan Details</p>
            <p className="font-bold text-gray-900">Main Gate • 08:42 AM Today</p>
            <p className="text-xs text-gray-500 mt-1">NFC-Verification Method</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-6">
          <button className="bg-[#006a6a] hover:bg-[#005959] transition-colors text-white rounded-2xl p-6 flex items-center gap-5 text-left shadow-sm">
            <div className="w-12 h-12 rounded-xl border border-white/20 flex items-center justify-center shrink-0">
               <LogIn className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold mb-1">Enter into the Hostel</h3>
              <p className="text-white/80 text-sm">Record your entry into the hostel</p>
            </div>
          </button>
          <button className="bg-white hover:bg-gray-50 transition-colors border border-[#d99f57] text-gray-900 rounded-2xl p-6 flex items-center gap-5 text-left shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-orange-50/50 flex items-center justify-center shrink-0">
               <LogOut className="w-6 h-6 text-[#b46b2b]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#b46b2b] mb-1">Exit from the Hostel</h3>
              <p className="text-gray-500 text-sm">Record your exit from the hostel</p>
            </div>
          </button>
        </div>

        {/* Movement History */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mt-8">
          <div className="p-6 flex items-center justify-between border-b border-gray-100">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Movement History</h3>
              <p className="text-sm text-gray-500 mt-1">Chronological record of campus access</p>
            </div>
            <div className="flex gap-3">
              <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                <Filter className="w-4 h-4" /> Filter
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-[#006a6a] hover:bg-[#005959] transition-colors rounded-lg text-sm font-semibold text-white shadow-sm">
                <Download className="w-4 h-4" /> Export Log
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8fafb] text-[11px] uppercase tracking-wider text-gray-500 font-bold border-b border-gray-100">
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Time</th>
                  <th className="px-6 py-4">Movement Type</th>
                  <th className="px-6 py-4">Method</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-5 whitespace-nowrap text-sm font-semibold text-gray-900">{row.date}</td>
                    <td className="px-6 py-5 whitespace-nowrap text-sm text-gray-600 font-medium">{row.time}</td>
                    <td className="px-6 py-5 whitespace-nowrap text-sm font-bold">
                      <div className={`flex items-center gap-2 ${row.type.includes('Exit') ? 'text-[#b46b2b]' : 'text-[#006a6a]'}`}>
                        {row.type.includes('Exit') ? <LogOut className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
                        {row.type}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-sm text-gray-600 font-medium whitespace-pre-wrap leading-tight">
                      {row.method}
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <span className={`px-3 py-1.5 text-[10px] font-bold tracking-wider rounded-full uppercase ${row.statusColor}`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </Layout>
  );
};

export default StudentDashboard;
