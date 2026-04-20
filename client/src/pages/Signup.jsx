import React, { useState } from "react";

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

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setIsLoading(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.signUp({
        email: email,
        password: password,
      });

      if (authError) throw authError;
      if (!user) throw new Error("Signup failed. Please try again.");

      const { error: dbError } = await supabase.from("students").insert([
        {
          user_id: user.id,
          name: name,
          email: email,
          phone: phone,
          registration_number: regNo,
        },
      ]);

      if (dbError) throw dbError;

      setSuccessMsg("Account created successfully! You can now log in.");
      setName("");
      setEmail("");
      setPassword("");
      setPhone("");
      setRegNo("");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Create your account
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Join the student portal today
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl sm:rounded-xl sm:px-10 border border-gray-100">
          <form className="space-y-5" onSubmit={handleSignup}>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Full Name
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors duration-200"
                  placeholder="John Doe"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div className="mt-1">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors duration-200"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors duration-200"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Phone Number
              </label>
              <div className="mt-1">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors duration-200"
                  placeholder="+1 (555) 000-0000"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Registration Number
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  value={regNo}
                  onChange={(e) => setRegNo(e.target.value)}
                  required
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors duration-200"
                  placeholder="REG-2024-XXX"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-4 border border-red-200">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Signup Failed
                    </h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>{error}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {successMsg && (
              <div className="rounded-md bg-green-50 p-4 border border-green-200">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800">
                      Success!
                    </h3>
                    <div className="mt-2 text-sm text-green-700">
                      <p>{successMsg}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="animate-spin h-4 w-4 text-white"
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
      </div>
    </div>
  );
}

export default Signup;
