const express = require("express");
const router = express.Router();
const { pool } = require("../config/db");



// POST /api/parkings -> create a parking
router.post("/", async (req, res, next) => {
  try {
    const { name, address, timezone, capacity, currency, image_url } = req.body;
    const r = await pool.query(
      `INSERT INTO parkings (name, address, timezone, capacity, currency, image_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [name, address, timezone, capacity, currency, image_url]
    );
    res.json(r.rows[0]);
  } catch (e) {
    next(e);
  }
});


// GET /api/parkings  -> list parkings
router.get("/", async (req, res, next) => {
  try {
    const r = await pool.query(
      `SELECT id, name, address, timezone, capacity, currency, image_url, created_at
       FROM parkings
       ORDER BY created_at DESC`
    );
    res.json(r.rows);
  } catch (e) {
    next(e);
  }
});

// GET /api/parkings/:id -> get a parking
router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const r = await pool.query(
      `SELECT id, name, address, timezone, capacity, currency, image_url, created_at
       FROM parkings
       WHERE id = $1`,
      [id]
    );
    res.json(r.rows[0]);
  } catch (e) {
    next(e);
  }
});


// GET /api/parkings/:id/pricing -> pricing tiers for a parking
router.get("/:id/pricing", async (req, res, next) => {
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
});


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
