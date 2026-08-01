import { useEffect, useRef, useState, useCallback } from "react";
import * as faceapi from "face-api.js";

function CameraCapture({ onCapture, autoCapture = true, showCaptured = true }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [photo, setPhoto] = useState(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [captured, setCaptured] = useState(false);
  const [alignmentStatus, setAlignmentStatus] = useState("Position face inside frame");
  const [isProperlyCentered, setIsProperlyCentered] = useState(false);
  
  const stabilityTimerRef = useRef(0);
  const isCapturingRef = useRef(false);
  const lastLandmarksRef = useRef(null);

  // ✂️ Crop ONLY the face inside the oval frame & extract geometric landmarks
  const takeCroppedOvalPhoto = useCallback((currentLandmarks = null) => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;

    const width = video.videoWidth;
    const height = video.videoHeight;

    const cropW = Math.round(width * 0.50);
    const cropH = Math.round(height * 0.75);
    const cropX = Math.round((width - cropW) / 2);
    const cropY = Math.round((height - cropH) / 2);

    const canvas = document.createElement("canvas");
    canvas.width = cropW;
    canvas.height = cropH;
    const ctx = canvas.getContext("2d");

    ctx.beginPath();
    ctx.ellipse(cropW / 2, cropH / 2, cropW / 2, cropH / 2, 0, 0, 2 * Math.PI);
    ctx.clip();

    ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
    setPhoto(dataUrl);

    // Extract normalized facial landmark coordinates (0.0 to 1.0)
    let normalizedLandmarks = null;
    const lms = currentLandmarks || lastLandmarksRef.current;
    if (lms && lms.positions) {
      normalizedLandmarks = lms.positions.map(p => ({
        x: p.x / width,
        y: p.y / height
      }));
    }

    if (onCapture) {
      onCapture(dataUrl, normalizedLandmarks);
    }
  }, [onCapture]);

  // 🎥 Camera Initialization
  useEffect(() => {
    let activeStream = null;
    let isMounted = true;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        activeStream = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Camera access error:", err);
      }
    }

    startCamera();

    return () => {
      isMounted = false;
      if (activeStream) {
        activeStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // 🧠 Models Loading
  useEffect(() => {
    let isMounted = true;
    const MODEL_URL = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights";

    async function load() {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        ]);
        if (isMounted) setModelsLoaded(true);
      } catch (err) {
        console.warn("FaceAPI model loading notice:", err);
        if (isMounted) setModelsLoaded(true);
      }
    }

    load();

    const timer = setTimeout(() => {
      if (isMounted) setModelsLoaded(true);
    }, 1500);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  // 🔁 Stable Face Alignment & Smooth Auto-Capture Loop
  useEffect(() => {
    if (!modelsLoaded || captured) return;

    const interval = setInterval(async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.videoWidth === 0 || isCapturingRef.current) return;

      const size = {
        width: video.videoWidth,
        height: video.videoHeight,
      };

      faceapi.matchDimensions(canvas, size);

      try {
        const detections = await faceapi
          .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.40 }))
          .withFaceLandmarks();

        const resized = faceapi.resizeResults(detections, size);
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (resized.length === 1) {
          const det = resized[0];
          const box = det.detection.box;
          lastLandmarksRef.current = det.landmarks;

          const faceArea = box.width * box.height;
          const frameArea = video.videoWidth * video.videoHeight;
          const isGoodSize = (faceArea / frameArea) > 0.05;

          const centerX = video.videoWidth / 2;
          const faceCenterX = box.x + box.width / 2;
          const isCentered = Math.abs(centerX - faceCenterX) < 110;

          const isValidPosition = isGoodSize && isCentered;

          if (isValidPosition) {
            stabilityTimerRef.current += 1;

            if (stabilityTimerRef.current >= 3) {
              setIsProperlyCentered(true);
              setAlignmentStatus("Face Centered & Ready");

              if (autoCapture && !captured && !isCapturingRef.current) {
                isCapturingRef.current = true;
                setCaptured(true);
                setTimeout(() => {
                  takeCroppedOvalPhoto(det.landmarks);
                }, 400);
              }
            } else {
              setAlignmentStatus("Hold still for scan...");
            }
          } else {
            stabilityTimerRef.current = 0;
            setIsProperlyCentered(false);
            setAlignmentStatus("Position face inside oval frame");
          }
        } else if (resized.length > 1) {
          stabilityTimerRef.current = 0;
          setIsProperlyCentered(false);
          setAlignmentStatus("Multiple faces detected - Ensure single face");
        } else {
          stabilityTimerRef.current = 0;
          setIsProperlyCentered(false);
          setAlignmentStatus("Position face inside oval frame");
        }
      } catch (err) {
        stabilityTimerRef.current = 0;
        setIsProperlyCentered(false);
        setAlignmentStatus("Position face inside oval frame");
      }
    }, 200);

    return () => clearInterval(interval);
  }, [modelsLoaded, captured, autoCapture, takeCroppedOvalPhoto]);

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      
      {/* Status Badge */}
      <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-50 text-slate-800 border border-slate-200 rounded-full text-xs font-semibold shadow-xs">
        <span className={`w-2.5 h-2.5 rounded-full ${isProperlyCentered ? 'bg-emerald-500 animate-pulse' : 'bg-teal-500'}`}></span>
        {isProperlyCentered ? (
          <span className="text-emerald-700 font-bold">Face Aligned & Centered</span>
        ) : (
          <span>Align face inside oval frame</span>
        )}
      </div>

      {/* Viewport Container */}
      <div className="relative w-full h-64 sm:h-72 rounded-3xl overflow-hidden bg-slate-950 shadow-2xl border border-slate-800">
        {!modelsLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white z-30 p-4 text-center">
            <div className="w-8 h-8 border-4 border-[#006a6a] border-t-transparent rounded-full animate-spin mb-2"></div>
            <p className="text-xs font-semibold">Initializing Scanner...</p>
          </div>
        )}

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />

        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full object-cover pointer-events-none hidden"
        />

        {/* Oval Target Frame */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="absolute inset-0 bg-slate-950/35 backdrop-blur-[0.5px]"></div>
          
          <div className={`w-44 h-56 sm:w-48 sm:h-60 rounded-[50%] transition-all duration-300 shadow-2xl z-20 ${
            isProperlyCentered 
              ? 'border-4 border-emerald-400 shadow-[0_0_40px_#10B981]' 
              : 'border-2 border-white/70 shadow-[0_0_15px_rgba(255,255,255,0.2)]'
          }`}></div>
        </div>

        {/* Status Pill */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md px-4 py-1.5 rounded-full text-white text-xs font-medium border border-white/10 z-30 text-center max-w-[90%] truncate shadow-lg">
          {alignmentStatus}
        </div>
      </div>

      {captured && (
        <button
          type="button"
          onClick={() => {
            isCapturingRef.current = false;
            stabilityTimerRef.current = 0;
            setCaptured(false);
            setPhoto(null);
            setIsProperlyCentered(false);
          }}
          className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition-all cursor-pointer"
        >
          🔄 Retake Scan
        </button>
      )}

      {showCaptured && photo && (
        <div className="flex flex-col items-center mt-2">
          <p className="text-xs text-gray-500 font-semibold mb-1">Cropped Face Scan:</p>
          <img
            src={photo}
            alt="captured"
            className="w-24 h-32 rounded-[50%] object-cover border-2 border-emerald-500 shadow-md bg-slate-900"
          />
        </div>
      )}
    </div>
  );
}

export default CameraCapture;