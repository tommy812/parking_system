const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api/";

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


