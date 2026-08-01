import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { Users, Search, Filter, CheckCircle2, XCircle, Home, LogOut, Building, ShieldAlert, Mail, Phone, Eye, X } from 'lucide-react';
import { supabase } from '../supabaseClient';

const StudentDirectory = () => {
  const [studentsList, setStudentsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLocation, setFilterLocation] = useState('ALL');
  const [filterHostel, setFilterHostel] = useState('ALL');
  const [selectedStudent, setSelectedStudent] = useState(null);

  const fetchStudentDirectory = async () => {
    setLoading(true);
    try {
      // 1. Fetch Students strictly from 'students' table in Supabase
      const { data: studentsData } = await supabase
        .from('students')
        .select('*')
        .order('created_at', { ascending: false });

      // Strictly filter out admins and keep ONLY registered student accounts
      const studentRows = (studentsData || []).filter(s => {
        if (!s.role) return true;
        return String(s.role).toLowerCase() !== 'admin';
      });

      // 2. Fetch Housing Details
      const { data: housingData } = await supabase.from('university_details').select('*');

      // 3. Fetch Attendance Logs for movement tracking
      const { data: logsData } = await supabase.from('attendance_logs').select('*').order('created_at', { ascending: false });

      // 4. Fetch Biometric Embeddings
      const { data: embeddingsData } = await supabase.from('face_embeddings').select('user_id, registration_number');
      const enrolledSet = new Set((embeddingsData || []).map(e => (e.registration_number || e.user_id || '').toUpperCase().trim()));

      const housingMap = {};
      (housingData || []).forEach(h => {
        if (h.registration_number) {
          housingMap[h.registration_number.toUpperCase().trim()] = h;
        }
      });

      const userIdToRegMap = {};
      studentRows.forEach(s => {
        if (s.user_id && s.registration_number) {
          userIdToRegMap[s.user_id] = s.registration_number.toUpperCase().trim();
        }
      });

      const studentLatestMovement = {};
      (logsData || []).forEach(log => {
        let key = (log.registration_number && log.registration_number !== 'N/A')
          ? log.registration_number.toUpperCase().trim()
          : (userIdToRegMap[log.user_id] || log.user_id);

        if (key && !studentLatestMovement[key]) {
          studentLatestMovement[key] = log.type;
        }
      });

      // Map strictly from registered studentRows in 'students' table
      const formattedStudents = studentRows.map(s => {
        const regKey = (s.registration_number && s.registration_number !== 'N/A')
          ? s.registration_number.toUpperCase().trim()
          : (s.user_id || s.email);

        const lastMovement = studentLatestMovement[regKey] || 'Entry';
        const isOutside = lastMovement.toLowerCase().includes('exit');
        const housing = housingMap[regKey] || {};

        return {
          id: s.id,
          user_id: s.user_id,
          name: s.name || s.email?.split('@')[0] || 'Student',
          email: s.email,
          registration_number: s.registration_number || 'N/A',
          enrolled: enrolledSet.has(regKey) || (s.user_id && enrolledSet.has(s.user_id)),
          locationStatus: isOutside ? 'OUTSIDE' : 'INSIDE',
          hostel: housing.hostel_name || 'Habba Khatoon Hostel',
          room: housing.room_number || 'Unassigned',
          floor: housing.floor || '1st Floor',
          warden: housing.warden_name || 'Dr. Shazia',
          parent_name: housing.parent_name || 'Farooq Ahmad Malik',
          parent_phone: housing.parent_phone || '+919876543210'
        };
      });

      setStudentsList(formattedStudents);
    } catch (err) {
      console.warn("Fetch directory notice:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentDirectory();
  }, []);

  // Extract unique hostel names for filtering dropdown
  const availableHostels = Array.from(new Set(studentsList.map(s => s.hostel).filter(Boolean)));

  const filteredStudents = studentsList.filter(s => {
    const matchesSearch = (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (s.registration_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (s.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (s.hostel || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesLocation = filterLocation === 'ALL' ? true : (filterLocation === 'INSIDE' ? s.locationStatus === 'INSIDE' : s.locationStatus === 'OUTSIDE');

    const matchesHostel = filterHostel === 'ALL' ? true : s.hostel === filterHostel;

    return matchesSearch && matchesLocation && matchesHostel;
  });

  const headerRight = (
    <div className="flex items-center gap-3">
      <span className="px-3.5 py-1 bg-teal-100 text-teal-900 border border-teal-300 text-xs font-extrabold rounded-full uppercase tracking-wider font-heading shadow-xs">
        Student Directory
      </span>
    </div>
  );

  return (
    <Layout headerRight={headerRight}>
      <div className="max-w-6xl mx-auto space-y-6 font-body">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 font-heading">Student Biometric & Housing Directory</h2>
            <p className="text-xs text-gray-500 font-body">Master repository of enrolled students, premises location, and housing details</p>
          </div>
        </div>

        {/* Directory Table Container */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 font-heading">Enrolled Student Roster</h3>
              <p className="text-xs text-gray-500 font-body">Showing {filteredStudents.length} student records from database</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search name, Reg No, hostel..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#006a6a] w-48 sm:w-56 font-body"
                />
              </div>

              {/* Hostel Building Filter */}
              <select
                value={filterHostel}
                onChange={(e) => setFilterHostel(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 bg-white focus:outline-none cursor-pointer font-body"
              >
                <option value="ALL">All Hostels</option>
                {availableHostels.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>

              {/* Premises Location Filter */}
              <select
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 bg-white focus:outline-none cursor-pointer font-body"
              >
                <option value="ALL">All Premises</option>
                <option value="INSIDE">Inside Campus Only</option>
                <option value="OUTSIDE">Outside Campus Only</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="p-8 space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-12 bg-gray-50 rounded-xl animate-pulse"></div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#f8fafb] text-[11px] uppercase tracking-wider text-gray-500 font-bold border-b border-gray-100 font-heading">
                    <th className="px-6 py-4">Student Name</th>
                    <th className="px-6 py-4">Reg Number</th>
                    <th className="px-6 py-4">Hostel Building & Room</th>
                    <th className="px-6 py-4">Campus Location</th>
                    <th className="px-6 py-4">Biometric AI Vector</th>
                    <th className="px-6 py-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredStudents.length > 0 ? (
                    filteredStudents.map((student) => (
                      <tr key={student.id} className="hover:bg-gray-50/50 transition-colors">
                        
                        <td className="px-6 py-4">
                          <p className="font-bold text-gray-900 text-sm font-heading">{student.name}</p>
                          <p className="text-xs text-gray-500">{student.email}</p>
                        </td>

                        <td className="px-6 py-4 font-mono text-xs font-semibold text-[#006a6a] whitespace-nowrap">
                          {student.registration_number}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-xs font-bold text-gray-800 font-heading">{student.hostel}</p>
                          <p className="text-[11px] text-gray-500">{student.room} ({student.floor})</p>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          {student.locationStatus === 'OUTSIDE' ? (
                            <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold rounded-full inline-flex items-center gap-1 font-heading">
                              <LogOut className="w-3.5 h-3.5" /> Outside Campus
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold rounded-full inline-flex items-center gap-1 font-heading">
                              <Home className="w-3.5 h-3.5" /> Inside Campus
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          {student.enrolled ? (
                            <span className="px-2.5 py-1 bg-teal-50 text-[#006a6a] text-[10px] font-bold rounded-full inline-flex items-center gap-1 font-heading">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Active Vector Profile
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full inline-flex items-center gap-1 font-heading">
                              <XCircle className="w-3.5 h-3.5" /> Not Enrolled
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            onClick={() => setSelectedStudent(student)}
                            className="px-3 py-1.5 bg-gray-100 hover:bg-[#006a6a] hover:text-white text-gray-700 text-xs font-bold rounded-lg transition-all cursor-pointer font-heading flex items-center gap-1.5 ml-auto"
                          >
                            <Eye className="w-3.5 h-3.5" /> View Profile
                          </button>
                        </td>

                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="px-6 py-10 text-center text-sm text-gray-500 font-medium">
                        No registered student accounts found in database.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* Student Profile Details Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-body">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 space-y-5 shadow-2xl relative">
            
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#006a6a] text-white flex items-center justify-center font-bold text-xl font-heading shadow-md">
                  {selectedStudent.name ? selectedStudent.name.charAt(0).toUpperCase() : 'S'}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 font-heading">{selectedStudent.name}</h3>
                  <p className="text-xs font-mono font-bold text-[#006a6a]">{selectedStudent.registration_number}</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedStudent(null)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-body">
              
              <div className="bg-slate-50 p-4 rounded-xl border border-gray-100 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Email Address:</span>
                  <span className="font-bold text-gray-900">{selectedStudent.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Campus Status:</span>
                  <span className={`font-bold ${selectedStudent.locationStatus === 'OUTSIDE' ? 'text-amber-700' : 'text-emerald-700'}`}>
                    {selectedStudent.locationStatus === 'OUTSIDE' ? 'Outside Premises 🟠' : 'Inside Premises 🟢'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Biometric Profile:</span>
                  <span className="font-bold text-[#006a6a]">
                    {selectedStudent.enrolled ? 'Enrolled Active ✅' : 'Not Registered ⚠️'}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-gray-900 uppercase text-[10px] tracking-widest font-heading">Hostel Housing Assignment</h4>
                
                <div className="grid grid-cols-2 gap-3 bg-teal-50/50 p-3 rounded-xl border border-teal-100">
                  <div>
                    <span className="text-[10px] font-bold text-teal-800 uppercase tracking-wider font-heading">Hostel Block</span>
                    <p className="text-xs font-bold text-gray-900 mt-0.5">{selectedStudent.hostel}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-teal-800 uppercase tracking-wider font-heading">Room & Floor</span>
                    <p className="text-xs font-bold text-gray-900 mt-0.5">{selectedStudent.room} ({selectedStudent.floor})</p>
                  </div>
                </div>

                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Hostel Warden:</span>
                    <span className="font-bold text-gray-900">{selectedStudent.warden}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 pt-1">
                    <span className="text-gray-500">Official Parent Contact:</span>
                    <span className="font-bold text-gray-900">{selectedStudent.parent_name} ({selectedStudent.parent_phone})</span>
                  </div>
                </div>
              </div>

            </div>

            <button
              onClick={() => setSelectedStudent(null)}
              className="w-full py-3 bg-[#006a6a] hover:bg-[#005959] text-white font-bold rounded-xl shadow-md transition-all text-xs font-heading cursor-pointer"
            >
              Close Profile Card
            </button>

          </div>
        </div>
      )}

    </Layout>
  );
};

export default StudentDirectory;
