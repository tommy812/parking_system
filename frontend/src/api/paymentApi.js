const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api/";

/**
 * Get Stripe publishable key
 */
export async function getStripeConfig() {
  const response = await fetch(`${API_BASE_URL}stripe/config`);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return response.json();
}

/**
 * Create payment intent for a booking
 */
export async function createPaymentIntent({ booking_id, authHeader = {} }) {
  if (!authHeader.Authorization) {
    throw new Error("Missing bearer token");
  }

  const response = await fetch(`${API_BASE_URL}payments/create-intent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader },
    body: JSON.stringify({ booking_id }),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error || `Request failed with status ${response.status}`);
  }

  return body;
}

/**
 * Sync payment status (check if payment succeeded)
 */
export async function syncPaymentStatus({ booking_id, authHeader = {} }) {
  if (!authHeader.Authorization) {
    throw new Error("Missing bearer token");
  }

  const response = await fetch(`${API_BASE_URL}bookings/${booking_id}/sync-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader },
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error || `Request failed with status ${response.status}`);
  }

  return body;
}
