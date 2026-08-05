import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { Users, Building, FileSpreadsheet, Shield, Search, ArrowUpRight, ArrowDownLeft, CheckCircle2, RefreshCw, UserCheck, ShieldAlert, LogOut, Home, ArrowRight, UserPlus, Clock, AlertCircle, X, Settings } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { getCurfewConfig, saveCurfewConfig, fetchRemoteCurfewConfig, formatHourLabel } from '../utils/curfewConfig';

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
  const [insideStudents, setInsideStudents] = useState([]);
  const [isInsideModalOpen, setIsInsideModalOpen] = useState(false);
  const [insideSearchQuery, setInsideSearchQuery] = useState('');
  const [outsideStudents, setOutsideStudents] = useState([]);
  const [isOutsideModalOpen, setIsOutsideModalOpen] = useState(false);
  const [outsideSearchQuery, setOutsideSearchQuery] = useState('');
  const [isCurfewModalOpen, setIsCurfewModalOpen] = useState(false);
  const [curfewConfigState, setCurfewConfigState] = useState(getCurfewConfig());
  const [overdueSearchQuery, setOverdueSearchQuery] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    student: null,
    actionType: 'ENTRY',
    submitting: false
  });

  const openConfirmModal = (student, actionType) => {
    setConfirmModal({
      isOpen: true,
      student,
      actionType,
      submitting: false
    });
  };

  const executeAuthorization = async () => {
    if (!confirmModal.student) return;
    const { student, actionType } = confirmModal;
    setConfirmModal(prev => ({ ...prev, submitting: true }));

    try {
      if (actionType === 'ENTRY') {
        const { error } = await supabase.from('attendance_logs').insert([{
          user_id: student.user_id || student.id,
          student_name: student.student_name,
          registration_number: student.registration_number,
          type: 'Entry',
          exit_type: 'ENTRY',
          method: 'Warden Emergency Entry Override',
          status: 'AUTHORIZED'
        }]);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('attendance_logs').insert([{
          user_id: student.user_id || student.id,
          student_name: student.student_name,
          registration_number: student.registration_number,
          type: 'Exit (Normal)',
          exit_type: 'NORMAL_EXIT',
          method: 'Warden Emergency Exit Override',
          status: 'AUTHORIZED'
        }]);
        if (error) throw error;
      }

      setConfirmModal({ isOpen: false, student: null, actionType: 'ENTRY', submitting: false });
      fetchData();
    } catch (err) {
      alert(`Error logging authorization: ${err.message}`);
      setConfirmModal(prev => ({ ...prev, submitting: false }));
    }
  };

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
      const insideList = [];
      const outsideList = [];
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

        if (latestLog) {
          const typeStr = (latestLog.type || '').toLowerCase();
          const exitTypeStr = (latestLog.exit_type || '').toLowerCase();
          if (typeStr.includes('exit') || exitTypeStr.includes('exit')) {
            isOutside = true;
            if (exitTypeStr.includes('home') || typeStr.includes('home')) {
              exitCategory = 'LEAVE_TO_HOME';
            } else {
              exitCategory = 'NORMAL_EXIT';
            }
          }
        }

        const exitDate = latestLog ? new Date(latestLog.raw_created_at || Date.now()) : null;
        const formattedScanTime = exitDate ? `${exitDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at ${exitDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}` : 'Authorized stay';
        const studentDisplayName = s.name || latestLog?.student_name || 'Student';
        const studentRegNo = s.registration_number || latestLog?.registration_number || 'N/A';

        if (isOutside) {
          outsideCount++;
          if (exitCategory === 'LEAVE_TO_HOME') {
            homeExitsCount++;
          } else {
            normalExitsCount++;
          }

          outsideList.push({
            id: s.id || (latestLog ? latestLog.id : regKey),
            user_id: s.user_id || (latestLog ? latestLog.user_id : null),
            student_name: studentDisplayName,
            registration_number: studentRegNo,
            checkout_time: formattedScanTime,
            exit_type_label: exitCategory === 'LEAVE_TO_HOME' ? 'Leave to Home' : 'Normal Exit',
            hostel_name: housing?.hostel_name || 'Hostel Premises',
            room_number: housing?.room_number || 'N/A'
          });

          // Evaluate Return Deadline based on dynamic curfew configuration
          const currentCurfewConfig = getCurfewConfig();
          const startHour = currentCurfewConfig.startHour ?? 17;
          if (exitDate) {
            const deadline = new Date(exitDate.getFullYear(), exitDate.getMonth(), exitDate.getDate(), startHour, 0, 0, 0);

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
                id: s.id || (latestLog ? latestLog.id : regKey),
                user_id: s.user_id || (latestLog ? latestLog.user_id : null),
                student_name: studentDisplayName,
                registration_number: studentRegNo,
                checkout_time: formattedScanTime,
                expected_return_time: latestLog?.expected_return_time && latestLog.expected_return_time !== 'Same Day' ? latestLog.expected_return_time : formatHourLabel(startHour),
                overdue_duration: durationStr || '0 mins overdue',
                overdue_minutes: totalMinutes,
                hostel_name: housing?.hostel_name || 'Hostel Premises',
                room_number: housing?.room_number || 'N/A'
              });
            }
          }
        } else {
          insideCount++;
          insideList.push({
            id: s.id || (latestLog ? latestLog.id : regKey),
            user_id: s.user_id || (latestLog ? latestLog.user_id : null),
            student_name: studentDisplayName,
            registration_number: studentRegNo,
            checkin_time: latestLog ? formattedScanTime : 'Authorized Stay',
            hostel_name: housing?.hostel_name || 'Hostel Premises',
            room_number: housing?.room_number || 'N/A'
          });
        }

        if ((regKey && enrolledSet.has(regKey)) || (s.user_id && enrolledSet.has(s.user_id))) {
          biometricsEnrolled++;
        }
      });

      setAttendanceLogs(formattedLogs);
      setOverdueStudents(overdueList);
      setInsideStudents(insideList);
      setOutsideStudents(outsideList);

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

  const handleWardenOverride = async (st) => {
    if (!window.confirm(`Authorize Warden Emergency Entry Clearance for ${st.student_name} (${st.registration_number})? This will mark the student as IN HOSTEL.`)) {
      return;
    }

    try {
      const { error } = await supabase.from('attendance_logs').insert([{
        user_id: st.user_id || st.id,
        student_name: st.student_name,
        registration_number: st.registration_number,
        type: 'Entry',
        exit_type: 'ENTRY',
        method: 'Warden Emergency Entry Override',
        status: 'AUTHORIZED'
      }]);

      if (error) throw error;
      alert(`Warden emergency entry clearance granted for ${st.student_name}.`);
      fetchData();
    } catch (err) {
      alert(`Error logging clearance: ${err.message}`);
    }
  };

  const handleWardenExitOverride = async (st) => {
    if (!window.confirm(`Authorize Warden Emergency Exit Clearance for ${st.student_name} (${st.registration_number})? This will mark the student as OUT OF HOSTEL.`)) {
      return;
    }

    try {
      const { error } = await supabase.from('attendance_logs').insert([{
        user_id: st.user_id || st.id,
        student_name: st.student_name,
        registration_number: st.registration_number,
        type: 'Exit (Normal)',
        exit_type: 'NORMAL_EXIT',
        method: 'Warden Emergency Exit Override',
        status: 'AUTHORIZED'
      }]);

      if (error) throw error;
      alert(`Warden emergency exit clearance granted for ${st.student_name}.`);
      fetchData();
    } catch (err) {
      alert(`Error logging clearance: ${err.message}`);
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
            <h2 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading leading-snug break-words">Gate Control & Movement</h2>
            <p className="text-xs text-gray-500 font-body leading-relaxed mt-0.5 break-words">Real-time attendance tracking & movement audit</p>
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
              onClick={() => setIsCurfewModalOpen(true)}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer font-heading"
            >
              <Settings className="w-4 h-4 text-amber-400" /> Curfew Config
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
              {/* KPI Card: Inside Premises */}
              <div
                onClick={() => setIsInsideModalOpen(true)}
                className="bg-white p-5 rounded-2xl border border-emerald-100 hover:border-emerald-300 shadow-sm hover:shadow-md transition-all flex items-center justify-between cursor-pointer group"
              >
                <div>
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider font-heading">Inside Premises</p>
                  <h3 className="text-2xl font-extrabold text-emerald-700 mt-1 font-heading">{metrics.insideCount}</h3>
                  <p className="text-[11px] text-emerald-600 font-semibold mt-0.5 flex items-center gap-1 group-hover:underline">
                    <span>🟢 Currently On-Campus</span>
                    <span className="text-[10px] text-emerald-500 font-normal">(Click for list →)</span>
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                  <Home className="w-6 h-6" />
                </div>
              </div>

              {/* KPI Card: Outside Premises */}
              <div
                onClick={() => setIsOutsideModalOpen(true)}
                className="bg-white p-5 rounded-2xl border border-amber-100 hover:border-amber-300 shadow-sm hover:shadow-md transition-all flex items-center justify-between cursor-pointer group"
              >
                <div>
                  <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider font-heading">Outside Premises</p>
                  <h3 className="text-2xl font-extrabold text-amber-700 mt-1 font-heading">{metrics.outsideCount}</h3>
                  <p className="text-[11px] text-amber-600 font-semibold mt-0.5 flex items-center gap-1 group-hover:underline">
                    <span>Local: {metrics.normalExitsCount} | Home Pass: {metrics.homeExitsCount}</span>
                    <span className="text-[10px] text-amber-500 font-normal">(Click for list →)</span>
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-all">
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
          <div className="bg-white rounded-3xl max-w-5xl w-full overflow-hidden shadow-xl border border-gray-100 relative transition-all">
            
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

              {/* Table Container with internal scroll inside rounded border */}
              <div className="border border-gray-200 rounded-2xl overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[760px]">
                  <thead>
                    <tr className="bg-[#f8fafb] text-[11px] uppercase tracking-wider text-gray-500 font-bold border-b border-gray-200 font-heading">
                      <th className="px-4 py-3.5">Student Name</th>
                      <th className="px-4 py-3.5">Roll Number</th>
                      <th className="px-4 py-3.5">Checkout Time</th>
                      <th className="px-4 py-3.5">Expected Return</th>
                      <th className="px-4 py-3.5">Overdue Duration</th>
                      <th className="px-4 py-3.5 text-right">Warden Override</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs font-body">
                    {overdueStudents.filter(st =>
                      (st.student_name || '').toLowerCase().includes((overdueSearchQuery || '').toLowerCase()) ||
                      (st.registration_number || '').toLowerCase().includes((overdueSearchQuery || '').toLowerCase())
                    ).length > 0 ? (
                      overdueStudents
                        .filter(st =>
                          (st.student_name || '').toLowerCase().includes((overdueSearchQuery || '').toLowerCase()) ||
                          (st.registration_number || '').toLowerCase().includes((overdueSearchQuery || '').toLowerCase())
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
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold font-mono bg-rose-50 text-rose-700 border border-rose-200">
                                <Clock className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                {st.overdue_duration}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right whitespace-nowrap">
                              <button
                                onClick={() => openConfirmModal(st, 'ENTRY')}
                                className="px-3 py-1.5 bg-[#006a6a] hover:bg-[#005959] text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer font-heading flex items-center gap-1.5 ml-auto"
                              >
                                <UserCheck className="w-3.5 h-3.5" /> Authorize Entry
                              </button>
                            </td>
                          </tr>
                        ))
                    ) : (
                      <tr>
                        <td colSpan="6" className="px-6 py-10 text-center text-xs text-gray-500 font-medium">
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

      {/* 1. Inside Premises Students Modal */}
      {isInsideModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in font-body">
          <div className="bg-white rounded-3xl max-w-5xl w-full overflow-hidden shadow-2xl border border-gray-100 animate-scale-up">
            
            {/* Modal Header */}
            <div className="bg-emerald-950 px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  <Home className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white font-heading">Inside Hostel Premises Report</h3>
                    <span className="px-2.5 py-0.5 bg-emerald-500 text-white text-[10px] font-extrabold rounded-full font-mono">
                      {insideStudents.length} Students On-Campus
                    </span>
                  </div>
                  <p className="text-xs text-emerald-200 font-body mt-0.5">Students currently marked inside the hostel premises</p>
                </div>
              </div>

              <button
                onClick={() => setIsInsideModalOpen(false)}
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
                    placeholder="Search inside students by name or roll number..."
                    value={insideSearchQuery}
                    onChange={(e) => setInsideSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#006a6a] font-body"
                  />
                </div>
              </div>

              {/* Table Container with internal scroll inside rounded border */}
              <div className="border border-gray-200 rounded-2xl overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[720px]">
                  <thead>
                    <tr className="bg-[#f8fafb] text-[11px] uppercase tracking-wider text-gray-500 font-bold border-b border-gray-200 font-heading">
                      <th className="px-4 py-3.5">Student Name</th>
                      <th className="px-4 py-3.5">Roll Number</th>
                      <th className="px-4 py-3.5">Check-in Status / Time</th>
                      <th className="px-4 py-3.5">Hostel & Room</th>
                      <th className="px-4 py-3.5 text-right">Emergency Exit Override</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs font-body">
                    {insideStudents.filter(st =>
                      (st.student_name || '').toLowerCase().includes((insideSearchQuery || '').toLowerCase()) ||
                      (st.registration_number || '').toLowerCase().includes((insideSearchQuery || '').toLowerCase())
                    ).length > 0 ? (
                      insideStudents
                        .filter(st =>
                          (st.student_name || '').toLowerCase().includes((insideSearchQuery || '').toLowerCase()) ||
                          (st.registration_number || '').toLowerCase().includes((insideSearchQuery || '').toLowerCase())
                        )
                        .map((st) => (
                          <tr key={st.id || st.registration_number} className="hover:bg-gray-50/60 transition-colors">
                            <td className="px-4 py-3.5 font-bold text-gray-900 font-heading">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs font-heading shrink-0 border border-emerald-100">
                                  {st.student_name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-bold text-gray-900">{st.student_name}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 font-mono font-semibold text-[#006a6a] whitespace-nowrap">{st.registration_number}</td>
                            <td className="px-4 py-3.5 text-gray-600 font-medium whitespace-nowrap">{st.checkin_time}</td>
                            <td className="px-4 py-3.5 font-semibold text-gray-800 whitespace-nowrap">{st.hostel_name} ({st.room_number})</td>
                            <td className="px-4 py-3.5 text-right whitespace-nowrap">
                              <button
                                onClick={() => openConfirmModal(st, 'EXIT')}
                                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer font-heading flex items-center gap-1.5 ml-auto"
                              >
                                <LogOut className="w-3.5 h-3.5" /> Authorize Exit
                              </button>
                            </td>
                          </tr>
                        ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="px-6 py-10 text-center text-xs text-gray-500 font-medium">
                          No matching students found inside hostel.
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
                Clicking "Authorize Exit" logs an emergency exit scan for the student.
              </p>
              <button
                onClick={() => setIsInsideModalOpen(false)}
                className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white font-bold text-xs rounded-xl transition-all cursor-pointer font-heading"
              >
                Close Report
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 2. Outside Premises Students Modal */}
      {isOutsideModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in font-body">
          <div className="bg-white rounded-3xl max-w-5xl w-full overflow-hidden shadow-2xl border border-gray-100 animate-scale-up">
            
            {/* Modal Header */}
            <div className="bg-amber-950 px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                  <LogOut className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white font-heading">Outside Premises Student Report</h3>
                    <span className="px-2.5 py-0.5 bg-amber-500 text-white text-[10px] font-extrabold rounded-full font-mono">
                      {outsideStudents.length} Students Off-Campus
                    </span>
                  </div>
                  <p className="text-xs text-amber-200 font-body mt-0.5">Students currently marked out of hostel premises</p>
                </div>
              </div>

              <button
                onClick={() => setIsOutsideModalOpen(false)}
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
                    placeholder="Search outside students by name or roll number..."
                    value={outsideSearchQuery}
                    onChange={(e) => setOutsideSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#006a6a] font-body"
                  />
                </div>
              </div>

              {/* Table Container with internal scroll inside rounded border */}
              <div className="border border-gray-200 rounded-2xl overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[650px]">
                  <thead>
                    <tr className="bg-[#f8fafb] text-[11px] uppercase tracking-wider text-gray-500 font-bold border-b border-gray-200 font-heading">
                      <th className="px-4 py-3.5">Student Name</th>
                      <th className="px-4 py-3.5">Roll Number</th>
                      <th className="px-4 py-3.5">Checkout Time</th>
                      <th className="px-4 py-3.5">Exit Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs font-body">
                    {outsideStudents.filter(st =>
                      (st.student_name || '').toLowerCase().includes((outsideSearchQuery || '').toLowerCase()) ||
                      (st.registration_number || '').toLowerCase().includes((outsideSearchQuery || '').toLowerCase())
                    ).length > 0 ? (
                      outsideStudents
                        .filter(st =>
                          (st.student_name || '').toLowerCase().includes((outsideSearchQuery || '').toLowerCase()) ||
                          (st.registration_number || '').toLowerCase().includes((outsideSearchQuery || '').toLowerCase())
                        )
                        .map((st) => (
                          <tr key={st.id || st.registration_number} className="hover:bg-gray-50/60 transition-colors">
                            <td className="px-4 py-3.5 font-bold text-gray-900 font-heading">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-xs font-heading shrink-0 border border-amber-100">
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
                            <td className="px-4 py-3.5 font-semibold text-gray-800 whitespace-nowrap">{st.exit_type_label}</td>
                          </tr>
                        ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="px-6 py-10 text-center text-xs text-gray-500 font-medium">
                          No matching students found outside premises.
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
                Roster of all students currently outside hostel premises.
              </p>
              <button
                onClick={() => setIsOutsideModalOpen(false)}
                className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white font-bold text-xs rounded-xl transition-all cursor-pointer font-heading"
              >
                Close Report
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 3. Authorization Confirmation Popup Modal */}
      {confirmModal.isOpen && confirmModal.student && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in font-body">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-gray-100 animate-scale-up p-6 text-center space-y-5">
            
            {/* Header Icon */}
            <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center ${
              confirmModal.actionType === 'ENTRY'
                ? 'bg-teal-50 text-[#006a6a] border border-teal-100'
                : 'bg-amber-50 text-amber-700 border border-amber-100'
            }`}>
              {confirmModal.actionType === 'ENTRY' ? (
                <UserCheck className="w-8 h-8" />
              ) : (
                <LogOut className="w-8 h-8" />
              )}
            </div>

            {/* Title & Description */}
            <div>
              <h3 className="text-lg font-extrabold text-gray-900 font-heading">
                {confirmModal.actionType === 'ENTRY' ? 'Confirm Emergency Entry Override' : 'Confirm Emergency Exit Override'}
              </h3>
              <p className="text-xs text-gray-500 mt-1 font-body">
                Warden Emergency Clearance Authorization
              </p>
            </div>

            {/* Student Info Card */}
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex items-center gap-3.5 text-left">
              <div className="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-sm shrink-0 font-heading">
                {confirmModal.student.student_name.charAt(0).toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <p className="font-bold text-sm text-gray-900 font-heading truncate">{confirmModal.student.student_name}</p>
                <p className="text-xs font-mono font-semibold text-[#006a6a]">{confirmModal.student.registration_number}</p>
                <p className="text-[11px] text-gray-500 truncate mt-0.5">{confirmModal.student.hostel_name} ({confirmModal.student.room_number})</p>
              </div>
            </div>

            {/* Action Notice */}
            <div className={`p-3 rounded-xl text-xs font-medium text-left flex items-start gap-2 ${
              confirmModal.actionType === 'ENTRY'
                ? 'bg-teal-50 text-teal-800 border border-teal-100'
                : 'bg-amber-50 text-amber-800 border border-amber-100'
            }`}>
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {confirmModal.actionType === 'ENTRY'
                  ? 'This will immediately log an authorized entry record and mark the student as IN HOSTEL.'
                  : 'This will immediately log an authorized emergency exit record and mark the student as OUT OF HOSTEL.'}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal({ isOpen: false, student: null, actionType: 'ENTRY', submitting: false })}
                disabled={confirmModal.submitting}
                className="py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-all cursor-pointer font-heading"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={executeAuthorization}
                disabled={confirmModal.submitting}
                className={`py-2.5 px-4 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer font-heading flex items-center justify-center gap-1.5 ${
                  confirmModal.actionType === 'ENTRY'
                    ? 'bg-[#006a6a] hover:bg-[#005959]'
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {confirmModal.submitting ? (
                  <span>Processing...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Authorize</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Curfew & Gate Settings Modal */}
      {isCurfewModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in font-body">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-gray-100 animate-scale-up">
            
            {/* Modal Header */}
            <div className="bg-slate-900 px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-heading">Curfew & Gate Settings</h3>
                  <p className="text-xs text-slate-300 font-body">Configure custom curfew hours & alert triggers</p>
                </div>
              </div>
              <button
                onClick={() => setIsCurfewModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Modal Form */}
            <div className="p-6 space-y-4 font-body">
              <div>
                <label className="block text-xs font-bold text-gray-700 font-heading mb-1.5">
                  Curfew Start Time (Gate Closes)
                </label>
                <select
                  value={curfewConfigState.startHour}
                  onChange={(e) => setCurfewConfigState({ ...curfewConfigState, startHour: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:border-[#006a6a]"
                >
                  <option value={16}>4:00 PM</option>
                  <option value={17}>5:00 PM (Default)</option>
                  <option value={18}>6:00 PM</option>
                  <option value={19}>7:00 PM</option>
                  <option value={20}>8:00 PM</option>
                  <option value={21}>9:00 PM</option>
                  <option value={22}>10:00 PM</option>
                  <option value={23}>11:00 PM</option>
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  After this hour, entry and exit scans are locked until morning.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 font-heading mb-1.5">
                  Curfew End Time (Gate Opens)
                </label>
                <select
                  value={curfewConfigState.endHour}
                  onChange={(e) => setCurfewConfigState({ ...curfewConfigState, endHour: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:border-[#006a6a]"
                >
                  <option value={5}>5:00 AM</option>
                  <option value={6}>6:00 AM</option>
                  <option value={7}>7:00 AM</option>
                  <option value={8}>8:00 AM (Default)</option>
                  <option value={9}>9:00 AM</option>
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  Gate automatically unlocks for normal movement after this hour.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 font-heading mb-1.5">
                  Pre-Curfew Warning Alert Lead Time
                </label>
                <select
                  value={curfewConfigState.warningMins}
                  onChange={(e) => setCurfewConfigState({ ...curfewConfigState, warningMins: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:border-[#006a6a]"
                >
                  <option value={15}>15 Minutes Before Curfew</option>
                  <option value={30}>30 Minutes Before Curfew</option>
                  <option value={45}>45 Minutes Before Curfew</option>
                  <option value={60}>60 Minutes (1 Hour) Before Curfew (Default)</option>
                  <option value={90}>90 Minutes (1.5 Hours) Before Curfew</option>
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  Triggers the warning alert banner on dashboards for students marked OUT.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 font-body">
              <button
                onClick={() => setIsCurfewModalOpen(false)}
                className="px-4 py-2 border border-gray-200 text-gray-700 hover:bg-gray-100 font-bold text-xs rounded-xl transition-all cursor-pointer font-heading"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const saved = await saveCurfewConfig(curfewConfigState);
                  setCurfewConfigState(saved);
                  setIsCurfewModalOpen(false);
                  alert(`Curfew settings updated! Gate will close at ${formatHourLabel(saved.startHour)} until ${formatHourLabel(saved.endHour)}.`);
                  fetchData();
                }}
                className="px-4 py-2 bg-[#006a6a] hover:bg-[#005959] text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer font-heading flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" /> Save Configuration
              </button>
            </div>

          </div>
        </div>
      )}
    </Layout>
  );
};

export default AdminDashboard;

