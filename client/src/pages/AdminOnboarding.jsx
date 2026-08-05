import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { UserPlus, Search, CheckCircle2, Clock, Edit3, X, Save, AlertCircle, RefreshCw, Users, Shield, ArrowRight, Home, Building } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

const AdminOnboarding = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('PENDING'); // 'PENDING' | 'ACTIVE' | 'ALL'

  // Modal state
  const [editingStudent, setEditingStudent] = useState(null);
  const [formState, setFormState] = useState({
    registration_number: '',
    parent_name: '',
    parent_phone: '',
    hostel_name: '',
    room_number: '',
    floor: '',
    warden_name: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  const fetchOnboardingData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Students (exclude admins)
      const { data: studentsData, error: sErr } = await supabase
        .from('students')
        .select('id, user_id, name, email, phone, registration_number, role, status, created_at')
        .order('created_at', { ascending: false });

      if (sErr) throw sErr;

      const studentRows = (studentsData || []).filter(s => {
        if (!s.role) return true;
        return String(s.role).toLowerCase() !== 'admin';
      });

      // 2. Fetch Housing Details
      const { data: housingData } = await supabase.from('university_details').select('*');
      const housingMap = {};
      (housingData || []).forEach(h => {
        if (h.registration_number) {
          housingMap[h.registration_number.toUpperCase().trim()] = h;
        }
      });

      // Formatted list
      const formatted = studentRows.map(s => {
        const regKey = s.registration_number ? s.registration_number.toUpperCase().trim() : null;
        const housing = regKey ? (housingMap[regKey] || {}) : {};

        // Explicitly active if status === 'ACTIVE' or if hostel details are fully assigned
        const isExplicitActive = s.status && String(s.status).toUpperCase() === 'ACTIVE';
        const hasCompleteHousing = housing.hostel_name && housing.hostel_name !== 'Pending Assignment';

        const isCompleted = isExplicitActive || hasCompleteHousing;

        return {
          id: s.id,
          user_id: s.user_id,
          name: s.name || s.email?.split('@')[0] || 'Student',
          email: s.email,
          registration_number: s.registration_number || '',
          phone: s.phone || 'Not Provided',
          status: isCompleted ? 'ACTIVE' : 'PENDING',
          created_at: new Date(s.created_at || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          housing: housing
        };
      });

      setStudents(formatted);
    } catch (err) {
      console.warn("Fetch onboarding error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOnboardingData();
  }, []);

  const openEditModal = (student) => {
    const housing = student.housing || {};
    setEditingStudent(student);

    const hasParentName = housing.parent_name && housing.parent_name !== 'Parent Contact' && housing.parent_name !== 'Unassigned';
    const hasParentPhone = housing.parent_phone && housing.parent_phone !== student.phone;
    const hasHostel = housing.hostel_name && housing.hostel_name !== 'Pending Assignment';
    const hasRoom = housing.room_number && housing.room_number !== 'Unassigned';
    const hasFloor = housing.floor && housing.floor !== 'N/A';
    const hasWarden = housing.warden_name && housing.warden_name !== 'Pending Assignment';

    setFormState({
      registration_number: student.registration_number || '',
      parent_name: hasParentName ? housing.parent_name : '',
      parent_phone: hasParentPhone ? housing.parent_phone : '',
      hostel_name: hasHostel ? housing.hostel_name : '',
      room_number: hasRoom ? housing.room_number : '',
      floor: hasFloor ? housing.floor : '',
      warden_name: hasWarden ? housing.warden_name : '',
    });
    setSaveMsg(null);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    const regId = formState.registration_number.trim();
    if (!regId) {
      setSaveMsg({ error: true, message: 'Registration ID (reg_id) is required.' });
      return;
    }

    setIsSaving(true);
    setSaveMsg(null);

    try {
      // 1. Update Student Table (Set registration_number & status = ACTIVE)
      let { error: studentErr } = await supabase
        .from('students')
        .update({
          registration_number: regId,
          status: 'ACTIVE'
        })
        .eq('id', editingStudent.id);

      // Fallback if status column does not exist yet in Supabase schema
      if (studentErr && (studentErr.message?.includes('status') || studentErr.code === '42703')) {
        const { error: fallbackErr } = await supabase
          .from('students')
          .update({ registration_number: regId })
          .eq('id', editingStudent.id);

        if (fallbackErr) throw fallbackErr;
      } else if (studentErr) {
        throw studentErr;
      }

      // 2. If registration number changed, clean up old university_details record and cascade update linked tables by user_id
      if (editingStudent.registration_number && editingStudent.registration_number !== regId) {
        await supabase
          .from('university_details')
          .delete()
          .eq('registration_number', editingStudent.registration_number);

        if (editingStudent.user_id) {
          await supabase
            .from('face_embeddings')
            .update({ registration_number: regId })
            .eq('user_id', editingStudent.user_id);

          await supabase
            .from('pass_requests')
            .update({ registration_number: regId })
            .eq('user_id', editingStudent.user_id);

          await supabase
            .from('attendance_logs')
            .update({ registration_number: regId })
            .eq('user_id', editingStudent.user_id);
        }
      }

      // 3. Upsert University Details Record
      const finalHostel = formState.hostel_name.trim() || 'Pending Assignment';
      const finalRoom = formState.room_number.trim() || 'Unassigned';
      const finalFloor = formState.floor.trim() || 'N/A';
      const finalWarden = formState.warden_name.trim() || 'Pending Assignment';
      const finalParentName = formState.parent_name.trim() || 'Unassigned';
      const finalParentPhone = formState.parent_phone.trim() || '';

      const { error: uniErr } = await supabase
        .from('university_details')
        .upsert([
          {
            registration_number: regId,
            parent_name: finalParentName,
            parent_phone: finalParentPhone,
            hostel_name: finalHostel,
            room_number: finalRoom,
            floor: finalFloor,
            warden_name: finalWarden
          }
        ], { onConflict: 'registration_number' });

      if (uniErr) throw uniErr;

      setSaveMsg({ error: false, message: 'Student profile successfully completed & activated!' });

      setTimeout(() => {
        setEditingStudent(null);
        fetchOnboardingData();
      }, 1000);
    } catch (err) {
      console.error("Save profile error:", err);
      setSaveMsg({ error: true, message: err.message || 'Failed to save student profile.' });
    } finally {
      setIsSaving(false);
    }
  };

  const pendingList = students.filter(s => s.status === 'PENDING');
  const activeList = students.filter(s => s.status === 'ACTIVE');

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.registration_number.toLowerCase().includes(searchQuery.toLowerCase());

    if (activeTab === 'PENDING') return matchesSearch && s.status === 'PENDING';
    if (activeTab === 'ACTIVE') return matchesSearch && s.status === 'ACTIVE';
    return matchesSearch;
  });

  const headerRight = (
    <button
      onClick={fetchOnboardingData}
      className="w-9 h-9 rounded-xl bg-[#006a6a] hover:bg-[#005959] flex items-center justify-center text-white transition-colors cursor-pointer shadow-xs"
      title="Refresh Data"
    >
      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
    </button>
  );

  return (
    <Layout headerRight={headerRight}>
      <div className="max-w-6xl mx-auto space-y-8 font-body">
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 font-heading">Student Onboarding & Profile Setup</h2>
            <p className="text-xs text-gray-500 font-body">Assign university registration IDs, parent contacts, and hostel housing to newly registered students</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/admin-students')}
              className="px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-800 text-xs font-bold rounded-xl border border-gray-200 shadow-xs transition-all flex items-center gap-2 cursor-pointer font-heading"
            >
              <Users className="w-4 h-4 text-[#006a6a]" /> Student Directory <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>


        {/* Main Onboarding Roster Container */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          
          {/* Header & Controls */}
          <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 max-w-full overflow-hidden">
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0 max-w-full shrink-0">
              {/* Tab Filters */}
              <button
                onClick={() => setActiveTab('PENDING')}
                className={`px-3 py-1.5 sm:px-4 sm:py-2 text-[11px] sm:text-xs font-bold rounded-xl transition-all font-heading cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  activeTab === 'PENDING'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Clock className="w-3.5 h-3.5 shrink-0" /> Pending Setup ({pendingList.length})
              </button>

              <button
                onClick={() => setActiveTab('ACTIVE')}
                className={`px-3 py-1.5 sm:px-4 sm:py-2 text-[11px] sm:text-xs font-bold rounded-xl transition-all font-heading cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  activeTab === 'ACTIVE'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Completed Profiles ({activeList.length})
              </button>

              <button
                onClick={() => setActiveTab('ALL')}
                className={`px-3 py-1.5 sm:px-4 sm:py-2 text-[11px] sm:text-xs font-bold rounded-xl transition-all font-heading cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'ALL'
                    ? 'bg-[#006a6a] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All Students ({students.length})
              </button>
            </div>

            {/* Search Box */}
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search name, email, reg ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#006a6a] w-48 sm:w-64 font-body"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-[#f8fafb] text-[11px] uppercase tracking-wider text-gray-500 font-bold border-b border-gray-100 font-heading">
                  <th className="px-6 py-4">Student Details</th>
                  <th className="px-6 py-4">Registration ID</th>
                  <th className="px-6 py-4">Assigned Hostel & Room</th>
                  <th className="px-6 py-4">Onboarding Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-body">
                {loading ? (
                  [1, 2, 3].map(i => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4"><div className="w-32 h-3.5 bg-slate-200 rounded-md"></div></td>
                      <td className="px-6 py-4"><div className="w-24 h-3 bg-slate-200 rounded-md"></div></td>
                      <td className="px-6 py-4"><div className="w-28 h-3 bg-slate-200 rounded-md"></div></td>
                      <td className="px-6 py-4"><div className="w-20 h-5 bg-slate-200 rounded-full"></div></td>
                      <td className="px-6 py-4"><div className="w-24 h-8 bg-slate-200 rounded-xl ml-auto"></div></td>
                    </tr>
                  ))
                ) : filteredStudents.length > 0 ? (
                  filteredStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-bold text-gray-900 text-sm font-heading">{student.name}</p>
                        <p className="text-xs text-gray-500">{student.email}</p>
                      </td>

                      <td className="px-6 py-4 font-mono text-xs font-semibold text-[#006a6a]">
                        {student.registration_number || (
                          <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded text-[11px] font-sans font-semibold">
                            Not Assigned
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-xs">
                        {student.housing.hostel_name ? (
                          <div>
                            <p className="font-bold text-gray-800 font-heading">{student.housing.hostel_name}</p>
                            <p className="text-[11px] text-gray-500">{student.housing.room_number || 'Unassigned'} ({student.housing.floor || 'N/A'})</p>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">Unassigned</span>
                        )}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        {student.status === 'ACTIVE' ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-full font-heading">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Profile Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold rounded-full font-heading">
                            <Clock className="w-3.5 h-3.5 text-amber-700" /> Pending Setup
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => openEditModal(student)}
                          className="px-4 py-2 bg-[#006a6a] hover:bg-[#005959] text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 ml-auto font-heading cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Complete / Edit Profile
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="px-6 py-10 text-center text-sm text-gray-500 font-medium">
                      No matching student records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* COMPLETE PROFILE / EDIT MODAL */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-body">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 space-y-6 shadow-2xl relative">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#006a6a] text-white flex items-center justify-center font-bold text-xl font-heading shadow-md">
                  {editingStudent.name ? editingStudent.name.charAt(0).toUpperCase() : 'S'}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 font-heading">Complete Student Profile</h3>
                  <p className="text-xs text-gray-500 font-body">Assign University Registration ID & Hostel Housing</p>
                </div>
              </div>

              <button
                onClick={() => setEditingStudent(null)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Read-Only Info */}
            <div className="bg-slate-50 p-4 rounded-xl border border-gray-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-gray-400 block text-[10px] font-bold uppercase tracking-wider font-heading">Student Full Name</span>
                <span className="font-bold text-gray-900 mt-0.5 block">{editingStudent.name}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] font-bold uppercase tracking-wider font-heading">Email Address</span>
                <span className="font-bold text-gray-900 mt-0.5 block truncate">{editingStudent.email}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] font-bold uppercase tracking-wider font-heading">Student Phone</span>
                <span className="font-bold text-gray-900 mt-0.5 block font-mono">{editingStudent.phone || 'Not Provided'}</span>
              </div>
            </div>

            {saveMsg && (
              <div className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                saveMsg.error ? "bg-red-50 text-red-800 border border-red-200" : "bg-emerald-50 text-emerald-800 border border-emerald-200"
              }`}>
                {saveMsg.error ? <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
                <span>{saveMsg.message}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSaveProfile} className="space-y-4 text-xs font-body">
              
              <div>
                <label className="block text-xs font-bold text-gray-700 font-heading mb-1">
                  Registration ID (reg_id) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formState.registration_number}
                  onChange={(e) => setFormState({ ...formState, registration_number: e.target.value })}
                  placeholder="e.g. IUST0123016837"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#006a6a] font-mono font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 font-heading mb-1">
                    Parent / Guardian Name
                  </label>
                  <input
                    type="text"
                    value={formState.parent_name}
                    onChange={(e) => setFormState({ ...formState, parent_name: e.target.value })}
                    placeholder="Parent Name"
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#006a6a]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 font-heading mb-1">
                    Parent Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formState.parent_phone}
                    onChange={(e) => setFormState({ ...formState, parent_phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#006a6a]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 font-heading mb-1">
                    Hostel Block / Name
                  </label>
                  <input
                    type="text"
                    value={formState.hostel_name}
                    onChange={(e) => setFormState({ ...formState, hostel_name: e.target.value })}
                    placeholder="Habba Khatoon Hostel / Chenab Hostel"
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#006a6a]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 font-heading mb-1">
                    Room Number
                  </label>
                  <input
                    type="text"
                    value={formState.room_number}
                    onChange={(e) => setFormState({ ...formState, room_number: e.target.value })}
                    placeholder="Room 102-A"
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#006a6a]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 font-heading mb-1">
                    Floor
                  </label>
                  <input
                    type="text"
                    value={formState.floor}
                    onChange={(e) => setFormState({ ...formState, floor: e.target.value })}
                    placeholder="1st Floor"
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#006a6a]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 font-heading mb-1">
                    Warden Name
                  </label>
                  <input
                    type="text"
                    value={formState.warden_name}
                    onChange={(e) => setFormState({ ...formState, warden_name: e.target.value })}
                    placeholder="Dr. Shazia"
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#006a6a]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="flex-1 py-3 border border-gray-300 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 font-heading cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-3 bg-[#006a6a] hover:bg-[#005959] text-white text-xs font-bold rounded-xl shadow-md disabled:opacity-50 transition-all font-heading flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? "Saving & Activating..." : "Save & Activate Profile"}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </Layout>
  );
};

export default AdminOnboarding;
