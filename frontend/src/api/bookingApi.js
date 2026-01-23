const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api/";

/**
 * Get a booking quote for a parking and time range
 */
export async function getBookingQuote({ parking_id, start_at, end_at, authHeader = {} }) {
  const response = await fetch(`${API_BASE_URL}bookings/quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader },
    body: JSON.stringify({ parking_id, start_at, end_at }),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error || `Failed to get quote (${response.status})`);
  }

  return body;
}

/**
 * Create a new booking
 */
export async function createBooking({ parking_id, start_at, end_at, authHeader = {} }) {
  if (!authHeader.Authorization) {
    throw new Error("Missing bearer token");
  }

  const response = await fetch(`${API_BASE_URL}bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader },
    body: JSON.stringify({ parking_id, start_at, end_at }),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error || `Failed to create booking (${response.status})`);
  }

  // Backend returns { booking: {...}, ... } so return the full response
  return body;
}

/**
 * Fetch a single booking by ID
 */
export async function fetchBooking({ booking_id, authHeader = {} }) {
  if (!authHeader.Authorization) {
    throw new Error("Missing bearer token");
  }

  const response = await fetch(`${API_BASE_URL}bookings/${booking_id}`, {
    headers: { "Content-Type": "application/json", ...authHeader },
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error || `Failed to fetch booking (${response.status})`);
  }

  return body.booking || body;
}

/**
 * Fetch bookings for the admin view with pagination and optional search/order/filter.
 */
export async function fetchAdminBookings({
  page = 1,
  pageSize = 12,
  search = "",
  orderBy = "",
  filter = "",
  authHeader = {},
} = {}) {
  const params = new URLSearchParams();
  if (page) params.set("page", page);
  if (pageSize) params.set("page_size", pageSize);
  if (search) params.set("query", search);
  if (orderBy) params.set("order_by", orderBy);
  if (filter) params.set("filter", filter);

  const response = await fetch(
    `${API_BASE_URL}bookings${params.toString() ? `?${params.toString()}` : ""}`,
    { headers: { "Content-Type": "application/json", ...authHeader } }
  );

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error || `Failed to load bookings (${response.status})`);
  }

  const list = Array.isArray(body) ? body : body?.bookings || [];
  return { bookings: list, total: body?.total ?? null };
}

export async function fetchNumberOfBookings({ authHeader = {} } = {}) {
  const response = await fetch(`${API_BASE_URL}bookings/number`, {
    headers: { "Content-Type": "application/json", ...authHeader },
  });
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return response.json();
}

/**
 * Fetch bookings for the current user with pagination, search, and filters
 */
export async function fetchMyBookings({
  page = 1,
  pageSize = 20,
  search = "",
  orderBy = "latest",
  filter = "all",
  authHeader = {},
} = {}) {
  if (!authHeader.Authorization) {
    throw new Error("Missing bearer token");
  }

  const params = new URLSearchParams();
  if (page) params.set("page", page);
  if (pageSize) params.set("page_size", pageSize);
  if (search) params.set("query", search);
  if (orderBy) params.set("order_by", orderBy);
  if (filter && filter !== "all") params.set("filter", filter);

  const response = await fetch(
    `${API_BASE_URL}bookings/mine${params.toString() ? `?${params.toString()}` : ""}`,
    {
      headers: { "Content-Type": "application/json", ...authHeader },
    }
  );

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error || `Failed to fetch bookings (${response.status})`);
  }

  return {
    bookings: body.bookings || [],
    total: body.total ?? null,
    page: body.page ?? page,
    page_size: body.page_size ?? pageSize,
  };
}

/**
 * Cancel a booking
 */
export async function cancelBooking({ booking_id, authHeader = {} } = {}) {
  if (!authHeader.Authorization) {
    throw new Error("Missing bearer token");
  }

  const response = await fetch(`${API_BASE_URL}bookings/${booking_id}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader },
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error || `Failed to cancel booking (${response.status})`);
  }

  return body.booking || body;
}
