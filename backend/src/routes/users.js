const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { pool } = require("../config/db");
const { env } = require("../config/env");
const { requireAuth, requireRole } = require("../middleware/auth");

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeVehicleReg(reg) {
  const v = String(reg || "").trim();
  if (!v) return null;
  // Keep storage simple but consistent: uppercase, no spaces
  return v.toUpperCase().replace(/\s+/g, "");
}

function normalizeRole(role) {
  const r = String(role || "").trim().toUpperCase();
  if (!r) return "USER";
  return r;
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}

router.post("/check-email-exists", async (req, res, next) => {
  const email = normalizeEmail(req.body.email);
  if (!email) return res.status(400).json({ error: "email is required" });
  const r = await pool.query(
    `SELECT id FROM users WHERE email = $1`,
    [email]
  );
  if (r.rowCount > 0) {
    return res.json({ exists: true });
  } else {
    return res.json({ exists: false });
  }
});

// GET /api/users (ADMIN only) -> list users
router.get("/", requireAuth, requireRole(["ADMIN"]), async (req, res, next) => {
  try {
    const r = await pool.query(
      `SELECT id, email, role, phone, vehicle_reg, vehicle_model, vehicle_color, vehicle_year, created_at
       FROM users
       ORDER BY created_at DESC`
    );
    res.json({ users: r.rows });
  } catch (e) {
    next(e);
  }
});

// GET /api/users/me -> current user
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const r = await pool.query(
      `SELECT id, email, role, phone, vehicle_reg, vehicle_model, vehicle_color, vehicle_year, created_at
       FROM users
       WHERE id = $1`,
      [req.user.id]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "User not found" });
    res.json({ user: r.rows[0] });
  } catch (e) {
    next(e);
  }
});

// POST /api/users/register
// body:
// - USER:  { email, password, role:'USER', phone?, vehicle_*? }
// - OWNER: { email, password, role:'OWNER', phone?, vehicle_*?, parking: { name, address?, timezone?, capacity, currency?, image_url? } }
router.post("/register", async (req, res, next) => {
  const client = await pool.connect();
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");
    const role = normalizeRole(req.body.role);
    const phone = req.body.phone ? String(req.body.phone) : null;

    const vehicle_reg = normalizeVehicleReg(req.body.vehicle_reg);
    const vehicle_model = req.body.vehicle_model ? String(req.body.vehicle_model).trim() : null;
    const vehicle_color = req.body.vehicle_color ? String(req.body.vehicle_color).trim() : null;
    const vehicle_year =
      req.body.vehicle_year === undefined || req.body.vehicle_year === null || req.body.vehicle_year === ""
        ? null
        : Number(req.body.vehicle_year);

    if (vehicle_year !== null && !Number.isInteger(vehicle_year)) {
      return res.status(400).json({ error: "vehicle_year must be an integer" });
    }

    if (!email) return res.status(400).json({ error: "email is required" });
    if (!password || password.length < 8) {
      return res.status(400).json({ error: "password must be at least 8 characters" });
    }
    if (!["USER", "OWNER"].includes(role)) {
      return res.status(400).json({ error: "role must be USER or OWNER" });
    }

    const password_hash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);

    await client.query("BEGIN");

    if (role === "OWNER") {
      const parking = req.body.parking || {};
      const name = parking.name ? String(parking.name).trim() : "";
      const address = parking.address ? String(parking.address).trim() : null;
      const timezone = parking.timezone ? String(parking.timezone).trim() : "Europe/London";
      const capacity = Number(parking.capacity);
      const currency = parking.currency ? String(parking.currency).toUpperCase() : "GBP";
      const image_url = parking.image_url ? String(parking.image_url).trim() : null;

      if (!name) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "parking.name is required for OWNER registration" });
      }
      if (!Number.isInteger(capacity) || capacity <= 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "parking.capacity must be a positive integer" });
      }

      const uRes = await client.query(
        `INSERT INTO users (email, password_hash, role, is_approved, phone, vehicle_reg, vehicle_model, vehicle_color, vehicle_year)
         VALUES ($1, $2, 'OWNER', false, $3, $4, $5, $6, $7)
         RETURNING id, email, role, is_approved, phone, vehicle_reg, vehicle_model, vehicle_color, vehicle_year, created_at`,
        [email, password_hash, phone, vehicle_reg, vehicle_model, vehicle_color, vehicle_year]
      );

      const user = uRes.rows[0];

      const pRes = await client.query(
        `INSERT INTO parkings (name, address, timezone, capacity, currency, image_url, owner_user_id, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, false)
         RETURNING id, name, address, timezone, capacity, currency, image_url, owner_user_id, is_active, created_at`,
        [name, address, timezone, capacity, currency, image_url, user.id]
      );

      const parkingRow = pRes.rows[0];

      const oRes = await client.query(
        `INSERT INTO owner_registrations (user_id, parking_id, status)
         VALUES ($1, $2, 'PENDING')
         RETURNING id, status, created_at`,
        [user.id, parkingRow.id]
      );

      await client.query("COMMIT");

      // No token until admin approves.
      return res.status(201).json({
        status: "PENDING_APPROVAL",
        user,
        parking: parkingRow,
        owner_registration: oRes.rows[0],
      });
    }

    // USER registration (auto-approved)
    const r = await client.query(
      `INSERT INTO users (email, password_hash, role, is_approved, phone, vehicle_reg, vehicle_model, vehicle_color, vehicle_year)
       VALUES ($1, $2, 'USER', true, $3, $4, $5, $6, $7)
       RETURNING id, email, role, is_approved, phone, vehicle_reg, vehicle_model, vehicle_color, vehicle_year, created_at`,
      [email, password_hash, phone, vehicle_reg, vehicle_model, vehicle_color, vehicle_year]
    );

    const user = r.rows[0];
    const token = signToken(user);

    await client.query("COMMIT");
    return res.status(201).json({ user, token });
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    // Unique email violation
    if (e && e.code === "23505") {
      return res.status(409).json({ error: "Email already registered" });
    }
    next(e);
  } finally {
    client.release();
  }
});

// POST /api/users/login
// body: { email, password }
router.post("/login", async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");

    if (!email) return res.status(400).json({ error: "email is required" });
    if (!password) return res.status(400).json({ error: "password is required" });

    const r = await pool.query(
      `SELECT id, email, role, is_approved, phone, created_at, password_hash
       FROM users
       WHERE email = $1`,
      [email]
    );

    if (r.rowCount === 0) return res.status(401).json({ error: "Invalid credentials" });

    const userRow = r.rows[0];
    const ok = await bcrypt.compare(password, userRow.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    if (userRow.role === "OWNER" && userRow.is_approved !== true) {
      return res.status(403).json({ error: "Owner account pending admin approval" });
    }

    const user = {
      id: userRow.id,
      email: userRow.email,
      role: userRow.role,
      is_approved: userRow.is_approved,
      phone: userRow.phone,
      created_at: userRow.created_at,
    };

    const token = signToken(user);
    return res.json({ user, token });
  } catch (e) {
    next(e);
  }
});

// POST /api/users/logout
// Stateless JWT logout: client should delete token.
router.post("/logout", (req, res) => {
  res.json({ ok: true });
});

// PUT /api/users/me/vehicle
// body: { vehicle_reg?, vehicle_model?, vehicle_color?, vehicle_year? }
router.put("/me/vehicle", requireAuth, async (req, res, next) => {
  try {
    const vehicle_reg =
      req.body.vehicle_reg === undefined ? undefined : normalizeVehicleReg(req.body.vehicle_reg);
    const vehicle_model =
      req.body.vehicle_model === undefined ? undefined : String(req.body.vehicle_model).trim() || null;
    const vehicle_color =
      req.body.vehicle_color === undefined ? undefined : String(req.body.vehicle_color).trim() || null;
    const vehicle_year =
      req.body.vehicle_year === undefined
        ? undefined
        : req.body.vehicle_year === null || req.body.vehicle_year === ""
          ? null
          : Number(req.body.vehicle_year);

    if (vehicle_year !== undefined && vehicle_year !== null && !Number.isInteger(vehicle_year)) {
      return res.status(400).json({ error: "vehicle_year must be an integer" });
    }

    const r = await pool.query(
      `UPDATE users
       SET vehicle_reg = COALESCE($2, vehicle_reg),
           vehicle_model = COALESCE($3, vehicle_model),
           vehicle_color = COALESCE($4, vehicle_color),
           vehicle_year = COALESCE($5, vehicle_year)
       WHERE id = $1
       RETURNING id, email, role, phone, vehicle_reg, vehicle_model, vehicle_color, vehicle_year, created_at`,
      [
        req.user.id,
        vehicle_reg === undefined ? null : vehicle_reg,
        vehicle_model === undefined ? null : vehicle_model,
        vehicle_color === undefined ? null : vehicle_color,
        vehicle_year === undefined ? null : vehicle_year,
      ]
    );

    // Note: COALESCE with NULL makes it impossible to "clear" a field via null currently.
    // If you want clearing support, we can switch to dynamic SQL per-field.

    if (r.rowCount === 0) return res.status(404).json({ error: "User not found" });
    res.json({ user: r.rows[0] });
  } catch (e) {
    // year constraint etc.
    if (e && e.code === "23514") {
      return res.status(400).json({ error: "Invalid vehicle fields" });
    }
    next(e);
  }
});

// ADMIN: list owner registration requests
// GET /api/users/owner-requests?status=PENDING|APPROVED|REJECTED
router.get(
  "/owner-requests",
  requireAuth,
  requireRole(["ADMIN"]),
  async (req, res, next) => {
    try {
      const status = req.query.status ? String(req.query.status).toUpperCase() : "PENDING";
      const allowed = ["PENDING", "APPROVED", "REJECTED"];
      if (!allowed.includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      const r = await pool.query(
        `SELECT orq.id,
                orq.status,
                orq.created_at,
                orq.reviewed_at,
                orq.note,
                u.id AS user_id,
                u.email AS user_email,
                u.role AS user_role,
                u.is_approved AS user_is_approved,
                p.id AS parking_id,
                p.name AS parking_name,
                p.address AS parking_address,
                p.capacity AS parking_capacity,
                p.currency AS parking_currency,
                p.is_active AS parking_is_active,
                p.owner_user_id AS parking_owner_user_id
         FROM owner_registrations orq
         JOIN users u ON u.id = orq.user_id
         JOIN parkings p ON p.id = orq.parking_id
         WHERE orq.status = $1
         ORDER BY orq.created_at ASC`,
        [status]
      );

      res.json({ owner_registrations: r.rows });
    } catch (e) {
      next(e);
    }
  }
);

// ADMIN: approve owner registration
// POST /api/users/owner-requests/:id/approve
router.post(
  "/owner-requests/:id/approve",
  requireAuth,
  requireRole(["ADMIN"]),
  async (req, res, next) => {
    const client = await pool.connect();
    try {
      const { id } = req.params;
      const note = req.body?.note ? String(req.body.note) : null;

      await client.query("BEGIN");

      const r = await client.query(
        `SELECT id, user_id, parking_id, status
         FROM owner_registrations
         WHERE id = $1
         FOR UPDATE`,
        [id]
      );
      if (r.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Owner request not found" });
      }
      if (r.rows[0].status !== "PENDING") {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: `Request is not pending (status=${r.rows[0].status})` });
      }

      const { user_id, parking_id } = r.rows[0];

      await client.query(
        `UPDATE users
         SET is_approved = true
         WHERE id = $1`,
        [user_id]
      );

      await client.query(
        `UPDATE parkings
         SET is_active = true
         WHERE id = $1`,
        [parking_id]
      );

      const upd = await client.query(
        `UPDATE owner_registrations
         SET status = 'APPROVED',
             reviewed_by = $2,
             reviewed_at = now(),
             note = COALESCE($3, note)
         WHERE id = $1
         RETURNING id, status, created_at, reviewed_at, note, user_id, parking_id`,
        [id, req.user.id, note]
      );

      await client.query("COMMIT");
      res.json({ owner_registration: upd.rows[0] });
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {}
      next(e);
    } finally {
      client.release();
    }
  }
);

// ADMIN: reject owner registration
// POST /api/users/owner-requests/:id/reject
router.post(
  "/owner-requests/:id/reject",
  requireAuth,
  requireRole(["ADMIN"]),
  async (req, res, next) => {
    const client = await pool.connect();
    try {
      const { id } = req.params;
      const note = req.body?.note ? String(req.body.note) : null;

      await client.query("BEGIN");

      const r = await client.query(
        `SELECT id, user_id, parking_id, status
         FROM owner_registrations
         WHERE id = $1
         FOR UPDATE`,
        [id]
      );
      if (r.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Owner request not found" });
      }
      if (r.rows[0].status !== "PENDING") {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: `Request is not pending (status=${r.rows[0].status})` });
      }

      // Keep user as OWNER but not approved; keep parking inactive.
      const upd = await client.query(
        `UPDATE owner_registrations
         SET status = 'REJECTED',
             reviewed_by = $2,
             reviewed_at = now(),
             note = COALESCE($3, note)
         WHERE id = $1
         RETURNING id, status, created_at, reviewed_at, note, user_id, parking_id`,
        [id, req.user.id, note]
      );

      await client.query("COMMIT");
      res.json({ owner_registration: upd.rows[0] });
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {}
      next(e);
    } finally {
      client.release();
    }
  }
);

module.exports = router;
