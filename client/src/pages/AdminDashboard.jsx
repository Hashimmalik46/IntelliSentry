import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { Users, Building, FileSpreadsheet, Shield, Search, ArrowUpRight, ArrowDownLeft, CheckCircle2, RefreshCw, UserCheck, ShieldAlert, LogOut, Home, ArrowRight, UserPlus, Clock, AlertCircle, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState({
    totalStudents: 0,
    insideCount: 0,
    outsideCount: 0,
    normalExitsCount: 0,
    homeExitsCount: 0,
    biometricsEnrolled: 0,
    pendingSetupCount: 0,
    outsideAfter5PMCount: 0,
  });

  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [logFilter, setLogFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  const [overdueStudents, setOverdueStudents] = useState([]);
  const [isOverdueModalOpen, setIsOverdueModalOpen] = useState(false);
  const [overdueSearchQuery, setOverdueSearchQuery] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Fetch admin dashboard metrics and audit logs
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Students (role != admin) strictly from 'students' table
      const { data: studentsData } = await supabase
        .from('students')
        .select('*')
        .order('created_at', { ascending: false });

      const studentRows = (studentsData || []).filter(s => {
        if (!s.role) return true;
        return String(s.role).toLowerCase() !== 'admin';
      });

      // 2. Fetch Housing Details
      const { data: housingData } = await supabase.from('university_details').select('*');
      const housingMap = {};
      (housingData || []).forEach(h => {
        if (h.registration_number) {
          housingMap[h.registration_number.toUpperCase().trim()] = h;
        }
      });

      // 3. Fetch Biometric Embeddings
      const { data: embeddingsData } = await supabase.from('face_embeddings').select('user_id, registration_number');
      const enrolledSet = new Set((embeddingsData || []).map(e => (e.registration_number || e.user_id || '').toUpperCase().trim()));

      // 4. Fetch Active Approved Pass Requests
      const { data: activePassesData } = await supabase
        .from('pass_requests')
        .select('id, user_id, registration_number, admin_status')
        .eq('admin_status', 'APPROVED');

      const activeApprovedPassRegs = new Set(
        (activePassesData || []).map(p => (p.registration_number || p.user_id || '').toUpperCase().trim())
      );

      // 5. Fetch Attendance Logs
      const { data: logsData } = await supabase
        .from('attendance_logs')
        .select('*')
        .order('created_at', { ascending: false });

      const formattedLogs = (logsData || []).map(log => {
        const dateObj = new Date(log.created_at || Date.now());
        
        let exitTypeLabel = 'Entry';
        if (log.type.includes('Exit') || log.exit_type) {
          if (log.exit_type === 'LEAVE_TO_HOME' || log.type.includes('Leave to Home')) {
            exitTypeLabel = 'Exit to Home (Leave Pass)';
          } else {
            exitTypeLabel = 'Normal Local Exit';
          }
        }

        return {
          id: log.id,
          user_id: log.user_id,
          student_name: log.student_name || 'Student',
          registration_number: log.registration_number || 'N/A',
          type: log.type || 'Entry',
          exit_type: log.exit_type || (log.type.includes('Exit') ? 'NORMAL_EXIT' : 'ENTRY'),
          exit_type_label: exitTypeLabel,
          expected_return_time: log.expected_return_time || (log.type.includes('Exit') ? 'Same Day' : '-'),
          method: log.method || 'Geofence + Biometric',
          status: log.status || 'AUTHORIZED',
          date: dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          time: dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          raw_created_at: log.created_at || Date.now()
        };
      });

      // User ID -> Reg Number map
      const userIdToRegMap = {};
      studentRows.forEach(s => {
        if (s.user_id && s.registration_number) {
          userIdToRegMap[s.user_id] = s.registration_number.toUpperCase().trim();
        }
      });

      // Determine latest movement direction
      const studentLatestMovement = {};
      for (const log of formattedLogs) {
        let key = (log.registration_number && log.registration_number !== 'N/A')
          ? log.registration_number.toUpperCase().trim()
          : (userIdToRegMap[log.user_id] || log.user_id);
        
        if (key && !studentLatestMovement[key]) {
          studentLatestMovement[key] = log;
        }
      }

      let insideCount = 0;
      let outsideCount = 0;
      let normalExitsCount = 0;
      let homeExitsCount = 0;
      let biometricsEnrolled = 0;
      let pendingSetupCount = 0;

      const overdueList = [];
      const now = new Date();
      const todayStr = now.toDateString();

      studentRows.forEach(s => {
        const regKey = (s.registration_number && s.registration_number !== 'N/A')
          ? s.registration_number.toUpperCase().trim()
          : null;

        const housing = regKey ? housingMap[regKey] : null;

        const isExplicitActive = s.status && String(s.status).toUpperCase() === 'ACTIVE';
        const hasHousing = housing && housing.hostel_name && housing.hostel_name !== 'Pending Assignment';

        if (!isExplicitActive && !hasHousing) {
          pendingSetupCount++;
        }

        const latestLog = regKey ? studentLatestMovement[regKey] : (s.user_id ? studentLatestMovement[s.user_id] : null);
        let isOutside = false;
        let exitCategory = null;

        if (latestLog && latestLog.type.toLowerCase().includes('exit')) {
          if (latestLog.exit_type === 'LEAVE_TO_HOME') {
            if ((regKey && activeApprovedPassRegs.has(regKey)) || (s.user_id && activeApprovedPassRegs.has(s.user_id))) {
              isOutside = true;
              exitCategory = 'LEAVE_TO_HOME';
            }
          } else {
            const logDateStr = new Date(latestLog.raw_created_at).toDateString();
            if (logDateStr === todayStr) {
              isOutside = true;
              exitCategory = 'NORMAL_EXIT';
            }
          }
        }

        if (isOutside && latestLog) {
          outsideCount++;
          if (exitCategory === 'LEAVE_TO_HOME') {
            homeExitsCount++;
          } else {
            normalExitsCount++;
          }

          // Evaluate 5:00 PM Return Deadline
          const exitDate = new Date(latestLog.raw_created_at || Date.now());
          const deadline = new Date(exitDate.getFullYear(), exitDate.getMonth(), exitDate.getDate(), 17, 0, 0, 0);

          if (now >= deadline) {
            const diffMs = now.getTime() - deadline.getTime();
            const totalMinutes = Math.floor(diffMs / (1000 * 60));
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;

            let durationStr = '';
            if (hours > 0) {
              durationStr = `${hours} hr${hours > 1 ? 's' : ''} ${minutes} min${minutes !== 1 ? 's' : ''} overdue`;
            } else {
              durationStr = `${minutes} min${minutes !== 1 ? 's' : ''} overdue`;
            }

            overdueList.push({
              id: s.id || latestLog.id,
              student_name: s.name || latestLog.student_name || 'Student',
              registration_number: s.registration_number || latestLog.registration_number || 'N/A',
              checkout_time: `${exitDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at ${exitDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
              expected_return_time: latestLog.expected_return_time && latestLog.expected_return_time !== 'Same Day' ? latestLog.expected_return_time : '5:00 PM',
              overdue_duration: durationStr || '0 mins overdue',
              overdue_minutes: totalMinutes,
              hostel_name: housing?.hostel_name || 'Hostel Premises',
              room_number: housing?.room_number || 'N/A'
            });
          }
        } else {
          insideCount++;
        }

        if ((regKey && enrolledSet.has(regKey)) || (s.user_id && enrolledSet.has(s.user_id))) {
          biometricsEnrolled++;
        }
      });

      setAttendanceLogs(formattedLogs);
      setOverdueStudents(overdueList);

      setMetrics({
        totalStudents: studentRows.length,
        insideCount: insideCount,
        outsideCount: outsideCount,
        normalExitsCount: normalExitsCount,
        homeExitsCount: homeExitsCount,
        biometricsEnrolled: biometricsEnrolled,
        pendingSetupCount: pendingSetupCount,
        outsideAfter5PMCount: overdueList.length,
      });
    } catch (err) {
      console.warn("Admin data fetch notice:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Supabase Realtime channel for live updates when student checks in or out
    const channel = supabase
      .channel('admin_attendance_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pass_requests' }, () => {
        fetchData();
      })
      .subscribe();

    // Periodic timer (every 5 seconds) to recalculate overdue durations live
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const exportMasterCSV = () => {
    if (attendanceLogs.length === 0) return;
    const headers = ["Student Name", "Registration No", "Movement Type", "Exit Type", "Date & Time", "Expected Return", "Method", "Status"];
    const rows = attendanceLogs.map(l => [l.student_name, l.registration_number, l.type, l.exit_type_label, `${l.date} ${l.time}`, l.expected_return_time, l.method, l.status]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `master_intellisentry_audit_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredLogs = attendanceLogs.filter(log => {
    const matchesSearch = log.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          log.registration_number.toLowerCase().includes(searchQuery.toLowerCase());
    if (logFilter === 'ENTRY') return matchesSearch && log.type.includes('Entry');
    if (logFilter === 'NORMAL_EXIT') return matchesSearch && log.exit_type === 'NORMAL_EXIT';
    if (logFilter === 'HOME_EXIT') return matchesSearch && log.exit_type === 'LEAVE_TO_HOME';
    return matchesSearch;
  });

  const headerRight = (
    <button
      onClick={fetchData}
      className="w-9 h-9 rounded-xl bg-[#006a6a] hover:bg-[#005959] flex items-center justify-center text-white transition-colors cursor-pointer shadow-xs"
      title="Refresh Data"
    >
      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
    </button>
  );

  return (
    <Layout headerRight={headerRight}>
      <div className="max-w-6xl mx-auto space-y-8 font-body">
        
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading leading-snug break-words">Campus Gate Control & Movement Dashboard</h2>
            <p className="text-xs text-gray-500 font-body leading-relaxed mt-0.5 break-words">Real-time attendance tracking, student premises verification & master audit logs</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              onClick={() => navigate('/admin-onboarding')}
              className="px-3.5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer font-heading"
            >
              <UserPlus className="w-4 h-4" /> Student Onboarding
              {metrics.pendingSetupCount > 0 && (
                <span className="bg-white text-amber-900 text-[10px] px-1.5 py-0.5 rounded-full font-mono font-extrabold">
                  {metrics.pendingSetupCount}
                </span>
              )}
            </button>

            <button
              onClick={() => navigate('/admin-students')}
              className="px-3.5 py-2.5 bg-white hover:bg-gray-50 text-gray-800 text-xs font-bold rounded-xl border border-gray-200 shadow-xs transition-all flex items-center gap-2 cursor-pointer font-heading"
            >
              <Users className="w-4 h-4 text-[#006a6a]" /> Directory <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={exportMasterCSV}
              className="px-3.5 py-2.5 bg-[#006a6a] hover:bg-[#005959] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer font-heading"
            >
              <FileSpreadsheet className="w-4 h-4" /> Export CSV
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          
          {loading ? (
            [1, 2, 3].map(i => (
              <div key={i} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between animate-pulse">
                <div className="space-y-2">
                  <div className="w-28 h-2.5 bg-slate-200 rounded-md"></div>
                  <div className="w-16 h-7 bg-slate-200 rounded-md"></div>
                  <div className="w-24 h-2.5 bg-slate-200 rounded-md"></div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-slate-200"></div>
              </div>
            ))
          ) : (
            <>
              <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider font-heading">Inside Premises</p>
                  <h3 className="text-2xl font-extrabold text-emerald-700 mt-1 font-heading">{metrics.insideCount}</h3>
                  <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">🟢 Currently On-Campus</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <Home className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider font-heading">Outside Premises</p>
                  <h3 className="text-2xl font-extrabold text-amber-700 mt-1 font-heading">{metrics.outsideCount}</h3>
                  <p className="text-[11px] text-amber-600 font-semibold mt-0.5">
                    Local: {metrics.normalExitsCount} | Home Pass: {metrics.homeExitsCount}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                  <LogOut className="w-6 h-6" />
                </div>
              </div>

              {/* KPI Card: Students Outside After 5 PM */}
              <div
                onClick={() => setIsOverdueModalOpen(true)}
                className="bg-white p-5 rounded-2xl border border-rose-200 hover:border-rose-400 shadow-sm hover:shadow-md transition-all flex items-center justify-between cursor-pointer group"
              >
                <div>
                  <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider font-heading">Students Outside After 5 PM</p>
                  <h3 className="text-2xl font-extrabold text-rose-700 mt-1 font-heading">{metrics.outsideAfter5PMCount}</h3>
                  <p className="text-[11px] text-rose-600 font-semibold mt-0.5 flex items-center gap-1 group-hover:underline">
                    <span>🚨 Overdue Return Alert</span>
                    <span className="text-[10px] text-rose-500 font-normal">(Click for list →)</span>
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition-all">
                  <Clock className="w-6 h-6" />
                </div>
              </div>
            </>
          )}

        </div>

        {/* Master Audit Logs Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 font-heading">Master Attendance & Movement Audit Logs</h3>
              <p className="text-xs text-gray-500 font-body">Real-time geofence and biometric verification audit log</p>
            </div>

            <div className="flex flex-wrap items-center gap-3 font-body">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search student or Reg No..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#006a6a] w-48 sm:w-64 font-body"
                />
              </div>

              <select
                value={logFilter}
                onChange={(e) => setLogFilter(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 bg-white focus:outline-none cursor-pointer font-body"
              >
                <option value="ALL">All Movements</option>
                <option value="ENTRY">Hostel Entries</option>
                <option value="NORMAL_EXIT">Normal Local Exits</option>
                <option value="HOME_EXIT">Exit to Home (Pass)</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8fafb] text-[11px] uppercase tracking-wider text-gray-500 font-bold border-b border-gray-100 font-heading">
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4">Reg Number</th>
                  <th className="px-6 py-4">Movement & Exit Type</th>
                  <th className="px-6 py-4">Scan Timestamp</th>
                  <th className="px-6 py-4">Expected Return</th>
                  <th className="px-6 py-4">Method & Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-body">
                {loading ? (
                  [1, 2, 3, 4, 5].map(i => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4"><div className="w-32 h-3.5 bg-slate-200 rounded-md"></div></td>
                      <td className="px-6 py-4"><div className="w-24 h-3 bg-slate-200 rounded-md"></div></td>
                      <td className="px-6 py-4"><div className="w-20 h-3 bg-slate-200 rounded-md"></div></td>
                      <td className="px-6 py-4"><div className="w-36 h-3 bg-slate-200 rounded-md"></div></td>
                      <td className="px-6 py-4"><div className="w-28 h-3 bg-slate-200 rounded-md"></div></td>
                      <td className="px-6 py-4"><div className="w-16 h-5 bg-slate-200 rounded-full"></div></td>
                    </tr>
                  ))
                ) : filteredLogs.length > 0 ? (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-gray-900 text-sm font-heading">{log.student_name}</td>
                      <td className="px-6 py-4 font-mono text-xs font-semibold text-[#006a6a]">{log.registration_number}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {log.type.includes('Entry') ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold font-heading text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                            <ArrowDownLeft className="w-3.5 h-3.5" /> Hostel Entry
                          </span>
                        ) : log.exit_type === 'LEAVE_TO_HOME' || log.exit_type_label.includes('Leave') ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold font-heading text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200">
                            <Home className="w-3.5 h-3.5" /> Exit to Home (Pass)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold font-heading text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                            <ArrowUpRight className="w-3.5 h-3.5" /> Normal Local Exit
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-600 font-medium">
                        {log.date} at {log.time}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold text-gray-700">
                        {log.expected_return_time}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 text-[10px] font-bold uppercase bg-teal-50 text-[#006a6a] font-heading">
                          {log.status} ✅
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="px-6 py-10 text-center text-sm text-gray-500 font-medium">
                      No matching audit logs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* OVERDUE STUDENTS MODAL (MINIMAL DESIGN) */}
      {isOverdueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in font-body">
          <div className="bg-white rounded-3xl max-w-4xl w-full overflow-hidden shadow-xl border border-gray-100 relative transition-all">
            
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-6 py-4.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 font-bold shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight font-heading flex items-center gap-2.5">
                    Students Outside After 5 PM
                    <span className="px-2.5 py-0.5 bg-rose-500/20 text-rose-300 text-[11px] font-mono font-bold rounded-full border border-rose-500/30">
                      {overdueStudents.length} Overdue
                    </span>
                  </h3>
                  <p className="text-xs text-gray-400 font-body">Real-time oversight for students missing the 5:00 PM return deadline</p>
                </div>
              </div>
              <button
                onClick={() => setIsOverdueModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4 max-h-[72vh] overflow-y-auto">
              
              {/* Search bar inside modal */}
              <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by student name or roll number..."
                    value={overdueSearchQuery}
                    onChange={(e) => setOverdueSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#006a6a] font-body"
                  />
                </div>
              </div>

              {/* Table Container with Horizontal Scroll & Min-Width to prevent any column clipping */}
              <div className="border border-gray-200 rounded-2xl overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-[#f8fafb] text-[11px] uppercase tracking-wider text-gray-500 font-bold border-b border-gray-200 font-heading">
                      <th className="px-4 py-3.5">Student Name</th>
                      <th className="px-4 py-3.5">Roll Number</th>
                      <th className="px-4 py-3.5">Checkout Time</th>
                      <th className="px-4 py-3.5">Expected Return</th>
                      <th className="px-4 py-3.5 whitespace-nowrap min-w-[160px]">Overdue Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs font-body">
                    {overdueStudents.filter(st =>
                      st.student_name.toLowerCase().includes(overdueSearchQuery.toLowerCase()) ||
                      st.registration_number.toLowerCase().includes(overdueSearchQuery.toLowerCase())
                    ).length > 0 ? (
                      overdueStudents
                        .filter(st =>
                          st.student_name.toLowerCase().includes(overdueSearchQuery.toLowerCase()) ||
                          st.registration_number.toLowerCase().includes(overdueSearchQuery.toLowerCase())
                        )
                        .map((st) => (
                          <tr key={st.id || st.registration_number} className="hover:bg-gray-50/60 transition-colors">
                            <td className="px-4 py-3.5 font-bold text-gray-900 font-heading">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-teal-50 text-[#006a6a] flex items-center justify-center font-bold text-xs font-heading shrink-0 border border-teal-100">
                                  {st.student_name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-bold text-gray-900">{st.student_name}</p>
                                  <p className="text-[10px] text-gray-500 font-normal">{st.hostel_name} ({st.room_number})</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 font-mono font-semibold text-[#006a6a] whitespace-nowrap">{st.registration_number}</td>
                            <td className="px-4 py-3.5 text-gray-600 font-medium whitespace-nowrap">{st.checkout_time}</td>
                            <td className="px-4 py-3.5 font-semibold text-gray-800 whitespace-nowrap">{st.expected_return_time}</td>
                            <td className="px-4 py-3.5 whitespace-nowrap min-w-[160px]">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold font-mono bg-rose-50 text-rose-700 border border-rose-200">
                                <Clock className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                {st.overdue_duration}
                              </span>
                            </td>
                          </tr>
                        ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="px-6 py-10 text-center text-xs text-gray-500 font-medium">
                          {overdueStudents.length === 0
                            ? "No students are currently outside after 5 PM. All students have returned safely! ✅"
                            : "No matching overdue students found."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 px-6 py-3.5 border-t border-gray-100 flex items-center justify-between font-body">
              <p className="text-[11px] text-gray-500">
                Overdue duration updates automatically in real-time.
              </p>
              <button
                onClick={() => setIsOverdueModalOpen(false)}
                className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white font-bold text-xs rounded-xl transition-all cursor-pointer font-heading"
              >
                Close Report
              </button>
            </div>

          </div>
        </div>
      )}
    </Layout>
  );
};

export default AdminDashboard;

