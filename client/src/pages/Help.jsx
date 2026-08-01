import React from 'react';
import Layout from '../components/Layout';
import { HelpCircle, ShieldCheck, MapPin, Camera, Phone, Mail, FileText, AlertCircle, CheckCircle2, ChevronRight, HelpCircle as HelpIcon } from 'lucide-react';

const Help = () => {
  const faqs = [
    {
      question: "How does the Hostel Access Control System work?",
      answer: "IntelliSentry uses a 2-step verification process: First, your device's GPS verifies that you are within the 500m campus geofence. Second, our biometric camera verifies your face embedding vector against your registered profile."
    },
    {
      question: "What should I do if my face scan is denied?",
      answer: "Make sure you have registered your face in the Profile tab first. Position your face straight inside the oval scanner guide, ensure good lighting, and blink your eyes naturally."
    },
    {
      question: "How do I register or update my Face Biometrics?",
      answer: "Navigate to the 'Profile' page from the sidebar and click 'Register Face Biometrics'. Position your face in the scanner until the oval ring turns Green."
    },
    {
      question: "What if GPS Geofence is failing or blocked?",
      answer: "Ensure browser location permissions are set to 'Allow'. If you are in a testing or indoor environment, you can activate the 'Developer Location Bypass' toggle on the Geofence step."
    },
    {
      question: "How can I export my attendance history?",
      answer: "On your Student Dashboard, click the 'Export CSV' button above the Access Logs table to download a complete record of your hostel entries and exits."
    }
  ];

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8 pb-10">
        
        {/* Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-[#006a6a] text-white rounded-3xl p-8 shadow-md relative overflow-hidden">
          <div className="relative z-10 max-w-2xl space-y-3">
            <span className="px-3.5 py-1 bg-white/10 text-teal-200 text-xs font-bold rounded-full uppercase tracking-wider border border-white/10">
              Support & Documentation
            </span>
            <h2 className="text-3xl font-extrabold font-heading">IntelliSentry Help Center</h2>
            <p className="text-sm text-gray-300 font-body leading-relaxed">
              Complete guide to hostel entry/exit verification, biometric profile setup, GPS geofencing, and emergency contacts.
            </p>
          </div>
        </div>

        {/* Step-by-Step Guide */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 space-y-6">
          <div className="border-b border-gray-100 pb-4">
            <h3 className="text-xl font-bold text-gray-900 font-heading">How to Use IntelliSentry</h3>
            <p className="text-xs text-gray-500 font-body">Follow these 3 steps for seamless hostel access verification</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div className="bg-slate-50 p-5 rounded-2xl border border-gray-100 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#006a6a] font-bold flex items-center justify-center font-heading">
                1
              </div>
              <h4 className="font-bold text-gray-900 text-base font-heading">Register Biometrics</h4>
              <p className="text-xs text-gray-600 font-body leading-relaxed">
                Go to <span className="font-bold text-[#006a6a]">Profile</span> ➔ click <span className="font-bold">Register Face Biometrics</span>. Align your face in the oval frame and blink naturally to save your vector profile.
              </p>
            </div>

            <div className="bg-slate-50 p-5 rounded-2xl border border-gray-100 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#006a6a] font-bold flex items-center justify-center font-heading">
                2
              </div>
              <h4 className="font-bold text-gray-900 text-base font-heading">Verify Geofence GPS</h4>
              <p className="text-xs text-gray-600 font-body leading-relaxed">
                On the <span className="font-bold text-[#006a6a]">Dashboard</span>, click <span className="font-bold">Enter into Hostel</span> or <span className="font-bold">Exit</span>. System verifies your campus location coordinates.
              </p>
            </div>

            <div className="bg-slate-50 p-5 rounded-2xl border border-gray-100 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#006a6a] font-bold flex items-center justify-center font-heading">
                3
              </div>
              <h4 className="font-bold text-gray-900 text-base font-heading">Scan & Gain Access</h4>
              <p className="text-xs text-gray-600 font-body leading-relaxed">
                Position your face inside the scanner. Once verified Green, your entry/exit is authorized and logged to the central database.
              </p>
            </div>

          </div>
        </div>

        {/* FAQs */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 space-y-6">
          <div className="border-b border-gray-100 pb-4">
            <h3 className="text-xl font-bold text-gray-900 font-heading">Frequently Asked Questions</h3>
            <p className="text-xs text-gray-500 font-body">Quick answers to common questions</p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="p-4 rounded-xl bg-slate-50 border border-gray-100 space-y-2">
                <h4 className="font-bold text-sm text-gray-900 flex items-center gap-2 font-heading">
                  <HelpIcon className="w-4 h-4 text-[#006a6a] shrink-0" />
                  {faq.question}
                </h4>
                <p className="text-xs text-gray-600 font-body leading-relaxed pl-6">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Emergency Contacts */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 space-y-6">
          <div className="border-b border-gray-100 pb-4">
            <h3 className="text-xl font-bold text-gray-900 font-heading">Emergency & Campus Support Contacts</h3>
            <p className="text-xs text-gray-500 font-body">Need immediate help? Reach out to hostel administration</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            
            <div className="p-4 rounded-xl border border-gray-200 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#006a6a] flex items-center justify-center shrink-0">
                <Phone className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider font-heading">Security Control Desk</p>
                <p className="text-sm font-bold text-gray-900 font-mono mt-0.5">+91 194 2400 123</p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-gray-200 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#006a6a] flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider font-heading">Warden Office</p>
                <p className="text-sm font-bold text-gray-900 font-body mt-0.5">warden@iust.ac.in</p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-gray-200 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#006a6a] flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider font-heading">IT Technical Desk</p>
                <p className="text-sm font-bold text-gray-900 font-body mt-0.5">support@intellisentry.ac.in</p>
              </div>
            </div>

          </div>
        </div>

      </div>
    </Layout>
  );
};

export default Help;
