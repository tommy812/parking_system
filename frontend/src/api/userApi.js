const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api/";

/**
 * Fetch current user profile
 */
export async function fetchCurrentUser({ authHeader = {} } = {}) {
  if (!authHeader.Authorization) {
    throw new Error("Missing bearer token");
  }

  const response = await fetch(`${API_BASE_URL}users/me`, {
    headers: { "Content-Type": "application/json", ...authHeader },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error || `Request failed with status ${response.status}`);
  }

  const body = await response.json();
  return body.user;
}

/**
 * Update user profile (first name, last name, phone, address)
 */
export async function updateProfile({ first_name, last_name, phone, address, authHeader = {} }) {
  if (!authHeader.Authorization) {
    throw new Error("Missing bearer token");
  }

  const response = await fetch(`${API_BASE_URL}users/me`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeader },
    body: JSON.stringify({
      first_name,
      last_name,
      phone,
      address,
    }),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error || `Request failed with status ${response.status}`);
  }

  return body.user;
}

/**
 * Update vehicle details
 */
export async function updateVehicle({ vehicle_reg, vehicle_model, vehicle_color, vehicle_year, authHeader = {} }) {
  if (!authHeader.Authorization) {
    throw new Error("Missing bearer token");
  }

  const response = await fetch(`${API_BASE_URL}users/me/vehicle`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeader },
    body: JSON.stringify({
      vehicle_reg,
      vehicle_model,
      vehicle_color,
      vehicle_year,
    }),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error || `Request failed with status ${response.status}`);
  }

  return body.user;
}

export async function fetchNumberOfUsers({ authHeader = {} } = {}) {
  const response = await fetch(`${API_BASE_URL}users/numberUsers`, {
    headers: { "Content-Type": "application/json", ...authHeader },
  });
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return response.json();
}

export async function fetchNumberOfOwners({ authHeader = {} } = {}) {
  const response = await fetch(`${API_BASE_URL}users/numberOwners`, {
    headers: { "Content-Type": "application/json", ...authHeader },
  });
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return response.json();
}

/**
 * Fetch users for the admin view with pagination, search, and filters
 */
export async function fetchAdminUsers({
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
    `${API_BASE_URL}users${params.toString() ? `?${params.toString()}` : ""}`,
    {
      headers: { "Content-Type": "application/json", ...authHeader },
    }
  );

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error || `Failed to load users (${response.status})`);
  }

  return {
    users: body.users || [],
    total: body.total ?? null,
    page: body.page ?? page,
    page_size: body.page_size ?? pageSize,
  };
}
