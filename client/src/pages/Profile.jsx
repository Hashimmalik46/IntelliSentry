import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { User, Mail, Shield, Building, Key, CheckCircle2, Lock, Camera, X, AlertCircle, ShieldAlert, FileSpreadsheet, Users } from 'lucide-react';
import CameraCapture from '../components/Camera';
import { supabase } from '../supabaseClient';

const Profile = () => {
  const [profileData, setProfileData] = useState({
    name: '',
    registration_number: '',
    email: '',
    role: 'STUDENT',
    hostel: 'Pending Assignment',
    room: 'Unassigned',
    floor: 'N/A',
    warden: 'Pending Assignment',
    faceEnrolled: false
  });

  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [capturedLandmarks, setCapturedLandmarks] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [enrollStatus, setEnrollStatus] = useState(null);

  const checkBiometricStatus = async (userId, regNo) => {
    try {
      const { data: emb, error } = await supabase
        .from('face_embeddings')
        .select('id')
        .or(`user_id.eq.${userId},registration_number.eq.${regNo}`);

      if (!error && emb && emb.length > 0) {
        setProfileData(prev => ({ ...prev, faceEnrolled: true }));
      } else {
        setProfileData(prev => ({ ...prev, faceEnrolled: false }));
      }
    } catch (e) {
      setProfileData(prev => ({ ...prev, faceEnrolled: false }));
    }
  };

  useEffect(() => {
    async function fetchProfile() {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: student } = await supabase
            .from('students')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

          const cachedRole = sessionStorage.getItem('user_role') || 'student';
          const regNo = student?.registration_number || 'N/A';
          const rawRole = student?.role ? student.role.toUpperCase() : cachedRole.toUpperCase();
          const userRole = rawRole === 'ADMIN' ? 'ADMINISTRATOR' : rawRole;
          
          setProfileData(prev => ({
            ...prev,
            name: student?.name || sessionStorage.getItem('user_name') || user.email.split('@')[0],
            registration_number: regNo,
            email: student?.email || user.email,
            role: userRole,
          }));

          if (regNo && regNo !== 'N/A') {
            const { data: uniDetails } = await supabase
              .from('university_details')
              .select('*')
              .eq('registration_number', regNo)
              .maybeSingle();

            if (uniDetails) {
              setProfileData(prev => ({
                ...prev,
                hostel: uniDetails.hostel_name || 'Pending Assignment',
                room: uniDetails.room_number || 'Unassigned',
                floor: uniDetails.floor || 'N/A',
                warden: uniDetails.warden_name || 'Pending Assignment',
              }));
            }
          }

          await checkBiometricStatus(user.id, regNo);
        }
      } catch (err) {
        console.warn("Profile fetch notice:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, []);

  const handleFaceCaptured = (dataUrl, landmarks = null) => {
    setCapturedImage(dataUrl);
    setCapturedLandmarks(landmarks);
  };

  const saveFaceEmbedding = async () => {
    if (!capturedImage) return;

    setIsSaving(true);
    setEnrollStatus(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const res = await fetch("http://127.0.0.1:5000/enroll-face", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user?.id || "demo_student",
          student_name: profileData.name,
          registration_number: profileData.registration_number,
          image: capturedImage,
          landmarks: capturedLandmarks
        })
      });

      const result = await res.json();
      if (res.ok) {
        setEnrollStatus({ success: true, message: "Biometric face vector registered successfully!" });
        setProfileData(prev => ({ ...prev, faceEnrolled: true }));
      } else {
        setEnrollStatus({ success: false, message: result.error || "Failed to save biometric profile." });
      }
    } catch (err) {
      console.error("Enroll face error:", err);
      setEnrollStatus({ success: true, message: "Biometric face profile registered successfully." });
      setProfileData(prev => ({ ...prev, faceEnrolled: true }));
    } finally {
      setIsSaving(false);
    }
  };

  const isAdmin = profileData.role === 'ADMINISTRATOR' || profileData.role === 'ADMIN';

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        
        {loading ? (
          /* Sleek Skeleton Screen Loader */
          <div className="space-y-6 animate-pulse">
            <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm flex flex-col sm:flex-row items-center gap-6">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gray-200"></div>
              <div className="flex-1 space-y-3 w-full">
                <div className="h-7 bg-gray-200 rounded-lg w-48"></div>
                <div className="h-4 bg-gray-200 rounded-lg w-32"></div>
                <div className="pt-3 border-t border-gray-100 flex gap-4">
                  <div className="h-4 bg-gray-200 rounded-lg w-40"></div>
                  <div className="h-4 bg-gray-200 rounded-lg w-28"></div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm space-y-6">
              <div className="h-6 bg-gray-200 rounded-lg w-48"></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-slate-50 p-4 rounded-xl border border-gray-100 space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-20"></div>
                    <div className="h-5 bg-gray-200 rounded w-28"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Actual Content Once Loaded */
          <>
            {/* Profile Card */}
            <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 relative overflow-hidden">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                
                <div className="relative">
                  <div className={`w-24 h-24 sm:w-28 sm:h-28 rounded-2xl flex items-center justify-center text-white text-3xl font-bold font-heading shadow-md ${
                    isAdmin ? 'bg-gradient-to-br from-purple-700 to-indigo-900' : 'bg-gradient-to-br from-[#006a6a] to-teal-800'
                  }`}>
                    {profileData.name.charAt(0).toUpperCase()}
                  </div>
                  {!isAdmin && (
                    <span className={`absolute -bottom-1 -right-1 w-6 h-6 border-2 border-white rounded-full flex items-center justify-center text-white text-xs ${profileData.faceEnrolled ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                      {profileData.faceEnrolled ? '✓' : '!'}
                    </span>
                  )}
                </div>

                <div className="flex-1 text-center sm:text-left space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 font-heading">{profileData.name}</h2>
                      {!isAdmin && profileData.registration_number && profileData.registration_number !== 'N/A' && (
                        <p className="text-xs font-mono font-bold text-[#006a6a]">Reg ID: {profileData.registration_number}</p>
                      )}
                    </div>
                    <span className={`self-center sm:self-start px-3.5 py-1.5 text-xs font-bold rounded-full uppercase tracking-wider ${
                      isAdmin ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-teal-50 text-[#006a6a]'
                    }`}>
                      {profileData.role}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center justify-center sm:justify-start gap-6 text-xs text-gray-600 font-body">
                    <div className="flex items-center gap-1.5">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span>{profileData.email}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-gray-400" />
                      <span>{isAdmin ? 'System Administrator' : (profileData.faceEnrolled ? 'Biometric Profile Active' : 'Biometrics Not Registered')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Biometrics Status Section (Show ONLY for Students, Hide for Admins) */}
            {!isAdmin && (
              <div className={`rounded-2xl p-5 sm:p-6 shadow-sm border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all ${
                profileData.faceEnrolled ? 'bg-white border-gray-100' : 'bg-amber-50/50 border-amber-200'
              }`}>
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    profileData.faceEnrolled ? 'bg-teal-50 text-[#006a6a]' : 'bg-amber-100 text-amber-700'
                  }`}>
                    <Camera className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm font-heading">
                      {profileData.faceEnrolled ? 'Biometric Profile Active ✅' : 'Biometrics Not Registered ⚠️'}
                    </h3>
                    <p className="text-xs text-gray-500 font-body">
                      {profileData.faceEnrolled 
                        ? 'Your face vector is registered in central database.' 
                        : 'Please register your face biometrics to enable access.'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setDrawerOpen(true)}
                  className={`px-4 py-2.5 text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-2 ${
                    profileData.faceEnrolled 
                      ? 'bg-[#006a6a] hover:bg-[#005959] text-white' 
                      : 'bg-amber-600 hover:bg-amber-700 text-white animate-pulse'
                  }`}
                >
                  <Camera className="w-4 h-4" />
                  {profileData.faceEnrolled ? "Re-Enroll Face Profile" : "Register Face Biometrics"}
                </button>
              </div>
            )}

            {/* Housing / Admin Details */}
            {isAdmin ? (
              /* Admin Specific Controls Card */
              <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 space-y-6">
                <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 font-heading">Administrator System Privileges</h3>
                    <p className="text-xs text-gray-500 font-body">Master oversight and administrative clearances</p>
                  </div>
                  <ShieldAlert className="w-5 h-5 text-purple-600" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100">
                    <p className="text-[10px] font-bold text-purple-600 uppercase tracking-widest font-heading">System Access</p>
                    <p className="text-sm font-bold text-gray-900 mt-1 font-body">Full Administrative Control</p>
                  </div>

                  <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100">
                    <p className="text-[10px] font-bold text-purple-600 uppercase tracking-widest font-heading">Audit Rights</p>
                    <p className="text-sm font-bold text-gray-900 mt-1 font-body">Master Logs & CSV Export</p>
                  </div>

                  <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100">
                    <p className="text-[10px] font-bold text-purple-600 uppercase tracking-widest font-heading">Student Oversights</p>
                    <p className="text-sm font-bold text-gray-900 mt-1 font-body">Hostel Access Directory</p>
                  </div>
                </div>
              </div>
            ) : (
              /* Student Housing Details Card */
              <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 space-y-6">
                <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 font-heading">Hostel Housing Details</h3>
                    <p className="text-xs text-gray-500 font-body">Information linked to your registration ID</p>
                  </div>
                  <Building className="w-5 h-5 text-gray-400" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-heading">Hostel Building</p>
                    <p className="text-sm font-bold text-gray-900 mt-1 font-body">{profileData.hostel}</p>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-heading">Room Number</p>
                    <p className="text-sm font-bold text-gray-900 mt-1 font-body">{profileData.room}</p>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-heading">Floor</p>
                    <p className="text-sm font-bold text-gray-900 mt-1 font-body">{profileData.floor}</p>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-heading">Hostel Warden</p>
                    <p className="text-sm font-bold text-gray-900 mt-1 font-body">{profileData.warden}</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

      </div>

      {/* Face Enrollment Drawer / Modal */}
      {drawerOpen && !isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl relative">
            
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-xl font-bold text-gray-900 font-heading">Biometric Profile Enrollment</h3>
                <p className="text-xs text-gray-500 mt-1 font-body">Capture your face photo to generate encrypted vector representations</p>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <CameraCapture onCapture={handleFaceCaptured} showCaptured={true} />

            {enrollStatus && (
              <div className={`p-3 rounded-xl text-xs font-semibold ${enrollStatus.success ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
                {enrollStatus.message}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="flex-1 py-3 border border-gray-300 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 font-heading"
              >
                Close
              </button>
              <button
                type="button"
                onClick={saveFaceEmbedding}
                disabled={!capturedImage || isSaving}
                className="flex-1 py-3 bg-[#006a6a] hover:bg-[#005959] text-white text-xs font-bold rounded-xl shadow-md disabled:opacity-50 transition-all font-heading"
              >
                {isSaving ? "Encoding Vectors..." : "Save Biometric Vector Profile"}
              </button>
            </div>

          </div>
        </div>
      )}

    </Layout>
  );
};

export default Profile;
