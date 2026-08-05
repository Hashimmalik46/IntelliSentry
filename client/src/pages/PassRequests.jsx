import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { Key, Plus, Clock, CheckCircle2, XCircle, AlertCircle, Calendar, Send, Smartphone, ExternalLink, CheckSquare, Trash2, History, X, RefreshCw } from 'lucide-react';
import { supabase } from '../supabaseClient';
import VerificationModal from '../components/VerificationModal';
import { API_BASE_URL } from '../apiConfig';

const PassRequests = () => {
  const [studentInfo, setStudentInfo] = useState({
    name: 'Student User',
    registration_number: 'REG-2024-001',
    id: null
  });

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createdSuccessData, setCreatedSuccessData] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [activeTab, setActiveTab] = useState('ALL'); // 'ACTIVE', 'HISTORY', 'ALL'
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [selectedPassForReturn, setSelectedPassForReturn] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    leave_type: 'Weekend Home Pass',
    reason: '',
    leave_date: '',
    leave_time: '09:00 AM',
    return_date: '',
    return_time: '06:00 PM',
    parent_name: '',
    parent_phone: ''
  });

  const fetchPassRequests = async (userId, regNo) => {
    setLoading(true);
    try {
      let query = supabase.from('pass_requests').select('*').order('created_at', { ascending: false });
      if (userId) {
        query = query.or(`user_id.eq.${userId},registration_number.eq.${regNo}`);
      }

      const { data, error } = await query;
      if (!error && data) {
        setRequests(data);
      }
    } catch (err) {
      console.warn("Fetch pass requests notice:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function loadStudent() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: student } = await supabase
            .from('students')
            .select('*')
            .eq('user_id', user.id)
            .single();

          if (student) {
            setStudentInfo({
              name: student.name || user.email.split('@')[0],
              registration_number: student.registration_number || 'N/A',
              id: user.id
            });
            fetchPassRequests(user.id, student.registration_number);
          } else {
            fetchPassRequests(user.id, 'N/A');
          }
        } else {
          fetchPassRequests(null, 'N/A');
        }
      } catch (err) {
        console.warn("Student load error:", err);
        fetchPassRequests(null, 'N/A');
      }
    }

    loadStudent();
  }, []);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const getEncryptedTokenUrl = (req) => {
    if (typeof req === 'object' && req !== null) {
      return `${window.location.origin}/parent-approval/${req.token || req.id}`;
    }
    return `${window.location.origin}/parent-approval/${req}`;
  };

  const handleCreateRequest = async (e) => {
    e.preventDefault();
    if (!formData.reason || !formData.leave_date || !formData.return_date) {
      alert("Please fill all required fields including dates and reason.");
      return;
    }

    // Check for existing pending or active pass requests
    const activeExistingPass = requests.find(r => 
      ['WAITING_FOR_PARENT', 'PENDING_ADMIN', 'APPROVED'].includes(r.admin_status)
    );

    if (activeExistingPass) {
      alert(`MULTIPLE REQUESTS PREVENTED: You already have an active or pending leave pass request (${activeExistingPass.leave_type} - Status: ${activeExistingPass.final_status}). You cannot submit another request until your current pass is completed or cancelled.`);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/create-pass-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: studentInfo.id || null,
          student_name: studentInfo.name,
          registration_number: studentInfo.registration_number,
          leave_type: formData.leave_type,
          reason: formData.reason,
          leave_date: formData.leave_date,
          leave_time: formData.leave_time,
          return_date: formData.return_date,
          return_time: formData.return_time,
          origin: window.location.origin
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setModalOpen(false);
        fetchPassRequests(studentInfo.id, studentInfo.registration_number);
        
        setFormData({
          leave_type: 'Weekend Home Pass',
          reason: '',
          leave_date: '',
          leave_time: '09:00 AM',
          return_date: '',
          return_time: '06:00 PM',
          parent_name: '',
          parent_phone: ''
        });

        // Display clean UI Success Modal instead of raw alert
        setCreatedSuccessData({
          request: result.request,
          approval_url: result.approval_url,
          sms_status: result.sms_status,
          parent_name: result.request?.parent_name,
          parent_phone: result.request?.parent_phone
        });
      } else {
        alert(result.error || "Could not submit request. Please verify your university records.");
      }
    } catch (err) {
      console.error("Submit pass error:", err);
      alert("Error connecting to server. Please ensure Flask server is running.");
    } finally {
      setSubmitting(false);
    }
  };

  // Open Geofence & Biometric Verification modal for return scan
  const handleOpenReturnVerification = (requestId) => {
    setSelectedPassForReturn(requestId);
    setVerifyModalOpen(true);
  };

  // Called by VerificationModal upon successful face & GPS verification
  const handleVerificationSuccess = async (newLog) => {
    try {
      if (selectedPassForReturn) {
        await supabase
          .from('pass_requests')
          .update({
            admin_status: 'COMPLETED',
            final_status: 'Completed (Returned)'
          })
          .eq('id', selectedPassForReturn);
      }

      setVerifyModalOpen(false);
      setSelectedPassForReturn(null);
      fetchPassRequests(studentInfo.id, studentInfo.registration_number);
    } catch (err) {
      console.error("Verification return success error:", err);
      setVerifyModalOpen(false);
      setSelectedPassForReturn(null);
    }
  };

  // Delete/cancel request
  const cancelPassRequest = async (requestId) => {
    try {
      // 1. Forceful delete via Backend Server API (service role bypasses RLS)
      try {
        await fetch(`${API_BASE_URL}/delete-pass-request/${requestId}`, {
          method: "DELETE"
        });
      } catch (backendErr) {
        console.warn("Backend delete notice:", backendErr);
      }

      // 2. Delete via Supabase Client
      await supabase.from('pass_requests').delete().eq('id', requestId);

      setRequests(prev => prev.filter(r => r.id !== requestId));
      setDeleteConfirmId(null);
    } catch (err) {
      console.error("Cancel pass error:", err);
      try {
        await fetch(`${API_BASE_URL}/delete-pass-request/${requestId}`, { method: "DELETE" });
      } catch (e) {}
      setRequests(prev => prev.filter(r => r.id !== requestId));
      setDeleteConfirmId(null);
    }
  };

  const hasPendingRequest = requests.some(r => 
    ['WAITING_FOR_PARENT', 'PENDING_ADMIN', 'APPROVED'].includes(r.admin_status)
  );

  const activeRequests = requests.filter(r => 
    ['WAITING_FOR_PARENT', 'PENDING_ADMIN', 'APPROVED'].includes(r.admin_status)
  );

  const historyRequests = requests.filter(r => 
    ['COMPLETED', 'REJECTED'].includes(r.admin_status)
  );

  const displayedRequests = requests.filter(req => {
    if (activeTab === 'ACTIVE') {
      return ['WAITING_FOR_PARENT', 'PENDING_ADMIN', 'APPROVED'].includes(req.admin_status);
    }
    if (activeTab === 'HISTORY') {
      return ['COMPLETED', 'REJECTED'].includes(req.admin_status);
    }
    return true;
  });

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 font-heading">Hostel Leave Pass Requests</h2>
            <p className="text-xs text-gray-500 font-body">Request campus exit passes with parent SMS verification & admin authorization</p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto font-body">
            {hasPendingRequest && (
              <span className="px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold rounded-xl flex items-center gap-1 font-heading">
                <Clock className="w-3.5 h-3.5 text-amber-600" /> Active Request Exists
              </span>
            )}
            <button
              disabled={hasPendingRequest}
              onClick={() => setModalOpen(true)}
              title={hasPendingRequest ? "You already have an active or pending Leave Pass request" : "Raise a new leave pass request"}
              className="px-5 py-2.5 bg-[#006a6a] hover:bg-[#005959] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer font-heading"
            >
              <Plus className="w-4 h-4" /> Raise Leave Pass Request
            </button>
          </div>
        </div>

        {/* Tab Navigation Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-gray-100 shadow-xs font-body max-w-full overflow-hidden">
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0 max-w-full shrink-0">
            <button
              onClick={() => setActiveTab('ACTIVE')}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold font-heading transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'ACTIVE'
                  ? 'bg-[#006a6a] text-white shadow-sm'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> Active / Pending Pass
              <span className={`px-1.5 py-0.5 text-[9px] sm:text-[10px] rounded-full font-mono shrink-0 ${
                activeTab === 'ACTIVE' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
              }`}>
                {activeRequests.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('HISTORY')}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold font-heading transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'HISTORY'
                  ? 'bg-[#006a6a] text-white shadow-sm'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <History className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> Pass History
              <span className={`px-1.5 py-0.5 text-[9px] sm:text-[10px] rounded-full font-mono shrink-0 ${
                activeTab === 'HISTORY' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {historyRequests.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold font-heading transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'ALL'
                  ? 'bg-[#006a6a] text-white shadow-sm'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              All Records ({requests.length})
            </button>
          </div>
        </div>

        {/* Requests Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-gray-50 rounded-xl"></div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-gray-50/80 text-[11px] uppercase tracking-wider text-gray-500 font-bold border-b border-gray-100 font-heading">
                    <th className="px-4 py-3">Pass Category</th>
                    <th className="px-4 py-3">Departure Date</th>
                    <th className="px-4 py-3">Expected Return</th>
                    <th className="px-4 py-3">Parent Verification</th>
                    <th className="px-4 py-3">Admin Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-body">
                  {displayedRequests.length > 0 ? (
                    displayedRequests.map((req) => {
                      const encryptedUrl = getEncryptedTokenUrl(req);
                      return (
                        <tr key={req.id} className="hover:bg-gray-50/50 transition-colors">
                          
                          <td className="px-4 py-3">
                            <p className="font-bold text-gray-900 text-sm font-heading">{req.leave_type}</p>
                            <p className="text-xs text-gray-500 mt-0.5 max-w-xs truncate">{req.reason}</p>
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-700">
                            <p className="font-semibold">{req.leave_date}</p>
                            <p className="text-gray-400">{req.leave_time}</p>
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-700">
                            <p className="font-semibold">{req.return_date}</p>
                            <p className="text-gray-400">{req.return_time}</p>
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap">
                            {req.parent_status === 'APPROVED' ? (
                              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold rounded-full inline-flex items-center gap-1 font-heading">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Parent Approved
                              </span>
                            ) : req.parent_status === 'REJECTED' ? (
                              <span className="px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold rounded-full inline-flex items-center gap-1 font-heading">
                                <XCircle className="w-3.5 h-3.5" /> Parent Rejected
                              </span>
                            ) : (
                              <div className="flex flex-col items-start gap-1">
                                <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold rounded-full inline-flex items-center gap-1 font-heading">
                                  <Clock className="w-3.5 h-3.5" /> Pending Parent SMS
                                </span>
                                <a
                                  href={encryptedUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-teal-700 hover:text-teal-900 font-semibold cursor-pointer underline flex items-center gap-1"
                                >
                                  [Dev Test] Simulate Parent Link <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap">
                            {req.admin_status === 'APPROVED' ? (
                              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full uppercase tracking-wider font-heading">
                                Pass Approved ✅
                              </span>
                            ) : req.admin_status === 'COMPLETED' ? (
                              <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-full uppercase tracking-wider font-heading">
                                Completed (Returned) 🎓
                              </span>
                            ) : req.admin_status === 'REJECTED' ? (
                              <span className="px-3 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-full uppercase tracking-wider font-heading">
                                Pass Rejected ❌
                              </span>
                            ) : req.parent_status === 'APPROVED' ? (
                              <span className="px-3 py-1 bg-blue-50 text-blue-800 border border-blue-200 text-xs font-bold rounded-full uppercase tracking-wider font-heading">
                                Waiting for Admin Approval
                              </span>
                            ) : (
                              <span className="px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold rounded-full uppercase tracking-wider font-heading">
                                Waiting for Parent Approval
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            {req.admin_status === 'APPROVED' ? (
                              <button
                                onClick={() => handleOpenReturnVerification(req.id)}
                                className="px-3 py-1 bg-[#006a6a] hover:bg-[#005959] text-white text-[11px] font-bold rounded-lg transition-all cursor-pointer font-heading flex items-center gap-1 ml-auto"
                                title="Perform Geofence & Biometric Verification to return"
                              >
                                <CheckSquare className="w-3.5 h-3.5" /> Mark Returned
                              </button>
                            ) : !['APPROVED', 'REJECTED', 'COMPLETED'].includes(req.admin_status) && req.parent_status !== 'REJECTED' ? (
                              <button
                                onClick={() => setDeleteConfirmId(req.id)}
                                className="px-2.5 py-1 text-xs font-semibold text-gray-500 hover:text-red-600 hover:bg-red-50 border border-gray-200 hover:border-red-200 rounded-lg transition-all cursor-pointer font-heading flex items-center gap-1 ml-auto"
                                title="Cancel Pending Pass Request"
                              >
                                <X className="w-3.5 h-3.5" /> Cancel Request
                              </button>
                            ) : (
                              <span className="text-xs font-medium text-gray-400 font-body">-</span>
                            )}
                          </td>

                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="6" className="px-6 py-10 text-center text-sm text-gray-500 font-medium">
                        No leave pass requests submitted yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* Raise Request Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-8 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900 font-heading">Raise Hostel Leave Pass Request</h3>
                <p className="text-xs text-gray-500 mt-0.5 font-body">Submit exit request for parent & admin approval</p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className="space-y-4 text-xs font-body">
              
              <div>
                <label className="block font-bold text-gray-700 mb-1 font-heading">Pass Category</label>
                <select
                  name="leave_type"
                  value={formData.leave_type}
                  onChange={handleInputChange}
                  className="w-full p-3 border border-gray-200 rounded-xl bg-white font-medium focus:outline-none focus:border-[#006a6a]"
                >
                  <option value="Weekend Home Pass">Weekend Home Pass</option>
                  <option value="Outstation Leave Pass">Outstation Leave Pass</option>
                  <option value="Medical Emergency Pass">Medical Emergency Pass</option>
                  <option value="Local Day Outing Pass">Local Day Outing Pass</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1 font-heading">Departure Date *</label>
                  <input
                    type="date"
                    name="leave_date"
                    value={formData.leave_date}
                    onChange={handleInputChange}
                    required
                    className="w-full p-3 border border-gray-200 rounded-xl font-medium focus:outline-none focus:border-[#006a6a]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1 font-heading">Departure Time *</label>
                  <input
                    type="text"
                    name="leave_time"
                    placeholder="09:00 AM"
                    value={formData.leave_time}
                    onChange={handleInputChange}
                    required
                    className="w-full p-3 border border-gray-200 rounded-xl font-medium focus:outline-none focus:border-[#006a6a]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1 font-heading">Expected Return Date *</label>
                  <input
                    type="date"
                    name="return_date"
                    value={formData.return_date}
                    onChange={handleInputChange}
                    required
                    className="w-full p-3 border border-gray-200 rounded-xl font-medium focus:outline-none focus:border-[#006a6a]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1 font-heading">Return Time *</label>
                  <input
                    type="text"
                    name="return_time"
                    placeholder="06:00 PM"
                    value={formData.return_time}
                    onChange={handleInputChange}
                    required
                    className="w-full p-3 border border-gray-200 rounded-xl font-medium focus:outline-none focus:border-[#006a6a]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1 font-heading">Reason for Leave *</label>
                <textarea
                  name="reason"
                  rows="2"
                  placeholder="State detailed reason for leaving campus..."
                  value={formData.reason}
                  onChange={handleInputChange}
                  required
                  className="w-full p-3 border border-gray-200 rounded-xl font-medium focus:outline-none focus:border-[#006a6a]"
                ></textarea>
              </div>

              <div className="bg-teal-50 border border-teal-200 rounded-xl p-3.5 flex items-start gap-2.5 text-[#006a6a]">
                <Smartphone className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div className="text-[11px] font-medium leading-relaxed font-body">
                  <span className="font-bold font-heading block mb-0.5">Automated Parent Verification SMS</span>
                  The authorization link will be sent automatically to the registered parent phone number on record for Student Reg ID <span className="font-bold font-mono text-[#005959]">{studentInfo.registration_number}</span>.
                </div>
              </div>

              <div className="pt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-3 border border-gray-300 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 font-heading"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 bg-[#006a6a] hover:bg-[#005959] text-white text-xs font-bold rounded-xl shadow-md transition-all font-heading"
                >
                  {submitting ? "Submitting..." : "Submit Pass Request →"}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Request Success Modal */}
      {createdSuccessData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-body">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-5 text-center relative">
            
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-gray-900 font-heading">Leave Request Submitted!</h3>
              <p className="text-xs text-gray-500 font-body">Your hostel exit pass request has been created and logged.</p>
            </div>

            {/* Parent SMS Details Card */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-left text-xs space-y-2">
              <div className="flex items-center justify-between font-heading font-bold text-slate-800 border-b border-slate-200 pb-2">
                <span className="flex items-center gap-1.5 text-[#006a6a]">
                  <Smartphone className="w-4 h-4 text-[#006a6a]" /> Parent SMS Notification
                </span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] rounded-full uppercase font-heading">Sent</span>
              </div>

              <div className="space-y-1 text-slate-600">
                <div className="flex justify-between">
                  <span className="text-gray-400">Parent Name:</span>
                  <span className="font-semibold text-slate-800 font-heading">{createdSuccessData.parent_name || "Parent Contact"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Target Phone:</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {createdSuccessData.parent_phone ? `${createdSuccessData.parent_phone.slice(0, 3)}******${createdSuccessData.parent_phone.slice(-4)}` : "+91 ******3210"}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={() => setCreatedSuccessData(null)}
                className="w-full py-3.5 bg-[#006a6a] hover:bg-[#005959] text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer font-heading"
              >
                Close & View Pass History
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-body">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 space-y-4 text-center relative">
            
            <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto shadow-xs border border-red-100">
              <Trash2 className="w-7 h-7 text-red-600" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-gray-900 font-heading">Cancel Pass Request?</h3>
              <p className="text-xs text-gray-500 font-body">
                Are you sure you want to delete this leave pass request? This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-all cursor-pointer font-heading"
              >
                Keep Request
              </button>
              <button
                type="button"
                onClick={() => cancelPassRequest(deleteConfirmId)}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer font-heading"
              >
                Yes, Delete
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Verification Modal for Return Scan */}
      <VerificationModal
        isOpen={verifyModalOpen}
        onClose={() => { setVerifyModalOpen(false); setSelectedPassForReturn(null); }}
        mode="Entry"
        studentInfo={studentInfo}
        onSuccess={handleVerificationSuccess}
      />

    </Layout>
  );
};

export default PassRequests;
