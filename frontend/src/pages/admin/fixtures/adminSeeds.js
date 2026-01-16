const seeds = {
  users: [
    { id: "u1", email: "admin@ex.com", phone: "07123456789", role: "ADMIN" },
    { id: "u2", email: "owner@ex.com", phone: "07000000000", role: "OWNER" },
    { id: "u3", email: "user@ex.com", phone: "", role: "USER" },
  ],
  parkings: [
    { id: "p1", name: "Downtown Garage", address: "123 Main St", capacity: 120, currency: "GBP" },
    { id: "p2", name: "Airport Long Stay", address: "Airport Rd", capacity: 400, currency: "GBP" },
  ],
  ownerRegistrations: [
    { id: "or1", user_id: "u2", parking_id: "p1", status: "PENDING", created_at: "2024-11-01T10:00:00Z" },
    { id: "or2", user_id: "u2", parking_id: "p2", status: "PENDING", created_at: "2024-11-02T09:30:00Z" },
  ],
  summary: {
    bookings: 142,
    usersDelta: 3,
    ownersDelta: 1,
    parkingsDelta: 2,
    bookingsDelta: 8,
  },
};

export default seeds;

