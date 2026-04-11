import { useGeolocation } from "../hooks/useGeolocation";

function Location() {
  const { getPosition, isLoading, position } = useGeolocation();

 

  return (
    <div className="w-full h-screen flex items-center justify-center">
      <div className="w-100 h-60 bg-linear-to-r from-indigo-500 to-blue-500 flex flex-col items-center justify-evenly p-3">
        <h1 className="text-white text-2xl font-medium">Geolocation Fetch</h1>

        <button
          className="bg-white px-5 py-2 rounded-[5px] cursor-pointer"
          onClick={getPosition}
        >
          {!isLoading ? "Fetch" : "Fetching..."}
        </button>

        {position && (
          <p className="text-white">
            Latitude: {position.lat} <br />
            Longitude: {position.lng}
          </p>
        )}
      </div>
    </div>
  );
}

export default Location;
