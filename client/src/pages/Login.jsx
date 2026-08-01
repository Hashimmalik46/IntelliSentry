import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { supabase } from "../supabaseClient";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setIsLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword(
        {
          email: email,
          password: password,
        },
      );

      if (authError) throw authError;

      setSuccessMsg("Logged in successfully! Welcome back.");
      setPassword("");

      // Query student/user role from Supabase
      const { data: studentRecord } = await supabase
        .from("students")
        .select("role")
        .eq("user_id", data.user.id)
        .single();

      if (studentRecord && studentRecord.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/studentportal");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex justify-center items-center bg-gray-50 p-4">
      <div className="bg-white px-8 py-10 flex flex-col gap-8 rounded-2xl w-full max-w-md shadow-xl border border-gray-100">
        <div>
          <h2 className="text-center text-3xl font-extrabold text-gray-900 font-heading">
            Welcome Back
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 font-body">
            Access your security portal
          </p>
        </div>

        <div>
          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label className="block text-sm font-medium text-gray-700 font-heading mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent sm:text-sm transition-all duration-200"
                placeholder="example@gmail.com"
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

            {error && (
              <div className="rounded-xl bg-red-50 p-4 border border-red-200">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800 font-heading">
                      Login Failed
                    </h3>
                    <div className="mt-1 text-sm text-red-700">
                      <p>{error}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {successMsg && (
              <div className="rounded-xl bg-green-50 p-4 border border-green-200">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800 font-heading">
                      Success!
                    </h3>
                    <div className="mt-1 text-sm text-green-700">
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
                className="w-full flex justify-center py-3 px-4 border border-transparent font-heading rounded-xl shadow-sm text-sm font-bold text-white bg-primary hover:bg-pHover disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer"
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
                    Signing in...
                  </span>
                ) : (
                  "Sign In"
                )}
              </button>
            </div>
          </form>
        </div>
        <p className="text-center text-sm text-gray-600 font-body">
          Not Registered yet?{" "}
          <Link to="/signup" className="font-bold text-primary hover:text-pHover transition-colors">
            Signup
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
