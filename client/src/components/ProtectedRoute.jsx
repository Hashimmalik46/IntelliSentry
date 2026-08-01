import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

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

        // Query user role from 'students' table
        const { data: studentRecord } = await supabase
          .from("students")
          .select("role")
          .eq("user_id", user.id)
          .single();

        const role = studentRecord?.role || "student";
        if (isMounted) {
          setUserRole(role);
          sessionStorage.setItem("user_role", role);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setIsAuthenticated(false);
          setLoading(false);
        }
      }
    }

    checkAuth();
    return () => { isMounted = false; };
  }, [requiredRole]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-700 font-body">
        <div className="w-10 h-10 border-4 border-[#006a6a] border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-xs font-semibold font-heading">Verifying security authorization...</p>
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
