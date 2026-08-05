import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import { ArrowDownLeft, ArrowUpRight, History, Shield, CheckCircle2, Clock, Building, UserCheck, AlertCircle, Home, LogOut, FileText, ArrowRight, X, RefreshCw, ShieldAlert } from 'lucide-react';
import VerificationModal from '../components/VerificationModal';
import { supabase } from '../supabaseClient';
import { useNavigate, Link } from 'react-router-dom';
import { getCurfewConfig, formatHourLabel } from '../utils/curfewConfig';

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
  const alertRef = useRef(null);

  // Auto-scroll to alert on mobile screens whenever exitAlert triggers
  useEffect(() => {
    if (exitAlert && alertRef.current) {
      alertRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [exitAlert]);

  const [hostelName, setHostelName] = useState('Pending Assignment');
  const [wardenName, setWardenName] = useState('Hostel Warden Office');
  const [showWardenInfoModal, setShowWardenInfoModal] = useState(false);

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
            .select('hostel_name, warden_name')
            .eq('registration_number', regNo)
            .single();

          if (uniDetails && uniDetails.hostel_name) {
            setHostelName(uniDetails.hostel_name);
            if (uniDetails.warden_name) setWardenName(uniDetails.warden_name);
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

  const getCurfewInfo = () => {
    const config = getCurfewConfig();
    const startHour = config.startHour ?? 17;
    const endHour = config.endHour ?? 8;
    const warningMins = config.warningMins ?? 60;
    const startLabel = formatHourLabel(startHour);
    const endLabel = formatHourLabel(endHour);
    return { startHour, endHour, warningMins, startLabel, endLabel };
  };

  const checkNightCurfew = () => {
    const { startHour, endHour } = getCurfewInfo();
    const currentHour = currentTime.getHours();
    if (startHour > endHour) {
      return currentHour >= startHour || currentHour < endHour;
    } else {
      return currentHour >= startHour && currentHour < endHour;
    }
  };

  const getReturnDeadlineInfo = () => {
    if (isInside) return { status: 'INSIDE' };

    const { startHour, warningMins, startLabel } = getCurfewInfo();
    const exitDate = latestExitTime ? new Date(latestExitTime) : new Date(currentTime);
    const deadline = new Date(exitDate.getFullYear(), exitDate.getMonth(), exitDate.getDate(), startHour, 0, 0, 0);
    const warningStart = new Date(deadline.getTime() - warningMins * 60 * 1000);

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
        deadlineStr: startLabel,
        overdueDuration: durationStr || '0 mins',
        overdueMinutes: totalMinutes,
      };
    } else if (currentTime >= warningStart) {
      const diffMs = deadline.getTime() - currentTime.getTime();
      const remainingMins = Math.ceil(diffMs / (1000 * 60));
      return {
        status: 'WARNING',
        deadlineStr: startLabel,
        remainingMinutes: Math.max(1, remainingMins),
      };
    }

    return {
      status: 'OUTSIDE_OK',
      deadlineStr: startLabel,
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

    const { startLabel, endLabel } = getCurfewInfo();
    if (checkNightCurfew()) {
      setExitAlert({
        title: `Hostel Gate Closed (${startLabel} - ${endLabel})`,
        message: `Hostel entry is strictly closed after the ${startLabel} deadline until ${endLabel}. Neither entry nor exit is permitted during curfew hours. Please contact the hostel warden for emergency authorization.`,
        action: "GATE_CLOSED"
      });
      return;
    }

    setExitAlert(null);
    setVerificationMode('Entry');
    setExitType('ENTRY');
    setIsVerificationModalOpen(true);
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
          <div ref={alertRef} className="bg-amber-50 border-2 border-amber-300 p-4 rounded-2xl flex items-start justify-between gap-3 font-body shadow-md animate-fade-in scroll-mt-20">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-amber-900 font-heading">{exitAlert.title}</h4>
                <p className="text-xs text-amber-800 mt-0.5">{exitAlert.message}</p>
                {exitAlert.action === 'REQUEST_PASS_REQUIRED' && (
                  <button
                    onClick={() => navigate('/pass-requests')}
                    className="mt-2.5 px-3.5 py-2 bg-[#006a6a] hover:bg-[#005959] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer font-heading"
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
          <div className="bg-amber-500/10 border-2 border-amber-500/40 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-body shadow-sm animate-pulse">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-black text-amber-950 font-heading uppercase tracking-wider flex items-center gap-1">
                    ⏰ URGENT CURFEW ALERT: Gate Closing Soon!
                  </h4>
                  <span className="px-2.5 py-0.5 bg-amber-500 text-white text-[11px] font-extrabold font-mono rounded-full">
                    Gate closes in {deadlineInfo.remainingMinutes} mins
                  </span>
                </div>
                <p className="text-xs font-medium text-amber-900 mt-1">
                  You are currently marked <strong className="font-bold underline">Outside Campus</strong>. The hostel gate strictly closes at 5:00 PM. Please return and scan your entry immediately to avoid curfew violation.
                </p>
              </div>
            </div>
            <button
              onClick={handleEntryClick}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all shrink-0 flex items-center justify-center gap-1.5 cursor-pointer font-heading uppercase tracking-wide"
            >
              <ArrowDownLeft className="w-4 h-4" /> Check In Now
            </button>
          </div>
        )}

        {!isInside && (deadlineInfo.status === 'OVERDUE' || checkNightCurfew()) && (
          <div className="bg-rose-500/10 border-2 border-rose-500/40 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-body shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-xs font-black text-rose-950 font-heading uppercase tracking-wider">
                    🔒 CURFEW ACTIVE: GATE CLOSED
                  </h4>
                  <span className="px-2.5 py-0.5 bg-rose-600 text-white text-[11px] font-extrabold font-mono rounded-full">
                    {deadlineInfo.overdueDuration ? `Overdue by ${deadlineInfo.overdueDuration}` : '5:00 PM - 8:00 AM Curfew'}
                  </span>
                </div>
                <p className="text-xs font-medium text-rose-900 mt-1">
                  You are currently marked <strong className="font-bold underline">Outside Campus</strong> during curfew hours. Gate entry and exit are strictly disabled after 5:00 PM until 8:00 AM.
                </p>
                <div className="mt-2 text-xs font-semibold text-rose-950 bg-rose-100/90 border border-rose-200 px-3 py-1.5 rounded-xl inline-flex items-center gap-1.5 font-heading">
                  <ShieldAlert className="w-4 h-4 text-rose-700 shrink-0" />
                  <span>ℹ️ Please report to the Hostel Warden Office for emergency clearance authorization.</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2 shrink-0">
              <button
                onClick={() => setShowWardenInfoModal(true)}
                className="w-full sm:w-auto px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer font-heading"
              >
                <ShieldAlert className="w-4 h-4 text-amber-400" /> Contact Warden Info
              </button>
              <button
                onClick={handleEntryClick}
                className="w-full sm:w-auto px-3.5 py-2 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer font-heading uppercase tracking-wide"
              >
                <ArrowDownLeft className="w-4 h-4" /> Check In Status
              </button>
            </div>
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
                  className="p-5 bg-teal-50/80 hover:bg-teal-100/80 border border-teal-200/80 hover:border-teal-300 rounded-3xl shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer text-left flex flex-col justify-between gap-5 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-11 h-11 rounded-2xl bg-white text-[#006a6a] group-hover:bg-[#006a6a] group-hover:text-white flex items-center justify-center transition-all duration-200 shadow-xs border border-teal-100">
                      <ArrowDownLeft className="w-5.5 h-5.5" />
                    </div>
                    <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full font-heading uppercase tracking-wide shadow-2xs ${
                      checkNightCurfew() 
                        ? 'bg-amber-100 text-amber-900 border border-amber-200' 
                        : (!isInside && deadlineInfo.status === 'WARNING' ? 'bg-amber-500 text-white animate-pulse' : 'bg-white text-[#006a6a] border border-teal-200')
                    }`}>
                      {checkNightCurfew() ? '🔒 Gate Closed (5 PM - 8 AM)' : (!isInside && deadlineInfo.status === 'WARNING' ? '⚠️ Gate Closes Soon' : 'Inbound')}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold text-teal-950 font-heading group-hover:text-[#006a6a] transition-colors">Enter into Hostel</h3>
                      <ArrowRight className="w-4 h-4 text-teal-600/70 group-hover:text-[#006a6a] group-hover:translate-x-1 transition-all" />
                    </div>
                    <p className="text-xs text-teal-800/80 font-body mt-1 leading-relaxed">
                      {checkNightCurfew() ? 'Closed outside standard hours (5 PM - 8 AM)' : 'Return scan with Geofence GPS + Biometric AI'}
                    </p>
                  </div>
                </button>

                {/* 2. Normal Exit Action Card */}
                <button
                  onClick={handleNormalExitClick}
                  className="p-5 bg-amber-50/80 hover:bg-amber-100/80 border border-amber-200/80 hover:border-amber-300 rounded-3xl shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer text-left flex flex-col justify-between gap-5 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-11 h-11 rounded-2xl bg-white text-amber-700 group-hover:bg-amber-600 group-hover:text-white flex items-center justify-center transition-all duration-200 shadow-xs border border-amber-100">
                      <ArrowUpRight className="w-5.5 h-5.5" />
                    </div>
                    <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full font-heading uppercase tracking-wide shadow-2xs ${
                      checkNightCurfew() 
                        ? 'bg-amber-100 text-amber-900 border border-amber-200' 
                        : 'bg-white text-amber-800 border border-amber-200'
                    }`}>
                      {checkNightCurfew() ? '🔒 Gate Closed (5 PM - 8 AM)' : 'Normal Exit'}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold text-amber-950 font-heading group-hover:text-amber-800 transition-colors">Normal Exit</h3>
                      <ArrowRight className="w-4 h-4 text-amber-600/70 group-hover:text-amber-800 group-hover:translate-x-1 transition-all" />
                    </div>
                    <p className="text-xs text-amber-800/80 font-body mt-1 leading-relaxed">
                      {checkNightCurfew() ? 'Closed outside standard hours (5 PM - 8 AM)' : 'Local campus outing during standard hours'}
                    </p>
                  </div>
                </button>

                {/* 3. Exit to Home Action Card */}
                <button
                  onClick={handleHomeExitClick}
                  className="p-5 bg-purple-50/80 hover:bg-purple-100/80 border border-purple-200/80 hover:border-purple-300 rounded-3xl shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer text-left flex flex-col justify-between gap-5 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-11 h-11 rounded-2xl bg-white text-purple-700 group-hover:bg-purple-600 group-hover:text-white flex items-center justify-center transition-all duration-200 shadow-xs border border-purple-100">
                      <Home className="w-5.5 h-5.5" />
                    </div>
                    <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full font-heading uppercase tracking-wide shadow-2xs ${
                      checkNightCurfew() 
                        ? 'bg-amber-100 text-amber-900 border border-amber-200' 
                        : (approvedPass ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-white text-purple-800 border border-purple-200')
                    }`}>
                      {checkNightCurfew() ? '🔒 Gate Closed (5 PM - 8 AM)' : (approvedPass ? 'Pass Approved ✅' : 'Pass Required')}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold text-purple-950 font-heading group-hover:text-purple-900 transition-colors">Exit to Home</h3>
                      <ArrowRight className="w-4 h-4 text-purple-600/70 group-hover:text-purple-800 group-hover:translate-x-1 transition-all" />
                    </div>
                    <p className="text-xs text-purple-900/80 font-body mt-1 leading-relaxed">
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

      {/* Warden Contact & Emergency Clearance Notice Modal */}
      {showWardenInfoModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in font-body">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-gray-100 animate-scale-up p-6 space-y-5 text-center">
            
            {/* Header Icon */}
            <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-sm">
              <ShieldAlert className="w-8 h-8" />
            </div>

            {/* Title & Instructions */}
            <div>
              <h3 className="text-lg font-extrabold text-gray-900 font-heading">Hostel Curfew Gate Lockdown</h3>
              <p className="text-xs text-gray-500 mt-1 font-body">
                Emergency Entry & Exit Clearance Protocol
              </p>
            </div>

            {/* Information Notice Box */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-left space-y-3">
              <div className="flex items-center gap-2.5 text-xs font-bold text-slate-800 font-heading">
                <Building className="w-4 h-4 text-[#006a6a]" />
                <span>Assigned Hostel: {hostelName || 'Hostel Premises'}</span>
              </div>

              <div className="flex items-center gap-2.5 text-xs font-bold text-slate-800 font-heading">
                <UserCheck className="w-4 h-4 text-[#006a6a]" />
                <span>Warden: {wardenName || 'Hostel Warden Office'}</span>
              </div>

              <div className="text-xs text-slate-600 space-y-2 pt-2 border-t border-slate-200 font-body leading-relaxed">
                <p>🔒 <strong>Curfew Gate Rule:</strong> Gate entry and exit scans are locked outside standard hours (5:00 PM – 8:00 AM).</p>
                <p>📞 <strong>How to get Clearance:</strong> Please report to your Hostel Warden or Warden Office to request emergency authorization.</p>
                <p>⚡ <strong>Real-time Clearance:</strong> Once authorized by the Warden, your status will update automatically on your device.</p>
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={() => setShowWardenInfoModal(false)}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer font-heading"
            >
              Understood / Close
            </button>

          </div>
        </div>
      )}
    </Layout>
  );
};

export default StudentDashboard;
