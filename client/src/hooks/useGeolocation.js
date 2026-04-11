import { useState } from "react";

export function useGeolocation() {
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState(null);
  const [status, setStatus] = useState(null);

  async function sendLocation(position) {
    try {
      const res = await fetch("http://127.0.0.1:5000/location-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(position),
      });
      const data = await res.json();
      return data;
    } catch (err) {
      console.error("Failed to save:", err);
    }
  }

  function getPosition() {
    setIsLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const data = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setPosition(data);
        const result = await sendLocation(data);
        if (result) setStatus(result);

        setIsLoading(false);
      },
      (error) => {
        console.error("Error:", error.message);
        setIsLoading(false);
      },
    );
  }

  return { getPosition, isLoading, position, status };
}
