import { useState } from "react";

export function useGeolocation() {
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState(null);

  async function saveLocation(position) {
    try {
      await fetch("http://localhost:3001/location", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(position),
      });
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

        await saveLocation(data);

        setIsLoading(false);
      },
      (error) => {
        console.error("Error:", error.message);
        setIsLoading(false);
      },
    );
  }

  return { getPosition, isLoading, position };
}
