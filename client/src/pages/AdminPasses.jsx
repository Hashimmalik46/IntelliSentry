import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { Key, CheckCircle2, XCircle, Clock, Search, Filter, ShieldCheck, AlertCircle, Phone, UserCheck, CheckSquare, History, Trash2, RefreshCw } from 'lucide-react';
import { supabase } from '../supabaseClient';

const AdminPasses = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('PENDING'); // 'PENDING', 'HISTORY', 'ALL'
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

  const handleAdminDelete = async (requestId) => {
    try {
      // 1. Forceful delete via Backend Server API (service role bypasses RLS)
      try {
        await fetch(`http://127.0.0.1:5000/delete-pass-request/${requestId}`, {
          method: "DELETE"
        });
      } catch (e) {}

      // 2. Delete via Supabase Client
      await supabase.from('pass_requests').delete().eq('id', requestId);

      fetchAllRequests();
    } catch (err) {
      console.error("Admin delete pass error:", err);
      fetchAllRequests();
    }
  };

  const pendingCount = requests.filter(req => 
    !['APPROVED', 'REJECTED', 'COMPLETED'].includes(req.admin_status)
  ).length;

  const historyCount = requests.filter(req => 
    ['APPROVED', 'REJECTED', 'COMPLETED'].includes(req.admin_status)
  ).length;

  const filteredRequests = requests.filter(req => {
    const matchesSearch = (req.student_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (req.registration_number || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;

    if (activeTab === 'PENDING') {
      return !['APPROVED', 'REJECTED', 'COMPLETED'].includes(req.admin_status);
    }

    if (activeTab === 'HISTORY') {
      return ['APPROVED', 'REJECTED', 'COMPLETED'].includes(req.admin_status);
    }

    if (filterStatus === 'READY_ADMIN') return req.parent_status === 'APPROVED' && !['APPROVED', 'REJECTED', 'COMPLETED'].includes(req.admin_status);
    if (filterStatus === 'PENDING_PARENT') return req.parent_status === 'PENDING' && !['APPROVED', 'REJECTED', 'COMPLETED'].includes(req.admin_status);
    if (filterStatus === 'APPROVED') return req.admin_status === 'APPROVED';
    if (filterStatus === 'REJECTED') return req.admin_status === 'REJECTED';
    if (filterStatus === 'COMPLETED') return req.admin_status === 'COMPLETED';

    return true;
  });

  const headerRight = (
    <button
      onClick={fetchAllRequests}
      className="w-9 h-9 rounded-xl bg-[#006a6a] hover:bg-[#005959] flex items-center justify-center text-white transition-colors cursor-pointer shadow-xs"
      title="Refresh Data"
    >
      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
    </button>
  );

  return (
    <Layout headerRight={headerRight}>
      <div className="max-w-6xl mx-auto space-y-6 font-body">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 font-heading">Leave Pass Approvals & Oversight</h2>
            <p className="text-xs text-gray-500 font-body">Review parent-approved student leave requests for final administrator sign-off</p>
          </div>
        </div>

        {/* Tab Navigation Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-2.5 rounded-2xl border border-gray-100 shadow-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setActiveTab('PENDING'); setFilterStatus('ALL'); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold font-heading transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'PENDING'
                  ? 'bg-[#006a6a] text-white shadow-sm'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Clock className="w-4 h-4" /> Current Pending Requests
              <span className={`px-2 py-0.5 text-[10px] rounded-full font-mono ${
                activeTab === 'PENDING' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
              }`}>
                {pendingCount}
              </span>
            </button>

            <button
              onClick={() => { setActiveTab('HISTORY'); setFilterStatus('ALL'); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold font-heading transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'HISTORY'
                  ? 'bg-[#006a6a] text-white shadow-sm'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <History className="w-4 h-4" /> Request History
              <span className={`px-2 py-0.5 text-[10px] rounded-full font-mono ${
                activeTab === 'HISTORY' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {historyCount}
              </span>
            </button>

            <button
              onClick={() => { setActiveTab('ALL'); setFilterStatus('ALL'); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold font-heading transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'ALL'
                  ? 'bg-[#006a6a] text-white shadow-sm'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              All Records ({requests.length})
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search student or Reg No..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#006a6a] w-48 sm:w-60 font-body"
              />
            </div>

            {activeTab === 'ALL' && (
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
                <option value="COMPLETED">Completed (Returned)</option>
              </select>
            )}
          </div>
        </div>

        {/* Master Table Container */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-3 font-body">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-gray-50 rounded-xl animate-pulse"></div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-body min-w-[700px]">
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
                          {req.admin_status === 'COMPLETED' ? (
                            <span className="px-3 py-1 bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold rounded-full uppercase tracking-wider font-heading">
                              Completed (Returned)
                            </span>
                          ) : req.admin_status === 'APPROVED' ? (
                            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full uppercase tracking-wider font-heading">
                              Pass Approved
                            </span>
                          ) : req.admin_status === 'REJECTED' ? (
                            <span className="px-3 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-full uppercase tracking-wider font-heading">
                              Pass Rejected
                            </span>
                          ) : req.parent_status === 'APPROVED' ? (
                            <span className="px-3 py-1 bg-blue-50 text-blue-800 border border-blue-200 text-xs font-bold rounded-full uppercase tracking-wider font-heading animate-pulse">
                              Ready for Admin Action
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold rounded-full uppercase tracking-wider font-heading">
                              Waiting for Parent Approval
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            {req.admin_status === 'APPROVED' || req.admin_status === 'REJECTED' || req.admin_status === 'COMPLETED' ? (
                              <span className="text-xs font-semibold text-gray-400">Decision Finalized</span>
                            ) : req.parent_status === 'APPROVED' ? (
                              <>
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
                              </>
                            ) : (
                              <button
                                disabled
                                className="px-3.5 py-1.5 bg-gray-100 text-gray-400 text-xs font-bold rounded-lg cursor-not-allowed font-heading"
                              >
                                Waiting for Parent
                              </button>
                            )}
                          </div>
                        </td>

                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="px-6 py-10 text-center text-sm text-gray-500 font-medium">
                        {activeTab === 'PENDING' ? "No active pending leave pass requests." : "No pass request records found."}
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
