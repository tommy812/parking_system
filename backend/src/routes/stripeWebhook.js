const express = require("express");
const router = express.Router();
const { stripe } = require("../config/stripe");
const { env } = require("../config/env");
const { pool } = require("../config/db");

// Stripe needs raw body for signature verification:
router.post("/", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle events you care about
  try {
    if (event.type === "payment_intent.succeeded") {
      const intent = event.data.object;
      const bookingId = intent.metadata?.booking_id;

      if (bookingId) {
        // Update payment + booking
        await pool.query(
          `UPDATE payments
           SET status = 'SUCCEEDED',
               raw = $2
           WHERE provider = 'stripe' AND provider_payment_id = $1`,
          [intent.id, JSON.stringify(intent)]
        );

        await pool.query(
          `UPDATE bookings
           SET status = 'CONFIRMED',
               updated_at = now()
           WHERE id = $1 AND status = 'PENDING'`,
          [bookingId]
        );
      }
    }

    if (event.type === "payment_intent.payment_failed") {
      const intent = event.data.object;
      const bookingId = intent.metadata?.booking_id;

      await pool.query(
        `UPDATE payments
         SET status = 'FAILED',
             raw = $2
         WHERE provider = 'stripe' AND provider_payment_id = $1`,
        [intent.id, JSON.stringify(intent)]
      );

      // We keep booking PENDING so user can retry payment (common approach)
      if (bookingId) {
        await pool.query(
          `UPDATE bookings
           SET updated_at = now()
           WHERE id = $1`,
          [bookingId]
        );
      }
    }

    res.json({ received: true });
  } catch (e) {
    console.error("Webhook handler error:", e);
    res.status(500).json({ error: "Webhook handler failed" });
  }
});

module.exports = router;
