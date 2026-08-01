import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { Key, Plus, Clock, CheckCircle2, XCircle, AlertCircle, Calendar, Send, Smartphone, ExternalLink, CheckSquare, Trash2 } from 'lucide-react';
import { supabase } from '../supabaseClient';

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

  const getEncryptedTokenUrl = (requestId) => {
    const payload = JSON.stringify({ id: requestId, ts: Date.now() });
    const encryptedToken = btoa(payload);
    return `${window.location.origin}/parent-approval/${encryptedToken}`;
  };

  const handleCreateRequest = async (e) => {
    e.preventDefault();
    if (!formData.reason || !formData.leave_date || !formData.return_date || !formData.parent_phone) {
      alert("Please fill all required fields, including dates and parent contact info.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        user_id: studentInfo.id || null,
        student_name: studentInfo.name,
        registration_number: studentInfo.registration_number,
        leave_type: formData.leave_type,
        reason: formData.reason,
        leave_date: formData.leave_date,
        leave_time: formData.leave_time,
        return_date: formData.return_date,
        return_time: formData.return_time,
        parent_name: formData.parent_name || 'Parent/Guardian',
        parent_phone: formData.parent_phone,
        parent_status: 'PENDING',
        admin_status: 'WAITING_FOR_PARENT',
        final_status: 'Waiting for Parent Approval'
      };

      const { data, error } = await supabase.from('pass_requests').insert([payload]).select();

      if (!error && data && data.length > 0) {
        const newReq = data[0];
        setRequests(prev => [newReq, ...prev]);
        setModalOpen(false);
        
        const approvalUrl = getEncryptedTokenUrl(newReq.id);
        
        try {
          await fetch("http://127.0.0.1:5000/send-parent-sms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              parent_phone: newReq.parent_phone,
              student_name: newReq.student_name,
              leave_type: newReq.leave_type,
              approval_url: approvalUrl
            })
          });
        } catch (smsErr) {
          console.warn("SMS service notice:", smsErr);
        }

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
      } else {
        alert("Could not submit request. Please try again.");
      }
    } catch (err) {
      console.error("Submit pass error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  // Mark pass as completed when student returns to campus
  const markPassCompleted = async (requestId) => {
    try {
      const { error } = await supabase
        .from('pass_requests')
        .update({
          admin_status: 'COMPLETED',
          final_status: 'Completed (Returned)'
        })
        .eq('id', requestId);

      if (!error) {
        fetchPassRequests(studentInfo.id, studentInfo.registration_number);
      }
    } catch (err) {
      console.error("Mark completed error:", err);
    }
  };

  // Delete/cancel request
  const cancelPassRequest = async (requestId) => {
    if (!window.confirm("Are you sure you want to cancel this leave pass request?")) return;
    try {
      const { error } = await supabase.from('pass_requests').delete().eq('id', requestId);
      if (!error) {
        setRequests(prev => prev.filter(r => r.id !== requestId));
      }
    } catch (err) {
      console.error("Cancel pass error:", err);
    }
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 font-heading">Hostel Leave Pass Requests</h2>
            <p className="text-xs text-gray-500 font-body">Request campus exit passes with parent SMS verification & admin authorization</p>
          </div>

          <button
            onClick={() => setModalOpen(true)}
            className="px-5 py-2.5 bg-[#006a6a] hover:bg-[#005959] text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 self-start sm:self-auto cursor-pointer font-heading"
          >
            <Plus className="w-4 h-4" /> Raise Leave Pass Request
          </button>
        </div>

        {/* Requests Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900 font-heading">My Pass History</h3>
              <p className="text-xs text-gray-500 font-body">Real-time status tracking & completion management</p>
            </div>
          </div>

          {loading ? (
            <div className="p-8 space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-gray-50 rounded-xl"></div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-body">
                <thead>
                  <tr className="bg-[#f8fafb] text-[11px] uppercase tracking-wider text-gray-500 font-bold border-b border-gray-100 font-heading">
                    <th className="px-6 py-4">Pass Type & Reason</th>
                    <th className="px-6 py-4">Departure</th>
                    <th className="px-6 py-4">Expected Return</th>
                    <th className="px-6 py-4">Parent Verification</th>
                    <th className="px-6 py-4">Admin Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {requests.length > 0 ? (
                    requests.map((req) => {
                      const encryptedUrl = getEncryptedTokenUrl(req.id);
                      return (
                        <tr key={req.id} className="hover:bg-gray-50/50 transition-colors">
                          
                          <td className="px-6 py-4">
                            <p className="font-bold text-gray-900 text-sm font-heading">{req.leave_type}</p>
                            <p className="text-xs text-gray-500 mt-0.5 max-w-xs truncate">{req.reason}</p>
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-700">
                            <p className="font-semibold">{req.leave_date}</p>
                            <p className="text-gray-400">{req.leave_time}</p>
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-700">
                            <p className="font-semibold">{req.return_date}</p>
                            <p className="text-gray-400">{req.return_time}</p>
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap">
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
                                  Open Encrypted Parent Page <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            )}
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap">
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

                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            {req.admin_status === 'APPROVED' ? (
                              <button
                                onClick={() => markPassCompleted(req.id)}
                                className="px-3 py-1 bg-[#006a6a] hover:bg-[#005959] text-white text-[11px] font-bold rounded-lg transition-all cursor-pointer font-heading flex items-center gap-1 ml-auto"
                                title="Click when returned to campus to close pass"
                              >
                                <CheckSquare className="w-3.5 h-3.5" /> Mark Returned
                              </button>
                            ) : (
                              <button
                                onClick={() => cancelPassRequest(req.id)}
                                className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer ml-auto"
                                title="Cancel Pass Request"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
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
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl relative">
            
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1 font-heading">Parent Name *</label>
                  <input
                    type="text"
                    name="parent_name"
                    placeholder="Father/Mother Name"
                    value={formData.parent_name}
                    onChange={handleInputChange}
                    required
                    className="w-full p-3 border border-gray-200 rounded-xl font-medium focus:outline-none focus:border-[#006a6a]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1 font-heading">Parent Phone (for SMS) *</label>
                  <input
                    type="tel"
                    name="parent_phone"
                    placeholder="+91 98765 43210"
                    value={formData.parent_phone}
                    onChange={handleInputChange}
                    required
                    className="w-full p-3 border border-gray-200 rounded-xl font-medium focus:outline-none focus:border-[#006a6a]"
                  />
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

    </Layout>
  );
};

export default PassRequests;
