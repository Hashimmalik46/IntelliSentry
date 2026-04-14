import CameraCapture from "./components/Camera";
import Location from "./components/Location";
import Camera from "./components/Camera";

function App() {
  return (
    <>
      <div className="w-full h-screen flex items-center justify-around">
       <Location/>
       <Camera/>
      </div>
    </>
  );
}

export default App;
