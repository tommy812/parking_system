const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../src/app");
const { pool } = require("../src/config/db");

describe("Parking owner authorization", () => {
  let parkingId;
  let ownerToken;
  let userToken;

  beforeAll(async () => {
    const p = await pool.query("SELECT id FROM parkings ORDER BY created_at DESC LIMIT 1");
    parkingId = p.rows[0]?.id;
    if (!parkingId) throw new Error("No parkings found. Seed a parking first.");

    // Create OWNER + USER accounts and login
    const ownerEmail = `owner${Date.now()}@example.com`;
    const userEmail = `user${Date.now()}@example.com`;
    const password = "password123";
    const hash = await bcrypt.hash(password, 10);

    const ownerIns = await pool.query(
      `INSERT INTO users (email, password_hash, role)
       VALUES ($1, $2, 'OWNER')
       RETURNING id`,
      [ownerEmail, hash]
    );
    const ownerId = ownerIns.rows[0].id;

    await pool.query(
      `INSERT INTO users (email, password_hash, role)
       VALUES ($1, $2, 'USER')
       ON CONFLICT (email) DO NOTHING`,
      [userEmail, hash]
    );

    await pool.query(`UPDATE parkings SET owner_user_id = $2 WHERE id = $1`, [
      parkingId,
      ownerId,
    ]);

    const ownerLogin = await request(app).post("/api/users/login").send({
      email: ownerEmail,
      password,
    });
    expect(ownerLogin.statusCode).toBe(200);
    ownerToken = ownerLogin.body.token;

    const userReg = await request(app).post("/api/users/register").send({
      email: userEmail,
      password,
    });
    // If email exists already, register returns 409; fallback to login.
    if (userReg.statusCode === 201) {
      userToken = userReg.body.token;
    } else {
      const userLogin = await request(app).post("/api/users/login").send({
        email: userEmail,
        password,
      });
      expect(userLogin.statusCode).toBe(200);
      userToken = userLogin.body.token;
    }
  });

  afterAll(async () => {
    if (!global.__PG_POOL_ENDED__) {
      global.__PG_POOL_ENDED__ = true;
      await pool.end();
    }
  });

  test("OWNER can update their parking capacity", async () => {
    const res = await request(app)
      .put(`/api/parkings/${parkingId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ capacity: 7 });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("parking");
    expect(res.body.parking.capacity).toBe(7);
  });

  test("non-OWNER cannot update parking (403)", async () => {
    const res = await request(app)
      .put(`/api/parkings/${parkingId}`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ capacity: 8 });

    expect(res.statusCode).toBe(403);
  });

  test("OWNER can create a pricing tier for their parking", async () => {
    const res = await request(app)
      .post(`/api/parkings/${parkingId}/pricing`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ max_minutes: 120, price_pence: 250, currency: "GBP" });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("tier");
    expect(res.body.tier.max_minutes).toBe(120);
    expect(res.body.tier.price_pence).toBe(250);

    // cleanup
    await pool.query("DELETE FROM pricing_tiers WHERE id = $1", [res.body.tier.id]);
  });
});

