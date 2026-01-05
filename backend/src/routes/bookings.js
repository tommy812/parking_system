const express = require("express");
const router = express.Router();
const { pool } = require("../config/db");

function parseIsoDate(value, fieldName) {
  const d = new Date(value);
  if (!value || Number.isNaN(d.getTime())) {
    const err = new Error(`Invalid ${fieldName}. Use ISO format (e.g. 2026-01-02T10:00:00Z)`);
    err.status = 400;
    throw err;
  }
  return d;
}

function diffMinutes(start, end) {
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60));
}

router.post("/quote", async (req, res, next) => {
  try {
    const { parking_id, start_at, end_at } = req.body;

    if (!parking_id) {
      return res.status(400).json({ error: "parking_id is required" });
    }

    const start = new Date(start_at);
    const end = new Date(end_at);

    if (!start_at || !end_at || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ error: "start_at and end_at must be ISO datetime strings" });
    }

    if (end <= start) {
      return res.status(400).json({ error: "end_at must be after start_at" });
    }

    const durationMinutes = Math.ceil((end - start) / (1000 * 60));

    // ensure parking exists (nice API behavior)
    const parkingRes = await pool.query(
      `SELECT id, currency
       FROM parkings
       WHERE id = $1`,
      [parking_id]
    );

    if (parkingRes.rowCount === 0) {
      return res.status(404).json({ error: "Parking not found" });
    }

    const tierRes = await pool.query(
      `SELECT max_minutes, price_pence, currency
       FROM pricing_tiers
       WHERE parking_id = $1
         AND is_active = true
         AND max_minutes >= $2
       ORDER BY max_minutes ASC
       LIMIT 1`,
      [parking_id, durationMinutes]
    );

    if (tierRes.rowCount === 0) {
      return res.status(400).json({
        error: "No pricing tier for duration",
        duration_minutes: durationMinutes,
      });
    }

    const tier = tierRes.rows[0];

    return res.json({
      parking_id,
      duration_minutes: durationMinutes,
      price_pence: tier.price_pence,
      currency: tier.currency || parkingRes.rows[0].currency,
      tier_max_minutes: tier.max_minutes,
    });
  } catch (e) {
    next(e);
  }
});

// POST /api/bookings/:id/cancel
router.post("/:id/cancel", async (req, res, next) => {
  try {
    const { id } = req.params;

    const r = await pool.query(
      `UPDATE bookings
       SET status = 'CANCELLED',
           updated_at = now()
       WHERE id = $1
         AND status IN ('PENDING', 'CONFIRMED')
       RETURNING id, user_id, parking_id, start_at, end_at, status, total_amount_pence, currency, created_at, updated_at`,
      [id]
    );

    // If updated, we successfully cancelled
    if (r.rowCount === 1) {
      return res.json({ booking: r.rows[0] });
    }

    // If not updated, booking might not exist OR is already cancelled/expired
    const check = await pool.query(
      `SELECT id, status
       FROM bookings
       WHERE id = $1`,
      [id]
    );

    if (check.rowCount === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }

    // Idempotent behavior: already cancelled/expired → return current status
    return res.json({
      booking: { id: check.rows[0].id, status: check.rows[0].status },
      message: "Booking was not cancellable (already cancelled/expired)",
    });
  } catch (e) {
    next(e);
  }
});

// POST /api/bookings
router.post("/", async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { user_id, parking_id, start_at, end_at } = req.body;

    if (!user_id || !parking_id) {
      return res.status(400).json({ error: "user_id and parking_id are required" });
    }

    const start = parseIsoDate(start_at, "start_at");
    const end = parseIsoDate(end_at, "end_at");
    if (end <= start) return res.status(400).json({ error: "end_at must be after start_at" });

    const durationMinutes = diffMinutes(start, end);

    await client.query("BEGIN");

    // Lock the parking row so two requests don't oversell capacity at the same time
    const parkingRes = await client.query(
      `SELECT id, capacity, currency
       FROM parkings
       WHERE id = $1
       FOR UPDATE`,
      [parking_id]
    );

    if (parkingRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Parking not found" });
    }

    const { capacity, currency } = parkingRes.rows[0];

    // Find pricing tier
    const tierRes = await client.query(
      `SELECT max_minutes, price_pence, currency
       FROM pricing_tiers
       WHERE parking_id = $1
         AND is_active = true
         AND max_minutes >= $2
       ORDER BY max_minutes ASC
       LIMIT 1`,
      [parking_id, durationMinutes]
    );

    if (tierRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "No pricing tier available for that duration",
        duration_minutes: durationMinutes,
      });
    }

    const tier = tierRes.rows[0];
    const totalAmountPence = tier.price_pence;
    const bookingCurrency = tier.currency || currency;

    // Count overlapping bookings that consume capacity
    const countRes = await client.query(
      `SELECT COUNT(*)::int AS booked_count
       FROM bookings
       WHERE parking_id = $1
         AND status IN ('PENDING', 'CONFIRMED')
         AND start_at < $3
         AND end_at > $2`,
      [parking_id, start.toISOString(), end.toISOString()]
    );

    const bookedCount = countRes.rows[0].booked_count;

    if (bookedCount >= capacity) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: "Parking is fully booked for that time window",
        capacity,
        booked_count: bookedCount,
      });
    }

    // Insert booking as PENDING
    const insertRes = await client.query(
      `INSERT INTO bookings
        (user_id, parking_id, start_at, end_at, status, total_amount_pence, currency)
       VALUES
        ($1, $2, $3, $4, 'PENDING', $5, $6)
       RETURNING id, user_id, parking_id, start_at, end_at, status, total_amount_pence, currency, created_at, updated_at`,
      [user_id, parking_id, start.toISOString(), end.toISOString(), totalAmountPence, bookingCurrency]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      booking: insertRes.rows[0],
      duration_minutes: durationMinutes,
      tier_max_minutes: tier.max_minutes,
      capacity,
      booked_count_before_insert: bookedCount,
    });
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    next(e);
  } finally {
    client.release();
  }
});

module.exports = router;
