const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api/";

export const fallbackParkings = [
  {
    id: "sample-1",
    name: "Central Station Garage",
    latitude: 51.505,
    longitude: -0.09,
    address: "5 Station Rd, London",
    imageUrl:
      "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=1200&q=80",
  },
  { 
    id: "sample-2",
    name: "Riverside Parking",
    latitude: 51.5079,
    longitude: -0.0877,
    address: "21 Thames Walk, London",
    imageUrl:
      "https://images.unsplash.com/photo-1502877828070-33b167ad6860?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "sample-3",
    name: "River Parking",
    latitude: 51.5079,
    longitude: -0.0877,
    address: "21 Thames Walk, London",
    imageUrl:
      "https://images.unsplash.com/photo-1502877828070-33b167ad6860?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "sample4",
    name: "River Parking",
    latitude: 51.5079,
    longitude: -0.0877,
    address: "21 Thames Walk, London",
    imageUrl:
      "https://images.unsplash.com/photo-1502877828070-33b167ad6860?auto=format&fit=crop&w=1200&q=80",
  }
];

const normalizeParking = (parking, idx) => ({
  id: parking.id ?? parking.parkingId ?? `parking-${idx}`,
  name: parking.name ?? parking.title ?? "Parking spot",
  latitude:
    parking.latitude ??
    parking.lat ??
    parking.coords?.lat ??
    parking.location?.lat ??
    0,
  longitude:
    parking.longitude ??
    parking.lon ??
    parking.lng ??
    parking.coords?.lng ??
    parking.location?.lng ??
    0,
  address: parking.address ?? parking.locationName ?? parking.addressLine,
  imageUrl: parking.imageUrl ?? parking.image ?? parking.photoUrl,
});

/**
 * Fetch parking locations from the API. Expects the API to return either:
 * - { parkings: Array<Parking> }
 * - Array<Parking>
 * Parking objects should include latitude and longitude properties.
 * @param {Object} options
 * @param {AbortSignal} [options.signal] optional abort signal for live search
 */
export async function fetchParkings({ query, lat, lon, signal } = {}) {
  const params = new URLSearchParams();
  if (query) params.set("query", query);
  if (typeof lat === "number" && typeof lon === "number") {
    params.set("lat", lat);
    params.set("lon", lon);
  }

  const url = `${API_BASE_URL}/parkings${
    params.toString() ? `?${params.toString()}` : ""
  }`;

  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const body = await response.json();
  const rawList = Array.isArray(body) ? body : body?.parkings ?? [];

  const normalized = rawList
    .map(normalizeParking)
    .filter(
      (item) =>
        Number.isFinite(item.latitude) && Number.isFinite(item.longitude)
    );

  return { parkings: normalized };
}

