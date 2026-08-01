import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { Users, Building, FileSpreadsheet, Shield, Search, ArrowUpRight, ArrowDownLeft, CheckCircle2, XCircle, RefreshCw, UserCheck, ShieldAlert, LogOut, Home, ArrowRight } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState({
    totalStudents: 0,
    insideCount: 0,
    outsideCount: 0,
    biometricsEnrolled: 0,
  });

  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [logFilter, setLogFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  // Fetch admin dashboard metrics with location strictly driven by attendance logs
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

      // 2. Fetch Biometric Embeddings
      const { data: embeddingsData } = await supabase.from('face_embeddings').select('user_id, registration_number');
      const enrolledSet = new Set((embeddingsData || []).map(e => (e.registration_number || e.user_id || '').toUpperCase().trim()));

      // 3. Fetch Attendance Logs (Source of truth for Inside/Outside status)
      const { data: logsData } = await supabase
        .from('attendance_logs')
        .select('*')
        .order('created_at', { ascending: false });

      const formattedLogs = (logsData || []).map(log => {
        const dateObj = new Date(log.created_at || Date.now());
        return {
          id: log.id,
          user_id: log.user_id,
          student_name: log.student_name || 'Student',
          registration_number: log.registration_number || 'N/A',
          type: log.type || 'Entry',
          method: log.method || 'Geofence + Biometric',
          status: log.status || 'AUTHORIZED',
          date: dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          time: dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        };
      });

      // User ID -> Reg Number map
      const userIdToRegMap = {};
      studentRows.forEach(s => {
        if (s.user_id && s.registration_number) {
          userIdToRegMap[s.user_id] = s.registration_number.toUpperCase().trim();
        }
      });

      // Determine latest movement direction from attendance_logs for each student
      const studentLatestMovement = {};
      for (const log of formattedLogs) {
        let key = (log.registration_number && log.registration_number !== 'N/A')
          ? log.registration_number.toUpperCase().trim()
          : (userIdToRegMap[log.user_id] || log.user_id);
        
        if (key && !studentLatestMovement[key]) {
          studentLatestMovement[key] = log.type;
        }
      }

      let insideCount = 0;
      let outsideCount = 0;
      let biometricsEnrolled = 0;

      studentRows.forEach(s => {
        const regKey = (s.registration_number && s.registration_number !== 'N/A')
          ? s.registration_number.toUpperCase().trim()
          : (s.user_id || s.email);

        const latestScanType = studentLatestMovement[regKey];
        const isOutside = latestScanType ? latestScanType.toLowerCase().includes('exit') : false;

        if (isOutside) {
          outsideCount++;
        } else {
          insideCount++;
        }

        if (enrolledSet.has(regKey) || (s.user_id && enrolledSet.has(s.user_id))) {
          biometricsEnrolled++;
        }
      });

      setAttendanceLogs(formattedLogs);

      setMetrics({
        totalStudents: studentRows.length,
        insideCount: insideCount,
        outsideCount: outsideCount,
        biometricsEnrolled: biometricsEnrolled,
      });
    } catch (err) {
      console.warn("Admin data fetch notice:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const exportMasterCSV = () => {
    if (attendanceLogs.length === 0) return;
    const headers = ["Student Name", "Registration No", "Movement Type", "Date", "Time", "Method", "Status"];
    const rows = attendanceLogs.map(l => [l.student_name, l.registration_number, l.type, l.date, l.time, l.method, l.status]);
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
    if (logFilter === 'EXIT') return matchesSearch && log.type.includes('Exit');
    return matchesSearch;
  });

  const headerRight = (
    <div className="flex items-center gap-3">
      <span className="px-3.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 text-xs font-extrabold rounded-full flex items-center gap-1.5 uppercase tracking-wider font-heading shadow-xs">
        <ShieldAlert className="w-3.5 h-3.5 text-amber-700" /> Administrator Portal
      </span>
      <button
        onClick={fetchData}
        className="w-9 h-9 rounded-xl bg-[#006a6a] hover:bg-[#005959] flex items-center justify-center text-white transition-colors cursor-pointer"
        title="Refresh Data"
      >
        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );

  return (
    <Layout headerRight={headerRight}>
      <div className="max-w-6xl mx-auto space-y-8 font-body">
        
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 font-heading">Campus Safety & Access Audit</h2>
            <p className="text-xs text-gray-500 font-body">Master oversight for student presence inside/outside premises and movement logs</p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/admin-students')}
              className="px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-800 text-xs font-bold rounded-xl border border-gray-200 shadow-xs transition-all flex items-center gap-2 cursor-pointer font-heading"
            >
              <Users className="w-4 h-4 text-[#006a6a]" /> Student Directory <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={exportMasterCSV}
              className="px-4 py-2.5 bg-[#006a6a] hover:bg-[#005959] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer font-heading"
            >
              <FileSpreadsheet className="w-4 h-4" /> Export Audit CSV
            </button>
          </div>
        </div>

        {/* Metrics Grid with Skeleton Loading */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          
          {loading ? (
            [1, 2, 3, 4].map(i => (
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
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-heading">Total Enrolled Students</p>
                  <h3 className="text-2xl font-extrabold text-gray-900 mt-1 font-heading">{metrics.totalStudents}</h3>
                  <p className="text-[11px] text-gray-500 font-semibold mt-0.5">Active Student Roster</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center text-[#006a6a]">
                  <Users className="w-6 h-6" />
                </div>
              </div>

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
                  <p className="text-[11px] text-amber-600 font-semibold mt-0.5">🟠 Currently Off-Campus</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                  <LogOut className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-purple-100 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wider font-heading">Face Biometrics Active</p>
                  <h3 className="text-2xl font-extrabold text-purple-900 mt-1 font-heading">{metrics.biometricsEnrolled}</h3>
                  <p className="text-[11px] text-purple-600 font-semibold mt-0.5">Enrolled Profile Vectors</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                  <UserCheck className="w-6 h-6" />
                </div>
              </div>
            </>
          )}

        </div>

        {/* Master Audit Logs Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 font-heading">Master Attendance & Access Logs</h3>
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
                <option value="EXIT">Hostel Exits</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8fafb] text-[11px] uppercase tracking-wider text-gray-500 font-bold border-b border-gray-100 font-heading">
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4">Reg Number</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Date & Time</th>
                  <th className="px-6 py-4">Method</th>
                  <th className="px-6 py-4">Status</th>
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
                        <span className={`inline-flex items-center gap-1 text-xs font-bold font-heading ${log.type.includes('Exit') ? 'text-[#b46b2b]' : 'text-[#006a6a]'}`}>
                          {log.type.includes('Exit') ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                          {log.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-600 font-medium">
                        {log.date} at {log.time}
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-600 font-medium">{log.method}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 text-[10px] font-bold uppercase bg-teal-50 text-[#006a6a] font-heading">
                          {log.status}
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
    </Layout>
  );
};

export default AdminDashboard;
