import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { Key, CheckCircle2, XCircle, Clock, Search, Filter, ShieldCheck, AlertCircle, Phone, UserCheck } from 'lucide-react';
import { supabase } from '../supabaseClient';

const AdminPasses = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const fetchAllRequests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pass_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setRequests(data);
      }
    } catch (err) {
      console.warn("Fetch admin pass requests notice:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllRequests();
  }, []);

  const handleAdminDecision = async (requestId, decision) => {
    try {
      const newAdminStatus = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      const newFinalStatus = decision === 'APPROVE' ? 'Approved' : 'Rejected';

      const { error } = await supabase
        .from('pass_requests')
        .update({
          admin_status: newAdminStatus,
          final_status: newFinalStatus
        })
        .eq('id', requestId);

      if (!error) {
        fetchAllRequests();
      }
    } catch (err) {
      console.error("Admin decision error:", err);
    }
  };

  const filteredRequests = requests.filter(req => {
    const matchesSearch = (req.student_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (req.registration_number || '').toLowerCase().includes(searchQuery.toLowerCase());
    if (filterStatus === 'PENDING_PARENT') return matchesSearch && req.parent_status === 'PENDING';
    if (filterStatus === 'READY_ADMIN') return matchesSearch && req.parent_status === 'APPROVED' && req.admin_status !== 'APPROVED' && req.admin_status !== 'REJECTED';
    if (filterStatus === 'APPROVED') return matchesSearch && req.admin_status === 'APPROVED';
    if (filterStatus === 'REJECTED') return matchesSearch && req.admin_status === 'REJECTED';
    return matchesSearch;
  });

  const headerRight = (
    <div className="flex items-center gap-3">
      <span className="px-3.5 py-1 bg-purple-100 text-purple-900 border border-purple-300 text-xs font-extrabold rounded-full uppercase tracking-wider font-heading shadow-xs">
        Admin Leave Approvals
      </span>
    </div>
  );

  return (
    <Layout headerRight={headerRight}>
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 font-heading">Leave Pass Approvals & Oversight</h2>
            <p className="text-xs text-gray-500 font-body">Review parent-approved student leave requests for final administrator sign-off</p>
          </div>
        </div>

        {/* Master Table Container */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 font-heading">All Hostel Exit Requests</h3>
              <p className="text-xs text-gray-500 font-body">Sequential Parent Approval ➔ Admin Authorization</p>
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
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 bg-white focus:outline-none cursor-pointer font-body"
              >
                <option value="ALL">All Statuses</option>
                <option value="READY_ADMIN">Ready for Admin Action</option>
                <option value="PENDING_PARENT">Waiting for Parent</option>
                <option value="APPROVED">Admin Approved</option>
                <option value="REJECTED">Admin Rejected</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="p-8 space-y-3 font-body">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-gray-50 rounded-xl"></div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-body">
                <thead>
                  <tr className="bg-[#f8fafb] text-[11px] uppercase tracking-wider text-gray-500 font-bold border-b border-gray-100 font-heading">
                    <th className="px-6 py-4">Student Info</th>
                    <th className="px-6 py-4">Leave Details</th>
                    <th className="px-6 py-4">Parent Contact & Status</th>
                    <th className="px-6 py-4">Admin Status</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRequests.length > 0 ? (
                    filteredRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-gray-50/50 transition-colors">
                        
                        <td className="px-6 py-4">
                          <p className="font-bold text-gray-900 text-sm font-heading">{req.student_name}</p>
                          <p className="text-xs font-mono font-semibold text-[#006a6a]">{req.registration_number}</p>
                        </td>

                        <td className="px-6 py-4">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-800 text-[10px] font-bold rounded-md font-heading">
                            {req.leave_type}
                          </span>
                          <p className="text-xs text-gray-700 font-medium mt-1">{req.reason}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            {req.leave_date} ({req.leave_time}) ➔ {req.return_date} ({req.return_time})
                          </p>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-xs font-bold text-gray-900 font-heading">{req.parent_name}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {req.parent_phone}
                          </p>
                          <div className="mt-1">
                            {req.parent_status === 'APPROVED' ? (
                              <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold rounded-full inline-flex items-center gap-1 font-heading">
                                <CheckCircle2 className="w-3 h-3" /> Parent Approved
                              </span>
                            ) : req.parent_status === 'REJECTED' ? (
                              <span className="px-2.5 py-0.5 bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold rounded-full inline-flex items-center gap-1 font-heading">
                                <XCircle className="w-3 h-3" /> Parent Rejected
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold rounded-full inline-flex items-center gap-1 font-heading">
                                <Clock className="w-3 h-3" /> Waiting for Parent SMS
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          {req.admin_status === 'APPROVED' ? (
                            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full uppercase tracking-wider font-heading">
                              Pass Approved
                            </span>
                          ) : req.admin_status === 'REJECTED' ? (
                            <span className="px-3 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-full uppercase tracking-wider font-heading">
                              Pass Rejected
                            </span>
                          ) : req.parent_status === 'APPROVED' ? (
                            <span className="px-3 py-1 bg-blue-50 text-blue-800 border border-blue-200 text-xs font-bold rounded-full uppercase tracking-wider font-heading">
                              Ready for Admin Action
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold rounded-full uppercase tracking-wider font-heading">
                              Waiting for Parent Approval
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          {req.admin_status === 'APPROVED' || req.admin_status === 'REJECTED' ? (
                            <span className="text-xs font-semibold text-gray-400">Decision Finalized</span>
                          ) : req.parent_status === 'APPROVED' ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleAdminDecision(req.id, 'APPROVE')}
                                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer font-heading"
                              >
                                Approve Pass
                              </button>
                              <button
                                onClick={() => handleAdminDecision(req.id, 'REJECT')}
                                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer font-heading"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <button
                              disabled
                              className="px-3.5 py-1.5 bg-gray-100 text-gray-400 text-xs font-bold rounded-lg cursor-not-allowed font-heading"
                            >
                              Waiting for Parent
                            </button>
                          )}
                        </td>

                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="px-6 py-10 text-center text-sm text-gray-500 font-medium">
                        No pass requests found matching the current filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </Layout>
  );
};

export default AdminPasses;
