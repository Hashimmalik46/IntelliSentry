import React from 'react';
import Layout from '../components/Layout';
import { ShieldCheck, User, MapPin, Hash, Phone, Mail, Building, IdCard } from 'lucide-react';

const Profile = () => {
  const headerRight = (
    <div className="text-sm font-medium text-gray-500">
      Session Active: <span className="font-bold text-gray-800 ml-1">02:23 PM</span>
    </div>
  );

  return (
    <Layout headerRight={headerRight}>
      <div className="max-w-5xl mx-auto">
        
        {/* Page Header */}
        <div className="flex items-center gap-5 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-teal-50 flex items-center justify-center">
            <User className="w-7 h-7 text-[#006a6a]" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Profile</h1>
            <p className="text-sm font-medium text-gray-500">View and manage your personal information</p>
          </div>
        </div>

        {/* Profile Details Card */}
        <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 p-10 flex flex-col md:flex-row gap-12 mb-8">
          
          {/* Left Column - Avatar & Basic Info */}
          <div className="flex flex-col items-center justify-center md:w-[35%] border-r border-gray-100 pr-4">
            <div className="w-40 h-40 rounded-full bg-[#006a6a] flex items-center justify-center text-5xl text-white font-bold mb-6">
              HM
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Hashim Malik</h2>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-teal-50 text-[#006a6a] text-xs font-bold rounded-full uppercase tracking-wide">
              <ShieldCheck className="w-4 h-4" />
              Verified Student
            </div>
          </div>

          {/* Right Column - Detailed Info */}
          <div className="flex-1 space-y-1">
            <div className="flex py-5 border-b border-gray-50 items-center">
              <div className="w-[45%] flex items-center gap-4 text-gray-600 text-sm font-semibold">
                <IdCard className="w-5 h-5 text-[#006a6a]" /> Registration Number
              </div>
              <div className="w-[55%] text-gray-900 text-sm font-semibold text-right sm:text-left">2024-UG-4801</div>
            </div>
            
            <div className="flex py-5 border-b border-gray-50 items-center">
              <div className="w-[45%] flex items-center gap-4 text-gray-600 text-sm font-semibold">
                <Phone className="w-5 h-5 text-[#006a6a]" /> Phone Number
              </div>
              <div className="w-[55%] text-gray-900 text-sm font-semibold text-right sm:text-left">+1 (555) 012-3456</div>
            </div>
            
            <div className="flex py-5 border-b border-gray-50 items-center">
              <div className="w-[45%] flex items-center gap-4 text-gray-600 text-sm font-semibold">
                <Mail className="w-5 h-5 text-[#006a6a]" /> Email Address
              </div>
              <div className="w-[55%] text-gray-900 text-sm font-semibold text-right sm:text-left">hashim.malik@university.edu</div>
            </div>
            
            <div className="flex py-5 border-b border-gray-50 items-center">
              <div className="w-[45%] flex items-center gap-4 text-gray-600 text-sm font-semibold">
                <Building className="w-5 h-5 text-[#006a6a]" /> Hostel
              </div>
              <div className="w-[55%] text-gray-900 text-sm font-semibold text-right sm:text-left">Chenab Hostel</div>
            </div>
            
            <div className="flex py-5 border-b border-gray-50 items-center">
              <div className="w-[45%] flex items-center gap-4 text-gray-600 text-sm font-semibold">
                <Hash className="w-5 h-5 text-[#006a6a]" /> Room Number
              </div>
              <div className="w-[55%] text-gray-900 text-sm font-semibold text-right sm:text-left">Room 402-A</div>
            </div>

            <div className="flex py-5 border-b border-gray-50 items-center">
              <div className="w-[45%] flex items-center gap-4 text-gray-600 text-sm font-semibold">
                {/* A staircase icon representation, we'll use a custom SVG for 'Floor' */}
                <svg className="w-5 h-5 text-[#006a6a]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M3 21v-4h4v-4h4v-4h4V5h4"/></svg> Floor
              </div>
              <div className="w-[55%] text-gray-900 text-sm font-semibold text-right sm:text-left">4th Floor</div>
            </div>
            
            <div className="flex py-5 items-center">
              <div className="w-[45%] flex items-center gap-4 text-gray-600 text-sm font-semibold">
                <User className="w-5 h-5 text-[#006a6a]" /> Warden
              </div>
              <div className="w-[55%] text-gray-900 text-sm font-semibold text-right sm:text-left">Mr. Jahanzeb</div>
            </div>
          </div>
        </div>

        {/* Update Banner */}
        <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 p-6 flex items-center gap-5">
          <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
             <ShieldCheck className="w-6 h-6 text-[#006a6a]" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 mb-1">Keep Your Information Updated</h3>
            <p className="text-sm text-gray-500 font-medium">If any of your information changes, please contact the hostel administration.</p>
          </div>
        </div>

      </div>
    </Layout>
  );
};

export default Profile;
