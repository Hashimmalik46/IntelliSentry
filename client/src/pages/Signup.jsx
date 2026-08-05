import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2, Shield } from "lucide-react";

import { supabase } from "../supabaseClient";

function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [regNo, setRegNo] = useState("");

  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setIsLoading(true);

    const formattedRegNo = regNo.trim().toUpperCase();
    const formattedEmail = email.trim().toLowerCase();

    try {
      // 1. Pre-check: Verify Registration Number uniqueness before creating Auth account
      const { data: existingReg } = await supabase
        .from("students")
        .select("id, name, email")
        .ilike("registration_number", formattedRegNo)
        .maybeSingle();

      if (existingReg) {
        throw new Error(
          `Registration Number "${formattedRegNo}" is already registered. Please check your Registration ID or sign in.`
        );
      }

      // 2. Pre-check: Verify Email uniqueness in students table
      const { data: existingEmail } = await supabase
        .from("students")
        .select("id")
        .ilike("email", formattedEmail)
        .maybeSingle();

      if (existingEmail) {
        throw new Error(
          `The email address "${formattedEmail}" is already registered. Please sign in instead.`
        );
      }

      // 3. Create Supabase Auth User
      const {
        data: authData,
        error: authError,
      } = await supabase.auth.signUp({
        email: formattedEmail,
        password: password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Signup failed. Please try again.");

      // 4. Insert Student Record
      const { error: dbError } = await supabase.from("students").insert([
        {
          user_id: authData.user.id,
          name: name.trim(),
          email: formattedEmail,
          phone: phone.trim(),
          registration_number: formattedRegNo,
          role: "student",
        },
      ]);

      if (dbError) {
        if (dbError.message?.includes("students_registration_number_key") || dbError.message?.includes("duplicate key")) {
          throw new Error(`Registration Number "${formattedRegNo}" is already registered.`);
        }
        throw dbError;
      }

      // 5. Upsert University Details Record
      const { error: uniError } = await supabase.from("university_details").upsert([
        {
          registration_number: formattedRegNo,
          parent_name: null,
          parent_phone: null,
        },
      ], { onConflict: "registration_number" });

      if (uniError) {
        console.warn("University details upsert notice:", uniError);
      }

      setSuccessMsg("Account created successfully! Redirecting...");
      setName("");
      setEmail("");
      setPassword("");
      setPhone("");
      setRegNo("");

      setTimeout(() => {
        navigate("/");
      }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex justify-center items-center bg-gray-50 p-4 font-body">
      <div className="bg-white px-8 py-10 flex flex-col gap-6 rounded-3xl w-full max-w-md shadow-xl border border-gray-100 my-8">
        
        {/* Card Header */}
        <div className="flex flex-col items-center gap-3 text-center">
          <img src="/favicon.svg" alt="IntelliSentry Logo" className="w-14 h-14 rounded-2xl shadow-sm hover:scale-105 transition-transform" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900 font-heading">
              Create Student Account
            </h2>
            <p className="text-xs text-gray-500 font-body mt-1">
              Register for your IntelliSentry hostel security portal
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 flex items-start gap-2.5 text-red-800 text-xs font-body animate-fade-in">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold font-heading block text-red-900 mb-0.5">Registration Failed</span>
              {error}
            </div>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-start gap-2.5 text-emerald-800 text-xs font-body animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold font-heading block text-emerald-900 mb-0.5">Success!</span>
              {successMsg}
            </div>
          </div>
        )}

        <div>
          <form className="space-y-5" onSubmit={handleSignup}>
            <div>
              <label className="block text-sm font-medium text-gray-700 font-heading mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent sm:text-sm transition-all duration-200"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 font-heading mb-1">
                Registration Number
              </label>
              <input
                type="text"
                value={regNo}
                onChange={(e) => setRegNo(e.target.value)}
                required
                className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent sm:text-sm transition-all duration-200"
                placeholder="REG-2024-XXX"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 font-heading mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent sm:text-sm transition-all duration-200"
                placeholder="+1 234 567 8900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 font-heading mb-1">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent sm:text-sm transition-all duration-200"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 font-heading mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent sm:text-sm transition-all duration-200"
                placeholder="••••••••"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm font-heading text-sm font-bold text-white bg-primary hover:bg-pHover cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="animate-spin h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Signing up...
                  </span>
                ) : (
                  "Sign Up"
                )}
              </button>
            </div>
          </form>
        </div>
        <p className="text-center text-sm text-gray-600 font-body">
          Already Registered?{" "}
          <Link to="/" className="font-bold text-[#006a6a] hover:underline transition-colors">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Signup;
