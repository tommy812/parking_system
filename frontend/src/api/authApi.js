const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";

export const login = async (email, password) => {
    const response = await fetch(`${API_BASE_URL}users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    return response.json();
  };

export const register = async (payload) => {
  const response = await fetch(`${API_BASE_URL}users/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return response.json();
};

export const checkEmailExists = async (email) => {
  const response = await fetch(`${API_BASE_URL}users/check-email-exists`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return response.json();
};

export const logout = async () => {
    const response = await fetch(`${API_BASE_URL}users/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    return response.json();
}