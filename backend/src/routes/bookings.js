const express = require("express");
const router = express.Router();
const { pool } = require("../config/db");
const { stripe } = require("../config/stripe");
const { env } = require("../config/env");
const { requireAuth, requireRole } = require("../middleware/auth");

function parseIsoDate(value, fieldName) {
  const d = new Date(value);
  if (!value || Number.isNaN(d.getTime())) {
    const err = new Error(
      `Invalid ${fieldName}. Use ISO format (e.g. 2026-01-02T10:00:00Z)`
    );
    err.status = 400;
    throw err;
  }
  return d;
}

function diffMinutes(start, end) {
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60));
}

function validateBookingDates(start, end) {
  const now = new Date();

  // Prevent bookings in the past
  if (start < now) {
    const err = new Error("start_at cannot be in the past");
    err.status = 400;
    throw err;
  }

  // Prevent bookings too far in the future
  const maxBookingDate = new Date(now);
  maxBookingDate.setDate(maxBookingDate.getDate() + env.MAX_BOOKING_DAYS_AHEAD);

  if (start > maxBookingDate) {
    const err = new Error(
      `start_at cannot be more than ${env.MAX_BOOKING_DAYS_AHEAD} days in the future`
    );
    err.status = 400;
    throw err;
  }

  if (end > maxBookingDate) {
    const err = new Error(
      `end_at cannot be more than ${env.MAX_BOOKING_DAYS_AHEAD} days in the future`
    );
    err.status = 400;
    throw err;
  }
}

function minutesSinceUtcMidnight(d) {
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function expandWindow(start, end, bufferMinutes) {
  const b = Number(bufferMinutes || 0);
  if (!Number.isFinite(b) || b <= 0) return { start, end };
  return {
    start: new Date(start.getTime() - b * 60 * 1000),
    end: new Date(end.getTime() + b * 60 * 1000),
  };
}

async function validateParkingSchedule(clientOrPool, parkingId, start, end, durationMinutes) {
  const r = await clientOrPool.query(
    `SELECT id,
            open_start_minute_utc,
            open_end_minute_utc,
            min_booking_minutes,
            max_booking_minutes,
            buffer_minutes
     FROM parkings
     WHERE id = $1`,
    [parkingId]
  );
  if (r.rowCount === 0) {
    const err = new Error("Parking not found");
    err.status = 404;
    throw err;
  }

  const p = r.rows[0];
  if (durationMinutes < p.min_booking_minutes) {
    const err = new Error(`Booking too short (min ${p.min_booking_minutes} minutes)`);
    err.status = 400;
    throw err;
  }
  if (durationMinutes > p.max_booking_minutes) {
    const err = new Error(`Booking too long (max ${p.max_booking_minutes} minutes)`);
    err.status = 400;
    throw err;
  }

  const startMin = minutesSinceUtcMidnight(start);
  const endMin = minutesSinceUtcMidnight(end);
  // Require booking fully within open window (same-day UTC). Cross-midnight bookings are rejected for now.
  if (end.getUTCFullYear() !== start.getUTCFullYear() ||
      end.getUTCMonth() !== start.getUTCMonth() ||
      end.getUTCDate() !== start.getUTCDate()) {
    const err = new Error("Booking must start and end on the same UTC day");
    err.status = 400;
    throw err;
  }
  if (startMin < p.open_start_minute_utc || endMin > p.open_end_minute_utc) {
    const err = new Error("Booking is outside parking opening hours");
    err.status = 400;
    throw err;
  }

  const buffered = expandWindow(start, end, p.buffer_minutes);
  const blk = await clientOrPool.query(
    `SELECT 1
     FROM parking_blackouts
     WHERE parking_id = $1
       AND start_at < $3
       AND end_at > $2
     LIMIT 1`,
    [parkingId, buffered.start.toISOString(), buffered.end.toISOString()]
  );
  if (blk.rowCount > 0) {
    const err = new Error("Parking is unavailable (blackout period)");
    err.status = 409;
    throw err;
  }

  return p; // includes buffer_minutes etc.
}

async function getBookingForAuth(bookingId) {
  // include parking owner to allow parking OWNER access, and booking user_id for user access
  const r = await pool.query(
    `SELECT b.id,
            b.user_id,
            b.parking_id,
            b.status,
            b.start_at,
            b.end_at,
            b.total_amount_pence,
            b.currency,
            b.stripe_payment_intent_id,
            b.created_at,
            b.updated_at,
            p.owner_user_id AS parking_owner_user_id
     FROM bookings b
     JOIN parkings p ON p.id = b.parking_id
     WHERE b.id = $1`,
    [bookingId]
  );
  return r;
}

function canAccessBooking(reqUser, bookingRow) {
  if (!reqUser) return false;
  if (reqUser.role === "ADMIN") return true;
  if (bookingRow.user_id === reqUser.id) return true;
  if (reqUser.role === "OWNER" && reqUser.is_approved === true) {
    return bookingRow.parking_owner_user_id === reqUser.id;
  }
  return false;
}

router.post("/quote", requireAuth, async (req, res, next) => {
  try {
    const { parking_id, start_at, end_at } = req.body;

    if (!parking_id) {
      return res.status(400).json({ error: "parking_id is required" });
    }

    const start = new Date(start_at);
    const end = new Date(end_at);

    if (
      !start_at ||
      !end_at ||
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime())
    ) {
      return res
        .status(400)
        .json({ error: "start_at and end_at must be ISO datetime strings" });
    }

    if (end <= start) {
      return res.status(400).json({ error: "end_at must be after start_at" });
    }

    // Validate booking dates (prevent past bookings and bookings too far in future)
    try {
      validateBookingDates(start, end);
    } catch (validationError) {
      return res
        .status(validationError.status || 400)
        .json({ error: validationError.message });
    }

    const durationMinutes = Math.ceil((end - start) / (1000 * 60));

    // ensure parking exists (nice API behavior)
    const parkingRes = await pool.query(
      `SELECT id, currency
       FROM parkings
       WHERE id = $1 AND is_active = true`,
      [parking_id]
    );

    if (parkingRes.rowCount === 0) {
      return res.status(404).json({ error: "Parking not found" });
    }

    // schedule rules (min/max/opening/blackouts)
    await validateParkingSchedule(pool, parking_id, start, end, durationMinutes);

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

// GET /api/bookings -> list all bookings (ADMIN only) with pagination/search
router.get("/", requireAuth, requireRole(["ADMIN"]), async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(req.query.page_size) || 20, 1), 100);
    const query = req.query.query ? String(req.query.query).trim().toLowerCase() : "";

    const params = [];
    const where = ["1=1"];
    let idx = 1;

    if (query) {
      params.push(`%${query}%`);
      where.push(
        `(LOWER(id::text) LIKE $${idx} OR LOWER(user_id::text) LIKE $${idx} OR LOWER(parking_id::text) LIKE $${idx})`
      );
      idx += 1;
    }

    const offset = (page - 1) * pageSize;

    const listSql = `
      SELECT id, user_id, parking_id, status, start_at, end_at, total_amount_pence, currency, stripe_payment_intent_id, created_at, updated_at
      FROM bookings
      WHERE ${where.join(" AND ")}
      ORDER BY created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM bookings
      WHERE ${where.join(" AND ")}
    `;

    const [listRes, countRes] = await Promise.all([pool.query(listSql, params), pool.query(countSql, params)]);

    res.json({
      bookings: listRes.rows,
      total: countRes.rows[0].total,
      page,
      page_size: pageSize,
    });
  } catch (e) {
    next(e);
  }
});

// GET /api/bookings/mine -> list my bookings (USER/OWNER/ADMIN)
router.get("/mine", requireAuth, async (req, res, next) => {
  try {
    // For OWNER: show bookings for their parkings; For USER: show their bookings; For ADMIN: show all.
    if (req.user.role === "ADMIN") {
      const r = await pool.query(
        `SELECT id, user_id, parking_id, status, start_at, end_at, total_amount_pence, currency, stripe_payment_intent_id, created_at, updated_at
         FROM bookings
         ORDER BY created_at DESC`
      );
      return res.json({ bookings: r.rows });
    }

    if (req.user.role === "OWNER") {
      if (req.user.is_approved !== true) {
        return res.status(403).json({ error: "Owner account pending admin approval" });
      }
      const r = await pool.query(
        `SELECT b.id, b.user_id, b.parking_id, b.status, b.start_at, b.end_at, b.total_amount_pence, b.currency, b.stripe_payment_intent_id, b.created_at, b.updated_at
         FROM bookings b
         JOIN parkings p ON p.id = b.parking_id
         WHERE p.owner_user_id = $1
         ORDER BY b.created_at DESC`,
        [req.user.id]
      );
      return res.json({ bookings: r.rows });
    }

    const r = await pool.query(
      `SELECT id, user_id, parking_id, status, start_at, end_at, total_amount_pence, currency, stripe_payment_intent_id, created_at, updated_at
       FROM bookings
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    return res.json({ bookings: r.rows });
  } catch (e) {
    next(e);
  }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const r = await getBookingForAuth(id);
    if (r.rowCount === 0) return res.status(404).json({ error: "Booking not found" });
    if (!canAccessBooking(req.user, r.rows[0])) {
      return res.status(403).json({ error: "Forbidden" });
    }
    res.json({ booking: r.rows[0] });
  } catch (e) {
    next(e);
  }
});

// POST /api/bookings/:id/cancel
router.post("/:id/cancel", requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const authRes = await getBookingForAuth(id);
    if (authRes.rowCount === 0) return res.status(404).json({ error: "Booking not found" });
    if (!canAccessBooking(req.user, authRes.rows[0])) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const r = await pool.query(
      `UPDATE bookings
       SET status = 'CANCELLED',
           updated_at = now()
       WHERE id = $1
         AND status = 'PENDING'
       RETURNING id, user_id, parking_id, start_at, end_at, status, total_amount_pence, currency, created_at, updated_at`,
      [id]
    );

    // If updated, we successfully cancelled
    if (r.rowCount === 1) {
      return res.json({ booking: r.rows[0] });
    }

    // If not updated, booking might not exist OR is already cancelled/expired
    const check = await pool.query(
      `SELECT id, user_id, parking_id, start_at, end_at, status, total_amount_pence, currency, created_at, updated_at
       FROM bookings
       WHERE id = $1`,
      [id]
    );

    if (check.rowCount === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }

    // Idempotent behavior: cancelling an already-cancelled booking returns 200
    if (check.rows[0].status === "CANCELLED") {
      return res.json({ booking: check.rows[0] });
    }

    return res.status(409).json({
      error: `Booking cannot be cancelled in status=${check.rows[0].status}`,
      booking: { id: check.rows[0].id, status: check.rows[0].status },
    });
  } catch (e) {
    next(e);
  }
});
// POST /api/bookings/:id/sync-payment
router.post("/:id/sync-payment", requireAuth, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    await client.query("BEGIN");

    const bRes = await client.query(
      `SELECT b.id,
              b.user_id,
              b.parking_id,
              b.status,
              b.stripe_payment_intent_id,
              p.owner_user_id AS parking_owner_user_id
       FROM bookings b
       JOIN parkings p ON p.id = b.parking_id
       WHERE b.id = $1
       FOR UPDATE`,
      [id]
    );

    if (bRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Booking not found" });
    }

    const booking = bRes.rows[0];

    if (!canAccessBooking(req.user, booking)) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Forbidden" });
    }

    if (!booking.stripe_payment_intent_id) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Booking has no payment intent" });
    }

    const intent = await stripe.paymentIntents.retrieve(
      booking.stripe_payment_intent_id
    );

    // Map Stripe -> our statuses
    if (intent.status === "succeeded") {
      const upd = await client.query(
        `UPDATE bookings
   SET status = 'CONFIRMED',
       updated_at = now()
   WHERE id = $1
     AND status = 'PENDING'
   RETURNING id, status`,
        [booking.id]
      );

      if (upd.rowCount === 0) {
        // Booking was not pending (cancelled/expired/confirmed) — do not change it
        await client.query("COMMIT");
        return res.json({
          booking_id: booking.id,
          intent_status: intent.status,
          note: `Payment succeeded but booking not confirmed because status=${booking.status}`,
        });
      }

      await client.query(
        `UPDATE payments
         SET status = 'SUCCEEDED',
             raw = $2
         WHERE provider='stripe' AND provider_payment_id = $1`,
        [intent.id, JSON.stringify(intent)]
      );

      await client.query("COMMIT");
      return res.json({
        booking_id: booking.id,
        synced_to: "CONFIRMED",
        intent_status: intent.status,
      });
    }

    if (intent.status === "canceled") {
      await client.query(
        `UPDATE payments
         SET status = 'FAILED',
             raw = $2
         WHERE provider='stripe' AND provider_payment_id = $1`,
        [intent.id, JSON.stringify(intent)]
      );
    }

    await client.query("COMMIT");
    return res.json({
      booking_id: booking.id,
      intent_status: intent.status,
      note: "No state change applied",
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

// POST /api/bookings
router.post("/", requireAuth, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { parking_id, start_at, end_at } = req.body;
    const requestedUserId = req.body.user_id;

    const userId =
      req.user.role === "ADMIN" && requestedUserId ? String(requestedUserId) : req.user.id;

    if (!parking_id) {
      return res.status(400).json({ error: "parking_id is required" });
    }

    const start = parseIsoDate(start_at, "start_at");
    const end = parseIsoDate(end_at, "end_at");
    if (end <= start)
      return res.status(400).json({ error: "end_at must be after start_at" });

    // Validate booking dates (prevent past bookings and bookings too far in future)
    try {
      validateBookingDates(start, end);
    } catch (validationError) {
      return res
        .status(validationError.status || 400)
        .json({ error: validationError.message });
    }

    const durationMinutes = diffMinutes(start, end);

    await client.query("BEGIN");

    // Lock the parking row so two requests don't oversell capacity at the same time
    const parkingRes = await client.query(
      `SELECT id, capacity, currency, buffer_minutes
       FROM parkings
       WHERE id = $1 AND is_active = true
       FOR UPDATE`,
      [parking_id]
    );

    if (parkingRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Parking not found" });
    }

    // schedule rules (min/max/opening/blackouts) using same transaction client
    const schedule = await validateParkingSchedule(client, parking_id, start, end, durationMinutes);
    const buffered = expandWindow(start, end, schedule.buffer_minutes);

    // Prevent same user overlapping booking at same parking (friendly error)
    const dupRes = await client.query(
      `SELECT 1
   FROM bookings
   WHERE user_id = $1
     AND parking_id = $2
     AND status IN ('PENDING', 'CONFIRMED')
     AND start_at < $4
     AND end_at > $3
   LIMIT 1`,
      [userId, parking_id, buffered.start.toISOString(), buffered.end.toISOString()]
    );

    if (dupRes.rowCount > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error:
          "You already have an active booking for this parking in that time range",
      });
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
      [parking_id, buffered.start.toISOString(), buffered.end.toISOString()]
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
      [
        userId,
        parking_id,
        start.toISOString(),
        end.toISOString(),
        totalAmountPence,
        bookingCurrency,
      ]
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
    if (e && e.code === "23P01") {
      return res.status(409).json({
        error: "Overlapping booking not allowed for this user at this parking",
      });
    }
    if (e && e.status) {
      return res.status(e.status).json({ error: e.message });
    }
    next(e);
  } finally {
    client.release();
  }
});

module.exports = router;
