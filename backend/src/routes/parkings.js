const express = require("express");
const router = express.Router();
const { pool } = require("../config/db");
const { requireAuth, requireRole } = require("../middleware/auth");

async function requireParkingOwner(req, res, next) {
  try {
    const { id } = req.params;
    const r = await pool.query(
      `SELECT id, owner_user_id, is_active
       FROM parkings
       WHERE id = $1`,
      [id]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Parking not found" });
    const parking = r.rows[0];

    // ADMIN is a superuser
    if (req.user.role !== "ADMIN") {
      if (req.user.role !== "OWNER") {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (req.user.is_approved !== true) {
        return res.status(403).json({ error: "Owner account pending admin approval" });
      }
      if (!parking.owner_user_id || parking.owner_user_id !== req.user.id) {
        return res.status(403).json({ error: "You do not own this parking" });
      }
    }

    req.parking = parking;
    return next();
  } catch (e) {
    return next(e);
  }
}

// POST /api/parkings -> create a parking (OWNER or ADMIN)
router.post("/", requireAuth, requireRole(["OWNER", "ADMIN"]), async (req, res, next) => {
  try {
    if (req.user.role === "OWNER" && req.user.is_approved !== true) {
      return res.status(403).json({ error: "Owner account pending admin approval" });
    }

    const { name, address, timezone, capacity, currency, image_url } = req.body;

    if (!name) return res.status(400).json({ error: "name is required" });
    if (!capacity || !Number.isInteger(Number(capacity)) || Number(capacity) <= 0) {
      return res.status(400).json({ error: "capacity must be a positive integer" });
    }

    const r = await pool.query(
      `INSERT INTO parkings (name, address, timezone, capacity, currency, image_url, owner_user_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)
       RETURNING id, name, address, timezone, capacity, currency, image_url, owner_user_id, is_active, created_at`,
      [
        name,
        address || null,
        timezone || "Europe/London",
        Number(capacity),
        currency || "GBP",
        image_url || null,
        req.user.role === "ADMIN" ? (req.body.owner_user_id || null) : req.user.id,
      ]
    );
    res.status(201).json({ parking: r.rows[0] });
  } catch (e) {
    next(e);
  }
});


// GET /api/parkings  -> list parkings
router.get("/", async (req, res, next) => {
  try {
    const r = await pool.query(
      `SELECT id, name, address, timezone, capacity, currency, image_url, owner_user_id, created_at
       FROM parkings
       WHERE is_active = true
       ORDER BY created_at DESC`
    );
    res.json(r.rows);
  } catch (e) {
    next(e);
  }
});

// GET /api/parkings/mine -> list current owner's parkings (OWNER or ADMIN)
router.get("/mine", requireAuth, requireRole(["OWNER", "ADMIN"]), async (req, res, next) => {
  try {
    if (req.user.role === "OWNER" && req.user.is_approved !== true) {
      return res.status(403).json({ error: "Owner account pending admin approval" });
    }

    const r =
      req.user.role === "ADMIN"
        ? await pool.query(
            `SELECT id, name, address, timezone, capacity, currency, image_url, owner_user_id, is_active, created_at
             FROM parkings
             ORDER BY created_at DESC`
          )
        : await pool.query(
            `SELECT id, name, address, timezone, capacity, currency, image_url, owner_user_id, is_active, created_at
             FROM parkings
             WHERE owner_user_id = $1
             ORDER BY created_at DESC`,
            [req.user.id]
          );

    res.json({ parkings: r.rows });
  } catch (e) {
    next(e);
  }
});

// GET /api/parkings/:id -> get a parking
router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const r = await pool.query(
      `SELECT id, name, address, timezone, capacity, currency, image_url, owner_user_id, created_at
       FROM parkings
       WHERE id = $1 AND is_active = true`,
      [id]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Parking not found" });
    res.json(r.rows[0]);
  } catch (e) {
    next(e);
  }
});

// PUT /api/parkings/:id -> update a parking (OWNER only, must own parking)
router.put(
  "/:id",
  requireAuth,
  requireRole(["OWNER", "ADMIN"]),
  requireParkingOwner,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { name, address, timezone, capacity, currency, image_url } = req.body;

      if (capacity !== undefined) {
        const c = Number(capacity);
        if (!Number.isInteger(c) || c <= 0) {
          return res.status(400).json({ error: "capacity must be a positive integer" });
        }
      }

      const r = await pool.query(
        `UPDATE parkings
         SET name = COALESCE($2, name),
             address = COALESCE($3, address),
             timezone = COALESCE($4, timezone),
             capacity = COALESCE($5, capacity),
             currency = COALESCE($6, currency),
             image_url = COALESCE($7, image_url)
         WHERE id = $1
         RETURNING id, name, address, timezone, capacity, currency, image_url, owner_user_id, created_at`,
        [
          id,
          name ?? null,
          address ?? null,
          timezone ?? null,
          capacity === undefined ? null : Number(capacity),
          currency ?? null,
          image_url ?? null,
        ]
      );

      res.json({ parking: r.rows[0] });
    } catch (e) {
      next(e);
    }
  }
);


// GET /api/parkings/:id/pricing -> pricing tiers for a parking
router
  .route("/:id/pricing")
  // public read
  .get(async (req, res, next) => {
    try {
      const { id } = req.params;
      const r = await pool.query(
        `SELECT id, max_minutes, price_pence, currency, is_active, created_at
         FROM pricing_tiers
         WHERE parking_id = $1
         ORDER BY max_minutes ASC`,
        [id]
      );
      res.json(r.rows);
    } catch (e) {
      next(e);
    }
  })
  // owner write
  .post(requireAuth, requireRole(["OWNER", "ADMIN"]), requireParkingOwner, async (req, res, next) => {
    try {
      const { id } = req.params;
      const max_minutes = Number(req.body.max_minutes);
      const price_pence = Number(req.body.price_pence);
      const currency = req.body.currency ? String(req.body.currency).toUpperCase() : "GBP";

      if (!Number.isInteger(max_minutes) || max_minutes <= 0) {
        return res.status(400).json({ error: "max_minutes must be a positive integer" });
      }
      if (!Number.isInteger(price_pence) || price_pence < 0) {
        return res.status(400).json({ error: "price_pence must be a non-negative integer" });
      }

      const r = await pool.query(
        `INSERT INTO pricing_tiers (parking_id, max_minutes, price_pence, currency, is_active)
         VALUES ($1, $2, $3, $4, true)
         RETURNING id, parking_id, max_minutes, price_pence, currency, is_active, created_at`,
        [id, max_minutes, price_pence, currency]
      );
      return res.status(201).json({ tier: r.rows[0] });
    } catch (e) {
      if (e && e.code === "23505") {
        return res.status(409).json({ error: "A tier with that max_minutes already exists" });
      }
      next(e);
    }
  });

// PUT /api/parkings/:id/pricing/:tierId -> update a pricing tier (OWNER only, must own parking)
router.put(
  "/:id/pricing/:tierId",
  requireAuth,
  requireRole(["OWNER", "ADMIN"]),
  requireParkingOwner,
  async (req, res, next) => {
    try {
      const { id, tierId } = req.params;
      const price_pence =
        req.body.price_pence === undefined ? undefined : Number(req.body.price_pence);
      const currency =
        req.body.currency === undefined ? undefined : String(req.body.currency).toUpperCase();
      const is_active = req.body.is_active === undefined ? undefined : Boolean(req.body.is_active);

      if (price_pence !== undefined && (!Number.isInteger(price_pence) || price_pence < 0)) {
        return res.status(400).json({ error: "price_pence must be a non-negative integer" });
      }

      const r = await pool.query(
        `UPDATE pricing_tiers
         SET price_pence = COALESCE($3, price_pence),
             currency = COALESCE($4, currency),
             is_active = COALESCE($5, is_active)
         WHERE id = $2 AND parking_id = $1
         RETURNING id, parking_id, max_minutes, price_pence, currency, is_active, created_at`,
        [
          id,
          tierId,
          price_pence === undefined ? null : price_pence,
          currency === undefined ? null : currency,
          is_active === undefined ? null : is_active,
        ]
      );

      if (r.rowCount === 0) return res.status(404).json({ error: "Pricing tier not found" });
      return res.json({ tier: r.rows[0] });
    } catch (e) {
      next(e);
    }
  }
);

// DELETE /api/parkings/:id/pricing/:tierId -> deactivate a pricing tier (OWNER only, must own parking)
router.delete(
  "/:id/pricing/:tierId",
  requireAuth,
  requireRole(["OWNER", "ADMIN"]),
  requireParkingOwner,
  async (req, res, next) => {
    try {
      const { id, tierId } = req.params;
      const r = await pool.query(
        `UPDATE pricing_tiers
         SET is_active = false
         WHERE id = $2 AND parking_id = $1
         RETURNING id, parking_id, max_minutes, price_pence, currency, is_active, created_at`,
        [id, tierId]
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "Pricing tier not found" });
      return res.json({ tier: r.rows[0] });
    } catch (e) {
      next(e);
    }
  }
);


// GET /api/parkings/:id/availability?start_at=...&end_at=...
router.get("/:id/availability", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { start_at, end_at } = req.query;

    const start = new Date(start_at);
    const end = new Date(end_at);

    if (!start_at || !end_at || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({
        error: "start_at and end_at are required query params in ISO format",
      });
    }
    if (end <= start) {
      return res.status(400).json({ error: "end_at must be after start_at" });
    }

    // Get capacity
    const parkingRes = await pool.query(
      `SELECT id, capacity
       FROM parkings
       WHERE id = $1`,
      [id]
    );
    if (parkingRes.rowCount === 0) return res.status(404).json({ error: "Parking not found" });

    const capacity = parkingRes.rows[0].capacity;

    // Count overlapping bookings (PENDING + CONFIRMED block inventory)
    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS booked_count
       FROM bookings
       WHERE parking_id = $1
         AND status IN ('PENDING', 'CONFIRMED')
         AND start_at < $3
         AND end_at > $2`,
      [id, start.toISOString(), end.toISOString()]
    );

    const bookedCount = countRes.rows[0].booked_count;
    const available = bookedCount < capacity;

    res.json({
      parking_id: id,
      capacity,
      booked_count: bookedCount,
      available,
    });
  } catch (e) {
    next(e);
  }
});


module.exports = router;
