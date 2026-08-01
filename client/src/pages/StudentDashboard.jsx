import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { ArrowDownLeft, ArrowUpRight, History, Shield, CheckCircle2, Clock, Building, UserCheck } from 'lucide-react';
import VerificationModal from '../components/VerificationModal';
import { supabase } from '../supabaseClient';
import { useNavigate, Link } from 'react-router-dom';

const StudentDashboard = () => {
  const navigate = useNavigate();
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [verificationMode, setVerificationMode] = useState('Entry');

  const [loading, setLoading] = useState(true);
  const [isInside, setIsInside] = useState(true);
  const [lastScan, setLastScan] = useState({
    time: 'No scans recorded yet',
    method: 'Geofence + Biometric'
  });

  const [studentInfo, setStudentInfo] = useState({
    name: 'Aida Student',
    email: '',
    registration_number: 'REG-2024-001',
    id: null
  });

  useEffect(() => {
    async function loadData() {
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

          if (student) {
            setStudentInfo({
              name: student.name || user.email.split('@')[0],
              email: student.email || user.email,
              registration_number: student.registration_number || 'N/A',
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

        if (!error && logs && logs.length > 0) {
          const latestLog = logs[0];
          const dateObj = new Date(latestLog.created_at || Date.now());
          setIsInside(latestLog.type.includes('Entry'));
          setLastScan({
            time: `${dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
            method: latestLog.method || 'Geofence + Biometric'
          });
        }
      } catch (err) {
        console.warn("Student data fetch error:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const handleVerificationSuccess = (newLog) => {
    const dateObj = new Date(newLog.created_at || Date.now());
    setIsInside(newLog.type.includes('Entry'));
    setLastScan({
      time: `${dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
      method: newLog.method
    });
  };

  const openModal = (mode) => {
    setVerificationMode(mode);
    setIsVerificationModalOpen(true);
  };

  // Header Welcome bar with Skeleton Loader
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
        
        {/* Page Title Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 font-heading">Hostel Gate Verification</h2>
            <p className="text-xs text-gray-500 font-body">Geofence GPS boundary & biometric face authentication</p>
          </div>

          <button
            onClick={() => navigate('/activity-logs')}
            className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-xl border border-gray-200 shadow-xs transition-all flex items-center gap-2 self-start sm:self-auto cursor-pointer font-heading"
          >
            <History className="w-4 h-4 text-[#006a6a]" /> View Activity Logs →
          </button>
        </div>

        {/* 1. TOP SECTION: Premises & Last Scan Status Cards with Skeleton Loaders */}
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
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 font-heading">Premises Location</p>
                  <h4 className="text-base font-bold text-gray-900 font-heading">
                    {isInside ? 'Habba Khatoon Hostel' : 'Currently Off-Campus'}
                  </h4>
                  <p className="text-[11px] text-gray-500 font-body">
                    {isInside ? 'Authorized hostel stay' : 'Off-campus outing active'}
                  </p>
                </div>

                <span className={`px-2.5 py-1 text-[10px] font-extrabold rounded-full shrink-0 ${isInside ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                  {isInside ? '🟢 INSIDE' : '🟠 OUTSIDE'}
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

        {/* 2. BELOW SECTION: Minimal & Professional Gate Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          
          {/* Enter Hostel Action Card */}
          <button
            onClick={() => openModal('Entry')}
            className="p-6 bg-white hover:bg-teal-50/40 border border-gray-200 hover:border-teal-200 rounded-2xl shadow-xs transition-all cursor-pointer text-left flex items-center gap-5 group"
          >
            <div className="w-14 h-14 rounded-2xl bg-teal-50 text-[#006a6a] group-hover:bg-[#006a6a] group-hover:text-white flex items-center justify-center transition-all shrink-0 shadow-xs">
              <ArrowDownLeft className="w-7 h-7" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#006a6a] font-heading">
                Inbound Movement
              </span>
              <h3 className="text-xl font-bold text-gray-900 font-heading mt-0.5">Enter into Hostel</h3>
              <p className="text-xs text-gray-500 font-body mt-0.5">Geofence GPS + Biometric AI Scan</p>
            </div>
          </button>

          {/* Exit Hostel Action Card */}
          <button
            onClick={() => openModal('Exit')}
            className="p-6 bg-white hover:bg-slate-50 border border-gray-200 hover:border-slate-300 rounded-2xl shadow-xs transition-all cursor-pointer text-left flex items-center gap-5 group"
          >
            <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-700 group-hover:bg-slate-900 group-hover:text-white flex items-center justify-center transition-all shrink-0 shadow-xs">
              <ArrowUpRight className="w-7 h-7" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-heading">
                Outbound Movement
              </span>
              <h3 className="text-xl font-bold text-gray-900 font-heading mt-0.5">Exit from Hostel</h3>
              <p className="text-xs text-gray-500 font-body mt-0.5">Geofence GPS + Biometric AI Scan</p>
            </div>
          </button>

        </div>

      </div>

      {/* Verification Modal */}
      <VerificationModal
        isOpen={isVerificationModalOpen}
        onClose={() => setIsVerificationModalOpen(false)}
        mode={verificationMode}
        studentInfo={studentInfo}
        onSuccess={handleVerificationSuccess}
      />
    </Layout>
  );
};

export default StudentDashboard;
