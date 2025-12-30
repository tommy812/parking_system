const express = require("express");
const router = express.Router();
const { pool } = require("../config/db");

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

module.exports = router;
