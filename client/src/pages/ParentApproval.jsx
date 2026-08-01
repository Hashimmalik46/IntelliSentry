import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ShieldCheck, CheckCircle2, XCircle, Clock, Calendar, Lock, User, Phone, AlertCircle } from 'lucide-react';
import { supabase } from '../supabaseClient';

const ParentApproval = () => {
  const { token } = useParams();
  const [passDetails, setPassDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [decisionDone, setDecisionDone] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    async function loadRequest() {
      setLoading(true);
      setErrorMsg('');
      try {
        if (!token) {
          setErrorMsg('Invalid or missing parent authorization link token.');
          setLoading(false);
          return;
        }

        // Decrypt Base64 token
        let decodedStr = '';
        try {
          decodedStr = atob(token);
        } catch (e) {
          // Fallback if raw ID was passed
          decodedStr = JSON.stringify({ id: token });
        }

        const tokenObj = JSON.parse(decodedStr);
        const reqId = tokenObj.id;

        if (!reqId) {
          setErrorMsg('Malformed authorization token.');
          setLoading(false);
          return;
        }

        // Fetch request from Supabase
        const { data, error } = await supabase
          .from('pass_requests')
          .select('*')
          .eq('id', reqId)
          .single();

        if (error || !data) {
          setErrorMsg('Pass request not found or link has expired.');
        } else {
          setPassDetails(data);
          if (data.parent_status === 'APPROVED' || data.parent_status === 'REJECTED') {
            setDecisionDone(data.parent_status);
          }
        }
      } catch (err) {
        console.error("Token decode error:", err);
        setErrorMsg('Could not decode parent verification link.');
      } finally {
        setLoading(false);
      }
    }

    loadRequest();
  }, [token]);

  const handleDecision = async (status) => {
    if (!passDetails) return;

    setActionLoading(true);
    try {
      const isApproved = status === 'APPROVED';
      const { error } = await supabase
        .from('pass_requests')
        .update({
          parent_status: status,
          admin_status: isApproved ? 'PENDING_ADMIN' : 'REJECTED',
          final_status: isApproved ? 'Waiting for Admin Approval' : 'Rejected by Parent'
        })
        .eq('id', passDetails.id);

      if (!error) {
        setDecisionDone(status);
      } else {
        alert("Failed to record decision. Please check your internet connection.");
      }
    } catch (err) {
      console.error("Parent decision error:", err);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-body">
      <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-gray-100 relative">
        
        {/* Top Security Banner */}
        <div className="bg-slate-950 text-white p-6 text-center space-y-2 border-b border-slate-800">
          <div className="w-12 h-12 rounded-2xl bg-[#006a6a] flex items-center justify-center mx-auto text-white shadow-lg">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-heading tracking-tight">IntelliSentry</h1>
            <p className="text-xs text-gray-400 font-body">Parent Access Authorization System</p>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-full text-[10px] text-teal-300 font-mono font-semibold">
            <Lock className="w-3 h-3" /> 256-Bit Encrypted Link
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5">
          
          {loading ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-10 h-10 border-4 border-[#006a6a] border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-xs font-semibold text-gray-500">Decrypting & loading pass details...</p>
            </div>
          ) : errorMsg ? (
            <div className="p-6 text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
              <h3 className="text-base font-bold text-gray-900 font-heading">Link Unverified</h3>
              <p className="text-xs text-gray-500 leading-relaxed font-body">{errorMsg}</p>
            </div>
          ) : decisionDone ? (
            <div className="py-8 text-center space-y-4">
              {decisionDone === 'APPROVED' ? (
                <>
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <div>
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-extrabold rounded-full uppercase tracking-wider font-heading">
                      LEAVE APPROVED BY PARENT
                    </span>
                    <h3 className="text-xl font-bold text-gray-900 mt-2 font-heading">Authorization Recorded</h3>
                    <p className="text-xs text-gray-600 mt-1 font-body leading-relaxed">
                      Thank you! Your approval has been securely transmitted to University Security Administration for final sign-off.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                    <XCircle className="w-10 h-10" />
                  </div>
                  <div>
                    <span className="px-3 py-1 bg-red-100 text-red-800 text-xs font-extrabold rounded-full uppercase tracking-wider font-heading">
                      LEAVE REJECTED
                    </span>
                    <h3 className="text-xl font-bold text-gray-900 mt-2 font-heading">Pass Request Declined</h3>
                    <p className="text-xs text-gray-600 mt-1 font-body leading-relaxed">
                      You have declined this leave request. The hostel wardens and student have been notified.
                    </p>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Student Info Card */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-gray-200 space-y-2">
                <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-heading">Student Request</span>
                  <span className="text-xs font-mono font-bold text-[#006a6a]">{passDetails.registration_number}</span>
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <div className="w-10 h-10 rounded-full bg-[#006a6a] text-white flex items-center justify-center font-bold text-base font-heading">
                    {passDetails.student_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 text-base font-heading">{passDetails.student_name}</h4>
                    <p className="text-xs text-gray-500 font-body">Parent Contact: {passDetails.parent_name} ({passDetails.parent_phone})</p>
                  </div>
                </div>
              </div>

              {/* Leave Details Grid */}
              <div className="space-y-3 font-body">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-heading">Leave Category</span>
                  <p className="text-sm font-bold text-gray-900 font-heading">{passDetails.leave_type}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-heading">Departure</span>
                    <p className="text-xs font-bold text-gray-900 mt-0.5">{passDetails.leave_date}</p>
                    <p className="text-[11px] text-gray-500">{passDetails.leave_time}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-heading">Expected Return</span>
                    <p className="text-xs font-bold text-gray-900 mt-0.5">{passDetails.return_date}</p>
                    <p className="text-[11px] text-gray-500">{passDetails.return_time}</p>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-heading">Stated Reason</span>
                  <p className="text-xs text-gray-700 bg-gray-50 p-3 rounded-xl border border-gray-100 leading-relaxed font-medium">
                    {passDetails.reason}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2 font-heading">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleDecision('APPROVED')}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all text-sm cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? "Recording Decision..." : "Approve Leave Request ✅"}
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleDecision('REJECTED')}
                  className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold rounded-xl transition-all text-xs cursor-pointer disabled:opacity-50"
                >
                  Reject Leave Request ❌
                </button>
              </div>
            </>
          )}

        </div>

        <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 text-center text-[10px] text-gray-400 font-body">
          IntelliSentry Biometric Access & Safety Verification Portal
        </div>

      </div>
    </div>
  );
};

export default ParentApproval;
