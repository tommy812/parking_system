const { pool } = require("../config/db");
const { env } = require("../config/env");

async function expirePendingBookings() {
  const holdMinutes = env.BOOKING_HOLD_MINUTES;

  // Expire PENDING bookings older than hold window.
  // Extra guard: only if the booking hasn't started yet (optional but sensible).
  const q = `
    UPDATE bookings
    SET status = 'EXPIRED',
        updated_at = now()
    WHERE status = 'PENDING'
      AND created_at < now() - ($1::text || ' minutes')::interval
      AND start_at > now()
    RETURNING id;
  `;

  const r = await pool.query(q, [holdMinutes]);

  if (r.rowCount > 0) {
    console.log(`⏳ Expired ${r.rowCount} pending bookings`);
  }
}

function startExpireJob() {
  // run once at startup, then every 60s
  expirePendingBookings().catch((e) => console.error("Expire job error:", e));

  setInterval(() => {
    expirePendingBookings().catch((e) => console.error("Expire job error:", e));
  }, 60_000);
}

module.exports = { startExpireJob, expirePendingBookings };
