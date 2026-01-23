const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api/";

/**
 * Lookup vehicle details from registration number
 */
export async function lookupVehicle({ registration, authHeader = {} }) {
  if (!authHeader.Authorization) {
    throw new Error("Missing bearer token");
  }

  const response = await fetch(`${API_BASE_URL}vehicle/lookup`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader },
    body: JSON.stringify({ registration }),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error || `Request failed with status ${response.status}`);
  }

  return body;
}
