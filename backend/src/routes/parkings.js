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

function toCsv(rows, headers) {
  const esc = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => esc(row[h])).join(",")),
  ].join("\n");
}

router.get("/number", requireAuth, requireRole(["ADMIN"]), async (req, res, next) => {
  try {
    const r = await pool.query("SELECT COUNT(*)::int AS total FROM parkings WHERE is_active = true");
    res.json({ total: r.rows[0].total });
  } catch (e) {
    next(e);
  }
});

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


// GET /api/parkings  -> list parkings with optional pagination and query
router.get("/", async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(req.query.page_size) || 20, 1), 100);
    const query = req.query.query ? String(req.query.query).trim().toLowerCase() : "";
    const filter = req.query.filter || "all";
    const orderBy = req.query.order_by || "latest";

    const params = [];
    const where = [];
    let idx = 1;

    // 🔍 search
    if (query) {
      params.push(`%${query}%`);
      where.push(`(LOWER(name) LIKE $${idx} OR LOWER(COALESCE(address,'')) LIKE $${idx})`);
      idx++;
    }

    // ✅ active/inactive/all
    if (filter === "active") {
      where.push(`is_active = $${idx}`);
      params.push(true);
      idx++;
    } else if (filter === "inactive") {
      where.push(`is_active = $${idx}`);
      params.push(false);
      idx++;
    }

    // ✅ safe ORDER BY
    const ORDER_MAP = {
      latest:   "created_at DESC",
      oldest:   "created_at ASC",
      name:     "name ASC",
      location: "address ASC",
    };

    const orderSql = ORDER_MAP[orderBy] || ORDER_MAP.latest;

    const offset = (page - 1) * pageSize;
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const listSql = `
      SELECT id, name, address, timezone, capacity, currency, image_url,
             owner_user_id, is_active, lat, lng,
             open_start_minute_utc, open_end_minute_utc,
             min_booking_minutes, max_booking_minutes, buffer_minutes,
             created_at
      FROM parkings
      ${whereSql}
      ORDER BY ${orderSql}
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM parkings
      ${whereSql}
    `;

    const [listRes, countRes] = await Promise.all([
      pool.query(listSql, params),
      pool.query(countSql, params),
    ]);

    res.json({
      parkings: listRes.rows,
      total: countRes.rows[0].total,
      page,
      page_size: pageSize,
    });
  } catch (e) {
    next(e);
  }
});


// GET /api/parkings/search
// Query params:
// - q: string (name/address substring)
// - start_at, end_at: ISO datetimes (optional; if provided, filters to parkings with free capacity for that window)
// - min_capacity: int (optional)
// - max_price_pence: int (requires start_at/end_at to compute duration-based tier)
// - lat, lng, radius_km: for distance filtering (optional; requires parkings.lat/lng)
router.get("/search", async (req, res, next) => {
  try {
    const q = req.query.q ? String(req.query.q).trim() : "";
    const minCapacity =
      req.query.min_capacity === undefined ? undefined : Number(req.query.min_capacity);
    const maxPrice =
      req.query.max_price_pence === undefined ? undefined : Number(req.query.max_price_pence);

    const start_at = req.query.start_at ? String(req.query.start_at) : null;
    const end_at = req.query.end_at ? String(req.query.end_at) : null;
    const start = start_at ? new Date(start_at) : null;
    const end = end_at ? new Date(end_at) : null;

    if ((start_at && !end_at) || (!start_at && end_at)) {
      return res.status(400).json({ error: "start_at and end_at must be provided together" });
    }
    if (start_at && (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))) {
      return res.status(400).json({ error: "start_at/end_at must be ISO datetimes" });
    }
    if (start_at && end <= start) {
      return res.status(400).json({ error: "end_at must be after start_at" });
    }
    if (minCapacity !== undefined && (!Number.isInteger(minCapacity) || minCapacity <= 0)) {
      return res.status(400).json({ error: "min_capacity must be a positive integer" });
    }
    if (maxPrice !== undefined && (!Number.isInteger(maxPrice) || maxPrice < 0)) {
      return res.status(400).json({ error: "max_price_pence must be a non-negative integer" });
    }

    const lat = req.query.lat === undefined ? undefined : Number(req.query.lat);
    const lng = req.query.lng === undefined ? undefined : Number(req.query.lng);
    const radiusKm = req.query.radius_km === undefined ? undefined : Number(req.query.radius_km);
    const useGeo = lat !== undefined && lng !== undefined && radiusKm !== undefined;
    if (useGeo) {
      if (![lat, lng, radiusKm].every((v) => Number.isFinite(v))) {
        return res.status(400).json({ error: "lat/lng/radius_km must be numbers" });
      }
      if (radiusKm <= 0) return res.status(400).json({ error: "radius_km must be > 0" });
    }

    const durationMinutes =
      start && end ? Math.ceil((end.getTime() - start.getTime()) / (1000 * 60)) : null;

    // Haversine distance (km) computed in SQL when lat/lng provided.
    // Note: This is a simple non-PostGIS approach; parkings without lat/lng will be excluded when geo filter used.
    const params = [];
    let idx = 1;

    const where = ["p.is_active = true"];

    if (q) {
      params.push(`%${q.toLowerCase()}%`);
      where.push(`(LOWER(p.name) LIKE $${idx} OR LOWER(COALESCE(p.address,'')) LIKE $${idx})`);
      idx += 1;
    }

    if (minCapacity !== undefined) {
      params.push(minCapacity);
      where.push(`p.capacity >= $${idx}`);
      idx += 1;
    }

    // availability filter
    if (start && end) {
      params.push(start.toISOString());
      const startIdx = idx;
      idx += 1;
      params.push(end.toISOString());
      const endIdx = idx;
      idx += 1;

      // available if overlapping bookings < capacity
      where.push(`
        (
          SELECT COUNT(*)::int
          FROM bookings b
          WHERE b.parking_id = p.id
            AND b.status IN ('PENDING','CONFIRMED')
            AND b.start_at < $${endIdx}
            AND b.end_at > $${startIdx}
        ) < p.capacity
      `);
    }

    // price filter (duration tier)
    if (maxPrice !== undefined) {
      if (!durationMinutes) {
        return res.status(400).json({ error: "max_price_pence requires start_at and end_at" });
      }
      params.push(durationMinutes);
      const durIdx = idx;
      idx += 1;
      params.push(maxPrice);
      const priceIdx = idx;
      idx += 1;

      where.push(`
        (
          SELECT pt.price_pence
          FROM pricing_tiers pt
          WHERE pt.parking_id = p.id
            AND pt.is_active = true
            AND pt.max_minutes >= $${durIdx}
          ORDER BY pt.max_minutes ASC
          LIMIT 1
        ) <= $${priceIdx}
      `);
    }

    let distanceSelect = "NULL::double precision AS distance_km";
    if (useGeo) {
      params.push(lat);
      const latIdx = idx;
      idx += 1;
      params.push(lng);
      const lngIdx = idx;
      idx += 1;
      params.push(radiusKm);
      const radIdx = idx;
      idx += 1;

      distanceSelect = `
        (
          6371 * 2 * ASIN(
            SQRT(
              POWER(SIN(RADIANS((p.lat - $${latIdx}) / 2)), 2) +
              COS(RADIANS($${latIdx})) * COS(RADIANS(p.lat)) *
              POWER(SIN(RADIANS((p.lng - $${lngIdx}) / 2)), 2)
            )
          )
        ) AS distance_km
      `;

      where.push("p.lat IS NOT NULL AND p.lng IS NOT NULL");
      where.push(`(
        6371 * 2 * ASIN(
          SQRT(
            POWER(SIN(RADIANS((p.lat - $${latIdx}) / 2)), 2) +
            COS(RADIANS($${latIdx})) * COS(RADIANS(p.lat)) *
            POWER(SIN(RADIANS((p.lng - $${lngIdx}) / 2)), 2)
          )
        )
      ) <= $${radIdx}`);
    }

    const sql = `
      SELECT p.id, p.name, p.address, p.timezone, p.capacity, p.currency, p.image_url, p.owner_user_id, p.lat, p.lng, p.created_at,
             ${distanceSelect}
      FROM parkings p
      WHERE ${where.join(" AND ")}
      ORDER BY ${useGeo ? "distance_km ASC" : "p.created_at DESC"}
      LIMIT 100
    `;

    const r = await pool.query(sql, params);
    res.json({ parkings: r.rows });
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
      const {
        name,
        address,
        timezone,
        capacity,
        currency,
        image_url,
        lat,
        lng,
        open_start_minute_utc,
        open_end_minute_utc,
        min_booking_minutes,
        max_booking_minutes,
        buffer_minutes,
      } = req.body;

      if (capacity !== undefined) {
        const c = Number(capacity);
        if (!Number.isInteger(c) || c <= 0) {
          return res.status(400).json({ error: "capacity must be a positive integer" });
        }
      }
      const toIntOrUndef = (v) => (v === undefined ? undefined : Number(v));
      const os = toIntOrUndef(open_start_minute_utc);
      const oe = toIntOrUndef(open_end_minute_utc);
      const minB = toIntOrUndef(min_booking_minutes);
      const maxB = toIntOrUndef(max_booking_minutes);
      const buf = toIntOrUndef(buffer_minutes);

      if (os !== undefined && (!Number.isInteger(os) || os < 0 || os > 1440)) {
        return res.status(400).json({ error: "open_start_minute_utc must be int 0..1440" });
      }
      if (oe !== undefined && (!Number.isInteger(oe) || oe < 0 || oe > 1440)) {
        return res.status(400).json({ error: "open_end_minute_utc must be int 0..1440" });
      }
      if (minB !== undefined && (!Number.isInteger(minB) || minB <= 0)) {
        return res.status(400).json({ error: "min_booking_minutes must be a positive integer" });
      }
      if (maxB !== undefined && (!Number.isInteger(maxB) || maxB <= 0)) {
        return res.status(400).json({ error: "max_booking_minutes must be a positive integer" });
      }
      if (buf !== undefined && (!Number.isInteger(buf) || buf < 0)) {
        return res.status(400).json({ error: "buffer_minutes must be a non-negative integer" });
      }
      if (lat !== undefined && lat !== null && !Number.isFinite(Number(lat))) {
        return res.status(400).json({ error: "lat must be a number" });
      }
      if (lng !== undefined && lng !== null && !Number.isFinite(Number(lng))) {
        return res.status(400).json({ error: "lng must be a number" });
      }

      const r = await pool.query(
        `UPDATE parkings
         SET name = COALESCE($2, name),
             address = COALESCE($3, address),
             timezone = COALESCE($4, timezone),
             capacity = COALESCE($5, capacity),
             currency = COALESCE($6, currency),
             image_url = COALESCE($7, image_url),
             lat = COALESCE($8, lat),
             lng = COALESCE($9, lng),
             open_start_minute_utc = COALESCE($10, open_start_minute_utc),
             open_end_minute_utc = COALESCE($11, open_end_minute_utc),
             min_booking_minutes = COALESCE($12, min_booking_minutes),
             max_booking_minutes = COALESCE($13, max_booking_minutes),
             buffer_minutes = COALESCE($14, buffer_minutes)
         WHERE id = $1
         RETURNING id, name, address, timezone, capacity, currency, image_url, owner_user_id, lat, lng,
                   open_start_minute_utc, open_end_minute_utc, min_booking_minutes, max_booking_minutes, buffer_minutes,
                   created_at`,
        [
          id,
          name ?? null,
          address ?? null,
          timezone ?? null,
          capacity === undefined ? null : Number(capacity),
          currency ?? null,
          image_url ?? null,
          lat === undefined ? null : (lat === null ? null : Number(lat)),
          lng === undefined ? null : (lng === null ? null : Number(lng)),
          os === undefined ? null : os,
          oe === undefined ? null : oe,
          minB === undefined ? null : minB,
          maxB === undefined ? null : maxB,
          buf === undefined ? null : buf,
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

// OWNER/ADMIN dashboard: list bookings for a parking
// GET /api/parkings/:id/bookings?from=...&to=...&status=PENDING|CONFIRMED|CANCELLED|EXPIRED
router.get(
  "/:id/bookings",
  requireAuth,
  requireRole(["OWNER", "ADMIN"]),
  requireParkingOwner,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const from = req.query.from ? new Date(String(req.query.from)) : null;
      const to = req.query.to ? new Date(String(req.query.to)) : null;
      const status = req.query.status ? String(req.query.status).toUpperCase() : null;
      const allowedStatuses = ["PENDING", "CONFIRMED", "CANCELLED", "EXPIRED"];

      if (from && Number.isNaN(from.getTime())) return res.status(400).json({ error: "Invalid from" });
      if (to && Number.isNaN(to.getTime())) return res.status(400).json({ error: "Invalid to" });
      if (status && !allowedStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      const params = [id];
      const where = ["b.parking_id = $1"];
      let i = 2;
      if (from) {
        params.push(from.toISOString());
        where.push(`b.end_at >= $${i++}`);
      }
      if (to) {
        params.push(to.toISOString());
        where.push(`b.start_at <= $${i++}`);
      }
      if (status) {
        params.push(status);
        where.push(`b.status = $${i++}`);
      }

      const r = await pool.query(
        `SELECT b.id, b.user_id, b.parking_id, b.status, b.start_at, b.end_at, b.total_amount_pence, b.currency, b.created_at, b.updated_at
         FROM bookings b
         WHERE ${where.join(" AND ")}
         ORDER BY b.start_at ASC
         LIMIT 500`,
        params
      );
      res.json({ bookings: r.rows });
    } catch (e) {
      next(e);
    }
  }
);

// OWNER/ADMIN dashboard: CSV export of bookings for a parking
// GET /api/parkings/:id/bookings.csv?from=...&to=...&status=...
router.get(
  "/:id/bookings.csv",
  requireAuth,
  requireRole(["OWNER", "ADMIN"]),
  requireParkingOwner,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const from = req.query.from ? new Date(String(req.query.from)) : null;
      const to = req.query.to ? new Date(String(req.query.to)) : null;
      const status = req.query.status ? String(req.query.status).toUpperCase() : null;
      const allowedStatuses = ["PENDING", "CONFIRMED", "CANCELLED", "EXPIRED"];

      if (from && Number.isNaN(from.getTime())) return res.status(400).json({ error: "Invalid from" });
      if (to && Number.isNaN(to.getTime())) return res.status(400).json({ error: "Invalid to" });
      if (status && !allowedStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      const params = [id];
      const where = ["b.parking_id = $1"];
      let i = 2;
      if (from) {
        params.push(from.toISOString());
        where.push(`b.end_at >= $${i++}`);
      }
      if (to) {
        params.push(to.toISOString());
        where.push(`b.start_at <= $${i++}`);
      }
      if (status) {
        params.push(status);
        where.push(`b.status = $${i++}`);
      }

      const r = await pool.query(
        `SELECT b.id, b.user_id, b.status, b.start_at, b.end_at, b.total_amount_pence, b.currency, b.created_at
         FROM bookings b
         WHERE ${where.join(" AND ")}
         ORDER BY b.start_at ASC
         LIMIT 5000`,
        params
      );

      const headers = ["id", "user_id", "status", "start_at", "end_at", "total_amount_pence", "currency", "created_at"];
      const csv = toCsv(r.rows, headers);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="parking-${id}-bookings.csv"`);
      res.send(csv);
    } catch (e) {
      next(e);
    }
  }
);

// OWNER/ADMIN dashboard: revenue summary for a parking
// GET /api/parkings/:id/revenue?from=...&to=...
router.get(
  "/:id/revenue",
  requireAuth,
  requireRole(["OWNER", "ADMIN"]),
  requireParkingOwner,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const from = req.query.from ? new Date(String(req.query.from)) : null;
      const to = req.query.to ? new Date(String(req.query.to)) : null;

      if (from && Number.isNaN(from.getTime())) return res.status(400).json({ error: "Invalid from" });
      if (to && Number.isNaN(to.getTime())) return res.status(400).json({ error: "Invalid to" });

      const params = [id];
      const where = ["b.parking_id = $1", "p.status = 'SUCCEEDED'"];
      let i = 2;
      if (from) {
        params.push(from.toISOString());
        where.push(`b.end_at >= $${i++}`);
      }
      if (to) {
        params.push(to.toISOString());
        where.push(`b.start_at <= $${i++}`);
      }

      const r = await pool.query(
        `SELECT COUNT(*)::int AS payment_count,
                COALESCE(SUM(p.amount_pence), 0)::int AS total_amount_pence
         FROM payments p
         JOIN bookings b ON b.id = p.booking_id
         WHERE ${where.join(" AND ")}`,
        params
      );

      res.json({
        parking_id: id,
        payment_count: r.rows[0].payment_count,
        total_amount_pence: r.rows[0].total_amount_pence,
      });
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
      `SELECT id, capacity, buffer_minutes
       FROM parkings
       WHERE id = $1 AND is_active = true`,
      [id]
    );
    if (parkingRes.rowCount === 0) return res.status(404).json({ error: "Parking not found" });

    const capacity = parkingRes.rows[0].capacity;
    const buffer = parkingRes.rows[0].buffer_minutes || 0;
    const bufferedStart = new Date(start.getTime() - buffer * 60 * 1000);
    const bufferedEnd = new Date(end.getTime() + buffer * 60 * 1000);

    // Count overlapping bookings (PENDING + CONFIRMED block inventory)
    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS booked_count
       FROM bookings
       WHERE parking_id = $1
         AND status IN ('PENDING', 'CONFIRMED')
         AND start_at < $3
         AND end_at > $2`,
      [id, bufferedStart.toISOString(), bufferedEnd.toISOString()]
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
