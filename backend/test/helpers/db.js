const { pool } = require("../../src/config/db");

async function cleanupTestBookings(parkingId) {
  await pool.query(`DELETE FROM payments WHERE booking_id IN (SELECT id FROM bookings WHERE parking_id = $1)`, [parkingId]);
  await pool.query(`DELETE FROM bookings WHERE parking_id = $1`, [parkingId]);
}

module.exports = { cleanupTestBookings };
