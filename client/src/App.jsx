import CameraCapture from "./components/Camera";
import Location from "./components/Location";
import Camera from "./components/Camera";
import Signup from "./pages/Signup";
import Login from "./pages/Login";

function App() {
  return (
    <>
      <div className="w-full h-screen flex items-center justify-around">
        {/* <Location/>
       <Camera/> */}
        <Signup />
        <Login/>
      </div>
    </>
  );
}

export default App;
