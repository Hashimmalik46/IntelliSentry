import Signup from "./pages/Signup";
import Login from "./pages/Login";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import StudentDashboard from "./pages/StudentDashboard";
import Profile from "./pages/Profile";
import Help from "./pages/Help";
import PassRequests from "./pages/PassRequests";
import ActivityLogs from "./pages/ActivityLogs";
import ParentApproval from "./pages/ParentApproval";
import AdminDashboard from "./pages/AdminDashboard";
import AdminPasses from "./pages/AdminPasses";
import StudentDirectory from "./pages/StudentDirectory";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Public Encrypted Parent Verification Route */}
        <Route path="/parent-approval/:token" element={<ParentApproval />} />

        {/* Protected Student Routes (Requires role = 'student') */}
        <Route
          path="/studentportal"
          element={
            <ProtectedRoute requiredRole="student">
              <StudentDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pass-requests"
          element={
            <ProtectedRoute requiredRole="student">
              <PassRequests />
            </ProtectedRoute>
          }
        />
        <Route
          path="/activity-logs"
          element={
            <ProtectedRoute requiredRole="student">
              <ActivityLogs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/help"
          element={
            <ProtectedRoute requiredRole="student">
              <Help />
            </ProtectedRoute>
          }
        />

        {/* Shared Profile Route for both Student & Admin */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />

        {/* Protected Admin Routes (Requires role = 'admin') */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-passes"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminPasses />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-students"
          element={
            <ProtectedRoute requiredRole="admin">
              <StudentDirectory />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
