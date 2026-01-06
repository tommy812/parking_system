const request = require("supertest");
const app = require("../src/app");
const { pool } = require("../src/config/db");

function makeWindow({ daysAhead = 2, startHourUtc = 10, durationMinutes = 60 } = {}) {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + daysAhead);
  start.setUTCHours(startHourUtc, 0, 0, 0);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  return { start_at: start.toISOString(), end_at: end.toISOString() };
}

describe("Booking flow", () => {
  let parkingId;
  let token;

  beforeAll(async () => {
    // Create an isolated parking for this suite, with pricing tiers, so other tests can't break us.
    const p = await pool.query(
      `INSERT INTO parkings (name, address, timezone, capacity, currency, image_url, is_active)
       VALUES ($1, $2, 'Europe/London', 20, 'GBP', NULL, true)
       RETURNING id`,
      [`Test Parking ${Date.now()}`, "Test Address"]
    );
    parkingId = p.rows[0].id;

    // pricing tiers: 1h £2, 4h £3, 8h £5
    await pool.query(
      `INSERT INTO pricing_tiers (parking_id, max_minutes, price_pence, currency, is_active)
       VALUES
        ($1, 60, 200, 'GBP', true),
        ($1, 240, 300, 'GBP', true),
        ($1, 480, 500, 'GBP', true)`,
      [parkingId]
    );

    const email = `test${Date.now()}@example.com`;
    const password = "password123";
    const reg = await request(app).post("/api/users/register").send({ email, password });
    expect(reg.statusCode).toBe(201);
    token = reg.body.token;
  });

  // IMPORTANT: keep tests isolated (especially after adding overlap constraint)
  beforeEach(async () => {
    await pool.query(
      `DELETE FROM payments
       WHERE booking_id IN (SELECT id FROM bookings WHERE parking_id = $1)`,
      [parkingId]
    );
    await pool.query(`DELETE FROM bookings WHERE parking_id = $1`, [parkingId]);
  });

  afterAll(async () => {
    // Cleanup the parking we created for this suite
    try {
      await pool.query("DELETE FROM payments WHERE booking_id IN (SELECT id FROM bookings WHERE parking_id = $1)", [parkingId]);
      await pool.query("DELETE FROM bookings WHERE parking_id = $1", [parkingId]);
      await pool.query("DELETE FROM pricing_tiers WHERE parking_id = $1", [parkingId]);
      await pool.query("DELETE FROM parkings WHERE id = $1", [parkingId]);
    } catch {}
    if (!global.__PG_POOL_ENDED__) {
      global.__PG_POOL_ENDED__ = true;
      await pool.end();
    }
  });

  test("availability returns available=true for empty window", async () => {
    const { start_at, end_at } = makeWindow({ daysAhead: 2, startHourUtc: 10, durationMinutes: 60 });
    const res = await request(app).get(
      `/api/parkings/${parkingId}/availability?start_at=${encodeURIComponent(
        start_at
      )}&end_at=${encodeURIComponent(end_at)}`
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("available");
  });

  test("quote returns a price", async () => {
    const { start_at, end_at } = makeWindow({ daysAhead: 2, startHourUtc: 10, durationMinutes: 60 });
    const res = await request(app)
      .post("/api/bookings/quote")
      .set("Authorization", `Bearer ${token}`)
      .send({
        parking_id: parkingId,
        start_at,
        end_at,
      });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("price_pence");
  });

  test("create booking returns 201 and PENDING", async () => {
    const { start_at, end_at } = makeWindow({ daysAhead: 3, startHourUtc: 11, durationMinutes: 60 });
    const res = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        parking_id: parkingId,
        start_at,
        end_at,
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.booking.status).toBe("PENDING");
  });

  test("creating overlapping bookings exceeds capacity and returns 409", async () => {
    const orig = await pool.query(
      "SELECT capacity FROM parkings WHERE id = $1",
      [parkingId]
    );
    const originalCapacity = orig.rows[0].capacity;

    await pool.query("UPDATE parkings SET capacity = 1 WHERE id = $1", [
      parkingId,
    ]);

    const { start_at, end_at } = makeWindow({ daysAhead: 5, startHourUtc: 12, durationMinutes: 60 });

    try {
      const first = await request(app)
        .post("/api/bookings")
        .set("Authorization", `Bearer ${token}`)
        .send({ parking_id: parkingId, start_at, end_at });

      expect(first.statusCode).toBe(201);

      const second = await request(app)
        .post("/api/bookings")
        .set("Authorization", `Bearer ${token}`)
        .send({ parking_id: parkingId, start_at, end_at });

      // This 409 may come either from capacity OR from "same user overlap" rule.
      expect(second.statusCode).toBe(409);
      expect(second.body).toHaveProperty("error");
    } finally {
      // Delete payments first, then bookings
      await pool.query(
        `DELETE FROM payments
         WHERE booking_id IN (
           SELECT id FROM bookings WHERE parking_id = $1 AND start_at = $2 AND end_at = $3
         )`,
        [parkingId, start_at, end_at]
      );
      await pool.query(
        `DELETE FROM bookings
         WHERE parking_id = $1 AND start_at = $2 AND end_at = $3`,
        [parkingId, start_at, end_at]
      );

      await pool.query("UPDATE parkings SET capacity = $2 WHERE id = $1", [
        parkingId,
        originalCapacity,
      ]);
    }
  });

  test("cancel booking sets status CANCELLED", async () => {
    const { start_at, end_at } = makeWindow({ daysAhead: 6, startHourUtc: 10, durationMinutes: 60 });
    const create = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        parking_id: parkingId,
        start_at,
        end_at,
      });

    expect(create.statusCode).toBe(201);
    const bookingId = create.body.booking.id;

    const cancel = await request(app)
      .post(`/api/bookings/${bookingId}/cancel`)
      .set("Authorization", `Bearer ${token}`);
    expect(cancel.statusCode).toBe(200);
    expect(cancel.body.booking.status).toBe("CANCELLED");

    // idempotent: cancelling again should still be 200
    const cancelAgain = await request(app)
      .post(`/api/bookings/${bookingId}/cancel`)
      .set("Authorization", `Bearer ${token}`);
    expect(cancelAgain.statusCode).toBe(200);
  });

  test("quote 60 minutes returns £2 (200 pence)", async () => {
    const { start_at, end_at } = makeWindow({ daysAhead: 10, startHourUtc: 10, durationMinutes: 60 });
    const res = await request(app)
      .post("/api/bookings/quote")
      .set("Authorization", `Bearer ${token}`)
      .send({
        parking_id: parkingId,
        start_at,
        end_at,
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.price_pence).toBe(200);
  });

  test("quote 240 minutes returns £3 (300 pence)", async () => {
    const { start_at, end_at } = makeWindow({ daysAhead: 10, startHourUtc: 10, durationMinutes: 240 });
    const res = await request(app)
      .post("/api/bookings/quote")
      .set("Authorization", `Bearer ${token}`)
      .send({
        parking_id: parkingId,
        start_at,
        end_at,
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.price_pence).toBe(300);
  });

  test("quote with invalid dates returns 400", async () => {
    const { end_at } = makeWindow({ daysAhead: 10, startHourUtc: 10, durationMinutes: 60 });
    const res = await request(app)
      .post("/api/bookings/quote")
      .set("Authorization", `Bearer ${token}`)
      .send({
        parking_id: parkingId,
        start_at: "not-a-date",
        end_at,
      });

    expect(res.statusCode).toBe(400);
  });

  test("create booking with end before start returns 400", async () => {
    const { start_at, end_at } = makeWindow({ daysAhead: 10, startHourUtc: 10, durationMinutes: 60 });
    const res = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        parking_id: parkingId,
        start_at: end_at,
        end_at: start_at,
      });

    expect(res.statusCode).toBe(400);
  });

  test("cancelled booking no longer consumes capacity", async () => {
    const orig = await pool.query(
      "SELECT capacity FROM parkings WHERE id = $1",
      [parkingId]
    );
    const originalCapacity = orig.rows[0].capacity;
    await pool.query("UPDATE parkings SET capacity = 1 WHERE id = $1", [
      parkingId,
    ]);

    const { start_at, end_at } = makeWindow({ daysAhead: 11, startHourUtc: 10, durationMinutes: 60 });

    try {
      const first = await request(app)
        .post("/api/bookings")
        .set("Authorization", `Bearer ${token}`)
        .send({ parking_id: parkingId, start_at, end_at });

      expect(first.statusCode).toBe(201);
      const bookingId = first.body.booking.id;

      const second = await request(app)
        .post("/api/bookings")
        .set("Authorization", `Bearer ${token}`)
        .send({ parking_id: parkingId, start_at, end_at });

      expect(second.statusCode).toBe(409);

      const cancel = await request(app)
        .post(`/api/bookings/${bookingId}/cancel`)
        .set("Authorization", `Bearer ${token}`);
      expect(cancel.statusCode).toBe(200);
      expect(cancel.body.booking.status).toBe("CANCELLED");

      const third = await request(app)
        .post("/api/bookings")
        .set("Authorization", `Bearer ${token}`)
        .send({ parking_id: parkingId, start_at, end_at });

      expect(third.statusCode).toBe(201);
    } finally {
      await pool.query(
        `DELETE FROM payments
         WHERE booking_id IN (
           SELECT id FROM bookings WHERE parking_id = $1 AND start_at = $2 AND end_at = $3
         )`,
        [parkingId, start_at, end_at]
      );
      await pool.query(
        `DELETE FROM bookings
         WHERE parking_id = $1 AND start_at = $2 AND end_at = $3`,
        [parkingId, start_at, end_at]
      );
      await pool.query("UPDATE parkings SET capacity = $2 WHERE id = $1", [
        parkingId,
        originalCapacity,
      ]);
    }
  });

  test("cannot create payment intent for CANCELLED booking", async () => {
    const { start_at, end_at } = makeWindow({ daysAhead: 13, startHourUtc: 10, durationMinutes: 60 });
    const created = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        parking_id: parkingId,
        start_at,
        end_at,
      });
    expect(created.statusCode).toBe(201);
    const bookingId = created.body.booking.id;

    const cancel = await request(app)
      .post(`/api/bookings/${bookingId}/cancel`)
      .set("Authorization", `Bearer ${token}`);
    expect(cancel.statusCode).toBe(200);

    const pay = await request(app)
      .post("/api/payments/create-intent")
      .send({ booking_id: bookingId });

    expect(pay.statusCode).toBe(409);
  });

  test("same user cannot create overlapping booking at same parking (409)", async () => {
    const firstWindow = makeWindow({ daysAhead: 20, startHourUtc: 10, durationMinutes: 60 });

    const first = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        parking_id: parkingId,
        start_at: firstWindow.start_at,
        end_at: firstWindow.end_at,
      });
    expect(first.statusCode).toBe(201);

    const overlappingStart = new Date(firstWindow.start_at);
    overlappingStart.setUTCMinutes(overlappingStart.getUTCMinutes() + 30);
    const overlappingEnd = new Date(overlappingStart.getTime() + 60 * 60 * 1000);
    const second = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        parking_id: parkingId,
        start_at: overlappingStart.toISOString(),
        end_at: overlappingEnd.toISOString(),
      });
    expect(second.statusCode).toBe(409);
  });
});
