import { useEffect, useRef, useState, useCallback } from "react";
import * as faceapi from "face-api.js";

function CameraCapture() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [photo, setPhoto] = useState(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [captured, setCaptured] = useState(false);

  const takePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    setPhoto(canvas.toDataURL("image/png"));
  }, []);

  // 🎥 Camera (Fixed Async Memory Leak)
  useEffect(() => {
    let activeStream = null;
    let isMounted = true;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        
        // If component unmounted while waiting for camera permissions, stop it immediately
        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        activeStream = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Camera access denied:", err);
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

  // 🧠 Models
  useEffect(() => {
    async function load() {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
        faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
      ]);
      setModelsLoaded(true);
    }
    load();
  }, []);

  // 🔁 Detection
  useEffect(() => {
    if (!modelsLoaded || captured) return;

    const interval = setInterval(async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.videoWidth === 0) return;

      const size = {
        width: video.videoWidth,
        height: video.videoHeight,
      };

      faceapi.matchDimensions(canvas, size);

      const detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks();

      const resized = faceapi.resizeResults(detections, size);

      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 🟢 Keep mesh
      faceapi.draw.drawFaceLandmarks(canvas, resized);

      if (resized.length === 1) {
        const det = resized[0];
        const box = det.detection.box;
        const landmarks = det.landmarks;

        // 📏 Relaxed face size
        const faceArea = box.width * box.height;
        const frameArea = video.videoWidth * video.videoHeight;
        const isCloseEnough = faceArea / frameArea > 0.12;

        // 🎯 Relaxed centering
        const centerX = video.videoWidth / 2;
        const faceCenterX = box.x + box.width / 2;
        const isCentered = Math.abs(centerX - faceCenterX) < 80;

        // 🧠 Relaxed eye alignment
        const leftEye = landmarks.getLeftEye();
        const rightEye = landmarks.getRightEye();

        const leftEyeY = leftEye.reduce((s, p) => s + p.y, 0) / leftEye.length;
        const rightEyeY = rightEye.reduce((s, p) => s + p.y, 0) / rightEye.length;

        const eyeDiff = Math.abs(leftEyeY - rightEyeY);
        const isStraight = eyeDiff < 12;

        const isAligned = isCloseEnough && isCentered && isStraight;

        // 🎨 Box color
        ctx.strokeStyle = isAligned ? "lime" : "red";
        ctx.lineWidth = 3;
        ctx.strokeRect(box.x, box.y, box.width, box.height);

        // 🧪 Debug text (Shifted slightly so it doesn't clip top edge)
        ctx.fillStyle = "yellow";
        ctx.font = "16px Arial";
        ctx.fillText(
          `Size:${isCloseEnough} Center:${isCentered} Straight:${isStraight}`,
          10,
          30 
        );

        // 📸 Capture
        if (isAligned && !captured) {
          setCaptured(true);
          setTimeout(() => takePhoto(), 700);
        }
      }
    }, 300);

    return () => clearInterval(interval);
  }, [modelsLoaded, captured, takePhoto]);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Fixed: Replaced invalid w-120 h-100 with valid Tailwind sizing */}
      <div className="relative w-96 h-72 max-w-full">
        {!modelsLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white z-10 rounded-lg">
            Loading AI Models...
          </div>
        )}

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover rounded-lg"
        />

        {/* Fixed: Added object-cover and rounded-lg to canvas so it perfectly matches video cropping */}
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full object-cover pointer-events-none rounded-lg"
        />
      </div>

      {photo && (
        <img
          src={photo}
          alt="captured"
          className="w-40 h-40 rounded-full object-cover border-4 border-green-500"
        />
      )}
    </div>
  );
}

export default CameraCapture;