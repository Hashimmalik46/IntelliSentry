import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { ShieldCheck } from "lucide-react";

const ProtectedRoute = ({ children, requiredRole }) => {
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function checkAuth() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (isMounted) {
            setIsAuthenticated(false);
            setLoading(false);
          }
          return;
        }

        if (isMounted) {
          setIsAuthenticated(true);
        }

        // Query user role from 'students' table gracefully
        const { data: studentRecord } = await supabase
          .from("students")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();

        const role = studentRecord?.role || localStorage.getItem("user_role") || sessionStorage.getItem("user_role") || "student";
        if (isMounted) {
          setUserRole(role);
          localStorage.setItem("user_role", role);
          sessionStorage.setItem("user_role", role);
          setLoading(false);
        }
      } catch (err) {
        console.warn("Auth check notice:", err);
        if (isMounted) {
          // Retain session if user is logged in
          const { data: { user: currentUser } } = await supabase.auth.getUser().catch(() => ({ data: {} }));
          setIsAuthenticated(!!currentUser);
          setLoading(false);
        }
      }
    }

    checkAuth();
    return () => { isMounted = false; };
  }, [requiredRole]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafb] p-4">
        <div className="relative flex items-center justify-center">
          {/* Radar Ring Pulse */}
          <div className="absolute w-20 h-20 rounded-full bg-teal-400/20 animate-ping" />
          
          {/* Shield Badge */}
          <div className="relative w-16 h-16 rounded-2xl bg-white border border-teal-100 shadow-xl flex items-center justify-center text-[#006a6a]">
            <ShieldCheck className="w-9 h-9 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Strict Role Separation:
  // If route requires admin, but user is student -> send to /studentportal
  if (requiredRole === "admin" && userRole !== "admin") {
    return <Navigate to="/studentportal" replace />;
  }

  // If route requires student, but user is admin -> send to /admin
  if (requiredRole === "student" && userRole === "admin") {
    return <Navigate to="/admin" replace />;
  }

  return children;
};

export default ProtectedRoute;
