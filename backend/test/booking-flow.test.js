const request = require("supertest");
const app = require("../src/app");
const { pool } = require("../src/config/db");

describe("Booking flow", () => {
  let parkingId;
  let userId;

  beforeAll(async () => {
    // Ensure migrations have been applied before running tests
    // (You can run `npm run migrate` manually before tests for now)

    // Pick seeded parking
    const p = await pool.query(
      "SELECT id FROM parkings ORDER BY created_at DESC LIMIT 1"
    );
    parkingId = p.rows[0]?.id;

    // Create a test user (idempotent)
    const u = await pool.query(
      `INSERT INTO users (email, password_hash, role)
       VALUES ('test@example.com', 'x', 'USER')
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
       RETURNING id`
    );
    userId = u.rows[0].id;
  });

  afterAll(async () => {
    await pool.end();
  });

  test("availability returns available=true for empty window", async () => {
    const res = await request(app).get(
      `/api/parkings/${parkingId}/availability?start_at=2026-01-02T10:00:00Z&end_at=2026-01-02T11:00:00Z`
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("available");
  });

  test("quote returns a price", async () => {
    const res = await request(app).post("/api/bookings/quote").send({
      parking_id: parkingId,
      start_at: "2026-01-02T10:00:00Z",
      end_at: "2026-01-02T11:00:00Z",
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("price_pence");
  });

  test("create booking returns 201 and PENDING", async () => {
    const res = await request(app).post("/api/bookings").send({
      user_id: userId,
      parking_id: parkingId,
      start_at: "2026-01-03T10:00:00Z",
      end_at: "2026-01-03T11:00:00Z",
    });

    expect(res.statusCode).toBe(201);
    expect(res.body.booking.status).toBe("PENDING");
  });
  test("creating overlapping bookings exceeds capacity and returns 409", async () => {
    // Make capacity = 1 for this test
    const orig = await pool.query(
      "SELECT capacity FROM parkings WHERE id = $1",
      [parkingId]
    );
    const originalCapacity = orig.rows[0].capacity;

    await pool.query("UPDATE parkings SET capacity = 1 WHERE id = $1", [
      parkingId,
    ]);

    const start_at = "2026-01-05T10:00:00Z";
    const end_at = "2026-01-05T11:00:00Z";

    try {
      // Create first booking (should succeed)
      const first = await request(app)
        .post("/api/bookings")
        .send({ user_id: userId, parking_id: parkingId, start_at, end_at });

      expect(first.statusCode).toBe(201);

      // Create second overlapping booking (should fail)
      const second = await request(app)
        .post("/api/bookings")
        .send({ user_id: userId, parking_id: parkingId, start_at, end_at });

      expect(second.statusCode).toBe(409);
      expect(second.body).toHaveProperty("error");
    } finally {
      // Cleanup bookings created by this test window
      await pool.query(
        `DELETE FROM bookings
       WHERE parking_id = $1 AND start_at = $2 AND end_at = $3`,
        [parkingId, start_at, end_at]
      );

      // Restore original capacity
      await pool.query("UPDATE parkings SET capacity = $2 WHERE id = $1", [
        parkingId,
        originalCapacity,
      ]);
    }
  });
  test("cancel booking sets status CANCELLED", async () => {
    // create a booking to cancel
    const create = await request(app).post("/api/bookings").send({
      user_id: userId,
      parking_id: parkingId,
      start_at: "2026-01-06T10:00:00Z",
      end_at: "2026-01-06T11:00:00Z",
    });

    expect(create.statusCode).toBe(201);
    const bookingId = create.body.booking.id;

    // cancel it
    const cancel = await request(app).post(`/api/bookings/${bookingId}/cancel`);
    expect(cancel.statusCode).toBe(200);
    expect(cancel.body.booking.status).toBe("CANCELLED");

    // cancel again should be idempotent (still 200)
    const cancelAgain = await request(app).post(
      `/api/bookings/${bookingId}/cancel`
    );
    expect(cancelAgain.statusCode).toBe(409);
  });
  test("quote 60 minutes returns £2 (200 pence)", async () => {
    const res = await request(app).post("/api/bookings/quote").send({
      parking_id: parkingId,
      start_at: "2026-01-10T10:00:00Z",
      end_at: "2026-01-10T11:00:00Z",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.price_pence).toBe(200);
  });

  test("quote 240 minutes returns £3 (300 pence)", async () => {
    const res = await request(app).post("/api/bookings/quote").send({
      parking_id: parkingId,
      start_at: "2026-01-10T10:00:00Z",
      end_at: "2026-01-10T14:00:00Z",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.price_pence).toBe(300);
  });
  test("quote with invalid dates returns 400", async () => {
    const res = await request(app).post("/api/bookings/quote").send({
      parking_id: parkingId,
      start_at: "not-a-date",
      end_at: "2026-01-10T11:00:00Z",
    });

    expect(res.statusCode).toBe(400);
  });
  test("create booking with end before start returns 400", async () => {
    const res = await request(app).post("/api/bookings").send({
      user_id: userId,
      parking_id: parkingId,
      start_at: "2026-01-10T11:00:00Z",
      end_at: "2026-01-10T10:00:00Z",
    });

    expect(res.statusCode).toBe(400);
  });

  test("cancelled booking no longer consumes capacity", async () => {
    // Set capacity to 1 for deterministic behavior
    const orig = await pool.query(
      "SELECT capacity FROM parkings WHERE id = $1",
      [parkingId]
    );
    const originalCapacity = orig.rows[0].capacity;
    await pool.query("UPDATE parkings SET capacity = 1 WHERE id = $1", [
      parkingId,
    ]);

    const start_at = "2026-01-11T10:00:00Z";
    const end_at = "2026-01-11T11:00:00Z";

    try {
      // create booking #1
      const first = await request(app)
        .post("/api/bookings")
        .send({ user_id: userId, parking_id: parkingId, start_at, end_at });

      expect(first.statusCode).toBe(201);
      const bookingId = first.body.booking.id;

      // booking #2 overlapping should fail (capacity reached)
      const second = await request(app)
        .post("/api/bookings")
        .send({ user_id: userId, parking_id: parkingId, start_at, end_at });

      expect(second.statusCode).toBe(409);

      // cancel booking #1
      const cancel = await request(app).post(
        `/api/bookings/${bookingId}/cancel`
      );
      expect(cancel.statusCode).toBe(200);
      expect(cancel.body.booking.status).toBe("CANCELLED");

      // now booking #2 should succeed (capacity freed)
      const third = await request(app)
        .post("/api/bookings")
        .send({ user_id: userId, parking_id: parkingId, start_at, end_at });

      expect(third.statusCode).toBe(201);
    } finally {
      await pool.query(
        `DELETE FROM payments WHERE booking_id IN (
        SELECT id FROM bookings WHERE parking_id = $1 AND start_at = $2 AND end_at = $3
      )`,
        [parkingId, start_at, end_at]
      );
      await pool.query(
        `DELETE FROM bookings WHERE parking_id = $1 AND start_at = $2 AND end_at = $3`,
        [parkingId, start_at, end_at]
      );
      await pool.query("UPDATE parkings SET capacity = $2 WHERE id = $1", [
        parkingId,
        originalCapacity,
      ]);
    }
  });
});
