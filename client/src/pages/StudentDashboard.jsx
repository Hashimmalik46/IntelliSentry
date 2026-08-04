import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { ArrowDownLeft, ArrowUpRight, History, Shield, CheckCircle2, Clock, Building, UserCheck, AlertCircle, Home, LogOut, FileText, ArrowRight, X, RefreshCw } from 'lucide-react';
import VerificationModal from '../components/VerificationModal';
import { supabase } from '../supabaseClient';
import { useNavigate, Link } from 'react-router-dom';

const StudentDashboard = () => {
  const navigate = useNavigate();
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [verificationMode, setVerificationMode] = useState('Entry');
  const [exitType, setExitType] = useState('NORMAL_EXIT');
  const [approvedPass, setApprovedPass] = useState(null);

  const [loading, setLoading] = useState(true);
  const [isInside, setIsInside] = useState(true);
  const [lastScan, setLastScan] = useState({
    time: 'No scans recorded yet',
    method: 'Geofence + Biometric'
  });

  const [activeExitDetails, setActiveExitDetails] = useState({
    typeLabel: 'Normal Local Exit',
    exitTime: '',
    expectedReturnTime: 'Same Day'
  });
  const [latestExitTime, setLatestExitTime] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [exitAlert, setExitAlert] = useState(null);

  const [hostelName, setHostelName] = useState('Pending Assignment');

  const [studentInfo, setStudentInfo] = useState({
    name: 'Student',
    email: '',
    registration_number: 'N/A',
    id: null
  });

  // Ticker for current time calculations (reminders & overdue timers)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Supabase Realtime Subscription for instant update on check-in or check-out
  useEffect(() => {
    const channel = supabase
      .channel('student_attendance_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      let studentRecord = null;
      let regNo = 'N/A';
      if (user) {
        const { data: student } = await supabase
          .from('students')
          .select('*')
          .eq('user_id', user.id)
          .single();

        studentRecord = student;

        if (student) {
          regNo = student.registration_number || 'N/A';
          setStudentInfo({
            name: student.name || user.email.split('@')[0],
            email: student.email || user.email,
            registration_number: regNo,
            id: user.id
          });
        } else {
          setStudentInfo(prev => ({
            ...prev,
            name: user.email.split('@')[0],
            email: user.email,
            id: user.id
          }));
        }

        if (regNo && regNo !== 'N/A') {
          const { data: uniDetails } = await supabase
            .from('university_details')
            .select('hostel_name')
            .eq('registration_number', regNo)
            .single();

          if (uniDetails && uniDetails.hostel_name) {
            setHostelName(uniDetails.hostel_name);
          } else {
            setHostelName('Pending Assignment');
          }
        } else {
          setHostelName('Pending Assignment');
        }
      }

      // Fetch Attendance Logs for Inside/Outside status
      let logQuery = supabase.from('attendance_logs').select('*').order('created_at', { ascending: false });
      if (user) {
        if (regNo && regNo !== 'N/A') {
          logQuery = logQuery.or(`user_id.eq.${user.id},registration_number.eq.${regNo}`);
        } else {
          logQuery = logQuery.eq('user_id', user.id);
        }
      }

      const { data: logs, error } = await logQuery;

      if (!error && logs && logs.length > 0) {
        const latestLog = logs[0];
        const dateObj = new Date(latestLog.created_at || Date.now());
        const insideState = latestLog.type.includes('Entry');
        setIsInside(insideState);
        const formattedTime = `${dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
        
        setLastScan({
          time: formattedTime,
          method: latestLog.method || 'Geofence + Biometric'
        });

        if (!insideState) {
          setLatestExitTime(latestLog.created_at || Date.now());
          setActiveExitDetails({
            typeLabel: latestLog.exit_type === 'LEAVE_TO_HOME' ? 'Leave to Home' : 'Normal Local Exit',
            exitTime: formattedTime,
            expectedReturnTime: latestLog.expected_return_time || 'Same Day'
          });
        } else {
          setLatestExitTime(null);
        }
      }

      // Fetch Approved Leave Pass for Exit to Home
      if (user || regNo !== 'N/A') {
        let passQuery = supabase
          .from('pass_requests')
          .select('*')
          .eq('admin_status', 'APPROVED')
          .order('created_at', { ascending: false });

        if (regNo !== 'N/A') {
          passQuery = passQuery.eq('registration_number', regNo);
        } else if (user) {
          passQuery = passQuery.eq('user_id', user.id);
        }

        const { data: passes } = await passQuery;
        if (passes && passes.length > 0) {
          setApprovedPass(passes[0]);
        } else {
          setApprovedPass(null);
        }
      }

    } catch (err) {
      console.warn("Student data fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const getReturnDeadlineInfo = () => {
    if (isInside) return { status: 'INSIDE' };

    const exitDate = latestExitTime ? new Date(latestExitTime) : new Date(currentTime);
    const deadline = new Date(exitDate.getFullYear(), exitDate.getMonth(), exitDate.getDate(), 17, 0, 0, 0);
    const warningStart = new Date(deadline.getTime() - 30 * 60 * 1000);

    if (currentTime >= deadline) {
      const diffMs = currentTime.getTime() - deadline.getTime();
      const totalMinutes = Math.floor(diffMs / (1000 * 60));
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;

      let durationStr = '';
      if (hours > 0) {
        durationStr = `${hours} hr${hours > 1 ? 's' : ''} ${minutes} min${minutes !== 1 ? 's' : ''}`;
      } else {
        durationStr = `${minutes} min${minutes !== 1 ? 's' : ''}`;
      }

      return {
        status: 'OVERDUE',
        deadlineStr: '5:00 PM',
        overdueDuration: durationStr || '0 mins',
        overdueMinutes: totalMinutes,
      };
    } else if (currentTime >= warningStart) {
      const diffMs = deadline.getTime() - currentTime.getTime();
      const remainingMins = Math.ceil(diffMs / (1000 * 60));
      return {
        status: 'WARNING',
        deadlineStr: '5:00 PM',
        remainingMinutes: Math.max(1, remainingMins),
      };
    }

    return {
      status: 'OUTSIDE_OK',
      deadlineStr: '5:00 PM',
    };
  };

  const deadlineInfo = getReturnDeadlineInfo();

  const handleVerificationSuccess = async (newLog) => {
    const dateObj = new Date(newLog.created_at || Date.now());
    const insideState = newLog.type.includes('Entry');
    setIsInside(insideState);
    const formattedTime = `${dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    
    setLastScan({
      time: formattedTime,
      method: newLog.method
    });

    if (!insideState) {
      setActiveExitDetails({
        typeLabel: newLog.exit_type === 'LEAVE_TO_HOME' ? 'Leave to Home' : 'Normal Local Exit',
        exitTime: formattedTime,
        expectedReturnTime: newLog.expected_return_time || 'Same Day'
      });
    } else {
      // Automatically mark active leave pass as COMPLETED upon returning to hostel
      try {
        let updateQuery = supabase
          .from('pass_requests')
          .update({
            admin_status: 'COMPLETED',
            final_status: 'Completed (Returned)'
          })
          .eq('admin_status', 'APPROVED');

        if (studentInfo.registration_number && studentInfo.registration_number !== 'N/A') {
          updateQuery = updateQuery.eq('registration_number', studentInfo.registration_number);
        } else if (studentInfo.id) {
          updateQuery = updateQuery.eq('user_id', studentInfo.id);
        }

        await updateQuery;
        setApprovedPass(null);
      } catch (passErr) {
        console.warn("Auto pass completion notice:", passErr);
      }
    }
  };

  const handleEntryClick = () => {
    if (isInside) {
      setExitAlert({
        title: "Already Marked Inside Hostel",
        message: "You are currently marked IN the hostel premises. You must log an exit (Normal Exit or Exit to Home) before logging another entry.",
        action: "EXIT_REQUIRED"
      });
      return;
    }
    setExitAlert(null);
    setVerificationMode('Entry');
    setExitType('ENTRY');
    setIsVerificationModalOpen(true);
  };

  const checkNightCurfew = () => {
    const currentHour = currentTime.getHours();
    // Curfew is active after 5:00 PM (17:00) until 8:00 AM (08:00)
    return currentHour >= 17 || currentHour < 8;
  };

  const handleNormalExitClick = () => {
    if (!isInside) {
      setExitAlert({
        title: "Multiple Active Exits Prevented",
        message: "You are currently marked OUT of the hostel. You must log your return (Enter into Hostel) before creating another exit.",
        action: "ENTRY_REQUIRED"
      });
      return;
    }

    if (checkNightCurfew()) {
      setExitAlert({
        title: "Hostel Gate Closed (5:00 PM - 8:00 AM)",
        message: "New campus exits are disabled after the 5:00 PM deadline until 8:00 AM tomorrow morning. Please contact the hostel warden for emergency authorization.",
        action: "GATE_CLOSED"
      });
      return;
    }

    setExitAlert(null);
    setVerificationMode('Exit');
    setExitType('NORMAL_EXIT');
    setIsVerificationModalOpen(true);
  };

  const handleHomeExitClick = () => {
    if (!isInside) {
      setExitAlert({
        title: "Multiple Active Exits Prevented",
        message: "You are currently marked OUT of the hostel. You must log your return (Enter into Hostel) before creating another exit.",
        action: "ENTRY_REQUIRED"
      });
      return;
    }

    if (checkNightCurfew()) {
      setExitAlert({
        title: "Hostel Gate Closed (5:00 PM - 8:00 AM)",
        message: "New campus exits are disabled after the 5:00 PM deadline until 8:00 AM tomorrow morning. Please contact the hostel warden for emergency authorization.",
        action: "GATE_CLOSED"
      });
      return;
    }

    if (!approvedPass) {
      setExitAlert({
        title: "Approved Leave Pass Required",
        message: "Exit to Home requires an approved Leave Pass with Parent & Admin authorization. No approved pass was found for your registration ID.",
        action: "REQUEST_PASS_REQUIRED"
      });
      return;
    }

    setExitAlert(null);
    setVerificationMode('Exit');
    setExitType('LEAVE_TO_HOME');
    setIsVerificationModalOpen(true);
  };

  const headerRight = (
    <div className="flex items-center gap-3 font-body">
      {loading ? (
        <div className="flex items-center gap-3 animate-pulse">
          <div className="w-9 h-9 rounded-full bg-slate-200 shrink-0"></div>
          <div className="space-y-1.5 text-left">
            <div className="w-28 h-3 bg-slate-200 rounded-full"></div>
            <div className="w-20 h-2.5 bg-slate-200 rounded-full"></div>
          </div>
        </div>
      ) : (
        <Link to="/profile" className="flex items-center gap-3 hover:opacity-90 transition-opacity cursor-pointer">
          <div className="w-9 h-9 rounded-full bg-[#006a6a] text-white flex items-center justify-center font-bold text-sm font-heading shadow-xs shrink-0">
            {studentInfo.name.charAt(0).toUpperCase()}
          </div>
          <div className="text-left">
            <p className="text-xs font-bold text-gray-900 font-heading">Welcome, {studentInfo.name}</p>
            <p className="text-[11px] font-mono font-semibold text-[#006a6a]">Reg ID: {studentInfo.registration_number}</p>
          </div>
        </Link>
      )}
    </div>
  );

  return (
    <Layout headerRight={headerRight}>
      <div className="max-w-5xl mx-auto space-y-6 font-body">
        
        {/* Dashboard Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading leading-snug break-words">
              Welcome back, {studentInfo.name} 👋
            </h2>
            <p className="text-xs text-gray-500 font-body leading-relaxed mt-0.5 break-words">Geofence GPS boundary & biometric face authentication</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              onClick={() => navigate('/pass-requests')}
              className="px-3.5 py-2 bg-teal-50 hover:bg-teal-100 text-[#006a6a] text-xs font-bold rounded-xl border border-teal-200 shadow-xs transition-all flex items-center gap-2 cursor-pointer font-heading"
            >
              <FileText className="w-4 h-4" /> Leave Passes
            </button>
            <button
              onClick={() => navigate('/activity-logs')}
              className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-xl border border-gray-200 shadow-xs transition-all flex items-center gap-2 cursor-pointer font-heading"
            >
              <History className="w-4 h-4 text-[#006a6a]" /> Activity Logs →
            </button>
          </div>
        </div>

        {/* Exit Alert Banner if active exit or missing pass */}
        {exitAlert && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start justify-between gap-3 font-body">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-amber-900 font-heading">{exitAlert.title}</h4>
                <p className="text-xs text-amber-800 mt-0.5">{exitAlert.message}</p>
                {exitAlert.action === 'REQUEST_PASS_REQUIRED' && (
                  <button
                    onClick={() => navigate('/pass-requests')}
                    className="mt-2.5 px-3 py-1.5 bg-[#006a6a] hover:bg-[#005959] text-white text-xs font-bold rounded-lg shadow-xs transition-all flex items-center gap-1.5 cursor-pointer font-heading"
                  >
                    Go to Leave Pass Requests <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            <button
              onClick={() => setExitAlert(null)}
              className="text-amber-600 hover:text-amber-900 p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* RETURN DEADLINE ALERT SYSTEM BANNERS (MINIMAL DESIGN) */}
        {!isInside && deadlineInfo.status === 'WARNING' && (
          <div className="bg-amber-50/70 border border-amber-200 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-body shadow-xs">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-amber-900 font-heading uppercase tracking-wide">
                    Return Deadline Warning
                  </h4>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-semibold font-mono rounded-full">
                    5:00 PM Deadline
                  </span>
                </div>
                <p className="text-xs text-amber-800 mt-0.5">
                  You are currently marked <strong className="font-semibold">Outside Campus</strong>. The return deadline is in <span className="font-bold font-mono text-amber-950">{deadlineInfo.remainingMinutes} mins</span>. Please check in before 5:00 PM.
                </p>
              </div>
            </div>
            <button
              onClick={handleEntryClick}
              className="px-3.5 py-1.5 bg-[#006a6a] hover:bg-[#005959] text-white text-xs font-bold rounded-xl shadow-xs transition-all shrink-0 flex items-center justify-center gap-1.5 cursor-pointer font-heading"
            >
              <ArrowDownLeft className="w-3.5 h-3.5" /> Check In Now
            </button>
          </div>
        )}

        {!isInside && deadlineInfo.status === 'OVERDUE' && (
          <div className="bg-rose-50/80 border border-rose-200 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-body shadow-xs">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 mt-0.5">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-rose-900 font-heading uppercase tracking-wide">
                    High-Priority Overdue Alert
                  </h4>
                  <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-semibold font-mono rounded-full">
                    Overdue by {deadlineInfo.overdueDuration}
                  </span>
                </div>
                <p className="text-xs text-rose-800 mt-0.5">
                  You have not checked back in by 5:00 PM. Please return to the hostel and log your entry scan immediately.
                </p>
              </div>
            </div>
            <button
              onClick={handleEntryClick}
              className="px-3.5 py-1.5 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all shrink-0 flex items-center justify-center gap-1.5 cursor-pointer font-heading"
            >
              <ArrowDownLeft className="w-3.5 h-3.5" /> Complete Return Scan →
            </button>
          </div>
        )}

        {/* 1. TOP SECTION: Premises & Last Scan Status Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          
          {/* Card 1: Hostel / Premises Status */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
            {loading ? (
              <div className="w-full flex items-center justify-between animate-pulse">
                <div className="space-y-2">
                  <div className="w-24 h-2.5 bg-slate-200 rounded-md"></div>
                  <div className="w-36 h-4 bg-slate-200 rounded-md"></div>
                  <div className="w-28 h-3 bg-slate-200 rounded-md"></div>
                </div>
                <div className="w-16 h-6 bg-slate-200 rounded-full"></div>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 font-heading">Current Entry Status</p>
                  <h4 className="text-base font-bold text-gray-900 font-heading">
                    {isInside ? (hostelName || 'Pending Assignment') : `Currently Off-Campus (${activeExitDetails.typeLabel})`}
                  </h4>
                  <p className="text-[11px] text-gray-500 font-body">
                    {isInside 
                      ? 'Authorized hostel stay' 
                      : `Exit Time: ${activeExitDetails.exitTime} | Expected Return: ${activeExitDetails.expectedReturnTime}`}
                  </p>
                </div>

                <span className={`px-2.5 py-1 text-[10px] font-extrabold rounded-full shrink-0 ${isInside ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                  {isInside ? '🟢 IN HOSTEL' : '🟠 OUT'}
                </span>
              </>
            )}
          </div>

          {/* Card 2: Last Gate Verification Scan */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
            {loading ? (
              <div className="w-full flex items-center justify-between animate-pulse">
                <div className="space-y-2">
                  <div className="w-24 h-2.5 bg-slate-200 rounded-md"></div>
                  <div className="w-40 h-4 bg-slate-200 rounded-md"></div>
                  <div className="w-32 h-3 bg-slate-200 rounded-md"></div>
                </div>
                <div className="w-10 h-10 bg-slate-200 rounded-xl"></div>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 font-heading">Last Gate Scan</p>
                  <h4 className="text-sm font-bold text-gray-900 font-heading">{lastScan.time}</h4>
                  <p className="text-[11px] text-gray-500 font-body">
                    Method: <span className="font-semibold text-[#006a6a]">{lastScan.method}</span>
                  </p>
                </div>

                <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-[#006a6a] shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
              </>
            )}
          </div>

        </div>

        {/* 2. MOVEMENT ACTIONS SECTION */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider font-heading">Select Movement Action</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {loading ? (
              <>
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="p-5 bg-white border border-gray-100 rounded-2xl shadow-xs animate-pulse flex flex-col justify-between gap-6"
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-xl bg-slate-200"></div>
                      <div className="w-16 h-5 rounded-full bg-slate-200"></div>
                    </div>
                    <div className="space-y-2">
                      <div className="w-32 h-4 bg-slate-200 rounded-md"></div>
                      <div className="w-44 h-3 bg-slate-200 rounded-md"></div>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <>
                {/* 1. Enter Hostel Action Card */}
                <button
                  onClick={handleEntryClick}
                  className="p-5 bg-white hover:bg-teal-50/40 border border-gray-200 hover:border-teal-300 rounded-2xl shadow-xs transition-all cursor-pointer text-left flex flex-col justify-between gap-4 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl bg-teal-50 text-[#006a6a] group-hover:bg-[#006a6a] group-hover:text-white flex items-center justify-center transition-all shadow-xs">
                      <ArrowDownLeft className="w-6 h-6" />
                    </div>
                    <span className="px-2 py-0.5 bg-teal-50 text-[#006a6a] text-[10px] font-bold rounded-full font-heading uppercase">
                      Inbound
                    </span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 font-heading">Enter into Hostel</h3>
                    <p className="text-xs text-gray-500 font-body mt-0.5">Return scan with Geofence GPS + Biometric AI</p>
                  </div>
                </button>

                {/* 2. Normal Exit Action Card */}
                <button
                  onClick={handleNormalExitClick}
                  className="p-5 bg-white hover:bg-slate-50 border border-gray-200 hover:border-slate-300 rounded-2xl shadow-xs transition-all cursor-pointer text-left flex flex-col justify-between gap-4 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 group-hover:bg-amber-800 group-hover:text-white flex items-center justify-center transition-all shadow-xs">
                      <ArrowUpRight className="w-6 h-6" />
                    </div>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full font-heading uppercase ${checkNightCurfew() ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-amber-50 text-amber-700'}`}>
                      {checkNightCurfew() ? '🔒 Gate Closed (5 PM - 8 AM)' : 'Normal Exit'}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 font-heading">Normal Exit</h3>
                    <p className="text-xs text-gray-500 font-body mt-0.5">
                      {checkNightCurfew() ? 'Closed outside standard hours (5 PM - 8 AM)' : 'Local campus outing during standard hours'}
                    </p>
                  </div>
                </button>

                {/* 3. Exit to Home Action Card */}
                <button
                  onClick={handleHomeExitClick}
                  className="p-5 bg-white hover:bg-purple-50/40 border border-purple-100 hover:border-purple-300 rounded-2xl shadow-xs transition-all cursor-pointer text-left flex flex-col justify-between gap-4 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-700 group-hover:bg-purple-800 group-hover:text-white flex items-center justify-center transition-all shadow-xs">
                      <Home className="w-6 h-6" />
                    </div>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full font-heading uppercase ${checkNightCurfew() ? 'bg-amber-100 text-amber-900 border border-amber-200' : (approvedPass ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-500')}`}>
                      {checkNightCurfew() ? '🔒 Gate Closed (5 PM - 8 AM)' : (approvedPass ? 'Pass Approved ✅' : 'Pass Required')}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 font-heading">Exit to Home</h3>
                    <p className="text-xs text-gray-500 font-body mt-0.5">
                      {checkNightCurfew() ? 'Closed outside standard hours (5 PM - 8 AM)' : 'Weekend / Home leave with approved leave pass'}
                    </p>
                  </div>
                </button>
              </>
            )}
          </div>
        </div>

      </div>

      {/* Verification Modal */}
      <VerificationModal
        isOpen={isVerificationModalOpen}
        onClose={() => setIsVerificationModalOpen(false)}
        mode={verificationMode}
        exitType={exitType}
        activePass={approvedPass}
        studentInfo={studentInfo}
        onSuccess={handleVerificationSuccess}
      />
    </Layout>
  );
};

export default StudentDashboard;
