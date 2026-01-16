const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api/";

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
