import L from "leaflet";
import "leaflet/dist/leaflet.css";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { fallbackParkings, fetchParkings } from "../api/parkingApi";
import ParkingCard from "../components/ParkingCard";
import ParkingCardSkeleton from "../components/ParkingCardSkeleton";

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
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [parkings, setParkings] = useState([]);
  const [selectedParking, setSelectedParking] = useState(null);
  const [mapCenter, setMapCenter] = useState([50.9097, -1.4044]); // Southampton default
  const [currentLocation, setCurrentLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [liveLoading, setLiveLoading] = useState(false);
  const [error, setError] = useState("");
  const [sortBy, setSortBy] = useState("recommended"); // recommended, cheapest, closest
  const [availabilityFilter, setAvailabilityFilter] = useState("all"); // all, available, fully_booked
  const [showFilters, setShowFilters] = useState(false);
  const filterRef = useRef(null);
  const [fromDateTime, setFromDateTime] = useState(() => {
    const now = new Date();
    // Round up to the next 5 minutes for cleaner display
    const minutes = now.getMinutes();
    const roundedMinutes = Math.ceil(minutes / 5) * 5;
    now.setMinutes(roundedMinutes, 0, 0);
    // If we rounded past the hour, move to next hour
    if (roundedMinutes >= 60) {
      now.setHours(now.getHours() + 1);
      now.setMinutes(0, 0, 0);
    }
    return now.toISOString().slice(0, 16);
  });
  const [untilDateTime, setUntilDateTime] = useState(() => {
    const now = new Date();
    // Round up to the next 5 minutes
    const minutes = now.getMinutes();
    const roundedMinutes = Math.ceil(minutes / 5) * 5;
    now.setMinutes(roundedMinutes, 0, 0);
    if (roundedMinutes >= 60) {
      now.setHours(now.getHours() + 1);
      now.setMinutes(0, 0, 0);
    }
    // Set to 4 hours from now
    now.setHours(now.getHours() + 4);
    return now.toISOString().slice(0, 16);
  });
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
    if (!parkings.length) return [];
    
    // First apply availability filter
    let filtered = [...parkings];
    
    if (availabilityFilter === "available") {
      filtered = filtered.filter((p) => p.available === true);
    } else if (availabilityFilter === "fully_booked") {
      filtered = filtered.filter((p) => p.available === false);
    }
    // "all" shows everything, no filtering needed
    
    // Then apply sorting
    let sorted = [...filtered];
    
    if (sortBy === "closest" && referencePoint && referencePoint.length === 2) {
      const [refLat, refLon] = referencePoint;
      sorted.sort((a, b) => {
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
    } else if (sortBy === "cheapest") {
      // Sort by price_pence if available, otherwise keep original order
      sorted.sort((a, b) => {
        const priceA = a.price_pence !== undefined && a.price_pence !== null 
          ? a.price_pence 
          : a.total_amount_pence !== undefined && a.total_amount_pence !== null
          ? a.total_amount_pence
          : Infinity;
        const priceB = b.price_pence !== undefined && b.price_pence !== null 
          ? b.price_pence 
          : b.total_amount_pence !== undefined && b.total_amount_pence !== null
          ? b.total_amount_pence
          : Infinity;
        return priceA - priceB;
      });
    }
    // "recommended" keeps original order
    
    return sorted;
  }, [parkings, sortBy, availabilityFilter, referencePoint]);

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
    const hasSearchParams = params.query || (params.lat && params.lon);
    
    // Include dates in the search if they're set
    const searchParams = {
      ...params,
      start_at: fromDateTime ? new Date(fromDateTime).toISOString() : undefined,
      end_at: untilDateTime ? new Date(untilDateTime).toISOString() : undefined,
    };
    
    if (!isLive) setLoading(true);
    if (isLive) setLiveLoading(true);
    if (!isLive) setError("");

    try {
      const { parkings: fetched } = await fetchParkings({ ...searchParams, signal });

      // If search returned no results but we had search params, fall back to showing all parkings
      if (!fetched.length && hasSearchParams && !isLive) {
        console.log("No results for search, loading all parkings instead");
        const { parkings: allParkings } = await fetchParkings({}, { signal });
        setParkings(allParkings.length > 0 ? allParkings : fetched);
        setError(""); // Don't show error, just show all parkings
      } else {
        setParkings(fetched);
        if (fetched.length > 0) {
          setError(""); // Clear error if we have results
        }
      }

      if (typeof params.lat === "number" && typeof params.lon === "number") {
        setMapCenter([params.lat, params.lon]);
      } else if (fetched[0]) {
        setMapCenter([fetched[0].latitude, fetched[0].longitude]);
      } else if (parkings[0]) {
        // If fetched is empty but we have existing parkings, keep current center
        setMapCenter([parkings[0].latitude, parkings[0].longitude]);
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

  // Reload parkings when dates change
  useEffect(() => {
    if (fromDateTime && untilDateTime) {
      loadParkings({}, { isLive: true });
    }
  }, [fromDateTime, untilDateTime]);

  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setShowFilters(false);
      }
    };

    if (showFilters) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showFilters]);

  // Live search as the user types (for text input)
  useEffect(() => {
    const trimmed = query.trim();
    
    const controller = new AbortController();
    const handle = setTimeout(() => {
      if (trimmed.length === 0) {
        // If search is cleared, load all parkings
        loadParkings({}, { isLive: true, signal: controller.signal });
      } else if (trimmed.length >= 2) {
        // Only search if at least 2 characters
        loadParkings(
          { query: trimmed },
          { isLive: true, signal: controller.signal }
        );
      } else {
        setLiveLoading(false);
      }
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

  const formatDateTime = (isoString) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    
    const timeStr = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    if (isToday) {
      return `Today at ${timeStr}`;
    }
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex flex-col h-screen bg-base-100">
      {/* Top Search Bar */}
      <div className="bg-base-100 border-b border-base-300 p-4">
        <div className="flex gap-3 items-center max-w-full">
          <div className="flex-1">
            <label className="text-xs text-base-content/70 mb-1 block">Park at</label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none">
                  <svg
                    className="w-4 h-4 text-base-content/50"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="m21 21-3.5-3.5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
                    />
                  </svg>
                </div>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search parkings by name or address"
                  className="input w-full input-bordered border-primary pl-10"
                />
              </div>
              <button
                type="button"
                onClick={handleUseLocation}
                className="btn btn-outline btn-sm self-end"
                title="Use my current location"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          </div>
          
          <div className="w-48">
            <label className="text-xs text-base-content/70 mb-1 block">From</label>
            <input
              type="datetime-local"
              value={fromDateTime}
              onChange={(e) => setFromDateTime(e.target.value)}
              className="input w-full input-bordered border-primary"
            />
          </div>
          
          <div className="w-48">
            <label className="text-xs text-base-content/70 mb-1 block">Until</label>
            <input
              type="datetime-local"
              value={untilDateTime}
              onChange={(e) => setUntilDateTime(e.target.value)}
              className="input w-full input-bordered border-primary"
            />
          </div>
        </div>
      </div>

      {/* Main Content: Sidebar + Map */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div className="lg:w-96 w-0 bg-base-100 border-r border-base-300 flex flex-col overflow-hidden">
          {/* Sorting Tabs */}
          <div className="flex items-center justify-between py-4  border-b border-base-300">
            <div className="tabs tabs-boxed">
              <button
                className={`tab ${sortBy === "recommended" ? "tab-active" : ""}`}
                onClick={() => setSortBy("recommended")}
              >
                Recommended
              </button>
              <button
                className={`tab ${sortBy === "cheapest" ? "tab-active" : ""}`}
                onClick={() => setSortBy("cheapest")}
              >
                Cheapest
              </button>
              <button
                className={`tab ${sortBy === "closest" ? "tab-active" : ""}`}
                onClick={() => setSortBy("closest")}
              >
                Closest
              </button>
            </div>
            <div className="relative" ref={filterRef}>
              <button 
                className="btn btn-ghost btn-sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                Filters
              </button>
              {showFilters && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-base-100 border border-base-300 rounded-lg shadow-lg z-10">
                  <div className="p-2">
                    <div className="text-xs font-semibold text-base-content/70 mb-2 px-2">Availability</div>
                    <div className="space-y-1">
                      <button
                        className={`btn btn-sm btn-ghost w-full justify-start ${availabilityFilter === "all" ? "btn-active" : ""}`}
                        onClick={() => {
                          setAvailabilityFilter("all");
                          setShowFilters(false);
                        }}
                      >
                        Show all
                      </button>
                      <button
                        className={`btn btn-sm btn-ghost w-full justify-start ${availabilityFilter === "available" ? "btn-active" : ""}`}
                        onClick={() => {
                          setAvailabilityFilter("available");
                          setShowFilters(false);
                        }}
                      >
                        Only with availability
                      </button>
                      <button
                        className={`btn btn-sm btn-ghost w-full justify-start ${availabilityFilter === "fully_booked" ? "btn-active" : ""}`}
                        onClick={() => {
                          setAvailabilityFilter("fully_booked");
                          setShowFilters(false);
                        }}
                      >
                        Only fully booked
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Parking List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-2 space-y-2">
                {[...Array(5)].map((_, i) => (
                  <ParkingCardSkeleton key={i} />
                ))}
              </div>
            ) : error ? (
              <div className="p-4 text-error text-sm">{error}</div>
            ) : sortedParkings.length === 0 ? (
              <div className="p-4 text-center text-base-content/70">No parkings found</div>
            ) : (
              <div className="p-2 space-y-2">
                {sortedParkings.map((parking) => (
                  <ParkingCard
                    key={parking.id}
                    parking={parking}
                    isSelected={selectedParking?.id === parking.id}
                    distanceMiles={distanceMiles}
                    onSelect={(p) => {
                      // Navigate to booking confirmation page
                      if (fromDateTime && untilDateTime) {
                        // Calculate duration from original selection
                        const originalStart = new Date(fromDateTime);
                        const originalEnd = new Date(untilDateTime);
                        const durationMs = originalEnd.getTime() - originalStart.getTime();
                        
                        // Set start to current time + 5 minutes (to avoid "past" validation errors)
                        // and maintain the same duration
                        const now = new Date();
                        const startAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes from now
                        const endAt = new Date(startAt.getTime() + durationMs);
                        
                        navigate(
                          `/book?parking_id=${p.id}&start_at=${encodeURIComponent(startAt.toISOString())}&end_at=${encodeURIComponent(endAt.toISOString())}`
                        );
                      } else {
                        // Just select for map view if no dates
                        setSelectedParking(p);
                        if (p.latitude && p.longitude) {
                          setMapCenter([p.latitude, p.longitude]);
                        }
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Map */}
        <div className="flex-1 relative">
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
                  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-red.png",
                  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
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
                <Popup className="parking-popup">
                  <div className="w-80 max-w-[90vw]">
                    <ParkingCard
                      parking={parking}
                      isSelected={selectedParking?.id === parking.id}
                      distanceMiles={distanceMiles}
                      onSelect={(p) => {
                        setSelectedParking(p);
                        if (p.latitude && p.longitude) {
                          setMapCenter([p.latitude, p.longitude]);
                        }
                      }}
                    />
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>

      {selectedParking && (
        <>
          
        </>
      )}
    </div>
  );
};

export default LandPage;
