import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { ArrowDownLeft, ArrowUpRight, History, Calendar, Shield, Filter, Home } from 'lucide-react';
import { supabase } from '../supabaseClient';

const ActivityLogs = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('ALL');
  const [dateRange, setDateRange] = useState('ALL'); // 'ALL', 'WEEK', 'MONTH', '3_MONTHS'

  useEffect(() => {
    async function loadLogs() {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        let studentRecord = null;
        if (user) {
          const { data: student } = await supabase
            .from('students')
            .select('*')
            .eq('user_id', user.id)
            .single();

          studentRecord = student;
        }

        let logQuery = supabase.from('attendance_logs').select('*').order('created_at', { ascending: false });
        if (user) {
          const regNo = studentRecord?.registration_number;
          if (regNo && regNo !== 'N/A') {
            logQuery = logQuery.or(`user_id.eq.${user.id},registration_number.eq.${regNo}`);
          } else {
            logQuery = logQuery.eq('user_id', user.id);
          }
        }

        const { data: logs, error } = await logQuery;

        if (!error && logs) {
          const formattedLogs = logs.map(log => {
            const dateObj = new Date(log.created_at || Date.now());
            return {
              id: log.id,
              createdAt: dateObj,
              date: dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
              time: dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
              type: log.type || 'Entry',
              exit_type: log.exit_type || (log.type.includes('Exit') ? 'NORMAL_EXIT' : 'ENTRY'),
              expected_return_time: log.expected_return_time || '-',
              method: log.method || 'Geofence + Biometric',
              status: log.status || 'AUTHORIZED',
              statusColor: log.status === 'AUTHORIZED' ? 'bg-teal-50 text-[#006a6a]' : 'bg-orange-50 text-orange-600'
            };
          });

          setHistory(formattedLogs);
        }
      } catch (err) {
        console.warn("Fetch activity logs notice:", err);
      } finally {
        setLoading(false);
      }
    }

    loadLogs();
  }, []);

  const filteredHistory = history.filter(item => {
    // 1. Movement Direction Filter
    const matchesMovement = filterType === 'ALL' 
      ? true 
      : (filterType === 'ENTRY' ? item.type.includes('Entry') : item.type.includes('Exit'));

    // 2. Date Range Filter
    let matchesDate = true;
    const now = new Date();
    const itemDate = new Date(item.createdAt);

    if (dateRange === 'WEEK') {
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      matchesDate = itemDate >= oneWeekAgo;
    } else if (dateRange === 'MONTH') {
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      matchesDate = itemDate >= oneMonthAgo;
    } else if (dateRange === '3_MONTHS') {
      const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      matchesDate = itemDate >= threeMonthsAgo;
    }

    return matchesMovement && matchesDate;
  });

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6 font-body">
        
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 font-heading">My Access Activity Logs</h2>
            <p className="text-xs text-gray-500 font-body">Complete history of your hostel gate entry and exit verification logs</p>
          </div>
        </div>

        {/* History Table Container */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 font-heading">Personal Audit Records</h3>
              <p className="text-xs text-gray-500 font-body">Timestamped logs for geofence & biometric face scans</p>
            </div>

            <div className="flex flex-wrap items-center gap-3 font-body">
              {/* Date Range Filter */}
              <div className="flex items-center gap-2 bg-white border border-gray-200 px-3 py-2 rounded-xl">
                <Calendar className="w-4 h-4 text-[#006a6a]" />
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="text-xs font-semibold text-gray-700 bg-transparent focus:outline-none cursor-pointer font-body"
                >
                  <option value="ALL">All Time</option>
                  <option value="WEEK">Past 7 Days (Week)</option>
                  <option value="MONTH">Past 30 Days (Month)</option>
                  <option value="3_MONTHS">Past 90 Days (3 Months)</option>
                </select>
              </div>

              {/* Movement Type Filter */}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 bg-white focus:outline-none cursor-pointer font-body"
              >
                <option value="ALL">All Movements</option>
                <option value="ENTRY">Entries Only</option>
                <option value="EXIT">Exits Only</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="p-8 space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-12 bg-gray-50 rounded-xl animate-pulse"></div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#f8fafb] text-[11px] uppercase tracking-wider text-gray-500 font-bold border-b border-gray-100 font-heading">
                    <th className="px-6 py-4">Movement & Exit Type</th>
                    <th className="px-6 py-4">Date & Time</th>
                    <th className="px-6 py-4">Expected Return</th>
                    <th className="px-6 py-4">Verification Method</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-body">
                  {filteredHistory.length > 0 ? (
                    filteredHistory.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          {item.type.includes('Entry') ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold font-heading text-[#006a6a]">
                              <ArrowDownLeft className="w-4 h-4" /> Hostel Entry
                            </span>
                          ) : item.exit_type === 'LEAVE_TO_HOME' || item.type.includes('Leave') ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold font-heading text-purple-700">
                              <Home className="w-4 h-4" /> Exit to Home (Pass)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold font-heading text-amber-700">
                              <ArrowUpRight className="w-4 h-4" /> Normal Local Exit
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-700 font-medium">
                          {item.date} at {item.time}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold text-gray-700">
                          {item.expected_return_time}
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-600 font-medium">{item.method}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase ${item.statusColor} font-heading`}>
                            {item.status} ✅
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="px-6 py-10 text-center text-sm text-gray-500 font-medium font-body">
                        No activity logs recorded for the selected time range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </Layout>
  );
};

export default ActivityLogs;
