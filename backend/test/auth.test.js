const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../src/app");
const { pool } = require("../src/config/db");

describe("Auth / Users", () => {
  afterAll(async () => {
    if (!global.__PG_POOL_ENDED__) {
      global.__PG_POOL_ENDED__ = true;
      await pool.end();
    }
  });

  test("register then login returns token", async () => {
    const email = `u${Date.now()}@example.com`;
    const password = "password123";

    const reg = await request(app).post("/api/users/register").send({
      email,
      password,
    });
    expect(reg.statusCode).toBe(201);
    expect(reg.body).toHaveProperty("token");
    expect(reg.body.user.email).toBe(email);
    expect(reg.body.user.role).toBe("USER");

    const login = await request(app).post("/api/users/login").send({
      email,
      password,
    });
    expect(login.statusCode).toBe(200);
    expect(login.body).toHaveProperty("token");
    expect(login.body.user.email).toBe(email);
  });

  test("GET /api/users requires ADMIN", async () => {
    const email = `u${Date.now()}@example.com`;
    const password = "password123";

    const reg = await request(app).post("/api/users/register").send({
      email,
      password,
    });
    const token = reg.body.token;

    const res = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(403);
  });

  test("ADMIN can list users", async () => {
    const email = `admin${Date.now()}@example.com`;
    const password = "password123";
    const password_hash = await bcrypt.hash(password, 10);

    const ins = await pool.query(
      `INSERT INTO users (email, password_hash, role)
       VALUES ($1, $2, 'ADMIN')
       ON CONFLICT (email) DO UPDATE SET role='ADMIN'
       RETURNING id`,
      [email, password_hash]
    );
    expect(ins.rowCount).toBe(1);

    const login = await request(app).post("/api/users/login").send({
      email,
      password,
    });
    expect(login.statusCode).toBe(200);
    const token = login.body.token;

    const res = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("users");
    expect(Array.isArray(res.body.users)).toBe(true);
  });
});

