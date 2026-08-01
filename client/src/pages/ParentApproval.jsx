import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ShieldCheck, CheckCircle2, XCircle, Clock, Lock, Phone, AlertCircle, Smartphone, KeyRound, RefreshCw, Check } from 'lucide-react';

const ParentApproval = () => {
  const { token } = useParams();
  const [passDetails, setPassDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [decisionDone, setDecisionDone] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // OTP State Management
  const [otpStep, setOtpStep] = useState(true);
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpNotice, setOtpNotice] = useState('');
  const [otpError, setOtpError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Countdown timer for OTP resend rate limiting
  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    async function verifyToken() {
      setLoading(true);
      setErrorMsg('');
      try {
        if (!token) {
          setErrorMsg('Invalid or missing parent authorization token.');
          setLoading(false);
          return;
        }

        const res = await fetch("http://127.0.0.1:5000/api/parent/verify-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token })
        });

        const data = await res.json();

        if (res.ok && data.valid) {
          setPassDetails(data.request);
          if (data.request.parent_status === 'APPROVED' || data.request.parent_status === 'REJECTED') {
            setDecisionDone(data.request.parent_status);
          } else if (data.request.otp_verified) {
            setOtpStep(false);
          }
        } else {
          setErrorMsg(data.error || 'Invalid or expired parent authorization token.');
        }
      } catch (err) {
        console.error("Token verification error:", err);
        setErrorMsg('Error connecting to security server. Please ensure backend server is active.');
      } finally {
        setLoading(false);
      }
    }

    verifyToken();
  }, [token]);

  const handleSendOtp = async () => {
    if (resendCooldown > 0 || otpSending) return;

    setOtpSending(true);
    setOtpError('');
    setOtpNotice('');
    try {
      const res = await fetch("http://127.0.0.1:5000/api/parent/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setOtpSent(true);
        setResendCooldown(60);
        setOtpNotice(data.message);
        if (data.simulated && data.simulated_otp) {
          setOtpNotice(`[TEST MODE] OTP sent to ${passDetails?.masked_phone}. Code: ${data.simulated_otp}`);
        }
      } else {
        setOtpError(data.error || 'Failed to send OTP code.');
      }
    } catch (err) {
      console.error("Send OTP error:", err);
      setOtpError('Error communicating with server. Please try again.');
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otpCode || otpCode.length < 4) {
      setOtpError('Please enter a valid OTP verification code.');
      return;
    }

    setOtpVerifying(true);
    setOtpError('');
    try {
      const res = await fetch("http://127.0.0.1:5000/api/parent/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, otp: otpCode })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setOtpStep(false);
      } else {
        setOtpError(data.error || 'Invalid OTP code. Please check and try again.');
      }
    } catch (err) {
      console.error("Verify OTP error:", err);
      setOtpError('Error connecting to server. Please try again.');
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleDecision = async (status) => {
    if (!passDetails) return;

    setActionLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:5000/api/parent/submit-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, decision: status })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setDecisionDone(status);
      } else {
        alert(data.error || "Failed to record decision. Please try again.");
      }
    } catch (err) {
      console.error("Parent decision error:", err);
      alert("Network error submitting decision. Please check server connection.");
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
            <p className="text-xs text-gray-400 font-body">Parent Access 2FA Authorization System</p>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-full text-[10px] text-teal-300 font-mono font-semibold">
            <Lock className="w-3 h-3" /> Cryptographic Single-Use Link
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5">
          
          {loading ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-10 h-10 border-4 border-[#006a6a] border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-xs font-semibold text-gray-500 font-heading">Validating security token & details...</p>
            </div>
          ) : errorMsg ? (
            <div className="p-6 text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
              <h3 className="text-base font-bold text-gray-900 font-heading">Authorization Link Expired or Invalid</h3>
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
          ) : otpStep ? (
            /* STEP 1: OTP Verification Screen */
            <div className="space-y-5">
              <div className="bg-slate-50 p-4 rounded-2xl border border-gray-200 space-y-2">
                <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-heading">Leave Request</span>
                  <span className="text-xs font-mono font-bold text-[#006a6a]">{passDetails.registration_number}</span>
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <div className="w-10 h-10 rounded-full bg-[#006a6a] text-white flex items-center justify-center font-bold text-base font-heading">
                    {passDetails.student_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 text-base font-heading">{passDetails.student_name}</h4>
                    <p className="text-xs text-gray-500 font-body">{passDetails.leave_type}</p>
                  </div>
                </div>
              </div>

              <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-[#006a6a]">
                  <Smartphone className="w-5 h-5" />
                  <h4 className="font-bold text-xs font-heading">Registered Parent 2FA Verification</h4>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed font-body">
                  To view leave details and authorize this request, please request and enter the SMS verification OTP code sent to registered parent phone: <strong className="text-gray-900 font-mono">{passDetails.masked_phone}</strong>.
                </p>
              </div>

              {!otpSent ? (
                <button
                  type="button"
                  disabled={otpSending}
                  onClick={handleSendOtp}
                  className="w-full py-3.5 bg-[#006a6a] hover:bg-[#005959] text-white font-bold rounded-xl shadow-md transition-all text-xs font-heading cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {otpSending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Sending Twilio OTP SMS...
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" /> Send Verification Code to Registered Phone
                    </>
                  )}
                </button>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5 font-heading">
                      Enter 6-Digit OTP Code
                    </label>
                    <input
                      type="text"
                      maxLength="6"
                      placeholder="• • • • • •"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      required
                      className="w-full p-3.5 border-2 border-gray-300 rounded-xl text-center text-xl font-mono tracking-widest focus:outline-none focus:border-[#006a6a]"
                    />
                  </div>

                  {otpNotice && (
                    <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-semibold leading-relaxed border border-emerald-200">
                      {otpNotice}
                    </div>
                  )}

                  {otpError && (
                    <div className="p-3 bg-red-50 text-red-800 rounded-xl text-xs font-semibold leading-relaxed border border-red-200">
                      {otpError}
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={resendCooldown > 0 || otpSending}
                      onClick={handleSendOtp}
                      className="flex-1 py-3 border border-gray-300 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50 font-heading flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      {resendCooldown > 0 ? `Resend OTP (${resendCooldown}s)` : "Resend OTP"}
                    </button>

                    <button
                      type="submit"
                      disabled={otpVerifying || otpCode.length < 4}
                      className="flex-1 py-3 bg-[#006a6a] hover:bg-[#005959] text-white text-xs font-bold rounded-xl shadow-md transition-all disabled:opacity-50 font-heading cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {otpVerifying ? "Verifying..." : "Verify OTP Code →"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            /* STEP 2: Authorized Leave Details & Approval Screen */
            <>
              <div className="px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-[11px] font-bold flex items-center gap-1.5 font-heading">
                <Check className="w-4 h-4 text-emerald-600" /> Parent Phone Identity Verified via Twilio OTP
              </div>

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
                    <p className="text-xs text-gray-500 font-body">Registered Parent: {passDetails.parent_name}</p>
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
