const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../src/app");
const { pool } = require("../src/config/db");

describe("Owner registration approval flow", () => {
  let adminToken;

  beforeAll(async () => {
    // create an admin user + login
    const email = `admin${Date.now()}@example.com`;
    const password = "password123";
    const password_hash = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO users (email, password_hash, role, is_approved)
       VALUES ($1, $2, 'ADMIN', true)
       ON CONFLICT (email) DO UPDATE SET role='ADMIN', is_approved=true`,
      [email, password_hash]
    );

    const login = await request(app).post("/api/users/login").send({ email, password });
    expect(login.statusCode).toBe(200);
    adminToken = login.body.token;
  });

  afterAll(async () => {
    if (!global.__PG_POOL_ENDED__) {
      global.__PG_POOL_ENDED__ = true;
      await pool.end();
    }
  });

  test("OWNER register creates pending request; cannot login until approved; admin approves", async () => {
    const ownerEmail = `owner${Date.now()}@example.com`;
    const ownerPassword = "password123";

    const reg = await request(app).post("/api/users/register").send({
      email: ownerEmail,
      password: ownerPassword,
      role: "OWNER",
      parking: {
        name: "Pending Owner Parking",
        capacity: 10,
        currency: "GBP",
      },
    });

    expect(reg.statusCode).toBe(201);
    expect(reg.body.status).toBe("PENDING_APPROVAL");
    expect(reg.body).toHaveProperty("owner_registration");
    expect(reg.body.owner_registration.status).toBe("PENDING");
    expect(reg.body).not.toHaveProperty("token");

    const reqId = reg.body.owner_registration.id;
    const parkingId = reg.body.parking.id;

    const ownerLoginBefore = await request(app).post("/api/users/login").send({
      email: ownerEmail,
      password: ownerPassword,
    });
    expect(ownerLoginBefore.statusCode).toBe(403);

    // admin can list pending requests
    const list = await request(app)
      .get("/api/users/owner-requests?status=PENDING")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(list.statusCode).toBe(200);

    const approve = await request(app)
      .post(`/api/users/owner-requests/${reqId}/approve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ note: "Looks good" });
    expect(approve.statusCode).toBe(200);
    expect(approve.body.owner_registration.status).toBe("APPROVED");

    const ownerLoginAfter = await request(app).post("/api/users/login").send({
      email: ownerEmail,
      password: ownerPassword,
    });
    expect(ownerLoginAfter.statusCode).toBe(200);

    const ownerToken = ownerLoginAfter.body.token;

    // now owner can update their parking
    const upd = await request(app)
      .put(`/api/parkings/${parkingId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ capacity: 12 });
    expect(upd.statusCode).toBe(200);
    expect(upd.body.parking.capacity).toBe(12);
  });
});

