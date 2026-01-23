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
  imageUrl: parking.image_url ?? parking.imageUrl ?? parking.image ?? parking.photoUrl,
  price_pence: parking.price_pence,
  booked_count: parking.booked_count,
  available: parking.available,
  capacity: parking.capacity,
  currency: parking.currency,
});

/**
 * Fetch parking locations from the API. Expects the API to return either:
 * - { parkings: Array<Parking> }
 * - Array<Parking>
 * Parking objects should include latitude and longitude properties.
 * @param {Object} options
 * @param {AbortSignal} [options.signal] optional abort signal for live search
 */
export async function fetchParkings({ query, lat, lon, start_at, end_at, signal } = {}) {
  const params = new URLSearchParams();
  
  // Use /search endpoint if we have dates or need advanced features
  const useSearchEndpoint = start_at && end_at;
  const baseUrl = useSearchEndpoint ? `${API_BASE_URL}parkings/search` : `${API_BASE_URL}parkings`;
  
  if (query) {
    params.set(useSearchEndpoint ? "q" : "query", query);
  }
  if (typeof lat === "number" && typeof lon === "number") {
    if (useSearchEndpoint) {
      params.set("lat", lat);
      params.set("lng", lon);
      params.set("radius_km", "50"); // Default 50km radius
    } else {
      params.set("lat", lat);
      params.set("lon", lon);
    }
  }
  if (start_at && end_at) {
    params.set("start_at", start_at);
    params.set("end_at", end_at);
  }

  const url = `${baseUrl}${params.toString() ? `?${params.toString()}` : ""}`;

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

export async function fetchNumberofParkings({ authHeader = {} } = {}) {
  const response = await fetch(`${API_BASE_URL}parkings/number`, {
    headers: { "Content-Type": "application/json", ...authHeader },
  });
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return response.json();
}

export async function fetchAdminParkings({
  page = 1,
  pageSize = 12,
  search = "",
  orderBy = "latest",
  filter = "all",
  authHeader = {},
} = {}) {
  const params = new URLSearchParams();

  params.set("page", page);
  params.set("page_size", pageSize);

  if (search) params.set("query", search);
  if (filter && filter !== "all") params.set("filter", filter);
  if (orderBy) params.set("order_by", orderBy); // 👈 HERE

  const response = await fetch(
    `${API_BASE_URL}parkings?${params.toString()}`,
    { headers: { "Content-Type": "application/json", ...authHeader } }
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error || `Failed to fetch parkings (${response.status})`);
  }

  return response.json();
}



export async function upsertParking({ form, authHeader = {} }) {
  const toNumberOrNull = (value) => {
    if (value === "" || value === null || value === undefined) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };
  const payload = {
    name: form.name,
    address: form.address || null,
    timezone: form.timezone || "Europe/London",
    capacity: toNumberOrNull(form.capacity),
    currency: form.currency || "GBP",
    image_url: form.image_url || null,
    owner_user_id: form.owner_user_id || null,
    is_active: form.is_active === undefined ? undefined : Boolean(form.is_active),
    lat: toNumberOrNull(form.lat),
    lng: toNumberOrNull(form.lng),
    open_start_minute_utc: toNumberOrNull(form.open_start_minute_utc),
    open_end_minute_utc: toNumberOrNull(form.open_end_minute_utc),
    min_booking_minutes: toNumberOrNull(form.min_booking_minutes),
    max_booking_minutes: toNumberOrNull(form.max_booking_minutes),
    buffer_minutes: toNumberOrNull(form.buffer_minutes),
  };

  if (form.id) {
    const res = await fetch(`${API_BASE_URL}parkings/${form.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    if (!res.ok) {
      throw new Error(body?.error || "Failed to update parking");
    }
    return body.parking || body;
  }

  const res = await fetch(`${API_BASE_URL}parkings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error || "Failed to create parking");
  }
  return body.parking || body;
}

export async function fetchParkingPricing({ parkingId, authHeader = {} }) {
  const response = await fetch(`${API_BASE_URL}parkings/${parkingId}/pricing`, {
    headers: { "Content-Type": "application/json", ...authHeader },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error || `Failed to load pricing tiers (${response.status})`);
  }
  return response.json();
}

export async function createPricingTier({ parkingId, tier, authHeader = {} }) {
  const response = await fetch(`${API_BASE_URL}parkings/${parkingId}/pricing`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader },
    body: JSON.stringify(tier),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error || `Failed to create pricing tier (${response.status})`);
  }
  return body.tier || body;
}

export async function updatePricingTier({ parkingId, tierId, tier, authHeader = {} }) {
  const response = await fetch(`${API_BASE_URL}parkings/${parkingId}/pricing/${tierId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeader },
    body: JSON.stringify(tier),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error || `Failed to update pricing tier (${response.status})`);
  }
  return body.tier || body;
}

export async function deactivatePricingTier({ parkingId, tierId, authHeader = {} }) {
  const response = await fetch(`${API_BASE_URL}parkings/${parkingId}/pricing/${tierId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", ...authHeader },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error || `Failed to deactivate pricing tier (${response.status})`);
  }
  return body.tier || body;
}

export async function fetchParkingBlackouts({ parkingId, authHeader = {} }) {
  const response = await fetch(`${API_BASE_URL}parkings/${parkingId}/blackouts`, {
    headers: { "Content-Type": "application/json", ...authHeader },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error || `Failed to load blackouts (${response.status})`);
  }
  return body.blackouts || [];
}

export async function createParkingBlackout({ parkingId, blackout, authHeader = {} }) {
  const response = await fetch(`${API_BASE_URL}parkings/${parkingId}/blackouts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader },
    body: JSON.stringify(blackout),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error || `Failed to create blackout (${response.status})`);
  }
  return body.blackout || body;
}

export async function updateParkingBlackout({ parkingId, blackoutId, blackout, authHeader = {} }) {
  const response = await fetch(`${API_BASE_URL}parkings/${parkingId}/blackouts/${blackoutId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeader },
    body: JSON.stringify(blackout),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error || `Failed to update blackout (${response.status})`);
  }
  return body.blackout || body;
}

export async function deleteParkingBlackout({ parkingId, blackoutId, authHeader = {} }) {
  const response = await fetch(`${API_BASE_URL}parkings/${parkingId}/blackouts/${blackoutId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", ...authHeader },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error || `Failed to delete blackout (${response.status})`);
  }
  return body.blackout || body;
}
