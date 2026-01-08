import L from "leaflet";
import "leaflet/dist/leaflet.css";
import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { fallbackParkings, fetchParkings } from "../api/parkingApi";

// Provide default marker icons when assets are not served from /node_modules
const defaultIcon = new L.Icon({
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

const RecenterMap = ({ center }) => {
  const map = useMap();

  useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);

  return null;
};

const LandPage = () => {
  const [query, setQuery] = useState("");
  const [parkings, setParkings] = useState([]);
  const [selectedParking, setSelectedParking] = useState(null);
  const [mapCenter, setMapCenter] = useState([51.5074, -0.1278]); // London default
  const [currentLocation, setCurrentLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [liveLoading, setLiveLoading] = useState(false);
  const [error, setError] = useState("");
  const referencePoint = currentLocation ?? mapCenter;

  const toRad = (deg) => (deg * Math.PI) / 180;
  const haversineKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const sortedParkings = useMemo(() => {
    if (!referencePoint || referencePoint.length !== 2) return parkings;
    const [refLat, refLon] = referencePoint;

    return [...parkings].sort((a, b) => {
      const distA =
        Number.isFinite(a.latitude) && Number.isFinite(a.longitude)
          ? haversineKm(refLat, refLon, a.latitude, a.longitude)
          : Infinity;
      const distB =
        Number.isFinite(b.latitude) && Number.isFinite(b.longitude)
          ? haversineKm(refLat, refLon, b.latitude, b.longitude)
          : Infinity;
      return distA - distB;
    });
  }, [parkings, referencePoint]);

  const distanceMiles = (parking) => {
    if (
      !referencePoint ||
      referencePoint.length !== 2 ||
      !Number.isFinite(parking.latitude) ||
      !Number.isFinite(parking.longitude)
    ) {
      return null;
    }
    const [refLat, refLon] = referencePoint;
    const km = haversineKm(refLat, refLon, parking.latitude, parking.longitude);
    return km * 0.621371; // miles
  };

  const loadParkings = async (params = {}, options = {}) => {
    const { isLive = false, signal } = options;
    if (!isLive) setLoading(true);
    if (isLive) setLiveLoading(true);
    if (!isLive) setError("");

    try {
      const { parkings: fetched } = await fetchParkings({ ...params, signal });

      if (!fetched.length) {
        setError("No parking spots found for that search.");
      }

      setParkings(fetched);

      if (typeof params.lat === "number" && typeof params.lon === "number") {
        setMapCenter([params.lat, params.lon]);
      } else if (fetched[0]) {
        setMapCenter([fetched[0].latitude, fetched[0].longitude]);
      }
    } catch (err) {
      console.error(err);
      setError(
        err.message ||
          "Unable to reach the parking API. Showing sample locations instead."
      );

      if (!parkings.length && fallbackParkings.length) {
        setParkings(fallbackParkings);
        setMapCenter([
          fallbackParkings[0].latitude,
          fallbackParkings[0].longitude,
        ]);
      }
    } finally {
      if (!isLive) setLoading(false);
      if (isLive) setLiveLoading(false);
    }
  };

  useEffect(() => {
    loadParkings();
  }, []);

  // Live search as the user types
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setLiveLoading(false);
      return;
    }

    const controller = new AbortController();
    const handle = setTimeout(() => {
      loadParkings(
        { query: trimmed },
        { isLive: true, signal: controller.signal }
      );
    }, 350);

    return () => {
      controller.abort();
      clearTimeout(handle);
    };
  }, [query]);

  const handleSearch = (event) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed && currentLocation) {
      loadParkings({ lat: currentLocation[0], lon: currentLocation[1] });
      return;
    }
    loadParkings(trimmed ? { query: trimmed } : {});
  };

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setMapCenter([latitude, longitude]);
        setCurrentLocation([latitude, longitude]);
        loadParkings({ lat: latitude, lon: longitude });
      },
      (geoError) => {
        console.error(geoError);
        setError("Unable to retrieve your current location.");
      }
    );
  };

  return (
    <div className=" bg-base-200 ">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-2 gap-10 items-start">
          <div className="space-y-6">
            <div>
              <p className="text-sm uppercase tracking-wide text-neutral">
                Parking made simple
              </p>
              <h1 className="mt-2 text-4xl font-bold text-heading">
                Find and book a parking spot near you
              </h1>
              <p className="mt-3 text-body">
                Search by place or use your current location. See nearby
                parkings on the map and book directly from the marker card.
              </p>
            </div>

            <form onSubmit={handleSearch} className="space-y-3">
              <div className="relative">
                <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none">
                  <svg
                    className="w-4 h-4 text-body"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeWidth="2"
                      d="m21 21-3.5-3.5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
                    />
                  </svg>
                </div>
                <input
                  type="search"
                  id="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="block w-full p-3 ps-9 bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-full focus:ring-primary focus:border-primary shadow-xs placeholder:text-body"
                  placeholder="Search a location or parking name"
                  required
                />
                <button
                  type="submit"
                  className="absolute end-1.5 bottom-1.5 text-white bg-primary hover:bg-primary/80 border border-transparent focus:ring-4 focus:ring-primary shadow-xs font-medium leading-5 rounded-full text-xs px-4 py-1.5 focus:outline-none"
                >
                  {loading ? "Searching..." : "Search"}
                </button>
                {query.trim().length >= 2 && sortedParkings.length > 0 && (
                  <ul className="absolute z-20 mt-2 w-full bg-base-100 border border-default-medium rounded-xl shadow-lg max-h-60 overflow-y-auto">
                    {sortedParkings.map((parking) => (
                      <li
                        key={parking.id}
                        className="px-4 py-2 hover:bg-base-200 cursor-pointer flex justify-between gap-3"
                        onMouseDown={() => {
                          setSelectedParking(parking);
                          setMapCenter([parking.latitude, parking.longitude]);
                        }}
                      >
                        <span className="text-sm">
                          {parking.name}
                          {parking.address ? ` — ${parking.address}` : ""}
                        </span>
                        {liveLoading && <span className="text-xs text-neutral">…</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <button
                type="button"
                onClick={handleUseLocation}
                className="btn btn-outline btn-sm"
              >
                Use my current location
              </button>
              {error && (
                <p className="text-sm text-error bg-error/10 p-2 rounded-lg">
                  {error}
                </p>
              )}
            </form>

            <div className="space-y-2">
              <p className="text-sm text-neutral">
                Closest 3 parkings {currentLocation ? "near you" : "near this area"}
              </p>
              <div className="grid grid-cols-1 gap-3">
                {sortedParkings.slice(0, 3).map((parking) => (
                  <div
                    key={parking.id}
                    className="p-3 rounded-xl bg-base-100 shadow-sm border border-default-medium flex justify-between items-center"
                  >
                    <div>
                      <p className="font-semibold">{parking.name}</p>
                      <p className="text-sm text-body">
                        {parking.address || "Address not provided"}
                      </p>
                      {Number.isFinite(distanceMiles(parking)) && (
                        <p className="text-xs text-neutral">
                          {distanceMiles(parking) < 10
                            ? `${distanceMiles(parking).toFixed(1)} mi away`
                            : `${Math.round(distanceMiles(parking))} mi away`}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setSelectedParking(parking)}
                    >
                      Open
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="w-full h-full rounded-2xl overflow-hidden shadow-xl border border-default-medium bg-base-100">
            <MapContainer
              center={mapCenter}
              zoom={13}
              scrollWheelZoom
              className="h-full w-full z-0"
            >
              <RecenterMap center={mapCenter} />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {currentLocation && (
                <Marker
                  position={currentLocation}
                  icon={new L.Icon({
                    iconUrl:
                      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-red.png",
                    shadowUrl:
                      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                  })}
                >
                  <Popup>Your current location</Popup>
                </Marker>
              )}
              {sortedParkings.map((parking) => (
                <Marker
                  key={parking.id}
                  position={[parking.latitude, parking.longitude]}
                  eventHandlers={{
                    click: () => setSelectedParking(parking),
                  }}
                >
                  <Popup>
                    <div className="space-y-1">
                      <p className="font-semibold">{parking.name}</p>
                      <p className="text-xs text-body">
                        {parking.address || "Address not provided"}
                      </p>
                      {Number.isFinite(distanceMiles(parking)) && (
                        <p className="text-xs text-neutral">
                          {distanceMiles(parking) < 10
                            ? `${distanceMiles(parking).toFixed(1)} mi away`
                            : `${Math.round(distanceMiles(parking))} mi away`}
                        </p>
                      )}
                      <button
                        type="button"
                        className="btn btn-primary btn-xs mt-2"
                        onClick={() => setSelectedParking(parking)}
                      >
                        View details
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>
      </div>

      {selectedParking && (
        <>
          <div className="modal modal-open">
            <div className="modal-box max-w-lg">
              <figure className="h-48 w-full overflow-hidden rounded-xl mb-4">
                <img
                  src={
                    selectedParking.imageUrl ||
                    "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1200&q=80"
                  }
                  alt={selectedParking.name}
                  className="w-full h-full object-cover"
                />
              </figure>
              <h3 className="font-bold text-xl">{selectedParking.name}</h3>
              <p className="text-sm text-body mt-1">
                {selectedParking.address || "Address not provided"}
              </p>
              <div className="modal-action">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setSelectedParking(null)}
                >
                  Close
                </button>
                <button type="button" className="btn btn-primary">
                  Book
                </button>
              </div>
            </div>
          </div>
          <div
            className="modal-backdrop bg-black/40"
            onClick={() => setSelectedParking(null)}
          />
        </>
      )}
    </div>
  );
};

export default LandPage;
