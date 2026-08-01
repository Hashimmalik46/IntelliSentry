import React, { useState, useEffect } from "react";
import { MapPin, ShieldCheck, Camera, CheckCircle2, XCircle, AlertCircle, RefreshCw, X } from "lucide-react";
import CameraCapture from "./Camera";
import { supabase } from "../supabaseClient";

const VerificationModal = ({ isOpen, onClose, mode = "Entry", studentInfo = {}, onSuccess }) => {
  const [step, setStep] = useState(1); // 1: Geofence, 2: Camera, 3: Verifying, 4: Result
  const [locationStatus, setLocationStatus] = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [bypassGeofence, setBypassGeofence] = useState(false);
  
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [capturedLandmarks, setCapturedLandmarks] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setLocationStatus(null);
      setGeoError("");
      setCapturedPhoto(null);
      setCapturedLandmarks(null);
      setVerificationResult(null);
      runGeofenceCheck();
    }
  }, [isOpen]);

  const runGeofenceCheck = () => {
    setGeoLoading(true);
    setGeoError("");

    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser.");
      setGeoLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          bypass_geofence: bypassGeofence,
        };

        try {
          const res = await fetch("http://127.0.0.1:5000/location-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(coords),
          });
          const data = await res.json();
          setLocationStatus(data);
        } catch (err) {
          console.warn("Geofence API offline:", err);
          setLocationStatus({
            inside: false,
            distance: 0,
            message: "Geofence Check Failed: Backend server offline (http://127.0.0.1:5000). Run 'python server/app.py'.",
          });
        } finally {
          setGeoLoading(false);
        }
      },
      (err) => {
        console.warn("Geolocation warning:", err.message);
        setGeoError("Could not retrieve GPS coordinates. Enable Developer Location Bypass below for testing.");
        setGeoLoading(false);
      },
      { timeout: 10000 }
    );
  };

  const handlePhotoCaptured = (photoDataUrl, landmarks = null) => {
    setCapturedPhoto(photoDataUrl);
    setCapturedLandmarks(landmarks);
  };

  const submitFaceVerification = async () => {
    if (!capturedPhoto) return;

    setStep(3);
    setVerifying(true);

    try {
      const res = await fetch("http://127.0.0.1:5000/verify-face", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: capturedPhoto,
          landmarks: capturedLandmarks,
          user_id: studentInfo?.id || null,
          registration_number: studentInfo?.registration_number || null,
        }),
      });

      const result = await res.json();
      console.log("[VERIFICATION RESPONSE]:", result);

      setVerificationResult(result);

      if (result && result.verified === true) {
        const timestamp = new Date().toISOString();
        const logPayload = {
          user_id: studentInfo?.id || null,
          student_name: studentInfo?.name || "Student User",
          registration_number: studentInfo?.registration_number || "REG-2024-001",
          type: mode,
          movement_type: mode,
          status: "AUTHORIZED",
          method: "Geofence + Biometric AI",
          created_at: timestamp,
        };

        // Insert into Supabase attendance_logs
        try {
          await supabase.from("attendance_logs").insert([{
            user_id: logPayload.user_id,
            student_name: logPayload.student_name,
            registration_number: logPayload.registration_number,
            type: mode,
            status: "AUTHORIZED",
            method: "Geofence + Biometric AI",
            created_at: timestamp,
          }]);
        } catch (dbErr) {
          console.warn("Log insertion notice:", dbErr);
        }

        setStep(4);
        if (onSuccess) {
          onSuccess(logPayload);
        }
      } else {
        setStep(4);
      }
    } catch (err) {
      console.error("Verification endpoint error:", err);
      setVerificationResult({
        verified: false,
        message: "ACCESS DENIED: Flask Backend Server (http://127.0.0.1:5000) is offline. Please run 'python server/app.py' in your terminal.",
      });
      setStep(4);
    } finally {
      setVerifying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-gray-100 relative transition-all font-body">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#006a6a] flex items-center justify-center text-white font-bold">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight font-heading">
                {mode === "Entry" ? "Hostel Entry Verification" : "Hostel Exit Verification"}
              </h3>
              <p className="text-xs text-gray-400 font-body">Multi-Factor Biometric Access Control</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6">
          
          {/* STEP 1: Geofence Verification */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-teal-50 text-[#006a6a] flex items-center justify-center mx-auto">
                  <MapPin className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-gray-900 text-base font-heading">Step 1: Geofence Radius Verification</h4>
                <p className="text-xs text-gray-500 max-w-xs mx-auto">
                  Verifying if your device coordinates are inside the authorized university campus perimeter.
                </p>
              </div>

              {geoLoading ? (
                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 text-center space-y-3">
                  <RefreshCw className="w-6 h-6 text-[#006a6a] animate-spin mx-auto" />
                  <p className="text-xs font-semibold text-gray-700 font-heading">Fetching GPS Coordinates...</p>
                </div>
              ) : geoError ? (
                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 text-amber-800 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold font-heading text-amber-900">
                    <AlertCircle className="w-4 h-4 text-amber-700" /> Geolocation Alert
                  </div>
                  <p>{geoError}</p>
                </div>
              ) : locationStatus ? (
                <div className={`p-5 rounded-2xl border text-xs space-y-2 ${locationStatus.inside ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
                  <div className="flex items-center justify-between font-bold font-heading text-sm">
                    <span className="flex items-center gap-1.5">
                      {locationStatus.inside ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <XCircle className="w-5 h-5 text-amber-600" />}
                      {locationStatus.inside ? 'Inside Campus Radius' : 'Outside Campus Radius'}
                    </span>
                    <span className="font-mono text-xs">{locationStatus.distance ? `${locationStatus.distance.toFixed(1)}m` : '0m'}</span>
                  </div>
                  <p className="text-xs">{locationStatus.message}</p>
                </div>
              ) : null}

              {/* Developer Location Bypass Checkbox */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-gray-800 font-heading">Developer GPS Bypass:</span>
                  <p className="text-[11px] text-gray-500">Allow testing without physical GPS geofence</p>
                </div>
                <input
                  type="checkbox"
                  checked={bypassGeofence}
                  onChange={(e) => {
                    setBypassGeofence(e.target.checked);
                    setTimeout(() => runGeofenceCheck(), 100);
                  }}
                  className="w-4 h-4 text-[#006a6a] rounded-xs cursor-pointer focus:ring-[#006a6a]"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={runGeofenceCheck}
                  className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs flex items-center gap-2 cursor-pointer font-heading"
                >
                  <RefreshCw className="w-4 h-4" /> Retry GPS
                </button>
                <button
                  type="button"
                  disabled={!locationStatus?.inside && !bypassGeofence}
                  onClick={() => setStep(2)}
                  className="flex-1 py-3 bg-[#006a6a] hover:bg-[#005959] disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer font-heading"
                >
                  Proceed to Face Biometrics →
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Camera Capture */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="text-center space-y-1">
                <h4 className="font-bold text-gray-900 text-base font-heading">Step 2: Biometric Face Scan</h4>
                <p className="text-xs text-gray-500">Align your face inside the camera frame to capture live features</p>
              </div>

              <CameraCapture onCapture={handlePhotoCaptured} />

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs cursor-pointer font-heading"
                >
                  ← Back to GPS
                </button>
                <button
                  type="button"
                  disabled={!capturedPhoto}
                  onClick={submitFaceVerification}
                  className="flex-1 py-3 bg-[#006a6a] hover:bg-[#005959] disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer font-heading"
                >
                  Authenticate & Submit →
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Verifying Loading State */}
          {step === 3 && (
            <div className="py-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-teal-50 text-[#006a6a] flex items-center justify-center mx-auto animate-pulse">
                <RefreshCw className="w-8 h-8 animate-spin" />
              </div>
              <div>
                <h4 className="font-bold text-gray-900 text-lg font-heading">Analyzing Face Biometrics...</h4>
                <p className="text-xs text-gray-500 max-w-xs mx-auto mt-1 font-body">
                  Comparing facial embedding vectors against registered student profiles in Supabase.
                </p>
              </div>
            </div>
          )}

          {/* STEP 4: Verification Result */}
          {step === 4 && verificationResult && (
            <div className="space-y-6 text-center py-4">
              {verificationResult.verified ? (
                <div className="space-y-3">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto animate-bounce">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <h4 className="font-extrabold text-gray-900 text-xl font-heading text-emerald-800">
                    ACCESS GRANTED
                  </h4>
                  <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 py-2.5 px-4 rounded-xl border border-emerald-200 max-w-sm mx-auto">
                    {mode === 'Entry' ? 'Welcome back! Hostel Entry Verified.' : 'Safe Travels! Hostel Exit Logged.'}
                  </p>
                  
                  {verificationResult.match_name && (
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 text-left text-xs space-y-1.5 max-w-sm mx-auto">
                      <div className="flex justify-between">
                        <span className="text-gray-500 font-medium">Matched Identity:</span>
                        <span className="font-bold text-gray-900 font-heading">{verificationResult.match_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 font-medium">Biometric Distance:</span>
                        <span className="font-mono font-bold text-[#006a6a]">
                          {verificationResult.distance !== undefined ? verificationResult.distance.toFixed(4) : 'Match Confirmed'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 font-medium">Verification Status:</span>
                        <span className="font-bold text-emerald-700 font-heading">AUTHORIZED ✅</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
                    <XCircle className="w-10 h-10" />
                  </div>
                  <h4 className="font-extrabold text-red-900 text-xl font-heading">
                    ACCESS DENIED
                  </h4>
                  <p className="text-xs font-semibold text-red-700 bg-red-50 py-2.5 px-4 rounded-xl border border-red-200 max-w-sm mx-auto">
                    {verificationResult.message || 'Face biometrics did not match registered student profile.'}
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={onClose}
                className="w-full py-3.5 bg-[#006a6a] hover:bg-[#005959] text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer font-heading"
              >
                Close Verification Window
              </button>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};

export default VerificationModal;
