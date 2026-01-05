const express = require("express");
const router = express.Router();
const { pool } = require("../config/db");
const { stripe } = require("../config/stripe");

// POST /api/payments/create-intent
// body: { booking_id }
router.post("/create-intent", async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { booking_id } = req.body;
    if (!booking_id) return res.status(400).json({ error: "booking_id is required" });

    await client.query("BEGIN");

    // Lock booking row to avoid double-intent creation races
    const bRes = await client.query(
      `SELECT id, status, total_amount_pence, currency, stripe_payment_intent_id
       FROM bookings
       WHERE id = $1
       FOR UPDATE`,
      [booking_id]
    );

    if (bRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Booking not found" });
    }

    const booking = bRes.rows[0];

    if (booking.status !== "PENDING") {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: `Booking is not payable (status=${booking.status})` });
    }

    // If intent already exists, reuse it (idempotent)
    if (booking.stripe_payment_intent_id) {
      await client.query("COMMIT");
      return res.json({ payment_intent_id: booking.stripe_payment_intent_id, reused: true });
    }

    // Stripe uses smallest currency unit (pence)
    const intent = await stripe.paymentIntents.create({
      amount: booking.total_amount_pence,
      currency: booking.currency.toLowerCase(), // "GBP" -> "gbp"
      automatic_payment_methods: { enabled: true },
      metadata: { booking_id: booking.id },
    });

    // Store on booking
    await client.query(
      `UPDATE bookings
       SET stripe_payment_intent_id = $2,
           updated_at = now()
       WHERE id = $1`,
      [booking.id, intent.id]
    );

    // Create payments row
    await client.query(
      `INSERT INTO payments (booking_id, provider, provider_payment_id, status, amount_pence, currency, raw)
       VALUES ($1, 'stripe', $2, 'REQUIRES_PAYMENT', $3, $4, $5)`,
      [booking.id, intent.id, booking.total_amount_pence, booking.currency, JSON.stringify(intent)]
    );

    await client.query("COMMIT");

    // client_secret is needed by frontend Stripe SDK
    return res.json({ payment_intent_id: intent.id, client_secret: intent.client_secret });
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch {}
    next(e);
  } finally {
    client.release();
  }
});

module.exports = router;
