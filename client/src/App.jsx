import CameraCapture from "./components/Camera";
import Location from "./components/Location";
import Signup from "./pages/Signup";
import Login from "./pages/Login";

import { BrowserRouter, Routes, Route } from "react-router-dom";
import StudentDashboard from "./pages/StudentDashboard";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/studentportal" element={<StudentDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
